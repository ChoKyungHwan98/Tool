import type { ElkExtendedEdge, ElkNode, ElkPort } from 'elkjs/lib/elk-api'
import type { EntityId, Relation, SchemaProject, SchemaTable } from '../domain/schema'
import type { RoutePoint } from './smartRelationRouting'

export const SCHEMA_NODE_WIDTH = 236
export const SCHEMA_NODE_HEADER_HEIGHT = 34
export const SCHEMA_NODE_COLUMN_HEIGHT = 28
const PORT_SIZE = 6

type PortSide = 'source' | 'target'

export function relationHandleId(relation: Relation, side: PortSide): EntityId {
  return `relation-${side}:${relation.relationId}`
}

export function relationPortId(relation: Relation, side: PortSide): EntityId {
  return `port:${side}:${relation.relationId}`
}

function relationPortY(table: SchemaTable, columnIds: readonly EntityId[]): number {
  const indexes = columnIds
    .map((columnId) => table.columns.findIndex((column) => column.columnId === columnId))
    .filter((index) => index >= 0)
  const averageIndex = indexes.length > 0
    ? indexes.reduce((sum, index) => sum + index, 0) / indexes.length
    : 0
  return SCHEMA_NODE_HEADER_HEIGHT + averageIndex * SCHEMA_NODE_COLUMN_HEIGHT + (SCHEMA_NODE_COLUMN_HEIGHT - PORT_SIZE) / 2
}

function sameColumnGroup(left: readonly EntityId[], right: readonly EntityId[]): boolean {
  return left.length === right.length && left.every((columnId, index) => columnId === right[index])
}

export function relationPortOffset(project: SchemaProject, relation: Relation, side: PortSide): number {
  if (side !== 'target') return 0

  const siblings = project.relations
    .filter((candidate) => (
      candidate.targetTableId === relation.targetTableId
      && sameColumnGroup(candidate.targetColumnIds, relation.targetColumnIds)
    ))
    .toSorted((left, right) => left.relationId < right.relationId ? -1 : left.relationId > right.relationId ? 1 : 0)
  if (siblings.length < 2) return 0

  const index = siblings.findIndex((candidate) => candidate.relationId === relation.relationId)
  if (index < 0) return 0

  const preferredSpacing = 8
  const maximumSpan = 18
  const spacing = Math.min(preferredSpacing, maximumSpan / (siblings.length - 1))
  return (index - (siblings.length - 1) / 2) * spacing
}

function makePort(project: SchemaProject, table: SchemaTable, relation: Relation, side: PortSide, order: number): ElkPort {
  const columnIds = side === 'source' ? relation.sourceColumnIds : relation.targetColumnIds
  return {
    id: relationPortId(relation, side),
    x: side === 'source' ? SCHEMA_NODE_WIDTH - PORT_SIZE : 0,
    y: relationPortY(table, columnIds) + relationPortOffset(project, relation, side),
    width: PORT_SIZE,
    height: PORT_SIZE,
    layoutOptions: {
      'elk.port.side': side === 'source' ? 'EAST' : 'WEST',
      'elk.port.index': String(order),
    },
  }
}

// 같은 열을 여러 관계가 참조하면 포트가 같은 y에 겹쳐 ELK가 진입 구간을 한 통로로
// 합쳐버린다(병주). 겹친 포트를 열 행(28px) 안에서 위아래로 펼쳐 각 선이 자기만의
// 진입 경로를 갖게 한다.
function spreadOverlappingPorts(ports: ElkPort[], spacing = 5): ElkPort[] {
  const groups = new Map<string, ElkPort[]>()
  for (const port of ports) {
    const key = `${port.layoutOptions?.['elk.port.side']}:${port.y}`
    groups.set(key, [...(groups.get(key) ?? []), port])
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue
    for (const [index, port] of group.entries()) {
      port.y = (port.y ?? 0) + (index - (group.length - 1) / 2) * spacing
    }
  }

  return ports
}

export function buildElkLayoutGraph(project: SchemaProject): ElkNode {
  return {
    id: 'schema-root',
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
    children: project.tables.map((table) => {
      const ports: ElkPort[] = []
      const relations = project.relations.filter(
        (relation) => relation.sourceTableId === table.tableId || relation.targetTableId === table.tableId,
      )

      for (const [order, relation] of relations.entries()) {
        if (relation.sourceTableId === table.tableId) ports.push(makePort(project, table, relation, 'source', order))
        if (relation.targetTableId === table.tableId) ports.push(makePort(project, table, relation, 'target', order))
      }

      return {
        id: table.tableId,
        width: SCHEMA_NODE_WIDTH,
        height: SCHEMA_NODE_HEADER_HEIGHT + table.columns.length * SCHEMA_NODE_COLUMN_HEIGHT,
        ports: spreadOverlappingPorts(ports),
        layoutOptions: {
          'elk.portConstraints': 'FIXED_POS',
        },
      }
    }),
    edges: project.relations.map((relation) => ({
      id: relation.relationId,
      sources: [relationPortId(relation, 'source')],
      targets: [relationPortId(relation, 'target')],
    })),
  }
}

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
