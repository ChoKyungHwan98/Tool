import { createWorkbenchDocument } from './workbenchDocument'
import {
  AddForeignKeyCommand,
  CreateTableCommand,
  commandFromSerialized,
  materializeCommandForUndo,
} from '../domain/commands'
import { makeId } from '../domain/ids'
import { createRelation, createTable } from '../domain/schemaFactories'
import type {
  CellValue,
  ColumnDataType,
  DataRow,
  EntityId,
  SchemaProject,
  WorkbenchDocument,
} from '../domain/schema'

export type ImportCell = string | number | boolean | Date | null

export interface RawImportSheet {
  readonly sourceName: string
  readonly sheetName: string
  readonly rows: readonly (readonly ImportCell[])[]
}

export interface ImportColumnCandidate {
  readonly columnId: EntityId
  readonly sourceIndex: number
  readonly name: string
  readonly dataType: ColumnDataType
  readonly nullable: boolean
  readonly primaryKeyCandidate: boolean
}

export interface TableImportCandidate {
  readonly candidateId: EntityId
  readonly tableId: EntityId
  readonly sourceName: string
  readonly sheetName: string
  readonly name: string
  readonly headerRow: number
  readonly columns: readonly ImportColumnCandidate[]
  readonly primaryKeyColumnIds: readonly EntityId[]
  readonly rows: readonly DataRow[]
}

export interface RelationCandidate {
  readonly candidateId: EntityId
  readonly name: string
  readonly sourceTableCandidateId: EntityId
  readonly sourceColumnIds: readonly EntityId[]
  readonly targetTableCandidateId: EntityId
  readonly targetColumnIds: readonly EntityId[]
  readonly confidence: 'high' | 'medium'
  readonly reason: string
}

export interface ImportPreview {
  readonly previewId: EntityId
  readonly sources: readonly string[]
  readonly tables: readonly TableImportCandidate[]
  readonly relationCandidates: readonly RelationCandidate[]
  readonly warnings: readonly string[]
}

export interface ImportSelection {
  readonly tableNames?: Readonly<Record<EntityId, string>>
  readonly primaryKeys?: Readonly<Record<EntityId, readonly EntityId[]>>
  readonly approvedRelationCandidateIds: readonly EntityId[]
}

export function createImportPreview(
  sheets: readonly RawImportSheet[],
  existingProject?: SchemaProject,
): ImportPreview {
  const usedNames = new Set(existingProject?.tables.map((table) => table.name.toLowerCase()) ?? [])
  const warnings: string[] = []
  const tables = sheets.flatMap((sheet) => {
    const prepared = prepareSheet(sheet, usedNames)

    if (!prepared) {
      warnings.push(`${sheet.sourceName} · ${sheet.sheetName}: 헤더와 데이터가 없어 건너뜁니다.`)
      return []
    }

    usedNames.add(prepared.name.toLowerCase())
    return [prepared]
  })

  return {
    previewId: makeId('import_preview'),
    sources: [...new Set(sheets.map((sheet) => sheet.sourceName))],
    tables,
    relationCandidates: inferRelations(tables),
    warnings,
  }
}

export function applyImportPreview(
  document: WorkbenchDocument,
  preview: ImportPreview,
  selection: ImportSelection,
): WorkbenchDocument {
  let schema = document.schema
  const rowsByTable = { ...document.rowsByTable }
  const tableByCandidateId = new Map<EntityId, TableImportCandidate>()

  preview.tables.forEach((candidate, index) => {
    tableByCandidateId.set(candidate.candidateId, candidate)
    const name = selection.tableNames?.[candidate.candidateId]?.trim() || candidate.name
    const primaryKeyColumnIds = selection.primaryKeys?.[candidate.candidateId] ?? candidate.primaryKeyColumnIds
    const table = createTable({
      tableId: candidate.tableId,
      name,
      columns: candidate.columns.map((column) => ({
        columnId: column.columnId,
        name: column.name,
        dataType: column.dataType,
        nullable: primaryKeyColumnIds.includes(column.columnId) ? false : column.nullable,
      })),
      primaryKeyColumnIds,
    })
    const command = new CreateTableCommand({
      table,
      layout: {
        entityId: table.tableId,
        x: 80 + (index % 4) * 260,
        y: 80 + Math.floor(index / 4) * 190,
      },
    })
    const serialized = materializeCommandForUndo(schema, command)
    schema = commandFromSerialized(serialized).execute(schema)
    rowsByTable[table.tableId] = candidate.rows
  })

  const approved = new Set(selection.approvedRelationCandidateIds)

  for (const relationCandidate of preview.relationCandidates) {
    if (!approved.has(relationCandidate.candidateId)) {
      continue
    }

    const source = tableByCandidateId.get(relationCandidate.sourceTableCandidateId)
    const target = tableByCandidateId.get(relationCandidate.targetTableCandidateId)

    if (!source || !target) {
      continue
    }

    const command = new AddForeignKeyCommand({
      relation: createRelation({
        name: relationCandidate.name,
        sourceTableId: source.tableId,
        sourceColumnIds: relationCandidate.sourceColumnIds,
        targetTableId: target.tableId,
        targetColumnIds: relationCandidate.targetColumnIds,
        kind: 'hard_fk',
      }),
    })
    const serialized = materializeCommandForUndo(schema, command)
    schema = commandFromSerialized(serialized).execute(schema)
  }

  return createWorkbenchDocument(schema, rowsByTable, {
    revision: document.revision + 1,
    workbookViews: document.workbookViews,
    auditLog: [
      ...document.auditLog,
      {
        auditEventId: makeId('audit'),
        revision: document.revision + 1,
        type: 'ImportTables',
        createdAt: new Date().toISOString(),
        summary: `${preview.tables.length}개 테이블을 가져왔습니다.`,
      },
    ],
  })
}

function prepareSheet(sheet: RawImportSheet, usedNames: Set<string>): TableImportCandidate | null {
  const rows = trimSheet(sheet.rows)

  if (rows.length === 0) {
    return null
  }

  const headerRow = findHeaderRow(rows)
  const headerValues = rows[headerRow]

  if (!headerValues || headerValues.every(isBlank)) {
    return null
  }

  const tableId = makeId('table')
  const name = uniqueName(usedNames, normalizeIdentifier(sheet.sheetName || stripExtension(sheet.sourceName), 'ImportedTable'))
  const headers = uniqueHeaders(headerValues)
  const body = rows.slice(headerRow + 1).filter((row) => row.some((value) => !isBlank(value)))
  const columns = headers.map((header, sourceIndex) => {
    const values = body.map((row) => row[sourceIndex] ?? null)

    return {
      columnId: makeId('column'),
      sourceIndex,
      name: header,
      dataType: inferDataType(values),
      nullable: values.some(isBlank),
      primaryKeyCandidate: isUniqueNonBlank(values),
    } satisfies ImportColumnCandidate
  })
  const primaryKeyColumnIds = choosePrimaryKey(name, columns)
  const importedRows = body.map((sourceRow) => ({
    rowId: makeId('row'),
    cells: Object.fromEntries(columns.map((column) => [column.columnId, normalizeCell(sourceRow[column.sourceIndex])])),
  } satisfies DataRow))

  return {
    candidateId: makeId('table_candidate'),
    tableId,
    sourceName: sheet.sourceName,
    sheetName: sheet.sheetName,
    name,
    headerRow: headerRow + 1,
    columns,
    primaryKeyColumnIds,
    rows: importedRows,
  }
}

function inferRelations(tables: readonly TableImportCandidate[]): readonly RelationCandidate[] {
  const candidates: RelationCandidate[] = []

  for (const sourceTable of tables) {
    for (const sourceColumn of sourceTable.columns) {
      for (const targetTable of tables) {
        if (sourceTable.candidateId === targetTable.candidateId || targetTable.primaryKeyColumnIds.length !== 1) {
          continue
        }

        const targetColumn = targetTable.columns.find((column) => targetTable.primaryKeyColumnIds.includes(column.columnId))

        if (!targetColumn || sourceColumn.dataType.kind !== targetColumn.dataType.kind) {
          continue
        }

        const sourceName = sourceColumn.name.toLowerCase()
        const targetColumnName = targetColumn.name.toLowerCase()
        const expectedName = `${targetTable.name}Id`.toLowerCase()
        const exactName = sourceName === targetColumnName || sourceName === expectedName

        if (!exactName || !valuesFitReference(sourceTable, sourceColumn, targetTable, targetColumn)) {
          continue
        }

        candidates.push({
          candidateId: makeId('relation_candidate'),
          name: `${sourceTable.name}_${sourceColumn.name}_to_${targetTable.name}`,
          sourceTableCandidateId: sourceTable.candidateId,
          sourceColumnIds: [sourceColumn.columnId],
          targetTableCandidateId: targetTable.candidateId,
          targetColumnIds: [targetColumn.columnId],
          confidence: sourceName === expectedName ? 'high' : 'medium',
          reason: `${sourceColumn.name} 값이 ${targetTable.name}.${targetColumn.name} 키 집합과 일치합니다.`,
        })
      }
    }
  }

  return candidates
}

function valuesFitReference(
  sourceTable: TableImportCandidate,
  sourceColumn: ImportColumnCandidate,
  targetTable: TableImportCandidate,
  targetColumn: ImportColumnCandidate,
): boolean {
  const targetValues = new Set(targetTable.rows.map((row) => stableKey(row.cells[targetColumn.columnId])).filter(Boolean))
  const sourceValues = sourceTable.rows.map((row) => stableKey(row.cells[sourceColumn.columnId])).filter(Boolean)

  return sourceValues.length === 0 || sourceValues.every((value) => targetValues.has(value))
}

function choosePrimaryKey(tableName: string, columns: readonly ImportColumnCandidate[]): readonly EntityId[] {
  const preferredNames = new Set(['id', `${tableName}Id`.toLowerCase()])
  const preferred = columns.find((column) => column.primaryKeyCandidate && preferredNames.has(column.name.toLowerCase()))
  const fallback = columns.find((column) => column.primaryKeyCandidate)

  return preferred ? [preferred.columnId] : fallback ? [fallback.columnId] : []
}

function inferDataType(values: readonly ImportCell[]): ColumnDataType {
  const present = values.filter((value) => !isBlank(value))

  if (present.length === 0) return { kind: 'string' }
  if (present.every((value) => typeof value === 'boolean' || /^(true|false)$/i.test(String(value)))) return { kind: 'boolean' }
  if (present.every((value) => Number.isInteger(typeof value === 'number' ? value : Number(value)))) {
    const fitsInt32 = present.every((value) => Math.abs(Number(value)) <= 2_147_483_647)
    return { kind: fitsInt32 ? 'int32' : 'int64' }
  }
  if (present.every((value) => Number.isFinite(typeof value === 'number' ? value : Number(value)))) return { kind: 'double' }
  if (present.every((value) => value instanceof Date || /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2})?/.test(String(value)))) {
    const hasTime = present.some((value) => value instanceof Date ? value.getHours() + value.getMinutes() + value.getSeconds() > 0 : /[T ]\d{2}:\d{2}/.test(String(value)))
    return { kind: hasTime ? 'datetime' : 'date' }
  }

  return { kind: 'string' }
}

function normalizeCell(value: ImportCell | undefined): CellValue {
  if (value === undefined || value === null || value === '') return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function trimSheet(rows: readonly (readonly ImportCell[])[]): readonly (readonly ImportCell[])[] {
  const last = rows.findLastIndex((row) => row.some((value) => !isBlank(value)))
  return last < 0 ? [] : rows.slice(0, last + 1)
}

function findHeaderRow(rows: readonly (readonly ImportCell[])[]): number {
  const searchLimit = Math.min(rows.length, 20)
  let bestIndex = 0
  let bestScore = -1

  for (let index = 0; index < searchLimit; index += 1) {
    const row = rows[index] ?? []
    const populated = row.filter((value) => !isBlank(value))
    const textCells = populated.filter((value) => typeof value === 'string' && value.trim().length > 0)
    const score = populated.length + textCells.length * 2

    if (populated.length >= 1 && score > bestScore) {
      bestIndex = index
      bestScore = score
    }
  }

  return bestIndex
}

function uniqueHeaders(values: readonly ImportCell[]): readonly string[] {
  const used = new Set<string>()

  return values.map((value, index) => {
    const base = normalizeIdentifier(String(value ?? ''), `Column${index + 1}`)
    let candidate = base
    let suffix = 2

    while (used.has(candidate.toLowerCase())) {
      candidate = `${base}${suffix}`
      suffix += 1
    }

    used.add(candidate.toLowerCase())
    return candidate
  })
}

function normalizeIdentifier(value: string, fallback: string): string {
  const words = value.trim().replace(/\.[^.]+$/, '').split(/[^\p{L}\p{N}_]+/u).filter(Boolean)
  const normalized = words.map((word, index) => index === 0 ? word : `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`).join('')
  return normalized || fallback
}

function uniqueName(used: Set<string>, base: string): string {
  if (!used.has(base.toLowerCase())) return base
  let suffix = 2
  while (used.has(`${base}${suffix}`.toLowerCase())) suffix += 1
  return `${base}${suffix}`
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

function isBlank(value: ImportCell | undefined): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

function isUniqueNonBlank(values: readonly ImportCell[]): boolean {
  const keys = values.map(stableKey).filter(Boolean)
  return keys.length === values.length && new Set(keys).size === keys.length && keys.length > 0
}

function stableKey(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (value instanceof Date) return value.toISOString()
  return JSON.stringify(value)
}
