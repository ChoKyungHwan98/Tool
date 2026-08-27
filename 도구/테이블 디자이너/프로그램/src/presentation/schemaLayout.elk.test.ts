import ELK from 'elkjs/lib/elk.bundled.js'
import { describe, expect, it } from 'vitest'
import { gameDComplexProject } from '../domain/gameDComplexProject'
import { findParallelOverlaps } from './smartRelationRouting'
import { buildElkLayoutGraph, extractElkEdgeRoutes } from './schemaLayout'

describe('ELK 통합: 게임 D 자동 배치 품질', () => {
  it('25개 테이블·전체 관계에서 8px 초과 병주 구간이 없다', async () => {
    const engine = new ELK()
    const graph = await engine.layout(buildElkLayoutGraph(gameDComplexProject))

    const routes = extractElkEdgeRoutes(graph)
    expect(routes.size).toBe(gameDComplexProject.relations.length)

    const overlaps = findParallelOverlaps([...routes.values()], 8)
    expect(overlaps).toEqual([])
  }, 20_000)

  it('모든 테이블 좌표가 계산된다', async () => {
    const engine = new ELK()
    const graph = await engine.layout(buildElkLayoutGraph(gameDComplexProject))
    const positioned = (graph.children ?? []).filter(
      (child) => child.x !== undefined && child.y !== undefined,
    )
    expect(positioned).toHaveLength(gameDComplexProject.tables.length)
  }, 20_000)
})
