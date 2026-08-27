import { describe, expect, it } from 'vitest'
import ELK from 'elkjs/lib/elk.bundled.js'
import { gameCSampleIds, gameCSampleProject } from '../domain/gameCSampleProject'
import { gameDComplexProject } from '../domain/gameDComplexProject'
import { createRelation } from '../domain/schemaFactories'
import { buildElkLayoutGraph, extractElkEdgeRoutes, relationHandleId, relationPortId, relationPortOffset, SCHEMA_NODE_HEADER_HEIGHT, SCHEMA_NODE_COLUMN_HEIGHT } from './schemaLayout'

describe('스키마 열 기반 자동 배치', () => {
  it('모든 관계를 테이블이 아닌 실제 열 위치의 동·서 포트에 연결한다', () => {
    const graph = buildElkLayoutGraph(gameCSampleProject)
    const itemNode = graph.children?.find((node) => node.id === gameCSampleIds.item)
    const itemTypeRelation = gameCSampleProject.relations[0]!
    const sourcePort = itemNode?.ports?.find((port) => port.id === relationPortId(itemTypeRelation, 'source'))
    const edge = graph.edges?.find((candidate) => candidate.id === itemTypeRelation.relationId)

    expect(sourcePort).toMatchObject({
      x: 230,
      y: SCHEMA_NODE_HEADER_HEIGHT + SCHEMA_NODE_COLUMN_HEIGHT + 11,
      layoutOptions: { 'elk.port.side': 'EAST' },
    })
    expect(edge?.sources).toEqual([relationPortId(itemTypeRelation, 'source')])
    expect(edge?.targets).toEqual([relationPortId(itemTypeRelation, 'target')])
    expect(edge?.sources).not.toContain(itemTypeRelation.sourceTableId)
    expect(relationHandleId(itemTypeRelation, 'target')).toBe(`relation-target:${itemTypeRelation.relationId}`)
  })

  it('복합 FK도 한 관계선과 열 묶음 중앙 포트를 사용한다', () => {
    const compositeRelation = createRelation({
      relationId: 'relation_composite_audit',
      name: 'Composite audit relation',
      sourceTableId: gameCSampleIds.monsterDrop,
      sourceColumnIds: [gameCSampleIds.dropMonsterId, gameCSampleIds.dropItemId],
      targetTableId: gameCSampleIds.shopItem,
      targetColumnIds: [gameCSampleIds.shopItemShopId, gameCSampleIds.shopItemItemId],
    })
    const project = { ...gameCSampleProject, relations: [...gameCSampleProject.relations, compositeRelation] }
    const graph = buildElkLayoutGraph(project)
    const sourceNode = graph.children?.find((node) => node.id === gameCSampleIds.monsterDrop)
    const port = sourceNode?.ports?.find((candidate) => candidate.id === relationPortId(compositeRelation, 'source'))

    expect(graph.edges?.filter((edge) => edge.id === compositeRelation.relationId)).toHaveLength(1)
    expect(port?.y).toBe(SCHEMA_NODE_HEADER_HEIGHT + 1.5 * SCHEMA_NODE_COLUMN_HEIGHT + 11)
    expect(relationHandleId(compositeRelation, 'source')).toBe(`relation-source:${compositeRelation.relationId}`)
  })

  it('같은 대상 열을 참조하는 관계는 행 내부의 안정적인 개별 슬롯을 사용한다', () => {
    const dropItemRelation = gameCSampleProject.relations.find(
      (relation) => relation.relationId === 'relation_game_c_drop_item',
    )!
    const shopItemRelation = gameCSampleProject.relations.find(
      (relation) => relation.relationId === 'relation_game_c_shop_item_item',
    )!

    const dropOffset = relationPortOffset(gameCSampleProject, dropItemRelation, 'target')
    const shopOffset = relationPortOffset(gameCSampleProject, shopItemRelation, 'target')

    expect(dropOffset).toBe(-4)
    expect(shopOffset).toBe(4)
    expect(Math.abs(shopOffset - dropOffset)).toBeGreaterThanOrEqual(6)

    const graph = buildElkLayoutGraph(gameCSampleProject)
    const itemNode = graph.children?.find((node) => node.id === gameCSampleIds.item)
    const dropPort = itemNode?.ports?.find((port) => port.id === relationPortId(dropItemRelation, 'target'))
    const shopPort = itemNode?.ports?.find((port) => port.id === relationPortId(shopItemRelation, 'target'))

    expect((shopPort?.y ?? 0) - (dropPort?.y ?? 0)).toBe(8)
  })

  it('25개 테이블과 36개 관계를 겹치지 않는 유한한 영역에 배치한다', async () => {
    const result = await new ELK().layout(buildElkLayoutGraph(gameDComplexProject))
    const nodes = result.children ?? []
    const edges = result.edges ?? []

    expect(nodes).toHaveLength(25)
    expect(edges).toHaveLength(36)
    expect(edges.filter((edge) => (edge.sections?.length ?? 0) === 0)).toEqual([])
    expect(result.width).toBeLessThan(6_000)
    expect(result.height).toBeLessThan(6_000)

    const overlappingPairs: string[] = []
    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      const left = nodes[leftIndex]!
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const right = nodes[rightIndex]!
        const overlaps = (left.x ?? 0) < (right.x ?? 0) + (right.width ?? 0)
          && (left.x ?? 0) + (left.width ?? 0) > (right.x ?? 0)
          && (left.y ?? 0) < (right.y ?? 0) + (right.height ?? 0)
          && (left.y ?? 0) + (left.height ?? 0) > (right.y ?? 0)
        if (overlaps) overlappingPairs.push(`${left.id}:${right.id}`)
      }
    }

    expect(overlappingPairs).toEqual([])
  }, 10_000)
})

describe('ELK 엣지 경로 옵션과 추출', () => {
  it('엣지 좌표를 루트 기준으로 요청한다', () => {
    const graph = buildElkLayoutGraph(gameCSampleProject)
    expect(graph.layoutOptions?.['elk.json.edgeCoords']).toBe('ROOT')
  })

  it('섹션의 startPoint→bendPoints→endPoint를 relationId별 경로로 만든다', () => {
    const routes = extractElkEdgeRoutes({
      id: 'schema-root',
      edges: [{
        id: 'relation-1',
        sources: ['port:source:relation-1'],
        targets: ['port:target:relation-1'],
        sections: [{
          id: 'section-1',
          startPoint: { x: 10, y: 20 },
          bendPoints: [{ x: 50, y: 20 }, { x: 50, y: 80 }],
          endPoint: { x: 90, y: 80 },
        }],
      }],
    })

    expect(routes.get('relation-1')).toEqual([
      { x: 10, y: 20 },
      { x: 50, y: 20 },
      { x: 50, y: 80 },
      { x: 90, y: 80 },
    ])
  })

  it('섹션이 없는 엣지는 건너뛴다', () => {
    const routes = extractElkEdgeRoutes({
      id: 'schema-root',
      edges: [{ id: 'relation-x', sources: [], targets: [] }],
    })
    expect(routes.size).toBe(0)
  })
})
