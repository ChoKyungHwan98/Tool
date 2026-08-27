import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkbenchStore } from './workbenchStore'

describe('관계 삭제', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkbenchStore.getState().openSampleProject()
  })

  it('승인 전에는 관계가 그대로 남아 있다', () => {
    const relation = useWorkbenchStore.getState().document.schema.relations[0]!
    const before = useWorkbenchStore.getState().document

    useWorkbenchStore.getState().deleteRelation(relation.relationId)

    expect(useWorkbenchStore.getState().pendingCommand?.type).toBe('DeleteForeignKey')
    expect(useWorkbenchStore.getState().document).toEqual(before)
  })

  it('승인하면 관계가 사라지고, 되돌리기로 정확히 복원된다', () => {
    const relation = useWorkbenchStore.getState().document.schema.relations[0]!
    const before = useWorkbenchStore.getState().document

    useWorkbenchStore.getState().deleteRelation(relation.relationId)
    useWorkbenchStore.getState().applyPendingCommand({ approveDestructive: true })

    const after = useWorkbenchStore.getState().document
    expect(after.schema.relations.some((r) => r.relationId === relation.relationId)).toBe(false)
    expect(after.schema.relations).toHaveLength(before.schema.relations.length - 1)

    useWorkbenchStore.getState().undo()
    expect(useWorkbenchStore.getState().document).toEqual(before)
  })

  it('없는 관계 id는 조용히 무시한다', () => {
    const before = useWorkbenchStore.getState().document
    useWorkbenchStore.getState().deleteRelation('relation_does_not_exist')

    expect(useWorkbenchStore.getState().pendingCommand).toBeNull()
    expect(useWorkbenchStore.getState().document).toEqual(before)
  })
})
