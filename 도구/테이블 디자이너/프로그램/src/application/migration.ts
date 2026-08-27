import { findColumn, findTable } from '../domain/projectQueries'
import type { CellValue, ColumnDataType, DataRow, EntityId, SchemaColumn, SchemaProject } from '../domain/schema'

export type BackfillStrategyKind = 'fixed_default' | 'formula' | 'conditional' | 'temporary_nullable' | 'import_mapping' | 'manual'

export interface BackfillStrategy {
  readonly kind: BackfillStrategyKind
  readonly value?: unknown
  readonly expression?: string
  readonly importFileName?: string
}

export interface MigrationStep {
  readonly stepId: EntityId
  readonly title: string
  readonly description: string
  readonly reversible: boolean
  readonly rollbackStepId?: EntityId
}

export interface MigrationPlan {
  readonly planId: EntityId
  readonly summary: string
  readonly affectedTableIds: readonly EntityId[]
  readonly affectedColumnIds: readonly EntityId[]
  readonly steps: readonly MigrationStep[]
  readonly risks: readonly string[]
  readonly rollbackStrategy: string
  readonly requiresApproval: boolean
}

export type RowValue = CellValue

function typeLabel(dataType: ColumnDataType): string {
  if (dataType.kind === 'enum') {
    return `enum(${dataType.enumId})`
  }

  if (dataType.kind === 'list') {
    return `list(${dataType.itemType})`
  }

  return dataType.kind
}

function step(stepId: EntityId, title: string, description: string, reversible = true, rollbackStepId?: EntityId): MigrationStep {
  return {
    stepId,
    title,
    description,
    reversible,
    rollbackStepId,
  }
}

export function planRequiredColumnMigration(project: SchemaProject, tableId: EntityId, column: SchemaColumn): MigrationPlan {
  const table = findTable(project, tableId)
  const tableName = table?.name ?? '선택한 테이블'

  return {
    planId: `migration_add_required_${column.columnId}`,
    summary: `기존 행을 깨뜨리지 않고 ${tableName}에 필수 컬럼 ${column.name}을 추가합니다.`,
    affectedTableIds: [tableId],
    affectedColumnIds: [column.columnId],
    steps: [
      step('step_add_nullable', '임시로 빈 값 허용', `${column.name}을 일시적으로 빈 값 허용 컬럼으로 추가해 기존 행을 계속 불러올 수 있게 합니다.`, true, 'rollback_remove_column'),
      step('step_backfill', '값 백필', '기존 행에 대해 고정값, 수식, 가져오기 매핑, 수동 입력 중 하나를 선택합니다.', true, 'rollback_clear_backfill'),
      step('step_validate', '빈 값 검증', '검증기가 아직 빈 값인 행이 없는지 확인합니다.', true),
      step('step_enforce_not_null', '필수 적용', `검증을 통과한 뒤에만 ${column.name}을 Not Null로 전환합니다.`, true, 'rollback_nullable'),
    ],
    risks: ['백필할 수 없는 행이 있으면 마지막 단계 전에 마이그레이션을 멈춰야 합니다.'],
    rollbackStrategy: '롤백 시 임시 컬럼을 제거하거나 Not Null 적용 전에 다시 빈 값 허용 상태로 되돌립니다.',
    requiresApproval: false,
  }
}

export function planMakeColumnRequiredMigration(project: SchemaProject, tableId: EntityId, columnId: EntityId): MigrationPlan {
  const table = findTable(project, tableId)
  const column = table ? findColumn(table, columnId) : undefined
  const columnLabel = `${table?.name ?? tableId}.${column?.name ?? columnId}`

  return {
    planId: `migration_required_${columnId}`,
    summary: `기존 행을 확인한 뒤 ${columnLabel}을(를) 필수 열로 변경합니다.`,
    affectedTableIds: [tableId],
    affectedColumnIds: [columnId],
    steps: [
      step('step_snapshot_column', '현재 값 보관', '변경 전 값을 정확한 실행 취소와 복구에 사용할 수 있도록 보관합니다.', true, 'rollback_restore_snapshot'),
      step('step_find_blanks', '빈 값 확인', '현재 데이터에서 비어 있는 행을 찾아 변경을 막을 항목을 표시합니다.', true),
      step('step_backfill_blanks', '필요한 값 채우기', '빈 행이 있다면 기본값, 가져오기 매핑 또는 수동 입력으로 값을 채웁니다.', true, 'rollback_restore_snapshot'),
      step('step_enforce_required', '필수 적용', '모든 행이 검증을 통과한 뒤에만 빈 값 금지 제약을 적용합니다.', true, 'rollback_nullable'),
    ],
    risks: ['빈 값이 남아 있으면 필수 열 변경을 적용할 수 없습니다.'],
    rollbackStrategy: '문제가 생기면 빈 값 허용 상태와 변경 전 값을 복원합니다.',
    requiresApproval: true,
  }
}

export function planColumnTypeMigration(
  project: SchemaProject,
  tableId: EntityId,
  columnId: EntityId,
  nextDataType: ColumnDataType,
): MigrationPlan {
  const table = findTable(project, tableId)
  const column = table ? findColumn(table, columnId) : undefined

  return {
    planId: `migration_type_${columnId}`,
    summary: `${table?.name ?? '선택한 테이블'}.${column?.name ?? columnId} 타입을 ${column ? typeLabel(column.dataType) : '알 수 없음'}에서 ${typeLabel(nextDataType)}(으)로 변경합니다.`,
    affectedTableIds: [tableId],
    affectedColumnIds: [columnId],
    steps: [
      step('step_create_shadow_column', '그림자 컬럼 생성', '원본을 보존한 채 변환값을 담을 임시 컬럼을 만듭니다.', true, 'rollback_drop_shadow'),
      step('step_convert_values', '값 변환', '기존 값을 그림자 컬럼으로 변환하고 실패 항목을 보고합니다.', true, 'rollback_clear_shadow'),
      step('step_validate_conversion', '변환 검증', '타입 호환성, 빈 값, 변환 실패를 확인합니다.', true),
      step('step_swap_columns', '컬럼 교체', '모든 변환값이 검증을 통과한 뒤에만 원본 컬럼 타입을 교체합니다.', true, 'rollback_restore_original'),
    ],
    risks: ['일부 값은 대상 타입으로 깔끔하게 변환되지 않을 수 있습니다.'],
    rollbackStrategy: '변환 검증을 통과할 때까지 원본 컬럼을 유지하고, 실패하면 그림자 컬럼을 제거합니다.',
    requiresApproval: true,
  }
}

export function planSplitTableMigration(
  project: SchemaProject,
  sourceTableId: EntityId,
  movedColumnIds: readonly EntityId[],
  newTableName: string,
): MigrationPlan {
  const sourceTable = findTable(project, sourceTableId)

  return {
    planId: `migration_split_${sourceTableId}_${newTableName}`,
    summary: `${sourceTable?.name ?? sourceTableId}에서 컬럼 ${movedColumnIds.length}개를 ${newTableName}(으)로 분리합니다.`,
    affectedTableIds: [sourceTableId],
    affectedColumnIds: movedColumnIds,
    steps: [
      step('step_create_target_table', '대상 테이블 생성', `${newTableName} 테이블을 키와 이동할 컬럼으로 생성합니다.`, true, 'rollback_drop_target_table'),
      step('step_copy_distinct_rows', '고유 행 복사', '대상 키 기준으로 행을 그룹화해 새 테이블로 복사합니다.', true, 'rollback_clear_target_rows'),
      step('step_create_relation', '관계 생성', '원본 테이블이 새 테이블 참조를 받거나 기존 참조를 유지합니다.', true, 'rollback_remove_relation'),
      step('step_validate_cardinality', '카디널리티 검증', '각 원본 행이 정확히 하나의 대상 행에 매핑되어야 합니다.', true),
      step('step_remove_source_columns', '이동한 원본 컬럼 제거', '검증을 통과한 뒤 이동한 컬럼을 원본 테이블에서 제거합니다.', true, 'rollback_restore_source_columns'),
    ],
    risks: ['대상 키가 중복되거나 누락되면 검증 없이 행 손실이 발생할 수 있습니다.'],
    rollbackStrategy: '복사된 행과 관계 카디널리티를 검증할 때까지 원본 컬럼을 유지합니다.',
    requiresApproval: true,
  }
}

export function planMergeTableMigration(project: SchemaProject, sourceTableId: EntityId, targetTableId: EntityId): MigrationPlan {
  const sourceTable = findTable(project, sourceTableId)
  const targetTable = findTable(project, targetTableId)

  return {
    planId: `migration_merge_${sourceTableId}_${targetTableId}`,
    summary: `${sourceTable?.name ?? sourceTableId}를 ${targetTable?.name ?? targetTableId}(으)로 병합합니다.`,
    affectedTableIds: [sourceTableId, targetTableId],
    affectedColumnIds: sourceTable?.columns.map((column) => column.columnId) ?? [],
    steps: [
      step('step_check_join', '조인 카디널리티 확인', '각 원본 행이 하나의 대상 행에 매핑되는지 확인합니다.', true),
      step('step_add_columns', '대상에 원본 컬럼 추가', '원본 컬럼을 대상 테이블에 빈 값 허용 임시 컬럼으로 추가합니다.', true, 'rollback_remove_added_columns'),
      step('step_copy_values', '값 복사', '원본 값을 대상 행으로 복사합니다.', true, 'rollback_clear_copied_values'),
      step('step_validate_values', '복사값 검증', '빈 값, 중복, 관계 무결성을 확인합니다.', true),
      step('step_remove_source_table', '원본 테이블 제거', '복사값이 검증을 통과한 뒤에만 원본 테이블을 제거합니다.', true, 'rollback_restore_source_table'),
    ],
    risks: ['다대일 조인이나 누락된 조인은 병합 전에 수동 검토가 필요합니다.'],
    rollbackStrategy: '대상으로 복사한 모든 값이 검증될 때까지 원본 테이블을 유지합니다.',
    requiresApproval: true,
  }
}

export function planBackfillMigration(project: SchemaProject, tableId: EntityId, columnId: EntityId, strategy: BackfillStrategy): MigrationPlan {
  const table = findTable(project, tableId)
  const column = table ? findColumn(table, columnId) : undefined

  return {
    planId: `migration_backfill_${columnId}`,
    summary: `${strategy.kind} 전략으로 ${table?.name ?? tableId}.${column?.name ?? columnId} 값을 백필합니다.`,
    affectedTableIds: [tableId],
    affectedColumnIds: [columnId],
    steps: [
      step('step_snapshot_column', '컬럼 스냅샷', '백필 적용 전에 롤백용 현재 값을 보관합니다.', true, 'rollback_restore_snapshot'),
      step('step_apply_backfill', '백필 적용', '선택한 전략에 따라 빈 값을 채웁니다.', true, 'rollback_restore_snapshot'),
      step('step_validate_backfill', '백필 검증', '필수 빈 값과 잘못된 값이 사라졌는지 확인합니다.', true),
      step('step_commit_backfill', '백필 확정', '검증을 통과한 백필 값을 새 기준값으로 확정합니다.', true),
    ],
    risks: strategy.kind === 'manual' ? ['수동 백필은 완료되지 않은 채 남을 수 있습니다.'] : ['백필 값이 여전히 타입 또는 체크 제약을 위반할 수 있습니다.'],
    rollbackStrategy: '검증에 실패하면 백필 전 스냅샷을 복원합니다.',
    requiresApproval: strategy.kind === 'manual' || strategy.kind === 'import_mapping',
  }
}

export function previewBackfillRows(rows: readonly DataRow[], columnId: EntityId, strategy: BackfillStrategy): readonly DataRow[] {
  return rows.map((row) => {
    const current = row.cells[columnId]

    if (current !== null && current !== undefined && current !== '') {
      return row
    }

    if (strategy.kind !== 'fixed_default') {
      return row
    }

    return {
      ...row,
      cells: {
        ...row.cells,
        [columnId]: normalizeRowValue(strategy.value),
      },
    }
  })
}

export function migrationCanRollback(plan: MigrationPlan): boolean {
  return plan.steps.every((migrationStep) => migrationStep.reversible)
}

function normalizeRowValue(value: unknown): RowValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value
  }

  return value === undefined ? null : String(value)
}
