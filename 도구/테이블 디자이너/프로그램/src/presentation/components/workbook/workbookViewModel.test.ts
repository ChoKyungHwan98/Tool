import { describe, expect, it } from 'vitest'
import {
  cellText,
  parseWorkbookAddress,
  transposeClipboardMatrix,
} from './workbookViewModel'

describe('workbook view model', () => {
  it.each([
    ['A1', { rowIndex: 0, columnIndex: 0 }],
    ['z9', { rowIndex: 8, columnIndex: 25 }],
    ['AA12', { rowIndex: 11, columnIndex: 26 }],
  ])('parses %s as a workbook position', (address, position) => {
    expect(parseWorkbookAddress(address)).toEqual(position)
  })

  it.each(['', 'A0', '0A', 'A-1', 'A 1'])('rejects invalid workbook address %j', (address) => {
    expect(parseWorkbookAddress(address)).toBeNull()
  })

  it('transposes ragged clipboard rows without losing empty cells', () => {
    expect(transposeClipboardMatrix([
      ['A', 'B', 'C'],
      ['1'],
    ])).toEqual([
      ['A', '1'],
      ['B', ''],
      ['C', ''],
    ])
  })

  it('normalizes cell values for workbook display and filtering', () => {
    expect(cellText(undefined)).toBe('')
    expect(cellText(null)).toBe('')
    expect(cellText(false)).toBe('false')
    expect(cellText({ x: 1 })).toBe('{"x":1}')
  })
})
