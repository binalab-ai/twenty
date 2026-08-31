import { type ApolloClient } from '@apollo/client';

import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import {
  resolveSpreadsheetImportRelationMatchByLabel,
  type SpreadsheetImportRelationMatchWarning,
} from '@/object-record/spreadsheet-import/utils/resolveSpreadsheetImportRelationMatchByLabel';
import {
  type ImportedStructuredRow,
  type SpreadsheetImportFields,
} from '@/spreadsheet-import/types';
import { type ObjectPermissions } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

export type SpreadsheetImportRelationMatchResolutions = {
  // fieldKey -> (normalized label value -> resolved record id)
  resolvedIdsByFieldKey: Map<string, Map<string, string>>;
  // fieldKey -> warnings for values left unresolved on that column
  warningsByFieldKey: Map<string, SpreadsheetImportRelationMatchWarning[]>;
};

// Runs once per import submission, before building the create-record payloads:
// for every column mapped to a "match or create by name" relation field, resolves
// all the distinct values used across the whole import in a single lookup (plus a
// create call per unmatched value, when that field allows it), rather than doing
// it row by row.
export const resolveSpreadsheetImportRelationMatches = async ({
  apolloCoreClient,
  objectMetadataItems,
  objectPermissionsByObjectMetadataId,
  fieldMetadataItems,
  spreadsheetImportFields,
  validStructuredRows,
}: {
  apolloCoreClient: ApolloClient;
  objectMetadataItems: EnrichedObjectMetadataItem[];
  objectPermissionsByObjectMetadataId: Record<
    string,
    ObjectPermissions & { objectMetadataId: string }
  >;
  fieldMetadataItems: FieldMetadataItem[];
  spreadsheetImportFields: SpreadsheetImportFields;
  validStructuredRows: ImportedStructuredRow[];
}): Promise<SpreadsheetImportRelationMatchResolutions> => {
  const resolvedIdsByFieldKey = new Map<string, Map<string, string>>();
  const warningsByFieldKey = new Map<
    string,
    SpreadsheetImportRelationMatchWarning[]
  >();

  const matchByLabelFields = spreadsheetImportFields.filter(
    (field) => field.isRelationMatchByLabelField === true,
  );

  for (const matchByLabelField of matchByLabelFields) {
    const sourceFieldMetadataItem = fieldMetadataItems.find(
      (field) => field.id === matchByLabelField.fieldMetadataItemId,
    );

    const targetObjectMetadataItemId =
      sourceFieldMetadataItem?.relation?.targetObjectMetadata.id;

    const targetObjectMetadataItem = objectMetadataItems.find(
      (objectMetadataItem) => objectMetadataItem.id === targetObjectMetadataItemId,
    );

    const labelFieldName =
      matchByLabelField.relationMatchLabelFieldMetadataItem?.name;

    if (!isDefined(targetObjectMetadataItem) || !isDefined(labelFieldName)) {
      continue;
    }

    const values = validStructuredRows.map(
      (row) => row[matchByLabelField.key] as string | undefined,
    );

    const { resolvedIdByNormalizedValue, warnings } =
      await resolveSpreadsheetImportRelationMatchByLabel({
        apolloCoreClient,
        objectMetadataItems,
        objectPermissionsByObjectMetadataId,
        targetObjectMetadataItem,
        labelFieldName,
        allowCreateOnNoMatch:
          matchByLabelField.relationMatchAllowCreateOnNoMatch === true,
        values: values.filter(isDefined),
      });

    resolvedIdsByFieldKey.set(matchByLabelField.key, resolvedIdByNormalizedValue);
    if (warnings.length > 0) {
      warningsByFieldKey.set(matchByLabelField.key, warnings);
    }
  }

  return { resolvedIdsByFieldKey, warningsByFieldKey };
};
