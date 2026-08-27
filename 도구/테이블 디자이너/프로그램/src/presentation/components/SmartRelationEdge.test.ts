import { describe, expect, it } from 'vitest'
import { buildBridgePath, normalizeNearAlignedRoute, resolveEdgePoints, separateParallelSegments } from '../smartRelationRouting'

describe('resolveEdgePoints', () => {
  const endpoints = { sourceX: 0, sourceY: 5, targetX: 200, targetY: 105 }

  it('저장 ELK 경로가 있으면 종단점은 핸들 중심에 착지하고 진입 높이는 보존한다', () => {
    const stored = [{ x: 2, y: 4 }, { x: 100, y: 4 }, { x: 100, y: 104 }, { x: 198, y: 104 }]
    const resolved = resolveEdgePoints(stored, [{ x: 0, y: 0 }, { x: 50, y: 50 }], endpoints)
    expect(resolved.kind).toBe('elk')
    // 종단점은 정확히 핸들 중심 (sourceX/Y, targetX/Y)
    expect(resolved.points[0]).toEqual({ x: 0, y: 5 })
    expect(resolved.points.at(-1)).toEqual({ x: 200, y: 105 })
    // 종단 직전은 노드 테두리 + ELK 진입 높이
    expect(resolved.points[1]).toEqual({ x: 100, y: 5 })
    expect(resolved.points.at(-2)).toEqual({ x: 100, y: 105 })
  })

  it('저장 경로가 없으면 라이브 경로를 쓴다', () => {
    const live = [{ x: 0, y: 5 }, { x: 200, y: 105 }]
    const resolved = resolveEdgePoints(undefined, live, endpoints)
    expect(resolved.kind).toBe('live')
    expect(resolved.points).toEqual(live)
  })

  it('저장 경로가 2점 미만이면 무시하고 라이브로 폴백한다', () => {
    const resolved = resolveEdgePoints([{ x: 1, y: 1 }], [{ x: 0, y: 5 }], endpoints)
    expect(resolved.kind).toBe('live')
  })
})

describe('관계선 교차 브리지', () => {
  it('먼저 그려진 직각선과 교차할 때 현재 선에 작은 브리지를 만든다', () => {
    const path = buildBridgePath(
      [{ x: 0, y: 50 }, { x: 100, y: 50 }],
      [{ order: 0, points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] }],
      5,
    )

    expect(path).toContain('L 45,50')
    expect(path).toContain('L 45,45 L 55,45 L 55,50')
    expect(path).not.toContain('Q ')
  })

  it('화살촉 앞 24px 종단 구간에는 브리지를 만들지 않는다', () => {
    const path = buildBridgePath(
      [{ x: 0, y: 50 }, { x: 100, y: 50 }],
      [{ order: 0, points: [{ x: 88, y: 0 }, { x: 88, y: 100 }] }],
      5,
    )

    expect(path).toBe('M 0,50 L 100,50')
  })
})

describe('관계선 평행 통로', () => {
  it('같은 세로 통로를 쓰는 후속 관계를 별도 레인으로 분리한다', () => {
    const points = separateParallelSegments([
      { x: 0, y: 10 },
      { x: 20, y: 10 },
      { x: 20, y: 90 },
      { x: 100, y: 90 },
    ], 3)

    expect(points).toEqual([
      { x: 0, y: 10 },
      { x: 44, y: 10 },
      { x: 44, y: 90 },
      { x: 100, y: 90 },
    ])
  })
})

describe('거의 같은 높이의 관계선', () => {
  it('짧은 높이 보정을 포트 옆이 아니라 두 테이블 사이 중앙에 둔다', () => {
    const points = normalizeNearAlignedRoute([
      { x: 100, y: 50 },
      { x: 112, y: 50 },
      { x: 112, y: 58 },
      { x: 200, y: 58 },
    ], [])

    expect(points).toEqual([
      { x: 100, y: 50 },
      { x: 150, y: 50 },
      { x: 150, y: 58 },
      { x: 200, y: 58 },
    ])
  })

  it('중앙 직각선이 다른 카드를 통과하면 worker 경로를 유지한다', () => {
    const workerRoute = [
      { x: 100, y: 50 },
      { x: 112, y: 50 },
      { x: 112, y: 58 },
      { x: 200, y: 58 },
    ]

    expect(normalizeNearAlignedRoute(workerRoute, [{ left: 145, top: 40, right: 155, bottom: 70 }])).toEqual(workerRoute)
  })
})
