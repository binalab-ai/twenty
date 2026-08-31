import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { resolveSpreadsheetImportRelationMatchByLabel } from '@/object-record/spreadsheet-import/utils/resolveSpreadsheetImportRelationMatchByLabel';
import { FieldMetadataType } from '~/generated-metadata/graphql';

describe('resolveSpreadsheetImportRelationMatchByLabel', () => {
  const targetObjectMetadataItem = {
    id: 'company-object-id',
    nameSingular: 'company',
    namePlural: 'companies',
    fields: [
      { id: 'id-field', name: 'id', type: FieldMetadataType.UUID },
      { id: 'name-field', name: 'name', type: FieldMetadataType.TEXT },
    ],
    readableFields: [
      { id: 'id-field', name: 'id', type: FieldMetadataType.UUID },
      { id: 'name-field', name: 'name', type: FieldMetadataType.TEXT },
    ],
    updatableFields: [
      { id: 'id-field', name: 'id', type: FieldMetadataType.UUID },
      { id: 'name-field', name: 'name', type: FieldMetadataType.TEXT },
    ],
  } as unknown as EnrichedObjectMetadataItem;

  const objectMetadataItems = [targetObjectMetadataItem];
  const objectPermissionsByObjectMetadataId = {};
  const labelFieldName = 'name';

  const buildApolloCoreClient = ({
    queryEdges = [],
    mutateImplementation,
  }: {
    queryEdges?: { node: { id: string; name: string } }[];
    mutateImplementation?: jest.Mock;
  } = {}) => ({
    query: jest.fn().mockResolvedValue({
      data: { companies: { edges: queryEdges } },
    }),
    mutate:
      mutateImplementation ??
      jest.fn().mockResolvedValue({
        data: { createCompany: { id: 'created-id', name: 'New Co' } },
      }),
  });

  it('returns no resolutions and no warnings when there are no values to resolve', async () => {
    const apolloCoreClient = buildApolloCoreClient();

    const result = await resolveSpreadsheetImportRelationMatchByLabel({
      apolloCoreClient: apolloCoreClient as any,
      objectMetadataItems,
      objectPermissionsByObjectMetadataId,
      targetObjectMetadataItem,
      labelFieldName,
      allowCreateOnNoMatch: false,
      values: ['', '   ', undefined as unknown as string],
    });

    expect(apolloCoreClient.query).not.toHaveBeenCalled();
    expect(result.resolvedIdByNormalizedValue.size).toBe(0);
    expect(result.warnings).toEqual([]);
  });

  it('resolves a value case-insensitively and trims whitespace', async () => {
    const apolloCoreClient = buildApolloCoreClient({
      queryEdges: [{ node: { id: 'acme-id', name: 'Acme Corp' } }],
    });

    const result = await resolveSpreadsheetImportRelationMatchByLabel({
      apolloCoreClient: apolloCoreClient as any,
      objectMetadataItems,
      objectPermissionsByObjectMetadataId,
      targetObjectMetadataItem,
      labelFieldName,
      allowCreateOnNoMatch: false,
      values: ['  ACME corp  '],
    });

    expect(result.resolvedIdByNormalizedValue.get('acme corp')).toBe(
      'acme-id',
    );
    expect(result.warnings).toEqual([]);
  });

  it('warns not_found when nothing matches and creation is not allowed', async () => {
    const apolloCoreClient = buildApolloCoreClient({ queryEdges: [] });

    const result = await resolveSpreadsheetImportRelationMatchByLabel({
      apolloCoreClient: apolloCoreClient as any,
      objectMetadataItems,
      objectPermissionsByObjectMetadataId,
      targetObjectMetadataItem,
      labelFieldName,
      allowCreateOnNoMatch: false,
      values: ['Unknown Co'],
    });

    expect(result.resolvedIdByNormalizedValue.size).toBe(0);
    expect(result.warnings).toEqual([
      { value: 'Unknown Co', reason: 'not_found' },
    ]);
    expect(apolloCoreClient.mutate).not.toHaveBeenCalled();
  });

  it('warns multiple_matches when more than one record matches the same normalized value', async () => {
    const apolloCoreClient = buildApolloCoreClient({
      queryEdges: [
        { node: { id: 'id-1', name: 'Acme Corp' } },
        { node: { id: 'id-2', name: 'acme corp' } },
      ],
    });

    const result = await resolveSpreadsheetImportRelationMatchByLabel({
      apolloCoreClient: apolloCoreClient as any,
      objectMetadataItems,
      objectPermissionsByObjectMetadataId,
      targetObjectMetadataItem,
      labelFieldName,
      allowCreateOnNoMatch: false,
      values: ['Acme Corp'],
    });

    expect(result.resolvedIdByNormalizedValue.size).toBe(0);
    expect(result.warnings).toEqual([
      { value: 'Acme Corp', reason: 'multiple_matches' },
    ]);
  });

  it('creates a record when nothing matches and creation is allowed', async () => {
    const mutateImplementation = jest.fn().mockResolvedValue({
      data: { createCompany: { id: 'created-id', name: 'New Co' } },
    });
    const apolloCoreClient = buildApolloCoreClient({
      queryEdges: [],
      mutateImplementation,
    });

    const result = await resolveSpreadsheetImportRelationMatchByLabel({
      apolloCoreClient: apolloCoreClient as any,
      objectMetadataItems,
      objectPermissionsByObjectMetadataId,
      targetObjectMetadataItem,
      labelFieldName,
      allowCreateOnNoMatch: true,
      values: ['New Co'],
    });

    expect(mutateImplementation).toHaveBeenCalledTimes(1);
    expect(result.resolvedIdByNormalizedValue.get('new co')).toBe(
      'created-id',
    );
    expect(result.warnings).toEqual([]);
  });

  it('resolves distinct values only once even when repeated across many rows', async () => {
    const apolloCoreClient = buildApolloCoreClient({
      queryEdges: [{ node: { id: 'acme-id', name: 'Acme Corp' } }],
    });

    await resolveSpreadsheetImportRelationMatchByLabel({
      apolloCoreClient: apolloCoreClient as any,
      objectMetadataItems,
      objectPermissionsByObjectMetadataId,
      targetObjectMetadataItem,
      labelFieldName,
      allowCreateOnNoMatch: false,
      values: ['Acme Corp', 'acme corp', ' ACME CORP ', 'Acme Corp'],
    });

    expect(apolloCoreClient.query).toHaveBeenCalledTimes(1);
  });
});
