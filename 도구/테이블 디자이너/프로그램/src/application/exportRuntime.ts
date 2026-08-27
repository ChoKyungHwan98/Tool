import { findColumn, findTable } from '../domain/projectQueries'
import type { DataRow, EntityId, ExportColumn, ExportView, Relation, RowsByTable, SchemaColumn, SchemaProject, SchemaTable } from '../domain/schema'

export interface RuntimeExportResult {
  readonly viewId: EntityId
  readonly fileName: string
  readonly headers: readonly string[]
  readonly rows: readonly Record<string, string | number | boolean | null>[]
  readonly lineage: readonly RuntimeColumnLineage[]
}

export interface RuntimeColumnLineage {
  readonly header: string
  readonly tableId: EntityId
  readonly tableName: string
  readonly columnId: EntityId
  readonly columnName: string
  readonly relationPath: readonly EntityId[]
}

type RowValue = string | number | boolean | null

export function exportRuntimeView(project: SchemaProject, view: ExportView, rowsByTable: RowsByTable): RuntimeExportResult {
  const rootRows = rowsByTable[view.rootTableId] ?? []

  const rows = rootRows.map((sourceRow) =>
    Object.fromEntries(
      view.columns.map((exportColumn) => {
        const table = findTable(project, exportColumn.sourceTableId)
        const column = table ? findColumn(table, exportColumn.sourceColumnId) : undefined
        const resolved = table && column ? resolveExportValue(project, view, rowsByTable, sourceRow, table, column, exportColumn) : null

        return [exportColumn.header, normalizeRuntimeValue(resolved)]
      }),
    ) as Record<string, RowValue>,
  )

  return {
    viewId: view.viewId,
    fileName: `${view.name}.${view.format}`,
    headers: view.columns.map((column) => column.header),
    rows,
    lineage: view.columns.map((exportColumn) => {
      const table = findTable(project, exportColumn.sourceTableId)
      const column = table ? findColumn(table, exportColumn.sourceColumnId) : undefined

      return {
        header: exportColumn.header,
        tableId: exportColumn.sourceTableId,
        tableName: table?.name ?? 'MissingTable',
        columnId: exportColumn.sourceColumnId,
        columnName: column?.name ?? 'MissingColumn',
        relationPath: table ? relationPath(project, view.rootTableId, table.tableId).map((relation) => relation.relationId) : [],
      }
    }),
  }
}

export function toJson(result: RuntimeExportResult): string {
  return JSON.stringify(result.rows, null, 2)
}

export function toCsv(result: RuntimeExportResult): string {
  const escape = (value: RowValue) => {
    if (value === null) {
      return ''
    }

    const text = String(value)
    const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text

    return /[",\n\r]/.test(safeText) ? `"${safeText.replaceAll('"', '""')}"` : safeText
  }

  return [
    result.headers.join(','),
    ...result.rows.map((row) => result.headers.map((header) => escape(row[header])).join(',')),
  ].join('\n')
}

function resolveExportValue(
  project: SchemaProject,
  view: ExportView,
  rowsByTable: RowsByTable,
  rootRow: DataRow,
  table: SchemaTable,
  column: SchemaColumn,
  exportColumn: ExportColumn,
): unknown {
  const sourceRow = resolveSourceRow(project, view.rootTableId, rootRow, table.tableId, rowsByTable)
  const value = sourceRow?.cells[column.columnId] ?? null

  if (exportColumn.transform === 'default_if_null') {
    return value ?? ''
  }

  if (exportColumn.transform === 'join_list') {
    return Array.isArray(value) ? value.join('|') : value
  }

  const dataType = column.dataType

  if (exportColumn.transform === 'enum_name' && dataType.kind === 'enum' && typeof value === 'string') {
    const schemaEnum = project.enums.find((candidate) => candidate.enumId === dataType.enumId)
    return schemaEnum?.values.find((enumValue) => enumValue.name === value)?.displayName ?? value
  }

  return value
}

function resolveSourceRow(
  project: SchemaProject,
  rootTableId: EntityId,
  rootRow: DataRow,
  targetTableId: EntityId,
  rowsByTable: RowsByTable,
): DataRow | null {
  if (rootTableId === targetTableId) {
    return rootRow
  }

  const path = relationPath(project, rootTableId, targetTableId)

  if (path.length === 0) {
    return null
  }

  let currentTable = findTable(project, rootTableId)
  let currentRow: DataRow | null = rootRow

  for (const relation of path) {
    if (!currentTable || !currentRow) {
      return null
    }

    const targetTable = findTable(project, relation.targetTableId)

    if (!targetTable) {
      return null
    }

    const sourceColumns = relation.sourceColumnIds.map((columnId) => findColumn(currentTable as SchemaTable, columnId))
    const targetColumns = relation.targetColumnIds.map((columnId) => findColumn(targetTable, columnId))

    if (!sourceColumns.every(Boolean) || !targetColumns.every(Boolean)) {
      return null
    }

    const sourceKey = sourceColumns.map((column) => stableValueKey(column ? currentRow?.cells[column.columnId] : undefined)).join('\u001f')
    currentRow = (rowsByTable[targetTable.tableId] ?? []).find((candidate) => {
      const targetKey = targetColumns.map((column) => stableValueKey(column ? candidate.cells[column.columnId] : undefined)).join('\u001f')
      return sourceKey === targetKey
    }) ?? null
    currentTable = targetTable
  }

  return currentRow
}

function relationPath(project: SchemaProject, sourceTableId: EntityId, targetTableId: EntityId): readonly Relation[] {
  if (sourceTableId === targetTableId) {
    return []
  }

  const queue: { readonly tableId: EntityId; readonly path: readonly Relation[] }[] = [{ tableId: sourceTableId, path: [] }]
  const visited = new Set<EntityId>([sourceTableId])
  const hardOrSoftRelations = project.relations.filter((relation) => relation.kind === 'hard_fk' || relation.kind === 'soft_ref')
  let index = 0

  while (index < queue.length) {
    const item = queue[index]
    index += 1

    for (const relation of hardOrSoftRelations.filter((candidate) => candidate.sourceTableId === item.tableId)) {
      if (visited.has(relation.targetTableId)) {
        continue
      }

      const nextPath = [...item.path, relation]

      if (relation.targetTableId === targetTableId) {
        return nextPath
      }

      visited.add(relation.targetTableId)
      queue.push({ tableId: relation.targetTableId, path: nextPath })
    }
  }

  return []
}

function stableValueKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : JSON.stringify(value)
}

function normalizeRuntimeValue(value: unknown): RowValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value
  }

  return value === undefined ? null : String(value)
}
