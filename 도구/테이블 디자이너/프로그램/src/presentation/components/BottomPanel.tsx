import { AlertTriangle, GitPullRequestArrow, ListChecks, X } from 'lucide-react'
import { useMemo } from 'react'
import {
  migrationCanRollback,
  planBackfillMigration,
  planColumnTypeMigration,
  planMakeColumnRequiredMigration,
  planMergeTableMigration,
  planRequiredColumnMigration,
  planSplitTableMigration,
  type MigrationPlan,
} from '../../application/migration'
import { pendingDocumentTransactionFromSerialized } from '../../application/documentCommands'
import { commandFromSerialized, type SerializedCommand } from '../../domain/commands'
import type { SchemaProject } from '../../domain/schema'
import { validateProjectWithRows } from '../../domain/validator'
import { useWorkbenchStore, type BottomPanel as BottomPanelState } from '../state/workbenchStore'

type PanelId = Exclude<BottomPanelState, 'closed'>

const panels: readonly { readonly id: PanelId; readonly label: string; readonly icon: typeof AlertTriangle }[] = [
  { id: 'problems', label: '문제', icon: AlertTriangle },
  { id: 'changes', label: '변경 검토', icon: GitPullRequestArrow },
]

function migrationPlansForCommand(project: SchemaProject, pendingCommand: SerializedCommand | null): readonly MigrationPlan[] {
  if (!pendingCommand) return []

  switch (pendingCommand.type) {
    case 'AddColumn':
      return pendingCommand.column.nullable
        ? []
        : [planRequiredColumnMigration(project, pendingCommand.tableId, pendingCommand.column)]
    case 'ChangeNullable':
      return pendingCommand.nullable
        ? []
        : [planMakeColumnRequiredMigration(project, pendingCommand.tableId, pendingCommand.columnId)]
    case 'ChangeColumnType':
      return [planColumnTypeMigration(project, pendingCommand.tableId, pendingCommand.columnId, pendingCommand.nextDataType)]
    case 'SplitTable':
      return [planSplitTableMigration(project, pendingCommand.sourceTableId, pendingCommand.movedColumnIds, pendingCommand.newTable.name)]
    case 'MergeTable':
      return [planMergeTableMigration(project, pendingCommand.sourceTableId, pendingCommand.targetTableId)]
    case 'BackfillColumn':
      return [planBackfillMigration(project, pendingCommand.tableId, pendingCommand.columnId, {
        kind: pendingCommand.strategy,
        value: pendingCommand.value,
      })]
    default:
      return []
  }
}

export function BottomPanel() {
  const document = useWorkbenchStore((state) => state.document)
  const project = document.schema
  const rowsByTable = document.rowsByTable
  const bottomPanel = useWorkbenchStore((state) => state.bottomPanel)
  const pendingCommand = useWorkbenchStore((state) => state.pendingCommand)
  const pendingDocumentTransaction = useWorkbenchStore((state) => state.pendingDocumentTransaction)
  const selectTable = useWorkbenchStore((state) => state.selectTable)
  const setMainView = useWorkbenchStore((state) => state.setMainView)
  const setBottomPanel = useWorkbenchStore((state) => state.setBottomPanel)
  const importIssues = useWorkbenchStore((state) => state.importIssues)
  const clearPendingCommand = useWorkbenchStore((state) => state.clearPendingCommand)
  const applyPendingCommand = useWorkbenchStore((state) => state.applyPendingCommand)
  const aiProposal = useWorkbenchStore((state) => state.aiProposal)
  const activePanel: PanelId = bottomPanel === 'closed' ? 'problems' : bottomPanel
  const issues = useMemo(
    () => (activePanel === 'problems'
      ? [...importIssues, ...(aiProposal?.findings ?? []), ...validateProjectWithRows(project, rowsByTable)]
      : importIssues),
    [activePanel, aiProposal, importIssues, project, rowsByTable],
  )
  const migrations = useMemo(
    () => activePanel === 'changes' ? migrationPlansForCommand(project, pendingCommand) : [],
    [activePanel, pendingCommand, project],
  )
  const pendingReview = useMemo(() => {
    if (activePanel !== 'changes' || !pendingCommand) {
      return null
    }

    const command = commandFromSerialized(pendingCommand)
    const impact = command.describeImpact(project)
    const validation = command.validate(project)

    const affectedRowCount = pendingCommand.type === 'DeleteTable'
      ? rowsByTable[pendingCommand.tableId]?.length ?? 0
      : 0

    return { command, impact, validation, affectedRowCount }
  }, [activePanel, pendingCommand, project, rowsByTable])
  const pendingWorkbookReview = useMemo(() => {
    if (activePanel !== 'changes' || !pendingDocumentTransaction) return null
    const transaction = pendingDocumentTransactionFromSerialized(pendingDocumentTransaction)
    return {
      transaction,
      confirmations: transaction.requiredConfirmations(document),
      errors: transaction.validate(document),
    }
  }, [activePanel, document, pendingDocumentTransaction])

  return (
    <section className="bottom-panel" aria-label="워크벤치 세부 패널">
      <div className="panel-tabs">
        {panels.map((panel) => {
          const Icon = panel.icon

          return (
            <button
              key={panel.id}
              className={activePanel === panel.id ? 'panel-tab active' : 'panel-tab'}
              type="button"
              onClick={() => setBottomPanel(panel.id)}
            >
              <Icon aria-hidden="true" size={15} />
              <span>{panel.label}</span>
            </button>
          )
        })}
        <button className="panel-close" type="button" title="패널 닫기" onClick={() => setBottomPanel('closed')}>
          <X aria-hidden="true" size={15} />
        </button>
      </div>
      <div className="panel-content">
        {activePanel === 'problems' && (
          <div className="issue-list">
            {issues.map((issue) => (
              <button
                className={`issue-row ${issue.severity}`}
                key={issue.issueId}
                type="button"
                onClick={() => {
                  const tableId = issue.tableIds[0]
                  if (tableId) {
                    selectTable(tableId)
                    setMainView(issue.rowIndices && issue.rowIndices.length > 0 ? 'data' : 'schema')
                  }
                }}
              >
                <strong>{issue.title}</strong>
                <span>{issue.message}</span>
                {issue.rowIndices && issue.rowIndices.length > 0 && (
                  <small>{issue.rowIndices.map((rowIndex) => `${rowIndex + 1}행`).join(', ')}</small>
                )}
                <small>{issue.suggestedFix}</small>
              </button>
            ))}
            {issues.length === 0 && <div className="empty-state">스키마 또는 샘플 데이터 문제가 없습니다.</div>}
          </div>
        )}
        {activePanel === 'changes' && (
          <div className="review-list">
            {pendingReview ? (
              <div className="review-card">
                <strong>{pendingReview.command.describe(project)}</strong>
                <span>{pendingReview.impact.summary}</span>
                <div className="review-grid">
                  <small>테이블 {pendingReview.impact.affectedTableIds.length}개</small>
                  <small>열 {pendingReview.impact.affectedColumnIds.length}개</small>
                  {pendingCommand?.type === 'DeleteTable' && <small>행 {pendingReview.affectedRowCount}개</small>}
                  <small>관계 {pendingReview.impact.affectedRelationIds.length}개</small>
                  <small>출력 {pendingReview.impact.affectedExportViewIds.length}개</small>
                </div>
                {pendingReview.impact.existingDataRisk.map((risk) => (
                  <small key={risk}>{risk}</small>
                ))}
                {pendingReview.validation.issues.map((issue) => (
                  <small className={`review-issue ${issue.severity}`} key={issue.issueId}>{issue.title}: {issue.message}</small>
                ))}
                <DataConversionPlans plans={migrations} />
                <div className="review-actions">
                  <button className="secondary-action" type="button" onClick={clearPendingCommand}>취소</button>
                  <button className="primary-action" type="button" onClick={() => applyPendingCommand({ approveDestructive: true })}>검토 후 적용</button>
                </div>
              </div>
            ) : pendingWorkbookReview ? (
              <div className="review-card">
                <strong>{pendingWorkbookReview.transaction.summary}</strong>
                <span>{pendingDocumentTransaction?.type === 'ApplyWorkbookRange' ? '헤더 이름 변경과 데이터 입력을 하나의 작업으로 적용합니다.' : '헤더 이름과 데이터 값 변경을 하나의 작업으로 적용합니다.'}</span>
                {pendingWorkbookReview.confirmations.map((confirmation) => (
                  <small key={confirmation}>{confirmation}</small>
                ))}
                {pendingWorkbookReview.errors.map((error) => (
                  <small className="review-issue blocking" key={error}>{error}</small>
                ))}
                <div className="review-actions">
                  <button className="secondary-action" type="button" onClick={clearPendingCommand}>취소</button>
                  <button className="primary-action" type="button" disabled={pendingWorkbookReview.errors.length > 0} onClick={() => applyPendingCommand({ approveDestructive: true })}>검토 후 적용</button>
                </div>
              </div>
            ) : (
              <div className="compact-list">
                <strong>변경 검토 대기열</strong>
                <span>파괴적 명령과 AI 제안은 실행 전에 이 패널에서 확인합니다.</span>
                <span>이번 세션 명령 기록 {project.commandHistory.length}개</span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function DataConversionPlans({ plans }: { readonly plans: readonly MigrationPlan[] }) {
  if (plans.length === 0) return null

  return (
    <section className="data-conversion-plans" aria-label="데이터 변환 계획">
      <div className="data-conversion-heading">
        <ListChecks aria-hidden="true" size={16} />
        <div>
          <strong>데이터 변환 계획</strong>
          <span>기존 행을 안전하게 유지하기 위한 단계입니다.</span>
        </div>
      </div>
      {plans.map((migration) => (
        <details key={migration.planId}>
          <summary>{migration.summary}</summary>
          <div className="data-conversion-detail">
            {migration.steps.map((step) => (
              <div className="migration-step" key={`${migration.planId}-${step.stepId}`}>
                <span>{step.title}</span>
                <small>{step.description}</small>
              </div>
            ))}
            <small>{migration.rollbackStrategy}</small>
            <small>{migrationCanRollback(migration) ? '전체 단계를 실행 취소할 수 있습니다.' : '일부 단계는 수동 복구가 필요합니다.'}</small>
          </div>
        </details>
      ))}
    </section>
  )
}
