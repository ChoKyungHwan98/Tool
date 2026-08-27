import { validateProject } from '../domain/validator'
import type { EntityId, SchemaProject, ValidationIssue } from '../domain/schema'

export type AiCommandDraft =
  | {
      readonly kind: 'create_table'
      readonly name: string
      readonly description?: string
      readonly columns: readonly {
        readonly name: string
        readonly dataType: 'string' | 'int32' | 'float' | 'boolean'
        readonly nullable?: boolean
        readonly primaryKey?: boolean
      }[]
    }
  | {
      readonly kind: 'add_export_column'
      readonly viewId: EntityId
      readonly tableId: EntityId
      readonly columnId: EntityId
      readonly header?: string
    }

export interface SchemaProposal {
  readonly summary: string
  readonly assumptions: readonly string[]
  readonly clarificationQuestions: readonly string[]
  readonly findings: readonly ValidationIssue[]
  readonly alternatives: readonly string[]
  readonly proposedOperations: readonly string[]
  readonly commandDrafts: readonly AiCommandDraft[]
  readonly migrationPlan: readonly string[]
  readonly risks: readonly string[]
  readonly affectedEntityIds: readonly EntityId[]
  readonly tableIds: readonly EntityId[]
  readonly columnIds: readonly EntityId[]
  readonly relationIds: readonly EntityId[]
  readonly confidence: number
}

export interface AiProvider {
  proposeSchema(input: { readonly project: SchemaProject; readonly prompt: string }): Promise<SchemaProposal>
  reviewNormalization(input: { readonly project: SchemaProject }): Promise<SchemaProposal>
  explainImpact(input: { readonly project: SchemaProject; readonly entityIds: readonly EntityId[] }): Promise<SchemaProposal>
}

export class MockAiProvider implements AiProvider {
  async proposeSchema(input: { readonly project: SchemaProject; readonly prompt: string }): Promise<SchemaProposal> {
    const findings = validateProject(input.project)
    const view = input.project.exportViews[0]
    const exportedColumnIds = new Set(view?.columns.map((column) => column.sourceColumnId) ?? [])
    const exportTables = view
      ? [...input.project.tables.filter((table) => table.tableId === view.rootTableId), ...input.project.tables.filter((table) => table.tableId !== view.rootTableId)]
      : input.project.tables
    const exportCandidate = exportTables
      .flatMap((table) => table.columns.map((column) => ({ table, column })))
      .find(({ column }) => !exportedColumnIds.has(column.columnId))
    const commandDrafts: AiCommandDraft[] = view && exportCandidate
      ? [{ kind: 'add_export_column', viewId: view.viewId, tableId: exportCandidate.table.tableId, columnId: exportCandidate.column.columnId }]
      : input.project.tables.length === 0
        ? [{
            kind: 'create_table',
            name: 'SuggestedTable',
            description: 'AI 검토 후 생성할 기본 게임 데이터 테이블입니다.',
            columns: [
              { name: 'SuggestedTableId', dataType: 'string', nullable: false, primaryKey: true },
              { name: 'DisplayName', dataType: 'string', nullable: false },
            ],
          }]
        : []

    return {
      summary: `Mock 제안: ${input.prompt}`,
      assumptions: ['스키마 메타데이터만 검토합니다. 행 데이터는 전송하지 않습니다.'],
      clarificationQuestions: [],
      findings,
      alternatives: ['현재 정규화된 작성 모델을 유지합니다.', '원본 테이블을 비정규화하지 않고 런타임 출력 뷰를 만듭니다.'],
      proposedOperations: ['어떤 작업도 자동 적용하지 않습니다. Command 생성 전 변경 검토를 엽니다.'],
      commandDrafts,
      migrationPlan: ['필수 컬럼을 추가할 때는 빈 값 허용 -> 백필 -> 검증 -> Not Null 순서로 진행합니다.'],
      risks: findings.filter((finding) => finding.severity === 'blocking').map((finding) => finding.message),
      affectedEntityIds: input.project.tables.map((table) => table.tableId),
      tableIds: input.project.tables.map((table) => table.tableId),
      columnIds: findings.flatMap((finding) => finding.columnIds),
      relationIds: findings.flatMap((finding) => finding.relationIds),
      confidence: 0.74,
    }
  }

  async reviewNormalization(input: { readonly project: SchemaProject }): Promise<SchemaProposal> {
    const findings = validateProject(input.project)

    return {
      summary: 'Mock 정규화 검토가 로컬에서 완료되었습니다.',
      assumptions: ['자동 추론 전까지 정규화 규칙은 디자이너가 작성한 정보로 봅니다.'],
      clarificationQuestions: [],
      findings,
      alternatives: ['최소 구조', '정규화된 작성 구조', '런타임 최적화 출력 뷰'],
      proposedOperations: ['반복 열과 복합 키의 정규화 규칙을 점검합니다.'],
      commandDrafts: [],
      migrationPlan: ['Mock AI는 파괴적 마이그레이션을 제안하지 않습니다.'],
      risks: [],
      affectedEntityIds: findings.flatMap((finding) => [...finding.tableIds, ...finding.columnIds]),
      tableIds: [...new Set(findings.flatMap((finding) => finding.tableIds))],
      columnIds: [...new Set(findings.flatMap((finding) => finding.columnIds))],
      relationIds: [...new Set(findings.flatMap((finding) => finding.relationIds))],
      confidence: 0.81,
    }
  }

  async explainImpact(input: { readonly project: SchemaProject; readonly entityIds: readonly EntityId[] }): Promise<SchemaProposal> {
    return {
      summary: '로컬 스키마 ID를 기준으로 Mock 영향 설명을 생성했습니다.',
      assumptions: ['현재 단계에서는 관계, 출력 뷰, 명령 히스토리만 영향 범위로 봅니다.'],
      clarificationQuestions: [],
      findings: validateProject(input.project),
      alternatives: ['검토 후 변경을 그대로 적용합니다.', '변경을 더 작은 Command로 나눕니다.'],
      proposedOperations: [],
      commandDrafts: [],
      migrationPlan: [],
      risks: ['Mock AI는 비공개 프로덕션 데이터를 검사할 수 없습니다.'],
      affectedEntityIds: input.entityIds,
      tableIds: input.entityIds.filter((entityId) => input.project.tables.some((table) => table.tableId === entityId)),
      columnIds: input.entityIds.filter((entityId) => input.project.tables.some((table) => table.columns.some((column) => column.columnId === entityId))),
      relationIds: input.entityIds.filter((entityId) => input.project.relations.some((relation) => relation.relationId === entityId)),
      confidence: 0.68,
    }
  }
}
