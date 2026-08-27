import type { EntityId, SchemaColumn, SchemaProject, SchemaTable } from './schema'

export function findTable(project: SchemaProject, tableId: EntityId): SchemaTable | undefined {
  return project.tables.find((table) => table.tableId === tableId)
}

export function requireTable(project: SchemaProject, tableId: EntityId): SchemaTable {
  const table = findTable(project, tableId)

  if (!table) {
    throw new Error(`Table not found: ${tableId}`)
  }

  return table
}

export function findColumn(table: SchemaTable, columnId: EntityId): SchemaColumn | undefined {
  return table.columns.find((column) => column.columnId === columnId)
}

export function requireColumn(table: SchemaTable, columnId: EntityId): SchemaColumn {
  const column = findColumn(table, columnId)

  if (!column) {
    throw new Error(`Column not found: ${columnId}`)
  }

  return column
}

export function getColumnLabel(project: SchemaProject, tableId: EntityId, columnId: EntityId): string {
  const table = findTable(project, tableId)
  const column = table ? findColumn(table, columnId) : undefined

  return column ? `${table?.name}.${column.name}` : columnId
}

export function isColumnInPrimaryKey(table: SchemaTable, columnId: EntityId): boolean {
  return table.primaryKey.columnIds.includes(columnId)
}
