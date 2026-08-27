import {
  AddColumnCommand,
  AddForeignKeyCommand,
  CreateTableCommand,
  type SchemaCommand,
} from '../domain/commands'
import { makeId } from '../domain/ids'
import { createColumn, createRelation, createTable as createSchemaTable } from '../domain/schemaFactories'
import { generateRows, type RowFieldSpec, type RowGenerationSpec } from './rowGeneration'
import type { ColumnDataType, DataRow, DataTypeKind, RowsByTable, SchemaProject, SchemaTable } from '../domain/schema'

/** AI가 지정할 수 있는 스칼라 타입만 허용한다. enum/list는 추가 문맥이 필요해 제외. */
const ALLOWED_DATA_TYPES = ['string', 'int32', 'int64', 'float', 'double', 'boolean', 'date', 'datetime'] as const

type AllowedDataType = (typeof ALLOWED_DATA_TYPES)[number]

export interface AiToolCall {
  readonly id: string
  readonly name: string
  readonly argumentsJson: string
}

/** AI가 제안한 행 생성 결과. 미리보기와 실제 적용이 동일하도록 여기서 이미 행을 다 만들어 둔다. */
export interface GeneratedRowPlan {
  readonly tableName: string
  readonly rows: readonly DataRow[]
  readonly previewColumns: readonly string[]
  readonly previewRows: readonly (readonly string[])[]
  readonly totalCount: number
}

export interface AiBatchPlan {
  readonly commands: readonly SchemaCommand[]
  readonly rowPlans: readonly GeneratedRowPlan[]
  readonly steps: readonly string[]
  readonly issues: readonly string[]
  readonly createdTableCount: number
  readonly addedColumnCount: number
  readonly addedRelationCount: number
  readonly insertedRowCount: number
}

const PREVIEW_ROW_LIMIT = 20

export const AI_SCHEMA_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_table',
      description: '새 테이블을 만든다. 사용자가 승인해야 실제로 적용된다. 기본키로 쓸 컬럼은 primaryKey를 true로 표시한다.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '테이블 이름. 영문 파스칼케이스 권장 (예: ItemMaster)' },
          description: { type: 'string', description: '이 테이블이 무엇을 담는지 한국어 한 줄 설명' },
          columns: {
            type: 'array',
            description: '컬럼 목록. 최소 1개.',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                dataType: { type: 'string', enum: [...ALLOWED_DATA_TYPES] },
                nullable: { type: 'boolean' },
                primaryKey: { type: 'boolean' },
              },
              required: ['name', 'dataType'],
            },
          },
        },
        required: ['name', 'columns'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_column',
      description: '이미 있는 테이블에 컬럼을 추가한다.',
      parameters: {
        type: 'object',
        properties: {
          tableName: { type: 'string' },
          name: { type: 'string' },
          dataType: { type: 'string', enum: [...ALLOWED_DATA_TYPES] },
          nullable: { type: 'boolean' },
        },
        required: ['tableName', 'name', 'dataType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'insert_rows',
      description: [
        '테이블에 행을 대량 생성한다. 값을 직접 나열하지 말고 "규칙"만 지정하면 앱이 행을 만든다.',
        '수천 행도 규칙 몇 줄로 만들 수 있으니 절대 행을 하나씩 나열하지 마라.',
        '외래키 컬럼은 반드시 reference 모드를 써라. 그래야 실제 존재하는 ID만 들어간다.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          tableName: { type: 'string', description: '행을 넣을 테이블 이름' },
          count: { type: 'number', description: '만들 행 개수' },
          fields: {
            type: 'array',
            description: '컬럼별 생성 규칙. 앞에 나온 컬럼 값을 뒤 규칙에서 쓸 수 있다.',
            items: {
              type: 'object',
              properties: {
                column: { type: 'string', description: '컬럼 이름' },
                rule: {
                  type: 'string',
                  description: [
                    '이 컬럼을 채우는 규칙을 문자열 하나로 적는다. 사용 가능한 형식:',
                    'sequence(start=10001, step=1) = 연번 |',
                    '수식 그대로 (예: 50 + index * 0.5, Attack * 12) — index는 0부터, 앞 컬럼 이름 사용 가능 |',
                    "weighted(일반=50, 고급=30, 희귀=20) = 비율 무작위 |",
                    'cycle(A, B, C) = 순환 |',
                    "concat('아이템 ', ItemId) 또는 {Grade} 아이템 {ItemId} = 문자열 조합 |",
                    'reference(Category) = 그 테이블에 실제로 있는 기본키 값 중에서 선택 (외래키는 반드시 이걸 써라) |',
                    "'고정문자' 또는 숫자 = 고정값",
                  ].join(' '),
                },
              },
              required: ['column', 'rule'],
            },
          },
        },
        required: ['tableName', 'count', 'fields'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_relation',
      description: '두 테이블 사이에 외래키(FK) 관계를 만든다. source 컬럼이 target 컬럼을 참조한다.',
      parameters: {
        type: 'object',
        properties: {
          sourceTableName: { type: 'string' },
          sourceColumnName: { type: 'string' },
          targetTableName: { type: 'string' },
          targetColumnName: { type: 'string' },
        },
        required: ['sourceTableName', 'sourceColumnName', 'targetTableName', 'targetColumnName'],
      },
    },
  },
] as const

function findTableByName(project: SchemaProject, name: string): SchemaTable | undefined {
  const normalized = name.trim().toLocaleLowerCase()
  return project.tables.find((table) => table.name.toLocaleLowerCase() === normalized)
}

function toDataType(value: unknown): ColumnDataType | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim() as AllowedDataType
  return (ALLOWED_DATA_TYPES as readonly string[]).includes(normalized)
    ? { kind: normalized as DataTypeKind } as ColumnDataType
    : null
}

function parseArguments(call: AiToolCall): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(call.argumentsJson || '{}') as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

function buildCreateTable(schema: SchemaProject, args: Record<string, unknown>): {
  readonly command?: SchemaCommand
  readonly step?: string
  readonly issue?: string
} {
  const name = typeof args.name === 'string' ? args.name.trim() : ''
  if (!name) return { issue: 'create_table 호출에 테이블 이름이 없습니다.' }
  if (findTableByName(schema, name)) return { issue: `'${name}' 테이블이 이미 있어서 건너뛰었습니다.` }
  if (!Array.isArray(args.columns) || args.columns.length === 0) {
    return { issue: `'${name}' 테이블에 컬럼이 지정되지 않았습니다.` }
  }

  const tableId = makeId('table')
  const primaryKeyColumnIds: string[] = []
  const columns = args.columns.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const input = raw as Record<string, unknown>
    const columnName = typeof input.name === 'string' ? input.name.trim() : ''
    const dataType = toDataType(input.dataType)
    if (!columnName || !dataType) return []

    const columnId = makeId('column')
    if (input.primaryKey === true) primaryKeyColumnIds.push(columnId)

    return [{
      columnId,
      name: columnName,
      dataType,
      nullable: input.primaryKey === true ? false : input.nullable !== false,
    }]
  })

  if (columns.length === 0) return { issue: `'${name}' 테이블의 컬럼이 모두 유효하지 않습니다.` }

  // 기본키 표시가 없으면 첫 컬럼을 기본키로 삼는다.
  const resolvedPrimaryKeys = primaryKeyColumnIds.length > 0 ? primaryKeyColumnIds : [columns[0]!.columnId]
  const index = schema.tables.length

  const table = createSchemaTable({
    tableId,
    name,
    description: typeof args.description === 'string' ? args.description : undefined,
    columns,
    primaryKeyColumnIds: resolvedPrimaryKeys,
  })

  return {
    command: new CreateTableCommand({
      table,
      layout: {
        entityId: tableId,
        x: 80 + (index % 4) * 260,
        y: 80 + Math.floor(index / 4) * 220,
      },
    }),
    step: `테이블 '${name}' 생성 (컬럼 ${columns.length}개, PK ${resolvedPrimaryKeys.length}개)`,
  }
}

function buildAddColumn(schema: SchemaProject, args: Record<string, unknown>): {
  readonly command?: SchemaCommand
  readonly step?: string
  readonly issue?: string
} {
  const tableName = typeof args.tableName === 'string' ? args.tableName : ''
  const table = findTableByName(schema, tableName)
  if (!table) return { issue: `add_column: '${tableName}' 테이블을 찾을 수 없습니다.` }

  const name = typeof args.name === 'string' ? args.name.trim() : ''
  const dataType = toDataType(args.dataType)
  if (!name || !dataType) return { issue: `add_column: '${tableName}'의 컬럼 이름 또는 타입이 유효하지 않습니다.` }
  if (table.columns.some((column) => column.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    return { issue: `'${table.name}.${name}' 컬럼이 이미 있어서 건너뛰었습니다.` }
  }

  const column = createColumn({
    tableId: table.tableId,
    name,
    dataType,
    nullable: args.nullable !== false,
  })

  return {
    command: new AddColumnCommand({ tableId: table.tableId, column }),
    step: `'${table.name}'에 컬럼 '${name}' 추가`,
  }
}

function buildAddRelation(schema: SchemaProject, args: Record<string, unknown>): {
  readonly command?: SchemaCommand
  readonly step?: string
  readonly issue?: string
} {
  const sourceTable = findTableByName(schema, typeof args.sourceTableName === 'string' ? args.sourceTableName : '')
  const targetTable = findTableByName(schema, typeof args.targetTableName === 'string' ? args.targetTableName : '')
  if (!sourceTable) return { issue: `add_relation: 출발 테이블 '${String(args.sourceTableName)}'을 찾을 수 없습니다.` }
  if (!targetTable) return { issue: `add_relation: 대상 테이블 '${String(args.targetTableName)}'을 찾을 수 없습니다.` }

  const sourceColumn = sourceTable.columns.find(
    (column) => column.name.toLocaleLowerCase() === String(args.sourceColumnName ?? '').trim().toLocaleLowerCase(),
  )
  const targetColumn = targetTable.columns.find(
    (column) => column.name.toLocaleLowerCase() === String(args.targetColumnName ?? '').trim().toLocaleLowerCase(),
  )
  if (!sourceColumn) return { issue: `add_relation: '${sourceTable.name}.${String(args.sourceColumnName)}' 컬럼이 없습니다.` }
  if (!targetColumn) return { issue: `add_relation: '${targetTable.name}.${String(args.targetColumnName)}' 컬럼이 없습니다.` }

  const relationName = `${sourceTable.name}_${sourceColumn.name}_to_${targetTable.name}`
  if (schema.relations.some((relation) => relation.name === relationName)) {
    return { issue: `'${relationName}' 관계가 이미 있어서 건너뛰었습니다.` }
  }

  return {
    command: new AddForeignKeyCommand({
      relation: createRelation({
        name: relationName,
        sourceTableId: sourceTable.tableId,
        sourceColumnIds: [sourceColumn.columnId],
        targetTableId: targetTable.tableId,
        targetColumnIds: [targetColumn.columnId],
        kind: 'hard_fk',
      }),
    }),
    step: `관계 '${sourceTable.name}.${sourceColumn.name}' → '${targetTable.name}.${targetColumn.name}' 연결`,
  }
}

function splitArguments(body: string): readonly string[] {
  return body.split(',').map((part) => part.trim()).filter(Boolean)
}

function unquote(value: string): string | null {
  const trimmed = value.trim()
  const quoted = /^'(.*)'$/.exec(trimmed) ?? /^"(.*)"$/.exec(trimmed)
  return quoted ? quoted[1]! : null
}

/**
 * 모델은 종류(kind)와 옵션 필드를 나눠 채우는 대신 규칙을 문자열 하나로 적는 경향이 강하다.
 * 실제 관찰된 출력(`sequence(start=10001)`, `Attack * 12`, `concat('Item', ItemId)`)을 그대로 받아들인다.
 */
function parseRuleString(column: string, rawRule: string): RowFieldSpec | null {
  const rule = rawRule.trim()
  if (!rule) return null

  const callMatch = /^([A-Za-z_]+)\s*\((.*)\)$/s.exec(rule)

  if (callMatch) {
    const name = callMatch[1]!.toLowerCase()
    const body = callMatch[2]!

    if (name === 'sequence' || name === 'seq' || name === 'serial') {
      const startMatch = /start\s*=\s*(-?[\d.]+)/i.exec(body)
      const stepMatch = /step\s*=\s*(-?[\d.]+)/i.exec(body)
      const positional = splitArguments(body).filter((part) => !part.includes('='))

      return {
        kind: 'sequence',
        column,
        start: Number(startMatch?.[1] ?? positional[0] ?? 1),
        step: stepMatch ? Number(stepMatch[1]) : positional[1] ? Number(positional[1]) : undefined,
      }
    }

    if (name === 'weighted' || name === 'weight' || name === 'distribution') {
      const values: string[] = []
      const weights: number[] = []

      for (const part of splitArguments(body)) {
        const pair = /^(.*?)\s*[=:]\s*(-?[\d.]+)$/.exec(part)
        const label = pair ? pair[1]! : part
        values.push(unquote(label) ?? label.trim())
        weights.push(pair ? Number(pair[2]) : 1)
      }

      return values.length > 0 ? { kind: 'weighted', column, values, weights } : null
    }

    if (name === 'cycle' || name === 'oneof' || name === 'rotate') {
      const values = splitArguments(body).map((part) => unquote(part) ?? part)
      return values.length > 0 ? { kind: 'cycle', column, values } : null
    }

    if (name === 'reference' || name === 'ref' || name === 'fk') {
      const target = unquote(body) ?? body.trim()
      return target ? { kind: 'reference', column, targetTable: target } : null
    }

    if (name === 'concat' || name === 'join') {
      // concat('Item', ItemId) -> "Item{ItemId}" 템플릿으로 변환한다.
      const pattern = splitArguments(body)
        .map((part) => {
          const literal = unquote(part)
          return literal === null ? `{${part.trim()}}` : literal
        })
        .join('')

      return { kind: 'template', column, pattern }
    }
  }

  const literal = unquote(rule)
  if (literal !== null) return { kind: 'constant', column, value: literal }

  if (rule.includes('{') && rule.includes('}')) return { kind: 'template', column, pattern: rule }

  if (/^-?[\d.]+$/.test(rule)) return { kind: 'constant', column, value: Number(rule) }
  if (/^(true|false)$/i.test(rule)) return { kind: 'constant', column, value: rule.toLowerCase() === 'true' }

  // 나머지는 수식으로 본다. 계산이 안 되면 생성 단계에서 문제로 보고된다.
  return { kind: 'formula', column, expression: rule }
}

function toRowFieldSpec(raw: unknown): RowFieldSpec | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, unknown>
  // 모델이 create_table의 모양을 흉내 내 column 대신 name을 쓰는 경우가 잦다.
  const column = typeof input.column === 'string' && input.column.trim()
    ? input.column.trim()
    : typeof input.name === 'string' ? input.name.trim() : ''
  if (!column) return null

  const ruleText = typeof input.rule === 'string' ? input.rule
    : typeof input.expression === 'string' && typeof input.kind !== 'string' ? input.expression
      : undefined

  if (typeof input.kind !== 'string' && ruleText) {
    return parseRuleString(column, ruleText)
  }

  const values = Array.isArray(input.values)
    ? input.values.filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    : []
  const weights = Array.isArray(input.weights)
    ? input.weights.filter((value): value is number => typeof value === 'number')
    : undefined

  switch (input.kind) {
    case 'constant':
      return typeof input.value === 'string' || typeof input.value === 'number' || typeof input.value === 'boolean'
        ? { kind: 'constant', column, value: input.value }
        : null
    case 'sequence':
      return {
        kind: 'sequence',
        column,
        start: typeof input.start === 'number' ? input.start : 1,
        step: typeof input.step === 'number' ? input.step : undefined,
      }
    case 'formula':
      return typeof input.expression === 'string' && input.expression.trim()
        ? { kind: 'formula', column, expression: input.expression }
        : null
    case 'weighted':
      return values.length > 0
        ? { kind: 'weighted', column, values: values.map(String), weights }
        : null
    case 'cycle':
      return values.length > 0 ? { kind: 'cycle', column, values } : null
    case 'template':
      return typeof input.pattern === 'string' ? { kind: 'template', column, pattern: input.pattern } : null
    case 'reference':
      return typeof input.targetTable === 'string' && input.targetTable.trim()
        ? { kind: 'reference', column, targetTable: input.targetTable }
        : null
    default:
      break
  }

  // kind가 있어도 옵션 필드가 비어 있으면 rule 문자열에서 다시 시도한다.
  return ruleText ? parseRuleString(column, ruleText) : null
}

function buildInsertRows(schema: SchemaProject, rowsByTable: RowsByTable, args: Record<string, unknown>): {
  readonly plan?: GeneratedRowPlan
  readonly step?: string
  readonly issues: readonly string[]
} {
  const tableName = typeof args.tableName === 'string' ? args.tableName.trim() : ''
  const table = findTableByName(schema, tableName)
  if (!table) return { issues: [`insert_rows: '${tableName}' 테이블을 찾을 수 없습니다.`] }

  const count = typeof args.count === 'number' ? args.count : Number(args.count)
  if (!Number.isFinite(count) || count <= 0) {
    return { issues: [`insert_rows: '${table.name}'에 만들 행 개수가 올바르지 않습니다.`] }
  }

  const rawFields = Array.isArray(args.fields) ? args.fields : []
  const fields = rawFields.flatMap((raw) => {
    const field = toRowFieldSpec(raw)
    return field ? [field] : []
  })

  if (fields.length === 0) {
    return { issues: [`insert_rows: '${table.name}'에 유효한 생성 규칙이 없습니다.`] }
  }

  const spec: RowGenerationSpec = {
    tableName: table.name,
    count,
    // 시드를 고정해 미리보기와 실제 적용 결과가 반드시 같게 만든다.
    seed: Math.floor(Math.abs(Math.sin(count * fields.length + table.name.length)) * 2 ** 31) || 1,
    fields,
  }

  const generated = generateRows({ schema, rowsByTable, spec })

  if (generated.rows.length === 0) {
    return { issues: generated.issues.length > 0 ? generated.issues : [`insert_rows: '${table.name}' 행을 만들지 못했습니다.`] }
  }

  const previewColumnIds = fields.flatMap((field) => {
    const column = table.columns.find(
      (candidate) => candidate.name.toLocaleLowerCase() === field.column.trim().toLocaleLowerCase(),
    )
    return column ? [column] : []
  })

  return {
    plan: {
      tableName: table.name,
      rows: generated.rows,
      previewColumns: previewColumnIds.map((column) => column.name),
      previewRows: generated.rows.slice(0, PREVIEW_ROW_LIMIT).map((row) =>
        previewColumnIds.map((column) => {
          const value = row.cells[column.columnId]
          return value === undefined || value === null ? '' : String(value)
        }),
      ),
      totalCount: generated.rows.length,
    },
    step: `'${table.name}'에 ${generated.rows.length.toLocaleString()}행 생성`,
    issues: generated.issues,
  }
}

/**
 * 도구 호출을 Command 배치로 컴파일한다.
 * 각 Command를 작업용 스키마에 순차 적용하므로, 같은 배치 안에서 만든 테이블을 뒤 호출이 참조할 수 있다.
 * 실제 문서에는 아무것도 적용하지 않는다. 적용은 사용자 승인 후 스토어가 한다.
 */
export function compileAiToolCalls(
  project: SchemaProject,
  toolCalls: readonly AiToolCall[],
  rowsByTable: RowsByTable = {},
): AiBatchPlan {
  const commands: SchemaCommand[] = []
  const rowPlans: GeneratedRowPlan[] = []
  const steps: string[] = []
  const issues: string[] = []
  let workingSchema = project
  let createdTableCount = 0
  let addedColumnCount = 0
  let addedRelationCount = 0
  let insertedRowCount = 0

  for (const call of toolCalls) {
    const args = parseArguments(call)

    if (!args) {
      issues.push(`${call.name} 호출의 인자를 해석하지 못했습니다.`)
      continue
    }

    if (call.name === 'insert_rows') {
      const rowResult = buildInsertRows(workingSchema, rowsByTable, args)
      issues.push(...rowResult.issues)

      if (rowResult.plan) {
        rowPlans.push(rowResult.plan)
        insertedRowCount += rowResult.plan.totalCount
        if (rowResult.step) steps.push(rowResult.step)
      }

      continue
    }

    const built = call.name === 'create_table' ? buildCreateTable(workingSchema, args)
      : call.name === 'add_column' ? buildAddColumn(workingSchema, args)
        : call.name === 'add_relation' ? buildAddRelation(workingSchema, args)
          : { issue: `지원하지 않는 도구 '${call.name}'입니다.` }

    if (built.issue || !built.command) {
      if (built.issue) issues.push(built.issue)
      continue
    }

    try {
      workingSchema = built.command.execute(workingSchema)
    } catch (error) {
      issues.push(`${built.step ?? call.name} 적용 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
      continue
    }

    commands.push(built.command)
    if (built.step) steps.push(built.step)
    if (call.name === 'create_table') createdTableCount += 1
    if (call.name === 'add_column') addedColumnCount += 1
    if (call.name === 'add_relation') addedRelationCount += 1
  }

  return { commands, rowPlans, steps, issues, createdTableCount, addedColumnCount, addedRelationCount, insertedRowCount }
}

export function describeAiBatch(plan: AiBatchPlan): string {
  const parts: string[] = []
  if (plan.createdTableCount > 0) parts.push(`테이블 ${plan.createdTableCount}개 생성`)
  if (plan.addedColumnCount > 0) parts.push(`컬럼 ${plan.addedColumnCount}개 추가`)
  if (plan.addedRelationCount > 0) parts.push(`관계 ${plan.addedRelationCount}개 연결`)
  if (plan.insertedRowCount > 0) parts.push(`행 ${plan.insertedRowCount.toLocaleString()}개 생성`)
  return parts.length > 0 ? parts.join(' · ') : '적용할 변경 없음'
}
