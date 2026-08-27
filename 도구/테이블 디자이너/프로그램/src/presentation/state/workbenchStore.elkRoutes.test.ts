import { beforeEach, describe, expect, it } from 'vitest'
import { sampleIds } from '../../domain/sampleProject'
import type { RoutePoint } from '../smartRelationRouting'
import { useWorkbenchStore } from './workbenchStore'

function seedRoutes(): void {
  const schema = useWorkbenchStore.getState().document.schema
  const routes = new Map<string, readonly RoutePoint[]>()
  for (const relation of schema.relations) {
    routes.set(relation.relationId, [{ x: 0, y: 0 }, { x: 100, y: 0 }])
  }
  useWorkbenchStore.getState().setElkRoutes(routes)
}

describe('elkRoutes 무효화 규칙', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkbenchStore.getState().openSampleProject()
    seedRoutes()
  })

  it('setElkRoutes로 저장되고 clearElkRoutes로 비워진다', () => {
    expect(useWorkbenchStore.getState().elkRoutes.size).toBeGreaterThan(0)
    useWorkbenchStore.getState().clearElkRoutes()
    expect(useWorkbenchStore.getState().elkRoutes.size).toBe(0)
  })

  it('수동 드래그(moveTableLayout)는 그 테이블에 붙은 경로만 지운다', () => {
    const schema = useWorkbenchStore.getState().document.schema
    const relation = schema.relations[0]!
    const movedTableId = relation.sourceTableId
    const untouched = schema.relations.filter(
      (candidate) => candidate.sourceTableId !== movedTableId && candidate.targetTableId !== movedTableId,
    )

    useWorkbenchStore.getState().moveTableLayout(movedTableId, 999, 999)

    const routes = useWorkbenchStore.getState().elkRoutes
    expect(routes.has(relation.relationId)).toBe(false)
    for (const keep of untouched) {
      expect(routes.has(keep.relationId)).toBe(true)
    }
  })

  it('자동 배치(moveTablesLayout)는 전체 경로를 비운다 (직후 setElkRoutes로 채워짐)', () => {
    useWorkbenchStore.getState().moveTablesLayout([
      { entityId: sampleIds.rule, x: 10, y: 10 },
    ])
    expect(useWorkbenchStore.getState().elkRoutes.size).toBe(0)
  })

  it('그 외 스키마 변경 커맨드는 전체 무효화한다', () => {
    useWorkbenchStore.getState().addColumnToTable(sampleIds.rule, { stayInView: true })
    expect(useWorkbenchStore.getState().elkRoutes.size).toBe(0)
  })

  it('undo/redo는 전체 무효화한다', () => {
    useWorkbenchStore.getState().moveTableLayout(sampleIds.rule, 5, 5)
    seedRoutes()
    useWorkbenchStore.getState().undo()
    expect(useWorkbenchStore.getState().elkRoutes.size).toBe(0)

    seedRoutes()
    useWorkbenchStore.getState().redo()
    expect(useWorkbenchStore.getState().elkRoutes.size).toBe(0)
  })
})
