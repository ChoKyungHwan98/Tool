export interface RoutePoint {
  readonly x: number
  readonly y: number
}

export interface RegisteredRoute {
  readonly order: number
  readonly points: readonly RoutePoint[]
}

export interface RouteObstacle {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export function routeSignature(route: RegisteredRoute): string {
  return `${route.order}:${route.points.map((point) => `${point.x},${point.y}`).join(';')}`
}

export function dedupeRoutePoints(points: readonly RoutePoint[]): RoutePoint[] {
  return points.filter((point, index) => index === 0 || point.x !== points[index - 1]?.x || point.y !== points[index - 1]?.y)
}

function segmentIntersectsObstacle(start: RoutePoint, end: RoutePoint, obstacle: RouteObstacle): boolean {
  if (start.y === end.y) {
    const segmentLeft = Math.min(start.x, end.x)
    const segmentRight = Math.max(start.x, end.x)
    return start.y > obstacle.top && start.y < obstacle.bottom
      && segmentRight > obstacle.left && segmentLeft < obstacle.right
  }
  if (start.x === end.x) {
    const segmentTop = Math.min(start.y, end.y)
    const segmentBottom = Math.max(start.y, end.y)
    return start.x > obstacle.left && start.x < obstacle.right
      && segmentBottom > obstacle.top && segmentTop < obstacle.bottom
  }
  return true
}

export function normalizeNearAlignedRoute(
  points: readonly RoutePoint[],
  obstacles: readonly RouteObstacle[],
  maximumVerticalDelta = 12,
  minimumHorizontalGap = 64,
): RoutePoint[] {
  const route = dedupeRoutePoints(points)
  const start = route[0]
  const end = route.at(-1)
  if (!start || !end) return route
  if (Math.abs(end.x - start.x) < minimumHorizontalGap || Math.abs(end.y - start.y) > maximumVerticalDelta) return route

  const middleX = (start.x + end.x) / 2
  const candidate = dedupeRoutePoints([
    start,
    { x: middleX, y: start.y },
    { x: middleX, y: end.y },
    end,
  ])
  const blocked = candidate.slice(0, -1).some((point, index) => (
    obstacles.some((obstacle) => segmentIntersectsObstacle(point, candidate[index + 1]!, obstacle))
  ))

  return blocked ? route : candidate
}

export function separateParallelSegments(points: readonly RoutePoint[], order: number, spacing = 8): RoutePoint[] {
  const route = dedupeRoutePoints(points)
  const start = route[0]
  const end = route.at(-1)
  if (!start || !end || route.length < 3 || order <= 0 || end.x <= start.x + 48) return route

  const maximumOffset = Math.max(0, end.x - start.x - 64)
  const offset = Math.min((order % 8) * spacing, maximumOffset)
  if (offset <= 0) return route

  const verticalCorridors = new Set<number>()
  for (let index = 0; index < route.length - 1; index += 1) {
    const current = route[index]!
    const next = route[index + 1]!
    if (current.x === next.x && current.x !== start.x && current.x !== end.x) verticalCorridors.add(current.x)
  }

  return route.map((point, index) => (
    index > 0 && index < route.length - 1 && verticalCorridors.has(point.x)
      ? { x: point.x + offset, y: point.y }
      : point
  ))
}

interface Crossing {
  readonly x: number
  readonly y: number
  readonly distance: number
}

function segmentCrossings(
  start: RoutePoint,
  end: RoutePoint,
  otherRoutes: readonly RegisteredRoute[],
  endpointClearance = 8,
): Crossing[] {
  const horizontal = start.y === end.y
  const vertical = start.x === end.x
  if (!horizontal && !vertical) return []

  const crossings: Crossing[] = []
  for (const route of otherRoutes) {
    for (let index = 0; index < route.points.length - 1; index += 1) {
      const otherStart = route.points[index]!
      const otherEnd = route.points[index + 1]!
      const otherHorizontal = otherStart.y === otherEnd.y
      const otherVertical = otherStart.x === otherEnd.x
      if ((horizontal && otherHorizontal) || (vertical && otherVertical)) continue

      const x = horizontal ? otherStart.x : start.x
      const y = horizontal ? start.y : otherStart.y
      const withinCurrent = x > Math.min(start.x, end.x) && x < Math.max(start.x, end.x)
        || y > Math.min(start.y, end.y) && y < Math.max(start.y, end.y)
      const withinOther = x > Math.min(otherStart.x, otherEnd.x) && x < Math.max(otherStart.x, otherEnd.x)
        || y > Math.min(otherStart.y, otherEnd.y) && y < Math.max(otherStart.y, otherEnd.y)
      if (!withinCurrent || !withinOther) continue

      const distance = horizontal ? Math.abs(x - start.x) : Math.abs(y - start.y)
      if (distance > endpointClearance && distance < (horizontal ? Math.abs(end.x - start.x) : Math.abs(end.y - start.y)) - endpointClearance) {
        crossings.push({ x, y, distance })
      }
    }
  }

  return crossings.sort((left, right) => left.distance - right.distance)
}

export function buildBridgePath(points: readonly RoutePoint[], otherRoutes: readonly RegisteredRoute[], radius = 5): string {
  const route = dedupeRoutePoints(points)
  if (route.length === 0) return ''
  let path = `M ${route[0]!.x},${route[0]!.y}`

  for (let index = 0; index < route.length - 1; index += 1) {
    const start = route[index]!
    const end = route[index + 1]!
    const horizontal = start.y === end.y
    const vertical = start.x === end.x
    const endpointClearance = index === 0 || index === route.length - 2 ? 24 : 8
    const crossings = segmentCrossings(start, end, otherRoutes, endpointClearance)
    const xDirection = Math.sign(end.x - start.x)
    const yDirection = Math.sign(end.y - start.y)

    for (const crossing of crossings) {
      if (horizontal) {
        const beforeX = crossing.x - xDirection * radius
        const afterX = crossing.x + xDirection * radius
        const bridgeY = crossing.y - radius
        // Keep crossings orthogonal. A quadratic bridge looks curved when the
        // canvas is zoomed out, which makes otherwise straight routes appear
        // to bend.
        path += ` L ${beforeX},${crossing.y} L ${beforeX},${bridgeY} L ${afterX},${bridgeY} L ${afterX},${crossing.y}`
      } else if (vertical) {
        const beforeY = crossing.y - yDirection * radius
        const afterY = crossing.y + yDirection * radius
        const bridgeX = crossing.x + radius
        path += ` L ${crossing.x},${beforeY} L ${bridgeX},${beforeY} L ${bridgeX},${afterY} L ${crossing.x},${afterY}`
      }
    }
    path += ` L ${end.x},${end.y}`
  }

  return path
}

// ELK 경로의 양 끝을 실제 React Flow 핸들 좌표(행 중심)에 정확히 착지시킨다.
// ELK가 벌려놓은 진입 높이(코리도어)는 그대로 두고, 노드 테두리에서 행 중심까지
// 짧은 연결선만 덧붙인다. 이렇게 하면 선 본체는 서로 겹치지 않으면서도
// 화살표는 참조 대상 열의 정중앙에 꽂힌다.
export function snapRouteEndpoints(
  points: readonly RoutePoint[],
  sourcePoint: RoutePoint,
  targetPoint: RoutePoint,
): RoutePoint[] {
  if (points.length < 2) return [...points]
  if (points.length === 2 && sourcePoint.x !== targetPoint.x && sourcePoint.y !== targetPoint.y) {
    const middleX = (sourcePoint.x + targetPoint.x) / 2
    return dedupeRoutePoints([
      sourcePoint,
      { x: middleX, y: sourcePoint.y },
      { x: middleX, y: targetPoint.y },
      targetPoint,
    ])
  }

  const snapped = points.map((point) => ({ ...point }))
  const first = snapped[0]!
  const second = snapped[1]!
  const last = snapped.at(-1)!
  const beforeLast = snapped.at(-2)!

  if (snapped.length > 2) {
    if (Math.abs(second.y - first.y) <= 0.5) second.y = sourcePoint.y
    else if (Math.abs(second.x - first.x) <= 0.5) second.x = sourcePoint.x

    if (Math.abs(beforeLast.y - last.y) <= 0.5) beforeLast.y = targetPoint.y
    else if (Math.abs(beforeLast.x - last.x) <= 0.5) beforeLast.x = targetPoint.x
  }
  // ELK 경로의 양 끝을 실제 관계별 핸들 중심에 맞춘다.
  snapped[0] = { ...sourcePoint }
  snapped[snapped.length - 1] = { ...targetPoint }

  return dedupeRoutePoints(snapped)
}

export interface ParallelOverlap {
  readonly routeA: number
  readonly routeB: number
  readonly length: number
}

interface AxisSegment {
  readonly axis: 'h' | 'v'
  readonly at: number
  readonly from: number
  readonly to: number
}

function axisSegments(points: readonly RoutePoint[]): AxisSegment[] {
  const segments: AxisSegment[] = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!
    const end = points[index + 1]!
    if (start.y === end.y && start.x !== end.x) {
      segments.push({ axis: 'h', at: start.y, from: Math.min(start.x, end.x), to: Math.max(start.x, end.x) })
    } else if (start.x === end.x && start.y !== end.y) {
      segments.push({ axis: 'v', at: start.x, from: Math.min(start.y, end.y), to: Math.max(start.y, end.y) })
    }
  }
  return segments
}

export function findParallelOverlaps(
  routes: readonly (readonly RoutePoint[])[],
  minimumOverlap = 8,
): ParallelOverlap[] {
  const segmentsByRoute = routes.map(axisSegments)
  const overlaps: ParallelOverlap[] = []

  for (let a = 0; a < routes.length; a += 1) {
    for (let b = a + 1; b < routes.length; b += 1) {
      let longest = 0
      for (const segmentA of segmentsByRoute[a]!) {
        for (const segmentB of segmentsByRoute[b]!) {
          if (segmentA.axis !== segmentB.axis || segmentA.at !== segmentB.at) continue
          const overlap = Math.min(segmentA.to, segmentB.to) - Math.max(segmentA.from, segmentB.from)
          if (overlap > longest) longest = overlap
        }
      }
      if (longest > minimumOverlap) overlaps.push({ routeA: a, routeB: b, length: longest })
    }
  }

  return overlaps
}

export interface ResolvedEdgePoints {
  readonly kind: 'elk' | 'live'
  readonly points: readonly RoutePoint[]
}

// 자동 배치가 저장한 ELK 경로가 있으면 우선 사용하고, 없거나 무효화됐으면
// 라이브 A* 라우팅 결과를 쓴다. ELK 경로는 x만 핸들 좌표에 스냅해 노드
// 테두리에 붙이고 y는 ELK가 벌려놓은 진입 높이를 유지한다 — 같은 열을
// 참조하는 관계들의 핸들 y가 전부 동일해서, y까지 스냅하면 ELK의 포트
// 분산이 무효화되어 선이 다시 합쳐진다.
export function resolveEdgePoints(
  storedRoute: readonly RoutePoint[] | undefined,
  livePoints: readonly RoutePoint[],
  endpoints: { readonly sourceX: number; readonly sourceY: number; readonly targetX: number; readonly targetY: number },
): ResolvedEdgePoints {
  if (storedRoute && storedRoute.length >= 2) {
    return {
      kind: 'elk',
      points: snapRouteEndpoints(
        storedRoute,
        { x: endpoints.sourceX, y: endpoints.sourceY },
        { x: endpoints.targetX, y: endpoints.targetY },
      ),
    }
  }
  return { kind: 'live', points: livePoints }
}

export function routeMidpoint(points: readonly RoutePoint[]): RoutePoint {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return { ...points[0]! }

  const total = points.slice(0, -1).reduce((sum, point, index) => {
    const next = points[index + 1]!
    return sum + Math.abs(next.x - point.x) + Math.abs(next.y - point.y)
  }, 0)

  let remaining = total / 2
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!
    const end = points[index + 1]!
    const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
    if (length >= remaining) {
      const ratio = length === 0 ? 0 : remaining / length
      return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio }
    }
    remaining -= length
  }
  return { ...points.at(-1)! }
}
