import { describe, expect, it } from 'vitest'
import { createWorkbenchDocument } from './workbenchDocument'
import {
  ApplyWorkbookRangeCommand,
  DeleteRowsCommand,
  InsertRowsCommand,
  MoveRowsCommand,
  ReplaceWorkbookMatchesCommand,
  UpdateCellsCommand,
} from './documentCommands'
import { crowdProject, crowdSampleRows, sampleIds } from '../domain/sampleProject'
import type { DataRow } from '../domain/schema'

describe('document transactions', () => {
  it('updates multiple cells in one revision and one audit event', () => {
    const document = createWorkbenchDocument(crowdProject, crowdSampleRows)
    const row = document.rowsByTable[sampleIds.rule]![0]!
    const ruleTable = crowdProject.tables.find((table) => table.tableId === sampleIds.rule)!
    const priorityId = ruleTable.columns.find((column) => column.name === 'Priority')!.columnId
    const delayMinId = ruleTable.columns.find((column) => column.name === 'DelayMin')!.columnId
    const next = new UpdateCellsCommand(sampleIds.rule, [
      { rowId: row.rowId, columnId: priorityId, value: 99 },
      { rowId: row.rowId, columnId: delayMinId, value: 1.5 },
    ]).execute(document).document

    expect(next.revision).toBe(1)
    expect(next.auditLog).toHaveLength(1)
    expect(next.rowsByTable[sampleIds.rule]?.[0]?.cells[priorityId]).toBe(99)
  })

  it('inserts and deletes rows without mutating the previous document', () => {
    const document = createWorkbenchDocument(crowdProject, crowdSampleRows)
    const priorityId = crowdProject.tables.find((table) => table.tableId === sampleIds.rule)!.columns.find((column) => column.name === 'Priority')!.columnId
    const row: DataRow = { rowId: 'row_added', cells: { [priorityId]: 3 } }
    const inserted = new InsertRowsCommand(sampleIds.rule, 1, [row]).execute(document).document
    const deleted = new DeleteRowsCommand(sampleIds.rule, ['row_added']).execute(inserted).document

    expect(document.rowsByTable[sampleIds.rule]).toHaveLength(2)
    expect(inserted.rowsByTable[sampleIds.rule]?.[1]?.rowId).toBe('row_added')
    expect(deleted.rowsByTable[sampleIds.rule]).toHaveLength(2)
  })

  it('fails atomically when any update points to a missing column', () => {
    const document = createWorkbenchDocument(crowdProject, crowdSampleRows)
    const row = document.rowsByTable[sampleIds.rule]![0]!
    const command = new UpdateCellsCommand(sampleIds.rule, [{ rowId: row.rowId, columnId: 'missing', value: 'x' }])

    expect(() => command.execute(document)).toThrow('존재하지 않습니다')
    expect(document.revision).toBe(0)
  })

  it('applies A1 headers, adds overflow rows, and preserves column IDs in one revision', () => {
    const document = createWorkbenchDocument(crowdProject, crowdSampleRows)
    const table = crowdProject.tables.find((candidate) => candidate.tableId === sampleIds.rule)!
    const firstColumnId = table.columns[0]!.columnId
    const command = new ApplyWorkbookRangeCommand(sampleIds.rule, 0, 0, [
      ['RuleKey', 'ProfileId'],
      ['pasted_rule_1', 'profile_home_default'],
      ['pasted_rule_2', 'profile_home_default'],
      ['pasted_rule_3', 'profile_home_default'],
    ], [], true, 'transaction_workbook_range')
    const next = command.execute(document).document

    expect(next.revision).toBe(1)
    expect(next.auditLog).toHaveLength(1)
    expect(next.schema.tables.find((candidate) => candidate.tableId === sampleIds.rule)?.columns[0]).toMatchObject({
      columnId: firstColumnId,
      name: 'RuleKey',
    })
    expect(next.rowsByTable[sampleIds.rule]).toHaveLength(3)
    expect(next.rowsByTable[sampleIds.rule]?.[2]?.cells[firstColumnId]).toBe('pasted_rule_3')
    expect(document.schema.tables.find((candidate) => candidate.tableId === sampleIds.rule)?.columns[0]?.name).toBe('RuleId')
    expect(document.rowsByTable[sampleIds.rule]).toHaveLength(2)
  })

  it('rejects wider or invalid workbook blocks before changing the document', () => {
    const document = createWorkbenchDocument(crowdProject, crowdSampleRows)
    const tooWide = new ApplyWorkbookRangeCommand(sampleIds.rule, 0, 9, [['A', 'B']])
    const duplicateHeaders = new ApplyWorkbookRangeCommand(sampleIds.rule, 0, 0, [['ProfileId', 'ProfileId']])

    expect(() => tooWide.execute(document)).toThrow('열을 자동 생성하지 않습니다')
    expect(() => duplicateHeaders.execute(document)).toThrow('중복')
    expect(document.revision).toBe(0)
  })

  it('serializes a risky header paste and requires explicit approval', () => {
    const document = createWorkbenchDocument(crowdProject, crowdSampleRows)
    const command = new ApplyWorkbookRangeCommand(sampleIds.rule, 0, 0, [['RuleKey']])
    const restored = ApplyWorkbookRangeCommand.fromSerialized(command.serialize())

    expect(restored.requiredConfirmations(document).length).toBeGreaterThan(0)
    expect(() => restored.execute(document)).toThrow('영향 검토')
    expect(ApplyWorkbookRangeCommand.fromSerialized(command.serialize(), true).execute(document).document.revision).toBe(1)
  })

  it('replaces matching data cells in one document revision', () => {
    const document = createWorkbenchDocument(crowdProject, crowdSampleRows)
    const table = crowdProject.tables.find((candidate) => candidate.tableId === sampleIds.rule)!
    const ruleId = table.columns.find((column) => column.name === 'RuleId')!.columnId
    const next = new ReplaceWorkbookMatchesCommand(sampleIds.rule, 'home', 'player').execute(document).document

    expect(next.revision).toBe(1)
    expect(next.auditLog).toHaveLength(1)
    expect(next.rowsByTable[sampleIds.rule]?.[0]?.cells[ruleId]).toBe('goal_player_high')
    expect(next.rowsByTable[sampleIds.rule]?.[1]?.cells[ruleId]).toBe('foul_against_player')
    expect(document.rowsByTable[sampleIds.rule]?.[0]?.cells[ruleId]).toBe('goal_home_high')
  })

  it('requires approval for a risky header replacement and preserves the column ID', () => {
    const document = createWorkbenchDocument(crowdProject, crowdSampleRows)
    const table = crowdProject.tables.find((candidate) => candidate.tableId === sampleIds.rule)!
    const ruleId = table.columns.find((column) => column.name === 'RuleId')!.columnId
    const command = new ReplaceWorkbookMatchesCommand(sampleIds.rule, 'RuleId', 'ReactionRuleId')

    expect(command.requiredConfirmations(document).length).toBeGreaterThan(0)
    expect(() => command.execute(document)).toThrow()

    const next = ReplaceWorkbookMatchesCommand.fromSerialized(command.serialize(), true).execute(document).document
    expect(next.schema.tables.find((candidate) => candidate.tableId === sampleIds.rule)?.columns[0]).toMatchObject({
      columnId: ruleId,
      name: 'ReactionRuleId',
    })
    expect(document.schema.tables.find((candidate) => candidate.tableId === sampleIds.rule)?.columns[0]?.name).toBe('RuleId')
  })
})

describe('MoveRowsCommand', () => {
  const table = crowdProject.tables.find((candidate) => candidate.tableId === sampleIds.rule)!
  const ruleIdColumnId = table.columns.find((column) => column.name === 'RuleId')!.columnId

  function docWithRows(rowIds: readonly string[]): ReturnType<typeof createWorkbenchDocument> {
    const rows: DataRow[] = rowIds.map((rowId) => ({ rowId, cells: { [ruleIdColumnId]: rowId } }))
    return createWorkbenchDocument(crowdProject, { [sampleIds.rule]: rows })
  }

  it('선택 행들을 targetIndex 앞으로 이동한다', () => {
    const document = docWithRows(['r0', 'r1', 'r2', 'r3'])
    const result = new MoveRowsCommand(sampleIds.rule, ['r2'], 0).execute(document)
    expect(result.document.rowsByTable[sampleIds.rule]?.map((row) => row.rowId)).toEqual(['r2', 'r0', 'r1', 'r3'])
  })

  it('여러 행을 원래 순서를 유지한 채 이동한다', () => {
    const document = docWithRows(['r0', 'r1', 'r2', 'r3'])
    const result = new MoveRowsCommand(sampleIds.rule, ['r0', 'r1'], 4).execute(document)
    expect(result.document.rowsByTable[sampleIds.rule]?.map((row) => row.rowId)).toEqual(['r2', 'r3', 'r0', 'r1'])
  })

  it('changedTableIds에 대상 테이블을 담는다', () => {
    const document = docWithRows(['r0', 'r1', 'r2', 'r3'])
    const result = new MoveRowsCommand(sampleIds.rule, ['r1'], 3).execute(document)
    expect(result.changedTableIds).toEqual([sampleIds.rule])
  })

  it('존재하지 않는 테이블이면 오류', () => {
    const document = docWithRows(['r0', 'r1', 'r2', 'r3'])
    expect(() => new MoveRowsCommand('nope', ['r1'], 0).execute(document)).toThrow()
  })

  it('존재하지 않는 rowId는 무시하고 실제 행만 이동한다', () => {
    const document = docWithRows(['r0', 'r1', 'r2', 'r3'])
    const result = new MoveRowsCommand(sampleIds.rule, ['r2', 'ghost'], 0).execute(document)
    expect(result.document.rowsByTable[sampleIds.rule]?.map((row) => row.rowId)).toEqual(['r2', 'r0', 'r1', 'r3'])
    expect(result.document.rowsByTable[sampleIds.rule]).toHaveLength(4)
  })

  it('targetIndex가 범위를 벗어나면 오류 없이 클램프한다', () => {
    const document = docWithRows(['r0', 'r1', 'r2', 'r3'])
    const movedToFront = new MoveRowsCommand(sampleIds.rule, ['r2'], -5).execute(document)
    expect(movedToFront.document.rowsByTable[sampleIds.rule]?.map((row) => row.rowId)).toEqual(['r2', 'r0', 'r1', 'r3'])

    const movedToEnd = new MoveRowsCommand(sampleIds.rule, ['r2'], 999).execute(document)
    expect(movedToEnd.document.rowsByTable[sampleIds.rule]?.map((row) => row.rowId)).toEqual(['r0', 'r1', 'r3', 'r2'])
  })

  it('테이블의 모든 행을 이동하면 순서를 유지한 채 그대로다', () => {
    const document = docWithRows(['r0', 'r1', 'r2', 'r3'])
    const result = new MoveRowsCommand(sampleIds.rule, ['r0', 'r1', 'r2', 'r3'], 2).execute(document)
    expect(result.document.rowsByTable[sampleIds.rule]?.map((row) => row.rowId)).toEqual(['r0', 'r1', 'r2', 'r3'])
    expect(result.document.rowsByTable[sampleIds.rule]).toHaveLength(4)
  })

  it('rowIds가 빈 배열이면 행 목록이 변경되지 않는다', () => {
    const document = docWithRows(['r0', 'r1', 'r2', 'r3'])
    const result = new MoveRowsCommand(sampleIds.rule, [], 0).execute(document)
    expect(result.document.rowsByTable[sampleIds.rule]?.map((row) => row.rowId)).toEqual(['r0', 'r1', 'r2', 'r3'])
    expect(result.document.rowsByTable[sampleIds.rule]).toHaveLength(4)
  })
})
