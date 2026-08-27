import { describe, expect, it } from 'vitest'
import { gameCSampleProject } from '../../domain/gameCSampleProject'
import { buildSchemaEdges, relationColor } from './schemaCanvasEdges'

const noopHandlers = {
  onHoverEnd: () => undefined,
  onHoverStart: () => undefined,
  onSelect: () => undefined,
  onDelete: () => undefined,
}

describe('buildSchemaEdges 드래그 부분 전환', () => {
  it('드래그 중인 노드에 붙은 엣지만 step 타입이 된다', () => {
    const relation = gameCSampleProject.relations[0]!
    const edges = buildSchemaEdges(
      gameCSampleProject, null, 'all', new Set(), new Set(),
      null, null, relation.sourceTableId, noopHandlers,
    )

    const attached = edges.filter((edge) =>
      edge.source === relation.sourceTableId || edge.target === relation.sourceTableId)
    const detached = edges.filter((edge) =>
      edge.source !== relation.sourceTableId && edge.target !== relation.sourceTableId)

    expect(attached.length).toBeGreaterThan(0)
    for (const edge of attached) expect(edge.type).toBe('step')
    for (const edge of detached) expect(edge.type).toBe('smartRelation')
  })

  it('드래그 중이 아니면 전부 smartRelation이다', () => {
    const edges = buildSchemaEdges(
      gameCSampleProject, null, 'all', new Set(), new Set(),
      null, null, null, noopHandlers,
    )
    expect(edges.length).toBeGreaterThan(0)
    for (const edge of edges) expect(edge.type).toBe('smartRelation')
  })

  it('전체 보기에서는 선택 테이블과 무관하게 모든 관계색을 유지한다', () => {
    const selectedTableId = gameCSampleProject.tables[0]!.tableId
    const edges = buildSchemaEdges(
      gameCSampleProject, selectedTableId, 'all', new Set(), new Set(),
      null, null, null, noopHandlers,
    )

    expect(edges).toHaveLength(gameCSampleProject.relations.length)
    for (const edge of edges) {
      expect(edge.data?.visualState).not.toBe('dimmed')
      expect(edge.style?.stroke).toBe(relationColor(gameCSampleProject, edge.id))
      expect(edge.markerEnd).toMatchObject({ width: 8, height: 8 })
    }
  })

  it('현재 테이블 보기에서는 직접 관계만 강조하고 나머지는 회색으로 남긴다', () => {
    const selectedTableId = gameCSampleProject.tables.find((table) => table.name === 'Item')!.tableId
    const directRelationIds = new Set(gameCSampleProject.relations
      .filter((relation) => relation.sourceTableId === selectedTableId || relation.targetTableId === selectedTableId)
      .map((relation) => relation.relationId))
    const edges = buildSchemaEdges(
      gameCSampleProject, selectedTableId, 'direct', directRelationIds, new Set(),
      null, null, null, noopHandlers,
    )

    expect(edges).toHaveLength(gameCSampleProject.relations.length)
    for (const edge of edges) {
      expect(edge.data?.visualState).toBe(directRelationIds.has(edge.id) ? 'active' : 'dimmed')
    }
  })
})
