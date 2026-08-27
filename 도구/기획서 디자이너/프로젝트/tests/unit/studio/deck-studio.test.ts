import { describe, expect, it } from 'vitest'
import {
  createOfflineWorkspace,
  applyAiOutlineProposal,
  attachStudioArtifact,
  inferLogicalStructure,
  getSlideVisualOverride,
  getAttachedArtifacts,
  insertStudioArtifactSlide,
  removeImageSlot,
  segmentBrief,
  selectDesignDirection,
  selectLayoutCandidate,
  updateSlideVisual,
  upsertImageSlot,
  validateAiOutlineProposal,
  updateSlideContent
} from '../../../studio/src/deckEngine'

describe('studio deck authoring engine', () => {
  it('turns free-form Korean notes into traceable slides without inventing numbers', () => {
    const workspace = createOfflineWorkspace(
      '회피 손해 개선안',
      '회피 후딜은 실측 18프레임이다.\n기존 방식과 신규 방식의 차이를 비교한다.\n실패했을 때 복구 과정을 먼저 검증한다.'
    )

    expect(workspace.document.inventory).toHaveLength(3)
    expect(workspace.document.slides).toHaveLength(4)
    expect(workspace.document.inventory[0]?.verbatimNumbers).toContain('18')
    expect(workspace.document.slides[1]?.headline.sourceItemIds).toEqual([
      workspace.document.inventory[0]?.id
    ])
    expect(workspace.document.sources[0]?.rawText).toContain('18프레임')
  })

  it('infers structures that drive layout variety', () => {
    expect(inferLogicalStructure('전작과 신규 방식의 차이를 비교한다')).toBe('comparison')
    expect(inferLogicalStructure('입력 이후 판정까지 3단계로 진행한다')).toBe('sequence')
    expect(inferLogicalStructure('피격 때문에 경직 시간이 증가한다')).toBe('cause-effect')
    expect(inferLogicalStructure('FSM 상태 전환 조건을 정의한다')).toBe('mechanism')
    expect(segmentBrief('- 첫 주장\n- 두 번째 주장')).toEqual(['첫 주장', '두 번째 주장'])
  })

  it('creates storyboard candidates only after a content-derived direction is selected', () => {
    const workspace = createOfflineWorkspace(
      '보스 전투 제안',
      '보스 공격은 예고 동작 이후 시작한다.\n거리 3.5m 이하에서 강공격으로 전환한다.'
    )
    const directionId = workspace.document.designPlan?.directions[0]?.id
    expect(directionId).toBeTruthy()

    const planned = selectDesignDirection(workspace, directionId!)
    const firstDecision = planned.document.designPlan?.storyboard[0]

    expect(planned.document.designPlan?.selectedDirectionId).toBe(directionId)
    expect(planned.document.designPlan?.storyboard).toHaveLength(planned.document.slides.length)
    expect(firstDecision?.candidates.length).toBeGreaterThan(1)

    const selected = selectLayoutCandidate(
      planned,
      firstDecision!.slideId,
      firstDecision!.candidates[1]!.id
    )
    expect(selected.document.designPlan?.storyboard[0]?.selectedCandidateId).toBe(
      firstDecision!.candidates[1]!.id
    )
  })

  it('records direct edits as a new source instead of losing traceability', () => {
    const workspace = createOfflineWorkspace('전투 기획', '첫 상태는 대기다.')
    const slide = workspace.document.slides[1]!
    const updated = updateSlideContent(workspace, slide.id, '첫 상태는 대기다', ['피격 시 경직으로 전환한다'])
    const updatedSlide = updated.document.slides[1]!

    expect(updated.document.revision).toBe(2)
    expect(updated.document.sources).toHaveLength(workspace.document.sources.length + 1)
    expect(updatedSlide.body[0]?.text).toBe('피격 시 경직으로 전환한다')
    expect(updatedSlide.headline.sourceItemIds[0]).toBe(
      updated.document.inventory.at(-1)?.id
    )
  })

  it('stores visual overrides and editable image slots in DeckIR', () => {
    const workspace = createOfflineWorkspace('전투 기획', '첫 상태는 대기다.')
    const slide = workspace.document.slides[1]!
    const styled = updateSlideVisual(workspace, slide.id, { fontScale: 1.15, density: 'dense' })
    expect(getSlideVisualOverride(styled.document, slide.id)).toEqual({ fontScale: 1.15, density: 'dense' })

    const withSlot = upsertImageSlot(styled, slide.id, {
      description: '피격 직전 게임 화면', composition: '캐릭터와 공격 판정을 함께 표시',
      aspectRatio: '16:9', minWidth: 1920, minHeight: 1080, annotations: ['판정 시작 프레임']
    })
    expect(withSlot.document.imageSlots[0]?.description).toContain('피격 직전')
    expect(withSlot.document.slides[1]?.imageSlotIds).toHaveLength(1)

    const removed = removeImageSlot(withSlot, slide.id)
    expect(removed.document.imageSlots).toHaveLength(0)
    expect(removed.document.slides[1]?.imageSlotIds).toHaveLength(0)
  })

  it('blocks AI-created numbers and only applies a traceable proposal after approval', () => {
    const workspace = createOfflineWorkspace('전투 기획', '회피 후딜은 실측 18프레임이다.')
    const sourceItemId = workspace.document.inventory[0]!.id
    const invalid = { summary: '구조 제안', slides: [{ headline: '후딜은 12프레임이다', body: [], logicalStructure: 'number-focus' as const, sourceItemIds: [sourceItemId] }] }
    expect(validateAiOutlineProposal(workspace, invalid)[0]).toContain('12')

    const valid = { summary: '검증 기준을 먼저 제시', slides: [{ headline: '후딜은 18프레임이다', body: ['실측값을 검증 기준으로 둔다'], logicalStructure: 'number-focus' as const, sourceItemIds: [sourceItemId] }] }
    const applied = applyAiOutlineProposal(workspace, valid)
    expect(applied.document.slides[1]?.headline.text).toContain('18프레임')
    expect(applied.document.slides[1]?.headline.sourceItemIds).toEqual([sourceItemId])
    expect(applied.revisions.at(-1)?.reason).toContain('검토 후 적용')
  })

  it('keeps tool artifacts opt-in and inserts a traceable native slide', () => {
    const workspace = createOfflineWorkspace('전투 기획', '보스 상태를 정의한다.')
    const attached = attachStudioArtifact(workspace, {
      catalogId: 'pattern-designer:boss', toolId: 'pattern-designer', artifactId: 'boss',
      kind: 'pattern-set', title: '보스 패턴', revision: 3, fingerprint: 'r3',
      data: { graphs: [{ name: '전투 HFSM', nodes: [], edges: [] }] }
    })
    expect(getAttachedArtifacts(attached.document)).toHaveLength(1)
    const inserted = insertStudioArtifactSlide(attached, 'pattern-designer:boss')
    expect(inserted.document.slides.at(-1)?.logicalStructure).toBe('mechanism')
    expect(inserted.document.slides.at(-1)?.headline.sourceItemIds).toEqual([
      getAttachedArtifacts(inserted.document)[0]?.inventoryId
    ])
  })
})
