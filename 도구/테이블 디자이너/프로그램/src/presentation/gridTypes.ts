export interface GridCellPosition {
  readonly rowIndex: number
  readonly columnIndex: number
}

export interface WorkbookCoordinate extends GridCellPosition {
  readonly rowKind: 'schema' | 'data'
  readonly dataRowIndex: number | null
}

export interface WorkbookDisplayRow {
  readonly displayIndex: number
  readonly kind: 'schema' | 'data' | 'append' | 'ghost'
  readonly dataRowIndex: number | null
}

export interface WorkbookDisplayColumn {
  readonly displayIndex: number
  readonly kind: 'data' | 'append' | 'ghost'
  readonly columnId: string | null
}

export interface WorkbookViewportMetrics {
  readonly width: number
  readonly height: number
  readonly ghostRowCount: number
  readonly ghostColumnCount: number
}

export interface WorkbookDisplayColumnMetric {
  readonly displayIndex: number
  readonly start: number
  readonly size: number
}

export type WorkbookPointerRegion = 'cell' | 'row-header' | 'column-header' | 'corner'

export interface WorkbookPointerTarget {
  readonly region: WorkbookPointerRegion
  readonly position: GridCellPosition
}

export function workbookVirtualEditExpansion(
  position: GridCellPosition,
  authoredColumnCount: number,
  dataRowCount: number,
): { readonly columnsToCreate: number; readonly rowsToCreate: number } {
  const appendRowIndex = dataRowCount + 1
  return {
    columnsToCreate: position.columnIndex > authoredColumnCount
      ? position.columnIndex - authoredColumnCount + 1
      : 0,
    rowsToCreate: position.rowIndex > appendRowIndex
      ? position.rowIndex - dataRowCount
      : 0,
  }
}

export function workbookPointerTarget(
  point: { readonly x: number; readonly y: number },
  geometry: {
    readonly rowHeaderWidth: number
    readonly columnLetterHeight: number
    readonly headerHeight: number
    readonly rowHeight: number
    readonly displayRowCount: number
    readonly columns: readonly WorkbookDisplayColumnMetric[]
  },
): WorkbookPointerTarget | null {
  if (point.x < 0 || point.y < 0) return null
  const contentX = point.x - geometry.rowHeaderWidth
  const column = contentX >= 0
    ? geometry.columns.find((candidate) => contentX >= candidate.start && contentX < candidate.start + candidate.size)
    : null

  if (point.y < geometry.columnLetterHeight) {
    if (contentX < 0) return { region: 'corner', position: { rowIndex: 0, columnIndex: 0 } }
    return column ? { region: 'column-header', position: { rowIndex: 0, columnIndex: column.displayIndex } } : null
  }

  if (point.y < geometry.headerHeight) {
    if (contentX < 0) return { region: 'row-header', position: { rowIndex: 0, columnIndex: 0 } }
    return column ? { region: 'cell', position: { rowIndex: 0, columnIndex: column.displayIndex } } : null
  }

  const rowIndex = Math.floor((point.y - geometry.headerHeight) / geometry.rowHeight) + 1
  if (rowIndex >= geometry.displayRowCount) return null
  if (contentX < 0) return { region: 'row-header', position: { rowIndex, columnIndex: 0 } }
  return column ? { region: 'cell', position: { rowIndex, columnIndex: column.displayIndex } } : null
}

export function calculateWorkbookViewportMetrics({
  width,
  height,
  authoredWidth,
  authoredRowCount,
  rowHeaderWidth,
  headerHeight,
  rowHeight,
  ghostColumnWidth,
}: {
  readonly width: number
  readonly height: number
  readonly authoredWidth: number
  readonly authoredRowCount: number
  readonly rowHeaderWidth: number
  readonly headerHeight: number
  readonly rowHeight: number
  readonly ghostColumnWidth: number
}): WorkbookViewportMetrics {
  const contentWidth = Math.max(0, width - rowHeaderWidth)
  const contentHeight = Math.max(0, height - headerHeight)
  const appendInclusiveWidth = authoredWidth + ghostColumnWidth
  const appendInclusiveHeight = (authoredRowCount + 1) * rowHeight
  return {
    width,
    height,
    ghostColumnCount: Math.max(0, Math.ceil((contentWidth - appendInclusiveWidth) / ghostColumnWidth)),
    ghostRowCount: Math.max(0, Math.ceil((contentHeight - appendInclusiveHeight) / rowHeight)),
  }
}

export function workbookCoordinate(rowIndex: number, columnIndex: number): WorkbookCoordinate {
  return {
    rowIndex,
    columnIndex,
    rowKind: rowIndex === 0 ? 'schema' : 'data',
    dataRowIndex: rowIndex === 0 ? null : rowIndex - 1,
  }
}

export interface GridSelection {
  readonly anchor: GridCellPosition
  readonly focus: GridCellPosition
}

export type GridEditEntryMode = 'replace' | 'preserve'

export interface GridEditSession {
  readonly position: GridCellPosition
  readonly mode: GridEditEntryMode
  readonly seedText?: string
}

export interface CellRange {
  readonly startRow: number
  readonly endRow: number
  readonly startColumn: number
  readonly endColumn: number
}

export type ClipboardMatrix = readonly (readonly string[])[]

export function selectionRange(selection: GridSelection): CellRange {
  return {
    startRow: Math.min(selection.anchor.rowIndex, selection.focus.rowIndex),
    endRow: Math.max(selection.anchor.rowIndex, selection.focus.rowIndex),
    startColumn: Math.min(selection.anchor.columnIndex, selection.focus.columnIndex),
    endColumn: Math.max(selection.anchor.columnIndex, selection.focus.columnIndex),
  }
}

export function parseClipboardMatrix(text: string): ClipboardMatrix {
  return text.replace(/\r\n?/g, '\n').split('\n').filter((row, index, rows) => row.length > 0 || index < rows.length - 1).map((row) => row.split('\t'))
}

export function columnIndexToLabel(columnIndex: number): string {
  if (!Number.isInteger(columnIndex) || columnIndex < 0) throw new RangeError('Column index must be a non-negative integer.')

  let value = columnIndex + 1
  let label = ''
  while (value > 0) {
    value -= 1
    label = String.fromCharCode(65 + (value % 26)) + label
    value = Math.floor(value / 26)
  }
  return label
}

export function cellAddress(position: GridCellPosition): string {
  return `${columnIndexToLabel(position.columnIndex)}${position.rowIndex + 1}`
}
