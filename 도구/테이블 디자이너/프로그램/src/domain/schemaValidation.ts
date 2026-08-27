import { z } from 'zod'
import { DATA_TYPE_KINDS, ISSUE_SEVERITIES, RELATION_KINDS, WORKBENCH_DOCUMENT_FORMAT_VERSION, type SchemaProject, type WorkbenchDocument } from './schema'

const entityIdSchema = z.string().min(1)

const dataTypeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum(DATA_TYPE_KINDS.filter((kind) => kind !== 'enum' && kind !== 'list')) }),
  z.object({ kind: z.literal('enum'), enumId: entityIdSchema }),
  z.object({ kind: z.literal('list'), itemType: z.enum(DATA_TYPE_KINDS.filter((kind) => kind !== 'list')) }),
])

const validationRuleSchema = z.object({
  ruleId: entityIdSchema,
  kind: z.enum(['not_null', 'min', 'max', 'range', 'regex', 'one_of']),
  message: z.string(),
  value: z.unknown().optional(),
})

const columnSchema = z.object({
  columnId: entityIdSchema,
  tableId: entityIdSchema,
  name: z.string().min(1),
  displayName: z.string(),
  description: z.string(),
  dataType: dataTypeSchema,
  nullable: z.boolean(),
  defaultValue: z.unknown().optional(),
  validationRules: z.array(validationRuleSchema),
  semanticType: z.string().optional(),
  deprecated: z.boolean(),
})

const constraintSchema = z.object({
  constraintId: entityIdSchema,
  name: z.string().min(1),
  columnIds: z.array(entityIdSchema),
})

const checkConstraintSchema = constraintSchema.extend({
  expression: z.string().min(1),
  description: z.string(),
})

const tableSchema = z.object({
  tableId: entityIdSchema,
  name: z.string().min(1),
  displayName: z.string(),
  description: z.string(),
  columns: z.array(columnSchema),
  primaryKey: z.object({ columnIds: z.array(entityIdSchema) }),
  uniqueConstraints: z.array(constraintSchema),
  checkConstraints: z.array(checkConstraintSchema),
  tags: z.array(z.string()),
  authoringOnly: z.boolean(),
  runtimeOnly: z.boolean(),
})

const enumValueSchema = z.object({
  enumValueId: entityIdSchema,
  name: z.string().min(1),
  displayName: z.string(),
})

const enumSchema = z.object({
  enumId: entityIdSchema,
  name: z.string().min(1),
  values: z.array(enumValueSchema),
})

const relationSchema = z.object({
  relationId: entityIdSchema,
  name: z.string().min(1),
  kind: z.enum(RELATION_KINDS),
  sourceTableId: entityIdSchema,
  sourceColumnIds: z.array(entityIdSchema),
  targetTableId: entityIdSchema,
  targetColumnIds: z.array(entityIdSchema),
  required: z.boolean(),
})

const functionalDependencySchema = z.object({
  dependencyId: entityIdSchema,
  tableId: entityIdSchema,
  determinantColumnIds: z.array(entityIdSchema),
  dependentColumnIds: z.array(entityIdSchema),
  note: z.string(),
})

const exportColumnSchema = z.object({
  exportColumnId: entityIdSchema,
  sourceTableId: entityIdSchema,
  sourceColumnId: entityIdSchema,
  header: z.string().min(1),
  transform: z.enum(['copy', 'enum_name', 'default_if_null', 'join_list']).optional(),
})

const exportViewSchema = z.object({
  viewId: entityIdSchema,
  name: z.string().min(1),
  displayName: z.string(),
  description: z.string(),
  format: z.enum(['csv', 'json']),
  rootTableId: entityIdSchema,
  columns: z.array(exportColumnSchema),
})

const layoutSchema = z.object({
  nodes: z.array(z.object({
    entityId: entityIdSchema,
    x: z.number(),
    y: z.number(),
  })),
})

const commandHistoryEntrySchema = z.object({
  commandId: entityIdSchema,
  type: z.string().min(1),
  summary: z.string(),
  executedAt: z.string(),
  affectedEntityIds: z.array(entityIdSchema),
})

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
)

const dataRowSchema = z.object({
  rowId: z.string().min(1),
  cells: z.record(entityIdSchema, jsonValueSchema),
})

const migrationStateSchema = z.object({
  pending: z.array(z.unknown()),
  unresolvedRows: z.array(z.string().min(1)),
})

const auditEventSchema = z.object({
  auditEventId: entityIdSchema,
  revision: z.number().int().nonnegative(),
  type: z.string().min(1),
  createdAt: z.string(),
  summary: z.string(),
})

const workbookColumnFilterSchema = z.object({
  columnId: entityIdSchema,
  operator: z.enum(['contains', 'equals', 'starts_with', 'is_blank', 'is_not_blank', 'greater_than', 'less_than', 'between', 'one_of']),
  value: z.string().optional(),
  secondValue: z.string().optional(),
  values: z.array(z.string()).optional(),
})

const tableWorkbookViewSchema = z.object({
  columnWidths: z.record(entityIdSchema, z.number().min(72).max(800)),
  hiddenColumnIds: z.array(entityIdSchema),
  frozenColumnIds: z.array(entityIdSchema),
  sorting: z.array(z.object({ columnId: entityIdSchema, descending: z.boolean() })),
  filters: z.array(workbookColumnFilterSchema),
})

export const validationIssueSchema = z.object({
  issueId: entityIdSchema,
  severity: z.enum(ISSUE_SEVERITIES),
  title: z.string(),
  message: z.string(),
  tableIds: z.array(entityIdSchema),
  columnIds: z.array(entityIdSchema),
  relationIds: z.array(entityIdSchema),
  rowIndices: z.array(z.number().int().nonnegative()).optional(),
  dataPath: z.array(z.string()).optional(),
  suggestedFix: z.string(),
})

export const schemaProjectSchema = z.object({
  projectId: entityIdSchema,
  name: z.string().min(1),
  schemaVersion: z.string().min(1),
  tables: z.array(tableSchema),
  enums: z.array(enumSchema),
  relations: z.array(relationSchema),
  functionalDependencies: z.array(functionalDependencySchema),
  exportViews: z.array(exportViewSchema),
  layout: layoutSchema,
  commandHistory: z.array(commandHistoryEntrySchema),
})

export const workbenchDocumentSchema = z.object({
  formatVersion: z.number().int().positive(),
  revision: z.number().int().nonnegative(),
  schema: schemaProjectSchema,
  rowsByTable: z.record(entityIdSchema, z.array(dataRowSchema)),
  workbookViews: z.record(entityIdSchema, tableWorkbookViewSchema).default({}),
  migrationState: migrationStateSchema,
  auditLog: z.array(auditEventSchema),
})

export function parseProject(value: unknown): SchemaProject {
  return schemaProjectSchema.parse(value) as SchemaProject
}

export function safeParseProject(value: unknown) {
  return schemaProjectSchema.safeParse(value)
}

export function parseWorkbenchDocument(value: unknown): WorkbenchDocument {
  if (isObject(value) && typeof value.formatVersion === 'number' && value.formatVersion > WORKBENCH_DOCUMENT_FORMAT_VERSION) {
    throw new Error(`이 프로젝트 파일은 더 새로운 형식(v${value.formatVersion})입니다. 최신 버전의 앱에서 열어 주세요.`)
  }
  const parsed = workbenchDocumentSchema.parse(value) as WorkbenchDocument
  return parsed.formatVersion === WORKBENCH_DOCUMENT_FORMAT_VERSION
    ? parsed
    : { ...parsed, formatVersion: WORKBENCH_DOCUMENT_FORMAT_VERSION }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function safeParseWorkbenchDocument(value: unknown) {
  return workbenchDocumentSchema.safeParse(value)
}
