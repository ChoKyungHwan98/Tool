import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../domain/emptyProject'
import type { RowsByTable, SchemaProject } from '../domain/schema'
import { compileAiToolCalls, type AiToolCall } from './aiTools'
import { evaluateExpression, generateRows, type RowGenerationSpec } from './rowGeneration'

function call(name: string, args: unknown, id: string): AiToolCall {
  return { id, name, argumentsJson: JSON.stringify(args) }
}

/** Category(PK CategoryId) 와 Item(ItemId, Name, CategoryId, Attack, Price) 를 갖춘 스키마 */
function buildSchema(): SchemaProject {
  const base = createEmptyProject('생성 테스트')
  const calls = [
    call('create_table', {
      name: 'Category',
      columns: [{ name: 'CategoryId', dataType: 'int32', primaryKey: true }],
    }, 'c1'),
    call('create_table', {
      name: 'Item',
      columns: [
        { name: 'ItemId', dataType: 'int32', primaryKey: true },
        { name: 'Name', dataType: 'string' },
        { name: 'Grade', dataType: 'string' },
        { name: 'CategoryId', dataType: 'int32' },
        { name: 'Attack', dataType: 'int32' },
        { name: 'Price', dataType: 'int32' },
      ],
    }, 'c2'),
  ]

  return compileAiToolCalls(base, calls).commands.reduce((schema, command) => command.execute(schema), base)
}

function tableId(schema: SchemaProject, name: string): string {
  return schema.tables.find((table) => table.name === name)!.tableId
}

function columnId(schema: SchemaProject, table: string, column: string): string {
  return schema.tables.find((candidate) => candidate.name === table)!
    .columns.find((candidate) => candidate.name === column)!.columnId
}

describe('evaluateExpression', () => {
  it('사칙연산과 우선순위, 괄호를 계산한다', () => {
    expect(evaluateExpression('50 + 2 * 10', {})).toBe(70)
    expect(evaluateExpression('(50 + 2) * 10', {})).toBe(520)
    expect(evaluateExpression('-5 + 10', {})).toBe(5)
  })

  it('스코프의 값과 내장 함수를 쓴다', () => {
    expect(evaluateExpression('50 + index * 0.5', { index: 10 })).toBe(55)
    expect(evaluateExpression('floor(7 / 2)', {})).toBe(3)
    expect(evaluateExpression('max(Attack, 100)', { Attack: 250 })).toBe(250)
  })

  it('코드 실행이나 알 수 없는 값은 거부한다', () => {
    expect(() => evaluateExpression('process.exit(1)', {})).toThrow()
    expect(() => evaluateExpression('알수없는값 + 1', {})).toThrow('알 수 없는 값')
    expect(() => evaluateExpression('1 / 0', {})).toThrow('0으로 나눌 수 없습니다')
  })
})

describe('generateRows', () => {
  it('연번과 수식으로 1000행을 정확하게 만든다', () => {
    const schema = buildSchema()
    const spec: RowGenerationSpec = {
      tableName: 'Item',
      count: 1000,
      fields: [
        { kind: 'sequence', column: 'ItemId', start: 10001 },
        { kind: 'formula', column: 'Attack', expression: '50 + index * 0.5' },
        { kind: 'formula', column: 'Price', expression: 'Attack * 12' },
      ],
    }

    const result = generateRows({ schema, rowsByTable: {}, spec })

    expect(result.issues).toEqual([])
    expect(result.rows).toHaveLength(1000)

    const itemIdColumn = columnId(schema, 'Item', 'ItemId')
    const attackColumn = columnId(schema, 'Item', 'Attack')
    const priceColumn = columnId(schema, 'Item', 'Price')

    expect(result.rows[0]!.cells[itemIdColumn]).toBe(10001)
    expect(result.rows[999]!.cells[itemIdColumn]).toBe(11000)
    // int32 컬럼이므로 반올림된다: 50 + 999*0.5 = 549.5 -> 550
    expect(result.rows[999]!.cells[attackColumn]).toBe(550)
    // 앞 컬럼 값을 뒤 수식이 쓴다 (반올림 전 549.5 * 12 = 6594)
    expect(result.rows[999]!.cells[priceColumn]).toBe(6594)
  })

  it('같은 시드면 미리보기와 실제 생성 결과가 완전히 같다', () => {
    const schema = buildSchema()
    const spec: RowGenerationSpec = {
      tableName: 'Item',
      count: 50,
      seed: 42,
      fields: [
        { kind: 'sequence', column: 'ItemId', start: 1 },
        { kind: 'weighted', column: 'Name', values: ['일반', '고급', '희귀'], weights: [50, 30, 20] },
      ],
    }

    const preview = generateRows({ schema, rowsByTable: {}, spec })
    const applied = generateRows({ schema, rowsByTable: {}, spec })
    const nameColumn = columnId(schema, 'Item', 'Name')

    expect(preview.rows.map((row) => row.cells[nameColumn]))
      .toEqual(applied.rows.map((row) => row.cells[nameColumn]))
  })

  it('reference 모드는 실제 존재하는 ID만 넣어 참조 무결성을 지킨다', () => {
    const schema = buildSchema()
    const categoryTableId = tableId(schema, 'Category')
    const categoryIdColumn = columnId(schema, 'Category', 'CategoryId')
    const rowsByTable: RowsByTable = {
      [categoryTableId]: [
        { rowId: 'r1', cells: { [categoryIdColumn]: 7 } },
        { rowId: 'r2', cells: { [categoryIdColumn]: 9 } },
      ],
    }

    const result = generateRows({
      schema,
      rowsByTable,
      spec: {
        tableName: 'Item',
        count: 100,
        seed: 3,
        fields: [
          { kind: 'sequence', column: 'ItemId', start: 1 },
          { kind: 'reference', column: 'CategoryId', targetTable: 'Category' },
        ],
      },
    })

    const itemCategoryColumn = columnId(schema, 'Item', 'CategoryId')
    const used = new Set(result.rows.map((row) => row.cells[itemCategoryColumn]))

    expect(result.issues).toEqual([])
    expect(used.size).toBeGreaterThan(0)
    for (const value of used) {
      expect([7, 9]).toContain(value)
    }
  })

  it('참조할 행이 없으면 지어내지 않고 비워 두고 알린다', () => {
    const schema = buildSchema()
    const result = generateRows({
      schema,
      rowsByTable: {},
      spec: {
        tableName: 'Item',
        count: 5,
        fields: [
          { kind: 'sequence', column: 'ItemId', start: 1 },
          { kind: 'reference', column: 'CategoryId', targetTable: 'Category' },
        ],
      },
    })

    const itemCategoryColumn = columnId(schema, 'Item', 'CategoryId')
    expect(result.rows).toHaveLength(5)
    expect(result.rows.every((row) => row.cells[itemCategoryColumn] === undefined)).toBe(true)
    expect(result.issues.some((issue) => issue.includes('참조할 행이 없어'))).toBe(true)
  })

  it('템플릿으로 이름을 만들고 없는 컬럼은 건너뛴다', () => {
    const schema = buildSchema()
    const result = generateRows({
      schema,
      rowsByTable: {},
      spec: {
        tableName: 'Item',
        count: 3,
        fields: [
          { kind: 'sequence', column: 'ItemId', start: 10001 },
          { kind: 'template', column: 'Name', pattern: '아이템 {ItemId}호' },
          { kind: 'constant', column: '없는컬럼', value: 1 },
        ],
      },
    })

    const nameColumn = columnId(schema, 'Item', 'Name')
    expect(result.rows[0]!.cells[nameColumn]).toBe('아이템 10001호')
    expect(result.rows[2]!.cells[nameColumn]).toBe('아이템 10003호')
    expect(result.issues.some((issue) => issue.includes('없는컬럼'))).toBe(true)
  })

  it('실제 무료 모델이 보낸 rule 문자열 형식을 그대로 처리한다', () => {
    // openai/gpt-oss-20b:free 가 실제로 보낸 인자 모양. column 대신 name, 규칙은 rule 문자열 하나.
    const schema = buildSchema()
    const plan = compileAiToolCalls(schema, [
      call('insert_rows', {
        tableName: 'Item',
        count: 1000,
        fields: [
          { dataType: 'int32', name: 'ItemId', rule: 'sequence(start=10001)' },
          { dataType: 'string', name: 'Name', rule: "concat('Item', ItemId)" },
          { dataType: 'string', name: 'Grade', rule: "'A'" },
          { dataType: 'int32', name: 'Attack', rule: '50 + index * 0.5' },
          { dataType: 'int32', name: 'Price', rule: 'Attack * 12' },
        ],
      }, 'r1'),
    ])

    expect(plan.issues).toEqual([])
    expect(plan.insertedRowCount).toBe(1000)

    const rows = plan.rowPlans[0]!.rows
    const itemIdColumn = columnId(schema, 'Item', 'ItemId')
    const nameColumn = columnId(schema, 'Item', 'Name')
    const gradeColumn = columnId(schema, 'Item', 'Grade')
    const priceColumn = columnId(schema, 'Item', 'Price')

    expect(rows[0]!.cells[itemIdColumn]).toBe(10001)
    expect(rows[0]!.cells[nameColumn]).toBe('Item10001')
    expect(rows[0]!.cells[gradeColumn]).toBe('A')
    expect(rows[0]!.cells[priceColumn]).toBe(600)
    expect(rows[999]!.cells[itemIdColumn]).toBe(11000)
  })

  it('weighted와 reference도 rule 문자열로 받는다', () => {
    const schema = buildSchema()
    const categoryTableId = tableId(schema, 'Category')
    const categoryIdColumn = columnId(schema, 'Category', 'CategoryId')

    const plan = compileAiToolCalls(schema, [
      call('insert_rows', {
        tableName: 'Item',
        count: 30,
        fields: [
          { column: 'ItemId', rule: 'sequence(start=1)' },
          { column: 'Name', rule: 'weighted(일반=50, 고급=30, 희귀=20)' },
          { column: 'CategoryId', rule: 'reference(Category)' },
        ],
      }, 'r1'),
    ], {
      [categoryTableId]: [
        { rowId: 'r1', cells: { [categoryIdColumn]: 7 } },
        { rowId: 'r2', cells: { [categoryIdColumn]: 9 } },
      ],
    })

    expect(plan.issues).toEqual([])

    const rows = plan.rowPlans[0]!.rows
    const nameColumn = columnId(schema, 'Item', 'Name')
    const itemCategoryColumn = columnId(schema, 'Item', 'CategoryId')

    for (const row of rows) {
      expect(['일반', '고급', '희귀']).toContain(row.cells[nameColumn])
      expect([7, 9]).toContain(row.cells[itemCategoryColumn])
    }
  })

  it('없는 테이블이면 행을 만들지 않는다', () => {
    const schema = buildSchema()
    const result = generateRows({
      schema,
      rowsByTable: {},
      spec: { tableName: 'Nope', count: 10, fields: [] },
    })

    expect(result.rows).toEqual([])
    expect(result.issues[0]).toContain('찾을 수 없습니다')
  })
})
