import {
  BaseEdge,
  EdgeLabelRenderer,
  StepEdge,
  type EdgeProps,
  type Node,
  useStore,
  useViewport,
} from '@xyflow/react'
import { SmartEdgeBatchRoutingProvider, useSmartEdgeRoute } from '@tisoap/react-flow-smart-edge'
import { Trash2 } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  buildBridgePath,
  dedupeRoutePoints,
  normalizeNearAlignedRoute,
  resolveEdgePoints,
  routeMidpoint,
  routeSignature,
  separateParallelSegments,
  type RegisteredRoute,
  type RouteObstacle,
} from '../smartRelationRouting'
import { useWorkbenchStore } from '../state/workbenchStore'
import {
  clampRelationPopoverPoint,
  type RelationDisplayDescriptor,
  type RelationVisualState,
} from '../relationPresentation'

interface RelationEdgeData extends Record<string, unknown> {
  readonly routeOrder?: number
  readonly descriptor?: RelationDisplayDescriptor
  readonly pinned?: boolean
  readonly showDetails?: boolean
  readonly visualState?: RelationVisualState
  readonly onHoverEnd?: () => void
  readonly onHoverStart?: () => void
  readonly onSelect?: () => void
  readonly onDelete?: () => void
}

interface RouteRegistryValue {
  readonly routes: ReadonlyMap<string, RegisteredRoute>
  readonly obstacles: readonly (RouteObstacle & { readonly nodeId: string })[]
  readonly register: (edgeId: string, route: RegisteredRoute | null) => void
}

const RouteRegistryContext = createContext<RouteRegistryValue>({
  routes: new Map(),
  obstacles: [],
  register: () => undefined,
})

export function RelationEdgeRoutingProvider({ nodes, children }: { readonly nodes: Node[]; readonly children: ReactNode }) {
  const [routes, setRoutes] = useState<ReadonlyMap<string, RegisteredRoute>>(new Map())
  const obstacles = useMemo(() => nodes.map((node) => {
    const width = node.measured?.width ?? (typeof node.style?.width === 'number' ? node.style.width : 0)
    const height = node.measured?.height ?? (typeof node.style?.height === 'number' ? node.style.height : 0)
    return {
      nodeId: node.id,
      left: node.position.x - 14,
      top: node.position.y - 14,
      right: node.position.x + width + 14,
      bottom: node.position.y + height + 14,
    }
  }), [nodes])
  const register = useCallback((edgeId: string, route: RegisteredRoute | null) => {
    setRoutes((current) => {
      const existing = current.get(edgeId)
      if (!route && !existing) return current
      if (route && existing && routeSignature(route) === routeSignature(existing)) return current
      const next = new Map(current)
      if (route) next.set(edgeId, route)
      else next.delete(edgeId)
      return next
    })
  }, [])
  const registry = useMemo(() => ({ obstacles, routes, register }), [obstacles, register, routes])

  return (
    <SmartEdgeBatchRoutingProvider nodes={nodes} options={{ preset: 'step', gridRatio: 8, nodePadding: 14 }}>
      <RouteRegistryContext.Provider value={registry}>{children}</RouteRegistryContext.Provider>
    </SmartEdgeBatchRoutingProvider>
  )
}

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
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
    }),
    [livePoints, props.sourceX, props.sourceY, props.targetX, props.targetY, storedRoute],
  )
  const points = resolved.points

  useEffect(() => {
    // ELK 경로 엣지도 레지스트리에 등록해야 다른 엣지의 교차 브리지 계산과 맞물린다.
    register(props.id, points.length >= 2 ? { order, points } : null)
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
  const popoverPoint = clampRelationPopoverPoint(
    center,
    viewport,
    { width: paneWidth, height: paneHeight },
  )

  return (
    <>
      <g
        data-route-kind={resolved.kind === 'elk' ? 'elk-stored' : 'worker-smart-step'}
        data-relation-state={data.visualState ?? 'normal'}
        onClick={(event) => {
          event.stopPropagation()
          data.onSelect?.()
        }}
        onMouseEnter={() => data.onHoverStart?.()}
        onMouseLeave={() => data.onHoverEnd?.()}
        onPointerEnter={() => data.onHoverStart?.()}
        onPointerLeave={() => data.onHoverEnd?.()}
      >
        <BaseEdge
          id={props.id}
          path={bridgedPath || (route ? route.svgPathString : '')}
          label={props.label}
          labelX={center.x}
          labelY={center.y}
          labelStyle={props.labelStyle}
          labelShowBg={props.labelShowBg}
          labelBgStyle={props.labelBgStyle}
          labelBgPadding={props.labelBgPadding}
          labelBgBorderRadius={props.labelBgBorderRadius}
          markerEnd={props.markerEnd}
          markerStart={props.markerStart}
          interactionWidth={props.interactionWidth}
          style={props.style}
        />
      </g>
      {data.showDetails && data.descriptor && (
        <EdgeLabelRenderer>
          <div
            className="relation-popover-anchor"
            style={{ transform: `translate(${popoverPoint.x}px, ${popoverPoint.y}px)` }}
          >
            <div
              aria-label={data.descriptor.ariaLabel}
              className="relation-details-popover nodrag nopan"
              data-relation-id={data.descriptor.relationId}
              role={data.pinned ? 'dialog' : 'tooltip'}
              style={{ transform: `translate(-50%, -50%) scale(${1 / Math.max(viewport.zoom, 0.01)})` }}
            >
              <div className="relation-details-path">
                <strong title={data.descriptor.sourcePath}>{data.descriptor.sourcePath}</strong>
                <span className="relation-role fk">(FK)</span>
                <span aria-hidden="true" className="relation-details-arrow">→</span>
                <strong title={data.descriptor.targetPath}>{data.descriptor.targetPath}</strong>
                <span className="relation-role pk">({data.descriptor.targetRole})</span>
              </div>
              <span className="relation-details-note">대상 키를 참조합니다.</span>
              {data.pinned && data.onDelete && (
                <button
                  className="relation-delete-button nodrag nopan"
                  type="button"
                  title="이 관계 삭제 (승인 필요)"
                  onClick={(event) => {
                    event.stopPropagation()
                    data.onDelete?.()
                  }}
                >
                  <Trash2 aria-hidden="true" size={12} />관계 삭제
                </button>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
