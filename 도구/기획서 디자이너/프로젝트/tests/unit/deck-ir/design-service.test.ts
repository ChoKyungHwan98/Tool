import { describe, expect, it, vi } from 'vitest'
import { createEmptyDeckIr, type DeckIrSlide } from '../../../src/shared/deck-ir'
import {
  DeckIrDesignOutputError,
  DeckIrDesignService
} from '../../../src/main/deck-ir/design-service'
import {
  formatAdaptiveLayoutPrompt,
  formatDesignDirectionPrompt
} from '../../../src/main/deck-ir/layout-bridge'

const result = <T>(value: T) => ({
  providerId: 'codex-local' as const,
  billingMode: 'subscription' as const,
  model: 'account-default',
  value,
  rawResponse: JSON.stringify(value),
  usage: {
    inputTokens: 1,
    cachedInputTokens: 0,
    outputTokens: 1,
    reasoningTokens: 0
  },
  actualCostUsdMicros: null
})

const makeSlide = (order: number, structure: DeckIrSlide['logicalStructure']): DeckIrSlide => ({
  id: `slide-${order}`,
  order,
  role: order === 1 ? 'cover' : 'content',
  logicalStructure: structure,
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

const createDocument = () => {
  const document = createEmptyDeckIr({
    sessionId: 'session-1',
    title: '지원용 전투 기획',
    rawBrief: '정밀한 판정과 실패 상태를 설명한다.',
    now: 100,
    idFactory: (prefix) => `${prefix}-1`
  })
  document.brief.contextSignals = [
    {
      id: 'signal-1',
      label: '증거 성격',
      value: '프레임 실측과 상태 전이가 중심',
      origin: 'user',
      confirmed: true
    }
  ]
  document.slides = [
    makeSlide(1, 'declaration'),
    makeSlide(2, 'mechanism'),
    makeSlide(3, 'cause-effect'),
    makeSlide(4, 'comparison'),
    makeSlide(5, 'number-focus'),
    makeSlide(6, 'tradeoff')
  ]
  return document
}

const direction = (args: { name: string; accent: string; motif: string; heroes: string[] }) => ({
  name: args.name,
  rationale: '원고가 가진 증거와 논증의 성격을 시각적으로 수행한다.',
  toneWords: ['정밀함', '긴장'],
  palette: {
    canvas: '#f7f4ee',
    surface: '#ffffff',
    ink: '#171717',
    muted: '#716b63',
    accent: args.accent
  },
  typography: {
    titleCharacter: '압축된 제목',
    bodyCharacter: '실측표를 읽기 쉬운 본문',
    emphasisRule: '증거만 굵게 표시'
  },
  motif: {
    name: args.motif,
    description: `${args.motif}를 논증 전환에 사용`,
    usageRule: '핵심 근거와 장 전환에만 제한한다.'
  },
  navigation: '논증 단계가 전진하는 상태를 표시한다.',
  evidenceTreatment: '실측과 상태를 도판 위에 직접 주석한다.',
  shapeLanguage: '얇은 선과 단단한 면',
  sourceSignalIds: ['signal-1'],
  heroSlideIds: args.heroes
})

describe('DeckIrDesignService', () => {
  it('keeps context-derived directions separate and creates an adaptive storyboard after selection', async () => {
    let id = 0
    const generateJson = vi.fn(async () =>
      result({
        directions: [
          direction({
            name: '판정선의 긴장',
            accent: '#d33a2c',
            motif: '판정 눈금',
            heroes: ['slide-1', 'slide-5']
          }),
          direction({
            name: '상태도의 절제',
            accent: '#29745d',
            motif: '상태 노드',
            heroes: ['slide-2', 'slide-6']
          })
        ]
      })
    )
    const service = new DeckIrDesignService(
      { generateJson },
      (prefix) => `${prefix}-${++id}`,
      () => 200
    )
    const proposed = await service.proposeDirections(createDocument())
    const selected = service.selectDirection(proposed, proposed.designPlan!.directions[0].id)

    const request = generateJson.mock.calls[0][0]
    expect(request.prompt).toContain('프레임 실측과 상태 전이가 중심')
    expect(request.prompt).toContain('company or product')
    expect(proposed.designPlan).toMatchObject({
      selectedDirectionId: null,
      storyboard: [],
      directions: [{ name: '판정선의 긴장' }, { name: '상태도의 절제' }]
    })
    expect(selected.designPlan?.storyboard).toHaveLength(6)
    expect(selected.designPlan?.storyboard[0].candidates.length).toBeGreaterThanOrEqual(4)
    expect(selected.designPlan?.storyboard.map((item) => item.selectedCandidateId)).not.toEqual(
      selected.designPlan?.storyboard.map(() => 'content-editorial')
    )
  })

  it('rejects cosmetic alternatives that reuse the same accent', async () => {
    const sameAccent = '#d33a2c'
    const ai = {
      generateJson: vi.fn(async () =>
        result({
          directions: [
            direction({
              name: '첫 안',
              accent: sameAccent,
              motif: '판정 눈금',
              heroes: ['slide-1', 'slide-5']
            }),
            direction({
              name: '둘째 안',
              accent: sameAccent,
              motif: '상태 노드',
              heroes: ['slide-2', 'slide-6']
            })
          ]
        })
      )
    }
    const service = new DeckIrDesignService(ai)
    await expect(service.proposeDirections(createDocument())).rejects.toBeInstanceOf(
      DeckIrDesignOutputError
    )
  })

  it('bridges the chosen visual grammar and per-slide information architecture to Oh My PPT prompts', async () => {
    let id = 0
    const ai = {
      generateJson: vi.fn(async () =>
        result({
          directions: [
            direction({
              name: '판정선의 긴장',
              accent: '#d33a2c',
              motif: '판정 눈금',
              heroes: ['slide-1', 'slide-5']
            }),
            direction({
              name: '상태도의 절제',
              accent: '#29745d',
              motif: '상태 노드',
              heroes: ['slide-2', 'slide-6']
            })
          ]
        })
      )
    }
    const service = new DeckIrDesignService(ai, (prefix) => `${prefix}-${++id}`)
    const proposed = await service.proposeDirections(createDocument())
    const selected = service.selectDirection(proposed, proposed.designPlan!.directions[0].id)
    const chosenDirection = selected.designPlan!.directions[0]
    const decision = selected.designPlan!.storyboard[0]
    const candidate = decision.candidates.find((item) => item.id === decision.selectedCandidateId)!

    expect(formatDesignDirectionPrompt(chosenDirection)).toContain('판정 눈금')
    expect(formatDesignDirectionPrompt(chosenDirection)).toContain(
      'not as a reusable industry template'
    )
    expect(formatAdaptiveLayoutPrompt(candidate)).toContain(candidate.dominantArtifact)
    expect(formatAdaptiveLayoutPrompt(candidate)).toContain('Do not copy a pixel template')
  })
})
