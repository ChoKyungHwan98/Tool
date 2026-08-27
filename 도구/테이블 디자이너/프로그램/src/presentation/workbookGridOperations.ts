import type { DataTypeKind, SchemaColumn, WorkbookColumnFilter } from '../domain/schema'

export function validateCellInput(
  column: SchemaColumn,
  value: string,
  allowedValues: readonly string[] = [],
): string | null {
  const trimmed = value.trim()
  if (!trimmed) return column.nullable ? null : `${column.name}은(는) 필수값입니다.`

  const kind = column.dataType.kind
  if ((kind === 'int32' || kind === 'int64') && !/^[+-]?\d+$/.test(trimmed)) return `${column.name}에는 정수를 입력하세요.`
  if ((kind === 'float' || kind === 'double') && !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return `${column.name}에는 숫자를 입력하세요.`
  if (kind === 'boolean' && !['true', 'false', '1', '0'].includes(trimmed.toLocaleLowerCase('en-US'))) return `${column.name}에는 true 또는 false를 선택하세요.`
  if (kind === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`)))) return `${column.name}에는 YYYY-MM-DD 날짜를 입력하세요.`
  if (kind === 'datetime' && Number.isNaN(Date.parse(trimmed))) return `${column.name}에는 올바른 날짜와 시간을 입력하세요.`
  if ((kind === 'enum' || allowedValues.length > 0) && allowedValues.length > 0 && !allowedValues.includes(trimmed)) {
    return `${column.name}에는 목록에 있는 값을 선택하세요.`
  }

  const numeric = Number(trimmed)
  for (const rule of column.validationRules) {
    if (rule.kind === 'min' && Number.isFinite(numeric) && numeric < Number(rule.value)) return rule.message
    if (rule.kind === 'max' && Number.isFinite(numeric) && numeric > Number(rule.value)) return rule.message
    if (rule.kind === 'range' && Array.isArray(rule.value)) {
      const [min, max] = rule.value.map(Number)
      if (Number.isFinite(numeric) && (numeric < min || numeric > max)) return rule.message
    }
    if (rule.kind === 'regex' && typeof rule.value === 'string' && !new RegExp(rule.value).test(value)) return rule.message
    if (rule.kind === 'one_of' && Array.isArray(rule.value) && !rule.value.map(String).includes(value)) return rule.message
  }
  return null
}

export function matchesWorkbookFilter(
  value: string,
  filter: WorkbookColumnFilter,
  dataType: DataTypeKind,
): boolean {
  const normalized = value.toLocaleLowerCase('ko-KR')
  const query = (filter.value ?? '').toLocaleLowerCase('ko-KR')

  if (filter.operator === 'is_blank') return value.trim() === ''
  if (filter.operator === 'is_not_blank') return value.trim() !== ''
  if (filter.operator === 'one_of') {
    return (filter.values ?? []).some((candidate) => candidate.toLocaleLowerCase('ko-KR') === normalized)
  }
  if (filter.operator === 'contains') return normalized.includes(query)
  if (filter.operator === 'starts_with') return normalized.startsWith(query)
  if (filter.operator === 'equals') return normalized === query

  const comparable = comparableValue(value, dataType)
  const first = comparableValue(filter.value ?? '', dataType)
  if (comparable === null || first === null) return false
  if (filter.operator === 'greater_than') return comparable > first
  if (filter.operator === 'less_than') return comparable < first
  if (filter.operator === 'between') {
    const second = comparableValue(filter.secondValue ?? '', dataType)
    return second !== null && comparable >= Math.min(first, second) && comparable <= Math.max(first, second)
  }
  return true
}

export function replaceWorkbookText(value: string, query: string, replacement: string): string {
  if (!query) return value
  return value.replace(new RegExp(escapeRegExp(query), 'giu'), replacement)
}

export function nextFillValues(source: readonly string[], count: number): readonly string[] {
  if (source.length === 0 || count <= 0) return []

  const numbers = source.map(strictNumber)
  if (source.length >= 2 && numbers.every((value): value is number => value !== null)) {
    const step = numbers.at(-1)! - numbers.at(-2)!
    const last = numbers.at(-1)!
    return Array.from({ length: count }, (_, index) => String(last + step * (index + 1)))
  }

  const dates = source.map(isoDateValue)
  if (source.length >= 2 && dates.every((value): value is number => value !== null)) {
    const step = dates.at(-1)! - dates.at(-2)!
    const last = dates.at(-1)!
    return Array.from({ length: count }, (_, index) => new Date(last + step * (index + 1)).toISOString().slice(0, 10))
  }

  return Array.from({ length: count }, (_, index) => source[index % source.length]!)
}

function comparableValue(value: string, dataType: DataTypeKind): number | null {
  if (dataType === 'date' || dataType === 'datetime') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function strictNumber(value: string): number | null {
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value.trim())) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isoDateValue(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed) ? parsed : null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
