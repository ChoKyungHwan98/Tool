import { makeId } from '../domain/ids'
import type { CellValue, DataRow, RowsByTable, SchemaProject, SchemaTable } from '../domain/schema'

/**
 * AI는 "규칙"만 제안하고 행은 이 모듈이 로컬에서 결정론적으로 만든다.
 * LLM이 1000행을 직접 토해내는 것보다 빠르고, 정확하고, 토큰을 거의 쓰지 않는다.
 */

export const MAX_GENERATED_ROWS = 20000

export type RowFieldSpec =
  | { readonly kind: 'constant'; readonly column: string; readonly value: string | number | boolean }
  | { readonly kind: 'sequence'; readonly column: string; readonly start: number; readonly step?: number }
  | { readonly kind: 'formula'; readonly column: string; readonly expression: string }
  | { readonly kind: 'weighted'; readonly column: string; readonly values: readonly string[]; readonly weights?: readonly number[] }
  | { readonly kind: 'cycle'; readonly column: string; readonly values: readonly (string | number)[] }
  | { readonly kind: 'template'; readonly column: string; readonly pattern: string }
  | { readonly kind: 'reference'; readonly column: string; readonly targetTable: string }

export interface RowGenerationSpec {
  readonly tableName: string
  readonly count: number
  readonly seed?: number
  readonly fields: readonly RowFieldSpec[]
}

export interface RowGenerationResult {
  readonly rows: readonly DataRow[]
  readonly issues: readonly string[]
}

// ---------------------------------------------------------------------------
// 안전한 수식 평가기: eval/Function을 쓰지 않는 재귀 하강 파서.
// 숫자, 식별자, + - * / %, 괄호, 단항 마이너스, 소수의 내장 함수만 허용한다.
// ---------------------------------------------------------------------------

const FUNCTIONS: Readonly<Record<string, (args: readonly number[]) => number>> = {
  floor: (args) => Math.floor(args[0] ?? 0),
  ceil: (args) => Math.ceil(args[0] ?? 0),
  round: (args) => Math.round(args[0] ?? 0),
  abs: (args) => Math.abs(args[0] ?? 0),
  min: (args) => Math.min(...(args.length > 0 ? args : [0])),
  max: (args) => Math.max(...(args.length > 0 ? args : [0])),
}

type Token = { readonly type: 'number'; readonly value: number }
  | { readonly type: 'identifier'; readonly value: string }
  | { readonly type: 'symbol'; readonly value: string }

function tokenize(expression: string): readonly Token[] {
  const tokens: Token[] = []
  let index = 0

  while (index < expression.length) {
    const char = expression[index]!

    if (/\s/.test(char)) {
      index += 1
      continue
    }

    if (/[0-9.]/.test(char)) {
      let literal = ''
      while (index < expression.length && /[0-9.]/.test(expression[index]!)) {
        literal += expression[index]
        index += 1
      }
      const value = Number(literal)
      if (Number.isNaN(value)) throw new Error(`숫자를 해석할 수 없습니다: ${literal}`)
      tokens.push({ type: 'number', value })
      continue
    }

    if (/[A-Za-z_가-힣]/.test(char)) {
      let name = ''
      while (index < expression.length && /[A-Za-z0-9_가-힣]/.test(expression[index]!)) {
        name += expression[index]
        index += 1
      }
      tokens.push({ type: 'identifier', value: name })
      continue
    }

    if ('+-*/%(),'.includes(char)) {
      tokens.push({ type: 'symbol', value: char })
      index += 1
      continue
    }

    throw new Error(`수식에 허용되지 않은 문자가 있습니다: ${char}`)
  }

  return tokens
}

export function evaluateExpression(expression: string, scope: Readonly<Record<string, number>>): number {
  const tokens = tokenize(expression)
  let position = 0

  const peek = (): Token | undefined => tokens[position]
  const consumeSymbol = (value: string): boolean => {
    const token = peek()
    if (token && token.type === 'symbol' && token.value === value) {
      position += 1
      return true
    }
    return false
  }

  function parseExpression(): number {
    let left = parseTerm()

    for (;;) {
      if (consumeSymbol('+')) left += parseTerm()
      else if (consumeSymbol('-')) left -= parseTerm()
      else return left
    }
  }

  function parseTerm(): number {
    let left = parseFactor()

    for (;;) {
      if (consumeSymbol('*')) left *= parseFactor()
      else if (consumeSymbol('/')) {
        const divisor = parseFactor()
        if (divisor === 0) throw new Error('0으로 나눌 수 없습니다.')
        left /= divisor
      } else if (consumeSymbol('%')) {
        const divisor = parseFactor()
        if (divisor === 0) throw new Error('0으로 나눌 수 없습니다.')
        left %= divisor
      } else return left
    }
  }

  function parseFactor(): number {
    if (consumeSymbol('-')) return -parseFactor()
    if (consumeSymbol('+')) return parseFactor()
    return parsePrimary()
  }

  function parsePrimary(): number {
    const token = peek()
    if (!token) throw new Error('수식이 갑자기 끝났습니다.')

    if (token.type === 'number') {
      position += 1
      return token.value
    }

    if (token.type === 'identifier') {
      position += 1

      if (consumeSymbol('(')) {
        const handler = FUNCTIONS[token.value]
        if (!handler) throw new Error(`알 수 없는 함수입니다: ${token.value}`)

        const args: number[] = []
        if (!consumeSymbol(')')) {
          do {
            args.push(parseExpression())
          } while (consumeSymbol(','))

          if (!consumeSymbol(')')) throw new Error('닫는 괄호가 없습니다.')
        }

        return handler(args)
      }

      const value = scope[token.value]
      if (value === undefined) throw new Error(`알 수 없는 값입니다: ${token.value}`)
      return value
    }

    if (consumeSymbol('(')) {
      const value = parseExpression()
      if (!consumeSymbol(')')) throw new Error('닫는 괄호가 없습니다.')
      return value
    }

    throw new Error(`수식을 해석할 수 없습니다: ${token.value}`)
  }

  const result = parseExpression()
  if (position !== tokens.length) throw new Error('수식 뒤에 남은 내용이 있습니다.')
  if (!Number.isFinite(result)) throw new Error('수식 결과가 유효한 숫자가 아닙니다.')

  return result
}

// ---------------------------------------------------------------------------
// 시드 기반 난수: 미리보기와 실제 생성 결과가 반드시 같아야 하므로 결정론적이어야 한다.
// ---------------------------------------------------------------------------

function createRandom(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function findTableByName(schema: SchemaProject, name: string): SchemaTable | undefined {
  const normalized = name.trim().toLocaleLowerCase()
  return schema.tables.find((table) => table.name.toLocaleLowerCase() === normalized)
}

function coerceToColumnType(table: SchemaTable, columnId: string, value: string | number | boolean): CellValue {
  const column = table.columns.find((candidate) => candidate.columnId === columnId)
  const kind = column?.dataType.kind

  if (kind === 'int32' || kind === 'int64') {
    const numeric = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(numeric) ? Math.round(numeric) : String(value)
  }

  if (kind === 'float' || kind === 'double') {
    const numeric = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(numeric) ? numeric : String(value)
  }

  if (kind === 'boolean') {
    return typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true'
  }

  return typeof value === 'string' ? value : String(value)
}

function pickWeighted(values: readonly string[], weights: readonly number[] | undefined, random: () => number): string {
  if (!weights || weights.length !== values.length) {
    return values[Math.floor(random() * values.length)] ?? values[0]!
  }

  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0)
  if (total <= 0) return values[0]!

  let threshold = random() * total
  for (let index = 0; index < values.length; index += 1) {
    threshold -= Math.max(0, weights[index] ?? 0)
    if (threshold <= 0) return values[index]!
  }

  return values[values.length - 1]!
}

function renderTemplate(pattern: string, index: number, computed: Readonly<Record<string, string | number | boolean>>): string {
  return pattern.replace(/\{([^}]+)\}/g, (_match, rawKey: string) => {
    const key = rawKey.trim()
    if (key === 'index') return String(index)
    const value = computed[key]
    return value === undefined ? '' : String(value)
  })
}

export function generateRows(input: {
  readonly schema: SchemaProject
  readonly rowsByTable: RowsByTable
  readonly spec: RowGenerationSpec
}): RowGenerationResult {
  const issues: string[] = []
  const table = findTableByName(input.schema, input.spec.tableName)

  if (!table) {
    return { rows: [], issues: [`'${input.spec.tableName}' 테이블을 찾을 수 없습니다.`] }
  }

  const requestedCount = Math.floor(input.spec.count)
  if (!Number.isFinite(requestedCount) || requestedCount <= 0) {
    return { rows: [], issues: ['생성할 행 개수가 올바르지 않습니다.'] }
  }

  const count = Math.min(requestedCount, MAX_GENERATED_ROWS)
  if (count < requestedCount) {
    issues.push(`한 번에 만들 수 있는 최대 행 수(${MAX_GENERATED_ROWS.toLocaleString()})까지만 생성합니다.`)
  }

  // 컬럼 이름 -> columnId 해석. 없는 컬럼은 건너뛰고 문제로 보고한다.
  const resolvedFields = input.spec.fields.flatMap((field) => {
    const column = table.columns.find(
      (candidate) => candidate.name.toLocaleLowerCase() === field.column.trim().toLocaleLowerCase(),
    )

    if (!column) {
      issues.push(`'${table.name}'에 '${field.column}' 컬럼이 없어 건너뜁니다.`)
      return []
    }

    return [{ field, columnId: column.columnId, columnName: column.name }]
  })

  if (resolvedFields.length === 0) {
    return { rows: [], issues: [...issues, '채울 수 있는 컬럼이 없습니다.'] }
  }

  // reference 모드: FK 대상 테이블의 실제 존재하는 기본키 값만 쓴다.
  // AI가 없는 ID를 지어내 참조가 깨지는 일을 구조적으로 막는다.
  const referencePools = new Map<string, readonly CellValue[]>()

  for (const { field } of resolvedFields) {
    if (field.kind !== 'reference') continue

    const targetTable = findTableByName(input.schema, field.targetTable)
    if (!targetTable) {
      issues.push(`참조 대상 '${field.targetTable}' 테이블을 찾을 수 없습니다.`)
      continue
    }

    const primaryKeyColumnId = targetTable.primaryKey.columnIds[0]
    if (!primaryKeyColumnId) {
      issues.push(`'${targetTable.name}'에 기본키가 없어 참조할 수 없습니다.`)
      continue
    }

    const pool = (input.rowsByTable[targetTable.tableId] ?? [])
      .map((row) => row.cells[primaryKeyColumnId])
      .filter((value): value is CellValue => value !== undefined && value !== null && value !== '')

    if (pool.length === 0) {
      issues.push(`'${targetTable.name}'에 참조할 행이 없어 '${field.column}'을 비워 둡니다.`)
    }

    referencePools.set(field.column, pool)
  }

  const random = createRandom(input.spec.seed ?? 1)
  const rows: DataRow[] = []

  for (let index = 0; index < count; index += 1) {
    const cells: Record<string, CellValue> = {}
    const computed: Record<string, string | number | boolean> = {}
    const numericScope: Record<string, number> = { index }

    for (const { field, columnId, columnName } of resolvedFields) {
      let value: string | number | boolean | undefined

      switch (field.kind) {
        case 'constant':
          value = field.value
          break
        case 'sequence':
          value = field.start + index * (field.step ?? 1)
          break
        case 'cycle':
          value = field.values.length > 0 ? field.values[index % field.values.length]! : undefined
          break
        case 'weighted':
          value = field.values.length > 0 ? pickWeighted(field.values, field.weights, random) : undefined
          break
        case 'template':
          value = renderTemplate(field.pattern, index, computed)
          break
        case 'reference': {
          const pool = referencePools.get(field.column) ?? []
          value = pool.length > 0 ? (pool[Math.floor(random() * pool.length)] as string | number | boolean) : undefined
          break
        }
        case 'formula': {
          try {
            value = evaluateExpression(field.expression, numericScope)
          } catch (error) {
            if (index === 0) {
              issues.push(`'${columnName}' 수식을 계산할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
            }
            value = undefined
          }
          break
        }
      }

      if (value === undefined) continue

      cells[columnId] = coerceToColumnType(table, columnId, value)
      computed[columnName] = value

      const numeric = typeof value === 'number' ? value : Number(value)
      if (Number.isFinite(numeric)) numericScope[columnName] = numeric
    }

    rows.push({ rowId: makeId('row'), cells })
  }

  return { rows, issues }
}
