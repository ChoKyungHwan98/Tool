import { describe, expect, it } from 'vitest'
import { buildDeckIrPptxDocument } from '../../../src/main/io/deck-ir-export'
import {
  attachStudioArtifact,
  createOfflineWorkspace,
  insertStudioArtifactSlide,
  selectDesignDirection
} from '../../../studio/src/deckEngine'
import { runOutputPreflight } from '../../../studio/src/preflight'

describe('studio Office output preflight', () => {
  it('verifies generated PPTX and DOCX packages before download', async () => {
    const workspace = createOfflineWorkspace('전투 기획', '회피 후딜은 실측 18프레임이다.\n기존안과 신규안을 비교한다.')
    const directionId = workspace.document.designPlan?.directions[0]?.id
    const planned = selectDesignDirection(workspace, directionId!)
    const report = await runOutputPreflight(planned.document)

    expect(report.slideCount).toBe(planned.document.slides.length)
    expect(report.liveTextCount).toBeGreaterThan(0)
    expect(report.pptxBytes).toBeGreaterThan(2000)
    expect(report.docxBytes).toBeGreaterThan(2000)
    expect(report.issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('turns an attached pattern graph into editable PowerPoint vectors', () => {
    const workspace = createOfflineWorkspace('AI 전투 패턴', 'Idle에서 추적 상태로 전환한다.')
    const attached = attachStudioArtifact(workspace, {
      catalogId: 'pattern:enemy-ai',
      toolId: 'pattern',
      artifactId: 'enemy-ai',
      kind: 'pattern-set',
      title: '적 AI 상태 흐름',
      revision: 3,
      fingerprint: 'pattern-v3',
      data: {
        graphs: [{
          name: '기본 전투 FSM',
          nodes: [
            { id: 'idle', name: 'Idle', kind: 'initial-state', position: { x: 0, y: 0 } },
            { id: 'chase', name: '추적', kind: 'state', position: { x: 280, y: 140 } }
          ],
          edges: [{ id: 'edge-1', source: 'idle', target: 'chase' }]
        }]
      }
    })
    const inserted = insertStudioArtifactSlide(attached, 'pattern:enemy-ai')
    const built = buildDeckIrPptxDocument(inserted.document)
    const slide = built.pptx.slides.at(-1)!

    expect(slide.texts.some((text) => text.text === 'Idle')).toBe(true)
    expect(slide.texts.some((text) => text.text === '추적')).toBe(true)
    expect(slide.shapes.length).toBeGreaterThanOrEqual(4)
    expect(slide.images).toEqual([])
  })
})
