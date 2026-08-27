import { makeId } from './ids'
import type {
  CheckConstraint,
  ColumnDataType,
  EntityId,
  Relation,
  RelationKind,
  SchemaColumn,
  SchemaEnum,
  SchemaEnumValue,
  SchemaTable,
  UniqueConstraint,
  ValidationRule,
} from './schema'

export interface CreateColumnInput {
  readonly tableId: EntityId
  readonly name: string
  readonly dataType: ColumnDataType
  readonly nullable?: boolean
  readonly displayName?: string
  readonly description?: string
  readonly defaultValue?: unknown
  readonly validationRules?: readonly ValidationRule[]
  readonly semanticType?: string
  readonly deprecated?: boolean
  readonly columnId?: EntityId
}

export interface CreateTableInput {
  readonly name: string
  readonly columns?: readonly Omit<CreateColumnInput, 'tableId'>[]
  readonly primaryKeyColumnIds?: readonly EntityId[]
  readonly displayName?: string
  readonly description?: string
  readonly uniqueConstraints?: readonly UniqueConstraint[]
  readonly checkConstraints?: readonly CheckConstraint[]
  readonly tags?: readonly string[]
  readonly authoringOnly?: boolean
  readonly runtimeOnly?: boolean
  readonly tableId?: EntityId
}

export function createColumn(input: CreateColumnInput): SchemaColumn {
  return {
    columnId: input.columnId ?? makeId('column'),
    tableId: input.tableId,
    name: input.name,
    displayName: input.displayName ?? input.name,
    description: input.description ?? '',
    dataType: input.dataType,
    nullable: input.nullable ?? true,
    defaultValue: input.defaultValue,
    validationRules: input.validationRules ?? [],
    semanticType: input.semanticType,
    deprecated: input.deprecated ?? false,
  }
}

export function createTable(input: CreateTableInput): SchemaTable {
  const tableId = input.tableId ?? makeId('table')
  const columns = (input.columns ?? []).map((column) => createColumn({ ...column, tableId }))

  return {
    tableId,
    name: input.name,
    displayName: input.displayName ?? input.name,
    description: input.description ?? '',
    columns,
    primaryKey: { columnIds: input.primaryKeyColumnIds ?? [] },
    uniqueConstraints: input.uniqueConstraints ?? [],
    checkConstraints: input.checkConstraints ?? [],
    tags: input.tags ?? [],
    authoringOnly: input.authoringOnly ?? false,
    runtimeOnly: input.runtimeOnly ?? false,
  }
}

export function createUniqueConstraint(name: string, columnIds: readonly EntityId[], constraintId = makeId('unique')): UniqueConstraint {
  return {
    constraintId,
    name,
    columnIds,
  }
}

export function createCheckConstraint(
  name: string,
  expression: string,
  columnIds: readonly EntityId[],
  description = '',
  constraintId = makeId('check'),
): CheckConstraint {
  return {
    constraintId,
    name,
    expression,
    columnIds,
    description,
  }
}

export function createRelation(input: {
  readonly name: string
  readonly sourceTableId: EntityId
  readonly sourceColumnIds: readonly EntityId[]
  readonly targetTableId: EntityId
  readonly targetColumnIds: readonly EntityId[]
  readonly kind?: RelationKind
  readonly required?: boolean
  readonly relationId?: EntityId
}): Relation {
  return {
    relationId: input.relationId ?? makeId('relation'),
    name: input.name,
    kind: input.kind ?? 'hard_fk',
    sourceTableId: input.sourceTableId,
    sourceColumnIds: input.sourceColumnIds,
    targetTableId: input.targetTableId,
    targetColumnIds: input.targetColumnIds,
    required: input.required ?? true,
  }
}

export function createEnumValue(name: string, displayName = name, enumValueId = makeId('enum_value')): SchemaEnumValue {
  return {
    enumValueId,
    name,
    displayName,
  }
}

export function createEnum(name: string, values: readonly SchemaEnumValue[], enumId = makeId('enum')): SchemaEnum {
  return {
    enumId,
    name,
    values,
  }
}
