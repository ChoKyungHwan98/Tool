import { describe, expect, it } from 'vitest'
import {
  findParallelOverlaps,
  routeMidpoint,
  snapRouteEndpoints,
  type RoutePoint,
} from './smartRelationRouting'

describe('snapRouteEndpoints', () => {
  it('끝점은 핸들 중심에 정확히 착지하고 ELK 진입 높이는 짧은 연결선으로 보존한다', () => {
    // ELK 경로: (100,50) → (150,50) → (150,90) → (200,90). 진입 높이 y=50/90.
    const points: RoutePoint[] = [
      { x: 100, y: 50 },
      { x: 150, y: 50 },
      { x: 150, y: 90 },
      { x: 200, y: 90 },
    ]
    const snapped = snapRouteEndpoints(points, { x: 98, y: 53 }, { x: 204, y: 88 })

    // 진짜 종단점은 핸들 중심
    expect(snapped[0]).toEqual({ x: 98, y: 53 })
    expect(snapped.at(-1)).toEqual({ x: 204, y: 88 })
    // 그 다음 점은 노드 테두리(핸들 x) + ELK 진입 높이 → 짧은 수직 연결
    expect(snapped[1]).toEqual({ x: 150, y: 53 })
    expect(snapped.at(-2)).toEqual({ x: 150, y: 88 })
    // 코리도어(중간 수평 구간)는 그대로 유지
    expect(snapped).toHaveLength(4)
  })

  it('진입 높이가 핸들 중심과 같으면 중복 없이 매끈하게 이어진다', () => {
    const snapped = snapRouteEndpoints(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      { x: 2, y: 0 },
      { x: 98, y: 0 },
    )
    // spreadY == centerY 이면 수직 연결이 0길이라 dedupe로 사라진다
    expect(snapped).toEqual([{ x: 2, y: 0 }, { x: 98, y: 0 }])
  })

  it('높이가 다른 2점 경로는 중앙에서 꺾어 종단을 수평으로 만든다', () => {
    const snapped = snapRouteEndpoints(
      [{ x: 0, y: 0 }, { x: 100, y: 20 }],
      { x: 2, y: 1 },
      { x: 98, y: 19 },
    )

    expect(snapped).toEqual([
      { x: 2, y: 1 },
      { x: 50, y: 1 },
      { x: 50, y: 19 },
      { x: 98, y: 19 },
    ])
  })

  it('빈 배열·1점 입력은 그대로 반환한다', () => {
    expect(snapRouteEndpoints([], { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual([])
    expect(snapRouteEndpoints([{ x: 5, y: 5 }], { x: 0, y: 0 }, { x: 1, y: 1 }))
      .toEqual([{ x: 5, y: 5 }])
  })
})

describe('findParallelOverlaps', () => {
  it('두 경로가 같은 수평 구간을 8px 넘게 공유하면 검출한다', () => {
    const a: RoutePoint[] = [{ x: 0, y: 100 }, { x: 200, y: 100 }]
    const b: RoutePoint[] = [{ x: 50, y: 100 }, { x: 150, y: 100 }]
    const overlaps = findParallelOverlaps([a, b], 8)
    expect(overlaps).toHaveLength(1)
    expect(overlaps[0]).toMatchObject({ routeA: 0, routeB: 1 })
  })

  it('겹침 길이가 임계값 이하이거나 서로 다른 y면 검출하지 않는다', () => {
    const a: RoutePoint[] = [{ x: 0, y: 100 }, { x: 200, y: 100 }]
    const shortOverlap: RoutePoint[] = [{ x: 100, y: 100 }, { x: 106, y: 100 }]
    const differentY: RoutePoint[] = [{ x: 0, y: 108 }, { x: 200, y: 108 }]
    expect(findParallelOverlaps([a, shortOverlap], 8)).toHaveLength(0)
    expect(findParallelOverlaps([a, differentY], 8)).toHaveLength(0)
  })

  it('수직 병주도 검출한다', () => {
    const a: RoutePoint[] = [{ x: 100, y: 0 }, { x: 100, y: 200 }]
    const b: RoutePoint[] = [{ x: 100, y: 40 }, { x: 100, y: 160 }]
    expect(findParallelOverlaps([a, b], 8)).toHaveLength(1)
  })
})

describe('routeMidpoint', () => {
  it('폴리라인 전체 길이의 절반 지점을 반환한다', () => {
    // 길이 100 + 100 = 200, 중점은 두 번째 구간 시작점
    const mid = routeMidpoint([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])
    expect(mid).toEqual({ x: 100, y: 0 })
  })

  it('빈 배열은 원점을 반환한다', () => {
    expect(routeMidpoint([])).toEqual({ x: 0, y: 0 })
  })
})
