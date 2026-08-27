import { describe, expect, it } from 'vitest'
import { matchesWorkbookFilter, nextFillValues, replaceWorkbookText } from './workbookGridOperations'

const values = Array.from({ length: 10_000 }, (_, index) => `item_${index}`)

describe('10,000-row workbook operation performance', () => {
  it('filters typed values within the interactive budget', () => {
    const startedAt = performance.now()
    const filtered = values.filter((value) => matchesWorkbookFilter(
      value,
      { columnId: 'column_id', operator: 'contains', value: '999' },
      'string',
    ))
    const elapsed = performance.now() - startedAt

    expect(filtered).toContain('item_9999')
    expect(elapsed).toBeLessThan(100)
  })

  it('finds and replaces visible values within the interactive budget', () => {
    const startedAt = performance.now()
    const matches = values
      .map((value, index) => value.includes('500') ? [index, replaceWorkbookText(value, 'item', 'entry')] : null)
      .filter(Boolean)
    const elapsed = performance.now() - startedAt

    expect(matches.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(100)
  })

  it('generates a bounded autofill series within the interactive budget', () => {
    const startedAt = performance.now()
    const filled = nextFillValues(['1', '2'], 9_998)
    const elapsed = performance.now() - startedAt

    expect(filled.at(-1)).toBe('10000')
    expect(elapsed).toBeLessThan(100)
  })
})
