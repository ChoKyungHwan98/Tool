import { describe, expect, it } from 'vitest'
import spec from '../../docs/03-ux-spec.md?raw'

describe('current UX documentation contract', () => {
  it('documents only the action-oriented bottom drawer', () => {
    expect(spec).toContain('문제 | 변경 검토')
    expect(spec).not.toContain('Problems, Changes, Migration, and History')
    expect(spec).not.toContain('Migration panel lists candidate plans')
  })
})
