import { describe, expect, it } from 'vitest'
import { createColumn } from '../domain/schemaFactories'
import { matchesWorkbookFilter, nextFillValues, replaceWorkbookText, validateCellInput } from './workbookGridOperations'

describe('workbook grid operations', () => {
  it('filters text, numeric ranges, and selected values', () => {
    expect(matchesWorkbookFilter('LegendarySword', { columnId: 'c', operator: 'contains', value: 'sword' }, 'string')).toBe(true)
    expect(matchesWorkbookFilter('15', { columnId: 'c', operator: 'between', value: '10', secondValue: '20' }, 'int32')).toBe(true)
    expect(matchesWorkbookFilter('Rare', { columnId: 'c', operator: 'one_of', values: ['Common', 'Rare'] }, 'enum')).toBe(true)
  })

  it('continues numeric and ISO date series and repeats text patterns', () => {
    expect(nextFillValues(['10', '20'], 3)).toEqual(['30', '40', '50'])
    expect(nextFillValues(['2026-01-01', '2026-01-03'], 2)).toEqual(['2026-01-05', '2026-01-07'])
    expect(nextFillValues(['A', 'B'], 3)).toEqual(['A', 'B', 'A'])
  })

  it('replaces all case-insensitive workbook matches', () => {
    expect(replaceWorkbookText('ItemId_itemid', 'itemid', 'Key')).toBe('Key_Key')
  })

  it('blocks invalid required, numeric, date, and enum input before saving', () => {
    const numberColumn = createColumn({ tableId: 'table', name: 'Level', dataType: { kind: 'int32' }, nullable: false })
    const dateColumn = createColumn({ tableId: 'table', name: 'StartDate', dataType: { kind: 'date' }, nullable: true })
    const enumColumn = createColumn({ tableId: 'table', name: 'Grade', dataType: { kind: 'enum', enumId: 'grade' }, nullable: false })

    expect(validateCellInput(numberColumn, '')).toContain('필수값')
    expect(validateCellInput(numberColumn, '1.5')).toContain('정수')
    expect(validateCellInput(dateColumn, '2026-99-10')).toContain('YYYY-MM-DD')
    expect(validateCellInput(enumColumn, 'Legend', ['Common', 'Rare'])).toContain('목록')
    expect(validateCellInput(enumColumn, 'Rare', ['Common', 'Rare'])).toBeNull()
  })
})
