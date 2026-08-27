import { makeId } from '../domain/ids'
import { findTable } from '../domain/projectQueries'
import { validateRows } from '../domain/validator'
import type {
  CellValue,
  ColumnDataType,
  DataRow,
  EntityId,
  RowsByTable,
  SchemaColumn,
  SchemaProject,
  SchemaTable,
  ValidationIssue,
} from '../domain/schema'

export interface CsvParseResult {
  readonly headers: readonly string[]
  readonly rows: readonly Readonly<Record<string, string>>[]
}

export interface CsvImportResult {
  readonly tableId: EntityId
  readonly rows: readonly DataRow[]
  readonly issues: readonly ValidationIssue[]
}

function importIssue(input: Omit<ValidationIssue, 'issueId' | 'relationIds'>): ValidationIssue {
  return {
    issueId: makeId('issue'),
    relationIds: [],
    ...input,
  }
}

export function parseCsv(text: string): CsvParseResult {
  const normalizedText = text.replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(normalizedText)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1
      }

      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  const nonEmptyRows = rows.filter((candidate) => candidate.some((value) => value.trim().length > 0))
  const [headers = [], ...bodyRows] = nonEmptyRows
  const normalizedHeaders = headers.map((header) => header.trim().replace(/^\uFEFF/, ''))

  return {
    headers: normalizedHeaders,
    rows: bodyRows.map((values) =>
      Object.fromEntries(normalizedHeaders.map((header, index) => [header, values[index] ?? ''])),
    ),
  }
}

export function importCsvForTable(project: SchemaProject, tableId: EntityId, csvText: string): CsvImportResult {
  const table = findTable(project, tableId)

  if (!table) {
    return {
      tableId,
      rows: [],
      issues: [
        importIssue({
          severity: 'blocking',
          title: 'CSV import table missing',
          message: `Target table ${tableId} does not exist.`,
          tableIds: [tableId],
          columnIds: [],
          suggestedFix: 'Choose an existing table before importing CSV.',
        }),
      ],
    }
  }

  const parsed = parseCsv(csvText)
  const issues: ValidationIssue[] = []
  const headerMappings = new Map<string, SchemaColumn>()

  for (const header of duplicateValues(parsed.headers)) {
    issues.push(
      importIssue({
        severity: 'blocking',
        title: 'Duplicate CSV header',
        message: `${header} appears more than once in the CSV header row.`,
        tableIds: [table.tableId],
        columnIds: [],
        dataPath: [table.name, 'headers', header],
        suggestedFix: 'Remove duplicate CSV headers before importing.',
      }),
    )
  }

  for (const header of parsed.headers) {
    const candidates = columnsForHeader(table.columns, header)

    if (candidates.length === 0) {
      issues.push(
        importIssue({
          severity: 'blocking',
          title: 'Unknown CSV header',
          message: `${table.name}.${header} does not match a schema column.`,
          tableIds: [table.tableId],
          columnIds: [],
          dataPath: [table.name, 'headers', header],
          suggestedFix: 'Map the header to a known schema column or remove it before import.',
        }),
      )
      continue
    }

    if (candidates.length > 1) {
      issues.push(
        importIssue({
          severity: 'blocking',
          title: 'Ambiguous CSV header',
          message: `${table.name}.${header} matches multiple schema columns.`,
          tableIds: [table.tableId],
          columnIds: candidates.map((column) => column.columnId),
          dataPath: [table.name, 'headers', header],
          suggestedFix: 'Rename duplicate schema columns or provide an explicit import mapping.',
        }),
      )
      continue
    }

    const column = candidates[0]

    if (column) {
      headerMappings.set(header, column)
    }
  }

  for (const column of table.columns) {
    if (!column.nullable && ![...headerMappings.values()].some((mappedColumn) => mappedColumn.columnId === column.columnId)) {
      issues.push(
        importIssue({
          severity: 'blocking',
          title: 'Required CSV header missing',
          message: `${table.name}.${column.name} is required but has no matching CSV header.`,
          tableIds: [table.tableId],
          columnIds: [column.columnId],
          dataPath: [table.name, 'headers', column.name],
          suggestedFix: 'Add the missing CSV header or make the column nullable through a reviewed migration.',
        }),
      )
    }
  }

  if (issues.some((issue) => issue.severity === 'blocking' || issue.severity === 'error')) {
    return {
      tableId: table.tableId,
      rows: [],
      issues,
    }
  }

  const rows = parsed.rows.map((row) => ({
    rowId: makeId('row'),
    cells: Object.fromEntries(
      [...headerMappings.entries()].map(([header, column]) => [column.columnId, normalizeImportedValue(column, row[header])]),
    ),
  } satisfies DataRow))

  const validationIssues = validateRows(project, { [table.tableId]: rows } satisfies RowsByTable)

  return {
    tableId: table.tableId,
    rows,
    issues: [...issues, ...validationIssues],
  }
}

export function serializeTableRowsToCsv(table: SchemaTable, rows: readonly DataRow[]): string {
  const headers = table.columns.map((column) => column.name)

  return [
    headers.join(','),
    ...rows.map((row) => table.columns.map((column) => escapeCsvCell(row.cells[column.columnId])).join(',')),
  ].join('\n')
}

export function csvFileName(table: SchemaTable): string {
  return `${table.name}.csv`
}

function normalizeImportedValue(column: SchemaColumn, value: unknown): CellValue {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return null
  }

  const text = String(value).trim()
  const dataType = column.dataType

  if (dataType.kind === 'list') {
    return text.includes('|') ? text.split('|').map((item) => item.trim()) : text
  }

  return normalizeScalarValue(dataType, text)
}

function normalizeScalarValue(dataType: Exclude<ColumnDataType, { kind: 'list' }>, value: string): CellValue {
  switch (dataType.kind) {
    case 'int32':
    case 'int64':
      if (!/^-?\d+$/.test(value)) return value
      const integer = Number(value)
      return Number.isSafeInteger(integer) ? integer : value
    case 'float':
    case 'double':
      return value !== '' && Number.isFinite(Number(value)) ? Number(value) : value
    case 'boolean':
      if (value.toLowerCase() === 'true' || value === '1') {
        return true
      }
      if (value.toLowerCase() === 'false' || value === '0') {
        return false
      }
      return value
    case 'json':
      try {
        return JSON.parse(value) as CellValue
      } catch {
        return value
      }
    default:
      return value
  }
}

function detectDelimiter(text: string): ',' | '\t' | ';' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const counts = ([',', '\t', ';'] as const).map((delimiter) => ({
    delimiter,
    count: [...firstLine].filter((character) => character === delimiter).length,
  }))
  return counts.toSorted((left, right) => right.count - left.count)[0]?.delimiter ?? ','
}

function duplicateValues(values: readonly string[]): readonly string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
    }

    seen.add(value)
  }

  return [...duplicates]
}

function columnsForHeader(columns: readonly SchemaColumn[], header: string): readonly SchemaColumn[] {
  const exactMatches = columns.filter((column) => column.name === header)

  if (exactMatches.length > 0) {
    return exactMatches
  }

  const caseInsensitiveMatches = columns.filter((column) => column.name.toLowerCase() === header.toLowerCase())

  return caseInsensitiveMatches.length > 1 ? caseInsensitiveMatches : []
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  const text = Array.isArray(value) ? value.join('|') : String(value)
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text

  return /[",\n\r]/.test(safeText) ? `"${safeText.replaceAll('"', '""')}"` : safeText
}
