import { describe, expect, it } from 'vitest'
import {
  createDataRequiredToken,
  createEmptyDeckIr,
  extractNumericTokens,
  migrateDeckIrDocument,
  UnsupportedDeckIrSchemaVersionError
} from '../../../src/shared/deck-ir'

describe('DeckIR schema and factory', () => {
  it('captures a freeform brief without imposing company, project, or role fields', () => {
    const document = createEmptyDeckIr({
      sessionId: 'session-1',
      title: '전투 기획 포트폴리오',
      rawBrief: '지원 맥락은 자유롭게 설명하고, 회피 후딜 12프레임 실측을 사용한다.',
      now: 100,
      idFactory: (prefix) => `${prefix}-1`
    })

    expect(document.brief.rawText).toContain('지원 맥락은 자유롭게')
    expect(document.inventory[0]).toMatchObject({
      originalText: document.brief.rawText,
      verbatimNumbers: ['12']
    })
    expect(document).not.toHaveProperty('company')
    expect(document).not.toHaveProperty('jobRole')
  })

  it('extracts Korean planning measurements verbatim and creates visible missing-data tokens', () => {
    expect(extractNumericTokens('후딜 12프레임, 쿨타임 0.25초, 비용 10 USD')).toEqual([
      '12',
      '0.25초',
      '10 USD'
    ])
    expect(createDataRequiredToken('회피 후딜')).toBe('[DATA REQUIRED: 회피 후딜]')
  })

  it('rejects unknown future schema versions instead of silently corrupting them', () => {
    expect(() => migrateDeckIrDocument({ schemaVersion: 99 })).toThrow(
      UnsupportedDeckIrSchemaVersionError
    )
  })
})
