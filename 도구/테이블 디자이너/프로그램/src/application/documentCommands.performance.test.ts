import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../domain/emptyProject'
import { AddColumnCommand } from '../domain/commands'
import { createColumn, createTable } from '../domain/schemaFactories'
import type { DataRow } from '../domain/schema'
import { createWorkbenchDocument, replaceDocumentSchema } from './workbenchDocument'
import { ApplyWorkbookRangeCommand, ReplaceRowsCommand, UpdateCellsCommand } from './documentCommands'

function largeDocument(rowCount: number) {
  const columnId = 'column_id'
  const table = createTable({
    tableId: 'table_large',
    name: 'LargeTable',
    columns: [{ columnId, name: 'Id', dataType: { kind: 'string' }, nullable: false }],
    primaryKeyColumnIds: [columnId],
  })
  const project = { ...createEmptyProject('Performance'), tables: [table], layout: { nodes: [] } }
  const rows: DataRow[] = Array.from({ length: rowCount }, (_, index) => ({ rowId: `row_${index}`, cells: { [columnId]: `id_${index}` } }))
  return { columnId, document: createWorkbenchDocument(project, { [table.tableId]: rows }), rows, tableId: table.tableId }
}

describe('large document command performance', () => {
  it('updates one cell in a 10,000-row table within the interactive budget', () => {
    const { columnId, document, tableId } = largeDocument(10_000)
    const startedAt = performance.now()
    const next = new UpdateCellsCommand(tableId, [{ rowId: 'row_9999', columnId, value: 'changed' }]).execute(document).document
    const elapsed = performance.now() - startedAt

    expect(next.rowsByTable[tableId]?.[9999]?.cells[columnId]).toBe('changed')
    expect(elapsed).toBeLessThan(100)
  })

  it('adds a sparse column to 10,000 rows without rebuilding row storage', () => {
    const { document, rows, tableId } = largeDocument(10_000)
    const column = createColumn({ tableId, name: 'NewColumn', dataType: { kind: 'string' }, nullable: true })
    const startedAt = performance.now()
    const schema = new AddColumnCommand({ tableId, column }).execute(document.schema)
    const next = replaceDocumentSchema(document, schema)
    const elapsed = performance.now() - startedAt

    expect(next.rowsByTable[tableId]).toBe(rows)
    expect(next.rowsByTable[tableId]?.[0]?.cells[column.columnId]).toBeUndefined()
    expect(elapsed).toBeLessThan(100)
  })

  it('pastes one workbook cell into 10,000 rows within the interactive budget', () => {
    const { columnId, document, tableId } = largeDocument(10_000)
    const startedAt = performance.now()
    const next = new ApplyWorkbookRangeCommand(tableId, 10_000, 0, [['changed']]).execute(document).document
    const elapsed = performance.now() - startedAt

    expect(next.rowsByTable[tableId]?.[9999]?.cells[columnId]).toBe('changed')
    expect(elapsed).toBeLessThan(100)
  })

  it('accepts a 100,000-row replacement as one bounded transaction', () => {
    const { document, rows, tableId } = largeDocument(100_000)
    const startedAt = performance.now()
    const next = new ReplaceRowsCommand(tableId, rows).execute(document).document
    const elapsed = performance.now() - startedAt

    expect(next.rowsByTable[tableId]).toHaveLength(100_000)
    expect(next.auditLog).toHaveLength(1)
    expect(elapsed).toBeLessThan(1_500)
  })
})
