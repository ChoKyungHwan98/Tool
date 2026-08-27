import { describe, expect, it } from 'vitest'
import { calculateWorkbookViewportMetrics, cellAddress, columnIndexToLabel, selectionRange, workbookCoordinate, workbookPointerTarget, workbookVirtualEditExpansion } from './gridTypes'

describe('Excel-style grid coordinates', () => {
  it.each([
    [0, 'A'],
    [25, 'Z'],
    [26, 'AA'],
    [51, 'AZ'],
    [52, 'BA'],
    [701, 'ZZ'],
    [702, 'AAA'],
  ])('formats column %i as %s', (index, label) => {
    expect(columnIndexToLabel(index)).toBe(label)
  })

  it('rejects invalid column indexes', () => {
    expect(() => columnIndexToLabel(-1)).toThrow(RangeError)
    expect(() => columnIndexToLabel(1.5)).toThrow(RangeError)
  })

  it('formats a selected cell address', () => {
    expect(cellAddress({ rowIndex: 11, columnIndex: 27 })).toBe('AB12')
  })

  it('maps workbook row 1 to schema and row 2 to the first data record', () => {
    expect(workbookCoordinate(0, 0)).toEqual({ rowIndex: 0, columnIndex: 0, rowKind: 'schema', dataRowIndex: null })
    expect(workbookCoordinate(1, 0)).toEqual({ rowIndex: 1, columnIndex: 0, rowKind: 'data', dataRowIndex: 0 })
  })

  it('normalizes reverse drag selections', () => {
    expect(selectionRange({
      anchor: { rowIndex: 8, columnIndex: 4 },
      focus: { rowIndex: 2, columnIndex: 1 },
    })).toEqual({ startRow: 2, endRow: 8, startColumn: 1, endColumn: 4 })
  })

  it('calculates display-only rows and columns without changing the authored range', () => {
    const metrics = calculateWorkbookViewportMetrics({
      width: 900,
      height: 600,
      authoredWidth: 320,
      authoredRowCount: 0,
      rowHeaderWidth: 48,
      headerHeight: 58,
      rowHeight: 34,
      ghostColumnWidth: 120,
    })

    expect(metrics.ghostColumnCount).toBe(4)
    expect(metrics.ghostRowCount).toBe(15)
  })

  it('maps display-only empty cells and headers to selectable workbook coordinates', () => {
    const geometry = {
      rowHeaderWidth: 48,
      columnLetterHeight: 22,
      headerHeight: 58,
      rowHeight: 34,
      displayRowCount: 18,
      columns: [
        { displayIndex: 0, start: 0, size: 160 },
        { displayIndex: 1, start: 160, size: 120 },
        { displayIndex: 2, start: 280, size: 120 },
      ],
    }

    expect(workbookPointerTarget({ x: 48 + 340, y: 58 + 34 * 10 + 4 }, geometry)).toEqual({
      region: 'cell',
      position: { rowIndex: 11, columnIndex: 2 },
    })
    expect(workbookPointerTarget({ x: 48 + 340, y: 8 }, geometry)).toEqual({
      region: 'column-header',
      position: { rowIndex: 0, columnIndex: 2 },
    })
    expect(workbookPointerTarget({ x: 20, y: 58 + 34 * 10 + 4 }, geometry)).toEqual({
      region: 'row-header',
      position: { rowIndex: 11, columnIndex: 0 },
    })
  })

  it('expands authored rows and columns up to a typed ghost cell', () => {
    expect(workbookVirtualEditExpansion(
      { rowIndex: 0, columnIndex: 5 },
      1,
      0,
    )).toEqual({ columnsToCreate: 5, rowsToCreate: 0 })

    expect(workbookVirtualEditExpansion(
      { rowIndex: 8, columnIndex: 4 },
      3,
      5,
    )).toEqual({ columnsToCreate: 2, rowsToCreate: 3 })

    expect(workbookVirtualEditExpansion(
      { rowIndex: 6, columnIndex: 3 },
      3,
      5,
    )).toEqual({ columnsToCreate: 0, rowsToCreate: 0 })
  })
})
