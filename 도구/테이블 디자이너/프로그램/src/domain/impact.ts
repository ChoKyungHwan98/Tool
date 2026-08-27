import { findColumn, findTable } from './projectQueries'
import type { EntityId, ImpactReport, SchemaProject } from './schema'

export function describeColumnRenameImpact(
  project: SchemaProject,
  tableId: EntityId,
  columnId: EntityId,
  nextName: string,
): ImpactReport {
  const table = findTable(project, tableId)
  const column = table ? findColumn(table, columnId) : undefined

  if (!table || !column) {
    return {
      summary: '선택한 컬럼이 더 이상 존재하지 않아 이름 변경 영향을 미리 볼 수 없습니다.',
      affectedTableIds: [tableId],
      affectedColumnIds: [columnId],
      affectedRelationIds: [],
      affectedExportViewIds: [],
      affectedCsvHeaders: [],
      existingDataRisk: ['선택 상태를 복구하기 전까지 이 명령은 막혀야 합니다.'],
      requiredConfirmations: [],
    }
  }

  const affectedRelations = project.relations.filter(
    (relation) =>
      relation.sourceColumnIds.includes(columnId) ||
      relation.targetColumnIds.includes(columnId),
  )
  const affectedExportViews = project.exportViews.filter((view) =>
    view.columns.some((exportColumn) => exportColumn.sourceColumnId === columnId),
  )
  const affectedCsvHeaders = affectedExportViews.flatMap((view) =>
    view.columns
      .filter((exportColumn) => exportColumn.sourceColumnId === columnId)
      .map((exportColumn) => `${view.name}.${exportColumn.header}`),
  )

  return {
    summary: `${table.name}.${column.name} 컬럼명이 ${nextName}(으)로 변경됩니다. 내부 ID는 유지되므로 FK 연결은 끊기지 않습니다.`,
    affectedTableIds: [table.tableId],
    affectedColumnIds: [column.columnId],
    affectedRelationIds: affectedRelations.map((relation) => relation.relationId),
    affectedExportViewIds: affectedExportViews.map((view) => view.viewId),
    affectedCsvHeaders,
    existingDataRisk: ['작성용 컬럼 라벨만 바뀌므로 기존 행 값은 보존됩니다.'],
    requiredConfirmations: affectedCsvHeaders.length > 0 ? ['이전 이름을 노출하는 런타임 CSV 헤더를 검토하세요.'] : [],
  }
}

export function describeNullableImpact(project: SchemaProject, tableId: EntityId, columnId: EntityId, nullable: boolean): ImpactReport {
  const table = findTable(project, tableId)
  const column = table ? findColumn(table, columnId) : undefined

  return {
    summary: column
      ? `${table?.name}.${column.name} 컬럼이 ${nullable ? '빈 값 허용' : '필수'} 상태로 변경됩니다.`
      : '컬럼이 더 이상 존재하지 않아 빈 값 허용 여부 변경을 미리 볼 수 없습니다.',
    affectedTableIds: [tableId],
    affectedColumnIds: [columnId],
    affectedRelationIds: project.relations
      .filter((relation) => relation.sourceColumnIds.includes(columnId) || relation.targetColumnIds.includes(columnId))
      .map((relation) => relation.relationId),
    affectedExportViewIds: project.exportViews
      .filter((view) => view.columns.some((exportColumn) => exportColumn.sourceColumnId === columnId))
      .map((view) => view.viewId),
    affectedCsvHeaders: project.exportViews.flatMap((view) =>
      view.columns
        .filter((exportColumn) => exportColumn.sourceColumnId === columnId)
        .map((exportColumn) => `${view.name}.${exportColumn.header}`),
    ),
    existingDataRisk: nullable
      ? ['빈 값을 허용할 때는 백필이 필요하지 않습니다.']
      : ['완료 전에 기존 행에 빈 값이 있는지 확인해야 합니다.'],
    requiredConfirmations: nullable ? [] : ['빈 값이 발견되면 기존 행의 백필 전략을 선택하세요.'],
  }
}
