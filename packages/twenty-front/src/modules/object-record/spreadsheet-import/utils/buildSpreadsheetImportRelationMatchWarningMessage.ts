import { type SpreadsheetImportRelationMatchWarning } from '@/object-record/spreadsheet-import/utils/resolveSpreadsheetImportRelationMatchByLabel';
import { type SpreadsheetImportFields } from '@/spreadsheet-import/types';
import { t } from '@lingui/core/macro';

// Turns the per-column warnings from resolveSpreadsheetImportRelationMatches into a single
// snackbar message, grouped by column and reason, so a user importing hundreds of rows gets
// one summary instead of one warning per row.
export const buildSpreadsheetImportRelationMatchWarningMessage = ({
  warningsByFieldKey,
  spreadsheetImportFields,
}: {
  warningsByFieldKey: Map<string, SpreadsheetImportRelationMatchWarning[]>;
  spreadsheetImportFields: SpreadsheetImportFields;
}): string => {
  const fieldSummaries = [...warningsByFieldKey.entries()].map(
    ([fieldKey, warnings]) => {
      const fieldLabel =
        spreadsheetImportFields.find((field) => field.key === fieldKey)
          ?.label ?? fieldKey;

      const notFoundCount = warnings.filter(
        (warning) => warning.reason === 'not_found',
      ).length;
      const multipleMatchesCount = warnings.filter(
        (warning) => warning.reason === 'multiple_matches',
      ).length;
      const tooManyDistinctValuesCount = warnings.filter(
        (warning) => warning.reason === 'too_many_distinct_values',
      ).length;

      const reasonSummaries: string[] = [];
      if (notFoundCount > 0) {
        reasonSummaries.push(`${notFoundCount} ${t`not found`}`);
      }
      if (multipleMatchesCount > 0) {
        reasonSummaries.push(
          `${multipleMatchesCount} ${t`matched more than one record`}`,
        );
      }
      if (tooManyDistinctValuesCount > 0) {
        reasonSummaries.push(
          `${tooManyDistinctValuesCount} ${t`skipped (too many distinct values)`}`,
        );
      }

      return `${fieldLabel}: ${reasonSummaries.join(', ')}`;
    },
  );

  return `${t`Some values could not be matched and were left empty.`} ${fieldSummaries.join(' — ')}`;
};
