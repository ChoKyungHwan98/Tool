import { makeId } from './ids'
import { describeColumnRenameImpact, describeNullableImpact } from './impact'
import { findColumn, findTable, requireColumn, requireTable } from './projectQueries'
import { validateProject } from './validator'
import { validateColumnName } from './columnNames'
import type {
  CheckConstraint,
  CanvasNodeLayout,
  ColumnDataType,
  CommandHistoryEntry,
  EntityId,
  ExportView,
  FunctionalDependency,
  ImpactReport,
  Relation,
  SchemaColumn,
  SchemaProject,
  SchemaTable,
  UniqueConstraint,
  ValidationIssue,
} from './schema'

export interface CommandValidation {
  readonly ok: boolean
  readonly issues: readonly ValidationIssue[]
}

export interface SchemaCommand<TSerialized extends SerializedCommand = SerializedCommand> {
  readonly type: TSerialized['type']
  validate(project: SchemaProject): CommandValidation
  describe(project: SchemaProject): string
  describeImpact(project: SchemaProject): ImpactReport
  preview(project: SchemaProject): SchemaProject
  execute(project: SchemaProject): SchemaProject
  undo(project: SchemaProject): SchemaProject
  serialize(): TSerialized
}

export type RenameColumnSerialized = {
  readonly type: 'RenameColumn'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly columnId: EntityId
  readonly nextName: string
  readonly previousName?: string
}

export type ChangeNullableSerialized = {
  readonly type: 'ChangeNullable'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly columnId: EntityId
  readonly nullable: boolean
  readonly previousNullable?: boolean
}

export type AddColumnSerialized = {
  readonly type: 'AddColumn'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly column: SchemaColumn
  readonly targetIndex?: number
}

export type ReorderColumnSerialized = {
  readonly type: 'ReorderColumn'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly columnId: EntityId
  readonly targetIndex: number
  readonly previousIndex?: number
}

export type RenameTableSerialized = {
  readonly type: 'RenameTable'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly nextName: string
  readonly previousName?: string
}

export type ChangeTableDescriptionSerialized = {
  readonly type: 'ChangeTableDescription'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly description: string
  readonly previousDescription?: string
}

export type ChangeColumnDescriptionSerialized = {
  readonly type: 'ChangeColumnDescription'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly columnId: EntityId
  readonly description: string
  readonly previousDescription?: string
}

export type DeleteColumnSerialized = {
  readonly type: 'DeleteColumn'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly columnId: EntityId
  readonly approved?: boolean
  readonly deletedColumn?: SchemaColumn
  readonly deletedColumnIndex?: number
  readonly deletedRelations?: readonly Relation[]
}

export type ChangeColumnTypeSerialized = {
  readonly type: 'ChangeColumnType'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly columnId: EntityId
  readonly nextDataType: ColumnDataType
  readonly previousDataType?: ColumnDataType
}

export type CreateTableSerialized = {
  readonly type: 'CreateTable'
  readonly commandId: EntityId
  readonly table: SchemaTable
  readonly layout?: CanvasNodeLayout
}

export type MoveTableLayoutSerialized = {
  readonly type: 'MoveTableLayout'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly x: number
  readonly y: number
  readonly previousX?: number
  readonly previousY?: number
  readonly previousHadLayout?: boolean
}

export type MoveTablesLayoutSerialized = {
  readonly type: 'MoveTablesLayout'
  readonly commandId: EntityId
  readonly positions: readonly CanvasNodeLayout[]
  readonly previousNodes?: readonly CanvasNodeLayout[]
}

export type DeleteTableSerialized = {
  readonly type: 'DeleteTable'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly approved?: boolean
  readonly deletedTable?: SchemaTable
  readonly deletedRelations?: readonly Relation[]
}

export type ChangePrimaryKeySerialized = {
  readonly type: 'ChangePrimaryKey'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly nextColumnIds: readonly EntityId[]
  readonly previousColumnIds?: readonly EntityId[]
}

export type AddForeignKeySerialized = {
  readonly type: 'AddForeignKey'
  readonly commandId: EntityId
  readonly relation: Relation
}

export type DeleteForeignKeySerialized = {
  readonly type: 'DeleteForeignKey'
  readonly commandId: EntityId
  readonly relationId: EntityId
  readonly approved?: boolean
  readonly deletedRelation?: Relation
}

export type AddUniqueConstraintSerialized = {
  readonly type: 'AddUniqueConstraint'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly constraint: UniqueConstraint
}

export type AddCheckConstraintSerialized = {
  readonly type: 'AddCheckConstraint'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly constraint: CheckConstraint
}

export type AddFunctionalDependencySerialized = {
  readonly type: 'AddFunctionalDependency'
  readonly commandId: EntityId
  readonly dependency: FunctionalDependency
}

export type SplitTableSerialized = {
  readonly type: 'SplitTable'
  readonly commandId: EntityId
  readonly sourceTableId: EntityId
  readonly movedColumnIds: readonly EntityId[]
  readonly newTable: SchemaTable
  readonly relation?: Relation
  readonly approved?: boolean
  readonly previousSourceTable?: SchemaTable
}

export type MergeTableSerialized = {
  readonly type: 'MergeTable'
  readonly commandId: EntityId
  readonly sourceTableId: EntityId
  readonly targetTableId: EntityId
  readonly approved?: boolean
  readonly previousSourceTable?: SchemaTable
  readonly previousTargetTable?: SchemaTable
  readonly removedRelations?: readonly Relation[]
}

export type ExtractLookupTableSerialized = {
  readonly type: 'ExtractLookupTable'
  readonly commandId: EntityId
  readonly sourceTableId: EntityId
  readonly lookupTable: SchemaTable
  readonly relation: Relation
}

export type CreateJunctionTableSerialized = {
  readonly type: 'CreateJunctionTable'
  readonly commandId: EntityId
  readonly table: SchemaTable
  readonly relations: readonly Relation[]
}

export type AddSurrogateKeySerialized = {
  readonly type: 'AddSurrogateKey'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly column: SchemaColumn
  readonly previousPrimaryKey?: readonly EntityId[]
}

export type BackfillColumnSerialized = {
  readonly type: 'BackfillColumn'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly columnId: EntityId
  readonly strategy: 'fixed_default' | 'formula' | 'manual' | 'import_mapping'
  readonly value?: unknown
  readonly previousDefaultValue?: unknown
}

export type CreateExportViewSerialized = {
  readonly type: 'CreateExportView'
  readonly commandId: EntityId
  readonly view: ExportView
}

export type ModifyExportViewSerialized = {
  readonly type: 'ModifyExportView'
  readonly commandId: EntityId
  readonly viewId: EntityId
  readonly nextView: ExportView
  readonly previousView?: ExportView
}

export type SerializedCommand =
  | RenameColumnSerialized
  | ChangeNullableSerialized
  | AddColumnSerialized
  | ReorderColumnSerialized
  | RenameTableSerialized
  | ChangeTableDescriptionSerialized
  | ChangeColumnDescriptionSerialized
  | DeleteColumnSerialized
  | ChangeColumnTypeSerialized
  | CreateTableSerialized
  | MoveTableLayoutSerialized
  | MoveTablesLayoutSerialized
  | DeleteTableSerialized
  | ChangePrimaryKeySerialized
  | AddForeignKeySerialized
  | DeleteForeignKeySerialized
  | AddUniqueConstraintSerialized
  | AddCheckConstraintSerialized
  | AddFunctionalDependencySerialized
  | SplitTableSerialized
  | MergeTableSerialized
  | ExtractLookupTableSerialized
  | CreateJunctionTableSerialized
  | AddSurrogateKeySerialized
  | BackfillColumnSerialized
  | CreateExportViewSerialized
  | ModifyExportViewSerialized

function blocking(title: string, message: string, tableIds: readonly EntityId[], columnIds: readonly EntityId[] = []): ValidationIssue {
  return {
    issueId: makeId('issue'),
    severity: 'blocking',
    title,
    message,
    tableIds,
    columnIds,
    relationIds: [],
    suggestedFix: '변경을 적용하기 전에 명령 대상을 복구하세요.',
  }
}

function replaceTable(project: SchemaProject, tableId: EntityId, updater: (table: ReturnType<typeof requireTable>) => ReturnType<typeof requireTable>): SchemaProject {
  return {
    ...project,
    tables: project.tables.map((table) => (table.tableId === tableId ? updater(table) : table)),
  }
}

function insertAt<T>(items: readonly T[], index: number, item: T): readonly T[] {
  const next = [...items]
  next.splice(Math.max(0, Math.min(index, next.length)), 0, item)
  return next
}

function blockedApproval(commandName: string, entityName: string): ValidationIssue {
  return {
    issueId: makeId('issue'),
    severity: 'blocking',
    title: '승인 필요',
    message: `${commandName} 명령은 스키마 데이터나 참조를 제거할 수 있습니다. 실행 전에 변경 검토에서 ${entityName} 승인이 필요합니다.`,
    tableIds: [],
    columnIds: [],
    relationIds: [],
    suggestedFix: '변경 검토를 열고 삭제성 명령을 승인하세요.',
  }
}

function appendHistory(project: SchemaProject, command: SerializedCommand, impact: ImpactReport): SchemaProject {
  const entry: CommandHistoryEntry = {
    commandId: command.commandId,
    type: command.type,
    summary: impact.summary,
    executedAt: new Date().toISOString(),
    affectedEntityIds: [
      ...impact.affectedTableIds,
      ...impact.affectedColumnIds,
      ...impact.affectedRelationIds,
      ...impact.affectedExportViewIds,
    ],
  }

  return {
    ...project,
    commandHistory: [...project.commandHistory, entry],
  }
}

function withValidation(project: SchemaProject): CommandValidation {
  const issues = validateProject(project)
  const hasBlocking = issues.some((issue) => issue.severity === 'blocking')

  return {
    ok: !hasBlocking,
    issues,
  }
}

export class RenameColumnCommand implements SchemaCommand<RenameColumnSerialized> {
  readonly type = 'RenameColumn'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly columnId: EntityId
  readonly nextName: string
  readonly previousName?: string

  constructor(input: Omit<RenameColumnSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.tableId = input.tableId
    this.columnId = input.columnId
    this.nextName = input.nextName
    this.previousName = input.previousName
  }

  validate(project: SchemaProject): CommandValidation {
    const table = findTable(project, this.tableId)
    const column = table ? findColumn(table, this.columnId) : undefined

    if (!table || !column) {
      return { ok: false, issues: [blocking('이름 변경 대상 없음', '선택한 컬럼이 더 이상 존재하지 않습니다.', [this.tableId], [this.columnId])] }
    }

    const nameError = validateColumnName(table, this.columnId, this.nextName)
    if (nameError) {
      return { ok: false, issues: [blocking('컬럼 이름을 사용할 수 없음', nameError, [this.tableId], [this.columnId])] }
    }

    return withValidation(project)
  }

  describe(project: SchemaProject): string {
    const table = requireTable(project, this.tableId)
    const column = requireColumn(table, this.columnId)

    return `${table.name}.${column.name} 컬럼명을 ${this.nextName}(으)로 변경합니다.`
  }

  describeImpact(project: SchemaProject): ImpactReport {
    return describeColumnRenameImpact(project, this.tableId, this.columnId, this.nextName)
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project, this.nextName, false)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project, this.nextName, false), this.serializeWithPrevious(project), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    const previousName = this.previousName

    if (!previousName) {
      throw new Error('이전 이름이 없어 RenameColumn을 되돌릴 수 없습니다.')
    }

    return this.apply(project, previousName, true)
  }

  serialize(): RenameColumnSerialized {
    return {
      type: 'RenameColumn',
      commandId: this.commandId,
      tableId: this.tableId,
      columnId: this.columnId,
      nextName: this.nextName,
      previousName: this.previousName,
    }
  }

  private serializeWithPrevious(project: SchemaProject): RenameColumnSerialized {
    const table = requireTable(project, this.tableId)
    const column = requireColumn(table, this.columnId)

    return {
      ...this.serialize(),
      previousName: column.name,
    }
  }

  private apply(project: SchemaProject, name: string, undo: boolean): SchemaProject {
    const updated = replaceTable(project, this.tableId, (table) => ({
      ...table,
      columns: table.columns.map((column) =>
        column.columnId === this.columnId
          ? { ...column, name, displayName: name }
          : column,
      ),
    }))

    return undo ? updated : updated
  }
}

export class ChangeNullableCommand implements SchemaCommand<ChangeNullableSerialized> {
  readonly type = 'ChangeNullable'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly columnId: EntityId
  readonly nullable: boolean
  readonly previousNullable?: boolean

  constructor(input: Omit<ChangeNullableSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.tableId = input.tableId
    this.columnId = input.columnId
    this.nullable = input.nullable
    this.previousNullable = input.previousNullable
  }

  validate(project: SchemaProject): CommandValidation {
    const table = findTable(project, this.tableId)
    const column = table ? findColumn(table, this.columnId) : undefined

    if (!table || !column) {
      return { ok: false, issues: [blocking('빈 값 변경 대상 없음', '선택한 컬럼이 더 이상 존재하지 않습니다.', [this.tableId], [this.columnId])] }
    }

    if (table.primaryKey.columnIds.includes(this.columnId) && this.nullable) {
      return {
        ok: false,
        issues: [
          blocking(
            '기본키는 빈 값을 허용할 수 없음',
            `${table.name}.${column.name}은 기본키의 일부입니다. 키 컬럼에는 항상 값이 있어야 합니다.`,
            [this.tableId],
            [this.columnId],
          ),
        ],
      }
    }

    return withValidation(project)
  }

  describe(project: SchemaProject): string {
    const table = requireTable(project, this.tableId)
    const column = requireColumn(table, this.columnId)

    return `${table.name}.${column.name} 컬럼을 ${this.nullable ? '빈 값 허용' : '필수'} 상태로 변경합니다.`
  }

  describeImpact(project: SchemaProject): ImpactReport {
    return describeNullableImpact(project, this.tableId, this.columnId, this.nullable)
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project, this.nullable)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project, this.nullable), this.serializeWithPrevious(project), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    if (this.previousNullable === undefined) {
      throw new Error('이전 빈 값 허용 상태가 없어 ChangeNullable을 되돌릴 수 없습니다.')
    }

    return this.apply(project, this.previousNullable)
  }

  serialize(): ChangeNullableSerialized {
    return {
      type: 'ChangeNullable',
      commandId: this.commandId,
      tableId: this.tableId,
      columnId: this.columnId,
      nullable: this.nullable,
      previousNullable: this.previousNullable,
    }
  }

  private serializeWithPrevious(project: SchemaProject): ChangeNullableSerialized {
    const table = requireTable(project, this.tableId)
    const column = requireColumn(table, this.columnId)

    return {
      ...this.serialize(),
      previousNullable: column.nullable,
    }
  }

  private apply(project: SchemaProject, nullable: boolean): SchemaProject {
    return replaceTable(project, this.tableId, (table) => ({
      ...table,
      columns: table.columns.map((column) =>
        column.columnId === this.columnId
          ? { ...column, nullable }
          : column,
      ),
    }))
  }
}

export class AddColumnCommand implements SchemaCommand<AddColumnSerialized> {
  readonly type = 'AddColumn'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly column: SchemaColumn
  readonly targetIndex?: number

  constructor(input: Omit<AddColumnSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.tableId = input.tableId
    this.column = input.column
    this.targetIndex = input.targetIndex
  }

  validate(project: SchemaProject): CommandValidation {
    const table = findTable(project, this.tableId)

    if (!table) {
      return { ok: false, issues: [blocking('테이블 없음', '대상 테이블이 더 이상 존재하지 않습니다.', [this.tableId])] }
    }

    const duplicateName = table.columns.some((column) => column.name.toLowerCase() === this.column.name.toLowerCase())
    const duplicateId = table.columns.some((column) => column.columnId === this.column.columnId)

    if (duplicateName || duplicateId) {
      return {
        ok: false,
        issues: [
          blocking(
            '컬럼 중복',
            `${table.name}에 이미 ${this.column.name}이 있습니다.`,
            [this.tableId],
            [this.column.columnId],
          ),
        ],
      }
    }

    return withValidation(project)
  }

  describe(project: SchemaProject): string {
    const table = requireTable(project, this.tableId)

    return `${table.name}에 ${this.column.name} 컬럼을 추가합니다.`
  }

  describeImpact(project: SchemaProject): ImpactReport {
    const table = requireTable(project, this.tableId)

    return {
      summary: `${table.name}에 ${this.column.name} 컬럼이 추가됩니다.`,
      affectedTableIds: [this.tableId],
      affectedColumnIds: [this.column.columnId],
      affectedRelationIds: [],
      affectedExportViewIds: [],
      affectedCsvHeaders: [],
      existingDataRisk: this.column.nullable
        ? ['디자이너가 값을 백필하기 전까지 기존 행은 빈 값을 유지할 수 있습니다.']
        : ['필수 컬럼은 기존 행 검증을 통과하기 전에 마이그레이션 계획이 필요합니다.'],
      requiredConfirmations: this.column.nullable ? [] : ['기존 행을 위한 백필 전략을 선택하세요.'],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project), this.serialize(), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    return replaceTable(project, this.tableId, (table) => ({
      ...table,
      columns: table.columns.filter((column) => column.columnId !== this.column.columnId),
    }))
  }

  serialize(): AddColumnSerialized {
    return {
      type: 'AddColumn',
      commandId: this.commandId,
      tableId: this.tableId,
      column: this.column,
      targetIndex: this.targetIndex,
    }
  }

  private apply(project: SchemaProject): SchemaProject {
    return replaceTable(project, this.tableId, (table) => ({
      ...table,
      columns: insertAt(
        table.columns,
        this.targetIndex ?? table.columns.length,
        { ...this.column, tableId: this.tableId },
      ),
    }))
  }
}

export class ReorderColumnCommand implements SchemaCommand<ReorderColumnSerialized> {
  readonly type = 'ReorderColumn'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly columnId: EntityId
  readonly targetIndex: number
  readonly previousIndex?: number

  constructor(input: Omit<ReorderColumnSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.tableId = input.tableId
    this.columnId = input.columnId
    this.targetIndex = input.targetIndex
    this.previousIndex = input.previousIndex
  }

  validate(project: SchemaProject): CommandValidation {
    const table = findTable(project, this.tableId)
    const columnIndex = table?.columns.findIndex((column) => column.columnId === this.columnId) ?? -1

    if (!table || columnIndex < 0) {
      return { ok: false, issues: [blocking('열 없음', '이동할 열이 더 이상 존재하지 않습니다.', [this.tableId], [this.columnId])] }
    }

    if (!Number.isInteger(this.targetIndex) || this.targetIndex < 0 || this.targetIndex >= table.columns.length) {
      return { ok: false, issues: [blocking('열 위치 오류', '열을 이동할 위치가 현재 테이블 범위를 벗어났습니다.', [this.tableId], [this.columnId])] }
    }

    return { ok: true, issues: [] }
  }

  describe(project: SchemaProject): string {
    const table = requireTable(project, this.tableId)
    const column = requireColumn(table, this.columnId)

    return `${table.name}.${column.name} 열을 ${this.targetIndex + 1}번째 위치로 이동합니다.`
  }

  describeImpact(project: SchemaProject): ImpactReport {
    const table = requireTable(project, this.tableId)
    const column = requireColumn(table, this.columnId)

    return {
      summary: `${table.name}.${column.name} 열의 표시와 CSV 출력 순서가 변경됩니다. 내부 columnId와 데이터는 유지됩니다.`,
      affectedTableIds: [this.tableId],
      affectedColumnIds: [this.columnId],
      affectedRelationIds: project.relations
        .filter((relation) => relation.sourceColumnIds.includes(this.columnId) || relation.targetColumnIds.includes(this.columnId))
        .map((relation) => relation.relationId),
      affectedExportViewIds: [],
      affectedCsvHeaders: [column.name],
      existingDataRisk: [],
      requiredConfirmations: [],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project, this.targetIndex)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project, this.targetIndex), this.serializeWithPrevious(project), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    if (this.previousIndex === undefined) {
      throw new Error('이전 열 위치가 없어 ReorderColumn을 되돌릴 수 없습니다.')
    }

    return this.apply(project, this.previousIndex)
  }

  serialize(): ReorderColumnSerialized {
    return {
      type: 'ReorderColumn',
      commandId: this.commandId,
      tableId: this.tableId,
      columnId: this.columnId,
      targetIndex: this.targetIndex,
      previousIndex: this.previousIndex,
    }
  }

  private serializeWithPrevious(project: SchemaProject): ReorderColumnSerialized {
    return {
      ...this.serialize(),
      previousIndex: requireTable(project, this.tableId).columns.findIndex((column) => column.columnId === this.columnId),
    }
  }

  private apply(project: SchemaProject, targetIndex: number): SchemaProject {
    return replaceTable(project, this.tableId, (table) => {
      const currentIndex = table.columns.findIndex((column) => column.columnId === this.columnId)
      if (currentIndex < 0 || currentIndex === targetIndex) return table

      const columns = [...table.columns]
      const [column] = columns.splice(currentIndex, 1)
      columns.splice(targetIndex, 0, column as SchemaColumn)
      return { ...table, columns }
    })
  }
}

export class RenameTableCommand implements SchemaCommand<RenameTableSerialized> {
  readonly type = 'RenameTable'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly nextName: string
  readonly previousName?: string

  constructor(input: Omit<RenameTableSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.tableId = input.tableId
    this.nextName = input.nextName
    this.previousName = input.previousName
  }

  validate(project: SchemaProject): CommandValidation {
    const table = findTable(project, this.tableId)

    if (!table) {
      return { ok: false, issues: [blocking('이름 변경 대상 없음', '선택한 테이블이 더 이상 존재하지 않습니다.', [this.tableId])] }
    }

    if (this.nextName.trim().length === 0) {
      return { ok: false, issues: [blocking('테이블 이름이 비어 있음', '테이블 이름은 한 글자 이상이어야 합니다.', [this.tableId])] }
    }

    const duplicate = project.tables.some(
      (candidate) => candidate.tableId !== this.tableId && candidate.name.toLowerCase() === this.nextName.trim().toLowerCase(),
    )

    if (duplicate) {
      return { ok: false, issues: [blocking('테이블 이름 중복', `${this.nextName}이 이미 존재합니다.`, [this.tableId])] }
    }

    return withValidation(project)
  }

  describe(project: SchemaProject): string {
    return `${requireTable(project, this.tableId).name} 테이블명을 ${this.nextName}(으)로 변경합니다.`
  }

  describeImpact(project: SchemaProject): ImpactReport {
    const table = requireTable(project, this.tableId)
    const exportViews = project.exportViews.filter((view) => view.rootTableId === table.tableId || view.columns.some((column) => column.sourceTableId === table.tableId))

    return {
      summary: `${table.name} 테이블명이 ${this.nextName}(으)로 변경됩니다. 내부 tableId는 유지됩니다.`,
      affectedTableIds: [table.tableId],
      affectedColumnIds: table.columns.map((column) => column.columnId),
      affectedRelationIds: project.relations
        .filter((relation) => relation.sourceTableId === table.tableId || relation.targetTableId === table.tableId)
        .map((relation) => relation.relationId),
      affectedExportViewIds: exportViews.map((view) => view.viewId),
      affectedCsvHeaders: [],
      existingDataRisk: ['기존 행 값과 FK ID는 보존됩니다.'],
      requiredConfirmations: [],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project, this.nextName)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project, this.nextName), this.serializeWithPrevious(project), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    if (!this.previousName) {
      throw new Error('이전 이름이 없어 RenameTable을 되돌릴 수 없습니다.')
    }

    return this.apply(project, this.previousName)
  }

  serialize(): RenameTableSerialized {
    return {
      type: 'RenameTable',
      commandId: this.commandId,
      tableId: this.tableId,
      nextName: this.nextName,
      previousName: this.previousName,
    }
  }

  private serializeWithPrevious(project: SchemaProject): RenameTableSerialized {
    return {
      ...this.serialize(),
      previousName: requireTable(project, this.tableId).name,
    }
  }

  private apply(project: SchemaProject, name: string): SchemaProject {
    return replaceTable(project, this.tableId, (table) => ({ ...table, name, displayName: name }))
  }
}

export class ChangeTableDescriptionCommand implements SchemaCommand<ChangeTableDescriptionSerialized> {
  readonly type = 'ChangeTableDescription'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly description: string
  readonly previousDescription?: string

  constructor(input: Omit<ChangeTableDescriptionSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.tableId = input.tableId
    this.description = input.description.trim().slice(0, 2000)
    this.previousDescription = input.previousDescription
  }

  validate(project: SchemaProject): CommandValidation {
    return findTable(project, this.tableId)
      ? withValidation(project)
      : { ok: false, issues: [blocking('설명 변경 대상 없음', '선택한 테이블이 더 이상 존재하지 않습니다.', [this.tableId])] }
  }

  describe(project: SchemaProject): string {
    return `${requireTable(project, this.tableId).name} 테이블 설명을 변경합니다.`
  }

  describeImpact(): ImpactReport {
    return {
      summary: '테이블 설명만 변경되며 ID, 행, 관계와 런타임 출력은 유지됩니다.',
      affectedTableIds: [this.tableId],
      affectedColumnIds: [],
      affectedRelationIds: [],
      affectedExportViewIds: [],
      affectedCsvHeaders: [],
      existingDataRisk: [],
      requiredConfirmations: [],
    }
  }

  preview(project: SchemaProject): SchemaProject { return this.apply(project, this.description) }
  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)
    if (!validation.ok) throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    return appendHistory(this.apply(project, this.description), this.serializeWithPrevious(project), this.describeImpact())
  }
  undo(project: SchemaProject): SchemaProject {
    if (this.previousDescription === undefined) throw new Error('이전 설명이 없어 변경을 되돌릴 수 없습니다.')
    return this.apply(project, this.previousDescription)
  }
  serialize(): ChangeTableDescriptionSerialized {
    return { type: this.type, commandId: this.commandId, tableId: this.tableId, description: this.description, previousDescription: this.previousDescription }
  }
  private serializeWithPrevious(project: SchemaProject): ChangeTableDescriptionSerialized {
    return { ...this.serialize(), previousDescription: requireTable(project, this.tableId).description }
  }
  private apply(project: SchemaProject, description: string): SchemaProject {
    return replaceTable(project, this.tableId, (table) => ({ ...table, description }))
  }
}

export class ChangeColumnDescriptionCommand implements SchemaCommand<ChangeColumnDescriptionSerialized> {
  readonly type = 'ChangeColumnDescription'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly columnId: EntityId
  readonly description: string
  readonly previousDescription?: string

  constructor(input: Omit<ChangeColumnDescriptionSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.tableId = input.tableId
    this.columnId = input.columnId
    this.description = input.description.trim().slice(0, 2000)
    this.previousDescription = input.previousDescription
  }

  validate(project: SchemaProject): CommandValidation {
    const table = findTable(project, this.tableId)
    return table && findColumn(table, this.columnId)
      ? withValidation(project)
      : { ok: false, issues: [blocking('설명 변경 대상 없음', '선택한 열이 더 이상 존재하지 않습니다.', [this.tableId], [this.columnId])] }
  }

  describe(project: SchemaProject): string {
    return `${requireTable(project, this.tableId).name}.${requireColumn(requireTable(project, this.tableId), this.columnId).name} 열 설명을 변경합니다.`
  }

  describeImpact(): ImpactReport {
    return {
      summary: '열 설명만 변경되며 ColumnId, 행 값과 PK/FK 연결은 유지됩니다.',
      affectedTableIds: [this.tableId],
      affectedColumnIds: [this.columnId],
      affectedRelationIds: [],
      affectedExportViewIds: [],
      affectedCsvHeaders: [],
      existingDataRisk: [],
      requiredConfirmations: [],
    }
  }

  preview(project: SchemaProject): SchemaProject { return this.apply(project, this.description) }
  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)
    if (!validation.ok) throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    return appendHistory(this.apply(project, this.description), this.serializeWithPrevious(project), this.describeImpact())
  }
  undo(project: SchemaProject): SchemaProject {
    if (this.previousDescription === undefined) throw new Error('이전 설명이 없어 변경을 되돌릴 수 없습니다.')
    return this.apply(project, this.previousDescription)
  }
  serialize(): ChangeColumnDescriptionSerialized {
    return { type: this.type, commandId: this.commandId, tableId: this.tableId, columnId: this.columnId, description: this.description, previousDescription: this.previousDescription }
  }
  private serializeWithPrevious(project: SchemaProject): ChangeColumnDescriptionSerialized {
    return { ...this.serialize(), previousDescription: requireColumn(requireTable(project, this.tableId), this.columnId).description }
  }
  private apply(project: SchemaProject, description: string): SchemaProject {
    return replaceTable(project, this.tableId, (table) => ({
      ...table,
      columns: table.columns.map((column) => column.columnId === this.columnId ? { ...column, description } : column),
    }))
  }
}

export class DeleteColumnCommand implements SchemaCommand<DeleteColumnSerialized> {
  readonly type = 'DeleteColumn'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly columnId: EntityId
  readonly approved: boolean
  readonly deletedColumn?: SchemaColumn
  readonly deletedColumnIndex?: number
  readonly deletedRelations?: readonly Relation[]

  constructor(input: Omit<DeleteColumnSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.tableId = input.tableId
    this.columnId = input.columnId
    this.approved = input.approved ?? false
    this.deletedColumn = input.deletedColumn
    this.deletedColumnIndex = input.deletedColumnIndex
    this.deletedRelations = input.deletedRelations
  }

  validate(project: SchemaProject): CommandValidation {
    const table = findTable(project, this.tableId)
    const column = table ? findColumn(table, this.columnId) : undefined

    if (!table || !column) {
      return { ok: false, issues: [blocking('컬럼 없음', '선택한 컬럼이 더 이상 존재하지 않습니다.', [this.tableId], [this.columnId])] }
    }

    if (!this.approved) {
      return { ok: false, issues: [blockedApproval('DeleteColumn', `${table.name}.${column.name}`)] }
    }

    return withValidation(project)
  }

  describe(project: SchemaProject): string {
    const table = requireTable(project, this.tableId)
    const column = requireColumn(table, this.columnId)

    return `${table.name}.${column.name} 컬럼을 삭제합니다.`
  }

  describeImpact(project: SchemaProject): ImpactReport {
    const table = requireTable(project, this.tableId)
    const column = requireColumn(table, this.columnId)
    const relations = project.relations.filter((relation) => relation.sourceColumnIds.includes(this.columnId) || relation.targetColumnIds.includes(this.columnId))
    const exportViews = project.exportViews.filter((view) => view.columns.some((exportColumn) => exportColumn.sourceColumnId === this.columnId))

    return {
      summary: `${table.name}.${column.name} 컬럼과 연결 관계 ${relations.length}개가 제거됩니다.`,
      affectedTableIds: [this.tableId],
      affectedColumnIds: [this.columnId],
      affectedRelationIds: relations.map((relation) => relation.relationId),
      affectedExportViewIds: exportViews.map((view) => view.viewId),
      affectedCsvHeaders: exportViews.flatMap((view) =>
        view.columns.filter((exportColumn) => exportColumn.sourceColumnId === this.columnId).map((exportColumn) => `${view.name}.${exportColumn.header}`),
      ),
      existingDataRisk: ['이 컬럼의 기존 값은 작성 스키마에서 제거됩니다.'],
      requiredConfirmations: ['변경 검토에서 컬럼 삭제를 확인하세요.'],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project), this.serializeWithDeleted(project), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    if (!this.deletedColumn) {
      throw new Error('삭제된 컬럼 정보가 없어 DeleteColumn을 되돌릴 수 없습니다.')
    }

    return {
      ...replaceTable(project, this.tableId, (table) => ({
        ...table,
        columns: insertAt(table.columns, this.deletedColumnIndex ?? table.columns.length, this.deletedColumn as SchemaColumn),
      })),
      relations: [...project.relations, ...(this.deletedRelations ?? [])],
    }
  }

  serialize(): DeleteColumnSerialized {
    return {
      type: 'DeleteColumn',
      commandId: this.commandId,
      tableId: this.tableId,
      columnId: this.columnId,
      approved: this.approved,
      deletedColumn: this.deletedColumn,
      deletedColumnIndex: this.deletedColumnIndex,
      deletedRelations: this.deletedRelations,
    }
  }

  private serializeWithDeleted(project: SchemaProject): DeleteColumnSerialized {
    return {
      ...this.serialize(),
      deletedColumn: requireColumn(requireTable(project, this.tableId), this.columnId),
      deletedColumnIndex: requireTable(project, this.tableId).columns.findIndex((column) => column.columnId === this.columnId),
      deletedRelations: project.relations.filter((relation) => relation.sourceColumnIds.includes(this.columnId) || relation.targetColumnIds.includes(this.columnId)),
    }
  }

  private apply(project: SchemaProject): SchemaProject {
    return {
      ...replaceTable(project, this.tableId, (table) => ({
        ...table,
        columns: table.columns.filter((column) => column.columnId !== this.columnId),
        primaryKey: { columnIds: table.primaryKey.columnIds.filter((columnId) => columnId !== this.columnId) },
        uniqueConstraints: table.uniqueConstraints.filter((constraint) => !constraint.columnIds.includes(this.columnId)),
        checkConstraints: table.checkConstraints.filter((constraint) => !constraint.columnIds.includes(this.columnId)),
      })),
      relations: project.relations.filter((relation) => !relation.sourceColumnIds.includes(this.columnId) && !relation.targetColumnIds.includes(this.columnId)),
      functionalDependencies: project.functionalDependencies.filter(
        (dependency) => !dependency.determinantColumnIds.includes(this.columnId) && !dependency.dependentColumnIds.includes(this.columnId),
      ),
      exportViews: project.exportViews.map((view) => ({
        ...view,
        columns: view.columns.filter((column) => column.sourceColumnId !== this.columnId),
      })),
    }
  }
}

export class ChangeColumnTypeCommand implements SchemaCommand<ChangeColumnTypeSerialized> {
  readonly type = 'ChangeColumnType'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly columnId: EntityId
  readonly nextDataType: ColumnDataType
  readonly previousDataType?: ColumnDataType

  constructor(input: Omit<ChangeColumnTypeSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.tableId = input.tableId
    this.columnId = input.columnId
    this.nextDataType = input.nextDataType
    this.previousDataType = input.previousDataType
  }

  validate(project: SchemaProject): CommandValidation {
    const table = findTable(project, this.tableId)
    const column = table ? findColumn(table, this.columnId) : undefined

    if (!table || !column) {
      return { ok: false, issues: [blocking('컬럼 없음', '선택한 컬럼이 더 이상 존재하지 않습니다.', [this.tableId], [this.columnId])] }
    }

    const nextProject = this.apply(project, this.nextDataType)
    const issues = validateProject(nextProject)
    const hasBlocking = issues.some((issue) => issue.severity === 'blocking')

    return { ok: !hasBlocking, issues }
  }

  describe(project: SchemaProject): string {
    const table = requireTable(project, this.tableId)
    const column = requireColumn(table, this.columnId)

    return `${table.name}.${column.name} 타입을 변경합니다.`
  }

  describeImpact(project: SchemaProject): ImpactReport {
    const table = requireTable(project, this.tableId)
    const column = requireColumn(table, this.columnId)

    return {
      summary: `${table.name}.${column.name} 데이터 타입이 ${this.nextDataType.kind}(으)로 변경됩니다.`,
      affectedTableIds: [this.tableId],
      affectedColumnIds: [this.columnId],
      affectedRelationIds: project.relations
        .filter((relation) => relation.sourceColumnIds.includes(this.columnId) || relation.targetColumnIds.includes(this.columnId))
        .map((relation) => relation.relationId),
      affectedExportViewIds: project.exportViews
        .filter((view) => view.columns.some((exportColumn) => exportColumn.sourceColumnId === this.columnId))
        .map((view) => view.viewId),
      affectedCsvHeaders: [],
      existingDataRisk: ['기존 값은 변환 또는 백필 검증이 필요할 수 있습니다.'],
      requiredConfirmations: ['실제 행에 적용하기 전에 마이그레이션 변환을 검토하세요.'],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project, this.nextDataType)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project, this.nextDataType), this.serializeWithPrevious(project), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    if (!this.previousDataType) {
      throw new Error('이전 데이터 타입이 없어 ChangeColumnType을 되돌릴 수 없습니다.')
    }

    return this.apply(project, this.previousDataType)
  }

  serialize(): ChangeColumnTypeSerialized {
    return {
      type: 'ChangeColumnType',
      commandId: this.commandId,
      tableId: this.tableId,
      columnId: this.columnId,
      nextDataType: this.nextDataType,
      previousDataType: this.previousDataType,
    }
  }

  private serializeWithPrevious(project: SchemaProject): ChangeColumnTypeSerialized {
    return {
      ...this.serialize(),
      previousDataType: requireColumn(requireTable(project, this.tableId), this.columnId).dataType,
    }
  }

  private apply(project: SchemaProject, dataType: ColumnDataType): SchemaProject {
    return replaceTable(project, this.tableId, (table) => ({
      ...table,
      columns: table.columns.map((column) => column.columnId === this.columnId ? { ...column, dataType } : column),
    }))
  }
}

export class CreateTableCommand implements SchemaCommand<CreateTableSerialized> {
  readonly type = 'CreateTable'
  readonly commandId: EntityId
  readonly table: SchemaTable
  readonly layout?: CanvasNodeLayout

  constructor(input: Omit<CreateTableSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.table = input.table
    this.layout = input.layout
  }

  validate(project: SchemaProject): CommandValidation {
    const duplicateId = project.tables.some((table) => table.tableId === this.table.tableId)
    const duplicateName = project.tables.some((table) => table.name.toLowerCase() === this.table.name.toLowerCase())

    if (duplicateId || duplicateName) {
      return {
        ok: false,
        issues: [blocking('테이블 중복', `${this.table.name}이 프로젝트에 이미 존재합니다.`, [this.table.tableId])],
      }
    }

    return withValidation(project)
  }

  describe(): string {
    return `${this.table.name} 테이블을 생성합니다.`
  }

  describeImpact(_project: SchemaProject): ImpactReport {
    return {
      summary: `${this.table.name}이 새 작성 테이블로 추가됩니다.`,
      affectedTableIds: [this.table.tableId],
      affectedColumnIds: this.table.columns.map((column) => column.columnId),
      affectedRelationIds: [],
      affectedExportViewIds: [],
      affectedCsvHeaders: [],
      existingDataRisk: ['기존 행은 변경되지 않습니다.'],
      requiredConfirmations: [],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project), this.serialize(), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    return {
      ...project,
      tables: project.tables.filter((table) => table.tableId !== this.table.tableId),
      layout: {
        nodes: project.layout.nodes.filter((node) => node.entityId !== this.table.tableId),
      },
    }
  }

  serialize(): CreateTableSerialized {
    return {
      type: 'CreateTable',
      commandId: this.commandId,
      table: this.table,
      layout: this.layout,
    }
  }

  private apply(project: SchemaProject): SchemaProject {
    return {
      ...project,
      tables: [...project.tables, this.table],
      layout: {
        nodes: [...project.layout.nodes, this.layout ?? { entityId: this.table.tableId, x: 0, y: 0 }],
      },
    }
  }
}

export class MoveTableLayoutCommand implements SchemaCommand<MoveTableLayoutSerialized> {
  readonly type = 'MoveTableLayout'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly x: number
  readonly y: number
  readonly previousX?: number
  readonly previousY?: number
  readonly previousHadLayout?: boolean

  constructor(input: Omit<MoveTableLayoutSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.tableId = input.tableId
    this.x = input.x
    this.y = input.y
    this.previousX = input.previousX
    this.previousY = input.previousY
    this.previousHadLayout = input.previousHadLayout
  }

  validate(project: SchemaProject): CommandValidation {
    const table = findTable(project, this.tableId)

    if (!table) {
      return { ok: false, issues: [blocking('테이블 없음', '위치를 변경할 테이블이 더 이상 존재하지 않습니다.', [this.tableId])] }
    }

    if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) {
      return { ok: false, issues: [blocking('좌표 오류', '테이블 위치 좌표가 유효하지 않습니다.', [this.tableId])] }
    }

    return withValidation(project)
  }

  describe(project: SchemaProject): string {
    return `${requireTable(project, this.tableId).name} 테이블 위치를 변경합니다.`
  }

  describeImpact(project: SchemaProject): ImpactReport {
    const table = requireTable(project, this.tableId)

    return {
      summary: `${table.name} 테이블의 캔버스 위치를 저장합니다.`,
      affectedTableIds: [this.tableId],
      affectedColumnIds: [],
      affectedRelationIds: [],
      affectedExportViewIds: [],
      affectedCsvHeaders: [],
      existingDataRisk: [],
      requiredConfirmations: [],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project, this.x, this.y)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project, this.x, this.y), this.serializeWithPrevious(project), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    if (this.previousHadLayout === false) {
      return {
        ...project,
        layout: {
          nodes: project.layout.nodes.filter((node) => node.entityId !== this.tableId),
        },
      }
    }

    if (this.previousX === undefined || this.previousY === undefined) {
      throw new Error('이전 좌표가 없어 MoveTableLayout을 되돌릴 수 없습니다.')
    }

    return this.apply(project, this.previousX, this.previousY)
  }

  serialize(): MoveTableLayoutSerialized {
    return {
      type: 'MoveTableLayout',
      commandId: this.commandId,
      tableId: this.tableId,
      x: this.x,
      y: this.y,
      previousX: this.previousX,
      previousY: this.previousY,
      previousHadLayout: this.previousHadLayout,
    }
  }

  private serializeWithPrevious(project: SchemaProject): MoveTableLayoutSerialized {
    const previous = project.layout.nodes.find((node) => node.entityId === this.tableId)

    return {
      ...this.serialize(),
      previousX: previous?.x,
      previousY: previous?.y,
      previousHadLayout: Boolean(previous),
    }
  }

  private apply(project: SchemaProject, x: number, y: number): SchemaProject {
    const hasNode = project.layout.nodes.some((node) => node.entityId === this.tableId)
    const nextNode = { entityId: this.tableId, x, y }

    return {
      ...project,
      layout: {
        nodes: hasNode
          ? project.layout.nodes.map((node) => (node.entityId === this.tableId ? nextNode : node))
          : [...project.layout.nodes, nextNode],
      },
    }
  }
}

export class MoveTablesLayoutCommand implements SchemaCommand<MoveTablesLayoutSerialized> {
  readonly type = 'MoveTablesLayout'
  readonly commandId: EntityId
  readonly positions: readonly CanvasNodeLayout[]
  readonly previousNodes?: readonly CanvasNodeLayout[]

  constructor(input: Omit<MoveTablesLayoutSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.positions = input.positions.map((position) => ({ ...position }))
    this.previousNodes = input.previousNodes?.map((position) => ({ ...position }))
  }

  validate(project: SchemaProject): CommandValidation {
    const tableIds = new Set(project.tables.map((table) => table.tableId))
    const positionIds = this.positions.map((position) => position.entityId)
    const duplicateIds = positionIds.filter((id, index) => positionIds.indexOf(id) !== index)
    const missingIds = positionIds.filter((id) => !tableIds.has(id))
    const invalidCoordinates = this.positions.filter((position) => !Number.isFinite(position.x) || !Number.isFinite(position.y))

    if (duplicateIds.length > 0 || missingIds.length > 0 || invalidCoordinates.length > 0) {
      return {
        ok: false,
        issues: [blocking(
          '자동 배치 좌표 오류',
          '자동 배치 결과에 중복 테이블, 없는 테이블 또는 유효하지 않은 좌표가 있습니다.',
          [...new Set([...duplicateIds, ...missingIds, ...invalidCoordinates.map((position) => position.entityId)])],
        )],
      }
    }

    return withValidation(project)
  }

  describe(): string {
    return `${this.positions.length}개 테이블을 자동 배치합니다.`
  }

  describeImpact(): ImpactReport {
    return {
      summary: `${this.positions.length}개 테이블의 구조도 위치를 한 번에 정렬합니다.`,
      affectedTableIds: this.positions.map((position) => position.entityId),
      affectedColumnIds: [],
      affectedRelationIds: [],
      affectedExportViewIds: [],
      affectedCsvHeaders: [],
      existingDataRisk: [],
      requiredConfirmations: [],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project, this.positions)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '자동 배치 명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project, this.positions), this.serializeWithPrevious(project), this.describeImpact())
  }

  undo(project: SchemaProject): SchemaProject {
    if (!this.previousNodes) {
      throw new Error('이전 구조도 좌표가 없어 자동 배치를 되돌릴 수 없습니다.')
    }

    return this.apply(project, this.previousNodes)
  }

  serialize(): MoveTablesLayoutSerialized {
    return {
      type: 'MoveTablesLayout',
      commandId: this.commandId,
      positions: this.positions,
      previousNodes: this.previousNodes,
    }
  }

  private serializeWithPrevious(project: SchemaProject): MoveTablesLayoutSerialized {
    const targetIds = new Set(this.positions.map((position) => position.entityId))
    return {
      ...this.serialize(),
      previousNodes: project.layout.nodes.filter((position) => targetIds.has(position.entityId)),
    }
  }

  private apply(project: SchemaProject, positions: readonly CanvasNodeLayout[]): SchemaProject {
    const targetIds = new Set(this.positions.map((position) => position.entityId))
    return {
      ...project,
      layout: {
        nodes: [
          ...project.layout.nodes.filter((position) => !targetIds.has(position.entityId)),
          ...positions.map((position) => ({ ...position })),
        ],
      },
    }
  }
}

export class DeleteTableCommand implements SchemaCommand<DeleteTableSerialized> {
  readonly type = 'DeleteTable'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly approved: boolean
  readonly deletedTable?: SchemaTable
  readonly deletedRelations?: readonly Relation[]

  constructor(input: Omit<DeleteTableSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.tableId = input.tableId
    this.approved = input.approved ?? false
    this.deletedTable = input.deletedTable
    this.deletedRelations = input.deletedRelations
  }

  validate(project: SchemaProject): CommandValidation {
    const table = findTable(project, this.tableId)

    if (!table) {
      return { ok: false, issues: [blocking('테이블 없음', '테이블이 이미 제거되었습니다.', [this.tableId])] }
    }

    if (!this.approved) {
      return { ok: false, issues: [blockedApproval('DeleteTable', table.name)] }
    }

    return withValidation(project)
  }

  describe(project: SchemaProject): string {
    return `${requireTable(project, this.tableId).name} 테이블을 삭제합니다.`
  }

  describeImpact(project: SchemaProject): ImpactReport {
    const table = requireTable(project, this.tableId)
    const relations = project.relations.filter((relation) => relation.sourceTableId === this.tableId || relation.targetTableId === this.tableId)

    return {
      summary: `${table.name} 테이블과 연결 관계 ${relations.length}개가 제거됩니다.`,
      affectedTableIds: [this.tableId],
      affectedColumnIds: table.columns.map((column) => column.columnId),
      affectedRelationIds: relations.map((relation) => relation.relationId),
      affectedExportViewIds: project.exportViews
        .filter((view) => view.rootTableId === this.tableId || view.columns.some((column) => column.sourceTableId === this.tableId))
        .map((view) => view.viewId),
      affectedCsvHeaders: [],
      existingDataRisk: ['실행 취소나 백업으로 복원하지 않으면 이 테이블의 행을 더 이상 내보낼 수 없습니다.'],
      requiredConfirmations: ['변경 검토에서 테이블 삭제를 확인하세요.'],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project), this.serializeWithDeleted(project), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    if (!this.deletedTable) {
      throw new Error('삭제된 테이블 정보가 없어 DeleteTable을 되돌릴 수 없습니다.')
    }

    return {
      ...project,
      tables: [...project.tables, this.deletedTable],
      relations: [...project.relations, ...(this.deletedRelations ?? [])],
      layout: {
        nodes: [...project.layout.nodes, { entityId: this.deletedTable.tableId, x: 0, y: 0 }],
      },
    }
  }

  serialize(): DeleteTableSerialized {
    return {
      type: 'DeleteTable',
      commandId: this.commandId,
      tableId: this.tableId,
      approved: this.approved,
      deletedTable: this.deletedTable,
      deletedRelations: this.deletedRelations,
    }
  }

  private serializeWithDeleted(project: SchemaProject): DeleteTableSerialized {
    return {
      ...this.serialize(),
      deletedTable: requireTable(project, this.tableId),
      deletedRelations: project.relations.filter((relation) => relation.sourceTableId === this.tableId || relation.targetTableId === this.tableId),
    }
  }

  private apply(project: SchemaProject): SchemaProject {
    return {
      ...project,
      tables: project.tables.filter((table) => table.tableId !== this.tableId),
      relations: project.relations.filter((relation) => relation.sourceTableId !== this.tableId && relation.targetTableId !== this.tableId),
      exportViews: project.exportViews.filter(
        (view) => view.rootTableId !== this.tableId && !view.columns.some((column) => column.sourceTableId === this.tableId),
      ),
      layout: {
        nodes: project.layout.nodes.filter((node) => node.entityId !== this.tableId),
      },
    }
  }
}

export class ChangePrimaryKeyCommand implements SchemaCommand<ChangePrimaryKeySerialized> {
  readonly type = 'ChangePrimaryKey'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly nextColumnIds: readonly EntityId[]
  readonly previousColumnIds?: readonly EntityId[]

  constructor(input: Omit<ChangePrimaryKeySerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.tableId = input.tableId
    this.nextColumnIds = input.nextColumnIds
    this.previousColumnIds = input.previousColumnIds
  }

  validate(project: SchemaProject): CommandValidation {
    const table = findTable(project, this.tableId)

    if (!table) {
      return { ok: false, issues: [blocking('테이블 없음', '대상 테이블이 더 이상 존재하지 않습니다.', [this.tableId])] }
    }

    const missingColumns = this.nextColumnIds.filter((columnId) => !findColumn(table, columnId))

    if (this.nextColumnIds.length === 0 || missingColumns.length > 0) {
      return {
        ok: false,
        issues: [blocking('기본키가 올바르지 않음', '기본키는 현재 존재하는 컬럼을 사용해야 합니다.', [this.tableId], missingColumns)],
      }
    }

    return withValidation(project)
  }

  describe(project: SchemaProject): string {
    return `${requireTable(project, this.tableId).name}의 기본키를 변경합니다.`
  }

  describeImpact(project: SchemaProject): ImpactReport {
    const table = requireTable(project, this.tableId)
    const relations = project.relations.filter((relation) => relation.targetTableId === this.tableId)

    return {
      summary: `${table.name} 기본키가 컬럼 ${this.nextColumnIds.length}개 구성으로 변경됩니다.`,
      affectedTableIds: [this.tableId],
      affectedColumnIds: this.nextColumnIds,
      affectedRelationIds: relations.map((relation) => relation.relationId),
      affectedExportViewIds: [],
      affectedCsvHeaders: [],
      existingDataRisk: ['기존 행은 새 키 기준으로도 고유해야 합니다.'],
      requiredConfirmations: relations.length > 0 ? ['이 테이블을 참조하는 FK 매핑을 검토하세요.'] : [],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project, this.nextColumnIds)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project, this.nextColumnIds), this.serializeWithPrevious(project), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    if (!this.previousColumnIds) {
      throw new Error('이전 기본키 컬럼 목록이 없어 ChangePrimaryKey를 되돌릴 수 없습니다.')
    }

    return this.apply(project, this.previousColumnIds)
  }

  serialize(): ChangePrimaryKeySerialized {
    return {
      type: 'ChangePrimaryKey',
      commandId: this.commandId,
      tableId: this.tableId,
      nextColumnIds: this.nextColumnIds,
      previousColumnIds: this.previousColumnIds,
    }
  }

  private serializeWithPrevious(project: SchemaProject): ChangePrimaryKeySerialized {
    return {
      ...this.serialize(),
      previousColumnIds: requireTable(project, this.tableId).primaryKey.columnIds,
    }
  }

  private apply(project: SchemaProject, columnIds: readonly EntityId[]): SchemaProject {
    return replaceTable(project, this.tableId, (table) => ({
      ...table,
      primaryKey: { columnIds },
      columns: table.columns.map((column) => columnIds.includes(column.columnId) ? { ...column, nullable: false } : column),
    }))
  }
}

export class AddForeignKeyCommand implements SchemaCommand<AddForeignKeySerialized> {
  readonly type = 'AddForeignKey'
  readonly commandId: EntityId
  readonly relation: Relation

  constructor(input: Omit<AddForeignKeySerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.relation = input.relation
  }

  validate(project: SchemaProject): CommandValidation {
    const duplicate = project.relations.some((relation) => relation.relationId === this.relation.relationId)

    if (duplicate) {
      return { ok: false, issues: [blocking('관계 중복', `${this.relation.name}이 이미 존재합니다.`, [], [],)] }
    }

    const nextProject = this.apply(project)
    const issues = validateProject(nextProject)
    const hasBlocking = issues.some((issue) => issue.severity === 'blocking')

    return { ok: !hasBlocking, issues }
  }

  describe(): string {
    return `${this.relation.name} FK를 추가합니다.`
  }

  describeImpact(_project: SchemaProject): ImpactReport {
    return {
      summary: `${this.relation.name} 관계가 원본 컬럼과 대상 키 컬럼을 연결합니다.`,
      affectedTableIds: [this.relation.sourceTableId, this.relation.targetTableId],
      affectedColumnIds: [...this.relation.sourceColumnIds, ...this.relation.targetColumnIds],
      affectedRelationIds: [this.relation.relationId],
      affectedExportViewIds: [],
      affectedCsvHeaders: [],
      existingDataRisk: ['기존 행은 유효한 대상 키를 참조해야 합니다.'],
      requiredConfirmations: [],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project), this.serialize(), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    return {
      ...project,
      relations: project.relations.filter((relation) => relation.relationId !== this.relation.relationId),
    }
  }

  serialize(): AddForeignKeySerialized {
    return {
      type: 'AddForeignKey',
      commandId: this.commandId,
      relation: this.relation,
    }
  }

  private apply(project: SchemaProject): SchemaProject {
    return {
      ...project,
      relations: [...project.relations, this.relation],
    }
  }
}

export class DeleteForeignKeyCommand implements SchemaCommand<DeleteForeignKeySerialized> {
  readonly type = 'DeleteForeignKey'
  readonly commandId: EntityId
  readonly relationId: EntityId
  readonly approved: boolean
  readonly deletedRelation?: Relation

  constructor(input: Omit<DeleteForeignKeySerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.relationId = input.relationId
    this.approved = input.approved ?? false
    this.deletedRelation = input.deletedRelation
  }

  validate(project: SchemaProject): CommandValidation {
    const relation = project.relations.find((candidate) => candidate.relationId === this.relationId)

    if (!relation) {
      return { ok: false, issues: [blocking('관계 없음', '관계가 이미 제거되었습니다.', [], [],)] }
    }

    if (!this.approved) {
      return { ok: false, issues: [blockedApproval('DeleteForeignKey', relation.name)] }
    }

    return withValidation(project)
  }

  describe(project: SchemaProject): string {
    const relation = project.relations.find((candidate) => candidate.relationId === this.relationId)

    return `${relation?.name ?? this.relationId} FK를 삭제합니다.`
  }

  describeImpact(project: SchemaProject): ImpactReport {
    const relation = project.relations.find((candidate) => candidate.relationId === this.relationId)

    return {
      summary: `${relation?.name ?? this.relationId} 관계가 제거됩니다.`,
      affectedTableIds: relation ? [relation.sourceTableId, relation.targetTableId] : [],
      affectedColumnIds: relation ? [...relation.sourceColumnIds, ...relation.targetColumnIds] : [],
      affectedRelationIds: [this.relationId],
      affectedExportViewIds: [],
      affectedCsvHeaders: [],
      existingDataRisk: ['행에 더 이상 강제 참조가 없는 값이 남을 수 있습니다.'],
      requiredConfirmations: ['변경 검토에서 FK 삭제를 확인하세요.'],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project), this.serializeWithDeleted(project), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    if (!this.deletedRelation) {
      throw new Error('삭제된 관계 정보가 없어 DeleteForeignKey를 되돌릴 수 없습니다.')
    }

    return {
      ...project,
      relations: [...project.relations, this.deletedRelation],
    }
  }

  serialize(): DeleteForeignKeySerialized {
    return {
      type: 'DeleteForeignKey',
      commandId: this.commandId,
      relationId: this.relationId,
      approved: this.approved,
      deletedRelation: this.deletedRelation,
    }
  }

  private serializeWithDeleted(project: SchemaProject): DeleteForeignKeySerialized {
    return {
      ...this.serialize(),
      deletedRelation: project.relations.find((relation) => relation.relationId === this.relationId),
    }
  }

  private apply(project: SchemaProject): SchemaProject {
    return {
      ...project,
      relations: project.relations.filter((relation) => relation.relationId !== this.relationId),
    }
  }
}

export class AddUniqueConstraintCommand implements SchemaCommand<AddUniqueConstraintSerialized> {
  readonly type = 'AddUniqueConstraint'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly constraint: UniqueConstraint

  constructor(input: Omit<AddUniqueConstraintSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.tableId = input.tableId
    this.constraint = input.constraint
  }

  validate(project: SchemaProject): CommandValidation {
    const table = findTable(project, this.tableId)

    if (!table) {
      return { ok: false, issues: [blocking('테이블 없음', '대상 테이블이 더 이상 존재하지 않습니다.', [this.tableId])] }
    }

    if (table.uniqueConstraints.some((constraint) => constraint.constraintId === this.constraint.constraintId)) {
      return { ok: false, issues: [blocking('고유 제약 중복', `${this.constraint.name}이 이미 존재합니다.`, [this.tableId])] }
    }

    const nextProject = this.apply(project)
    const issues = validateProject(nextProject)
    const hasBlocking = issues.some((issue) => issue.severity === 'blocking')

    return { ok: !hasBlocking, issues }
  }

  describe(project: SchemaProject): string {
    return `${requireTable(project, this.tableId).name}에 고유 제약 ${this.constraint.name}을 추가합니다.`
  }

  describeImpact(_project: SchemaProject): ImpactReport {
    return {
      summary: `${this.constraint.name}은 컬럼 ${this.constraint.columnIds.length}개 조합의 고유값을 요구합니다.`,
      affectedTableIds: [this.tableId],
      affectedColumnIds: this.constraint.columnIds,
      affectedRelationIds: [],
      affectedExportViewIds: [],
      affectedCsvHeaders: [],
      existingDataRisk: ['기존 행에 중복 키 조합이 없어야 합니다.'],
      requiredConfirmations: [],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project), this.serialize(), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    return replaceTable(project, this.tableId, (table) => ({
      ...table,
      uniqueConstraints: table.uniqueConstraints.filter((constraint) => constraint.constraintId !== this.constraint.constraintId),
    }))
  }

  serialize(): AddUniqueConstraintSerialized {
    return {
      type: 'AddUniqueConstraint',
      commandId: this.commandId,
      tableId: this.tableId,
      constraint: this.constraint,
    }
  }

  private apply(project: SchemaProject): SchemaProject {
    return replaceTable(project, this.tableId, (table) => ({
      ...table,
      uniqueConstraints: [...table.uniqueConstraints, this.constraint],
    }))
  }
}

export class AddCheckConstraintCommand implements SchemaCommand<AddCheckConstraintSerialized> {
  readonly type = 'AddCheckConstraint'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly constraint: CheckConstraint

  constructor(input: Omit<AddCheckConstraintSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.tableId = input.tableId
    this.constraint = input.constraint
  }

  validate(project: SchemaProject): CommandValidation {
    const table = findTable(project, this.tableId)

    if (!table) {
      return { ok: false, issues: [blocking('테이블 없음', '대상 테이블이 더 이상 존재하지 않습니다.', [this.tableId])] }
    }

    if (table.checkConstraints.some((constraint) => constraint.constraintId === this.constraint.constraintId)) {
      return { ok: false, issues: [blocking('체크 제약 중복', `${this.constraint.name}이 이미 존재합니다.`, [this.tableId])] }
    }

    const nextProject = this.apply(project)
    const issues = validateProject(nextProject)
    const hasBlocking = issues.some((issue) => issue.severity === 'blocking')

    return { ok: !hasBlocking, issues }
  }

  describe(project: SchemaProject): string {
    return `${requireTable(project, this.tableId).name}에 체크 제약 ${this.constraint.name}을 추가합니다.`
  }

  describeImpact(_project: SchemaProject): ImpactReport {
    return {
      summary: `${this.constraint.name}은 컬럼 ${this.constraint.columnIds.length}개를 검증합니다.`,
      affectedTableIds: [this.tableId],
      affectedColumnIds: this.constraint.columnIds,
      affectedRelationIds: [],
      affectedExportViewIds: [],
      affectedCsvHeaders: [],
      existingDataRisk: ['기존 행은 새 체크 표현식을 만족해야 합니다.'],
      requiredConfirmations: [],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project), this.serialize(), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    return replaceTable(project, this.tableId, (table) => ({
      ...table,
      checkConstraints: table.checkConstraints.filter((constraint) => constraint.constraintId !== this.constraint.constraintId),
    }))
  }

  serialize(): AddCheckConstraintSerialized {
    return {
      type: 'AddCheckConstraint',
      commandId: this.commandId,
      tableId: this.tableId,
      constraint: this.constraint,
    }
  }

  private apply(project: SchemaProject): SchemaProject {
    return replaceTable(project, this.tableId, (table) => ({
      ...table,
      checkConstraints: [...table.checkConstraints, this.constraint],
    }))
  }
}

export class AddFunctionalDependencyCommand implements SchemaCommand<AddFunctionalDependencySerialized> {
  readonly type = 'AddFunctionalDependency'
  readonly commandId: EntityId
  readonly dependency: FunctionalDependency

  constructor(input: Omit<AddFunctionalDependencySerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.dependency = input.dependency
  }

  validate(project: SchemaProject): CommandValidation {
    if (project.functionalDependencies.some((dependency) => dependency.dependencyId === this.dependency.dependencyId)) {
      return { ok: false, issues: [blocking('정규화 규칙 중복', '이 ID의 정규화 규칙이 이미 존재합니다.', [this.dependency.tableId])] }
    }

    const nextProject = this.apply(project)
    const issues = validateProject(nextProject)
    const hasBlocking = issues.some((issue) => issue.severity === 'blocking')

    return { ok: !hasBlocking, issues }
  }

  describe(project: SchemaProject): string {
    return `${requireTable(project, this.dependency.tableId).name}에 정규화 규칙을 추가합니다.`
  }

  describeImpact(_project: SchemaProject): ImpactReport {
    return {
      summary: '고급 정규화 분석을 위한 규칙이 추가됩니다.',
      affectedTableIds: [this.dependency.tableId],
      affectedColumnIds: [...this.dependency.determinantColumnIds, ...this.dependency.dependentColumnIds],
      affectedRelationIds: [],
      affectedExportViewIds: [],
      affectedCsvHeaders: [],
      existingDataRisk: ['행 값은 변경되지 않습니다. 이후 정규화 경고는 달라질 수 있습니다.'],
      requiredConfirmations: [],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project), this.serialize(), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    return {
      ...project,
      functionalDependencies: project.functionalDependencies.filter((dependency) => dependency.dependencyId !== this.dependency.dependencyId),
    }
  }

  serialize(): AddFunctionalDependencySerialized {
    return {
      type: 'AddFunctionalDependency',
      commandId: this.commandId,
      dependency: this.dependency,
    }
  }

  private apply(project: SchemaProject): SchemaProject {
    return {
      ...project,
      functionalDependencies: [...project.functionalDependencies, this.dependency],
    }
  }
}

export class SplitTableCommand implements SchemaCommand<SplitTableSerialized> {
  readonly type = 'SplitTable'
  readonly commandId: EntityId
  readonly sourceTableId: EntityId
  readonly movedColumnIds: readonly EntityId[]
  readonly newTable: SchemaTable
  readonly relation?: Relation
  readonly approved: boolean
  readonly previousSourceTable?: SchemaTable

  constructor(input: Omit<SplitTableSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.sourceTableId = input.sourceTableId
    this.movedColumnIds = input.movedColumnIds
    this.newTable = input.newTable
    this.relation = input.relation
    this.approved = input.approved ?? false
    this.previousSourceTable = input.previousSourceTable
  }

  validate(project: SchemaProject): CommandValidation {
    const sourceTable = findTable(project, this.sourceTableId)

    if (!sourceTable) {
      return { ok: false, issues: [blocking('원본 테이블 없음', '분리할 테이블이 더 이상 존재하지 않습니다.', [this.sourceTableId])] }
    }

    if (!this.approved) {
      return { ok: false, issues: [blockedApproval('SplitTable', sourceTable.name)] }
    }

    const missingColumns = this.movedColumnIds.filter((columnId) => !findColumn(sourceTable, columnId))

    if (missingColumns.length > 0) {
      return { ok: false, issues: [blocking('분리 컬럼 없음', '분리 대상으로 선택한 일부 컬럼이 더 이상 존재하지 않습니다.', [this.sourceTableId], missingColumns)] }
    }

    if (project.tables.some((table) => table.tableId === this.newTable.tableId)) {
      return { ok: false, issues: [blocking('분리 대상 중복', `${this.newTable.name}이 이미 존재합니다.`, [this.newTable.tableId])] }
    }

    const nextProject = this.apply(project)
    const issues = validateProject(nextProject)
    const hasBlocking = issues.some((issue) => issue.severity === 'blocking')

    return { ok: !hasBlocking, issues }
  }

  describe(project: SchemaProject): string {
    return `${requireTable(project, this.sourceTableId).name}에서 컬럼 ${this.movedColumnIds.length}개를 ${this.newTable.name}(으)로 분리합니다.`
  }

  describeImpact(project: SchemaProject): ImpactReport {
    const sourceTable = requireTable(project, this.sourceTableId)

    return {
      summary: `${sourceTable.name}에서 ${this.newTable.name} 테이블이 생성됩니다.`,
      affectedTableIds: [this.sourceTableId, this.newTable.tableId],
      affectedColumnIds: this.movedColumnIds,
      affectedRelationIds: this.relation ? [this.relation.relationId] : [],
      affectedExportViewIds: project.exportViews
        .filter((view) => view.columns.some((column) => this.movedColumnIds.includes(column.sourceColumnId)))
        .map((view) => view.viewId),
      affectedCsvHeaders: [],
      existingDataRisk: ['분리를 확정하기 전에 행을 추출 테이블로 마이그레이션해야 합니다.'],
      requiredConfirmations: ['테이블 분리와 마이그레이션 매핑을 확인하세요.'],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project), this.serializeWithPrevious(project), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    if (!this.previousSourceTable) {
      throw new Error('이전 원본 테이블 정보가 없어 SplitTable을 되돌릴 수 없습니다.')
    }

    return {
      ...project,
      tables: project.tables
        .filter((table) => table.tableId !== this.newTable.tableId)
        .map((table) => (table.tableId === this.sourceTableId ? this.previousSourceTable as SchemaTable : table)),
      relations: project.relations.filter((relation) => relation.relationId !== this.relation?.relationId),
      layout: {
        nodes: project.layout.nodes.filter((node) => node.entityId !== this.newTable.tableId),
      },
    }
  }

  serialize(): SplitTableSerialized {
    return {
      type: 'SplitTable',
      commandId: this.commandId,
      sourceTableId: this.sourceTableId,
      movedColumnIds: this.movedColumnIds,
      newTable: this.newTable,
      relation: this.relation,
      approved: this.approved,
      previousSourceTable: this.previousSourceTable,
    }
  }

  private serializeWithPrevious(project: SchemaProject): SplitTableSerialized {
    return { ...this.serialize(), previousSourceTable: requireTable(project, this.sourceTableId) }
  }

  private apply(project: SchemaProject): SchemaProject {
    return {
      ...replaceTable(project, this.sourceTableId, (table) => ({
        ...table,
        columns: table.columns.filter((column) => !this.movedColumnIds.includes(column.columnId)),
        primaryKey: { columnIds: table.primaryKey.columnIds.filter((columnId) => !this.movedColumnIds.includes(columnId)) },
      })),
      tables: [
        ...project.tables.map((table) =>
          table.tableId === this.sourceTableId
            ? {
              ...table,
              columns: table.columns.filter((column) => !this.movedColumnIds.includes(column.columnId)),
              primaryKey: { columnIds: table.primaryKey.columnIds.filter((columnId) => !this.movedColumnIds.includes(columnId)) },
            }
            : table,
        ),
        this.newTable,
      ],
      relations: this.relation ? [...project.relations, this.relation] : project.relations,
      layout: { nodes: [...project.layout.nodes, { entityId: this.newTable.tableId, x: 80, y: 80 }] },
    }
  }
}

export class MergeTableCommand implements SchemaCommand<MergeTableSerialized> {
  readonly type = 'MergeTable'
  readonly commandId: EntityId
  readonly sourceTableId: EntityId
  readonly targetTableId: EntityId
  readonly approved: boolean
  readonly previousSourceTable?: SchemaTable
  readonly previousTargetTable?: SchemaTable
  readonly removedRelations?: readonly Relation[]

  constructor(input: Omit<MergeTableSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.sourceTableId = input.sourceTableId
    this.targetTableId = input.targetTableId
    this.approved = input.approved ?? false
    this.previousSourceTable = input.previousSourceTable
    this.previousTargetTable = input.previousTargetTable
    this.removedRelations = input.removedRelations
  }

  validate(project: SchemaProject): CommandValidation {
    const source = findTable(project, this.sourceTableId)
    const target = findTable(project, this.targetTableId)

    if (!source || !target) {
      return { ok: false, issues: [blocking('병합 테이블 없음', '원본 또는 대상 테이블이 더 이상 존재하지 않습니다.', [this.sourceTableId, this.targetTableId])] }
    }

    if (!this.approved) {
      return { ok: false, issues: [blockedApproval('MergeTable', `${source.name} into ${target.name}`)] }
    }

    const nameCollision = source.columns.some((sourceColumn) =>
      target.columns.some((targetColumn) => targetColumn.name.toLowerCase() === sourceColumn.name.toLowerCase()),
    )

    if (nameCollision) {
      return { ok: false, issues: [blocking('병합 컬럼 이름 충돌', '원본과 대상 테이블에 같은 이름의 컬럼이 있습니다.', [source.tableId, target.tableId])] }
    }

    return withValidation(project)
  }

  describe(project: SchemaProject): string {
    return `${requireTable(project, this.sourceTableId).name}을 ${requireTable(project, this.targetTableId).name}(으)로 병합합니다.`
  }

  describeImpact(project: SchemaProject): ImpactReport {
    const source = requireTable(project, this.sourceTableId)
    const target = requireTable(project, this.targetTableId)
    const removedRelations = project.relations.filter((relation) => relation.sourceTableId === source.tableId || relation.targetTableId === source.tableId)

    return {
      summary: `${source.name}의 컬럼이 ${target.name}(으)로 이동하고 ${source.name}은 제거됩니다.`,
      affectedTableIds: [source.tableId, target.tableId],
      affectedColumnIds: source.columns.map((column) => column.columnId),
      affectedRelationIds: removedRelations.map((relation) => relation.relationId),
      affectedExportViewIds: project.exportViews.filter((view) => view.rootTableId === source.tableId).map((view) => view.viewId),
      affectedCsvHeaders: [],
      existingDataRisk: ['원본 테이블을 제거하기 전에 행 조인이 완료되어야 합니다.'],
      requiredConfirmations: ['병합 매핑과 행 카디널리티를 확인하세요.'],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)

    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }

    return appendHistory(this.apply(project), this.serializeWithPrevious(project), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    if (!this.previousSourceTable || !this.previousTargetTable) {
      throw new Error('이전 테이블 정보가 없어 MergeTable을 되돌릴 수 없습니다.')
    }

    return {
      ...project,
      tables: [
        ...project.tables.map((table) => (table.tableId === this.targetTableId ? this.previousTargetTable as SchemaTable : table)),
        this.previousSourceTable,
      ],
      relations: [...project.relations, ...(this.removedRelations ?? [])],
      layout: { nodes: [...project.layout.nodes, { entityId: this.previousSourceTable.tableId, x: 120, y: 120 }] },
    }
  }

  serialize(): MergeTableSerialized {
    return {
      type: 'MergeTable',
      commandId: this.commandId,
      sourceTableId: this.sourceTableId,
      targetTableId: this.targetTableId,
      approved: this.approved,
      previousSourceTable: this.previousSourceTable,
      previousTargetTable: this.previousTargetTable,
      removedRelations: this.removedRelations,
    }
  }

  private serializeWithPrevious(project: SchemaProject): MergeTableSerialized {
    return {
      ...this.serialize(),
      previousSourceTable: requireTable(project, this.sourceTableId),
      previousTargetTable: requireTable(project, this.targetTableId),
      removedRelations: project.relations.filter((relation) => relation.sourceTableId === this.sourceTableId || relation.targetTableId === this.sourceTableId),
    }
  }

  private apply(project: SchemaProject): SchemaProject {
    const source = requireTable(project, this.sourceTableId)

    return {
      ...replaceTable(project, this.targetTableId, (target) => ({
        ...target,
        columns: [...target.columns, ...source.columns.map((column) => ({ ...column, tableId: target.tableId }))],
      })),
      tables: project.tables
        .filter((table) => table.tableId !== this.sourceTableId)
        .map((table) =>
          table.tableId === this.targetTableId
            ? { ...table, columns: [...table.columns, ...source.columns.map((column) => ({ ...column, tableId: table.tableId }))] }
            : table,
        ),
      relations: project.relations.filter((relation) => relation.sourceTableId !== this.sourceTableId && relation.targetTableId !== this.sourceTableId),
      layout: { nodes: project.layout.nodes.filter((node) => node.entityId !== this.sourceTableId) },
    }
  }
}

export class ExtractLookupTableCommand implements SchemaCommand<ExtractLookupTableSerialized> {
  readonly type = 'ExtractLookupTable'
  readonly commandId: EntityId
  readonly sourceTableId: EntityId
  readonly lookupTable: SchemaTable
  readonly relation: Relation

  constructor(input: Omit<ExtractLookupTableSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.sourceTableId = input.sourceTableId
    this.lookupTable = input.lookupTable
    this.relation = input.relation
  }

  validate(project: SchemaProject): CommandValidation {
    if (!findTable(project, this.sourceTableId)) {
      return { ok: false, issues: [blocking('원본 테이블 없음', '룩업 추출 대상 테이블이 더 이상 존재하지 않습니다.', [this.sourceTableId])] }
    }

    if (project.tables.some((table) => table.tableId === this.lookupTable.tableId)) {
      return { ok: false, issues: [blocking('룩업 테이블 중복', `${this.lookupTable.name}이 이미 존재합니다.`, [this.lookupTable.tableId])] }
    }

    const nextProject = this.apply(project)
    const issues = validateProject(nextProject)
    return { ok: !issues.some((issue) => issue.severity === 'blocking'), issues }
  }

  describe(): string {
    return `${this.lookupTable.name} 룩업 테이블을 추출합니다.`
  }

  describeImpact(_project: SchemaProject): ImpactReport {
    return {
      summary: `${this.lookupTable.name}이 추가되고 원본 테이블과 연결됩니다.`,
      affectedTableIds: [this.sourceTableId, this.lookupTable.tableId],
      affectedColumnIds: this.lookupTable.columns.map((column) => column.columnId),
      affectedRelationIds: [this.relation.relationId],
      affectedExportViewIds: [],
      affectedCsvHeaders: [],
      existingDataRisk: ['원본의 고유값을 룩업 테이블로 백필해야 합니다.'],
      requiredConfirmations: [],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)
    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }
    return appendHistory(this.apply(project), this.serialize(), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    return {
      ...project,
      tables: project.tables.filter((table) => table.tableId !== this.lookupTable.tableId),
      relations: project.relations.filter((relation) => relation.relationId !== this.relation.relationId),
      layout: { nodes: project.layout.nodes.filter((node) => node.entityId !== this.lookupTable.tableId) },
    }
  }

  serialize(): ExtractLookupTableSerialized {
    return {
      type: 'ExtractLookupTable',
      commandId: this.commandId,
      sourceTableId: this.sourceTableId,
      lookupTable: this.lookupTable,
      relation: this.relation,
    }
  }

  private apply(project: SchemaProject): SchemaProject {
    return {
      ...project,
      tables: [...project.tables, this.lookupTable],
      relations: [...project.relations, this.relation],
      layout: { nodes: [...project.layout.nodes, { entityId: this.lookupTable.tableId, x: 140, y: 140 }] },
    }
  }
}

export class CreateJunctionTableCommand implements SchemaCommand<CreateJunctionTableSerialized> {
  readonly type = 'CreateJunctionTable'
  readonly commandId: EntityId
  readonly table: SchemaTable
  readonly relations: readonly Relation[]

  constructor(input: Omit<CreateJunctionTableSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.table = input.table
    this.relations = input.relations
  }

  validate(project: SchemaProject): CommandValidation {
    if (project.tables.some((table) => table.tableId === this.table.tableId)) {
      return { ok: false, issues: [blocking('조인 테이블 중복', `${this.table.name}이 이미 존재합니다.`, [this.table.tableId])] }
    }

    const nextProject = this.apply(project)
    const issues = validateProject(nextProject)
    return { ok: !issues.some((issue) => issue.severity === 'blocking'), issues }
  }

  describe(): string {
    return `${this.table.name} 조인 테이블을 생성합니다.`
  }

  describeImpact(_project: SchemaProject): ImpactReport {
    return {
      summary: `${this.table.name}이 관계 ${this.relations.length}개와 함께 생성됩니다.`,
      affectedTableIds: [this.table.tableId, ...this.relations.flatMap((relation) => [relation.sourceTableId, relation.targetTableId])],
      affectedColumnIds: this.table.columns.map((column) => column.columnId),
      affectedRelationIds: this.relations.map((relation) => relation.relationId),
      affectedExportViewIds: [],
      affectedCsvHeaders: [],
      existingDataRisk: ['기존 다대다 행을 조인 테이블로 백필해야 합니다.'],
      requiredConfirmations: [],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)
    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }
    return appendHistory(this.apply(project), this.serialize(), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    const relationIds = new Set(this.relations.map((relation) => relation.relationId))
    return {
      ...project,
      tables: project.tables.filter((table) => table.tableId !== this.table.tableId),
      relations: project.relations.filter((relation) => !relationIds.has(relation.relationId)),
      layout: { nodes: project.layout.nodes.filter((node) => node.entityId !== this.table.tableId) },
    }
  }

  serialize(): CreateJunctionTableSerialized {
    return { type: 'CreateJunctionTable', commandId: this.commandId, table: this.table, relations: this.relations }
  }

  private apply(project: SchemaProject): SchemaProject {
    return {
      ...project,
      tables: [...project.tables, { ...this.table, tags: [...new Set([...this.table.tags, 'junction'])] }],
      relations: [...project.relations, ...this.relations],
      layout: { nodes: [...project.layout.nodes, { entityId: this.table.tableId, x: 180, y: 180 }] },
    }
  }
}

export class AddSurrogateKeyCommand implements SchemaCommand<AddSurrogateKeySerialized> {
  readonly type = 'AddSurrogateKey'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly column: SchemaColumn
  readonly previousPrimaryKey?: readonly EntityId[]

  constructor(input: Omit<AddSurrogateKeySerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.tableId = input.tableId
    this.column = input.column
    this.previousPrimaryKey = input.previousPrimaryKey
  }

  validate(project: SchemaProject): CommandValidation {
    const table = findTable(project, this.tableId)
    if (!table) {
      return { ok: false, issues: [blocking('테이블 없음', '대상 테이블이 더 이상 존재하지 않습니다.', [this.tableId])] }
    }
    if (table.columns.some((column) => column.columnId === this.column.columnId || column.name.toLowerCase() === this.column.name.toLowerCase())) {
      return { ok: false, issues: [blocking('대체키 중복', `${this.column.name}이 이미 존재합니다.`, [this.tableId], [this.column.columnId])] }
    }
    return withValidation(project)
  }

  describe(project: SchemaProject): string {
    return `${requireTable(project, this.tableId).name}에 대체키 ${this.column.name}을 추가합니다.`
  }

  describeImpact(project: SchemaProject): ImpactReport {
    return {
      summary: `${this.column.name}이 ${requireTable(project, this.tableId).name}의 기본키가 됩니다.`,
      affectedTableIds: [this.tableId],
      affectedColumnIds: [this.column.columnId, ...requireTable(project, this.tableId).primaryKey.columnIds],
      affectedRelationIds: project.relations.filter((relation) => relation.targetTableId === this.tableId).map((relation) => relation.relationId),
      affectedExportViewIds: [],
      affectedCsvHeaders: [],
      existingDataRisk: ['기존 행에는 안정적인 키 값 생성이 필요합니다.'],
      requiredConfirmations: ['대체키 생성 전략을 확인하세요.'],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project, [this.column.columnId])
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)
    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }
    return appendHistory(this.apply(project, [this.column.columnId]), this.serializeWithPrevious(project), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    if (!this.previousPrimaryKey) {
      throw new Error('이전 기본키 정보가 없어 AddSurrogateKey를 되돌릴 수 없습니다.')
    }
    return replaceTable(project, this.tableId, (table) => ({
      ...table,
      columns: table.columns.filter((column) => column.columnId !== this.column.columnId),
      primaryKey: { columnIds: this.previousPrimaryKey as readonly EntityId[] },
    }))
  }

  serialize(): AddSurrogateKeySerialized {
    return {
      type: 'AddSurrogateKey',
      commandId: this.commandId,
      tableId: this.tableId,
      column: this.column,
      previousPrimaryKey: this.previousPrimaryKey,
    }
  }

  private serializeWithPrevious(project: SchemaProject): AddSurrogateKeySerialized {
    return { ...this.serialize(), previousPrimaryKey: requireTable(project, this.tableId).primaryKey.columnIds }
  }

  private apply(project: SchemaProject, primaryKey: readonly EntityId[]): SchemaProject {
    return replaceTable(project, this.tableId, (table) => ({
      ...table,
      columns: [...table.columns, { ...this.column, tableId: this.tableId, nullable: false }],
      primaryKey: { columnIds: primaryKey },
    }))
  }
}

export class BackfillColumnCommand implements SchemaCommand<BackfillColumnSerialized> {
  readonly type = 'BackfillColumn'
  readonly commandId: EntityId
  readonly tableId: EntityId
  readonly columnId: EntityId
  readonly strategy: BackfillColumnSerialized['strategy']
  readonly value?: unknown
  readonly previousDefaultValue?: unknown

  constructor(input: Omit<BackfillColumnSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.tableId = input.tableId
    this.columnId = input.columnId
    this.strategy = input.strategy
    this.value = input.value
    this.previousDefaultValue = input.previousDefaultValue
  }

  validate(project: SchemaProject): CommandValidation {
    const table = findTable(project, this.tableId)
    const column = table ? findColumn(table, this.columnId) : undefined
    if (!table || !column) {
      return { ok: false, issues: [blocking('백필 대상 없음', '대상 컬럼이 더 이상 존재하지 않습니다.', [this.tableId], [this.columnId])] }
    }
    if (this.strategy === 'fixed_default' && this.value === undefined) {
      return { ok: false, issues: [blocking('백필 값 없음', '고정 기본값 백필에는 값이 필요합니다.', [this.tableId], [this.columnId])] }
    }
    return withValidation(project)
  }

  describe(project: SchemaProject): string {
    const table = requireTable(project, this.tableId)
    const column = requireColumn(table, this.columnId)
    return `${this.strategy} 전략으로 ${table.name}.${column.name}을 백필합니다.`
  }

  describeImpact(project: SchemaProject): ImpactReport {
    return {
      summary: this.describe(project),
      affectedTableIds: [this.tableId],
      affectedColumnIds: [this.columnId],
      affectedRelationIds: [],
      affectedExportViewIds: project.exportViews.filter((view) => view.columns.some((column) => column.sourceColumnId === this.columnId)).map((view) => view.viewId),
      affectedCsvHeaders: [],
      existingDataRisk: ['기존 빈 값은 선택한 전략에 따라 채워집니다.'],
      requiredConfirmations: this.strategy === 'manual' ? ['수동 검토 대기열을 완료해야 합니다.'] : [],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project, this.value)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)
    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }
    return appendHistory(this.apply(project, this.value), this.serializeWithPrevious(project), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    return this.apply(project, this.previousDefaultValue)
  }

  serialize(): BackfillColumnSerialized {
    return {
      type: 'BackfillColumn',
      commandId: this.commandId,
      tableId: this.tableId,
      columnId: this.columnId,
      strategy: this.strategy,
      value: this.value,
      previousDefaultValue: this.previousDefaultValue,
    }
  }

  private serializeWithPrevious(project: SchemaProject): BackfillColumnSerialized {
    return { ...this.serialize(), previousDefaultValue: requireColumn(requireTable(project, this.tableId), this.columnId).defaultValue }
  }

  private apply(project: SchemaProject, defaultValue: unknown): SchemaProject {
    return replaceTable(project, this.tableId, (table) => ({
      ...table,
      columns: table.columns.map((column) => column.columnId === this.columnId ? { ...column, defaultValue } : column),
    }))
  }
}

export class CreateExportViewCommand implements SchemaCommand<CreateExportViewSerialized> {
  readonly type = 'CreateExportView'
  readonly commandId: EntityId
  readonly view: ExportView

  constructor(input: Omit<CreateExportViewSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.view = input.view
  }

  validate(project: SchemaProject): CommandValidation {
    if (project.exportViews.some((view) => view.viewId === this.view.viewId || view.name.toLowerCase() === this.view.name.toLowerCase())) {
      return { ok: false, issues: [blocking('출력 뷰 중복', `${this.view.name}이 이미 존재합니다.`, [])] }
    }
    const nextProject = this.apply(project)
    const issues = validateProject(nextProject)
    return { ok: !issues.some((issue) => issue.severity === 'blocking'), issues }
  }

  describe(): string {
    return `${this.view.name} 출력 뷰를 생성합니다.`
  }

  describeImpact(_project: SchemaProject): ImpactReport {
    return {
      summary: `${this.view.name}이 ${this.view.format.toUpperCase()} 출력을 생성합니다.`,
      affectedTableIds: [this.view.rootTableId],
      affectedColumnIds: this.view.columns.map((column) => column.sourceColumnId),
      affectedRelationIds: [],
      affectedExportViewIds: [this.view.viewId],
      affectedCsvHeaders: this.view.columns.map((column) => column.header),
      existingDataRisk: ['출력 생성은 원본 컬럼 검증을 통과해야 합니다.'],
      requiredConfirmations: [],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)
    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }
    return appendHistory(this.apply(project), this.serialize(), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    return { ...project, exportViews: project.exportViews.filter((view) => view.viewId !== this.view.viewId) }
  }

  serialize(): CreateExportViewSerialized {
    return { type: 'CreateExportView', commandId: this.commandId, view: this.view }
  }

  private apply(project: SchemaProject): SchemaProject {
    return { ...project, exportViews: [...project.exportViews, this.view] }
  }
}

export class ModifyExportViewCommand implements SchemaCommand<ModifyExportViewSerialized> {
  readonly type = 'ModifyExportView'
  readonly commandId: EntityId
  readonly viewId: EntityId
  readonly nextView: ExportView
  readonly previousView?: ExportView

  constructor(input: Omit<ModifyExportViewSerialized, 'type' | 'commandId'> & { readonly commandId?: EntityId }) {
    this.commandId = input.commandId ?? makeId('command')
    this.viewId = input.viewId
    this.nextView = input.nextView
    this.previousView = input.previousView
  }

  validate(project: SchemaProject): CommandValidation {
    if (!project.exportViews.some((view) => view.viewId === this.viewId)) {
      return { ok: false, issues: [blocking('출력 뷰 없음', '출력 뷰가 더 이상 존재하지 않습니다.', [])] }
    }
    const nextProject = this.apply(project, this.nextView)
    const issues = validateProject(nextProject)
    return { ok: !issues.some((issue) => issue.severity === 'blocking'), issues }
  }

  describe(): string {
    return `${this.nextView.name} 출력 뷰를 수정합니다.`
  }

  describeImpact(_project: SchemaProject): ImpactReport {
    return {
      summary: `${this.nextView.name} 출력 정의가 변경됩니다.`,
      affectedTableIds: [this.nextView.rootTableId],
      affectedColumnIds: this.nextView.columns.map((column) => column.sourceColumnId),
      affectedRelationIds: [],
      affectedExportViewIds: [this.viewId],
      affectedCsvHeaders: this.nextView.columns.map((column) => column.header),
      existingDataRisk: ['런타임 출력 헤더 또는 값이 바뀔 수 있습니다.'],
      requiredConfirmations: [],
    }
  }

  preview(project: SchemaProject): SchemaProject {
    return this.apply(project, this.nextView)
  }

  execute(project: SchemaProject): SchemaProject {
    const validation = this.validate(project)
    if (!validation.ok) {
      throw new Error(validation.issues[0]?.message ?? '명령 검증에 실패했습니다.')
    }
    return appendHistory(this.apply(project, this.nextView), this.serializeWithPrevious(project), this.describeImpact(project))
  }

  undo(project: SchemaProject): SchemaProject {
    if (!this.previousView) {
      throw new Error('이전 출력 뷰 정보가 없어 ModifyExportView를 되돌릴 수 없습니다.')
    }
    return this.apply(project, this.previousView)
  }

  serialize(): ModifyExportViewSerialized {
    return {
      type: 'ModifyExportView',
      commandId: this.commandId,
      viewId: this.viewId,
      nextView: this.nextView,
      previousView: this.previousView,
    }
  }

  private serializeWithPrevious(project: SchemaProject): ModifyExportViewSerialized {
    return { ...this.serialize(), previousView: project.exportViews.find((view) => view.viewId === this.viewId) }
  }

  private apply(project: SchemaProject, view: ExportView): SchemaProject {
    return { ...project, exportViews: project.exportViews.map((candidate) => candidate.viewId === this.viewId ? view : candidate) }
  }
}

export function commandFromSerialized(serialized: SerializedCommand): SchemaCommand {
  switch (serialized.type) {
    case 'RenameColumn':
      return new RenameColumnCommand(serialized)
    case 'ChangeNullable':
      return new ChangeNullableCommand(serialized)
    case 'AddColumn':
      return new AddColumnCommand(serialized)
    case 'ReorderColumn':
      return new ReorderColumnCommand(serialized)
    case 'RenameTable':
      return new RenameTableCommand(serialized)
    case 'ChangeTableDescription':
      return new ChangeTableDescriptionCommand(serialized)
    case 'ChangeColumnDescription':
      return new ChangeColumnDescriptionCommand(serialized)
    case 'DeleteColumn':
      return new DeleteColumnCommand(serialized)
    case 'ChangeColumnType':
      return new ChangeColumnTypeCommand(serialized)
    case 'CreateTable':
      return new CreateTableCommand(serialized)
    case 'MoveTableLayout':
      return new MoveTableLayoutCommand(serialized)
    case 'MoveTablesLayout':
      return new MoveTablesLayoutCommand(serialized)
    case 'DeleteTable':
      return new DeleteTableCommand(serialized)
    case 'ChangePrimaryKey':
      return new ChangePrimaryKeyCommand(serialized)
    case 'AddForeignKey':
      return new AddForeignKeyCommand(serialized)
    case 'DeleteForeignKey':
      return new DeleteForeignKeyCommand(serialized)
    case 'AddUniqueConstraint':
      return new AddUniqueConstraintCommand(serialized)
    case 'AddCheckConstraint':
      return new AddCheckConstraintCommand(serialized)
    case 'AddFunctionalDependency':
      return new AddFunctionalDependencyCommand(serialized)
    case 'SplitTable':
      return new SplitTableCommand(serialized)
    case 'MergeTable':
      return new MergeTableCommand(serialized)
    case 'ExtractLookupTable':
      return new ExtractLookupTableCommand(serialized)
    case 'CreateJunctionTable':
      return new CreateJunctionTableCommand(serialized)
    case 'AddSurrogateKey':
      return new AddSurrogateKeyCommand(serialized)
    case 'BackfillColumn':
      return new BackfillColumnCommand(serialized)
    case 'CreateExportView':
      return new CreateExportViewCommand(serialized)
    case 'ModifyExportView':
      return new ModifyExportViewCommand(serialized)
  }
}

export function materializeCommandForUndo(project: SchemaProject, command: SchemaCommand): SerializedCommand {
  const serialized = command.serialize()

  switch (serialized.type) {
    case 'RenameColumn': {
      const table = requireTable(project, serialized.tableId)
      const column = requireColumn(table, serialized.columnId)

      return {
        ...serialized,
        previousName: column.name,
      }
    }
    case 'ChangeNullable': {
      const table = requireTable(project, serialized.tableId)
      const column = requireColumn(table, serialized.columnId)

      return {
        ...serialized,
        previousNullable: column.nullable,
      }
    }
    case 'AddColumn':
      return serialized
    case 'ReorderColumn':
      return {
        ...serialized,
        previousIndex: requireTable(project, serialized.tableId).columns.findIndex((column) => column.columnId === serialized.columnId),
      }
    case 'RenameTable':
      return {
        ...serialized,
        previousName: requireTable(project, serialized.tableId).name,
      }
    case 'ChangeTableDescription':
      return { ...serialized, previousDescription: requireTable(project, serialized.tableId).description }
    case 'ChangeColumnDescription':
      return {
        ...serialized,
        previousDescription: requireColumn(requireTable(project, serialized.tableId), serialized.columnId).description,
      }
    case 'DeleteColumn':
      return {
        ...serialized,
        deletedColumn: requireColumn(requireTable(project, serialized.tableId), serialized.columnId),
        deletedColumnIndex: requireTable(project, serialized.tableId).columns.findIndex((column) => column.columnId === serialized.columnId),
        deletedRelations: project.relations.filter(
          (relation) => relation.sourceColumnIds.includes(serialized.columnId) || relation.targetColumnIds.includes(serialized.columnId),
        ),
      }
    case 'ChangeColumnType':
      return {
        ...serialized,
        previousDataType: requireColumn(requireTable(project, serialized.tableId), serialized.columnId).dataType,
      }
    case 'CreateTable':
      return serialized
    case 'MoveTableLayout': {
      const previous = project.layout.nodes.find((node) => node.entityId === serialized.tableId)

      return {
        ...serialized,
        previousX: previous?.x,
        previousY: previous?.y,
        previousHadLayout: Boolean(previous),
      }
    }
    case 'MoveTablesLayout': {
      const targetIds = new Set(serialized.positions.map((position) => position.entityId))
      return {
        ...serialized,
        previousNodes: project.layout.nodes.filter((position) => targetIds.has(position.entityId)),
      }
    }
    case 'DeleteTable':
      return {
        ...serialized,
        deletedTable: requireTable(project, serialized.tableId),
        deletedRelations: project.relations.filter(
          (relation) => relation.sourceTableId === serialized.tableId || relation.targetTableId === serialized.tableId,
        ),
      }
    case 'ChangePrimaryKey':
      return {
        ...serialized,
        previousColumnIds: requireTable(project, serialized.tableId).primaryKey.columnIds,
      }
    case 'AddForeignKey':
      return serialized
    case 'DeleteForeignKey':
      return {
        ...serialized,
        deletedRelation: project.relations.find((relation) => relation.relationId === serialized.relationId),
      }
    case 'AddUniqueConstraint':
      return serialized
    case 'AddCheckConstraint':
      return serialized
    case 'AddFunctionalDependency':
      return serialized
    case 'SplitTable':
      return {
        ...serialized,
        previousSourceTable: requireTable(project, serialized.sourceTableId),
      }
    case 'MergeTable':
      return {
        ...serialized,
        previousSourceTable: requireTable(project, serialized.sourceTableId),
        previousTargetTable: requireTable(project, serialized.targetTableId),
        removedRelations: project.relations.filter(
          (relation) => relation.sourceTableId === serialized.sourceTableId || relation.targetTableId === serialized.sourceTableId,
        ),
      }
    case 'ExtractLookupTable':
      return serialized
    case 'CreateJunctionTable':
      return serialized
    case 'AddSurrogateKey':
      return {
        ...serialized,
        previousPrimaryKey: requireTable(project, serialized.tableId).primaryKey.columnIds,
      }
    case 'BackfillColumn':
      return {
        ...serialized,
        previousDefaultValue: requireColumn(requireTable(project, serialized.tableId), serialized.columnId).defaultValue,
      }
    case 'CreateExportView':
      return serialized
    case 'ModifyExportView':
      return {
        ...serialized,
        previousView: project.exportViews.find((view) => view.viewId === serialized.viewId),
      }
  }
}
