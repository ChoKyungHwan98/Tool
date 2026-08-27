import { describe, expect, it } from 'vitest'
import {
  pointerToGridPosition,
  pointerToRowInsertionIndex,
  edgeAutoScroll,
  computeMoveTarget,
  moveUpdates,
  fillValuesDirectional,
  copyFillValuesDirectional,
  autofillExtent,
  type GridGeometry,
} from './gridDragOperations'
import type { CellRange } from './gridTypes'

const geometry: GridGeometry = {
  rowHeaderWidth: 48,
  headerHeight: 58,
  rowHeight: 34,
  scrollLeft: 0,
  scrollTop: 0,
  viewportLeft: 0,
  viewportTop: 0,
  columnStarts: [0, 160, 320], // 3열, 각 폭 160
  columnCount: 3,
  rowCount: 5, // 데이터 행 수
}

describe('pointerToGridPosition', () => {
  it('헤더 영역 안의 포인터는 스키마 행(0)을 가리킨다', () => {
    expect(pointerToGridPosition(60, 40, geometry)).toEqual({ rowIndex: 0, columnIndex: 0 })
  })

  it('데이터 첫 행 첫 열', () => {
    // x=60 → 열0, y=58+1 → 데이터 행 인덱스0 → workbook rowIndex 1
    expect(pointerToGridPosition(60, 59, geometry)).toEqual({ rowIndex: 1, columnIndex: 0 })
  })

  it('두 번째 열을 좌표로 찾는다', () => {
    expect(pointerToGridPosition(210, 59, geometry).columnIndex).toBe(1)
  })

  it('스크롤 오프셋을 반영한다', () => {
    const scrolled = { ...geometry, scrollTop: 34 }
    // 한 행 스크롤된 상태에서 y=59는 데이터 행 인덱스1 → rowIndex 2
    expect(pointerToGridPosition(60, 59, scrolled).rowIndex).toBe(2)
  })

  it('가로 스크롤 오프셋을 반영한다', () => {
    const scrolled = { ...geometry, scrollLeft: 160 }
    // 스크롤 없이는 열0(contentX=12)이지만, 160px 가로 스크롤되면 열1(contentX=172)로 해석된다
    expect(pointerToGridPosition(60, 59, scrolled).columnIndex).toBe(1)
  })

  it('행헤더 위(x<rowHeaderWidth)면 columnIndex는 0으로 클램프', () => {
    expect(pointerToGridPosition(10, 59, geometry).columnIndex).toBe(0)
  })

  it('마지막 행을 넘어가면 마지막 데이터 행으로 클램프', () => {
    expect(pointerToGridPosition(60, 9999, geometry).rowIndex).toBe(5)
  })

  it('마지막 열을 넘어가면 마지막 열로 클램프', () => {
    expect(pointerToGridPosition(9999, 59, geometry).columnIndex).toBe(2)
  })
})

describe('pointerToRowInsertionIndex', () => {
  const metrics = { headerHeight: 58, rowHeight: 34, rowCount: 5 }

  it('첫 행 위쪽에 놓으면 0', () => {
    expect(pointerToRowInsertionIndex(58, metrics)).toBe(0)
  })

  it('첫 행 한가운데를 넘기면 다음 경계(1)로 붙는다', () => {
    expect(pointerToRowInsertionIndex(58 + 20, metrics)).toBe(1)
  })

  it('마지막 행 아래에 놓으면 rowCount가 나와 맨 끝으로 이동할 수 있다', () => {
    expect(pointerToRowInsertionIndex(9999, metrics)).toBe(metrics.rowCount)
  })

  it('헤더 위쪽 음수 영역은 0으로 클램프한다', () => {
    expect(pointerToRowInsertionIndex(0, metrics)).toBe(0)
  })
})

describe('edgeAutoScroll', () => {
  const rect = { left: 0, top: 0, right: 400, bottom: 300 }
  it('오른쪽 가장자리에서 양수 dx', () => {
    expect(edgeAutoScroll(395, 150, rect).dx).toBeGreaterThan(0)
  })
  it('왼쪽 가장자리에서 음수 dx', () => {
    expect(edgeAutoScroll(5, 150, rect).dx).toBeLessThan(0)
  })
  it('아래 가장자리에서 양수 dy', () => {
    expect(edgeAutoScroll(200, 296, rect).dy).toBeGreaterThan(0)
  })
  it('중앙에서는 0', () => {
    expect(edgeAutoScroll(200, 150, rect)).toEqual({ dx: 0, dy: 0 })
  })
})

describe('computeMoveTarget', () => {
  const bounds = { rowCount: 5, columnCount: 3 } // 데이터 행 5, 열 3
  const source: CellRange = { startRow: 1, endRow: 2, startColumn: 0, endColumn: 1 } // 2x2

  it('드롭 지점을 좌상단으로 같은 크기 범위를 만든다', () => {
    expect(computeMoveTarget(source, { rowIndex: 3, columnIndex: 1 }, bounds)).toEqual({
      startRow: 3, endRow: 4, startColumn: 1, endColumn: 2,
    })
  })

  it('격자 아래 경계를 넘으면 위로 클램프한다', () => {
    expect(computeMoveTarget(source, { rowIndex: 5, columnIndex: 2 }, bounds)).toEqual({
      startRow: 4, endRow: 5, startColumn: 1, endColumn: 2,
    })
  })

  it('스키마 행(0)으로는 드롭할 수 없어 1행으로 클램프', () => {
    expect(computeMoveTarget(source, { rowIndex: 0, columnIndex: 0 }, bounds).startRow).toBe(1)
  })

  it('드래그 도중 그리드가 소스보다 작게 줄어도 endRow/endColumn이 경계를 넘지 않는다', () => {
    const shrunkenBounds = { rowCount: 2, columnCount: 2 }
    const bigSource: CellRange = { startRow: 1, endRow: 4, startColumn: 0, endColumn: 2 } // 3행 x 3열, bounds보다 큼
    const result = computeMoveTarget(bigSource, { rowIndex: 1, columnIndex: 0 }, shrunkenBounds)
    expect(result.startRow).toBeGreaterThanOrEqual(1)
    expect(result.endRow).toBeLessThanOrEqual(shrunkenBounds.rowCount)
    expect(result.startColumn).toBeGreaterThanOrEqual(0)
    expect(result.endColumn).toBeLessThanOrEqual(shrunkenBounds.columnCount - 1)
  })
})

describe('moveUpdates', () => {
  it('원본을 비우고 대상에 값을 채운다', () => {
    const updates = moveUpdates(
      [{ rowId: 'r1', columnId: 'c1', value: 'x' }],
      [{ rowId: 'r2', columnId: 'c1', value: 'x' }],
    )
    expect(updates).toContainEqual({ rowId: 'r1', columnId: 'c1', value: '' })
    expect(updates).toContainEqual({ rowId: 'r2', columnId: 'c1', value: 'x' })
  })

  it('원본과 대상이 겹치는 셀은 비우기를 덮어쓰지 않는다', () => {
    const updates = moveUpdates(
      [{ rowId: 'r1', columnId: 'c1', value: 'x' }],
      [{ rowId: 'r1', columnId: 'c1', value: 'x' }],
    )
    const forCell = updates.filter((u) => u.rowId === 'r1' && u.columnId === 'c1')
    expect(forCell).toHaveLength(1)
    expect(forCell[0]!.value).toBe('x')
  })
})

describe('fillValuesDirectional', () => {
  it('아래 방향은 nextFillValues와 동일(증가 수열)', () => {
    expect(fillValuesDirectional(['1', '2'], 2, 'down')).toEqual(['3', '4'])
  })
  it('위 방향은 역방향 수열', () => {
    // 소스 [1,2]를 위로 2칸: 위로 갈수록 0, -1
    expect(fillValuesDirectional(['1', '2'], 2, 'up')).toEqual(['0', '-1'])
  })
  it('오른쪽 방향 단일값 반복', () => {
    expect(fillValuesDirectional(['x'], 3, 'right')).toEqual(['x', 'x', 'x'])
  })
  it('왼쪽 방향도 위 방향과 같은 역방향 수열 경로를 탄다', () => {
    expect(fillValuesDirectional(['1', '2'], 2, 'left')).toEqual(['0', '-1'])
  })
})

describe('copyFillValuesDirectional', () => {
  it('Ctrl 채우기는 수열 계산 대신 원본 패턴을 반복한다', () => {
    expect(copyFillValuesDirectional(['1', '2'], 5, 'down')).toEqual(['1', '2', '1', '2', '1'])
  })

  it('위와 왼쪽 방향은 가까운 끝값부터 역순 패턴을 반복한다', () => {
    expect(copyFillValuesDirectional(['1', '2'], 3, 'up')).toEqual(['2', '1', '2'])
    expect(copyFillValuesDirectional(['A', 'B'], 3, 'left')).toEqual(['B', 'A', 'B'])
  })
})

describe('autofillExtent', () => {
  it('인접 열이 채워진 마지막 행까지의 개수를 센다', () => {
    // 인접 열 값들(현재 선택 아래 행부터): ['a','b','', 'c'] → 연속 2개
    expect(autofillExtent(['a', 'b', '', 'c'])).toBe(2)
  })
  it('인접 열이 비면 0', () => {
    expect(autofillExtent(['', ''])).toBe(0)
  })
})
