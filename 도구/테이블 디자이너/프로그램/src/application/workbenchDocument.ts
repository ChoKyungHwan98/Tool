import { makeId } from '../domain/ids'
import { findTable } from '../domain/projectQueries'
import type {
  CellValue,
  DataRow,
  EntityId,
  RowsByTable,
  SchemaColumn,
  SchemaProject,
  WorkbenchDocument,
} from '../domain/schema'
import { WORKBENCH_DOCUMENT_FORMAT_VERSION } from '../domain/schema'

export interface LegacyRowMigrationIssue {
  readonly severity: 'blocking'
  readonly tableId: EntityId
  readonly rowIndex?: number
  readonly key?: string
  readonly title: string
  readonly message: string
  readonly candidateColumnIds: readonly EntityId[]
}

export interface LegacyRowMigrationResult {
  readonly ok: boolean
  readonly rowsByTable: RowsByTable
  readonly issues: readonly LegacyRowMigrationIssue[]
}

export function createWorkbenchDocument(
  schema: SchemaProject,
  rowsByTable: RowsByTable = {},
  options: {
    readonly revision?: number
    readonly auditLog?: WorkbenchDocument['auditLog']
    readonly workbookViews?: WorkbenchDocument['workbookViews']
  } = {},
): WorkbenchDocument {
  return {
    formatVersion: WORKBENCH_DOCUMENT_FORMAT_VERSION,
    revision: options.revision ?? 0,
    schema,
    rowsByTable,
    workbookViews: options.workbookViews ?? {},
    migrationState: {
      pending: [],
      unresolvedRows: [],
    },
    auditLog: options.auditLog ?? [],
  }
}

export function replaceDocumentSchema(document: WorkbenchDocument, schema: SchemaProject): WorkbenchDocument {
  const nextTableIds = new Set(schema.tables.map((table) => table.tableId))
  const removedTableIds = document.schema.tables
    .map((table) => table.tableId)
    .filter((tableId) => !nextTableIds.has(tableId))
  const removedColumnsByTable = new Map<EntityId, ReadonlySet<EntityId>>()

  for (const previousTable of document.schema.tables) {
    const nextTable = schema.tables.find((table) => table.tableId === previousTable.tableId)
    if (!nextTable) continue

    const nextColumnIds = new Set(nextTable.columns.map((column) => column.columnId))
    const removedColumnIds = previousTable.columns
      .map((column) => column.columnId)
      .filter((columnId) => !nextColumnIds.has(columnId))

    if (removedColumnIds.length > 0) {
      removedColumnsByTable.set(previousTable.tableId, new Set(removedColumnIds))
    }
  }

  let rowsByTable = document.rowsByTable
  let workbookViews = document.workbookViews
  if (removedTableIds.length > 0 || removedColumnsByTable.size > 0) {
    const nextRowsByTable: Record<EntityId, readonly DataRow[]> = { ...document.rowsByTable }

    for (const tableId of removedTableIds) {
      delete nextRowsByTable[tableId]
    }

    for (const [tableId, removedColumnIds] of removedColumnsByTable) {
      const rows = nextRowsByTable[tableId]
      if (!rows) continue

      nextRowsByTable[tableId] = rows.map((row) => {
        const removedCellIds = Object.keys(row.cells).filter((columnId) => removedColumnIds.has(columnId))
        if (removedCellIds.length === 0) return row

        const cells = { ...row.cells }
        for (const columnId of removedCellIds) delete cells[columnId]
        return { ...row, cells }
      })
    }

    rowsByTable = nextRowsByTable

    const nextWorkbookViews: Record<EntityId, WorkbenchDocument['workbookViews'][string]> = { ...document.workbookViews }
    for (const tableId of removedTableIds) delete nextWorkbookViews[tableId]
    for (const [tableId, removedColumnIds] of removedColumnsByTable) {
      const view = nextWorkbookViews[tableId]
      if (!view) continue
      const columnWidths = { ...view.columnWidths }
      for (const columnId of removedColumnIds) delete columnWidths[columnId]
      nextWorkbookViews[tableId] = {
        ...view,
        columnWidths,
        hiddenColumnIds: view.hiddenColumnIds.filter((columnId) => !removedColumnIds.has(columnId)),
        frozenColumnIds: view.frozenColumnIds.filter((columnId) => !removedColumnIds.has(columnId)),
        sorting: view.sorting.filter((sort) => !removedColumnIds.has(sort.columnId)),
        filters: view.filters.filter((filter) => !removedColumnIds.has(filter.columnId)),
      }
    }
    workbookViews = nextWorkbookViews
  }

  return {
    ...document,
    revision: document.revision + 1,
    schema,
    rowsByTable,
    workbookViews,
  }
}

export function migrateLegacyRowsByTable(
  schema: SchemaProject,
  legacyRowsByTable: Readonly<Record<EntityId, readonly Readonly<Record<string, unknown>>[]>>,
): LegacyRowMigrationResult {
  const issues: LegacyRowMigrationIssue[] = []
  const rowsByTable: Record<EntityId, readonly DataRow[]> = {}

  for (const [tableId, rows] of Object.entries(legacyRowsByTable)) {
    const table = findTable(schema, tableId)

    if (!table) {
      issues.push({
        severity: 'blocking',
        tableId,
        title: 'Unknown legacy table',
        message: `Legacy rows reference missing table ${tableId}.`,
        candidateColumnIds: [],
      })
      continue
    }

    const migratedRows: DataRow[] = []

    rows.forEach((legacyRow, rowIndex) => {
      const cells: Record<EntityId, CellValue> = {}

      for (const [key, value] of Object.entries(legacyRow)) {
        const candidates = matchingColumns(table.columns, key)

        if (candidates.length === 0) {
          issues.push({
            severity: 'blocking',
            tableId,
            rowIndex,
            key,
            title: 'Unknown legacy column',
            message: `Legacy row key ${key} does not match any current column in ${table.name}.`,
            candidateColumnIds: [],
          })
          continue
        }

        if (candidates.length > 1) {
          issues.push({
            severity: 'blocking',
            tableId,
            rowIndex,
            key,
            title: 'Ambiguous legacy column',
            message: `Legacy row key ${key} matches multiple columns in ${table.name}.`,
            candidateColumnIds: candidates.map((column) => column.columnId),
          })
          continue
        }

        const column = candidates[0]

        if (column) {
          cells[column.columnId] = toCellValue(value)
        }
      }

      migratedRows.push({
        rowId: `legacy_${tableId}_${rowIndex + 1}`,
        cells,
      })
    })

    rowsByTable[tableId] = migratedRows
  }

  return {
    ok: issues.length === 0,
    rowsByTable: issues.length === 0 ? rowsByTable : {},
    issues,
  }
}

export function createEmptyDataRow(): DataRow {
  return {
    rowId: makeId('row'),
    cells: {},
  }
}

function matchingColumns(columns: readonly SchemaColumn[], key: string): readonly SchemaColumn[] {
  const exactMatches = columns.filter((column) => column.name === key)

  if (exactMatches.length > 0) {
    return exactMatches
  }

  const caseInsensitiveMatches = columns.filter((column) => column.name.toLowerCase() === key.toLowerCase())

  return caseInsensitiveMatches.length > 1 ? caseInsensitiveMatches : []
}

function toCellValue(value: unknown): CellValue {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(toCellValue)
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toCellValue(item)]))
  }

  return String(value)
}
