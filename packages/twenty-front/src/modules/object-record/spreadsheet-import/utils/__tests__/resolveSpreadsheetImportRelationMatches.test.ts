import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { resolveSpreadsheetImportRelationMatchByLabel } from '@/object-record/spreadsheet-import/utils/resolveSpreadsheetImportRelationMatchByLabel';
import { resolveSpreadsheetImportRelationMatches } from '@/object-record/spreadsheet-import/utils/resolveSpreadsheetImportRelationMatches';
import { type SpreadsheetImportField } from '@/spreadsheet-import/types';
import { FieldMetadataType } from '~/generated-metadata/graphql';

jest.mock(
  '@/object-record/spreadsheet-import/utils/resolveSpreadsheetImportRelationMatchByLabel',
);

const mockResolveSpreadsheetImportRelationMatchByLabel =
  resolveSpreadsheetImportRelationMatchByLabel as jest.MockedFunction<
    typeof resolveSpreadsheetImportRelationMatchByLabel
  >;

describe('resolveSpreadsheetImportRelationMatches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const relationFieldMetadataItem = {
    id: 'company-relation-field-id',
    name: 'company',
    type: FieldMetadataType.RELATION,
    relation: {
      targetObjectMetadata: { id: 'company-object-id' },
    },
  } as unknown as FieldMetadataItem;

  const targetObjectMetadataItem = {
    id: 'company-object-id',
    nameSingular: 'company',
    namePlural: 'companies',
    fields: [],
  } as unknown as EnrichedObjectMetadataItem;

  const matchByLabelField = {
    key: 'name (company)-matchByLabel',
    isRelationMatchByLabelField: true,
    fieldMetadataItemId: 'company-relation-field-id',
    relationMatchLabelFieldMetadataItem: { name: 'name' },
    relationMatchAllowCreateOnNoMatch: true,
  } as unknown as SpreadsheetImportField;

  it('does nothing when no field uses "match by name" (existing/plain imports)', async () => {
    const result = await resolveSpreadsheetImportRelationMatches({
      apolloCoreClient: {} as any,
      objectMetadataItems: [targetObjectMetadataItem],
      objectPermissionsByObjectMetadataId: {},
      fieldMetadataItems: [relationFieldMetadataItem],
      spreadsheetImportFields: [],
      validStructuredRows: [{ company: 'Acme' }],
    });

    expect(
      mockResolveSpreadsheetImportRelationMatchByLabel,
    ).not.toHaveBeenCalled();
    expect(result.resolvedIdsByFieldKey.size).toBe(0);
    expect(result.warningsByFieldKey.size).toBe(0);
  });

  it('resolves the distinct values of a "match by name" column exactly once for the whole import', async () => {
    mockResolveSpreadsheetImportRelationMatchByLabel.mockResolvedValue({
      resolvedIdByNormalizedValue: new Map([['acme corp', 'acme-id']]),
      warnings: [{ value: 'Unknown Co', reason: 'not_found' }],
    });

    const validStructuredRows = [
      { [matchByLabelField.key]: 'Acme Corp' },
      { [matchByLabelField.key]: 'Acme Corp' },
      { [matchByLabelField.key]: 'Unknown Co' },
    ];

    const result = await resolveSpreadsheetImportRelationMatches({
      apolloCoreClient: {} as any,
      objectMetadataItems: [targetObjectMetadataItem],
      objectPermissionsByObjectMetadataId: {},
      fieldMetadataItems: [relationFieldMetadataItem],
      spreadsheetImportFields: [matchByLabelField],
      validStructuredRows,
    });

    expect(
      mockResolveSpreadsheetImportRelationMatchByLabel,
    ).toHaveBeenCalledTimes(1);
    expect(
      mockResolveSpreadsheetImportRelationMatchByLabel.mock.calls[0][0].values,
    ).toEqual(['Acme Corp', 'Acme Corp', 'Unknown Co']);

    expect(
      result.resolvedIdsByFieldKey.get(matchByLabelField.key)?.get('acme corp'),
    ).toBe('acme-id');
    expect(result.warningsByFieldKey.get(matchByLabelField.key)).toEqual([
      { value: 'Unknown Co', reason: 'not_found' },
    ]);
  });

  it('skips a "match by name" field when its target object or label field cannot be resolved', async () => {
    const orphanField = {
      ...matchByLabelField,
      key: 'orphan-matchByLabel',
      fieldMetadataItemId: 'does-not-exist',
    } as unknown as SpreadsheetImportField;

    const result = await resolveSpreadsheetImportRelationMatches({
      apolloCoreClient: {} as any,
      objectMetadataItems: [targetObjectMetadataItem],
      objectPermissionsByObjectMetadataId: {},
      fieldMetadataItems: [relationFieldMetadataItem],
      spreadsheetImportFields: [orphanField],
      validStructuredRows: [{}],
    });

    expect(
      mockResolveSpreadsheetImportRelationMatchByLabel,
    ).not.toHaveBeenCalled();
    expect(result.resolvedIdsByFieldKey.size).toBe(0);
  });
});
