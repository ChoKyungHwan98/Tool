import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../domain/emptyProject'
import type { SchemaProject } from '../domain/schema'
import { compileAiToolCalls, describeAiBatch, type AiToolCall } from './aiTools'

function call(name: string, args: unknown, id = `call_${name}`): AiToolCall {
  return { id, name, argumentsJson: JSON.stringify(args) }
}

function applyPlan(project: SchemaProject, calls: readonly AiToolCall[]): SchemaProject {
  const plan = compileAiToolCalls(project, calls)
  return plan.commands.reduce((schema, command) => command.execute(schema), project)
}

describe('compileAiToolCalls', () => {
  it('create_table을 기본키까지 갖춘 테이블 Command로 만든다', () => {
    const project = createEmptyProject('내 게임')
    const plan = compileAiToolCalls(project, [
      call('create_table', {
        name: 'Item',
        description: '아이템 마스터',
        columns: [
          { name: 'ItemId', dataType: 'int32', primaryKey: true },
          { name: 'Name', dataType: 'string' },
        ],
      }),
    ])

    expect(plan.issues).toEqual([])
    expect(plan.createdTableCount).toBe(1)

    const next = applyPlan(project, [
      call('create_table', {
        name: 'Item',
        columns: [
          { name: 'ItemId', dataType: 'int32', primaryKey: true },
          { name: 'Name', dataType: 'string' },
        ],
      }),
    ])

    const table = next.tables.find((candidate) => candidate.name === 'Item')
    expect(table).toBeDefined()
    expect(table!.columns).toHaveLength(2)
    expect(table!.primaryKey.columnIds).toHaveLength(1)
    expect(table!.columns.find((column) => column.columnId === table!.primaryKey.columnIds[0])!.name).toBe('ItemId')
  })

  it('같은 배치에서 만든 테이블을 뒤따르는 add_relation이 참조할 수 있다', () => {
    const project = createEmptyProject('내 게임')
    const calls = [
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

    const plan = compileAiToolCalls(project, calls)
    expect(plan.issues).toEqual([])
    expect(plan.createdTableCount).toBe(2)
    expect(plan.addedRelationCount).toBe(1)

    const next = applyPlan(project, calls)
    expect(next.relations).toHaveLength(1)

    const relation = next.relations[0]!
    const sourceTable = next.tables.find((table) => table.tableId === relation.sourceTableId)!
    const targetTable = next.tables.find((table) => table.tableId === relation.targetTableId)!
    expect(sourceTable.name).toBe('Item')
    expect(targetTable.name).toBe('Category')
  })

  it('없는 테이블을 참조하면 배치를 깨지 않고 문제로 보고한다', () => {
    const project = createEmptyProject('내 게임')
    const plan = compileAiToolCalls(project, [
      call('add_relation', {
        sourceTableName: 'Missing',
        sourceColumnName: 'X',
        targetTableName: 'AlsoMissing',
        targetColumnName: 'Y',
      }),
    ])

    expect(plan.commands).toHaveLength(0)
    expect(plan.issues).toHaveLength(1)
    expect(plan.issues[0]).toContain('Missing')
  })

  it('중복 테이블 이름과 지원하지 않는 도구를 걸러낸다', () => {
    const project = createEmptyProject('내 게임')
    const withItem = applyPlan(project, [
      call('create_table', { name: 'Item', columns: [{ name: 'ItemId', dataType: 'int32', primaryKey: true }] }),
    ])

    const plan = compileAiToolCalls(withItem, [
      call('create_table', { name: 'Item', columns: [{ name: 'ItemId', dataType: 'int32' }] }),
      call('drop_database', {}),
    ])

    expect(plan.commands).toHaveLength(0)
    expect(plan.issues).toHaveLength(2)
    expect(plan.issues.some((issue) => issue.includes('이미 있어서'))).toBe(true)
    expect(plan.issues.some((issue) => issue.includes('지원하지 않는 도구'))).toBe(true)
  })

  it('깨진 JSON 인자를 안전하게 처리한다', () => {
    const project = createEmptyProject('내 게임')
    const plan = compileAiToolCalls(project, [
      { id: 'bad', name: 'create_table', argumentsJson: '{ this is not json' },
    ])

    expect(plan.commands).toHaveLength(0)
    expect(plan.issues[0]).toContain('해석하지 못했습니다')
  })
})

describe('describeAiBatch', () => {
  it('변경 요약을 사람이 읽을 수 있게 만든다', () => {
    const project = createEmptyProject('내 게임')
    const plan = compileAiToolCalls(project, [
      call('create_table', { name: 'Item', columns: [{ name: 'ItemId', dataType: 'int32', primaryKey: true }] }, 'c1'),
      call('add_column', { tableName: 'Item', name: 'Price', dataType: 'int32' }, 'c2'),
    ])

    expect(describeAiBatch(plan)).toBe('테이블 1개 생성 · 컬럼 1개 추가')
  })
})

describe('설계 원칙 반영', () => {
  it('PK 컬럼을 첫 열로 옮기고 한글 이름·설명·최소/최대값을 남긴다', () => {
    const project = createEmptyProject('내 게임')
    const next = applyPlan(project, [
      call('create_table', {
        name: 'monster',
        displayName: '몬스터',
        columns: [
          { name: 'hp', displayName: '체력', dataType: 'int32', min: 1, max: 99999 },
          { name: 'id', displayName: '몬스터 ID', dataType: 'int32', primaryKey: true },
        ],
      }),
    ])
    const table = next.tables.find((item) => item.name === 'monster')!
    expect(table.displayName).toBe('몬스터')
    expect(table.columns[0]?.name).toBe('id')
    expect(table.primaryKey.columnIds).toEqual([table.columns[0]?.columnId])
    const hp = table.columns.find((column) => column.name === 'hp')!
    expect(hp.displayName).toBe('체력')
    expect(hp.validationRules.map((rule) => [rule.kind, rule.value])).toEqual([['min', 1], ['max', 99999]])
  })
})
