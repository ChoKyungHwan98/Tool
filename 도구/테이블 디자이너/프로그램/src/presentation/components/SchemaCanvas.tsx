import {
  Background,
  Controls,
  getNodesBounds,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Node,
  type EdgeTypes,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react'
import ELK from 'elkjs/lib/elk.bundled.js'
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url'
import { toPng } from 'html-to-image'
import { FileSpreadsheet, ImageDown, LayoutGrid, Plus, Search, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { findColumn, findTable, isColumnInPrimaryKey } from '../../domain/projectQueries'
import type { EntityId, Relation, SchemaProject, SchemaTable } from '../../domain/schema'
import { validateProject } from '../../domain/validator'
import {
  AUTO_LAYOUT_ENGINE_TIMEOUT_MS,
  safelyTerminateLayoutEngine,
  settleAutoLayoutFit,
  withAutoLayoutTimeout,
} from '../autoLayoutLifecycle'
import { computeExportTransform, diagramImageFileName, exportCaptureFilter } from '../diagramImageExport'
import { buildElkLayoutGraph, extractElkEdgeRoutes, relationHandleId, relationPortOffset, SCHEMA_NODE_COLUMN_HEIGHT, SCHEMA_NODE_HEADER_HEIGHT } from '../schemaLayout'
import { useWorkbenchStore } from '../state/workbenchStore'
import { buildSchemaEdges, relationColor, type RelationFocus } from './schemaCanvasEdges'
import { RelationEdgeRoutingProvider, SmartRelationEdge } from './SmartRelationEdge'

export type DiagramZoomLevel = 'summary' | 'keys' | 'detail'
export type { RelationFocus } from './schemaCanvasEdges'
export interface DiagramSelection {
  readonly tableId: EntityId | null
  readonly columnId: EntityId | null
}

const schemaEdgeTypes: EdgeTypes = { smartRelation: SmartRelationEdge }

function tableAccent(table: SchemaTable): string {
  if (table.tags.includes('runtime-root')) return '#bd6518'
  if (table.tags.includes('junction')) return '#8a6811'
  if (table.tags.includes('lookup')) return '#34724b'
  if (table.name.includes('Animation')) return '#28547f'
  return '#536b85'
}

function zoomLevelFor(zoom: number): DiagramZoomLevel {
  if (zoom < 0.55) return 'summary'
  if (zoom < 0.8) return 'keys'
  return 'detail'
}

function buildColumnRelationMaps(project: SchemaProject) {
  const sourceFkByColumn = new Map<EntityId, Relation>()
  const targetRefByColumn = new Map<EntityId, Relation[]>()

  for (const relation of project.relations) {
    for (const columnId of relation.sourceColumnIds) sourceFkByColumn.set(columnId, relation)
    for (const columnId of relation.targetColumnIds) {
      targetRefByColumn.set(columnId, [...(targetRefByColumn.get(columnId) ?? []), relation])
    }
  }

  return { sourceFkByColumn, targetRefByColumn }
}

function relationTargetLabel(project: SchemaProject, relation: Relation): string {
  const targetTable = findTable(project, relation.targetTableId)
  const targetColumn = targetTable ? findColumn(targetTable, relation.targetColumnIds[0]) : undefined
  return `${targetTable?.name ?? 'MissingTable'}.${targetColumn?.name ?? 'MissingColumn'}`
}

function visibleColumnsFor(
  table: SchemaTable,
  level: DiagramZoomLevel,
  selected: boolean,
  sourceFkByColumn: ReadonlyMap<EntityId, Relation>,
  targetRefByColumn: ReadonlyMap<EntityId, readonly Relation[]>,
) {
  if (level === 'detail' || selected) return table.columns
  return table.columns.filter((column) =>
    isColumnInPrimaryKey(table, column.columnId)
    || sourceFkByColumn.has(column.columnId)
    || targetRefByColumn.has(column.columnId),
  )
}

function TableNodeLabel({
  project,
  table,
  zoomLevel,
  relationState,
  sourceFkByColumn,
  targetRefByColumn,
  emphasizedRelationId,
  aiIssueCount,
  onSelectTable,
  onSelectColumn,
}: {
  readonly project: SchemaProject
  readonly table: SchemaTable
  readonly zoomLevel: DiagramZoomLevel
  readonly relationState: 'normal' | 'selected' | 'connected' | 'dimmed'
  readonly sourceFkByColumn: ReadonlyMap<EntityId, Relation>
  readonly targetRefByColumn: ReadonlyMap<EntityId, readonly Relation[]>
  readonly emphasizedRelationId: EntityId | null
  readonly aiIssueCount: number
  readonly onSelectTable: (tableId: EntityId) => void
  readonly onSelectColumn: (columnId: EntityId) => void
}) {
  const selected = relationState === 'selected'
  const selectedColumnId = useWorkbenchStore((state) =>
    table.columns.some((column) => column.columnId === state.selectedColumnId) ? state.selectedColumnId : null,
  )
  const visibleColumns = visibleColumnsFor(table, zoomLevel, selected, sourceFkByColumn, targetRefByColumn)
  const hiddenColumnCount = table.columns.length - visibleColumns.length
  const fkCount = table.columns.filter((column) => sourceFkByColumn.has(column.columnId)).length
  const accent = tableAccent(table)
  const compositeRelations = project.relations.filter((relation) => (
    relation.sourceColumnIds.length > 1
    && (relation.sourceTableId === table.tableId || relation.targetTableId === table.tableId)
  ))
  const emphasizedRelation = emphasizedRelationId
    ? project.relations.find((relation) => relation.relationId === emphasizedRelationId)
    : undefined

  const compositeHandleTop = (relation: Relation, side: 'source' | 'target') => {
    const columnIds = side === 'source' ? relation.sourceColumnIds : relation.targetColumnIds
    const indexes = columnIds
      .map((columnId) => visibleColumns.findIndex((column) => column.columnId === columnId))
      .filter((index) => index >= 0)
    const averageIndex = indexes.length > 0 ? indexes.reduce((sum, index) => sum + index, 0) / indexes.length : 0
    const summaryOffset = zoomLevel === 'summary' && !selected ? 22 : 0
    return SCHEMA_NODE_HEADER_HEIGHT + summaryOffset + averageIndex * SCHEMA_NODE_COLUMN_HEIGHT + SCHEMA_NODE_COLUMN_HEIGHT / 2
  }

  return (
    <div
      className={`schema-node ${relationState} zoom-${zoomLevel}`}
      style={{ '--node-accent': accent } as React.CSSProperties}
      onClick={() => onSelectTable(table.tableId)}
    >
      <div className="schema-node-title">
        <strong>{table.name}</strong>
        <div className="schema-node-title-meta">
          {aiIssueCount > 0 && <span className="schema-ai-warning">AI {aiIssueCount}</span>}
          {table.primaryKey.columnIds.length > 1 && <span>복합 PK</span>}
        </div>
      </div>
      <div className="schema-node-summary">
        <span>PK {table.primaryKey.columnIds.length}</span>
        <span>FK {fkCount}</span>
        <span>{table.columns.length}개 열</span>
      </div>
      <div className="schema-node-columns">
        {visibleColumns.map((column, index) => {
          const isPk = isColumnInPrimaryKey(table, column.columnId)
          const fkRelation = sourceFkByColumn.get(column.columnId)
          const targetRelations = targetRefByColumn.get(column.columnId) ?? []
          const singleTargetRelations = targetRelations.filter((relation) => relation.targetColumnIds.length === 1)
          const sourceRelationColor = fkRelation ? relationColor(project, fkRelation.relationId) : undefined
          const emphasizedAsSource = emphasizedRelation?.sourceTableId === table.tableId
            && emphasizedRelation.sourceColumnIds.includes(column.columnId)
          const emphasizedAsTarget = emphasizedRelation?.targetTableId === table.tableId
            && emphasizedRelation.targetColumnIds.includes(column.columnId)
          const relationEmphasisRole = emphasizedAsSource ? 'source' : emphasizedAsTarget ? 'target' : null
          const relationEmphasisColor = relationEmphasisRole && emphasizedRelation
            ? relationColor(project, emphasizedRelation.relationId)
            : undefined
          const columnStyle = {
            ...(sourceRelationColor ? { '--relation-color': sourceRelationColor } : {}),
            ...(relationEmphasisColor ? { '--relation-emphasis-color': relationEmphasisColor } : {}),
          } as React.CSSProperties

          return (
            <button
              className={[
                selectedColumnId === column.columnId ? 'schema-node-column active nodrag' : 'schema-node-column nodrag',
                fkRelation ? 'relation-source' : '',
                relationEmphasisRole ? `relation-emphasis relation-emphasis-${relationEmphasisRole}` : '',
              ].filter(Boolean).join(' ')}
              data-row={index % 2 === 0 ? 'even' : 'odd'}
              key={column.columnId}
              style={columnStyle}
              type="button"
              title={`${column.name} · ${column.dataType.kind}`}
              onClick={(event) => {
                event.stopPropagation()
                onSelectColumn(column.columnId)
              }}
            >
              <Handle className="column-handle target" id={column.columnId} position={Position.Left} type="target" isConnectable={zoomLevel === 'detail' || selected} />
              {singleTargetRelations.map((relation) => {
                const targetOffset = relationPortOffset(project, relation, 'target')
                return (
                  <Handle
                    className="column-handle target relation-handle"
                    data-target-slot-offset={targetOffset}
                    id={relationHandleId(relation, 'target')}
                    isConnectable={false}
                    key={`target:${relation.relationId}`}
                    position={Position.Left}
                    style={{
                      '--relation-color': relationColor(project, relation.relationId),
                      top: `calc(50% + ${targetOffset}px)`,
                    } as React.CSSProperties}
                    type="target"
                  />
                )
              })}
              <div className="column-badges">
                {isPk && <span className="schema-badge pk">PK</span>}
                {fkRelation && <span className="schema-badge fk">FK</span>}
              </div>
              <span className="column-name">{column.name}</span>
              {zoomLevel !== 'summary' || selected ? (
                <small>{fkRelation ? `→ ${relationTargetLabel(project, fkRelation)}` : column.dataType.kind}</small>
              ) : <small />}
              <Handle className="column-handle source" id={column.columnId} position={Position.Right} type="source" isConnectable={zoomLevel === 'detail' || selected} />
              {fkRelation && fkRelation.sourceColumnIds.length === 1 && (
                <Handle
                  className="column-handle source relation-handle"
                  id={relationHandleId(fkRelation, 'source')}
                  isConnectable={false}
                  position={Position.Right}
                  style={{ '--relation-color': sourceRelationColor } as React.CSSProperties}
                  type="source"
                />
              )}
            </button>
          )
        })}
        {hiddenColumnCount > 0 && <div className="schema-node-more">+ {hiddenColumnCount}개 열</div>}
      </div>
      {compositeRelations.map((relation) => relation.sourceTableId === table.tableId ? (
        <Handle
          className="column-handle source composite-relation-handle"
          id={relationHandleId(relation, 'source')}
          isConnectable={false}
          key={`source:${relation.relationId}`}
          position={Position.Right}
          style={{ '--relation-color': relationColor(project, relation.relationId), top: compositeHandleTop(relation, 'source') } as React.CSSProperties}
          type="source"
        />
      ) : (
        <Handle
          className="column-handle target composite-relation-handle"
          id={relationHandleId(relation, 'target')}
          isConnectable={false}
          key={`target:${relation.relationId}`}
          position={Position.Left}
          style={{
            '--relation-color': relationColor(project, relation.relationId),
            top: compositeHandleTop(relation, 'target') + relationPortOffset(project, relation, 'target'),
          } as React.CSSProperties}
          type="target"
        />
      ))}
    </div>
  )
}

function connectedGraph(project: SchemaProject, selectedTableId: EntityId | null, focus: RelationFocus) {
  if (!selectedTableId) return { tableIds: new Set<EntityId>(), relationIds: new Set<EntityId>() }

  const tableIds = new Set<EntityId>([selectedTableId])
  const relationIds = new Set<EntityId>()
  let frontier = new Set<EntityId>([selectedTableId])

  do {
    const next = new Set<EntityId>()
    for (const relation of project.relations) {
      if (!frontier.has(relation.sourceTableId) && !frontier.has(relation.targetTableId)) continue
      relationIds.add(relation.relationId)
      const adjacent = frontier.has(relation.sourceTableId) ? relation.targetTableId : relation.sourceTableId
      if (!tableIds.has(adjacent)) next.add(adjacent)
      tableIds.add(adjacent)
    }
    frontier = next
  } while (focus === 'path' && frontier.size > 0)

  return { tableIds, relationIds }
}

function nodeDimensions(table: SchemaTable, level: DiagramZoomLevel, selected: boolean, keyColumnCount: number) {
  const visibleCount = level === 'detail' || selected ? table.columns.length : keyColumnCount
  const width = level === 'summary' && !selected ? 184 : level === 'keys' && !selected ? 208 : 236
  const summaryHeight = level === 'summary' && !selected ? 22 : 0
  return { width, height: 34 + summaryHeight + Math.max(visibleCount, 0) * 28 + (visibleCount < table.columns.length ? 24 : 0) }
}

function buildSchemaNodes(
  project: SchemaProject,
  zoomLevel: DiagramZoomLevel,
  selectedTableId: EntityId | null,
  focusedTableIds: ReadonlySet<EntityId>,
  relationFocus: RelationFocus,
  emphasizedRelationId: EntityId | null,
  aiIssueCounts: ReadonlyMap<EntityId, number>,
  handlers: {
    readonly onSelectTable: (tableId: EntityId) => void
    readonly onSelectColumn: (columnId: EntityId) => void
  },
): Node[] {
  const { sourceFkByColumn, targetRefByColumn } = buildColumnRelationMaps(project)

  return project.tables.map((table) => {
    const selected = selectedTableId === table.tableId
    const connected = focusedTableIds.has(table.tableId)
    const relationState = selected ? 'selected' : connected ? 'connected' : selectedTableId && relationFocus !== 'all' ? 'dimmed' : 'normal'
    const layout = project.layout.nodes.find((node) => node.entityId === table.tableId)
    const keyColumnCount = visibleColumnsFor(table, 'keys', false, sourceFkByColumn, targetRefByColumn).length
    const dimensions = nodeDimensions(table, zoomLevel, selected, keyColumnCount)

    return {
      id: table.tableId,
      position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
      data: {
        label: (
          <TableNodeLabel
            project={project}
            relationState={relationState}
            sourceFkByColumn={sourceFkByColumn}
            table={table}
            targetRefByColumn={targetRefByColumn}
            emphasizedRelationId={emphasizedRelationId}
            aiIssueCount={aiIssueCounts.get(table.tableId) ?? 0}
            zoomLevel={zoomLevel}
            onSelectColumn={handlers.onSelectColumn}
            onSelectTable={handlers.onSelectTable}
          />
        ),
      },
      measured: dimensions,
      style: { border: 0, borderRadius: 0, padding: 0, background: 'transparent', ...dimensions },
      type: 'default',
    }
  })
}

export function SchemaCanvas() {
  const project = useWorkbenchStore((state) => state.document.schema)
  const selectedTableId = useWorkbenchStore((state) => state.selectedTableId)
  const selectTable = useWorkbenchStore((state) => state.selectTable)
  const selectColumn = useWorkbenchStore((state) => state.selectColumn)
  const setMainView = useWorkbenchStore((state) => state.setMainView)
  const moveTableLayout = useWorkbenchStore((state) => state.moveTableLayout)
  const moveTablesLayout = useWorkbenchStore((state) => state.moveTablesLayout)
  const setElkRoutes = useWorkbenchStore((state) => state.setElkRoutes)
  const clearElkRoutes = useWorkbenchStore((state) => state.clearElkRoutes)
  const createForeignKey = useWorkbenchStore((state) => state.createForeignKey)
  const deleteTable = useWorkbenchStore((state) => state.deleteTable)
  const deleteRelation = useWorkbenchStore((state) => state.deleteRelation)
  const createTable = useWorkbenchStore((state) => state.createTable)
  const prepareImport = useWorkbenchStore((state) => state.prepareImport)
  const aiProposal = useWorkbenchStore((state) => state.aiProposal)
  const assistantCollapsed = useWorkbenchStore((state) => state.assistantCollapsed)
  const toggleAssistant = useWorkbenchStore((state) => state.toggleAssistant)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 0.8 })
  const [relationFocus, setRelationFocus] = useState<RelationFocus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [layoutStatus, setLayoutStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [draggingNodeId, setDraggingNodeId] = useState<EntityId | null>(null)
  const [hoveredRelationId, setHoveredRelationId] = useState<EntityId | null>(null)
  const [selectedRelationId, setSelectedRelationId] = useState<EntityId | null>(null)
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [exporting, setExporting] = useState(false)
  const canvasBodyRef = useRef<HTMLDivElement | null>(null)
  const resizeFitTimerRef = useRef<number | null>(null)
  const lastWindowHeightRef = useRef(typeof window === 'undefined' ? 0 : window.innerHeight)
  const layoutRunRef = useRef(0)
  const layoutResetTimerRef = useRef<number | null>(null)
  // 내보내기 중에는 파생 계산만 오버라이드한다 (detail 강제·전체 관계·선택 해제).
  // 실제 상태를 바꾸지 않으므로 캡처 후 복구 로직이 필요 없다.
  const zoomLevel = exporting ? 'detail' : zoomLevelFor(viewport.zoom)
  const effectiveFocus: RelationFocus = exporting ? 'all' : relationFocus
  const effectiveSelectedTableId = exporting ? null : (selectedTableId || null)
  const emphasizedRelationId = exporting ? null : (selectedRelationId ?? hoveredRelationId)
  const focused = useMemo(() => connectedGraph(project, effectiveSelectedTableId, effectiveFocus), [project, effectiveFocus, effectiveSelectedTableId])
  const aiIssueCounts = useMemo(() => {
    const counts = new Map<EntityId, number>()
    for (const finding of aiProposal?.findings ?? []) {
      for (const tableId of finding.tableIds) counts.set(tableId, (counts.get(tableId) ?? 0) + 1)
    }
    return counts
  }, [aiProposal])
  const invalidRelationIds = useMemo(() => {
    const ids = new Set<EntityId>()
    for (const issue of [...validateProject(project), ...(aiProposal?.findings ?? [])]) {
      if (issue.severity === 'error' || issue.severity === 'blocking') {
        for (const relationId of issue.relationIds) ids.add(relationId)
      }
    }
    return ids
  }, [aiProposal, project])

  const nodes = useMemo(
    () => buildSchemaNodes(project, zoomLevel, effectiveSelectedTableId, focused.tableIds, effectiveFocus, emphasizedRelationId, aiIssueCounts, {
      onSelectTable: selectTable,
      onSelectColumn: selectColumn,
    }),
    [aiIssueCounts, effectiveFocus, effectiveSelectedTableId, emphasizedRelationId, focused.tableIds, project, selectColumn, selectTable, zoomLevel],
  )
  const edges = useMemo(
    () => buildSchemaEdges(
      project,
      effectiveSelectedTableId,
      effectiveFocus,
      focused.relationIds,
      invalidRelationIds,
      exporting ? null : hoveredRelationId,
      exporting ? null : selectedRelationId,
      draggingNodeId,
      {
        onHoverEnd: () => {
          if (!selectedRelationId) setHoveredRelationId(null)
        },
        onHoverStart: (relationId) => {
          if (!selectedRelationId) setHoveredRelationId(relationId)
        },
        onSelect: (relationId) => {
          setHoveredRelationId(null)
          setSelectedRelationId(relationId)
        },
        onDelete: (relationId) => {
          deleteRelation(relationId)
          setHoveredRelationId(null)
          setSelectedRelationId(null)
        },
      },
    ),
    [deleteRelation, draggingNodeId, effectiveFocus, effectiveSelectedTableId, exporting, focused.relationIds, hoveredRelationId, invalidRelationIds, project, selectedRelationId],
  )
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ko-KR')
    return query ? project.tables.filter((table) => table.name.toLocaleLowerCase('ko-KR').includes(query)).slice(0, 8) : []
  }, [project.tables, searchQuery])

  useEffect(() => {
    layoutRunRef.current += 1
    setLayoutStatus('idle')
    setHoveredRelationId(null)
    setSelectedRelationId(null)
    clearElkRoutes()

    if (layoutResetTimerRef.current !== null) {
      window.clearTimeout(layoutResetTimerRef.current)
      layoutResetTimerRef.current = null
    }
  }, [clearElkRoutes, project.projectId])

  useEffect(() => () => {
    layoutRunRef.current += 1
    if (layoutResetTimerRef.current !== null) window.clearTimeout(layoutResetTimerRef.current)
    if (resizeFitTimerRef.current !== null) window.clearTimeout(resizeFitTimerRef.current)
  }, [])

  useEffect(() => {
    const canvas = canvasBodyRef.current
    if (!canvas || !flowInstance || project.tables.length === 0) return undefined

    let lastWidth = canvas.clientWidth
    let lastHeight = canvas.clientHeight
    const scheduleResizeFit = (force = false) => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const heightDelta = Math.abs(window.innerHeight - lastWindowHeightRef.current)
      const canvasChanged = Math.abs(width - lastWidth) > 24 || Math.abs(height - lastHeight) > 24
      lastWidth = width
      lastHeight = height
      lastWindowHeightRef.current = window.innerHeight
      // F11 changes the browser viewport without remounting the React Flow
      // tree. Refit after the new canvas size settles so nodes and edges do not
      // retain the pre-fullscreen transform.
      if (!force && (!canvasChanged || heightDelta < 40)) return
      if (resizeFitTimerRef.current !== null) window.clearTimeout(resizeFitTimerRef.current)
      resizeFitTimerRef.current = window.setTimeout(() => {
        resizeFitTimerRef.current = null
        void flowInstance.fitView({ padding: 0.08, maxZoom: 0.92, duration: 0 })
      }, 140)
    }
    const handleResize = () => scheduleResizeFit()
    const handleFullscreenChange = () => scheduleResizeFit(true)

    const observer = new ResizeObserver(handleResize)
    observer.observe(canvas)
    window.addEventListener('resize', handleResize)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      if (resizeFitTimerRef.current !== null) {
        window.clearTimeout(resizeFitTimerRef.current)
        resizeFitTimerRef.current = null
      }
    }
  }, [flowInstance, project.tables.length])

  const connectColumns = (connection: Connection) => {
    if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) return
    createForeignKey(connection.source, connection.sourceHandle, connection.target, connection.targetHandle)
  }

  const focusTable = (tableId: EntityId) => {
    setHoveredRelationId(null)
    setSelectedRelationId(null)
    selectTable(tableId)
    setSearchQuery('')
    const node = nodes.find((candidate) => candidate.id === tableId)
    if (node) void flowInstance?.fitView({ nodes: [node], padding: 0.5, maxZoom: 1.05, duration: 320 })
  }

  const clearRelationEmphasis = () => {
    setHoveredRelationId(null)
    setSelectedRelationId(null)
  }

  const handleCanvasKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && (selectedRelationId || hoveredRelationId)) {
      clearRelationEmphasis()
      event.preventDefault()
      return
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedRelationId) {
      if (event.target instanceof Element && event.target.closest('input, select, textarea, button, [contenteditable="true"], [role="textbox"], [role="menu"]')) return
      event.preventDefault()
      deleteRelation(selectedRelationId)
      clearRelationEmphasis()
      return
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedTableId && !selectedRelationId) {
      if (event.target instanceof Element && event.target.closest('input, select, textarea, button, [contenteditable="true"], [role="textbox"], [role="menu"]')) return
      if (!project.tables.some((table) => table.tableId === selectedTableId)) return
      event.preventDefault()
      deleteTable(selectedTableId)
      return
    }

    if (event.key !== 'Enter' || !(event.target instanceof Element)) return
    const edge = event.target.closest<SVGGElement>('.react-flow__edge')
    const relationId = edge?.dataset.id
    if (!relationId || !project.relations.some((relation) => relation.relationId === relationId)) return
    setHoveredRelationId(null)
    setSelectedRelationId(relationId)
    event.preventDefault()
  }

  const applyAutoLayout = async () => {
    const runId = ++layoutRunRef.current
    if (layoutResetTimerRef.current !== null) window.clearTimeout(layoutResetTimerRef.current)
    setLayoutStatus('running')
    setRelationFocus('all')
    clearRelationEmphasis()
    const engine = typeof Worker === 'undefined'
      ? new ELK()
      : new ELK({ workerFactory: () => new Worker(elkWorkerUrl) })

    try {
      const graph = await withAutoLayoutTimeout(
        engine.layout(buildElkLayoutGraph(project)),
        'layout',
        AUTO_LAYOUT_ENGINE_TIMEOUT_MS,
      )
      if (runId !== layoutRunRef.current) return

      const positions = (graph.children ?? []).flatMap((child) => (
        child.x !== undefined && child.y !== undefined
          ? [{ entityId: child.id, x: child.x, y: child.y }]
          : []
      ))

      if (positions.length !== project.tables.length) throw new Error('자동 배치 결과에 일부 테이블 좌표가 없습니다.')

      moveTablesLayout(positions)
      // moveTablesLayout의 runCommand가 전체 무효화를 하므로 반드시 그 뒤에 채운다.
      setElkRoutes(extractElkEdgeRoutes(graph))
      const fitResult = await settleAutoLayoutFit(new Promise<void>((resolve) => {
        let fittingStarted = false
        const fitAfterRender = () => {
          if (fittingStarted) return
          fittingStarted = true
          const fitting = flowInstance?.fitView({ padding: 0.16, maxZoom: 0.92, duration: 520 })
          if (fitting) void Promise.resolve(fitting).then(() => resolve(), () => resolve())
          else resolve()
        }

        window.requestAnimationFrame(() => window.requestAnimationFrame(fitAfterRender))
        window.setTimeout(fitAfterRender, 120)
      }))
      if (fitResult !== 'completed') {
        void flowInstance?.fitView({ padding: 0.16, maxZoom: 0.92, duration: 0 })
      }

      if (runId !== layoutRunRef.current) return
      setLayoutStatus('done')
      layoutResetTimerRef.current = window.setTimeout(() => {
        if (runId === layoutRunRef.current) setLayoutStatus('idle')
        layoutResetTimerRef.current = null
      }, 1_400)
    } catch {
      if (runId === layoutRunRef.current) setLayoutStatus('error')
    } finally {
      safelyTerminateLayoutEngine(engine)
    }
  }

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

  return (
    <section className="canvas-shell" aria-label="스키마 구조도">
      <div className="view-header schema-view-header">
        <div>
          <h1>전체 구조</h1>
          <p>{project.tables.length}개 테이블 · {project.relations.length}개 관계</p>
        </div>
        <div className="schema-header-tools">
          <div className="schema-search-wrap">
            <Search aria-hidden="true" size={14} />
            <input aria-label="구조도 테이블 검색" placeholder="테이블 찾기" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            {searchQuery && <button type="button" title="검색 지우기" onClick={() => setSearchQuery('')}><X aria-hidden="true" size={13} /></button>}
            {searchResults.length > 0 && (
              <div className="schema-search-results">
                {searchResults.map((table) => <button key={table.tableId} type="button" onClick={() => focusTable(table.tableId)}>{table.name}</button>)}
              </div>
            )}
          </div>
          <div className="relation-focus-switch" aria-label="관계 표시 범위">
            {(['all', 'direct', 'path'] as const).map((focus) => (
              <button
                key={focus}
                className={relationFocus === focus ? 'active' : ''}
                title={focus === 'all' ? '모든 관계 표시' : focus === 'direct' ? '선택 테이블의 직접 관계' : '다단계 연결 경로'}
                type="button"
                onClick={() => {
                  clearRelationEmphasis()
                  setRelationFocus(focus)
                }}
              >
                {focus === 'all' ? '전체' : focus === 'direct' ? '현재 테이블' : '연결 경로'}
              </button>
            ))}
          </div>
          <button className="tool-button" type="button" aria-label="자동 배치" title="흐트러진 테이블을 전체 재배치" disabled={layoutStatus === 'running'} onClick={() => void applyAutoLayout()}>
            <LayoutGrid aria-hidden="true" size={15} />
            <span>{layoutStatus === 'running' ? '배치 중' : layoutStatus === 'done' ? '배치 완료' : '자동 배치'}</span>
          </button>
          {layoutStatus === 'error' && <span className="layout-error">자동 배치에 실패했습니다.</span>}
          <button className="tool-button" type="button" aria-label="이미지 저장" title="전체 구조를 PNG 이미지로 저장" disabled={exporting || project.tables.length === 0} onClick={() => void exportDiagramImage()}>
            <ImageDown aria-hidden="true" size={15} />
            <span>{exporting ? '저장 중' : '이미지 저장'}</span>
          </button>
        </div>
      </div>
      <div ref={canvasBodyRef} className="canvas-body" onKeyDownCapture={handleCanvasKeyDown}>
        {project.tables.length === 0 ? (
          <div className="project-start-panel">
            <div className="project-start-heading">
              <span className="view-eyebrow">START PROJECT</span>
              <strong>첫 테이블 구조를 준비하세요.</strong>
              <span>가져오거나 직접 만들고, AI에게 구조 초안을 요청할 수 있습니다.</span>
            </div>
            <div className="project-start-options">
              <label className="start-option">
                <span className="start-option-icon"><FileSpreadsheet aria-hidden="true" size={21} /></span>
                <strong>CSV·Excel 가져오기</strong>
                <small>CSV 묶음과 Excel 다중 시트를 미리 확인합니다.</small>
                <input
                  type="file"
                  multiple
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) => {
                    const files = [...(event.currentTarget.files ?? [])]
                    if (files.length > 0) void prepareImport(files)
                    event.currentTarget.value = ''
                  }}
                />
              </label>
              <button className="start-option" type="button" onClick={createTable}>
                <span className="start-option-icon"><Plus aria-hidden="true" size={21} /></span>
                <strong>직접 테이블 만들기</strong>
                <small>기본 PK가 있는 첫 테이블에서 설계를 시작합니다.</small>
              </button>
              <button
                className="start-option"
                type="button"
                onClick={() => {
                  if (assistantCollapsed) toggleAssistant()
                  window.setTimeout(() => document.querySelector<HTMLTextAreaElement>('#ai-message-input')?.focus(), 0)
                }}
              >
                <span className="start-option-icon"><Sparkles aria-hidden="true" size={21} /></span>
                <strong>AI에게 구조 요청</strong>
                <small>오른쪽 대화에서 필요한 게임 데이터를 설명합니다.</small>
              </button>
            </div>
          </div>
        ) : (
          <RelationEdgeRoutingProvider nodes={nodes}>
            <ReactFlow
              defaultEdgeOptions={{ interactionWidth: 18 }}
              edgeTypes={schemaEdgeTypes}
              edges={edges}
              fitView
              fitViewOptions={{ padding: 0.08, includeHiddenNodes: false, maxZoom: 0.92 }}
              maxZoom={1.5}
              minZoom={0.28}
              nodes={nodes}
              nodesDraggable
              nodesFocusable
              onConnect={connectColumns}
              onEdgeClick={(event, edge) => {
                event.stopPropagation()
                setHoveredRelationId(null)
                setSelectedRelationId(edge.id)
              }}
              onEdgeMouseEnter={(_, edge) => {
                if (!selectedRelationId) setHoveredRelationId(edge.id)
              }}
              onEdgeMouseLeave={(_, edge) => {
                if (!selectedRelationId && hoveredRelationId === edge.id) setHoveredRelationId(null)
              }}
              onInit={setFlowInstance}
              onMove={(_, nextViewport) => setViewport(nextViewport)}
              onNodeClick={(_, node) => {
                clearRelationEmphasis()
                selectTable(node.id)
              }}
              onNodeDoubleClick={(_, node) => {
                clearRelationEmphasis()
                selectTable(node.id)
                setMainView('design')
              }}
              onNodeDragStart={(_, node) => setDraggingNodeId(node.id)}
              onNodeDragStop={(_, node) => {
                setDraggingNodeId(null)
                moveTableLayout(node.id, node.position.x, node.position.y)
              }}
              onPaneClick={clearRelationEmphasis}
            >
              <Background color="#d5dde6" gap={20} size={1} />
              {project.tables.length >= 10 && <MiniMap className="schema-minimap" pannable zoomable nodeColor={(node) => tableAccent(findTable(project, node.id) ?? project.tables[0]!)} />}
              <Controls position="bottom-right" />
            </ReactFlow>
          </RelationEdgeRoutingProvider>
        )}
      </div>
    </section>
  )
}
