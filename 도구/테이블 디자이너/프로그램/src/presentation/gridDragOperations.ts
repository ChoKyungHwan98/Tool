import type { CellRange, GridCellPosition } from './gridTypes'
import { nextFillValues } from './workbookGridOperations'

export interface GridGeometry {
  readonly rowHeaderWidth: number
  readonly headerHeight: number
  readonly rowHeight: number
  readonly scrollLeft: number
  readonly scrollTop: number
  readonly viewportLeft: number
  readonly viewportTop: number
  readonly columnStarts: readonly number[] // 각 표시 열의 시작 x(열 콘텐츠 좌표계)
  readonly columnCount: number
  readonly rowCount: number // 데이터 행 수(스키마/추가 행 제외)
}

const EDGE = 24
const EDGE_SPEED = 18

export function pointerToGridPosition(clientX: number, clientY: number, geo: GridGeometry): GridCellPosition {
  const localX = clientX - geo.viewportLeft
  const localY = clientY - geo.viewportTop

  // 열: 행헤더 이후 콘텐츠 좌표 + 스크롤
  const contentX = localX - geo.rowHeaderWidth + geo.scrollLeft
  let columnIndex = 0
  if (localX >= geo.rowHeaderWidth) {
    columnIndex = geo.columnCount - 1
    for (let index = 0; index < geo.columnStarts.length; index += 1) {
      const start = geo.columnStarts[index]!
      const end = index + 1 < geo.columnStarts.length ? geo.columnStarts[index + 1]! : Infinity
      if (contentX >= start && contentX < end) { columnIndex = index; break }
    }
  }
  columnIndex = Math.max(0, Math.min(geo.columnCount - 1, columnIndex))

  // 행: 헤더 아래는 데이터 행. 헤더 안이면 스키마 행(0).
  let rowIndex: number
  if (localY < geo.headerHeight) {
    rowIndex = 0
  } else {
    const contentY = localY - geo.headerHeight + geo.scrollTop
    const dataRowIndex = Math.floor(contentY / geo.rowHeight)
    rowIndex = Math.max(1, Math.min(geo.rowCount, dataRowIndex + 1))
  }
  return { rowIndex, columnIndex }
}

/**
 * 행 사이 경계를 기준으로 한 삽입 위치(0..rowCount)를 돌려준다.
 * 행 한가운데를 넘겨 놓으면 다음 경계로 붙으므로, 마지막 행 아래에 놓으면
 * rowCount가 나와 "맨 끝으로 이동"이 가능하다.
 */
export function pointerToRowInsertionIndex(
  localY: number,
  metrics: { readonly headerHeight: number; readonly rowHeight: number; readonly rowCount: number },
): number {
  const contentY = localY - metrics.headerHeight
  return Math.max(0, Math.min(metrics.rowCount, Math.round(contentY / metrics.rowHeight)))
}

export function edgeAutoScroll(
  clientX: number,
  clientY: number,
  rect: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number },
): { readonly dx: number; readonly dy: number } {
  let dx = 0
  let dy = 0
  if (clientX > rect.right - EDGE) dx = EDGE_SPEED
  else if (clientX < rect.left + EDGE) dx = -EDGE_SPEED
  if (clientY > rect.bottom - EDGE) dy = EDGE_SPEED
  else if (clientY < rect.top + EDGE) dy = -EDGE_SPEED
  return { dx, dy }
}

export interface MoveCell {
  readonly rowId: string
  readonly columnId: string
  readonly value: string
}

export function computeMoveTarget(
  source: CellRange,
  drop: GridCellPosition,
  bounds: { readonly rowCount: number; readonly columnCount: number },
): CellRange {
  const height = source.endRow - source.startRow
  const width = source.endColumn - source.startColumn
  // 데이터 행만 대상: 최소 1행, 최대 rowCount
  const startRow = Math.max(1, Math.min(drop.rowIndex, bounds.rowCount - height))
  const startColumn = Math.max(0, Math.min(drop.columnIndex, bounds.columnCount - 1 - width))
  // 드래그 도중 그리드가 줄어들면(bounds.rowCount - height < 1 등) startRow/startColumn이
  // 다시 위로 밀려 올라가 endRow/endColumn이 경계를 넘을 수 있으므로 끝점도 별도로 클램프한다.
  const endRow = Math.min(startRow + height, bounds.rowCount)
  const endColumn = Math.min(startColumn + width, bounds.columnCount - 1)
  return { startRow, endRow, startColumn, endColumn }
}

export function moveUpdates(source: readonly MoveCell[], target: readonly MoveCell[]): readonly MoveCell[] {
  const byCell = new Map<string, MoveCell>()
  for (const cell of source) byCell.set(`${cell.rowId}:${cell.columnId}`, { ...cell, value: '' })
  for (const cell of target) byCell.set(`${cell.rowId}:${cell.columnId}`, cell) // 대상이 비우기를 이긴다
  return [...byCell.values()]
}

export type FillDirection = 'up' | 'down' | 'left' | 'right'

/**
 * 방향별 자동 채우기 값을 계산한다.
 *
 * 반환 순서 규약: `result[0]`이 소스에 가장 가까운 값이고, 인덱스가 커질수록 소스에서
 * 멀어진다(모든 방향 공통). 호출부(UI)는 up/left에서 `result[offset]`을
 * `src.start - offset - 1` 위치에 배치해 소스로부터의 거리 순서를 화면 좌표로 뒤집는다.
 * down/right는 `nextFillValues`를 그대로 통과시키고, up/left는 소스를 뒤집어
 * `nextFillValues`에 넘겨 반대 방향 수열을 얻는다(출력은 다시 뒤집지 않는다).
 */
export function fillValuesDirectional(source: readonly string[], count: number, direction: FillDirection): readonly string[] {
  if (direction === 'down' || direction === 'right') return nextFillValues(source, count)
  const reversed = [...source].reverse()
  return nextFillValues(reversed, count)
}

export function copyFillValuesDirectional(source: readonly string[], count: number, direction: FillDirection): readonly string[] {
  if (source.length === 0 || count <= 0) return []
  const ordered = direction === 'down' || direction === 'right' ? source : [...source].reverse()
  return Array.from({ length: count }, (_, index) => ordered[index % ordered.length] ?? '')
}

export function autofillExtent(neighborValues: readonly string[]): number {
  let count = 0
  for (const value of neighborValues) {
    if (value.trim() === '') break
    count += 1
  }
  return count
}
