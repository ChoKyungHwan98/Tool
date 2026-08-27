import { makeId } from './ids'
import { findColumn, findTable, getColumnLabel } from './projectQueries'
import type {
  ColumnDataType,
  DataRow,
  EntityId,
  Relation,
  RowsByTable,
  SchemaColumn,
  SchemaProject,
  SchemaTable,
  ValidationIssue,
  ValidationRule,
} from './schema'

interface IssueInput {
  readonly severity: ValidationIssue['severity']
  readonly title: string
  readonly message: string
  readonly tableIds?: readonly EntityId[]
  readonly columnIds?: readonly EntityId[]
  readonly relationIds?: readonly EntityId[]
  readonly rowIndices?: readonly number[]
  readonly dataPath?: readonly string[]
  readonly suggestedFix: string
}

function issue(input: IssueInput): ValidationIssue {
  return {
    issueId: makeId('issue'),
    tableIds: [],
    columnIds: [],
    relationIds: [],
    ...input,
  }
}

function duplicateNames(values: readonly string[]): readonly string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    const normalized = value.trim().toLowerCase()

    if (seen.has(normalized)) {
      duplicates.add(value)
    }

    seen.add(normalized)
  }

  return [...duplicates]
}

function duplicateIds(values: readonly EntityId[]): readonly EntityId[] {
  const seen = new Set<EntityId>()
  const duplicates = new Set<EntityId>()

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
    }

    seen.add(value)
  }

  return [...duplicates]
}

function missingColumns(table: SchemaTable, columnIds: readonly EntityId[]): readonly EntityId[] {
  const columns = new Set(table.columns.map((column) => column.columnId))

  return columnIds.filter((columnId) => !columns.has(columnId))
}

function dataTypeKey(dataType: ColumnDataType): string {
  if (dataType.kind === 'enum') {
    return `enum:${dataType.enumId}`
  }

  if (dataType.kind === 'list') {
    return `list:${dataType.itemType}`
  }

  return dataType.kind
}

function areRelationTypesCompatible(sourceColumn: SchemaColumn, targetColumn: SchemaColumn): boolean {
  return dataTypeKey(sourceColumn.dataType) === dataTypeKey(targetColumn.dataType)
}

function hasInvalidRangeRule(column: SchemaColumn): boolean {
  return column.validationRules.some((rule) => {
    if (rule.kind !== 'range' || typeof rule.value !== 'object' || rule.value === null) {
      return false
    }

    const range = rule.value as { readonly min?: unknown; readonly max?: unknown }

    return typeof range.min === 'number' && typeof range.max === 'number' && range.min > range.max
  })
}

function findRepeatedColumnGroups(table: SchemaTable): readonly string[] {
  const groups = new Map<string, number>()

  for (const column of table.columns) {
    const match = column.name.match(/^(.+?)(?:Id|Name|Path|Value)?([1-9]\d*)$/i)

    if (match?.[1]) {
      const key = match[1].toLowerCase()
      groups.set(key, (groups.get(key) ?? 0) + 1)
    }
  }

  return [...groups.entries()].filter(([, count]) => count > 1).map(([name]) => name)
}

function hasOwnRows(rowsByTable: RowsByTable, tableId: EntityId): boolean {
  return Object.prototype.hasOwnProperty.call(rowsByTable, tableId)
}

function isBlankValue(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

function isEmptyDataRow(row: DataRow): boolean {
  return Object.values(row.cells).every(isBlankValue)
}

function isNumericString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))
}

function isIntegerLike(value: unknown): boolean {
  return (typeof value === 'number' && Number.isInteger(value)) || (isNumericString(value) && Number.isInteger(Number(value)))
}

function isNumberLike(value: unknown): boolean {
  return (typeof value === 'number' && Number.isFinite(value)) || isNumericString(value)
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (isNumericString(value)) {
    return Number(value)
  }

  return null
}

function isBooleanLike(value: unknown): boolean {
  return typeof value === 'boolean' || value === 'true' || value === 'false' || value === '0' || value === '1'
}

function isValidDateText(value: unknown, dateOnly: boolean): boolean {
  if (typeof value !== 'string' || value.trim() === '') {
    return false
  }

  if (dateOnly && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  return !Number.isNaN(Date.parse(value))
}

function isJsonLike(value: unknown): boolean {
  if (value === null) {
    return true
  }

  if (typeof value === 'object') {
    return true
  }

  if (typeof value !== 'string') {
    return false
  }

  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

function isValueCompatibleWithKind(project: SchemaProject, kind: string, value: unknown, enumId?: EntityId): boolean {
  switch (kind) {
    case 'string':
    case 'resource_ref':
    case 'localization_ref':
      return typeof value === 'string'
    case 'int32':
    case 'int64':
      return isIntegerLike(value)
    case 'float':
    case 'double':
      return isNumberLike(value)
    case 'boolean':
      return isBooleanLike(value)
    case 'date':
      return isValidDateText(value, true)
    case 'datetime':
      return isValidDateText(value, false)
    case 'json':
      return isJsonLike(value)
    case 'enum': {
      const schemaEnum = enumId ? project.enums.find((candidate) => candidate.enumId === enumId) : undefined

      if (!schemaEnum) {
        return true
      }

      return typeof value === 'string' && schemaEnum.values.some((enumValue) => enumValue.name === value)
    }
    default:
      return false
  }
}

function isValueCompatibleWithDataType(project: SchemaProject, dataType: ColumnDataType, value: unknown): boolean {
  if (dataType.kind === 'list') {
    if (typeof value === 'string') {
      return true
    }

    return Array.isArray(value) && value.every((item) => isValueCompatibleWithKind(project, dataType.itemType, item))
  }

  if (dataType.kind === 'enum') {
    return isValueCompatibleWithKind(project, 'enum', value, dataType.enumId)
  }

  return isValueCompatibleWithKind(project, dataType.kind, value)
}

function dataTypeLabel(dataType: ColumnDataType): string {
  if (dataType.kind === 'enum') {
    return `enum(${dataType.enumId})`
  }

  if (dataType.kind === 'list') {
    return `list(${dataType.itemType})`
  }

  return dataType.kind
}

function stableCellKey(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  return JSON.stringify(value)
}

function rowKey(row: DataRow, columns: readonly SchemaColumn[]): string | null {
  const values = columns.map((column) => row.cells[column.columnId])

  if (values.some(isBlankValue)) {
    return null
  }

  return values.map(stableCellKey).join('\u001f')
}

function columnsForIds(table: SchemaTable, columnIds: readonly EntityId[]): readonly SchemaColumn[] | null {
  const columns = columnIds.map((columnId) => findColumn(table, columnId))

  return columns.every(Boolean) ? columns as readonly SchemaColumn[] : null
}

function violatesRule(rule: ValidationRule, value: unknown): boolean {
  if (rule.kind === 'not_null') {
    return isBlankValue(value)
  }

  if (isBlankValue(value)) {
    return false
  }

  if (rule.kind === 'min') {
    const numericValue = numberValue(value)
    return numericValue !== null && typeof rule.value === 'number' && numericValue < rule.value
  }

  if (rule.kind === 'max') {
    const numericValue = numberValue(value)
    return numericValue !== null && typeof rule.value === 'number' && numericValue > rule.value
  }

  if (rule.kind === 'range' && typeof rule.value === 'object' && rule.value !== null) {
    const numericValue = numberValue(value)
    const range = rule.value as { readonly min?: unknown; readonly max?: unknown }

    return numericValue !== null &&
      ((typeof range.min === 'number' && numericValue < range.min) ||
        (typeof range.max === 'number' && numericValue > range.max))
  }

  if (rule.kind === 'regex' && typeof rule.value === 'string') {
    return typeof value !== 'string' || !new RegExp(rule.value).test(value)
  }

  if (rule.kind === 'one_of' && Array.isArray(rule.value)) {
    return !rule.value.some((candidate) => stableCellKey(candidate) === stableCellKey(value))
  }

  return false
}

function sameIdSet(left: readonly EntityId[], right: readonly EntityId[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id))
}

function findRelationCycles(project: SchemaProject): readonly { readonly tableIds: readonly EntityId[]; readonly relationIds: readonly EntityId[] }[] {
  const existingTableIds = new Set(project.tables.map((table) => table.tableId))
  const adjacency = new Map<EntityId, Relation[]>()

  for (const relation of project.relations) {
    if (relation.kind !== 'hard_fk' || !existingTableIds.has(relation.sourceTableId) || !existingTableIds.has(relation.targetTableId)) {
      continue
    }

    adjacency.set(relation.sourceTableId, [...(adjacency.get(relation.sourceTableId) ?? []), relation])
  }

  const visited = new Set<EntityId>()
  const stack: EntityId[] = []
  const relationStack: Relation[] = []
  const seenCycles = new Set<string>()
  const cycles: { readonly tableIds: readonly EntityId[]; readonly relationIds: readonly EntityId[] }[] = []

  function visit(tableId: EntityId) {
    const stackIndex = stack.indexOf(tableId)

    if (stackIndex >= 0) {
      const cycleTableIds = stack.slice(stackIndex)
      const cycleRelations = relationStack.slice(stackIndex)
      const key = [...cycleTableIds].sort().join('|')

      if (!seenCycles.has(key)) {
        seenCycles.add(key)
        cycles.push({
          tableIds: cycleTableIds,
          relationIds: cycleRelations.map((relation) => relation.relationId),
        })
      }

      return
    }

    if (visited.has(tableId)) {
      return
    }

    visited.add(tableId)
    stack.push(tableId)

    for (const relation of adjacency.get(tableId) ?? []) {
      relationStack.push(relation)
      visit(relation.targetTableId)
      relationStack.pop()
    }

    stack.pop()
  }

  for (const table of project.tables) {
    visit(table.tableId)
  }

  return cycles
}

export function validateProject(project: SchemaProject): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const tableIds = new Set(project.tables.map((table) => table.tableId))
  const enumIds = new Set(project.enums.map((schemaEnum) => schemaEnum.enumId))
  const duplicateTableNames = duplicateNames(project.tables.map((table) => table.name))
  const duplicateTableIds = duplicateIds(project.tables.map((table) => table.tableId))
  const duplicateColumnIds = duplicateIds(project.tables.flatMap((table) => table.columns.map((column) => column.columnId)))
  const duplicateRelationIds = duplicateIds(project.relations.map((relation) => relation.relationId))
  const duplicateEnumIds = duplicateIds(project.enums.map((schemaEnum) => schemaEnum.enumId))
  const duplicateExportViewIds = duplicateIds(project.exportViews.map((view) => view.viewId))

  for (const tableId of duplicateTableIds) {
    issues.push(
      issue({
        severity: 'blocking',
        title: '테이블 ID 중복',
        message: `내부 테이블 ID ${tableId}가 두 번 이상 사용됩니다. 이름은 실수로 중복될 수 있지만 ID는 절대 충돌하면 안 됩니다.`,
        tableIds: [tableId],
        suggestedFix: '저장하거나 명령을 적용하기 전에 한쪽 테이블 ID를 다시 생성하세요.',
      }),
    )
  }

  for (const columnId of duplicateColumnIds) {
    issues.push(
      issue({
        severity: 'blocking',
        title: '컬럼 ID 중복',
        message: `내부 컬럼 ID ${columnId}가 두 번 이상 사용됩니다. FK와 출력 계보가 안전하지 않게 됩니다.`,
        columnIds: [columnId],
        suggestedFix: '한쪽 컬럼 ID를 다시 생성하고 영향을 받은 관계를 다시 연결하세요.',
      }),
    )
  }

  for (const relationId of duplicateRelationIds) {
    issues.push(
      issue({
        severity: 'blocking',
        title: '관계 ID 중복',
        message: `내부 관계 ID ${relationId}가 두 번 이상 사용됩니다.`,
        relationIds: [relationId],
        suggestedFix: '한쪽 관계 ID를 다시 생성하세요.',
      }),
    )
  }

  for (const enumId of duplicateEnumIds) {
    issues.push(
      issue({
        severity: 'blocking',
        title: '열거형 ID 중복',
        message: `내부 열거형 ID ${enumId}가 두 번 이상 사용됩니다.`,
        suggestedFix: '한쪽 열거형 ID를 다시 생성하세요.',
      }),
    )
  }

  for (const viewId of duplicateExportViewIds) {
    issues.push(
      issue({
        severity: 'blocking',
        title: '출력 뷰 ID 중복',
        message: `내부 출력 뷰 ID ${viewId}가 두 번 이상 사용됩니다.`,
        suggestedFix: '한쪽 출력 뷰 ID를 다시 생성하세요.',
      }),
    )
  }

  for (const name of duplicateTableNames) {
    issues.push(
      issue({
        severity: 'blocking',
        title: '테이블 이름 중복',
        message: `${name} 이름의 테이블이 두 개 있습니다. 출력이나 관계가 어느 테이블을 의미하는지 구분하기 어렵습니다.`,
        suggestedFix: '한쪽 테이블 이름을 바꾸세요. 내부 ID는 유지되므로 기존 관계는 이름 변경 후에도 살아 있습니다.',
      }),
    )
  }

  for (const table of project.tables) {
    for (const column of table.columns) {
      if (column.tableId !== table.tableId) {
        issues.push(
          issue({
            severity: 'blocking',
            title: '컬럼의 소속 테이블 불일치',
            message: `${table.name}.${column.name}의 table ID가 부모 테이블과 일치하지 않습니다.`,
            tableIds: [table.tableId, column.tableId],
            columnIds: [column.columnId],
            suggestedFix: '저장하거나 관계를 적용하기 전에 컬럼 tableId를 복구하세요.',
          }),
        )
      }
    }

    const duplicateColumnNames = duplicateNames(table.columns.map((column) => column.name))

    for (const name of duplicateColumnNames) {
      issues.push(
        issue({
          severity: 'blocking',
          title: '컬럼 이름 중복',
          message: `${table.name}에 ${name} 컬럼이 두 개 이상 있습니다. CSV 출력 헤더가 모호해집니다.`,
          tableIds: [table.tableId],
          suggestedFix: '한쪽 컬럼 이름을 바꾸거나 반복 값을 하위 테이블로 분리하세요.',
        }),
      )
    }

    if (table.primaryKey.columnIds.length === 0) {
      issues.push(
        issue({
          severity: 'error',
          title: '기본키 누락',
          message: `${table.name}에 기본키가 없습니다. 다른 테이블이 이 행을 안전하게 참조할 수 없습니다.`,
          tableIds: [table.tableId],
          suggestedFix: '안정적인 ID 컬럼을 선택하거나 대체키를 추가하세요.',
        }),
      )
    }

    const missingPrimaryKeyColumns = missingColumns(table, table.primaryKey.columnIds)

    if (missingPrimaryKeyColumns.length > 0) {
      issues.push(
        issue({
          severity: 'blocking',
          title: '기본키가 없는 컬럼을 참조함',
          message: `${table.name} 기본키가 존재하지 않는 컬럼을 가리킵니다.`,
          tableIds: [table.tableId],
          columnIds: missingPrimaryKeyColumns,
          suggestedFix: '데이터나 출력을 변경하기 전에 기본키를 복구하세요.',
        }),
      )
    }

    for (const columnId of table.primaryKey.columnIds) {
      const column = findColumn(table, columnId)

      if (column?.nullable) {
        issues.push(
          issue({
            severity: 'blocking',
            title: '기본키가 빈 값을 허용함',
            message: `${table.name}.${column.name}은 기본키의 일부이지만 빈 값을 허용합니다.`,
            tableIds: [table.tableId],
            columnIds: [column.columnId],
            suggestedFix: '기본키 컬럼을 필수로 변경하세요.',
          }),
        )
      }
    }

    for (const constraint of table.uniqueConstraints) {
      const missingUniqueColumns = missingColumns(table, constraint.columnIds)

      if (missingUniqueColumns.length > 0) {
        issues.push(
          issue({
            severity: 'blocking',
            title: '고유 제약이 없는 컬럼을 참조함',
            message: `${table.name}.${constraint.name}이 더 이상 테이블에 없는 컬럼을 사용합니다.`,
            tableIds: [table.tableId],
            columnIds: missingUniqueColumns,
            suggestedFix: '제약에서 오래된 컬럼을 제거하거나 컬럼을 복원하세요.',
          }),
        )
      }
    }

    for (const constraint of table.checkConstraints) {
      const missingCheckColumns = missingColumns(table, constraint.columnIds)

      if (missingCheckColumns.length > 0) {
        issues.push(
          issue({
            severity: 'blocking',
            title: '체크 제약이 없는 컬럼을 참조함',
            message: `${table.name}.${constraint.name}이 더 이상 테이블에 없는 컬럼을 사용합니다.`,
            tableIds: [table.tableId],
            columnIds: missingCheckColumns,
            suggestedFix: '체크 제약에서 오래된 컬럼을 제거하거나 컬럼을 복원하세요.',
          }),
        )
      }
    }

    for (const column of table.columns) {
      if (column.dataType.kind === 'enum' && !enumIds.has(column.dataType.enumId)) {
        issues.push(
          issue({
            severity: 'blocking',
            title: '열거형 참조 누락',
            message: `${table.name}.${column.name}이 존재하지 않는 열거형을 가리킵니다.`,
            tableIds: [table.tableId],
            columnIds: [column.columnId],
            suggestedFix: '이 컬럼 타입을 적용하기 전에 기존 열거형을 선택하거나 새 열거형을 만드세요.',
          }),
        )
      }

      if (hasInvalidRangeRule(column)) {
        issues.push(
          issue({
            severity: 'blocking',
            title: '컬럼 범위 규칙 불가능',
            message: `${table.name}.${column.name}의 범위 규칙에서 최소값이 최대값보다 큽니다.`,
            tableIds: [table.tableId],
            columnIds: [column.columnId],
            suggestedFix: '검증이나 출력 규칙을 적용하기 전에 범위를 수정하세요.',
          }),
        )
      }
    }

    for (const group of findRepeatedColumnGroups(table)) {
      issues.push(
        issue({
          severity: 'warning',
          title: '반복 컬럼 패턴',
          message: `${table.name}에서 ${group} 컬럼이 반복되는 것으로 보입니다. 여러 값이 한 행에 눌러 담긴 구조일 수 있습니다.`,
          tableIds: [table.tableId],
          suggestedFix: '반복 값마다 한 행을 갖는 하위 테이블을 고려하세요.',
        }),
      )
    }
  }

  for (const relation of project.relations) {
    const sourceTable = findTable(project, relation.sourceTableId)
    const targetTable = findTable(project, relation.targetTableId)

    if (!sourceTable || !targetTable) {
      issues.push(
        issue({
          severity: 'blocking',
          title: '관계 테이블 누락',
          message: `${relation.name} 관계가 존재하지 않는 테이블을 가리킵니다.`,
          tableIds: [relation.sourceTableId, relation.targetTableId].filter((tableId) => !tableIds.has(tableId)),
          relationIds: [relation.relationId],
          suggestedFix: '관계를 현재 존재하는 테이블에 다시 연결하거나 오래된 관계를 제거하세요.',
        }),
      )
      continue
    }

    const missingSourceColumns = missingColumns(sourceTable, relation.sourceColumnIds)
    const missingTargetColumns = missingColumns(targetTable, relation.targetColumnIds)

    if (missingSourceColumns.length > 0 || missingTargetColumns.length > 0) {
      issues.push(
        issue({
          severity: 'blocking',
          title: '관계 컬럼 누락',
          message: `${relation.name} 관계가 더 이상 존재하지 않는 컬럼을 참조합니다.`,
          tableIds: [sourceTable.tableId, targetTable.tableId],
          columnIds: [...missingSourceColumns, ...missingTargetColumns],
          relationIds: [relation.relationId],
          suggestedFix: '런타임 데이터를 내보내기 전에 FK 매핑을 복구하세요.',
        }),
      )
    }

    if (relation.sourceColumnIds.length !== relation.targetColumnIds.length) {
      issues.push(
        issue({
          severity: 'blocking',
          title: '복합 관계 컬럼 수 불일치',
          message: `${relation.name} 관계가 원본 컬럼 ${relation.sourceColumnIds.length}개를 대상 컬럼 ${relation.targetColumnIds.length}개에 매핑합니다.`,
          tableIds: [sourceTable.tableId, targetTable.tableId],
          relationIds: [relation.relationId],
          suggestedFix: '각 원본 키 컬럼을 정확히 하나의 대상 키 컬럼에 매핑하세요.',
        }),
      )
    }

    if (missingSourceColumns.length === 0 && missingTargetColumns.length === 0) {
      relation.sourceColumnIds.forEach((sourceColumnId, index) => {
        const targetColumnId = relation.targetColumnIds[index]
        const sourceColumn = findColumn(sourceTable, sourceColumnId)
        const targetColumn = findColumn(targetTable, targetColumnId)

        if (sourceColumn && targetColumn && !areRelationTypesCompatible(sourceColumn, targetColumn)) {
          issues.push(
            issue({
              severity: 'error',
              title: '관계 컬럼 타입 불일치',
              message: `${sourceTable.name}.${sourceColumn.name}은 ${dataTypeKey(sourceColumn.dataType)} 타입이고, ${targetTable.name}.${targetColumn.name}은 ${dataTypeKey(targetColumn.dataType)} 타입입니다.`,
              tableIds: [sourceTable.tableId, targetTable.tableId],
              columnIds: [sourceColumn.columnId, targetColumn.columnId],
              relationIds: [relation.relationId],
              suggestedFix: 'FK 컬럼 타입을 맞추거나 관계 종류를 소프트 참조로 바꾸세요.',
            }),
          )
        }
      })
    }
  }

  for (const cycle of findRelationCycles(project)) {
    const cycleTableNames = cycle.tableIds
      .map((tableId) => findTable(project, tableId)?.name ?? tableId)
      .join(' -> ')

    issues.push(
      issue({
        severity: 'warning',
        title: 'Hard FK 순환 감지',
        message: `Hard FK 참조가 순환을 이룹니다: ${cycleTableNames}. 가져오기 순서, 마이그레이션 롤백, 런타임 로딩이 취약해질 수 있습니다.`,
        tableIds: cycle.tableIds,
        relationIds: cycle.relationIds,
        suggestedFix: '빈 값 허용 FK, 조인 테이블, 또는 런타임에서 늦게 해석 가능한 소프트 참조로 순환을 끊으세요.',
      }),
    )
  }

  for (const dependency of project.functionalDependencies) {
    const table = findTable(project, dependency.tableId)

    if (!table) {
      issues.push(
        issue({
          severity: 'blocking',
          title: '정규화 규칙의 테이블 누락',
          message: '정규화 규칙이 더 이상 존재하지 않는 테이블을 가리킵니다.',
          tableIds: [dependency.tableId],
          suggestedFix: '오래된 정규화 규칙을 제거하거나 현재 테이블에 다시 연결하세요.',
        }),
      )
      continue
    }

    const missingDeterminants = missingColumns(table, dependency.determinantColumnIds)
    const missingDependents = missingColumns(table, dependency.dependentColumnIds)

    if (missingDeterminants.length > 0 || missingDependents.length > 0) {
      issues.push(
        issue({
          severity: 'blocking',
          title: '정규화 규칙이 없는 열을 참조함',
          message: `${table.name}에 더 이상 존재하지 않는 열을 지칭하는 정규화 규칙이 있습니다.`,
          tableIds: [table.tableId],
          columnIds: [...missingDeterminants, ...missingDependents],
          suggestedFix: '고급 정규화 검토 전에 규칙을 갱신하거나 제거하세요.',
        }),
      )
    }

    const primaryKey = new Set(table.primaryKey.columnIds)
    const determinantIsPartialKey =
      table.primaryKey.columnIds.length > 1 &&
      dependency.determinantColumnIds.every((columnId) => primaryKey.has(columnId)) &&
      dependency.determinantColumnIds.length < table.primaryKey.columnIds.length

    if (determinantIsPartialKey) {
      const determinantLabels = dependency.determinantColumnIds.map((columnId) => getColumnLabel(project, table.tableId, columnId))

      issues.push(
        issue({
          severity: 'warning',
          title: '부분키 종속 가능성',
          message: `${table.name}에 전체 복합키가 아니라 ${determinantLabels.join(', ')}에만 의존하는 데이터가 있습니다.`,
          tableIds: [table.tableId],
          columnIds: [...dependency.determinantColumnIds, ...dependency.dependentColumnIds],
          suggestedFix: '해당 종속 컬럼을 부분키가 식별하는 테이블로 이동하세요.',
        }),
      )
    }

    const determinantIsPrimaryKey = sameIdSet(dependency.determinantColumnIds, table.primaryKey.columnIds)
    const determinantIncludesPrimaryKey = table.primaryKey.columnIds.every((columnId) => dependency.determinantColumnIds.includes(columnId))
    const dependentTouchesPrimaryKey = dependency.dependentColumnIds.some((columnId) => primaryKey.has(columnId))

    if (!determinantIsPrimaryKey && !determinantIncludesPrimaryKey && !dependentTouchesPrimaryKey) {
      const determinantLabels = dependency.determinantColumnIds.map((columnId) => getColumnLabel(project, table.tableId, columnId))
      const dependentLabels = dependency.dependentColumnIds.map((columnId) => getColumnLabel(project, table.tableId, columnId))

      issues.push(
        issue({
          severity: 'warning',
          title: '이행 종속 가능성',
          message: `${table.name}에서 ${determinantLabels.join(', ')}이 테이블 키가 아닌데도 ${dependentLabels.join(', ')}을 결정한다고 표시되어 있습니다.`,
          tableIds: [table.tableId],
          columnIds: [...dependency.determinantColumnIds, ...dependency.dependentColumnIds],
          suggestedFix: '결정 컬럼과 종속 컬럼을 별도 룩업 테이블로 추출하는 것을 고려하세요.',
        }),
      )
    }
  }

  for (const exportView of project.exportViews) {
    for (const exportColumn of exportView.columns) {
      const table = findTable(project, exportColumn.sourceTableId)
      const column = table ? findColumn(table, exportColumn.sourceColumnId) : undefined

      if (!table || !column) {
        issues.push(
          issue({
            severity: 'blocking',
            title: '출력 뷰 원본 누락',
            message: `${exportView.name}.${exportColumn.header}는 원본 컬럼이 없어 생성할 수 없습니다.`,
            tableIds: [exportColumn.sourceTableId],
            columnIds: [exportColumn.sourceColumnId],
            suggestedFix: '출력 컬럼을 현재 원본 컬럼에 다시 연결하거나 런타임 뷰에서 제거하세요.',
          }),
        )
      }
    }

    const duplicateHeaders = duplicateNames(exportView.columns.map((column) => column.header))

    for (const header of duplicateHeaders) {
      issues.push(
        issue({
          severity: 'error',
          title: '출력 헤더 충돌',
          message: `${exportView.name}에서 ${header} 컬럼이 두 개 이상 출력됩니다.`,
          suggestedFix: '런타임 헤더 하나의 이름을 바꾸세요. 작성용 컬럼 이름을 바꿀 필요는 없습니다.',
        }),
      )
    }
  }

  return issues
}

export function validateRows(project: SchemaProject, rowsByTable: RowsByTable): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const table of project.tables) {
    if (!hasOwnRows(rowsByTable, table.tableId)) {
      continue
    }

    const rows = rowsByTable[table.tableId] ?? []
    const knownColumnIds = new Set(table.columns.map((column) => column.columnId))

    rows.forEach((row, rowIndex) => {
      // Empty rows are the workbook's editable canvas. They become real data
      // only after a value is entered, so do not mark their required fields as
      // errors while the user is simply scrolling through blank rows.
      if (isEmptyDataRow(row)) return

      for (const columnId of Object.keys(row.cells)) {
        if (!knownColumnIds.has(columnId)) {
          issues.push(
            issue({
              severity: 'warning',
              title: '행에 알 수 없는 컬럼 포함',
              message: `${table.name} ${rowIndex + 1}행에 ${columnId}이 있지만 스키마에 일치하는 컬럼 ID가 없습니다.`,
              tableIds: [table.tableId],
              rowIndices: [rowIndex],
              dataPath: [table.tableId, row.rowId, columnId],
              suggestedFix: '내보내기 전에 추가 필드를 제거하거나 스키마에 컬럼을 추가하세요.',
            }),
          )
        }
      }

      for (const column of table.columns) {
        const value = row.cells[column.columnId]

        if (!column.nullable && isBlankValue(value)) {
          issues.push(
            issue({
              severity: 'error',
              title: '필수 값이 비어 있음',
              message: `${table.name}.${column.name}은 필수이지만 ${rowIndex + 1}행에 값이 없습니다.`,
              tableIds: [table.tableId],
              columnIds: [column.columnId],
              rowIndices: [rowIndex],
              dataPath: [table.tableId, row.rowId, column.columnId],
              suggestedFix: '값을 채우거나 검토된 마이그레이션으로 컬럼을 빈 값 허용 상태로 바꾸세요.',
            }),
          )
          continue
        }

        if (!isBlankValue(value) && !isValueCompatibleWithDataType(project, column.dataType, value)) {
          issues.push(
            issue({
              severity: 'error',
              title: '셀 값 타입 불일치',
              message: `${table.name}.${column.name}은 ${dataTypeLabel(column.dataType)} 타입을 기대하지만 ${rowIndex + 1}행에는 ${JSON.stringify(value)} 값이 있습니다.`,
              tableIds: [table.tableId],
              columnIds: [column.columnId],
              rowIndices: [rowIndex],
              dataPath: [table.tableId, row.rowId, column.columnId],
              suggestedFix: '셀 값을 변환하거나 마이그레이션으로 컬럼 타입을 변경하세요.',
            }),
          )
        }

        for (const rule of column.validationRules) {
          if (violatesRule(rule, value)) {
            issues.push(
              issue({
                severity: 'error',
                title: '검증 규칙 실패',
                message: `${table.name}.${column.name}이 ${rowIndex + 1}행에서 ${rule.kind} 규칙을 통과하지 못했습니다: ${rule.message}`,
                tableIds: [table.tableId],
                columnIds: [column.columnId],
                rowIndices: [rowIndex],
                dataPath: [table.tableId, row.rowId, column.columnId],
                suggestedFix: rule.message || '컬럼 규칙을 만족하도록 셀 값을 수정하세요.',
              }),
            )
          }
        }
      }
    })

    const primaryKeyColumns = columnsForIds(table, table.primaryKey.columnIds)

    if (primaryKeyColumns) {
      const blankPrimaryKeyRows = rows
        .map((row, rowIndex) => ({ row, rowIndex }))
        .filter(({ row }) => !isEmptyDataRow(row) && rowKey(row, primaryKeyColumns) === null)
        .map(({ rowIndex }) => rowIndex)

      if (blankPrimaryKeyRows.length > 0) {
        issues.push(
          issue({
            severity: 'error',
            title: '기본키 값이 비어 있음',
            message: `${table.name}의 ${blankPrimaryKeyRows.map((rowIndex) => `${rowIndex + 1}행`).join(', ')}에 빈 기본키 값이 있습니다.`,
            tableIds: [table.tableId],
            columnIds: table.primaryKey.columnIds,
            rowIndices: blankPrimaryKeyRows,
            suggestedFix: '이 테이블을 내보내거나 참조하기 전에 모든 기본키 컬럼을 채우세요.',
          }),
        )
      }

      issues.push(...duplicateKeyIssues(table, rows, primaryKeyColumns, '기본키 중복', table.primaryKey.columnIds, '기본키 값은 정확히 하나의 행만 식별해야 합니다.'))
    }

    for (const constraint of table.uniqueConstraints) {
      const uniqueColumns = columnsForIds(table, constraint.columnIds)

      if (!uniqueColumns) {
        continue
      }

      issues.push(...duplicateKeyIssues(table, rows, uniqueColumns, '고유 제약 중복', constraint.columnIds, `${constraint.name}은 값이 비어 있지 않은 모든 행에서 고유해야 합니다.`))
    }
  }

  for (const relation of project.relations) {
    const sourceTable = findTable(project, relation.sourceTableId)
    const targetTable = findTable(project, relation.targetTableId)

    if (!sourceTable || !targetTable || !hasOwnRows(rowsByTable, sourceTable.tableId) || !hasOwnRows(rowsByTable, targetTable.tableId)) {
      continue
    }

    const sourceColumns = columnsForIds(sourceTable, relation.sourceColumnIds)
    const targetColumns = columnsForIds(targetTable, relation.targetColumnIds)

    if (!sourceColumns || !targetColumns || sourceColumns.length !== targetColumns.length) {
      continue
    }

    const targetKeys = new Set(
      (rowsByTable[targetTable.tableId] ?? [])
        .map((row) => rowKey(row, targetColumns))
        .filter((key): key is string => key !== null),
    )

    for (const [rowIndex, row] of (rowsByTable[sourceTable.tableId] ?? []).entries()) {
      if (isEmptyDataRow(row)) continue
      const sourceKey = rowKey(row, sourceColumns)

      if (sourceKey === null) {
        if (relation.required) {
          issues.push(
            issue({
              severity: 'error',
              title: '필수 관계 값이 비어 있음',
              message: `${relation.name}은 필수 관계이지만 ${sourceTable.name} ${rowIndex + 1}행의 FK 값이 비어 있습니다.`,
              tableIds: [sourceTable.tableId, targetTable.tableId],
              columnIds: relation.sourceColumnIds,
              relationIds: [relation.relationId],
              rowIndices: [rowIndex],
              suggestedFix: '내보내기 전에 FK 값을 채우거나 관계를 선택 사항으로 바꾸세요.',
            }),
          )
        }

        continue
      }

      if (!targetKeys.has(sourceKey)) {
        issues.push(
          issue({
            severity: 'error',
            title: '외래키 대상 누락',
            message: `${sourceTable.name} ${rowIndex + 1}행이 ${targetTable.name}을 참조하지만 일치하는 키를 가진 대상 행이 없습니다.`,
            tableIds: [sourceTable.tableId, targetTable.tableId],
            columnIds: [...relation.sourceColumnIds, ...relation.targetColumnIds],
            relationIds: [relation.relationId],
            rowIndices: [rowIndex],
            suggestedFix: '대상 행을 추가하거나 FK 값을 수정하거나 관계를 소프트 참조로 바꾸세요.',
          }),
        )
      }
    }
  }

  for (const dependency of project.functionalDependencies) {
    const table = findTable(project, dependency.tableId)

    if (!table || !hasOwnRows(rowsByTable, table.tableId)) {
      continue
    }

    const determinantColumns = columnsForIds(table, dependency.determinantColumnIds)
    const dependentColumns = columnsForIds(table, dependency.dependentColumnIds)

    if (!determinantColumns || !dependentColumns) {
      continue
    }

    const groupedDependents = new Map<string, Map<string, number[]>>()

    for (const [rowIndex, row] of (rowsByTable[table.tableId] ?? []).entries()) {
      const determinantKey = rowKey(row, determinantColumns)

      if (determinantKey === null) {
        continue
      }

      const dependentKey = dependentColumns.map((column) => stableCellKey(row.cells[column.columnId])).join('\u001f')
      const variants = groupedDependents.get(determinantKey) ?? new Map<string, number[]>()
      variants.set(dependentKey, [...(variants.get(dependentKey) ?? []), rowIndex])
      groupedDependents.set(determinantKey, variants)
    }

    for (const variants of groupedDependents.values()) {
      if (variants.size <= 1) {
        continue
      }

      const rowIndices = [...variants.values()].flat()

      issues.push(
        issue({
          severity: 'warning',
          title: '정규화 규칙 데이터 충돌',
          message: `${table.name}에 같은 결정자 값이 서로 다른 종속 값을 만드는 행이 있습니다.`,
          tableIds: [table.tableId],
          columnIds: [...dependency.determinantColumnIds, ...dependency.dependentColumnIds],
          rowIndices,
          suggestedFix: '종속 값을 룩업 테이블로 정규화하거나 충돌 행을 수정하세요.',
        }),
      )
    }
  }

  return issues
}

function duplicateKeyIssues(
  table: SchemaTable,
  rows: readonly DataRow[],
  columns: readonly SchemaColumn[],
  title: string,
  columnIds: readonly EntityId[],
  suggestedFix: string,
): readonly ValidationIssue[] {
  const keys = new Map<string, number[]>()

  for (const [rowIndex, row] of rows.entries()) {
    const key = rowKey(row, columns)

    if (key === null) {
      continue
    }

    keys.set(key, [...(keys.get(key) ?? []), rowIndex])
  }

  return [...keys.values()]
    .filter((rowIndices) => rowIndices.length > 1)
    .map((rowIndices) =>
      issue({
        severity: 'error',
        title,
        message: `${table.name}의 ${rowIndices.map((rowIndex) => `${rowIndex + 1}행`).join(', ')}에서 같은 키가 반복됩니다.`,
        tableIds: [table.tableId],
        columnIds,
        rowIndices,
        suggestedFix,
      }),
    )
}

export function validateProjectWithRows(project: SchemaProject, rowsByTable: RowsByTable): readonly ValidationIssue[] {
  return [...validateProject(project), ...validateRows(project, rowsByTable)]
}
