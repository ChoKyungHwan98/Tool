import { describe, expect, it } from 'vitest'
import {
  generateLayoutCandidates,
  inspectStoryboardDiversity,
  planDeckStoryboard,
  type DesignDirection
} from '../../../src/shared/design-engine'
import { createEmptyDeckIr, type DeckIrSlide } from '../../../src/shared/deck-ir'

const makeSlide = (
  order: number,
  logicalStructure: DeckIrSlide['logicalStructure']
): DeckIrSlide => ({
  id: `slide-${order}`,
  order,
  role: order === 1 ? 'cover' : 'content',
  logicalStructure,
  headline: {
    id: `text-${order}`,
    text: '슬라이드의 핵심 주장',
    sourceItemIds: [],
    claimIds: [],
    transform: 'user-authored'
  },
  body: [],
  claimIds: [],
  dataRequirementIds: [],
  imageSlotIds: [],
  notes: ''
})

const direction: DesignDirection = {
  id: 'direction-1',
  name: '판정선의 긴장',
  rationale: '전투 판정과 논증의 전환을 같은 시각 언어로 보여준다.',
  toneWords: ['정밀함', '긴장'],
  palette: {
    canvas: '#f7f4ee',
    surface: '#ffffff',
    ink: '#171717',
    muted: '#76716a',
    accent: '#d33a2c'
  },
  typography: {
    titleCharacter: '짧고 단단한 제목',
    bodyCharacter: '실측표를 읽기 쉬운 본문',
    emphasisRule: '판정 순간만 굵게 강조'
  },
  motif: {
    name: '판정 눈금',
    description: '시간과 조건을 표시하는 짧은 눈금',
    usageRule: '전환점과 실측 근거에만 사용한다.'
  },
  navigation: '논증 단계가 진행될수록 눈금이 채워진다.',
  evidenceTreatment: '실측값과 판정 구간을 축 위에 직접 표시한다.',
  shapeLanguage: '얇은 선과 단단한 직각 프레임',
  sourceSignalIds: [],
  heroSlideIds: ['slide-1', 'slide-5']
}

describe('adaptive layout engine', () => {
  it('creates multiple semantic candidates instead of one layout per content type', () => {
    const candidates = generateLayoutCandidates(makeSlide(1, 'mechanism'), 0, direction, true)
    expect(candidates).toHaveLength(4)
    expect(new Set(candidates.map((candidate) => candidate.family)).size).toBe(4)
    expect(candidates.map((candidate) => candidate.family)).toEqual(
      expect.arrayContaining(['state-machine', 'judgement-timeline', 'annotated-artifact'])
    )
    expect(candidates.every((candidate) => candidate.hero)).toBe(true)
  })

  it('selects a deck rhythm with no three repeated families or adjacent fingerprints', () => {
    const document = createEmptyDeckIr({ sessionId: 'session-1', title: '전투 기획' })
    document.slides = [
      makeSlide(1, 'declaration'),
      makeSlide(2, 'mechanism'),
      makeSlide(3, 'mechanism'),
      makeSlide(4, 'comparison'),
      makeSlide(5, 'number-focus'),
      makeSlide(6, 'cause-effect'),
      makeSlide(7, 'mechanism'),
      makeSlide(8, 'tradeoff')
    ]
    const storyboard = planDeckStoryboard(document, direction)
    const report = inspectStoryboardDiversity(storyboard)

    expect(storyboard).toHaveLength(8)
    expect(storyboard.every((decision) => decision.candidates.length >= 4)).toBe(true)
    expect(report).toMatchObject({
      maxConsecutiveFamily: 1,
      maxConsecutiveFingerprint: 1,
      heroCount: 2,
      violations: []
    })
    expect(report.uniqueFamilyCount).toBeGreaterThanOrEqual(5)
  })

  it('changes candidate priority when the slide contains the evidence form itself', () => {
    const metricSlide = makeSlide(1, 'number-focus')
    metricSlide.headline.text = '후딜은 12프레임이다.'
    metricSlide.headline.sourceItemIds = ['inventory-1']
    metricSlide.headline.transform = 'compressed'
    const candidates = generateLayoutCandidates(metricSlide, 0, direction, false)
    expect(candidates[0]).toMatchObject({ family: 'metric-stage' })
    expect(candidates[0].score).toBeGreaterThan(candidates[1].score)
    expect(candidates[0].fitnessReasons).toContain('슬라이드가 가진 실제 증거 형태를 전면에 둠')
  })
})
