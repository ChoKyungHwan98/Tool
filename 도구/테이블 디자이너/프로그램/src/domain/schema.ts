export type EntityId = string

export type TableId = EntityId

export type ColumnId = EntityId

export type RowId = string

export type JsonPrimitive = string | number | boolean | null

export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

export type CellValue = JsonValue

export interface DataRow {
  readonly rowId: RowId
  readonly cells: Readonly<Record<ColumnId, CellValue>>
}

export type RowsByTable = Readonly<Record<TableId, readonly DataRow[]>>

export const WORKBENCH_DOCUMENT_FORMAT_VERSION = 2

export type WorkbookFilterOperator =
  | 'contains'
  | 'equals'
  | 'starts_with'
  | 'is_blank'
  | 'is_not_blank'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'one_of'

export interface WorkbookColumnFilter {
  readonly columnId: ColumnId
  readonly operator: WorkbookFilterOperator
  readonly value?: string
  readonly secondValue?: string
  readonly values?: readonly string[]
}

export interface WorkbookSort {
  readonly columnId: ColumnId
  readonly descending: boolean
}

export interface TableWorkbookViewState {
  readonly columnWidths: Readonly<Record<ColumnId, number>>
  readonly hiddenColumnIds: readonly ColumnId[]
  readonly frozenColumnIds: readonly ColumnId[]
  readonly sorting: readonly WorkbookSort[]
  readonly filters: readonly WorkbookColumnFilter[]
}

export interface MigrationState {
  readonly pending: readonly unknown[]
  readonly unresolvedRows: readonly RowId[]
}

export interface AuditEvent {
  readonly auditEventId: EntityId
  readonly revision: number
  readonly type: string
  readonly createdAt: string
  readonly summary: string
}

export interface WorkbenchDocument {
  readonly formatVersion: number
  readonly revision: number
  readonly schema: SchemaProject
  readonly rowsByTable: RowsByTable
  readonly workbookViews: Readonly<Record<TableId, TableWorkbookViewState>>
  readonly migrationState: MigrationState
  readonly auditLog: readonly AuditEvent[]
}

export const DATA_TYPE_KINDS = [
  'string',
  'int32',
  'int64',
  'float',
  'double',
  'boolean',
  'enum',
  'date',
  'datetime',
  'resource_ref',
  'localization_ref',
  'json',
  'list',
] as const

export type DataTypeKind = (typeof DATA_TYPE_KINDS)[number]

export type ColumnDataType =
  | { kind: Exclude<DataTypeKind, 'enum' | 'list'> }
  | { kind: 'enum'; enumId: EntityId }
  | { kind: 'list'; itemType: Exclude<DataTypeKind, 'list'> }

export const RELATION_KINDS = [
  'hard_fk',
  'soft_ref',
  'enum_ref',
  'resource_ref',
  'localization_ref',
  'polymorphic_ref',
  'multi_ref',
  'derived_ref',
] as const

export type RelationKind = (typeof RELATION_KINDS)[number]

export const ISSUE_SEVERITIES = ['info', 'warning', 'error', 'blocking'] as const

export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number]

export interface ValidationRule {
  readonly ruleId: EntityId
  readonly kind: 'not_null' | 'min' | 'max' | 'range' | 'regex' | 'one_of'
  readonly message: string
  readonly value?: unknown
}

export interface SchemaColumn {
  readonly columnId: EntityId
  readonly tableId: EntityId
  readonly name: string
  readonly displayName: string
  readonly description: string
  readonly dataType: ColumnDataType
  readonly nullable: boolean
  readonly defaultValue?: unknown
  readonly validationRules: readonly ValidationRule[]
  readonly semanticType?: string
  readonly deprecated: boolean
}

export interface PrimaryKey {
  readonly columnIds: readonly EntityId[]
}

export interface UniqueConstraint {
  readonly constraintId: EntityId
  readonly name: string
  readonly columnIds: readonly EntityId[]
}

export interface CheckConstraint {
  readonly constraintId: EntityId
  readonly name: string
  readonly expression: string
  readonly columnIds: readonly EntityId[]
  readonly description: string
}

export interface SchemaTable {
  readonly tableId: EntityId
  readonly name: string
  readonly displayName: string
  readonly description: string
  readonly columns: readonly SchemaColumn[]
  readonly primaryKey: PrimaryKey
  readonly uniqueConstraints: readonly UniqueConstraint[]
  readonly checkConstraints: readonly CheckConstraint[]
  readonly tags: readonly string[]
  readonly authoringOnly: boolean
  readonly runtimeOnly: boolean
}

export interface SchemaEnumValue {
  readonly enumValueId: EntityId
  readonly name: string
  readonly displayName: string
}

export interface SchemaEnum {
  readonly enumId: EntityId
  readonly name: string
  readonly values: readonly SchemaEnumValue[]
}

export interface Relation {
  readonly relationId: EntityId
  readonly name: string
  readonly kind: RelationKind
  readonly sourceTableId: EntityId
  readonly sourceColumnIds: readonly EntityId[]
  readonly targetTableId: EntityId
  readonly targetColumnIds: readonly EntityId[]
  readonly required: boolean
}

export interface FunctionalDependency {
  readonly dependencyId: EntityId
  readonly tableId: EntityId
  readonly determinantColumnIds: readonly EntityId[]
  readonly dependentColumnIds: readonly EntityId[]
  readonly note: string
}

export interface ExportColumn {
  readonly exportColumnId: EntityId
  readonly sourceTableId: EntityId
  readonly sourceColumnId: EntityId
  readonly header: string
  readonly transform?: 'copy' | 'enum_name' | 'default_if_null' | 'join_list'
}

export interface ExportView {
  readonly viewId: EntityId
  readonly name: string
  readonly displayName: string
  readonly description: string
  readonly format: 'csv' | 'json'
  readonly rootTableId: EntityId
  readonly columns: readonly ExportColumn[]
}

export interface CanvasNodeLayout {
  readonly entityId: EntityId
  readonly x: number
  readonly y: number
}

export interface ProjectLayout {
  readonly nodes: readonly CanvasNodeLayout[]
}

export interface CommandHistoryEntry {
  readonly commandId: EntityId
  readonly type: string
  readonly summary: string
  readonly executedAt: string
  readonly affectedEntityIds: readonly EntityId[]
}

export interface SchemaProject {
  readonly projectId: EntityId
  readonly name: string
  readonly schemaVersion: string
  readonly tables: readonly SchemaTable[]
  readonly enums: readonly SchemaEnum[]
  readonly relations: readonly Relation[]
  readonly functionalDependencies: readonly FunctionalDependency[]
  readonly exportViews: readonly ExportView[]
  readonly layout: ProjectLayout
  readonly commandHistory: readonly CommandHistoryEntry[]
}

export interface ValidationIssue {
  readonly issueId: EntityId
  readonly severity: IssueSeverity
  readonly title: string
  readonly message: string
  readonly tableIds: readonly EntityId[]
  readonly columnIds: readonly EntityId[]
  readonly relationIds: readonly EntityId[]
  readonly rowIndices?: readonly number[]
  readonly dataPath?: readonly string[]
  readonly suggestedFix: string
}

export interface ImpactReport {
  readonly summary: string
  readonly affectedTableIds: readonly EntityId[]
  readonly affectedColumnIds: readonly EntityId[]
  readonly affectedRelationIds: readonly EntityId[]
  readonly affectedExportViewIds: readonly EntityId[]
  readonly affectedCsvHeaders: readonly string[]
  readonly existingDataRisk: readonly string[]
  readonly requiredConfirmations: readonly string[]
}
