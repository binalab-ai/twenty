import { buildSpreadsheetImportRelationMatchWarningMessage } from '@/object-record/spreadsheet-import/utils/buildSpreadsheetImportRelationMatchWarningMessage';
import { type SpreadsheetImportRelationMatchWarning } from '@/object-record/spreadsheet-import/utils/resolveSpreadsheetImportRelationMatchByLabel';
import { type SpreadsheetImportField } from '@/spreadsheet-import/types';

describe('buildSpreadsheetImportRelationMatchWarningMessage', () => {
  const spreadsheetImportFields = [
    {
      key: 'name (company)-matchByLabel',
      label: 'Company / Name (match by name)',
    },
  ] as unknown as SpreadsheetImportField[];

  it('summarizes not_found, multiple_matches and too_many_distinct_values counts per field', () => {
    const warningsByFieldKey = new Map<
      string,
      SpreadsheetImportRelationMatchWarning[]
    >([
      [
        'name (company)-matchByLabel',
        [
          { value: 'Unknown Co', reason: 'not_found' },
          { value: 'Another Unknown Co', reason: 'not_found' },
          { value: 'Ambiguous Co', reason: 'multiple_matches' },
          { value: 'Overflow Co', reason: 'too_many_distinct_values' },
        ],
      ],
    ]);

    const message = buildSpreadsheetImportRelationMatchWarningMessage({
      warningsByFieldKey,
      spreadsheetImportFields,
    });

    expect(message).toContain('Company / Name (match by name)');
    expect(message).toContain('2');
    expect(message).toContain('1');
  });

  it('falls back to the raw field key when no matching spreadsheet import field is found', () => {
    const warningsByFieldKey = new Map<
      string,
      SpreadsheetImportRelationMatchWarning[]
    >([['unknown-key', [{ value: 'Some Co', reason: 'not_found' }]]]);

    const message = buildSpreadsheetImportRelationMatchWarningMessage({
      warningsByFieldKey,
      spreadsheetImportFields,
    });

    expect(message).toContain('unknown-key');
  });
});
