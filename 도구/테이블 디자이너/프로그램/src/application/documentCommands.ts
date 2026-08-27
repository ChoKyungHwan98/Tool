import { makeId } from '../domain/ids'
import { findTable } from '../domain/projectQueries'
import { RenameColumnCommand } from '../domain/commands'
import { columnNameSyntaxError } from '../domain/columnNames'
import type { CellValue, DataRow, EntityId, WorkbenchDocument } from '../domain/schema'
import { createEmptyDataRow } from './workbenchDocument'

export interface DocumentTransactionResult {
  readonly document: WorkbenchDocument
  readonly changedTableIds: readonly EntityId[]
  readonly changedRowIds: readonly EntityId[]
}

export interface DocumentTransaction {
  readonly transactionId: EntityId
  readonly type: string
  readonly summary: string
  execute(document: WorkbenchDocument): DocumentTransactionResult
}

export interface CellUpdate {
  readonly rowId: EntityId
  readonly columnId: EntityId
  readonly value: CellValue | undefined
}

export interface ApplyWorkbookRangeSerialized {
  readonly type: 'ApplyWorkbookRange'
  readonly transactionId: EntityId
  readonly tableId: EntityId
  readonly startWorkbookRowIndex: number
  readonly startColumnIndex: number
  readonly matrix: readonly (readonly string[])[]
  readonly targetRowIds: readonly EntityId[]
  readonly approved: boolean
}

export interface ReplaceWorkbookMatchesSerialized {
  readonly type: 'ReplaceWorkbookMatches'
  readonly transactionId: EntityId
  readonly tableId: EntityId
  readonly query: string
  readonly replacement: string
  readonly approved: boolean
}

export type PendingDocumentTransactionSerialized = ApplyWorkbookRangeSerialized | ReplaceWorkbookMatchesSerialized

export class ApplyWorkbookRangeCommand implements DocumentTransaction {
  readonly type = 'ApplyWorkbookRange'
  readonly summary: string
  readonly tableId: EntityId
  readonly startWorkbookRowIndex: number
  readonly startColumnIndex: number
  readonly matrix: readonly (readonly string[])[]
  readonly targetRowIds: readonly EntityId[]
  readonly approved: boolean
  readonly transactionId: EntityId

  constructor(
    tableId: EntityId,
    startWorkbookRowIndex: number,
    startColumnIndex: number,
    matrix: readonly (readonly string[])[],
    targetRowIds: readonly EntityId[] = [],
    approved = false,
    transactionId = makeId('transaction'),
  ) {
    this.tableId = tableId
    this.startWorkbookRowIndex = startWorkbookRowIndex
    this.startColumnIndex = startColumnIndex
    this.matrix = matrix
    this.targetRowIds = targetRowIds
    this.approved = approved
    this.transactionId = transactionId
    this.summary = `${matrix.length}x${Math.max(0, ...matrix.map((row) => row.length))} 범위 붙여넣기`
  }

  validate(document: WorkbenchDocument): readonly string[] {
    const table = findTable(document.schema, this.tableId)
    if (!table) return [`테이블 ${this.tableId}이 존재하지 않습니다.`]
    if (this.startWorkbookRowIndex < 0 || this.startColumnIndex < 0) return ['붙여넣기 시작 좌표가 올바르지 않습니다.']
    if (this.matrix.length === 0 || this.matrix.every((row) => row.length === 0)) return ['붙여넣을 값이 없습니다.']

    const width = Math.max(0, ...this.matrix.map((row) => row.length))
    if (this.startColumnIndex + width > table.columns.length) {
      return ['기존 열 범위를 벗어나는 붙여넣기는 열을 자동 생성하지 않습니다. 먼저 열을 추가해 주세요.']
    }

    if (this.startWorkbookRowIndex === 0) {
      const nextNames = table.columns.map((column) => column.name)
      for (let offset = 0; offset < (this.matrix[0]?.length ?? 0); offset += 1) {
        const nextName = this.matrix[0]![offset]!.trim()
        const syntaxError = columnNameSyntaxError(nextName)
        if (syntaxError) return [`${offset + 1}번째 헤더: ${syntaxError}`]
        nextNames[this.startColumnIndex + offset] = nextName
      }
      const normalized = nextNames.map((name) => name.toLowerCase())
      const duplicateIndex = normalized.findIndex((name, index) => normalized.indexOf(name) !== index)
      if (duplicateIndex >= 0) return [`헤더 이름 ${nextNames[duplicateIndex]}이(가) 중복됩니다.`]
    }

    const existingRowIds = new Set((document.rowsByTable[this.tableId] ?? []).map((row) => row.rowId))
    const unknownRowId = this.targetRowIds.find((rowId) => !existingRowIds.has(rowId))
    if (unknownRowId) return [`붙여넣기 대상 행 ${unknownRowId}이 존재하지 않습니다.`]
    return []
  }

  requiredConfirmations(document: WorkbenchDocument): readonly string[] {
    if (this.startWorkbookRowIndex !== 0) return []
    const table = findTable(document.schema, this.tableId)
    if (!table) return []
    const confirmations = new Set<string>()
    for (let offset = 0; offset < (this.matrix[0]?.length ?? 0); offset += 1) {
      const column = table.columns[this.startColumnIndex + offset]
      const nextName = this.matrix[0]![offset]!.trim()
      if (!column || nextName === column.name) continue
      const command = new RenameColumnCommand({ tableId: table.tableId, columnId: column.columnId, nextName })
      for (const confirmation of command.describeImpact(document.schema).requiredConfirmations) confirmations.add(confirmation)
    }
    return [...confirmations]
  }

  execute(document: WorkbenchDocument): DocumentTransactionResult {
    const errors = this.validate(document)
    if (errors.length > 0) throw new Error(errors[0])
    const confirmations = this.requiredConfirmations(document)
    if (confirmations.length > 0 && !this.approved) throw new Error('영향 검토 후 붙여넣기를 승인해야 합니다.')

    const table = findTable(document.schema, this.tableId)!
    let nextSchema = document.schema
    if (this.startWorkbookRowIndex === 0) {
      for (let offset = 0; offset < (this.matrix[0]?.length ?? 0); offset += 1) {
        const column = table.columns[this.startColumnIndex + offset]!
        const nextName = this.matrix[0]![offset]!.trim()
        if (nextName !== column.name) {
          nextSchema = new RenameColumnCommand({
            tableId: table.tableId,
            columnId: column.columnId,
            nextName,
          }).preview(nextSchema)
        }
      }
    }

    const sourceDataRows = this.matrix.slice(this.startWorkbookRowIndex === 0 ? 1 : 0)
    const dataStartIndex = this.startWorkbookRowIndex === 0 ? 0 : this.startWorkbookRowIndex - 1
    const currentRows = document.rowsByTable[this.tableId] ?? []
    const nextRows = [...currentRows]
    const changedRowIds: EntityId[] = []

    sourceDataRows.forEach((sourceRow, rowOffset) => {
      let targetIndex: number
      const targetRowId = this.targetRowIds[rowOffset]
      if (targetRowId) targetIndex = nextRows.findIndex((row) => row.rowId === targetRowId)
      else targetIndex = this.targetRowIds.length > 0 ? nextRows.length : dataStartIndex + rowOffset

      while (targetIndex >= nextRows.length) nextRows.push(createEmptyDataRow())
      const targetRow = nextRows[targetIndex]!
      const nextCells = { ...targetRow.cells }
      sourceRow.forEach((value, columnOffset) => {
        const column = table.columns[this.startColumnIndex + columnOffset]
        if (column) nextCells[column.columnId] = value
      })
      nextRows[targetIndex] = { ...targetRow, cells: nextCells }
      changedRowIds.push(targetRow.rowId)
    })

    const revision = document.revision + 1
    return {
      document: {
        ...document,
        revision,
        schema: nextSchema,
        rowsByTable: sourceDataRows.length > 0
          ? { ...document.rowsByTable, [this.tableId]: nextRows }
          : document.rowsByTable,
        auditLog: [...document.auditLog, {
          auditEventId: makeId('audit'),
          revision,
          type: this.type,
          createdAt: new Date().toISOString(),
          summary: this.summary,
        }],
      },
      changedTableIds: [this.tableId],
      changedRowIds,
    }
  }

  serialize(): ApplyWorkbookRangeSerialized {
    return {
      type: 'ApplyWorkbookRange',
      transactionId: this.transactionId,
      tableId: this.tableId,
      startWorkbookRowIndex: this.startWorkbookRowIndex,
      startColumnIndex: this.startColumnIndex,
      matrix: this.matrix.map((row) => [...row]),
      targetRowIds: [...this.targetRowIds],
      approved: this.approved,
    }
  }

  static fromSerialized(serialized: ApplyWorkbookRangeSerialized, approved = serialized.approved): ApplyWorkbookRangeCommand {
    return new ApplyWorkbookRangeCommand(
      serialized.tableId,
      serialized.startWorkbookRowIndex,
      serialized.startColumnIndex,
      serialized.matrix,
      serialized.targetRowIds,
      approved,
      serialized.transactionId,
    )
  }
}

export class ReplaceWorkbookMatchesCommand implements DocumentTransaction {
  readonly type = 'ReplaceWorkbookMatches'
  readonly transactionId: EntityId
  readonly tableId: EntityId
  readonly query: string
  readonly replacement: string
  readonly approved: boolean
  readonly summary: string

  constructor(
    tableId: EntityId,
    query: string,
    replacement: string,
    approved = false,
    transactionId = makeId('transaction'),
  ) {
    this.tableId = tableId
    this.query = query
    this.replacement = replacement
    this.approved = approved
    this.transactionId = transactionId
    this.summary = `현재 테이블에서 '${query}' 모두 바꾸기`
  }

  validate(document: WorkbenchDocument): readonly string[] {
    const table = findTable(document.schema, this.tableId)
    if (!table) return [`테이블 ${this.tableId}이 존재하지 않습니다.`]
    if (!this.query) return ['찾을 값을 입력하세요.']
    if (this.matchCount(document) === 0) return ['일치하는 셀이 없습니다.']

    const nextNames = table.columns.map((column) => replaceText(column.name, this.query, this.replacement).trim())
    for (const nextName of nextNames) {
      const syntaxError = columnNameSyntaxError(nextName)
      if (syntaxError) return [syntaxError]
    }
    const normalized = nextNames.map((name) => name.toLocaleLowerCase('ko-KR'))
    const duplicateIndex = normalized.findIndex((name, index) => normalized.indexOf(name) !== index)
    return duplicateIndex >= 0 ? [`헤더 이름 ${nextNames[duplicateIndex]}이(가) 중복됩니다.`] : []
  }

  requiredConfirmations(document: WorkbenchDocument): readonly string[] {
    const table = findTable(document.schema, this.tableId)
    if (!table) return []
    const confirmations = new Set<string>()
    for (const column of table.columns) {
      const nextName = replaceText(column.name, this.query, this.replacement).trim()
      if (nextName === column.name) continue
      const command = new RenameColumnCommand({ tableId: table.tableId, columnId: column.columnId, nextName })
      for (const confirmation of command.describeImpact(document.schema).requiredConfirmations) confirmations.add(confirmation)
    }
    return [...confirmations]
  }

  matchCount(document: WorkbenchDocument): number {
    const table = findTable(document.schema, this.tableId)
    if (!table || !this.query) return 0
    let count = table.columns.filter((column) => containsText(column.name, this.query)).length
    for (const row of document.rowsByTable[this.tableId] ?? []) {
      for (const column of table.columns) {
        if (containsText(cellText(row.cells[column.columnId]), this.query)) count += 1
      }
    }
    return count
  }

  execute(document: WorkbenchDocument): DocumentTransactionResult {
    const errors = this.validate(document)
    if (errors.length > 0) throw new Error(errors[0])
    if (this.requiredConfirmations(document).length > 0 && !this.approved) {
      throw new Error('영향 검토 후 모두 바꾸기를 승인해야 합니다.')
    }

    const table = findTable(document.schema, this.tableId)!
    let nextSchema = document.schema
    for (const column of table.columns) {
      const nextName = replaceText(column.name, this.query, this.replacement).trim()
      if (nextName !== column.name) {
        nextSchema = new RenameColumnCommand({ tableId: table.tableId, columnId: column.columnId, nextName }).preview(nextSchema)
      }
    }

    const changedRowIds: EntityId[] = []
    const nextRows = (document.rowsByTable[this.tableId] ?? []).map((row) => {
      let changed = false
      const cells = { ...row.cells }
      for (const column of table.columns) {
        const current = cells[column.columnId]
        const text = cellText(current)
        if (!containsText(text, this.query)) continue
        cells[column.columnId] = replaceText(text, this.query, this.replacement)
        changed = true
      }
      if (!changed) return row
      changedRowIds.push(row.rowId)
      return { ...row, cells }
    })

    const revision = document.revision + 1
    return {
      document: {
        ...document,
        revision,
        schema: nextSchema,
        rowsByTable: { ...document.rowsByTable, [this.tableId]: nextRows },
        auditLog: [...document.auditLog, {
          auditEventId: makeId('audit'),
          revision,
          type: this.type,
          createdAt: new Date().toISOString(),
          summary: this.summary,
        }],
      },
      changedTableIds: [this.tableId],
      changedRowIds,
    }
  }

  serialize(): ReplaceWorkbookMatchesSerialized {
    return {
      type: 'ReplaceWorkbookMatches',
      transactionId: this.transactionId,
      tableId: this.tableId,
      query: this.query,
      replacement: this.replacement,
      approved: this.approved,
    }
  }

  static fromSerialized(serialized: ReplaceWorkbookMatchesSerialized, approved = serialized.approved) {
    return new ReplaceWorkbookMatchesCommand(
      serialized.tableId,
      serialized.query,
      serialized.replacement,
      approved,
      serialized.transactionId,
    )
  }
}

export function pendingDocumentTransactionFromSerialized(
  serialized: PendingDocumentTransactionSerialized,
  approved = false,
): ApplyWorkbookRangeCommand | ReplaceWorkbookMatchesCommand {
  return serialized.type === 'ApplyWorkbookRange'
    ? ApplyWorkbookRangeCommand.fromSerialized(serialized, approved)
    : ReplaceWorkbookMatchesCommand.fromSerialized(serialized, approved)
}

export class UpdateCellsCommand implements DocumentTransaction {
  readonly transactionId: EntityId
  readonly type = 'UpdateCells'
  readonly summary: string
  readonly tableId: EntityId
  readonly updates: readonly CellUpdate[]

  constructor(
    tableId: EntityId,
    updates: readonly CellUpdate[],
    transactionId = makeId('transaction'),
  ) {
    this.transactionId = transactionId
    this.tableId = tableId
    this.updates = updates
    this.summary = `${updates.length}개 셀 수정`
  }

  execute(document: WorkbenchDocument): DocumentTransactionResult {
    const table = findTable(document.schema, this.tableId)
    if (!table) throw new Error(`테이블 ${this.tableId}이 존재하지 않습니다.`)

    const validColumns = new Set(table.columns.map((column) => column.columnId))
    const rows = document.rowsByTable[this.tableId] ?? []
    const updatesByRow = new Map<EntityId, readonly CellUpdate[]>()

    for (const update of this.updates) {
      if (!validColumns.has(update.columnId)) throw new Error(`컬럼 ${update.columnId}이 존재하지 않습니다.`)
      updatesByRow.set(update.rowId, [...(updatesByRow.get(update.rowId) ?? []), update])
    }

    const existingRowIds = new Set(rows.map((row) => row.rowId))
    const missingRowId = [...updatesByRow.keys()].find((rowId) => !existingRowIds.has(rowId))
    if (missingRowId) throw new Error(`행 ${missingRowId}이 존재하지 않습니다.`)

    const nextRows = rows.map((row) => {
      const updates = updatesByRow.get(row.rowId)
      if (!updates) return row

      const nextCells = { ...row.cells }
      for (const update of updates) {
        if (update.value === undefined) delete nextCells[update.columnId]
        else nextCells[update.columnId] = update.value
      }
      return { ...row, cells: nextCells }
    })

    return commitRows(document, this.tableId, nextRows, this, [...updatesByRow.keys()])
  }
}

export class InsertRowsCommand implements DocumentTransaction {
  readonly transactionId: EntityId
  readonly type = 'InsertRows'
  readonly summary: string
  readonly tableId: EntityId
  readonly atIndex: number
  readonly rows: readonly DataRow[]

  constructor(
    tableId: EntityId,
    atIndex: number,
    rows: readonly DataRow[],
    transactionId = makeId('transaction'),
  ) {
    this.transactionId = transactionId
    this.tableId = tableId
    this.atIndex = atIndex
    this.rows = rows
    this.summary = `${rows.length}개 행 추가`
  }

  execute(document: WorkbenchDocument): DocumentTransactionResult {
    if (!findTable(document.schema, this.tableId)) throw new Error(`테이블 ${this.tableId}이 존재하지 않습니다.`)
    const current = document.rowsByTable[this.tableId] ?? []
    const existingIds = new Set(current.map((row) => row.rowId))
    const duplicateId = this.rows.find((row) => existingIds.has(row.rowId))?.rowId
    if (duplicateId) throw new Error(`행 ID ${duplicateId}이 이미 존재합니다.`)

    const index = Math.max(0, Math.min(this.atIndex, current.length))
    const nextRows = [...current.slice(0, index), ...this.rows, ...current.slice(index)]
    return commitRows(document, this.tableId, nextRows, this, this.rows.map((row) => row.rowId))
  }
}

export class DeleteRowsCommand implements DocumentTransaction {
  readonly transactionId: EntityId
  readonly type = 'DeleteRows'
  readonly summary: string
  readonly tableId: EntityId
  readonly rowIds: readonly EntityId[]

  constructor(
    tableId: EntityId,
    rowIds: readonly EntityId[],
    transactionId = makeId('transaction'),
  ) {
    this.transactionId = transactionId
    this.tableId = tableId
    this.rowIds = rowIds
    this.summary = `${rowIds.length}개 행 삭제`
  }

  execute(document: WorkbenchDocument): DocumentTransactionResult {
    if (!findTable(document.schema, this.tableId)) throw new Error(`테이블 ${this.tableId}이 존재하지 않습니다.`)
    const deleted = new Set(this.rowIds)
    const current = document.rowsByTable[this.tableId] ?? []
    const nextRows = current.filter((row) => !deleted.has(row.rowId))
    return commitRows(document, this.tableId, nextRows, this, this.rowIds)
  }
}

export class ReplaceRowsCommand implements DocumentTransaction {
  readonly transactionId: EntityId
  readonly type = 'ReplaceRows'
  readonly summary: string
  readonly tableId: EntityId
  readonly rows: readonly DataRow[]

  constructor(
    tableId: EntityId,
    rows: readonly DataRow[],
    summary = `${rows.length}개 행 가져오기`,
    transactionId = makeId('transaction'),
  ) {
    this.transactionId = transactionId
    this.tableId = tableId
    this.rows = rows
    this.summary = summary
  }

  execute(document: WorkbenchDocument): DocumentTransactionResult {
    const table = findTable(document.schema, this.tableId)
    if (!table) throw new Error(`테이블 ${this.tableId}이 존재하지 않습니다.`)

    const validColumns = new Set(table.columns.map((column) => column.columnId))
    for (const row of this.rows) {
      const invalidColumnId = Object.keys(row.cells).find((columnId) => !validColumns.has(columnId))
      if (invalidColumnId) throw new Error(`컬럼 ${invalidColumnId}이 존재하지 않습니다.`)
    }

    return commitRows(document, this.tableId, this.rows, this, this.rows.map((row) => row.rowId))
  }
}

export class MoveRowsCommand implements DocumentTransaction {
  readonly transactionId: EntityId
  readonly type = 'MoveRows'
  readonly summary: string
  readonly tableId: EntityId
  readonly rowIds: readonly EntityId[]
  readonly targetIndex: number

  constructor(
    tableId: EntityId,
    rowIds: readonly EntityId[],
    targetIndex: number,
    transactionId = makeId('transaction'),
  ) {
    this.transactionId = transactionId
    this.tableId = tableId
    this.rowIds = rowIds
    this.targetIndex = targetIndex
    this.summary = `${rowIds.length}개 행 순서 이동`
  }

  execute(document: WorkbenchDocument): DocumentTransactionResult {
    if (!findTable(document.schema, this.tableId)) throw new Error(`테이블 ${this.tableId}이 존재하지 않습니다.`)
    const current = document.rowsByTable[this.tableId] ?? []
    const moving = new Set(this.rowIds)
    const moved = current.filter((row) => moving.has(row.rowId))
    if (moved.length === 0) return commitRows(document, this.tableId, current, this, [])

    // targetIndex는 이동 전 배열 기준. 이동될 행들을 뺀 뒤 삽입 지점을 보정한다.
    const removedBeforeTarget = current.slice(0, this.targetIndex).filter((row) => moving.has(row.rowId)).length
    const remaining = current.filter((row) => !moving.has(row.rowId))
    const insertAt = Math.max(0, Math.min(this.targetIndex - removedBeforeTarget, remaining.length))
    const nextRows = [...remaining.slice(0, insertAt), ...moved, ...remaining.slice(insertAt)]
    return commitRows(document, this.tableId, nextRows, this, this.rowIds)
  }
}

function commitRows(
  document: WorkbenchDocument,
  tableId: EntityId,
  rows: readonly DataRow[],
  transaction: DocumentTransaction,
  changedRowIds: readonly EntityId[],
): DocumentTransactionResult {
  const revision = document.revision + 1
  return {
    document: {
      ...document,
      revision,
      rowsByTable: { ...document.rowsByTable, [tableId]: rows },
      auditLog: [
        ...document.auditLog,
        {
          auditEventId: makeId('audit'),
          revision,
          type: transaction.type,
          createdAt: new Date().toISOString(),
          summary: transaction.summary,
        },
      ],
    },
    changedTableIds: [tableId],
    changedRowIds,
  }
}

function cellText(value: CellValue | undefined): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function containsText(value: string, query: string): boolean {
  return value.toLocaleLowerCase('ko-KR').includes(query.toLocaleLowerCase('ko-KR'))
}

function replaceText(value: string, query: string, replacement: string): string {
  return value.replace(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu'), replacement)
}
