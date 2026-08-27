import { MarkerType, type Edge } from '@xyflow/react'
import type { EntityId, SchemaProject } from '../../domain/schema'
import {
  buildRelationDisplayDescriptor,
  relationVisualStyle,
  type RelationVisualState,
} from '../relationPresentation'
import { relationHandleId } from '../schemaLayout'

export type RelationFocus = 'all' | 'direct' | 'path'

export const RELATION_COLORS = ['#167786', '#7751a3', '#bd6518', '#356ca5', '#4f7b45', '#a14e68', '#8a6a19', '#536b85'] as const

export function relationColor(project: SchemaProject, relationId: EntityId): string {
  const index = project.relations.findIndex((relation) => relation.relationId === relationId)
  return RELATION_COLORS[(index < 0 ? 0 : index) % RELATION_COLORS.length]!
}

export function buildSchemaEdges(
  project: SchemaProject,
  selectedTableId: EntityId | null,
  focus: RelationFocus,
  focusedRelationIds: ReadonlySet<EntityId>,
  invalidRelationIds: ReadonlySet<EntityId>,
  hoveredRelationId: EntityId | null,
  selectedRelationId: EntityId | null,
  draggingNodeId: EntityId | null,
  handlers: {
    readonly onHoverEnd: () => void
    readonly onHoverStart: (relationId: EntityId) => void
    readonly onSelect: (relationId: EntityId) => void
    readonly onDelete: (relationId: EntityId) => void
  },
): Edge[] {
  const emphasizedRelationId = selectedRelationId ?? hoveredRelationId

  return project.relations
    .map((relation, routeOrder) => {
      const liveDragging = draggingNodeId !== null
        && (relation.sourceTableId === draggingNodeId || relation.targetTableId === draggingNodeId)
      const active = selectedTableId !== null && (relation.sourceTableId === selectedTableId || relation.targetTableId === selectedTableId)
      const invalid = invalidRelationIds.has(relation.relationId)
      const color = relationColor(project, relation.relationId)
      const focused = focusedRelationIds.has(relation.relationId)
      const visualState: RelationVisualState = invalid
        ? 'invalid'
        : selectedRelationId === relation.relationId
          ? 'selected'
          : hoveredRelationId === relation.relationId
            ? 'hovered'
            : emphasizedRelationId
              ? 'dimmed'
              : focus === 'all'
                ? active ? 'active' : 'normal'
                : focused
                  ? 'active'
                  : 'dimmed'
      const visualStyle = relationVisualStyle(visualState, color, emphasizedRelationId ? 0.1 : 0.14)
      const descriptor = buildRelationDisplayDescriptor(project, relation)
      const markerColor = visualStyle.strokeOpacity < 1
        ? `rgba(135, 149, 166, ${visualStyle.strokeOpacity})`
        : visualStyle.stroke

      return {
        id: relation.relationId,
        source: relation.sourceTableId,
        sourceHandle: relationHandleId(relation, 'source'),
        target: relation.targetTableId,
        targetHandle: relationHandleId(relation, 'target'),
        ariaLabel: descriptor.ariaLabel,
        focusable: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: markerColor, width: 8, height: 8 },
        style: visualStyle,
        type: liveDragging ? 'step' : 'smartRelation',
        data: {
          descriptor,
          onHoverEnd: handlers.onHoverEnd,
          onHoverStart: () => handlers.onHoverStart(relation.relationId),
          onSelect: () => handlers.onSelect(relation.relationId),
          onDelete: () => handlers.onDelete(relation.relationId),
          pinned: selectedRelationId === relation.relationId,
          routeOrder,
          showDetails: emphasizedRelationId === relation.relationId,
          visualState,
        },
        animated: invalid,
        zIndex: invalid ? 30 : visualState === 'selected' || visualState === 'hovered' ? 20 : active ? 10 : 0,
      }
    })
}
