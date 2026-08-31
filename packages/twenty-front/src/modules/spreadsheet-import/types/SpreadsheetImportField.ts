import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { type SpreadsheetImportFieldType } from '@/spreadsheet-import/types/SpreadsheetImportFieldType';
import { type SpreadsheetImportFieldValidationDefinition } from '@/spreadsheet-import/types/SpreadsheetImportFieldValidationDefinition';
import { type FieldMetadataType } from 'twenty-shared/types';
import { type IconComponent } from 'twenty-ui/icon';

export type SpreadsheetImportField = {
  Icon: IconComponent | null | undefined;
  label: string;
  key: string;
  // Field's metadata item id - same for all associated nested fields
  fieldMetadataItemId: string;
  // UI-facing additional information displayed via tooltip and ? icon
  description?: string;
  fieldValidationDefinitions?: SpreadsheetImportFieldValidationDefinition[];
  fieldType: SpreadsheetImportFieldType;
  // Field metadata type
  fieldMetadataType: FieldMetadataType;
  // if true, it can be a composite sub-field or a relation connect field (or both)
  isNestedField: boolean;
  // can be true only if isNestedField is true
  isCompositeSubField?: boolean;
  // defined only if isCompositeSubField is true
  compositeSubFieldKey?: string;
  // can be true only if isNestedField is true
  isRelationConnectField?: boolean;
  // defined only if isRelationConnectField is true
  uniqueFieldMetadataItem?: FieldMetadataItem;
  // can be true only if isRelationConnectField is true - resolves the target record
  // by matching its label field instead of requiring an exact unique-constraint value
  isRelationMatchByLabelField?: boolean;
  // defined only if isRelationMatchByLabelField is true - the target object's label
  // identifier field, matched case-insensitively and trimmed
  relationMatchLabelFieldMetadataItem?: FieldMetadataItem;
  // defined only if isRelationMatchByLabelField is true - when no match is found,
  // create the target record from the label value instead of leaving the relation empty
  relationMatchAllowCreateOnNoMatch?: boolean;
};
