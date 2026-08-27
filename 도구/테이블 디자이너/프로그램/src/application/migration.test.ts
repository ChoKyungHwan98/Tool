import { describe, expect, it } from 'vitest'
import { crowdProject, sampleIds } from '../domain/sampleProject'
import {
  migrationCanRollback,
  planBackfillMigration,
  planColumnTypeMigration,
  planMakeColumnRequiredMigration,
  planMergeTableMigration,
  planSplitTableMigration,
  previewBackfillRows,
} from './migration'

describe('migration planning', () => {
  it('plans rollback-safe column type migrations', () => {
    const plan = planColumnTypeMigration(crowdProject, sampleIds.rule, 'column_priority', { kind: 'int64' })

    expect(plan.requiresApproval).toBe(true)
    expect(plan.steps.map((step) => step.stepId)).toContain('step_create_shadow_column')
    expect(migrationCanRollback(plan)).toBe(true)
  })

  it('explains making an existing column required without calling it a new column', () => {
    const plan = planMakeColumnRequiredMigration(crowdProject, sampleIds.rule, 'column_participation_rate')

    expect(plan.summary).toContain('필수 열로 변경')
    expect(plan.summary).not.toContain('추가')
    expect(plan.steps.map((step) => step.stepId)).toContain('step_find_blanks')
    expect(migrationCanRollback(plan)).toBe(true)
  })

  it('plans split and merge migrations with approval', () => {
    const splitPlan = planSplitTableMigration(crowdProject, sampleIds.rule, ['column_participation_rate'], 'RuleParticipation')
    const mergePlan = planMergeTableMigration(crowdProject, sampleIds.eventType, sampleIds.action)

    expect(splitPlan.requiresApproval).toBe(true)
    expect(splitPlan.steps.at(-1)?.stepId).toBe('step_remove_source_columns')
    expect(mergePlan.requiresApproval).toBe(true)
    expect(mergePlan.steps.at(-1)?.stepId).toBe('step_remove_source_table')
  })

  it('previews fixed-default backfills without mutating nonblank rows', () => {
    const plan = planBackfillMigration(crowdProject, sampleIds.rule, 'column_priority', {
      kind: 'fixed_default',
      value: 10,
    })
    const rows = previewBackfillRows([
      { rowId: 'row_a', cells: { column_rule_id: 'a', column_priority: null } },
      { rowId: 'row_b', cells: { column_rule_id: 'b', column_priority: 5 } },
    ], 'column_priority', { kind: 'fixed_default', value: 10 })

    expect(plan.requiresApproval).toBe(false)
    expect(rows[0]?.cells.column_priority).toBe(10)
    expect(rows[1]?.cells.column_priority).toBe(5)
  })
})
