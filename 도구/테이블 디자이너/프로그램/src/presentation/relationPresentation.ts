import { findColumn, findTable, isColumnInPrimaryKey } from '../domain/projectQueries'
import type { EntityId, Relation, SchemaProject } from '../domain/schema'

export type RelationVisualState = 'normal' | 'active' | 'dimmed' | 'hovered' | 'selected' | 'invalid'

export interface RelationDisplayDescriptor {
  readonly relationId: EntityId
  readonly sourceTableName: string
  readonly sourceColumnNames: readonly string[]
  readonly sourcePath: string
  readonly sourceRole: 'FK'
  readonly targetTableName: string
  readonly targetColumnNames: readonly string[]
  readonly targetPath: string
  readonly targetRole: 'PK' | '고유 키'
  readonly ariaLabel: string
}

export interface RelationVisualStyle {
  readonly stroke: string
  readonly strokeWidth: number
  readonly strokeOpacity: number
  readonly strokeDasharray?: string
}

export interface RelationPopoverPoint {
  readonly x: number
  readonly y: number
}

export interface RelationViewport {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

export const RELATION_NEUTRAL = '#8795a6'
export const RELATION_ERROR = '#b64242'

function columnNames(project: SchemaProject, tableId: EntityId, columnIds: readonly EntityId[]): string[] {
  const table = findTable(project, tableId)
  if (!table) return columnIds.map(() => 'MissingColumn')
  return columnIds.map((columnId) => findColumn(table, columnId)?.name ?? 'MissingColumn')
}

function relationPath(tableName: string, names: readonly string[]): string {
  return names.length === 1 ? `${tableName}.${names[0]}` : `${tableName}.(${names.join(', ')})`
}

export function buildRelationDisplayDescriptor(
  project: SchemaProject,
  relation: Relation,
): RelationDisplayDescriptor {
  const sourceTable = findTable(project, relation.sourceTableId)
  const targetTable = findTable(project, relation.targetTableId)
  const sourceTableName = sourceTable?.name ?? 'MissingTable'
  const targetTableName = targetTable?.name ?? 'MissingTable'
  const sourceColumnNames = columnNames(project, relation.sourceTableId, relation.sourceColumnIds)
  const targetColumnNames = columnNames(project, relation.targetTableId, relation.targetColumnIds)
  const targetRole = targetTable && relation.targetColumnIds.every((columnId) => isColumnInPrimaryKey(targetTable, columnId))
    ? 'PK'
    : '고유 키'
  const sourcePath = relationPath(sourceTableName, sourceColumnNames)
  const targetPath = relationPath(targetTableName, targetColumnNames)

  return {
    relationId: relation.relationId,
    sourceTableName,
    sourceColumnNames,
    sourcePath,
    sourceRole: 'FK',
    targetTableName,
    targetColumnNames,
    targetPath,
    targetRole,
    ariaLabel: `${sourcePath} (FK)에서 ${targetPath} (${targetRole})를 참조합니다`,
  }
}

export function relationVisualStyle(
  state: RelationVisualState,
  relationColor: string,
  dimmedOpacity = 0.14,
): RelationVisualStyle {
  switch (state) {
    case 'active':
      return { stroke: relationColor, strokeWidth: 2.6, strokeOpacity: 1 }
    case 'hovered':
    case 'selected':
      return { stroke: relationColor, strokeWidth: 3.2, strokeOpacity: 1 }
    case 'dimmed':
      return { stroke: RELATION_NEUTRAL, strokeWidth: 1.2, strokeOpacity: dimmedOpacity }
    case 'invalid':
      return { stroke: RELATION_ERROR, strokeWidth: 2.2, strokeOpacity: 1, strokeDasharray: '6 4' }
    default:
      return { stroke: relationColor, strokeWidth: 1.6, strokeOpacity: 0.72 }
  }
}

export function clampRelationPopoverPoint(
  point: RelationPopoverPoint,
  viewport: RelationViewport,
  pane: { readonly width: number; readonly height: number },
  popover = { width: 380, height: 70 },
  padding = 12,
): RelationPopoverPoint {
  const zoom = viewport.zoom > 0 ? viewport.zoom : 1
  const screenX = point.x * zoom + viewport.x
  const screenY = point.y * zoom + viewport.y
  const halfWidth = Math.min(popover.width / 2, Math.max(0, pane.width / 2 - padding))
  const halfHeight = Math.min(popover.height / 2, Math.max(0, pane.height / 2 - padding))
  const minimumX = padding + halfWidth
  const maximumX = Math.max(minimumX, pane.width - padding - halfWidth)
  const minimumY = padding + halfHeight
  const maximumY = Math.max(minimumY, pane.height - padding - halfHeight)
  const clampedX = Math.min(maximumX, Math.max(minimumX, screenX))
  const clampedY = Math.min(maximumY, Math.max(minimumY, screenY))

  return {
    x: (clampedX - viewport.x) / zoom,
    y: (clampedY - viewport.y) / zoom,
  }
}
