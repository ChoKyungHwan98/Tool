import { describe, expect, it } from 'vitest'
import { findTable } from '../domain/projectQueries'
import { crowdProject, crowdSampleRows, sampleIds } from '../domain/sampleProject'
import { exportRuntimeView, toCsv } from './exportRuntime'

describe('exportRuntimeView', () => {
  it('generates runtime rows from an export view', () => {
    const view = crowdProject.exportViews[0]
    const result = exportRuntimeView(crowdProject, view, crowdSampleRows)

    expect(result.fileName).toBe('CrowdReactionRuntime.csv')
    expect(result.headers).toContain('RuleId')
    expect(result.rows[0]?.RuleId).toBe('goal_home_high')
  })

  it('escapes CSV formula-like values', () => {
    const view = crowdProject.exportViews[0]
    const result = {
      ...exportRuntimeView(crowdProject, view, crowdSampleRows),
      headers: ['RuleId'],
      rows: [{ RuleId: '=cmd' }],
    }

    expect(toCsv(result)).toContain("'=cmd")
  })

  it('flattens lookup values through FK relation paths', () => {
    const ruleTable = findTable(crowdProject, sampleIds.rule)
    const eventTypeTable = findTable(crowdProject, sampleIds.eventType)
    const displayNameColumn = eventTypeTable?.columns.find((column) => column.name === 'DisplayName')

    const result = exportRuntimeView(
      crowdProject,
      {
        viewId: 'export_rule_event_display',
        name: 'RuleEventDisplay',
        displayName: 'Rule event display',
        description: '',
        format: 'csv',
        rootTableId: sampleIds.rule,
        columns: [
          {
            exportColumnId: 'export_event_display_name',
            sourceTableId: sampleIds.eventType,
            sourceColumnId: displayNameColumn?.columnId ?? 'missing',
            header: 'EventDisplayName',
            transform: 'copy',
          },
        ],
      },
      {
        ...crowdSampleRows,
        [sampleIds.eventType]: [
          { rowId: 'row_event_goal', cells: { column_event_type_pk: 'goal', column_event_name: 'Goal' } },
          { rowId: 'row_event_foul', cells: { column_event_type_pk: 'foul', column_event_name: 'Foul' } },
        ],
      },
    )

    expect(ruleTable).toBeTruthy()
    expect(result.rows[0]?.EventDisplayName).toBe('Goal')
    expect(result.lineage[0]?.relationPath).toContain('relation_rule_event')
  })
})
