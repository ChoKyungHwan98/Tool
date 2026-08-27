import type { CellValue, EntityId, RowsByTable, SchemaColumn, SchemaProject } from '../../../domain/schema'
import { selectionRange, type CellRange, type GridCellPosition, type GridEditEntryMode, type WorkbookPointerRegion } from '../../gridTypes'

export const ROW_HEIGHT = 34
export const COLUMN_LETTER_HEIGHT = 22
export const FIELD_HEADER_HEIGHT = 36
export const HEADER_HEIGHT = COLUMN_LETTER_HEIGHT + FIELD_HEADER_HEIGHT
export const ROW_HEADER_WIDTH = 48
export const GHOST_COLUMN_WIDTH = 120
export const WORKBOOK_VIRTUAL_ROW_COUNT = 100_000

export interface WorkbookMatch {
  readonly kind: 'schema' | 'data'
  readonly position: GridCellPosition
  readonly columnId: EntityId
  readonly rowId?: EntityId
}

export interface CutSelection {
  readonly tableId: EntityId
  readonly range: ReturnType<typeof selectionRange>
  readonly matrix: readonly (readonly string[])[]
  readonly sourceCells: readonly { readonly rowId: EntityId; readonly columnId: EntityId }[]
}

export interface PointerSelectionDrag {
  readonly pointerId: number
  readonly region: WorkbookPointerRegion
  readonly anchor: GridCellPosition
  moved: boolean
}

export interface PendingVirtualEdit {
  readonly position: GridCellPosition
  readonly mode: GridEditEntryMode
  readonly seedText?: string
}

export interface FillPreview {
  readonly range: CellRange
  readonly value: string
  readonly mode: 'series' | 'copy'
}

/** A second pointer gesture on the active range moves data instead of selecting it. */
export type GridDragGesture =
  | { readonly kind: 'move-cells'; readonly pointerId: number; readonly source: CellRange; moved: boolean }
  | { readonly kind: 'move-rows'; readonly pointerId: number; readonly rowIds: readonly EntityId[]; readonly sourceIndex: number; moved: boolean }

export function transposeClipboardMatrix(matrix: readonly (readonly string[])[]): readonly (readonly string[])[] {
  const width = Math.max(0, ...matrix.map((row) => row.length))
  return Array.from({ length: width }, (_, columnIndex) => matrix.map((row) => row[columnIndex] ?? ''))
}

export function parseWorkbookAddress(address: string): GridCellPosition | null {
  const match = /^([A-Za-z]+)([1-9]\d*)$/.exec(address.trim())
  if (!match) return null
  let columnIndex = 0
  for (const character of match[1]!.toUpperCase()) columnIndex = columnIndex * 26 + character.charCodeAt(0) - 64
  return { rowIndex: Number(match[2]) - 1, columnIndex: columnIndex - 1 }
}

export function cellText(value: CellValue | undefined): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function columnFilterSuggestions(project: SchemaProject, column: SchemaColumn): readonly string[] {
  const dataType = column.dataType
  if (dataType.kind === 'boolean') return ['true', 'false']
  if (dataType.kind !== 'enum') return []
  return project.enums.find((schemaEnum) => schemaEnum.enumId === dataType.enumId)?.values.map((value) => value.name) ?? []
}

export function columnEditorOptions(
  project: SchemaProject,
  rowsByTable: RowsByTable,
  tableId: EntityId,
  column: SchemaColumn,
): { readonly options: readonly string[]; readonly strictChoice: boolean } {
  if (column.dataType.kind === 'boolean') return { options: ['true', 'false'], strictChoice: false }
  if (column.dataType.kind === 'enum') {
    const enumId = column.dataType.enumId
    const values = project.enums.find((schemaEnum) => schemaEnum.enumId === enumId)?.values.map((value) => value.name) ?? []
    return { options: values, strictChoice: false }
  }
  const relation = project.relations.find((candidate) => (
    candidate.kind === 'hard_fk'
    && candidate.sourceTableId === tableId
    && candidate.sourceColumnIds.length === 1
    && candidate.targetColumnIds.length === 1
    && candidate.sourceColumnIds[0] === column.columnId
  ))
  if (!relation) return { options: [], strictChoice: false }
  const targetColumnId = relation.targetColumnIds[0]!
  const options = [...new Set((rowsByTable[relation.targetTableId] ?? []).map((row) => cellText(row.cells[targetColumnId])).filter(Boolean))]
  return { options, strictChoice: false }
}
