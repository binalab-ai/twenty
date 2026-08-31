import { type ApolloClient } from '@apollo/client';
import { v4 } from 'uuid';

import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { generateCreateOneRecordMutation } from '@/object-metadata/utils/generateCreateOneRecordMutation';
import { type RecordGqlOperationFindManyResult } from '@/object-record/graphql/types/RecordGqlOperationFindManyResult';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { getCreateOneRecordMutationResponseField } from '@/object-record/utils/getCreateOneRecordMutationResponseField';
import { generateFindManyRecordsQuery } from '@/object-record/utils/generateFindManyRecordsQuery';
import { isNonEmptyString } from '@sniptt/guards';
import { type ObjectPermissions } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

// Above this many distinct values for a single "match or create by name" column,
// the extra values are left unresolved (reported as warnings) rather than grown
// into an unbounded GraphQL filter.
const SPREADSHEET_IMPORT_RELATION_MATCH_MAX_DISTINCT_VALUES = 500;

export type SpreadsheetImportRelationMatchWarning = {
  value: string;
  reason: 'not_found' | 'multiple_matches' | 'too_many_distinct_values';
};

// Case-insensitive, whitespace-insensitive comparison key. toLocaleLowerCase is a
// no-op for Hebrew (no case distinction) but still normalizes it consistently.
const normalizeRelationMatchLabelValue = (value: string) =>
  value.trim().toLocaleLowerCase();

const createRelationRecordByLabel = async ({
  apolloCoreClient,
  objectMetadataItems,
  objectPermissionsByObjectMetadataId,
  targetObjectMetadataItem,
  labelFieldName,
  value,
}: {
  apolloCoreClient: ApolloClient;
  objectMetadataItems: EnrichedObjectMetadataItem[];
  objectPermissionsByObjectMetadataId: Record<
    string,
    ObjectPermissions & { objectMetadataId: string }
  >;
  targetObjectMetadataItem: EnrichedObjectMetadataItem;
  labelFieldName: string;
  value: string;
}): Promise<string> => {
  const createOneRecordMutation = generateCreateOneRecordMutation({
    objectMetadataItem: targetObjectMetadataItem,
    objectMetadataItems,
    recordGqlFields: { id: true, [labelFieldName]: true },
    objectPermissionsByObjectMetadataId,
  });

  const mutationResponseField = getCreateOneRecordMutationResponseField(
    targetObjectMetadataItem.nameSingular,
  );

  const id = v4();

  const result = await apolloCoreClient.mutate<ObjectRecord>({
    mutation: createOneRecordMutation,
    variables: {
      input: { id, [labelFieldName]: value },
    },
  });

  const createdId = result.data?.[mutationResponseField]?.id;

  // Should not happen (the mutation would have thrown), but don't silently
  // fall through to connecting a relation to an id we can't confirm exists.
  if (!isDefined(createdId)) {
    throw new Error(
      `Failed to create ${targetObjectMetadataItem.nameSingular} for "${value}"`,
    );
  }

  return createdId;
};

export const resolveSpreadsheetImportRelationMatchByLabel = async ({
  apolloCoreClient,
  objectMetadataItems,
  objectPermissionsByObjectMetadataId,
  targetObjectMetadataItem,
  labelFieldName,
  allowCreateOnNoMatch,
  values,
}: {
  apolloCoreClient: ApolloClient;
  objectMetadataItems: EnrichedObjectMetadataItem[];
  objectPermissionsByObjectMetadataId: Record<
    string,
    ObjectPermissions & { objectMetadataId: string }
  >;
  targetObjectMetadataItem: EnrichedObjectMetadataItem;
  labelFieldName: string;
  allowCreateOnNoMatch: boolean;
  values: string[];
}): Promise<{
  resolvedIdByNormalizedValue: Map<string, string>;
  warnings: SpreadsheetImportRelationMatchWarning[];
}> => {
  const resolvedIdByNormalizedValue = new Map<string, string>();
  const warnings: SpreadsheetImportRelationMatchWarning[] = [];

  // First occurrence of each distinct trimmed value, keyed by its normalized form.
  const trimmedValueByNormalizedValue = new Map<string, string>();
  for (const rawValue of values) {
    if (!isNonEmptyString(rawValue)) continue;
    const trimmedValue = rawValue.trim();
    if (trimmedValue.length === 0) continue;
    const normalizedValue = normalizeRelationMatchLabelValue(trimmedValue);
    if (!trimmedValueByNormalizedValue.has(normalizedValue)) {
      trimmedValueByNormalizedValue.set(normalizedValue, trimmedValue);
    }
  }

  if (trimmedValueByNormalizedValue.size === 0) {
    return { resolvedIdByNormalizedValue, warnings };
  }

  const distinctEntries = [...trimmedValueByNormalizedValue.entries()];
  const entriesToResolve = distinctEntries.slice(
    0,
    SPREADSHEET_IMPORT_RELATION_MATCH_MAX_DISTINCT_VALUES,
  );
  const entriesDropped = distinctEntries.slice(
    SPREADSHEET_IMPORT_RELATION_MATCH_MAX_DISTINCT_VALUES,
  );

  for (const [, trimmedValue] of entriesDropped) {
    warnings.push({ value: trimmedValue, reason: 'too_many_distinct_values' });
  }

  const findManyRecordsQuery = generateFindManyRecordsQuery({
    objectMetadataItem: targetObjectMetadataItem,
    objectMetadataItems,
    recordGqlFields: { id: true, [labelFieldName]: true },
    objectPermissionsByObjectMetadataId,
  });

  // ilike with no wildcard characters is a case-insensitive exact match (see
  // compute-where-condition-parts.ts on the server) - not a substring search.
  const filter = {
    or: entriesToResolve.map(([, trimmedValue]) => ({
      [labelFieldName]: { ilike: trimmedValue },
    })),
  };

  const result = await apolloCoreClient.query<RecordGqlOperationFindManyResult>({
    query: findManyRecordsQuery,
    variables: {
      filter,
      limit: SPREADSHEET_IMPORT_RELATION_MATCH_MAX_DISTINCT_VALUES * 2,
    },
    fetchPolicy: 'network-only',
  });

  const edges = result.data?.[targetObjectMetadataItem.namePlural]?.edges ?? [];

  const matchesByNormalizedValue = new Map<
    string,
    { id: string; label: string }[]
  >();
  for (const edge of edges) {
    const node = edge.node;
    const label = node?.[labelFieldName];
    if (!isNonEmptyString(label)) continue;
    const normalizedValue = normalizeRelationMatchLabelValue(label);
    const existing = matchesByNormalizedValue.get(normalizedValue) ?? [];
    existing.push({ id: node.id, label });
    matchesByNormalizedValue.set(normalizedValue, existing);
  }

  const normalizedValuesToCreate: string[] = [];

  for (const [normalizedValue, trimmedValue] of entriesToResolve) {
    const matches = matchesByNormalizedValue.get(normalizedValue) ?? [];

    if (matches.length === 1) {
      resolvedIdByNormalizedValue.set(normalizedValue, matches[0].id);
    } else if (matches.length > 1) {
      warnings.push({ value: trimmedValue, reason: 'multiple_matches' });
    } else if (allowCreateOnNoMatch) {
      normalizedValuesToCreate.push(normalizedValue);
    } else {
      warnings.push({ value: trimmedValue, reason: 'not_found' });
    }
  }

  if (normalizedValuesToCreate.length > 0) {
    const createdIds = await Promise.all(
      normalizedValuesToCreate.map((normalizedValue) =>
        createRelationRecordByLabel({
          apolloCoreClient,
          objectMetadataItems,
          objectPermissionsByObjectMetadataId,
          targetObjectMetadataItem,
          labelFieldName,
          value: trimmedValueByNormalizedValue.get(normalizedValue) as string,
        }),
      ),
    );

    normalizedValuesToCreate.forEach((normalizedValue, index) => {
      resolvedIdByNormalizedValue.set(normalizedValue, createdIds[index]);
    });
  }

  return { resolvedIdByNormalizedValue, warnings };
};

export { normalizeRelationMatchLabelValue };
