import { extractNumericTokens } from '../deck-ir/factory'
import type { DeckIrDocument, DeckIrSlide } from '../deck-ir/schema'
import type { DesignDirection, LayoutCandidate, LayoutFamily, StoryboardDecision } from './schema'

type CandidateBlueprint = {
  family: LayoutFamily
  visualForm: string
  dominantArtifact: string
  readingPath: LayoutCandidate['readingPath']
}

const BLUEPRINTS: Record<DeckIrSlide['logicalStructure'], CandidateBlueprint[]> = {
  comparison: [
    {
      family: 'shared-criteria',
      visualForm: '공통 기준을 공유하는 정렬 비교',
      dominantArtifact: '기준축 또는 비교표',
      readingPath: 'left-right'
    },
    {
      family: 'mirrored-evidence',
      visualForm: '대칭 증거 두 장면',
      dominantArtifact: '나란히 놓인 증거물',
      readingPath: 'left-right'
    },
    {
      family: 'before-after-hinge',
      visualForm: '중앙 전환점을 둔 전후 대비',
      dominantArtifact: '전환 경첩',
      readingPath: 'center-out'
    },
    {
      family: 'asymmetric-split',
      visualForm: '결론과 근거의 비대칭 분할',
      dominantArtifact: '우세안 또는 핵심 차이',
      readingPath: 'left-right'
    }
  ],
  sequence: [
    {
      family: 'progression-track',
      visualForm: '단계별 진행 눈금',
      dominantArtifact: '시간 또는 순서 축',
      readingPath: 'left-right'
    },
    {
      family: 'staged-path',
      visualForm: '공간을 이동하는 단계 경로',
      dominantArtifact: '강조된 현재 단계',
      readingPath: 'top-bottom'
    },
    {
      family: 'editorial-axis',
      visualForm: '번호와 설명이 교차하는 편집 축',
      dominantArtifact: '큰 단계 번호',
      readingPath: 'top-bottom'
    },
    {
      family: 'causal-chain',
      visualForm: '연쇄 동작 도판',
      dominantArtifact: '단계 간 전달 관계',
      readingPath: 'left-right'
    }
  ],
  'cause-effect': [
    {
      family: 'causal-chain',
      visualForm: '원인에서 결과로 이어지는 연쇄',
      dominantArtifact: '인과 연결선',
      readingPath: 'left-right'
    },
    {
      family: 'before-after-hinge',
      visualForm: '원인 전후를 가르는 경첩',
      dominantArtifact: '변화 지점',
      readingPath: 'center-out'
    },
    {
      family: 'system-map',
      visualForm: '영향 관계를 드러낸 시스템 지도',
      dominantArtifact: '핵심 상태 노드',
      readingPath: 'radial'
    },
    {
      family: 'annotated-artifact',
      visualForm: '결과물 위에 원인을 직접 주석',
      dominantArtifact: '주석이 달린 실물',
      readingPath: 'center-out'
    }
  ],
  'part-whole': [
    {
      family: 'system-map',
      visualForm: '중심과 부분의 관계 지도',
      dominantArtifact: '전체 시스템',
      readingPath: 'radial'
    },
    {
      family: 'modular-matrix',
      visualForm: '역할별 모듈 매트릭스',
      dominantArtifact: '모듈 간 위계',
      readingPath: 'left-right'
    },
    {
      family: 'annotated-artifact',
      visualForm: '전체 실물에 부분을 직접 표기',
      dominantArtifact: '주석이 달린 전체도',
      readingPath: 'center-out'
    },
    {
      family: 'editorial-axis',
      visualForm: '전체 설명과 부분 목록의 편집 축',
      dominantArtifact: '전체를 설명하는 문장',
      readingPath: 'top-bottom'
    }
  ],
  'number-focus': [
    {
      family: 'metric-stage',
      visualForm: '단일 수치를 무대로 삼는 구성',
      dominantArtifact: '핵심 수치',
      readingPath: 'center-out'
    },
    {
      family: 'chart-argument',
      visualForm: '차트와 결론을 맞물린 구성',
      dominantArtifact: '차트 또는 수치 비교',
      readingPath: 'left-right'
    },
    {
      family: 'before-after-hinge',
      visualForm: '두 수치를 전후로 가르는 비교',
      dominantArtifact: '수치 변화',
      readingPath: 'center-out'
    },
    {
      family: 'editorial-axis',
      visualForm: '큰 수치와 근거 각주의 편집 축',
      dominantArtifact: '수치와 측정 근거',
      readingPath: 'top-bottom'
    }
  ],
  declaration: [
    {
      family: 'statement-field',
      visualForm: '한 문장이 장면을 지배하는 선언',
      dominantArtifact: '헤드라인',
      readingPath: 'center-out'
    },
    {
      family: 'visual-canvas',
      visualForm: '이미지 또는 색면 위의 짧은 선언',
      dominantArtifact: '하나의 시각 장면',
      readingPath: 'center-out'
    },
    {
      family: 'asymmetric-split',
      visualForm: '선언과 맥락의 비대칭 분할',
      dominantArtifact: '선언문',
      readingPath: 'left-right'
    },
    {
      family: 'editorial-axis',
      visualForm: '문장과 여백이 만드는 편집 리듬',
      dominantArtifact: '타이포그래피',
      readingPath: 'top-bottom'
    }
  ],
  mechanism: [
    {
      family: 'state-machine',
      visualForm: '조건이 드러나는 상태 전이도',
      dominantArtifact: '상태와 전이 조건',
      readingPath: 'left-right'
    },
    {
      family: 'judgement-timeline',
      visualForm: '판정 구간을 펼친 시간축',
      dominantArtifact: '프레임 또는 판정 구간',
      readingPath: 'left-right'
    },
    {
      family: 'annotated-artifact',
      visualForm: '스크린샷 또는 실물 위의 판정 주석',
      dominantArtifact: '주석이 달린 증거 화면',
      readingPath: 'center-out'
    },
    {
      family: 'system-map',
      visualForm: '입력·상태·결과의 시스템 지도',
      dominantArtifact: '메커니즘 전체',
      readingPath: 'radial'
    }
  ],
  tradeoff: [
    {
      family: 'tradeoff-field',
      visualForm: '두 축 위에 선택지를 놓은 장',
      dominantArtifact: '선택지의 위치',
      readingPath: 'center-out'
    },
    {
      family: 'spectrum-balance',
      visualForm: '양 끝의 손익을 잇는 스펙트럼',
      dominantArtifact: '균형점',
      readingPath: 'left-right'
    },
    {
      family: 'shared-criteria',
      visualForm: '이득과 비용을 같은 기준으로 정렬',
      dominantArtifact: '공통 평가 기준',
      readingPath: 'top-bottom'
    },
    {
      family: 'asymmetric-split',
      visualForm: '권고안과 감수할 비용의 분할',
      dominantArtifact: '권고안',
      readingPath: 'left-right'
    }
  ],
  custom: [
    {
      family: 'custom',
      visualForm: '원고가 설명한 맞춤 논리 구조',
      dominantArtifact: '원고 고유의 증거물',
      readingPath: 'center-out'
    },
    {
      family: 'editorial-axis',
      visualForm: '주장과 증거를 잇는 유연한 편집 축',
      dominantArtifact: '핵심 주장',
      readingPath: 'top-bottom'
    },
    {
      family: 'annotated-artifact',
      visualForm: '대표 실물과 설명의 결합',
      dominantArtifact: '대표 증거물',
      readingPath: 'center-out'
    },
    {
      family: 'asymmetric-split',
      visualForm: '주장과 보조 근거의 비대칭 분할',
      dominantArtifact: '주장 또는 실물',
      readingPath: 'left-right'
    }
  ]
}

const ANCHOR_ROTATION: LayoutCandidate['anchorZone'][] = [
  'left',
  'right',
  'top',
  'center',
  'bottom'
]

const allSlideText = (slide: DeckIrSlide): string =>
  [slide.headline.text, ...slide.body.map((item) => item.text), slide.takeaway?.text || ''].join(
    '\n'
  )

const inferDensity = (slide: DeckIrSlide): LayoutCandidate['density'] => {
  const characterCount = allSlideText(slide).length
  if (characterCount > 260 || slide.body.length > 5) return 'high'
  if (characterCount > 100 || slide.body.length > 2) return 'medium'
  return 'low'
}

const targetHeroSlideIds = (document: DeckIrDocument, direction: DesignDirection): Set<string> => {
  const validSpecified = direction.heroSlideIds.filter((id) =>
    document.slides.some((slide) => slide.id === id)
  )
  if (validSpecified.length > 0) return new Set(validSpecified)
  const desired = Math.min(
    4,
    Math.max(document.slides.length >= 6 ? 2 : 1, Math.round(document.slides.length / 5))
  )
  const ranked = document.slides
    .map((slide, index) => ({
      id: slide.id,
      index,
      score:
        (slide.role === 'cover' || slide.role === 'divider' ? 5 : 0) +
        (slide.logicalStructure === 'declaration' ? 4 : 0) +
        (slide.logicalStructure === 'number-focus' ? 3 : 0) +
        (slide.imageSlotIds.length > 0 ? 2 : 0)
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
  const selected: number[] = []
  for (const item of ranked) {
    if (selected.every((index) => Math.abs(index - item.index) >= 2)) selected.push(item.index)
    if (selected.length === desired) break
  }
  return new Set(selected.map((index) => document.slides[index].id))
}

export const generateLayoutCandidates = (
  slide: DeckIrSlide,
  slideIndex: number,
  direction: DesignDirection,
  hero: boolean
): LayoutCandidate[] => {
  const density = inferDensity(slide)
  const hasNumber = extractNumericTokens(allSlideText(slide)).length > 0
  const hasImage = slide.imageSlotIds.length > 0
  return BLUEPRINTS[slide.logicalStructure].map((blueprint, candidateIndex) => {
    const anchorZone = hero
      ? 'full'
      : ANCHOR_ROTATION[(slideIndex + candidateIndex) % ANCHOR_ROTATION.length]
    const evidenceBonus =
      (hasNumber &&
        ['metric-stage', 'chart-argument', 'judgement-timeline'].includes(blueprint.family)) ||
      (hasImage && ['annotated-artifact', 'visual-canvas'].includes(blueprint.family))
        ? 18
        : 0
    const densityBonus =
      density === 'high' &&
      ['editorial-axis', 'shared-criteria', 'modular-matrix'].includes(blueprint.family)
        ? 10
        : density === 'low' &&
            ['statement-field', 'metric-stage', 'visual-canvas'].includes(blueprint.family)
          ? 10
          : 0
    const componentRoles = [
      'headline',
      blueprint.dominantArtifact,
      ...(slide.body.length > 0 ? ['supporting-evidence'] : []),
      ...(slide.takeaway ? ['takeaway'] : []),
      ...(hasImage ? ['image-slot-with-live-annotations'] : []),
      ...(slide.dataRequirementIds.length > 0 ? ['data-required-marker'] : [])
    ]
    const fingerprint = [
      blueprint.family,
      blueprint.readingPath,
      anchorZone,
      density,
      hero ? 'hero' : 'standard'
    ].join('|')
    return {
      id: `layout-${slide.id}-${candidateIndex + 1}`,
      slideId: slide.id,
      family: blueprint.family,
      visualForm: blueprint.visualForm,
      composition: `${anchorZone}을 주 앵커로 삼고 ${blueprint.readingPath} 순서로 읽힌다. ${direction.motif.name} 모티프는 ${direction.motif.usageRule}`,
      dominantArtifact: blueprint.dominantArtifact,
      readingPath: blueprint.readingPath,
      density,
      anchorZone,
      hero,
      componentRoles,
      fingerprint,
      fitnessReasons: [
        `${slide.logicalStructure} 논리와 맞는 ${blueprint.visualForm}`,
        `${density} 정보 밀도에 맞춘 구성`,
        ...(evidenceBonus > 0 ? ['슬라이드가 가진 실제 증거 형태를 전면에 둠'] : []),
        ...(hero ? ['덱의 리듬을 끊는 히어로 장면'] : [])
      ],
      score: 100 - candidateIndex * 8 + evidenceBonus + densityBonus
    }
  })
}

export const planDeckStoryboard = (
  document: DeckIrDocument,
  direction: DesignDirection
): StoryboardDecision[] => {
  const heroIds = targetHeroSlideIds(document, direction)
  const familyUse = new Map<LayoutFamily, number>()
  const decisions: StoryboardDecision[] = []
  for (const [index, slide] of document.slides.entries()) {
    const candidates = generateLayoutCandidates(slide, index, direction, heroIds.has(slide.id))
    const prior = decisions
      .at(-1)
      ?.candidates.find((candidate) => candidate.id === decisions.at(-1)?.selectedCandidateId)
    const prior2 = decisions
      .at(-2)
      ?.candidates.find((candidate) => candidate.id === decisions.at(-2)?.selectedCandidateId)
    const ranked = candidates
      .map((candidate) => {
        let adjustedScore = candidate.score - (familyUse.get(candidate.family) || 0) * 5
        if (prior?.fingerprint === candidate.fingerprint) adjustedScore -= 80
        if (prior?.family === candidate.family) adjustedScore -= 28
        if (prior?.readingPath === candidate.readingPath) adjustedScore -= 6
        if (prior?.family === candidate.family && prior2?.family === candidate.family) {
          adjustedScore -= 200
        }
        return { candidate, adjustedScore }
      })
      .sort(
        (left, right) =>
          right.adjustedScore - left.adjustedScore ||
          left.candidate.id.localeCompare(right.candidate.id)
      )
    const selected = ranked[0]
    familyUse.set(selected.candidate.family, (familyUse.get(selected.candidate.family) || 0) + 1)
    decisions.push({
      slideId: slide.id,
      candidates,
      selectedCandidateId: selected.candidate.id,
      selectionReason: `${selected.candidate.fitnessReasons.join(' · ')}. 앞뒤 슬라이드와의 반복 패널티를 반영한 점수 ${selected.adjustedScore}.`
    })
  }
  return decisions
}

export interface StoryboardDiversityReport {
  slideCount: number
  uniqueFamilyCount: number
  uniqueFingerprintCount: number
  maxConsecutiveFamily: number
  maxConsecutiveFingerprint: number
  heroCount: number
  violations: string[]
}

export const inspectStoryboardDiversity = (
  storyboard: StoryboardDecision[]
): StoryboardDiversityReport => {
  const selected = storyboard.map((decision) =>
    decision.candidates.find((candidate) => candidate.id === decision.selectedCandidateId)
  )
  const longestRun = (key: 'family' | 'fingerprint'): number => {
    let longest = 0
    let current = 0
    let previous: string | undefined
    for (const candidate of selected) {
      const value = candidate?.[key]
      current = value && value === previous ? current + 1 : value ? 1 : 0
      previous = value
      longest = Math.max(longest, current)
    }
    return longest
  }
  const maxConsecutiveFamily = longestRun('family')
  const maxConsecutiveFingerprint = longestRun('fingerprint')
  const heroCount = selected.filter((candidate) => candidate?.hero).length
  const violations = [
    ...(selected.some((candidate) => !candidate)
      ? ['선택된 후보를 찾을 수 없는 슬라이드가 있음']
      : []),
    ...(maxConsecutiveFamily >= 3 ? ['동일 레이아웃 계열이 3장 이상 연속됨'] : []),
    ...(maxConsecutiveFingerprint >= 2 ? ['동일 레이아웃 지문이 연속됨'] : [])
  ]
  return {
    slideCount: storyboard.length,
    uniqueFamilyCount: new Set(selected.map((candidate) => candidate?.family).filter(Boolean)).size,
    uniqueFingerprintCount: new Set(
      selected.map((candidate) => candidate?.fingerprint).filter(Boolean)
    ).size,
    maxConsecutiveFamily,
    maxConsecutiveFingerprint,
    heroCount,
    violations
  }
}
