import { describe, expect, it } from 'vitest'
import {
  createEmptyDeckIr,
  validateDeckIrIntegrity,
  type DeckIrDocument,
  type DeckIrSlide
} from '../../../src/shared/deck-ir'

const createBase = (): DeckIrDocument =>
  createEmptyDeckIr({
    sessionId: 'session-1',
    title: '테스트',
    rawBrief: '회피 후딜은 실측 12프레임이다.',
    now: 100,
    idFactory: (prefix) => `${prefix}-1`
  })

const createSlide = (overrides: Partial<DeckIrSlide> = {}): DeckIrSlide => ({
  id: 'slide-1',
  order: 1,
  role: 'content',
  logicalStructure: 'mechanism',
  headline: {
    id: 'text-1',
    text: '회피 후딜은 12프레임이다.',
    sourceItemIds: ['inventory-1'],
    claimIds: [],
    transform: 'compressed'
  },
  body: [],
  claimIds: [],
  dataRequirementIds: [],
  imageSlotIds: [],
  notes: '',
  ...overrides
})

describe('DeckIR integrity', () => {
  it('accepts a transformed statement whose number is present in cited evidence', () => {
    const document = createBase()
    document.slides = [createSlide()]
    expect(validateDeckIrIntegrity(document)).toEqual([])
  })

  it('blocks invented numbers even when the prose cites a real source', () => {
    const document = createBase()
    document.slides = [
      createSlide({
        headline: {
          id: 'text-1',
          text: '회피 후딜은 8프레임이다.',
          sourceItemIds: ['inventory-1'],
          claimIds: [],
          transform: 'compressed'
        }
      })
    ]
    expect(validateDeckIrIntegrity(document)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'untraceable-number' })])
    )
  })

  it('requires generated text provenance and a description for genuinely custom structures', () => {
    const document = createBase()
    document.slides = [
      createSlide({
        logicalStructure: 'custom',
        customStructure: undefined,
        headline: {
          id: 'text-1',
          text: '근거 없는 생성 문장',
          sourceItemIds: [],
          claimIds: [],
          transform: 'compressed'
        }
      })
    ]
    const codes = validateDeckIrIntegrity(document).map((issue) => issue.code)
    expect(codes).toContain('invalid-custom-structure')
    expect(codes).toContain('untraceable-text')
  })

  it('checks data requirements and image slots across slide references', () => {
    const document = createBase()
    document.slides = [createSlide({ dataRequirementIds: ['data-1'], imageSlotIds: ['image-1'] })]
    document.dataRequirements = [
      {
        id: 'data-1',
        slideId: 'slide-1',
        field: '실패 케이스',
        question: '빗나갔을 때의 상태는?',
        reason: '전투 시스템 검증에 필요',
        status: 'missing'
      }
    ]
    document.imageSlots = [
      {
        id: 'image-1',
        slideId: 'slide-1',
        description: '회피 판정 직전 프레임',
        composition: '캐릭터와 공격 판정이 함께 보이는 장면',
        aspectRatio: '16:9',
        minWidth: 1600,
        minHeight: 900,
        annotations: ['판정 박스']
      }
    ]
    expect(validateDeckIrIntegrity(document)).toEqual([])
  })
})
