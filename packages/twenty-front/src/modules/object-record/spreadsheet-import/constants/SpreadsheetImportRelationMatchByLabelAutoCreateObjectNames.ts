// Target objects that "match or create by name" is allowed to create a record for
// when no existing record matches. Kept as an explicit allowlist rather than
// inferred from field metadata (e.g. isNullable): a target object can require
// more than its label to create a valid record (Person needs an email), and that
// isn't reliably derivable from "isNullable" alone (many isNullable:false fields
// are system-managed with defaults, not user-required). Add an object here only
// once its label field is genuinely sufficient to create it.
export const SPREADSHEET_IMPORT_RELATION_MATCH_BY_LABEL_AUTO_CREATE_OBJECT_NAME_SINGULARS =
  new Set<string>(['company']);
