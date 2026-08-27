import { findColumn, findTable } from '../domain/projectQueries'
import type { EntityId, Relation, SchemaProject } from '../domain/schema'

export interface RelationMappingLabel {
  readonly sourceTableName: string
  readonly sourceColumnNames: readonly string[]
  readonly targetTableName: string
  readonly targetColumnNames: readonly string[]
  readonly text: string
}

function columnNames(project: SchemaProject, tableId: EntityId, columnIds: readonly EntityId[]): readonly string[] {
  const table = findTable(project, tableId)
  return columnIds.map((columnId) => table ? findColumn(table, columnId)?.name ?? columnId : columnId)
}

export function describeRelationMapping(project: SchemaProject, relation: Relation): RelationMappingLabel {
  const sourceTableName = findTable(project, relation.sourceTableId)?.name ?? relation.sourceTableId
  const targetTableName = findTable(project, relation.targetTableId)?.name ?? relation.targetTableId
  const sourceColumnNames = columnNames(project, relation.sourceTableId, relation.sourceColumnIds)
  const targetColumnNames = columnNames(project, relation.targetTableId, relation.targetColumnIds)

  return {
    sourceTableName,
    sourceColumnNames,
    targetTableName,
    targetColumnNames,
    text: `${sourceTableName}.${sourceColumnNames.join(', ')} → ${targetTableName}.${targetColumnNames.join(', ')}`,
  }
}
