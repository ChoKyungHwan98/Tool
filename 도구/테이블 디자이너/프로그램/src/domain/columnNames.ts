import type { EntityId, SchemaTable } from './schema'

const COLUMN_NAME_PATTERN = /^[\p{L}_][\p{L}\p{N}_]*$/u

export function columnNameSyntaxError(candidate: string): string | null {
  const nextName = candidate.trim()
  if (nextName.length === 0) return '열 이름은 비워 둘 수 없습니다.'
  if (!COLUMN_NAME_PATTERN.test(nextName)) {
    return '열 이름은 문자 또는 밑줄로 시작하고 문자, 숫자, 밑줄만 사용할 수 있습니다.'
  }
  return null
}

export function validateColumnName(
  table: SchemaTable,
  columnId: EntityId,
  candidate: string,
): string | null {
  const nextName = candidate.trim()

  const syntaxError = columnNameSyntaxError(nextName)
  if (syntaxError) return syntaxError
  if (table.columns.some((column) => (
    column.columnId !== columnId && column.name.toLowerCase() === nextName.toLowerCase()
  ))) {
    return `이미 ${nextName} 열이 있습니다.`
  }

  return null
}
