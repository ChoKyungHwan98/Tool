import { beforeEach, describe, expect, it } from 'vitest'
import { compileAiToolCalls, type AiToolCall } from '../../application/aiTools'
import { useWorkbenchStore } from './workbenchStore'

function call(name: string, args: unknown, id: string): AiToolCall {
  return { id, name, argumentsJson: JSON.stringify(args) }
}

const DESIGN_CALLS: readonly AiToolCall[] = [
  call('create_table', {
    name: 'Category',
    columns: [{ name: 'CategoryId', dataType: 'int32', primaryKey: true }],
  }, 'c1'),
  call('create_table', {
    name: 'Item',
    columns: [
      { name: 'ItemId', dataType: 'int32', primaryKey: true },
      { name: 'CategoryId', dataType: 'int32' },
    ],
  }, 'c2'),
  call('add_relation', {
    sourceTableName: 'Item',
    sourceColumnName: 'CategoryId',
    targetTableName: 'Category',
    targetColumnName: 'CategoryId',
  }, 'c3'),
]

function stageDesignBatch() {
  const plan = compileAiToolCalls(useWorkbenchStore.getState().document.schema, DESIGN_CALLS)
  useWorkbenchStore.getState().stageAiToolBatch(plan)
  return plan
}

describe('AI 스키마 제안 배치', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkbenchStore.setState({
      appView: 'dashboard',
      projects: [],
      currentProjectId: null,
      aiMessages: [],
      aiPendingBatch: null,
    })
    useWorkbenchStore.getState().openNewProject('AI 배치 테스트')
  })

  it('승인 전에는 문서를 건드리지 않는다', () => {
    const before = useWorkbenchStore.getState().document.schema.tables.length

    const plan = stageDesignBatch()
    expect(plan.issues).toEqual([])

    const state = useWorkbenchStore.getState()
    expect(state.aiPendingBatch).not.toBeNull()
    expect(state.aiPendingBatch!.commands).toHaveLength(3)
    expect(state.document.schema.tables).toHaveLength(before)
    expect(state.document.schema.relations).toHaveLength(0)
  })

  it('승인하면 적용되고 Undo 한 번에 전부 되돌아간다', () => {
    const before = useWorkbenchStore.getState().document.schema.tables.length
    stageDesignBatch()

    useWorkbenchStore.getState().applyAiPendingBatch()

    const applied = useWorkbenchStore.getState()
    expect(applied.aiPendingBatch).toBeNull()
    expect(applied.document.schema.tables).toHaveLength(before + 2)
    expect(applied.document.schema.relations).toHaveLength(1)
    expect(applied.mainView).toBe('schema')

    useWorkbenchStore.getState().undo()

    const undone = useWorkbenchStore.getState()
    expect(undone.document.schema.tables).toHaveLength(before)
    expect(undone.document.schema.relations).toHaveLength(0)
  })

  it('버리면 아무것도 적용되지 않는다', () => {
    const before = useWorkbenchStore.getState().document.schema.tables.length
    stageDesignBatch()

    useWorkbenchStore.getState().discardAiPendingBatch()

    const state = useWorkbenchStore.getState()
    expect(state.aiPendingBatch).toBeNull()
    expect(state.document.schema.tables).toHaveLength(before)
  })

  it('대화를 지우면 대기 중인 배치도 함께 사라진다', () => {
    stageDesignBatch()
    useWorkbenchStore.getState().clearAiThread()

    expect(useWorkbenchStore.getState().aiPendingBatch).toBeNull()
  })

  it('표 생성과 1000행 채우기를 한 번에 제안하고, Undo 한 번에 전부 되돌린다', () => {
    const calls: readonly AiToolCall[] = [
      call('create_table', {
        name: 'Item',
        columns: [
          { name: 'ItemId', dataType: 'int32', primaryKey: true },
          { name: 'Name', dataType: 'string' },
          { name: 'Attack', dataType: 'int32' },
        ],
      }, 'c1'),
      call('insert_rows', {
        tableName: 'Item',
        count: 1000,
        fields: [
          { column: 'ItemId', kind: 'sequence', start: 10001 },
          { column: 'Name', kind: 'template', pattern: '아이템 {ItemId}호' },
          { column: 'Attack', kind: 'formula', expression: '50 + index * 0.5' },
        ],
      }, 'c2'),
    ]

    const plan = compileAiToolCalls(useWorkbenchStore.getState().document.schema, calls)
    expect(plan.issues).toEqual([])
    expect(plan.insertedRowCount).toBe(1000)
    expect(plan.rowPlans[0]!.previewRows).toHaveLength(20)

    useWorkbenchStore.getState().stageAiToolBatch(plan)

    // 승인 전에는 행이 하나도 들어가지 않는다.
    const staged = useWorkbenchStore.getState()
    expect(staged.aiPendingBatch!.summary).toContain('행 1,000개 생성')
    expect(Object.values(staged.document.rowsByTable).flat()).toHaveLength(0)

    useWorkbenchStore.getState().applyAiPendingBatch()

    const applied = useWorkbenchStore.getState()
    const itemTable = applied.document.schema.tables.find((table) => table.name === 'Item')!
    const rows = applied.document.rowsByTable[itemTable.tableId] ?? []
    const itemIdColumn = itemTable.columns.find((column) => column.name === 'ItemId')!.columnId

    expect(rows).toHaveLength(1000)
    expect(rows[0]!.cells[itemIdColumn]).toBe(10001)
    expect(rows[999]!.cells[itemIdColumn]).toBe(11000)

    useWorkbenchStore.getState().undo()

    const undone = useWorkbenchStore.getState()
    expect(undone.document.schema.tables.some((table) => table.name === 'Item')).toBe(false)
    expect(Object.values(undone.document.rowsByTable).flat()).toHaveLength(0)
  })

  it('미리보기에 보인 행이 실제로 적용된 행과 같다', () => {
    const calls: readonly AiToolCall[] = [
      call('create_table', {
        name: 'Loot',
        columns: [
          { name: 'LootId', dataType: 'int32', primaryKey: true },
          { name: 'Grade', dataType: 'string' },
        ],
      }, 'c1'),
      call('insert_rows', {
        tableName: 'Loot',
        count: 200,
        fields: [
          { column: 'LootId', kind: 'sequence', start: 1 },
          { column: 'Grade', kind: 'weighted', values: ['일반', '고급', '희귀'], weights: [50, 30, 20] },
        ],
      }, 'c2'),
    ]

    const plan = compileAiToolCalls(useWorkbenchStore.getState().document.schema, calls)
    const preview = plan.rowPlans[0]!.previewRows.map((row) => row[1])

    useWorkbenchStore.getState().stageAiToolBatch(plan)
    useWorkbenchStore.getState().applyAiPendingBatch()

    const state = useWorkbenchStore.getState()
    const lootTable = state.document.schema.tables.find((table) => table.name === 'Loot')!
    const gradeColumn = lootTable.columns.find((column) => column.name === 'Grade')!.columnId
    const appliedFirst20 = (state.document.rowsByTable[lootTable.tableId] ?? [])
      .slice(0, 20)
      .map((row) => String(row.cells[gradeColumn]))

    expect(appliedFirst20).toEqual(preview)
  })
})
