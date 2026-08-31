import { renderHook } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';
import { useIcons } from 'twenty-ui/icon';
import { JestObjectMetadataItemSetter } from '~/testing/jest/JestObjectMetadataItemSetter';

import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import { setTestObjectMetadataItemsInMetadataStore } from '~/testing/utils/setTestObjectMetadataItemsInMetadataStore';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { type IndexMetadataItem } from '@/object-metadata/types/IndexMetadataItem';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { useBuildSpreadsheetImportFields } from '@/object-record/spreadsheet-import/hooks/useBuildSpreadSheetImportFields';
import { FieldMetadataType, RelationType } from '~/generated-metadata/graphql';

const Wrapper = ({ children }: { children: ReactNode }) => {
  return (
    <JotaiProvider store={jotaiStore}>
      <JestObjectMetadataItemSetter>{children}</JestObjectMetadataItemSetter>
    </JotaiProvider>
  );
};

jest.mock('twenty-ui/icon', () => ({
  useIcons: jest.fn(),
}));

describe('useBuildSpreadSheetImportFields', () => {
  const mockGetIcon = jest.fn().mockReturnValue('MockIcon');
  const mockUseIcons = useIcons as jest.MockedFunction<typeof useIcons>;

  beforeEach(() => {
    mockUseIcons.mockReturnValue({
      getIcon: mockGetIcon,
      getIcons: () => ({}),
    });
    jest.clearAllMocks();
    setTestObjectMetadataItemsInMetadataStore(jotaiStore, []);
  });

  const createMockFieldMetadataItem = (
    overrides: Partial<FieldMetadataItem> = {},
  ): FieldMetadataItem => ({
    id: 'test-field-id',
    universalIdentifier: 'test-field-id',
    name: 'testField',
    label: 'Test Field',
    type: FieldMetadataType.TEXT,
    icon: 'IconTest',
    isActive: true,
    isSystem: false,
    isNullable: true,
    createdAt: '2023-01-01',
    updatedAt: '2023-01-01',
    ...overrides,
  });

  const createMockObjectMetadataItem = (
    overrides: Partial<EnrichedObjectMetadataItem> = {},
  ): EnrichedObjectMetadataItem =>
    ({
      id: 'test-object-id',
      universalIdentifier: 'test-object-id',
      nameSingular: 'testObject',
      namePlural: 'testObjects',
      labelSingular: 'Test Object',
      labelPlural: 'Test Objects',
      description: 'Test object description',
      icon: 'IconTest',
      isSystem: false,
      isActive: true,
      isLabelSyncedWithName: false,
      isRemote: false,
      isSearchable: true,
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01',
      fields: [],
      ...overrides,
    }) as EnrichedObjectMetadataItem;

  it('should build importFields for basic field types', () => {
    const { result } = renderHook(() => useBuildSpreadsheetImportFields(), {
      wrapper: Wrapper,
    });

    const fieldMetadataItems: FieldMetadataItem[] = [
      createMockFieldMetadataItem({
        type: FieldMetadataType.TEXT,
        name: 'textField',
        label: 'Text Field',
      }),
      createMockFieldMetadataItem({
        type: FieldMetadataType.NUMBER,
        name: 'numberField',
        label: 'Number Field',
      }),
      createMockFieldMetadataItem({
        type: FieldMetadataType.BOOLEAN,
        name: 'booleanField',
        label: 'Boolean Field',
      }),
    ];

    const spreadsheetImportFields =
      result.current.buildSpreadsheetImportFields(fieldMetadataItems);

    expect(spreadsheetImportFields).toHaveLength(3);

    expect(spreadsheetImportFields[0]).toMatchObject({
      label: 'Text Field',
      key: 'textField',
      fieldType: { type: 'input' },
      fieldMetadataType: FieldMetadataType.TEXT,
      isNestedField: false,
    });

    expect(spreadsheetImportFields[1]).toMatchObject({
      label: 'Number Field',
      key: 'numberField',
      fieldType: { type: 'input' },
      fieldMetadataType: FieldMetadataType.NUMBER,
      isNestedField: false,
    });

    expect(spreadsheetImportFields[2]).toMatchObject({
      label: 'Boolean Field',
      key: 'booleanField',
      fieldType: { type: 'checkbox' },
      fieldMetadataType: FieldMetadataType.BOOLEAN,
      isNestedField: false,
    });
  });

  it('should build importFields for select types', () => {
    const { result } = renderHook(() => useBuildSpreadsheetImportFields(), {
      wrapper: Wrapper,
    });

    const fieldMetadataItems: FieldMetadataItem[] = [
      createMockFieldMetadataItem({
        type: FieldMetadataType.SELECT,
        name: 'selectField',
        label: 'Select Field',
        options: [
          {
            id: '1',
            label: 'Option 1',
            value: 'opt1',
            color: 'red',
            position: 0,
          },
          {
            id: '2',
            label: 'Option 2',
            value: 'opt2',
            color: 'blue',
            position: 1,
          },
        ],
      }),
      createMockFieldMetadataItem({
        type: FieldMetadataType.MULTI_SELECT,
        name: 'multiSelectField',
        label: 'Multi Select Field',
        options: [
          {
            id: '1',
            label: 'Tag 1',
            value: 'tag1',
            color: 'green',
            position: 0,
          },
          {
            id: '2',
            label: 'Tag 2',
            value: 'tag2',
            color: 'yellow',
            position: 1,
          },
        ],
      }),
    ];

    const spreadsheetImportFields =
      result.current.buildSpreadsheetImportFields(fieldMetadataItems);

    expect(spreadsheetImportFields).toHaveLength(2);

    expect(spreadsheetImportFields[0]).toMatchObject({
      label: 'Select Field',
      key: 'selectField',
      fieldType: {
        type: 'select',
        options: [
          { label: 'Option 1', value: 'opt1', color: 'red' },
          { label: 'Option 2', value: 'opt2', color: 'blue' },
        ],
      },
      fieldMetadataType: FieldMetadataType.SELECT,
    });

    expect(spreadsheetImportFields[1]).toMatchObject({
      label: 'Multi Select Field',
      key: 'multiSelectField',
      fieldType: {
        type: 'multiSelect',
        options: [
          { label: 'Tag 1', value: 'tag1', color: 'green' },
          { label: 'Tag 2', value: 'tag2', color: 'yellow' },
        ],
      },
      fieldMetadataType: FieldMetadataType.MULTI_SELECT,
    });
  });

  it('should build importFields for composite types (full name)', () => {
    const { result } = renderHook(() => useBuildSpreadsheetImportFields(), {
      wrapper: Wrapper,
    });

    const fieldMetadataItems: FieldMetadataItem[] = [
      createMockFieldMetadataItem({
        type: FieldMetadataType.FULL_NAME,
        name: 'fullName',
        label: 'Full Name',
      }),
    ];

    const spreadsheetImportFields =
      result.current.buildSpreadsheetImportFields(fieldMetadataItems);

    expect(spreadsheetImportFields.length).toBe(2);

    const firstNameField = spreadsheetImportFields.find((field) =>
      field.key.includes('First Name'),
    );
    const lastNameField = spreadsheetImportFields.find((field) =>
      field.key.includes('Last Name'),
    );

    expect(firstNameField).toBeDefined();
    expect(lastNameField).toBeDefined();

    expect(firstNameField?.isNestedField).toBe(true);
    expect(firstNameField?.isCompositeSubField).toBe(true);
    expect(lastNameField?.isNestedField).toBe(true);
    expect(lastNameField?.isCompositeSubField).toBe(true);
  });

  it('should filter out ACTOR fields', () => {
    const { result } = renderHook(() => useBuildSpreadsheetImportFields(), {
      wrapper: Wrapper,
    });

    const fieldMetadataItems: FieldMetadataItem[] = [
      createMockFieldMetadataItem({
        type: FieldMetadataType.ACTOR,
        name: 'actorField',
        label: 'Actor Field',
      }),
      createMockFieldMetadataItem({
        type: FieldMetadataType.TEXT,
        name: 'textField',
        label: 'Text Field',
      }),
    ];

    const spreadsheetImportFields =
      result.current.buildSpreadsheetImportFields(fieldMetadataItems);

    expect(spreadsheetImportFields).toHaveLength(1);
    expect(spreadsheetImportFields[0].fieldMetadataType).toBe(
      FieldMetadataType.TEXT,
    );
  });

  it('should return empty array for unsupported field types', () => {
    const { result } = renderHook(() => useBuildSpreadsheetImportFields(), {
      wrapper: Wrapper,
    });

    const fieldMetadataItems: FieldMetadataItem[] = [
      createMockFieldMetadataItem({
        type: FieldMetadataType.POSITION,
        name: 'positionField',
        label: 'Position Field',
      }),
      createMockFieldMetadataItem({
        type: FieldMetadataType.TS_VECTOR,
        name: 'tsVectorField',
        label: 'TS Vector Field',
      }),
    ];

    const spreadsheetImportFields =
      result.current.buildSpreadsheetImportFields(fieldMetadataItems);

    expect(spreadsheetImportFields).toHaveLength(0);
  });

  it('should build importFields for relation field type', () => {
    const targetObjectMetadata = createMockObjectMetadataItem({
      id: 'target-object-id',
      nameSingular: 'company',
      namePlural: 'companies',
      labelSingular: 'Company',
      labelPlural: 'Companies',
      fields: [
        createMockFieldMetadataItem({
          id: 'company-id-field',
          name: 'id',
          label: 'ID',
          type: FieldMetadataType.UUID,
        }),
        createMockFieldMetadataItem({
          id: 'company-name-field',
          name: 'name',
          label: 'Name',
          type: FieldMetadataType.TEXT,
        }),
        createMockFieldMetadataItem({
          id: 'company-email-field',
          name: 'emails',
          label: 'Emails',
          type: FieldMetadataType.EMAILS,
        }),
      ],
      indexMetadatas: [
        {
          id: 'primary-key-index',
          name: 'primaryKeyIndex',
          createdAt: '2023-01-01',
          updatedAt: '2023-01-01',
          isUnique: true,
          indexFieldMetadatas: [
            {
              id: 'index-field-1',
              fieldMetadataId: 'company-id-field',
              createdAt: '2023-01-01',
              updatedAt: '2023-01-01',
              order: 0,
            },
          ],
        },
        {
          id: 'unique-name-index',
          name: 'uniqueNameIndex',
          createdAt: '2023-01-01',
          updatedAt: '2023-01-01',
          isUnique: true,
          indexFieldMetadatas: [
            {
              id: 'index-field-2',
              fieldMetadataId: 'company-name-field',
              createdAt: '2023-01-01',
              updatedAt: '2023-01-01',
              order: 0,
            },
          ],
        },
        {
          id: 'unique-email-index',
          name: 'uniqueEmailIndex',
          createdAt: '2023-01-01',
          updatedAt: '2023-01-01',
          isUnique: true,
          indexFieldMetadatas: [
            {
              id: 'index-field-3',
              fieldMetadataId: 'company-email-field',
              createdAt: '2023-01-01',
              updatedAt: '2023-01-01',
              order: 0,
            },
          ],
        },
      ] as IndexMetadataItem[],
    });

    const RelationTestWrapper = ({ children }: { children: ReactNode }) => (
      <JotaiProvider store={jotaiStore}>
        <JestObjectMetadataItemSetter
          objectMetadataItems={[targetObjectMetadata]}
        >
          {children}
        </JestObjectMetadataItemSetter>
      </JotaiProvider>
    );

    const { result } = renderHook(() => useBuildSpreadsheetImportFields(), {
      wrapper: RelationTestWrapper,
    });

    const fieldMetadataItems: FieldMetadataItem[] = [
      createMockFieldMetadataItem({
        type: FieldMetadataType.RELATION,
        name: 'company',
        label: 'Company',
        relation: {
          type: RelationType.MANY_TO_ONE,
          targetObjectMetadata: {
            id: 'target-object-id',
            nameSingular: 'company',
            namePlural: 'companies',
          },
        } as any,
      }),
    ];

    const spreadsheetImportFields =
      result.current.buildSpreadsheetImportFields(fieldMetadataItems);

    expect(spreadsheetImportFields).toHaveLength(4);

    const idField = spreadsheetImportFields.find((field) =>
      field.key.includes('id (company)'),
    );
    expect(idField).toBeDefined();
    expect(idField).toMatchObject({
      label: 'Company / ID',
      key: 'id (company)',
      fieldMetadataItemId: 'test-field-id',
      fieldMetadataType: FieldMetadataType.RELATION,
      isNestedField: true,
      isRelationConnectField: true,
      uniqueFieldMetadataItem: {
        id: 'company-id-field',
        name: 'id',
        type: FieldMetadataType.UUID,
      },
    });

    const nameField = spreadsheetImportFields.find((field) =>
      field.key.includes('name (company)'),
    );
    expect(nameField).toBeDefined();
    expect(nameField).toMatchObject({
      label: 'Company / Name',
      key: 'name (company)',
      fieldMetadataItemId: 'test-field-id',
      fieldMetadataType: FieldMetadataType.RELATION,
      isNestedField: true,
      isRelationConnectField: true,
      uniqueFieldMetadataItem: {
        id: 'company-name-field',
        name: 'name',
        type: FieldMetadataType.TEXT,
      },
    });

    const primaryEmailField = spreadsheetImportFields.find((field) =>
      field.key.includes('primaryEmail-emails (company)'),
    );
    expect(primaryEmailField).toBeDefined();
    expect(primaryEmailField).toMatchObject({
      isNestedField: true,
      isCompositeSubField: true,
      isRelationConnectField: true,
      compositeSubFieldKey: 'primaryEmail',
      uniqueFieldMetadataItem: {
        id: 'company-email-field',
        name: 'emails',
        type: FieldMetadataType.EMAILS,
      },
    });
  });

  it('should offer a "match by name" field for a relation whose label field is not already a unique constraint, allowing auto-create for an allowlisted target object (company)', () => {
    const nameField = createMockFieldMetadataItem({
      id: 'company-name-field',
      name: 'name',
      label: 'Name',
      type: FieldMetadataType.TEXT,
    });

    const targetObjectMetadata = createMockObjectMetadataItem({
      id: 'target-object-id',
      nameSingular: 'company',
      namePlural: 'companies',
      labelSingular: 'Company',
      labelPlural: 'Companies',
      labelIdentifierFieldMetadataId: 'company-name-field',
      fields: [
        createMockFieldMetadataItem({
          id: 'company-id-field',
          name: 'id',
          label: 'ID',
          type: FieldMetadataType.UUID,
        }),
        nameField,
      ],
      // getUniqueConstraintsFields always adds the primary key field itself
      // (found by name === 'id') - no need for an explicit primary-key index here.
      indexMetadatas: [] as IndexMetadataItem[],
    });

    const RelationTestWrapper = ({ children }: { children: ReactNode }) => (
      <JotaiProvider store={jotaiStore}>
        <JestObjectMetadataItemSetter
          objectMetadataItems={[targetObjectMetadata]}
        >
          {children}
        </JestObjectMetadataItemSetter>
      </JotaiProvider>
    );

    const { result } = renderHook(() => useBuildSpreadsheetImportFields(), {
      wrapper: RelationTestWrapper,
    });

    const fieldMetadataItems: FieldMetadataItem[] = [
      createMockFieldMetadataItem({
        type: FieldMetadataType.RELATION,
        name: 'company',
        label: 'Company',
        relation: {
          type: RelationType.MANY_TO_ONE,
          targetObjectMetadata: {
            id: 'target-object-id',
            nameSingular: 'company',
            namePlural: 'companies',
          },
        } as any,
      }),
    ];

    const spreadsheetImportFields =
      result.current.buildSpreadsheetImportFields(fieldMetadataItems);

    // The existing "id" unique-constraint field, plus the new "match by name" field.
    expect(spreadsheetImportFields).toHaveLength(2);

    const matchByLabelField = spreadsheetImportFields.find(
      (field) => field.isRelationMatchByLabelField === true,
    );
    expect(matchByLabelField).toBeDefined();
    expect(matchByLabelField).toMatchObject({
      key: 'name (company)-matchByLabel',
      label: 'Company / Name (match by name)',
      isRelationConnectField: true,
      isRelationMatchByLabelField: true,
      relationMatchAllowCreateOnNoMatch: true,
      relationMatchLabelFieldMetadataItem: nameField,
    });
  });

  it('should not offer "match by name" auto-create for a target object outside the allowlist', () => {
    const nameField = createMockFieldMetadataItem({
      id: 'person-name-field',
      name: 'name',
      label: 'Name',
      type: FieldMetadataType.TEXT,
    });

    const targetObjectMetadata = createMockObjectMetadataItem({
      id: 'target-object-id',
      nameSingular: 'person',
      namePlural: 'people',
      labelSingular: 'Person',
      labelPlural: 'People',
      labelIdentifierFieldMetadataId: 'person-name-field',
      fields: [
        createMockFieldMetadataItem({
          id: 'person-id-field',
          name: 'id',
          label: 'ID',
          type: FieldMetadataType.UUID,
        }),
        nameField,
      ],
      indexMetadatas: [],
    });

    const RelationTestWrapper = ({ children }: { children: ReactNode }) => (
      <JotaiProvider store={jotaiStore}>
        <JestObjectMetadataItemSetter
          objectMetadataItems={[targetObjectMetadata]}
        >
          {children}
        </JestObjectMetadataItemSetter>
      </JotaiProvider>
    );

    const { result } = renderHook(() => useBuildSpreadsheetImportFields(), {
      wrapper: RelationTestWrapper,
    });

    const fieldMetadataItems: FieldMetadataItem[] = [
      createMockFieldMetadataItem({
        type: FieldMetadataType.RELATION,
        name: 'person',
        label: 'Person',
        relation: {
          type: RelationType.MANY_TO_ONE,
          targetObjectMetadata: {
            id: 'target-object-id',
            nameSingular: 'person',
            namePlural: 'people',
          },
        } as any,
      }),
    ];

    const spreadsheetImportFields =
      result.current.buildSpreadsheetImportFields(fieldMetadataItems);

    const matchByLabelField = spreadsheetImportFields.find(
      (field) => field.isRelationMatchByLabelField === true,
    );
    expect(matchByLabelField).toBeDefined();
    expect(matchByLabelField?.relationMatchAllowCreateOnNoMatch).toBe(false);
  });

  it('should not offer a duplicate "match by name" field when the label field is already a unique constraint field', () => {
    const nameField = createMockFieldMetadataItem({
      id: 'company-name-field',
      name: 'name',
      label: 'Name',
      type: FieldMetadataType.TEXT,
    });

    const targetObjectMetadata = createMockObjectMetadataItem({
      id: 'target-object-id',
      nameSingular: 'company',
      namePlural: 'companies',
      labelSingular: 'Company',
      labelPlural: 'Companies',
      labelIdentifierFieldMetadataId: 'company-name-field',
      fields: [
        createMockFieldMetadataItem({
          id: 'company-id-field',
          name: 'id',
          label: 'ID',
          type: FieldMetadataType.UUID,
        }),
        nameField,
      ],
      indexMetadatas: [
        {
          id: 'unique-name-index',
          name: 'uniqueNameIndex',
          createdAt: '2023-01-01',
          updatedAt: '2023-01-01',
          isUnique: true,
          indexFieldMetadatas: [
            {
              id: 'index-field-1',
              fieldMetadataId: 'company-name-field',
              createdAt: '2023-01-01',
              updatedAt: '2023-01-01',
              order: 0,
            },
          ],
        },
      ] as IndexMetadataItem[],
    });

    const RelationTestWrapper = ({ children }: { children: ReactNode }) => (
      <JotaiProvider store={jotaiStore}>
        <JestObjectMetadataItemSetter
          objectMetadataItems={[targetObjectMetadata]}
        >
          {children}
        </JestObjectMetadataItemSetter>
      </JotaiProvider>
    );

    const { result } = renderHook(() => useBuildSpreadsheetImportFields(), {
      wrapper: RelationTestWrapper,
    });

    const fieldMetadataItems: FieldMetadataItem[] = [
      createMockFieldMetadataItem({
        type: FieldMetadataType.RELATION,
        name: 'company',
        label: 'Company',
        relation: {
          type: RelationType.MANY_TO_ONE,
          targetObjectMetadata: {
            id: 'target-object-id',
            nameSingular: 'company',
            namePlural: 'companies',
          },
        } as any,
      }),
    ];

    const spreadsheetImportFields =
      result.current.buildSpreadsheetImportFields(fieldMetadataItems);

    // The "id" and unique-constraint "name" fields - no separate "match by name" field.
    expect(spreadsheetImportFields).toHaveLength(2);
    expect(
      spreadsheetImportFields.some(
        (field) => field.isRelationMatchByLabelField === true,
      ),
    ).toBe(false);
  });
});
