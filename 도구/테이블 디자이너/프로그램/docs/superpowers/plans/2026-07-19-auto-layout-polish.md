# 자동 배치 폴리싱 (ELK 엣지 경로 하이브리드 + 전체 구조 PNG) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자동 배치 시 ELK가 계산한 엣지 경로를 저장·렌더해 참조선 겹침(병주)을 없애고, 전체 구조를 2배 해상도 PNG로 다운로드할 수 있게 한다.

**Architecture:** ELK layered 레이아웃 결과에서 노드 좌표뿐 아니라 엣지 섹션(bendpoint)도 추출해 zustand 스토어의 일시 상태로 저장한다. `SmartRelationEdge`는 저장 경로가 있으면 우선 렌더하고, 노드 드래그·스키마 변경 시 커맨드 타입 기준으로 무효화해 라이브 A* 라우팅으로 폴백한다. PNG 내보내기는 `exporting` 플래그 하나로 파생 상태(focus·선택·줌 LOD)를 오버라이드해 캡처하므로 복구 로직이 필요 없다.

**Tech Stack:** elkjs (기존), @xyflow/react (기존), zustand (기존), html-to-image (신규 devDependency 아님 — dependency), vitest.

**설계 근거:** `C:\Users\Admin\.gstack\projects\unknown\Admin-master-design-20260719-auto-layout-polish.md` (승인됨, 2회 적대적 리뷰 통과)

---

## File Structure

| 파일 | 작업 | 책임 |
|---|---|---|
| `src/presentation/smartRelationRouting.ts` | Modify | 순수 경로 유틸: `snapRouteEndpoints`, `findParallelOverlaps`, `routeMidpoint` 추가 |
| `src/presentation/smartRelationRouting.test.ts` | Create | 위 순수 함수 테스트 |
| `src/presentation/schemaLayout.ts` | Modify | `elk.json.edgeCoords` 옵션 + 간격 튜닝 + `extractElkEdgeRoutes` |
| `src/presentation/schemaLayout.test.ts` | Modify | 섹션 추출 유닛 테스트 추가 |
| `src/presentation/schemaLayout.elk.test.ts` | Create | 실제 ELK 실행 통합 테스트 (게임 D 병주 회귀) |
| `src/presentation/state/workbenchStore.ts` | Modify | `elkRoutes` 상태 + `setElkRoutes`/`clearElkRoutes` + 커맨드 타입 기준 무효화 |
| `src/presentation/state/workbenchStore.elkRoutes.test.ts` | Create | 무효화 규칙 테스트 |
| `src/presentation/components/SchemaCanvas.tsx` | Modify | `draggingNodeId` 리팩터링, `buildSchemaEdges` export, ELK 경로 저장 연결, 이미지 저장 버튼 + `exporting` 오버라이드 |
| `src/presentation/components/schemaCanvasEdges.test.ts` | Create | `buildSchemaEdges` 드래그 부분 전환 테스트 |
| `src/presentation/components/SmartRelationEdge.tsx` | Modify | 저장 경로 우선 렌더 + 레지스트리 등록 유지 |
| `src/presentation/components/SmartRelationEdge.test.ts` | Modify | 저장 경로 우선/폴백 테스트 추가 |
| `src/presentation/diagramImageExport.ts` | Create | 파일명·캡처 필터·출력 변환 계산 (순수 함수) |
| `src/presentation/diagramImageExport.test.ts` | Create | 위 순수 함수 테스트 |

---

### Task 1: 순수 경로 유틸 — snapRouteEndpoints · findParallelOverlaps · routeMidpoint

ELK가 준 경로의 시작·끝점을 React Flow 핸들 좌표에 스냅하고(직각 유지), 병주(두 선이 같은 구간을 겹쳐 달리는 것) 검출기와 폴리라인 중점 계산을 만든다. 전부 DOM 없는 순수 함수라 TDD가 쉽다.

**Files:**
- Modify: `src/presentation/smartRelationRouting.ts`
- Create: `src/presentation/smartRelationRouting.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/presentation/smartRelationRouting.test.ts` 생성:

```ts
import { describe, expect, it } from 'vitest'
import {
  findParallelOverlaps,
  routeMidpoint,
  snapRouteEndpoints,
  type RoutePoint,
} from './smartRelationRouting'

describe('snapRouteEndpoints', () => {
  it('시작·끝점을 핸들 좌표로 바꾸고 인접 꺾임점을 같은 축으로 따라오게 한다', () => {
    // ELK 경로: (100,50) → (150,50) → (150,90) → (200,90). 첫·끝 구간은 수평.
    const points: RoutePoint[] = [
      { x: 100, y: 50 },
      { x: 150, y: 50 },
      { x: 150, y: 90 },
      { x: 200, y: 90 },
    ]
    const snapped = snapRouteEndpoints(points, { x: 98, y: 53 }, { x: 204, y: 88 })

    expect(snapped[0]).toEqual({ x: 98, y: 53 })
    expect(snapped[1]).toEqual({ x: 150, y: 53 }) // 첫 구간이 수평이므로 y가 따라옴
    expect(snapped.at(-2)).toEqual({ x: 150, y: 88 }) // 끝 구간이 수평이므로 y가 따라옴
    expect(snapped.at(-1)).toEqual({ x: 204, y: 88 })
  })

  it('점이 2개뿐이면 양 끝만 교체한다', () => {
    const snapped = snapRouteEndpoints(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      { x: 2, y: 1 },
      { x: 98, y: 1 },
    )
    expect(snapped).toEqual([{ x: 2, y: 1 }, { x: 98, y: 1 }])
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/presentation/smartRelationRouting.test.ts`
Expected: FAIL — `findParallelOverlaps`, `routeMidpoint`, `snapRouteEndpoints` export 없음

- [ ] **Step 3: 구현**

`src/presentation/smartRelationRouting.ts` 끝에 추가:

```ts
export function snapRouteEndpoints(
  points: readonly RoutePoint[],
  sourcePoint: RoutePoint,
  targetPoint: RoutePoint,
): RoutePoint[] {
  if (points.length < 2) return [...points]

  const snapped = points.map((point) => ({ ...point }))
  const first = snapped[0]!
  const second = snapped[1]!
  const last = snapped.at(-1)!
  const beforeLast = snapped.at(-2)!

  // 인접 꺾임점을 같은 축으로 따라오게 해 직각(orthogonal) 형태를 유지한다.
  if (snapped.length > 2) {
    if (second.y === first.y) second.y = sourcePoint.y
    else if (second.x === first.x) second.x = sourcePoint.x
    if (beforeLast.y === last.y) beforeLast.y = targetPoint.y
    else if (beforeLast.x === last.x) beforeLast.x = targetPoint.x
  }

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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/presentation/smartRelationRouting.test.ts`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add src/presentation/smartRelationRouting.ts src/presentation/smartRelationRouting.test.ts
git commit -m "feat: 경로 스냅·병주 검출·중점 계산 순수 유틸 추가"
```

---

### Task 2: schemaLayout — edgeCoords 옵션 · 간격 튜닝 · extractElkEdgeRoutes

ELK에 엣지 좌표를 루트 기준으로 달라고 요청하고, 결과 그래프에서 relationId별 경로를 추출한다. 간격도 엣지 통로가 확보되게 넓힌다.

**Files:**
- Modify: `src/presentation/schemaLayout.ts`
- Modify: `src/presentation/schemaLayout.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/presentation/schemaLayout.test.ts`에 추가 (기존 import에 `extractElkEdgeRoutes` 추가):

```ts
import { buildElkLayoutGraph, extractElkEdgeRoutes } from './schemaLayout'

describe('buildElkLayoutGraph edge routing options', () => {
  it('엣지 좌표를 루트 기준으로 요청한다', () => {
    const graph = buildElkLayoutGraph(gameCSampleProject)
    expect(graph.layoutOptions?.['elk.json.edgeCoords']).toBe('ROOT')
  })
})

describe('extractElkEdgeRoutes', () => {
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
```

주: 기존 테스트 파일이 `gameCSampleProject`를 import하지 않으면 `import { gameCSampleProject } from '../domain/gameCSampleProject'` 추가. 파일의 기존 describe 구조는 유지.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/presentation/schemaLayout.test.ts`
Expected: FAIL — `extractElkEdgeRoutes` export 없음, `elk.json.edgeCoords` undefined

- [ ] **Step 3: 구현**

`src/presentation/schemaLayout.ts` 수정.

(1) import에 타입 추가:

```ts
import type { ElkExtendedEdge, ElkNode, ElkPort } from 'elkjs/lib/elk-api'
import type { RoutePoint } from './smartRelationRouting'
```

(2) `buildElkLayoutGraph`의 루트 `layoutOptions`를 다음으로 교체 (간격 튜닝 + edgeCoords):

```ts
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.json.edgeCoords': 'ROOT',
      'elk.spacing.nodeNode': '48',
      'elk.spacing.edgeEdge': '12',
      'elk.spacing.edgeNode': '24',
      'elk.spacing.componentComponent': '72',
      'elk.separateConnectedComponents': 'true',
      'elk.layered.compaction.connectedComponents': 'true',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.layered.spacing.edgeNodeBetweenLayers': '36',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '24',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.unnecessaryBendpoints': 'true',
    },
```

(3) 파일 끝에 추출 함수 추가:

```ts
export function extractElkEdgeRoutes(graph: ElkNode): Map<EntityId, RoutePoint[]> {
  const routes = new Map<EntityId, RoutePoint[]>()

  for (const edge of (graph.edges ?? []) as ElkExtendedEdge[]) {
    const section = edge.sections?.[0]
    if (!section) continue
    routes.set(edge.id, [
      { x: section.startPoint.x, y: section.startPoint.y },
      ...(section.bendPoints ?? []).map((point) => ({ x: point.x, y: point.y })),
      { x: section.endPoint.x, y: section.endPoint.y },
    ])
  }

  return routes
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/presentation/schemaLayout.test.ts`
Expected: PASS (기존 테스트 포함 전체 — 기존 테스트가 간격 수치를 스냅샷하고 있다면 새 수치로 갱신)

- [ ] **Step 5: 커밋**

```bash
git add src/presentation/schemaLayout.ts src/presentation/schemaLayout.test.ts
git commit -m "feat: ELK 엣지 경로 루트 좌표 요청·추출 및 간격 튜닝"
```

---

### Task 3: ELK 통합 회귀 테스트 — 게임 D 병주 0쌍 검증

실제 ELK를 노드 환경에서 돌려(워커 없이 번들판) 게임 D 25개 테이블에서 8px 초과 병주가 없는지 검증한다. 이 테스트가 간격 수치의 안전망이다.

**Files:**
- Create: `src/presentation/schemaLayout.elk.test.ts`

- [ ] **Step 1: 실패 가능성이 있는 통합 테스트 작성**

```ts
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
```

주: `gameDComplexProject`의 실제 export 이름은 `src/domain/gameDComplexProject.ts`에서 확인해 맞춘다 (예: `createGameDComplexProject()` 팩토리라면 호출 형태로).

- [ ] **Step 2: 테스트 실행**

Run: `npx vitest run src/presentation/schemaLayout.elk.test.ts`
Expected: PASS. **FAIL(병주 검출)이라면** `elk.spacing.edgeEdge`를 12→16, `edgeEdgeBetweenLayers`를 24→32로 올리며 재실행. edgeCoords가 ROOT 좌표로 안 나오는 경우(모든 경로가 컴포넌트 상대 좌표로 뭉침)라면 설계 문서 Open Questions의 폴백대로 컨테이너 오프셋(각 컴포넌트 child의 x/y)을 수동 합산하는 코드를 `extractElkEdgeRoutes`에 추가한다.

- [ ] **Step 3: 커밋**

```bash
git add src/presentation/schemaLayout.elk.test.ts
git commit -m "test: 게임 D ELK 배치 병주 회귀 테스트"
```

---

### Task 4: workbenchStore — elkRoutes 상태와 커맨드 타입 기준 무효화

**Files:**
- Modify: `src/presentation/state/workbenchStore.ts`
- Create: `src/presentation/state/workbenchStore.elkRoutes.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { sampleIds } from '../../domain/sampleProject'
import { useWorkbenchStore } from './workbenchStore'
import type { RoutePoint } from '../smartRelationRouting'

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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/presentation/state/workbenchStore.elkRoutes.test.ts`
Expected: FAIL — `setElkRoutes`/`clearElkRoutes`/`elkRoutes` 없음

- [ ] **Step 3: 구현**

`src/presentation/state/workbenchStore.ts` 수정.

(1) import 추가:

```ts
import type { RoutePoint } from '../smartRelationRouting'
```

(`MoveTableLayoutCommand`, `MoveTablesLayoutCommand`는 이미 import되어 있음 — 47~48행.)

(2) `WorkbenchState` 인터페이스에 추가 (`runCommand` 선언 근처, 192행 부근):

```ts
  elkRoutes: ReadonlyMap<EntityId, readonly RoutePoint[]>
  setElkRoutes(routes: ReadonlyMap<EntityId, readonly RoutePoint[]>): void
  clearElkRoutes(): void
```

(3) 스토어 초기값(203행 `create<WorkbenchState>((set, get) => ({` 바로 아래 상태 블록)에 추가:

```ts
  elkRoutes: new Map(),
```

(4) 액션 구현 추가 (`moveTablesLayout` 정의 근처):

```ts
  setElkRoutes: (routes) => {
    set({ elkRoutes: new Map(routes) })
  },
  clearElkRoutes: () => {
    if (get().elkRoutes.size === 0) return
    set({ elkRoutes: new Map() })
  },
```

(5) `runCommand`(1191행)에 무효화 분기 추가. `set({...})` 호출에 `elkRoutes` 키를 합친다:

```ts
  runCommand: (command) => {
    const state = get()
    const undoable = materializeCommandForUndo(state.document.schema, command)
    const nextSchema = commandFromSerialized(undoable).execute(state.document.schema)
    const nextDocument = replaceDocumentSchema(state.document, nextSchema)
    const historyEntry = documentHistory(
      state.document,
      nextDocument,
      command.describe(state.document.schema),
      undoable,
    )

    set({
      document: nextDocument,
      undoStack: [...state.undoStack, historyEntry],
      redoStack: [],
      saveState: { status: 'dirty' },
      elkRoutes: nextElkRoutesAfterCommand(state.elkRoutes, state.document.schema, command),
    })
    scheduleAutosave()
  },
```

파일 상단(스토어 정의 밖)에 헬퍼 추가:

```ts
function nextElkRoutesAfterCommand(
  current: ReadonlyMap<EntityId, readonly RoutePoint[]>,
  schema: SchemaProject,
  command: SchemaCommand,
): ReadonlyMap<EntityId, readonly RoutePoint[]> {
  if (current.size === 0) return current

  // 수동 드래그: 그 테이블에 붙은 관계 경로만 부분 무효화.
  if (command instanceof MoveTableLayoutCommand) {
    const next = new Map(current)
    for (const relation of schema.relations) {
      if (relation.sourceTableId === command.tableId || relation.targetTableId === command.tableId) {
        next.delete(relation.relationId)
      }
    }
    return next
  }

  // 자동 배치 포함 그 외 전부: 전체 무효화. 자동 배치는 직후 setElkRoutes로 새 경로를 채운다.
  // 커맨드 25종에 부분 무효화를 개별 구현하지 않는다 — 잘못된 경로가 남는 것보다
  // 라이브 폴백이 낫고, 자동 배치를 다시 누르면 복구된다.
  return new Map()
}
```

주: `SchemaProject` 타입이 이 파일에 이미 import되어 있는지 확인하고 없으면 추가.

(6) `undo`(1224행)·`redo`(1240행)·`runDocumentTransaction`(1211행)의 각 `set({...})`에 `elkRoutes: new Map(),` 추가.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/presentation/state/workbenchStore.elkRoutes.test.ts`
Expected: PASS

Run: `npx vitest run src/presentation/state`
Expected: 기존 스토어 테스트 전체 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/presentation/state/workbenchStore.ts src/presentation/state/workbenchStore.elkRoutes.test.ts
git commit -m "feat: elkRoutes 상태와 커맨드 타입 기준 무효화"
```

---

### Task 5: SchemaCanvas — draggingNodeId 리팩터링 (필수 선행)

전역 불리언 `draggingNode`를 노드 ID로 바꿔, 드래그 중인 노드에 붙은 선만 `step`으로 전환한다. `buildSchemaEdges`를 export해 테스트한다.

**Files:**
- Modify: `src/presentation/components/SchemaCanvas.tsx`
- Create: `src/presentation/components/schemaCanvasEdges.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from 'vitest'
import { gameCSampleProject } from '../../domain/gameCSampleProject'
import { buildSchemaEdges } from './SchemaCanvas'

const noopHandlers = {
  onHoverEnd: () => undefined,
  onHoverStart: () => undefined,
  onSelect: () => undefined,
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
    for (const edge of edges) expect(edge.type).toBe('smartRelation')
  })
})
```

주: `gameCSampleProject`의 실제 export 이름은 파일에서 확인해 맞춘다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/presentation/components/schemaCanvasEdges.test.ts`
Expected: FAIL — `buildSchemaEdges` export 없음

- [ ] **Step 3: 구현**

`src/presentation/components/SchemaCanvas.tsx` 수정.

(1) `buildSchemaEdges`에 `export` 추가, 시그니처의 `dragging: boolean` → `draggingNodeId: EntityId | null`:

```ts
export function buildSchemaEdges(
  project: SchemaProject,
  selectedTableId: EntityId | null,
  focus: RelationFocus,
  focusedRelationIds: ReadonlySet<EntityId>,
  invalidRelationIds: ReadonlySet<EntityId>,
  hoveredRelationId: EntityId | null,
  selectedRelationId: EntityId | null,
  draggingNodeId: EntityId | null,
  handlers: { ... 기존 그대로 ... },
): Edge[] {
```

(2) 엣지 map 안의 `type` 계산 교체 (397행):

```ts
      const liveDragging = draggingNodeId !== null
        && (relation.sourceTableId === draggingNodeId || relation.targetTableId === draggingNodeId)
```

```ts
        type: liveDragging ? 'step' : 'smartRelation',
```

(3) 컴포넌트 상태 교체 (432행):

```ts
  const [draggingNodeId, setDraggingNodeId] = useState<EntityId | null>(null)
```

edges useMemo(465행)의 인자 `draggingNode` → `draggingNodeId`, 의존성 배열도 갱신.

(4) ReactFlow 핸들러 교체 (724행):

```ts
              onNodeDragStart={(_, node) => setDraggingNodeId(node.id)}
              onNodeDragStop={(_, node) => {
                setDraggingNodeId(null)
                moveTableLayout(node.id, node.position.x, node.position.y)
              }}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/presentation/components/schemaCanvasEdges.test.ts && npx tsc -b`
Expected: PASS, 타입 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add src/presentation/components/SchemaCanvas.tsx src/presentation/components/schemaCanvasEdges.test.ts
git commit -m "refactor: 드래그 전역 플래그를 노드 ID 기준 부분 전환으로 변경"
```

---

### Task 6: SmartRelationEdge — 저장 ELK 경로 우선 렌더

**Files:**
- Modify: `src/presentation/components/SmartRelationEdge.tsx`
- Modify: `src/presentation/components/SmartRelationEdge.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

기존 `SmartRelationEdge.test.ts`의 패턴을 확인하고 (렌더 테스트가 아니라 유틸 테스트라면 그 스타일에 맞춰) 다음 순수 로직을 분리 테스트한다. `SmartRelationEdge.tsx`에서 경로 결정 로직을 순수 함수로 추출해 테스트 가능하게 만든다:

```ts
import { describe, expect, it } from 'vitest'
import { resolveEdgePoints } from './SmartRelationEdge'

describe('resolveEdgePoints', () => {
  const endpoints = { sourceX: 0, sourceY: 5, targetX: 200, targetY: 105 }

  it('저장 ELK 경로가 있으면 스냅해서 우선 사용한다', () => {
    const stored = [{ x: 2, y: 4 }, { x: 100, y: 4 }, { x: 100, y: 104 }, { x: 198, y: 104 }]
    const resolved = resolveEdgePoints(stored, [{ x: 0, y: 0 }, { x: 50, y: 50 }], endpoints)
    expect(resolved.kind).toBe('elk')
    expect(resolved.points[0]).toEqual({ x: 0, y: 5 })
    expect(resolved.points.at(-1)).toEqual({ x: 200, y: 105 })
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/presentation/components/SmartRelationEdge.test.ts`
Expected: FAIL — `resolveEdgePoints` export 없음

- [ ] **Step 3: 구현**

`src/presentation/components/SmartRelationEdge.tsx` 수정.

(1) import 추가:

```ts
import { useWorkbenchStore } from '../state/workbenchStore'
import {
  buildBridgePath,
  dedupeRoutePoints,
  normalizeNearAlignedRoute,
  routeMidpoint,
  routeSignature,
  separateParallelSegments,
  snapRouteEndpoints,
  type RegisteredRoute,
  type RouteObstacle,
  type RoutePoint,
} from '../smartRelationRouting'
```

(2) 순수 결정 함수 export:

```ts
export interface ResolvedEdgePoints {
  readonly kind: 'elk' | 'live'
  readonly points: readonly RoutePoint[]
}

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
```

(3) `SmartRelationEdge` 컴포넌트 수정 — 저장 경로 조회와 통합:

```ts
export function SmartRelationEdge(props: EdgeProps) {
  const route = useSmartEdgeRoute(props)
  const storedRoute = useWorkbenchStore((state) => state.elkRoutes.get(props.id))
  const viewport = useViewport()
  const paneWidth = useStore((state) => state.width)
  const paneHeight = useStore((state) => state.height)
  const { obstacles, routes, register } = useContext(RouteRegistryContext)
  const data = (props.data ?? {}) as RelationEdgeData
  const order = data.routeOrder ?? 0

  const livePoints = useMemo(() => {
    if (!route) return []
    const baseRoute = dedupeRoutePoints([
      { x: props.sourceX, y: props.sourceY },
      ...route.points.map(([x, y]) => ({ x: x ?? 0, y: y ?? 0 })),
      { x: props.targetX, y: props.targetY },
    ])
    const unrelatedObstacles = obstacles.filter((obstacle) => obstacle.nodeId !== props.source && obstacle.nodeId !== props.target)
    return separateParallelSegments(normalizeNearAlignedRoute(baseRoute, unrelatedObstacles), order)
  }, [obstacles, order, props.source, props.sourceX, props.sourceY, props.target, props.targetX, props.targetY, route])

  const resolved = useMemo(
    () => resolveEdgePoints(storedRoute, livePoints, {
      sourceX: props.sourceX, sourceY: props.sourceY,
      targetX: props.targetX, targetY: props.targetY,
    }),
    [livePoints, props.sourceX, props.sourceY, props.targetX, props.targetY, storedRoute],
  )
  const points = resolved.points

  useEffect(() => {
    register(props.id, points.length >= 2 ? { order, points: [...points] } : null)
    return () => register(props.id, null)
  }, [order, points, props.id, register])

  if (resolved.kind === 'live' && !route) return <StepEdge {...props} />

  const earlierRoutes = [...routes.entries()]
    .filter(([edgeId, registered]) => edgeId !== props.id && registered.order < order)
    .map(([, registered]) => registered)
  const bridgedPath = buildBridgePath(points, earlierRoutes)
  const center = resolved.kind === 'elk' || !route
    ? routeMidpoint(points)
    : { x: route.edgeCenterX, y: route.edgeCenterY }
  const popoverPoint = clampRelationPopoverPoint(center, viewport, { width: paneWidth, height: paneHeight })
```

이후 JSX에서 `route.svgPathString` 폴백과 `labelX/labelY`를 `center` 기준으로 교체:

```ts
        <BaseEdge
          id={props.id}
          path={bridgedPath}
          label={props.label}
          labelX={center.x}
          labelY={center.y}
          ...나머지 기존 그대로...
        />
```

`data-route-kind` 속성도 진단용으로 갱신: `data-route-kind={resolved.kind === 'elk' ? 'elk-stored' : 'worker-smart-step'}`.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/presentation/components/SmartRelationEdge.test.ts && npx tsc -b`
Expected: PASS (기존 테스트 포함), 타입 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add src/presentation/components/SmartRelationEdge.tsx src/presentation/components/SmartRelationEdge.test.ts
git commit -m "feat: 저장된 ELK 엣지 경로 우선 렌더, 라이브 라우팅 폴백"
```

---

### Task 7: applyAutoLayout 연결 — 경로 저장 + projectId 클리어

**Files:**
- Modify: `src/presentation/components/SchemaCanvas.tsx`

- [ ] **Step 1: 구현** (UI 연결 — 통합 검증은 Task 10 브라우저 실측)

(1) import 갱신:

```ts
import { buildElkLayoutGraph, extractElkEdgeRoutes, relationHandleId, SCHEMA_NODE_COLUMN_HEIGHT, SCHEMA_NODE_HEADER_HEIGHT } from '../schemaLayout'
```

(2) 스토어 액션 구독 추가 (420행 부근):

```ts
  const setElkRoutes = useWorkbenchStore((state) => state.setElkRoutes)
  const clearElkRoutes = useWorkbenchStore((state) => state.clearElkRoutes)
```

(3) `applyAutoLayout` 내 `moveTablesLayout(positions)` 직후에 추가 (573행):

```ts
      moveTablesLayout(positions)
      setElkRoutes(extractElkEdgeRoutes(graph))
```

(순서 주의: `moveTablesLayout`의 runCommand가 전체 무효화를 하므로 반드시 그 **뒤에** `setElkRoutes`를 호출한다.)

(4) projectId 리셋 effect(495행)에 추가:

```ts
  useEffect(() => {
    layoutRunRef.current += 1
    setLayoutStatus('idle')
    setHoveredRelationId(null)
    setSelectedRelationId(null)
    clearElkRoutes()
    ...기존 그대로...
  }, [clearElkRoutes, project.projectId])
```

- [ ] **Step 2: 타입·기존 테스트 확인**

Run: `npx tsc -b && npx vitest run src/presentation`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/presentation/components/SchemaCanvas.tsx
git commit -m "feat: 자동 배치 시 ELK 엣지 경로 저장 연결"
```

---

### Task 8: diagramImageExport — 파일명·필터·출력 변환 (순수 함수)

**Files:**
- Create: `src/presentation/diagramImageExport.ts`
- Create: `src/presentation/diagramImageExport.test.ts`

- [ ] **Step 1: 의존성 설치**

Run: `npm install html-to-image`
Expected: package.json dependencies에 `html-to-image` 추가됨

- [ ] **Step 2: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from 'vitest'
import {
  computeExportTransform,
  diagramImageFileName,
  exportCaptureFilter,
} from './diagramImageExport'

describe('diagramImageFileName', () => {
  it('프로젝트명-구조도-날짜.png 형식을 만든다', () => {
    expect(diagramImageFileName('게임 C', new Date(2026, 6, 19)))
      .toBe('게임 C-구조도-20260719.png')
  })

  it('파일명에 못 쓰는 문자는 _로 치환하고 빈 이름은 기본값을 쓴다', () => {
    expect(diagramImageFileName('a/b:c', new Date(2026, 0, 5)))
      .toBe('a_b_c-구조도-20260105.png')
    expect(diagramImageFileName('   ', new Date(2026, 0, 5)))
      .toBe('프로젝트-구조도-20260105.png')
  })
})

describe('exportCaptureFilter', () => {
  it('미니맵·컨트롤·배경·패널을 제외한다', () => {
    for (const className of ['react-flow__minimap', 'react-flow__controls', 'react-flow__background', 'react-flow__panel']) {
      const element = document.createElement('div')
      element.classList.add(className)
      expect(exportCaptureFilter(element)).toBe(false)
    }
  })

  it('일반 요소와 비요소 노드는 통과시킨다', () => {
    expect(exportCaptureFilter(document.createElement('div'))).toBe(true)
    expect(exportCaptureFilter(document.createTextNode('text'))).toBe(true)
  })
})

describe('computeExportTransform', () => {
  it('여백 48px을 더한 크기와 원점 이동 transform을 만든다', () => {
    const result = computeExportTransform({ x: 100, y: 200, width: 1000, height: 500 })
    expect(result.width).toBe(1096)
    expect(result.height).toBe(596)
    expect(result.pixelRatio).toBe(2)
    expect(result.transform).toBe('translate(-52px, -152px) scale(1)')
  })

  it('출력 최장변이 16000px을 넘으면 pixelRatio를 줄인다', () => {
    const result = computeExportTransform({ x: 0, y: 0, width: 12000, height: 3000 })
    expect(result.width * result.pixelRatio).toBeLessThanOrEqual(16_000)
    expect(result.pixelRatio).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/presentation/diagramImageExport.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 4: 구현**

`src/presentation/diagramImageExport.ts` 생성:

```ts
export const EXPORT_PADDING = 48
export const EXPORT_PIXEL_RATIO = 2
const MAX_OUTPUT_EDGE = 16_000
const EXCLUDED_CLASSES = [
  'react-flow__minimap',
  'react-flow__controls',
  'react-flow__background',
  'react-flow__panel',
] as const

export function diagramImageFileName(projectName: string, now: Date): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const safeName = projectName.trim().replace(/[\\/:*?"<>|]/g, '_') || '프로젝트'
  return `${safeName}-구조도-${year}${month}${day}.png`
}

export function exportCaptureFilter(node: unknown): boolean {
  if (!(node instanceof Element)) return true
  return !EXCLUDED_CLASSES.some((className) => node.classList.contains(className))
}

export interface ExportBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface ExportTransform {
  readonly width: number
  readonly height: number
  readonly pixelRatio: number
  readonly transform: string
}

export function computeExportTransform(
  bounds: ExportBounds,
  padding = EXPORT_PADDING,
  pixelRatio = EXPORT_PIXEL_RATIO,
): ExportTransform {
  const width = Math.ceil(bounds.width + padding * 2)
  const height = Math.ceil(bounds.height + padding * 2)
  const longestEdge = Math.max(width, height)
  const boundedRatio = longestEdge * pixelRatio > MAX_OUTPUT_EDGE
    ? Math.max(1, Math.floor((MAX_OUTPUT_EDGE / longestEdge) * 100) / 100)
    : pixelRatio

  return {
    width,
    height,
    pixelRatio: boundedRatio,
    transform: `translate(${padding - bounds.x}px, ${padding - bounds.y}px) scale(1)`,
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/presentation/diagramImageExport.test.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json src/presentation/diagramImageExport.ts src/presentation/diagramImageExport.test.ts
git commit -m "feat: 다이어그램 이미지 내보내기 순수 유틸 (파일명·필터·변환)"
```

---

### Task 9: 이미지 저장 버튼 + exporting 오버라이드

`exporting` 플래그 하나로 focus·선택·줌 LOD를 파생 계산에서 오버라이드한다. 상태를 바꾸지 않으므로 복구 로직이 없다 (설계 문서의 "원상 복구" 요건을 구조적으로 충족).

**Files:**
- Modify: `src/presentation/components/SchemaCanvas.tsx`

- [ ] **Step 1: 구현**

(1) import 추가:

```ts
import { getNodesBounds } from '@xyflow/react'
import { toPng } from 'html-to-image'
import { FileSpreadsheet, ImageDown, LayoutGrid, Plus, Search, Sparkles, X } from 'lucide-react'
import { computeExportTransform, diagramImageFileName, exportCaptureFilter } from '../diagramImageExport'
```

주: `ImageDown`이 설치된 lucide-react 버전에 없으면 `Download`로 대체.

(2) 상태 추가와 파생 오버라이드 (438행 `zoomLevel` 계산부 교체):

```ts
  const [exporting, setExporting] = useState(false)
  const zoomLevel = exporting ? 'detail' : zoomLevelFor(viewport.zoom)
  const effectiveFocus = exporting ? 'all' : relationFocus
  const effectiveSelectedTableId = exporting ? null : (selectedTableId || null)
  const emphasizedRelationId = exporting ? null : (selectedRelationId ?? hoveredRelationId)
```

이후 `focused` useMemo, `buildSchemaNodes`, `buildSchemaEdges` 호출부의 `relationFocus` → `effectiveFocus`, `selectedTableId || null` → `effectiveSelectedTableId`로 교체하고 의존성 배열 갱신.

(3) 내보내기 핸들러 추가 (`applyAutoLayout` 아래):

```ts
  const exportDiagramImage = async () => {
    if (exporting || project.tables.length === 0) return
    setExporting(true)

    try {
      // exporting 오버라이드(detail 강제·전체 관계·선택 해제)가 렌더에 반영될 때까지 대기.
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
      })

      const viewportElement = document.querySelector<HTMLElement>('.react-flow__viewport')
      const exportNodes = flowInstance?.getNodes() ?? []
      if (!viewportElement || exportNodes.length === 0) throw new Error('캔버스를 찾을 수 없습니다.')

      const bounds = getNodesBounds(exportNodes)
      const output = computeExportTransform(bounds)
      const dataUrl = await toPng(viewportElement, {
        backgroundColor: '#ffffff',
        width: output.width,
        height: output.height,
        pixelRatio: output.pixelRatio,
        filter: exportCaptureFilter,
        style: {
          width: `${output.width}px`,
          height: `${output.height}px`,
          transform: output.transform,
        },
      })

      const anchor = document.createElement('a')
      anchor.href = dataUrl
      anchor.download = diagramImageFileName(project.name, new Date())
      anchor.click()
    } finally {
      setExporting(false)
    }
  }
```

(4) 헤더 버튼 추가 — 자동 배치 버튼(638행) 바로 뒤:

```tsx
          <button className="tool-button" type="button" aria-label="이미지 저장" title="전체 구조를 PNG 이미지로 저장" disabled={exporting || project.tables.length === 0} onClick={() => void exportDiagramImage()}>
            <ImageDown aria-hidden="true" size={15} />
            <span>{exporting ? '저장 중' : '이미지 저장'}</span>
          </button>
```

- [ ] **Step 2: 타입·전체 테스트 확인**

Run: `npx tsc -b && npx vitest run`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/presentation/components/SchemaCanvas.tsx
git commit -m "feat: 전체 구조 PNG 이미지 저장 버튼"
```

---

### Task 10: 브라우저 실측 검증 (게임 C·게임 D)

코드가 아니라 눈으로 확인하는 단계. dev 서버를 띄우고 브라우저 도구로 검증한다.

- [ ] **Step 1: dev 서버 기동 후 게임 D 예제 열기**

`npm run dev` (또는 실행 중인 서버 재사용) → `http://127.0.0.1:5173` → 게임 D (대규모 자동 배치 검증) 예제 열기 → 전체 구조 뷰.

- [ ] **Step 2: 자동 배치 실행 후 겹침 확인**

"자동 배치" 클릭. 확인 항목:
- 콘솔 에러 0건
- 선들이 개별적으로 구분되는가 (병주 없음 — 화면 확대해서 레이어 사이 통로 확인)
- `data-route-kind="elk-stored"` 엣지가 존재하는가 (DevTools에서 `document.querySelectorAll('[data-route-kind="elk-stored"]').length`가 관계 수와 일치)

- [ ] **Step 3: 드래그 폴백 확인**

테이블 하나를 드래그. 확인 항목:
- 드래그 중 그 테이블에 붙은 선만 따라 움직임 (다른 선은 고정)
- 드롭 후 그 선들만 `data-route-kind="worker-smart-step"`으로 전환, 나머지는 `elk-stored` 유지

- [ ] **Step 4: PNG 내보내기 확인**

축소(summary LOD) 상태에서 "이미지 저장" 클릭. 다운로드된 PNG 확인 항목:
- 화면 밖 테이블 포함 전체 구조가 담김
- 노드가 detail 모드(모든 열 표시)로 렌더됨
- 배경 순수 흰색, 미니맵·컨트롤·그리드 점 없음
- 저장 후 화면이 내보내기 전 상태(줌·선택) 그대로임

- [ ] **Step 5: 줌 LOD 전환 어긋남 확인** (설계 Open Question 실측)

자동 배치 후 줌을 summary↔keys↔detail로 오가며 저장 경로의 꺾임점이 축소된 노드
밖으로 어색하게 삐져나오는지 확인. 거슬리는 수준이면 설계의 후퇴 옵션대로
줌 LOD 변경 시에도 `clearElkRoutes()`를 호출하는 useEffect를 추가한다:

```ts
  useEffect(() => {
    // 저장 ELK 경로는 detail 좌표 기준 — LOD가 바뀌면 라이브 라우팅으로 후퇴.
    if (zoomLevel !== 'detail') clearElkRoutes()
  }, [clearElkRoutes, zoomLevel])
```

- [ ] **Step 6: 게임 C에서도 Step 2~5 반복** (소규모 회귀)

- [ ] **Step 7: 발견된 문제 수정 후 커밋**

```bash
git add -u
git commit -m "fix: 브라우저 실측에서 발견된 배치·내보내기 문제 수정"
```

(수정이 없으면 이 커밋은 생략.)

---

### Task 11 (조건부): Tauri 데스크톱 PNG 저장 실측

- [ ] **Step 1: Tauri dev로 anchor 다운로드 실측**

Run: `npm run tauri:dev` → 게임 C 열기 → "이미지 저장" 클릭.
- 파일이 저장되면(기존 xlsx 내보내기와 같은 anchor+Blob 경로): **이 태스크 종료. 추가 작업 없음.**
- 저장 안 되면 Step 2로.

- [ ] **Step 2 (Step 1 실패 시에만): save_binary_file Rust 커맨드 추가**

`src-tauri/src/lib.rs`에 추가 (기존 `write_external_project_file` 근처):

```rust
#[tauri::command]
fn save_binary_file(path: String, base64_contents: String) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let bytes = STANDARD
        .decode(base64_contents)
        .map_err(|error| format!("base64 디코딩 실패: {error}"))?;
    std::fs::write(&path, bytes).map_err(|error| format!("파일 저장 실패: {error}"))
}
```

`Cargo.toml`에 `base64 = "0.22"` 추가, `invoke_handler`의 `generate_handler![...]` 목록에 `save_binary_file` 추가.

프런트에서 Tauri 환경 감지 후 분기 (`exportDiagramImage` 내):

```ts
      const isTauri = '__TAURI_INTERNALS__' in window
      if (isTauri) {
        const { save } = await import('@tauri-apps/plugin-dialog')
        const { invoke } = await import('@tauri-apps/api/core')
        const path = await save({ defaultPath: diagramImageFileName(project.name, new Date()) })
        if (path) await invoke('save_binary_file', { path, base64Contents: dataUrl.split(',')[1] })
      } else {
        const anchor = document.createElement('a')
        anchor.href = dataUrl
        anchor.download = diagramImageFileName(project.name, new Date())
        anchor.click()
      }
```

- [ ] **Step 3: 커밋** (Step 2를 실행한 경우에만)

```bash
git add src-tauri/src/lib.rs src-tauri/Cargo.toml src/presentation/components/SchemaCanvas.tsx
git commit -m "feat: Tauri 데스크톱 PNG 저장 경로 추가"
```

---

### Task 12: 최종 검증

- [ ] **Step 1: 전체 게이트 실행**

```bash
npx tsc -b && npm run lint && npx vitest run
```

Expected: 전부 PASS, 경고 0

- [ ] **Step 2: E2E 스모크** (기존 e2e가 있으므로)

Run: `npm run e2e`
Expected: 기존 시나리오 PASS (자동 배치 관련 시나리오가 있으면 특히 확인)

- [ ] **Step 3: 최종 커밋**

```bash
git add -u
git commit -m "chore: 자동 배치 폴리싱 최종 검증 통과"
```

---

## 성공 기준 (설계 문서와 동일)

1. 게임 D에서 자동 배치 직후 8px 초과 병주 0쌍 (Task 3 테스트 + Task 10 실측)
2. 드래그한 노드의 선만 실시간 전환, 나머지 유지 (Task 5 테스트 + Task 10 실측)
3. 전체 구조 PNG(2x, detail 강제) 다운로드, 웹·Tauri 양쪽 (Task 9·10·11)
4. typecheck·lint·전체 테스트 클린 (Task 12)
