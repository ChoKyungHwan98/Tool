import { describe, expect, it } from 'vitest'
import {
  loadAdaptiveDeckDesign,
  resolveAdaptivePageLayout,
  type AdaptiveDeckDesign
} from '../../../src/main/deck-ir/generation-bridge'
import { DeckIrChecksumMismatchError } from '../../../src/main/deck-ir/repository'
import { sha256Text, stableStringify } from '../../../src/main/deck-ir/stable-json'
import { createEmptyDeckIr } from '../../../src/shared/deck-ir'
import type { DesignDirection, StoryboardDecision } from '../../../src/shared/design-engine'

const direction: DesignDirection = {
  id: 'direction-1',
  name: '판정선의 긴장',
  rationale: '실측과 상태 전이를 전면에 둔다.',
  toneWords: ['정밀함', '긴장'],
  palette: {
    canvas: '#f7f4ee',
    surface: '#ffffff',
    ink: '#171717',
    muted: '#716b63',
    accent: '#d33a2c'
  },
  typography: {
    titleCharacter: '짧고 단단함',
    bodyCharacter: '실측표 중심',
    emphasisRule: '판정만 강조'
  },
  motif: {
    name: '판정 눈금',
    description: '전환점의 짧은 눈금',
    usageRule: '핵심 근거에만 사용'
  },
  navigation: '논증 진행 눈금',
  evidenceTreatment: '도판 직접 주석',
  shapeLanguage: '직각과 얇은 선',
  sourceSignalIds: [],
  heroSlideIds: []
}

const storyboard: StoryboardDecision[] = [
  {
    slideId: 'deck-slide-a',
    candidates: [
      {
        id: 'layout-a',
        slideId: 'deck-slide-a',
        family: 'state-machine',
        visualForm: '조건이 드러나는 상태 전이도',
        composition: '왼쪽에서 오른쪽으로 상태를 읽는다.',
        dominantArtifact: '상태와 전이 조건',
        readingPath: 'left-right',
        density: 'medium',
        anchorZone: 'center',
        hero: false,
        componentRoles: ['headline', 'state-map'],
        fingerprint: 'state-machine|left-right|center|medium|standard',
        fitnessReasons: ['메커니즘을 직접 보여줌'],
        score: 100
      },
      {
        id: 'layout-a-alt',
        slideId: 'deck-slide-a',
        family: 'judgement-timeline',
        visualForm: '판정 시간축',
        composition: '가로 축을 따라 읽는다.',
        dominantArtifact: '판정 구간',
        readingPath: 'left-right',
        density: 'medium',
        anchorZone: 'top',
        hero: false,
        componentRoles: ['headline', 'timeline'],
        fingerprint: 'judgement-timeline|left-right|top|medium|standard',
        fitnessReasons: ['시간 근거를 직접 보여줌'],
        score: 90
      }
    ],
    selectedCandidateId: 'layout-a',
    selectionReason: '앞뒤 반복을 피하면서 메커니즘을 직접 보여준다.'
  }
]

describe('DeckIR generation bridge', () => {
  it('maps a storyboard by page order when Oh My PPT page IDs differ from DeckIR IDs', () => {
    const design: AdaptiveDeckDesign = { direction, storyboard }
    const resolved = resolveAdaptivePageLayout(design, 'oh-my-ppt-page-id', 1)

    expect(resolved?.layoutId).toBe('layout-a')
    expect(resolved?.layoutPrompt).toContain('판정선의 긴장')
    expect(resolved?.layoutPrompt).toContain('조건이 드러나는 상태 전이도')
    expect(resolved?.layoutPrompt).toContain('not as a reusable industry template')
  })

  it('loads only a selected, checksum-valid adaptive plan', async () => {
    const document = createEmptyDeckIr({ sessionId: 'session-1', title: '테스트', now: 1 })
    document.revision = 1
    document.designPlan = {
      directions: [
        direction,
        {
          ...direction,
          id: 'direction-2',
          name: '다른 안',
          palette: { ...direction.palette, accent: '#29745d' },
          motif: { ...direction.motif, name: '상태 노드' }
        }
      ],
      selectedDirectionId: direction.id,
      storyboard,
      generatedAt: 1
    }
    const documentJson = stableStringify(document)
    const db = {
      getDeckIrDocumentRow: async () => ({
        sessionId: 'session-1',
        revision: 1,
        documentJson,
        checksum: sha256Text(documentJson),
        createdAt: 1,
        updatedAt: 1
      })
    }

    await expect(loadAdaptiveDeckDesign(db, 'session-1')).resolves.toMatchObject({
      direction: { id: 'direction-1' },
      storyboard: [{ selectedCandidateId: 'layout-a' }]
    })
  })

  it('refuses to inject a tampered design plan into generation', async () => {
    const db = {
      getDeckIrDocumentRow: async () => ({
        sessionId: 'session-1',
        revision: 1,
        documentJson: '{"tampered":true}',
        checksum: sha256Text('{"different":true}'),
        createdAt: 1,
        updatedAt: 1
      })
    }
    await expect(loadAdaptiveDeckDesign(db, 'session-1')).rejects.toBeInstanceOf(
      DeckIrChecksumMismatchError
    )
  })
})
