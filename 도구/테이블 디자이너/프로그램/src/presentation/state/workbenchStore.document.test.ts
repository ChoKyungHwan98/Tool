import { beforeEach, describe, expect, it } from 'vitest'
import { sampleIds } from '../../domain/sampleProject'
import { requireTable } from '../../domain/projectQueries'
import { useWorkbenchStore } from './workbenchStore'

describe('document command history', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkbenchStore.getState().openSampleProject()
  })

  it('restores the exact document after row insert undo and redo', () => {
    const before = useWorkbenchStore.getState().document
    useWorkbenchStore.getState().addRow(sampleIds.rule)
    const after = useWorkbenchStore.getState().document

    expect(after.rowsByTable[sampleIds.rule]).toHaveLength((before.rowsByTable[sampleIds.rule]?.length ?? 0) + 1)
    expect(after.auditLog).toHaveLength(before.auditLog.length + 1)

    useWorkbenchStore.getState().undo()
    expect(useWorkbenchStore.getState().document).toEqual(before)

    useWorkbenchStore.getState().redo()
    expect(useWorkbenchStore.getState().document).toEqual(after)
  })

  it('adds and reorders a sparse column without copying existing row cells', () => {
    const before = useWorkbenchStore.getState().document
    const previousRows = before.rowsByTable[sampleIds.rule]
    const columnId = useWorkbenchStore.getState().addColumnToTable(sampleIds.rule, { stayInView: true })

    expect(columnId).toBeTruthy()
    expect(useWorkbenchStore.getState().mainView).toBe('schema')
    expect(useWorkbenchStore.getState().document.rowsByTable[sampleIds.rule]).toBe(previousRows)

    useWorkbenchStore.getState().moveColumn(sampleIds.rule, columnId!, 1)
    const reordered = useWorkbenchStore.getState().document
    expect(requireTable(reordered.schema, sampleIds.rule).columns[1]?.columnId).toBe(columnId)
    expect(reordered.rowsByTable[sampleIds.rule]).toBe(previousRows)

    useWorkbenchStore.getState().undo()
    expect(useWorkbenchStore.getState().document.rowsByTable[sampleIds.rule]).toBe(previousRows)
  })

  it('deletes an empty column immediately and restores it with exact undo', () => {
    const columnId = useWorkbenchStore.getState().addColumnToTable(sampleIds.rule, { stayInView: true })
    const beforeDelete = useWorkbenchStore.getState().document

    useWorkbenchStore.getState().deleteColumn(sampleIds.rule, columnId!)
    expect(requireTable(useWorkbenchStore.getState().document.schema, sampleIds.rule).columns.some((column) => column.columnId === columnId)).toBe(false)
    expect(useWorkbenchStore.getState().pendingCommand).toBeNull()

    useWorkbenchStore.getState().undo()
    expect(useWorkbenchStore.getState().document).toEqual(beforeDelete)
  })

  it('stages a populated column deletion and removes its cells only after approval', () => {
    const columnId = useWorkbenchStore.getState().addColumnToTable(sampleIds.rule, { stayInView: true })
    const row = useWorkbenchStore.getState().document.rowsByTable[sampleIds.rule]![0]!
    useWorkbenchStore.getState().updateCells(sampleIds.rule, [{ rowId: row.rowId, columnId: columnId!, value: 'temporary' }])
    const beforeDelete = useWorkbenchStore.getState().document

    useWorkbenchStore.getState().deleteColumn(sampleIds.rule, columnId!)
    expect(useWorkbenchStore.getState().pendingCommand?.type).toBe('DeleteColumn')
    expect(useWorkbenchStore.getState().document).toEqual(beforeDelete)

    useWorkbenchStore.getState().applyPendingCommand({ approveDestructive: true })
    const afterDelete = useWorkbenchStore.getState().document
    expect(requireTable(afterDelete.schema, sampleIds.rule).columns.some((column) => column.columnId === columnId)).toBe(false)
    expect(afterDelete.rowsByTable[sampleIds.rule]?.[0]?.cells[columnId!]).toBeUndefined()

    useWorkbenchStore.getState().undo()
    expect(useWorkbenchStore.getState().document).toEqual(beforeDelete)
  })

  it('stages a risky A1 paste and restores headers, rows, and cells with one undo', () => {
    const before = useWorkbenchStore.getState().document
    const firstColumnId = requireTable(before.schema, sampleIds.rule).columns[0]!.columnId

    useWorkbenchStore.getState().applyWorkbookRange(sampleIds.rule, 0, 0, [
      ['RuleKey'],
      ['workbook_rule_1'],
      ['workbook_rule_2'],
      ['workbook_rule_3'],
    ])
    expect(useWorkbenchStore.getState().pendingDocumentTransaction?.type).toBe('ApplyWorkbookRange')
    expect(useWorkbenchStore.getState().document).toEqual(before)

    useWorkbenchStore.getState().applyPendingCommand({ approveDestructive: true })
    const applied = useWorkbenchStore.getState().document
    expect(requireTable(applied.schema, sampleIds.rule).columns[0]).toMatchObject({ columnId: firstColumnId, name: 'RuleKey' })
    expect(applied.rowsByTable[sampleIds.rule]).toHaveLength(3)

    useWorkbenchStore.getState().undo()
    expect(useWorkbenchStore.getState().document).toEqual(before)
  })

  it('stages a risky replace-all operation and restores it with one undo', () => {
    const before = useWorkbenchStore.getState().document
    const firstColumnId = requireTable(before.schema, sampleIds.rule).columns[0]!.columnId

    useWorkbenchStore.getState().replaceWorkbookMatches(sampleIds.rule, 'RuleId', 'ReactionRuleId')
    expect(useWorkbenchStore.getState().pendingDocumentTransaction?.type).toBe('ReplaceWorkbookMatches')
    expect(useWorkbenchStore.getState().document).toEqual(before)

    useWorkbenchStore.getState().applyPendingCommand({ approveDestructive: true })
    const applied = useWorkbenchStore.getState().document
    expect(requireTable(applied.schema, sampleIds.rule).columns[0]).toMatchObject({
      columnId: firstColumnId,
      name: 'ReactionRuleId',
    })

    useWorkbenchStore.getState().undo()
    expect(useWorkbenchStore.getState().document).toEqual(before)
  })

  it('closes the review drawer after canceling or applying a reviewed change', () => {
    const columnId = useWorkbenchStore.getState().addColumnToTable(sampleIds.rule, { stayInView: true })!
    const row = useWorkbenchStore.getState().document.rowsByTable[sampleIds.rule]![0]!
    useWorkbenchStore.getState().updateCells(sampleIds.rule, [{ rowId: row.rowId, columnId, value: 'reviewed' }])

    useWorkbenchStore.getState().deleteColumn(sampleIds.rule, columnId)
    expect(useWorkbenchStore.getState().bottomPanel).toBe('changes')
    useWorkbenchStore.getState().clearPendingCommand()
    expect(useWorkbenchStore.getState().bottomPanel).toBe('closed')

    useWorkbenchStore.getState().deleteColumn(sampleIds.rule, columnId)
    useWorkbenchStore.getState().applyPendingCommand({ approveDestructive: true })
    expect(useWorkbenchStore.getState().bottomPanel).toBe('closed')
  })

  it('reviews table deletion, selects the next table, and restores the exact document', () => {
    const before = useWorkbenchStore.getState().document
    const deletedIndex = before.schema.tables.findIndex((table) => table.tableId === sampleIds.rule)
    const nextTableId = before.schema.tables[deletedIndex + 1]?.tableId ?? before.schema.tables[deletedIndex - 1]?.tableId

    useWorkbenchStore.getState().deleteTable(sampleIds.rule)
    expect(useWorkbenchStore.getState().pendingCommand?.type).toBe('DeleteTable')
    expect(useWorkbenchStore.getState().document).toEqual(before)

    useWorkbenchStore.getState().applyPendingCommand({ approveDestructive: true })
    const deleted = useWorkbenchStore.getState()
    expect(deleted.document.schema.tables.some((table) => table.tableId === sampleIds.rule)).toBe(false)
    expect(deleted.document.rowsByTable[sampleIds.rule]).toBeUndefined()
    expect(deleted.document.schema.relations.some((relation) => relation.sourceTableId === sampleIds.rule || relation.targetTableId === sampleIds.rule)).toBe(false)
    expect(deleted.selectedTableId).toBe(nextTableId)

    deleted.undo()
    expect(useWorkbenchStore.getState().document).toEqual(before)
  })

  it('returns to the empty structure view after deleting the last table', () => {
    useWorkbenchStore.getState().openNewProject('빈 프로젝트')
    useWorkbenchStore.getState().createTable()
    const before = useWorkbenchStore.getState().document
    const tableId = before.schema.tables[0]!.tableId

    useWorkbenchStore.getState().deleteTable(tableId)
    useWorkbenchStore.getState().applyPendingCommand({ approveDestructive: true })

    const deleted = useWorkbenchStore.getState()
    expect(deleted.document.schema.tables).toHaveLength(0)
    expect(deleted.selectedTableId).toBe('')
    expect(deleted.mainView).toBe('schema')
    deleted.undo()
    expect(useWorkbenchStore.getState().document).toEqual(before)
  })

  it('moveRows는 선택한 행을 대상 위치로 옮긴다', () => {
    while ((useWorkbenchStore.getState().document.rowsByTable[sampleIds.rule] ?? []).length < 3) {
      useWorkbenchStore.getState().addRow(sampleIds.rule)
    }
    const rows = useWorkbenchStore.getState().document.rowsByTable[sampleIds.rule]!
    const firstId = rows[0]!.rowId

    useWorkbenchStore.getState().moveRows(sampleIds.rule, [firstId], rows.length)
    const after = useWorkbenchStore.getState().document.rowsByTable[sampleIds.rule]!

    expect(after.at(-1)!.rowId).toBe(firstId)
    expect(after.length).toBe(rows.length)
  })

  it('stores workbook view preferences by stable table and column IDs', () => {
    useWorkbenchStore.getState().updateTableWorkbookView(sampleIds.rule, {
      columnWidths: { column_rule_id: 240 },
      frozenColumnIds: ['column_rule_id'],
      sorting: [{ columnId: 'column_priority_id', descending: true }],
    })

    const view = useWorkbenchStore.getState().document.workbookViews[sampleIds.rule]
    expect(view?.columnWidths.column_rule_id).toBe(240)
    expect(view?.frozenColumnIds).toEqual(['column_rule_id'])
    expect(view?.sorting).toEqual([{ columnId: 'column_priority_id', descending: true }])
  })
})
