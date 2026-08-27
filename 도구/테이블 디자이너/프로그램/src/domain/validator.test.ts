import { describe, expect, it } from 'vitest'
import { findTable } from './projectQueries'
import { crowdProject, crowdSampleRows, sampleIds } from './sampleProject'
import { validateProject, validateProjectWithRows, validateRows } from './validator'

describe('validateProject', () => {
  it('accepts the crowd sample without blocking issues', () => {
    const issues = validateProject(crowdProject)

    expect(issues.filter((issue) => issue.severity === 'blocking')).toHaveLength(0)
  })

  it('blocks relations that point at missing columns', () => {
    const project = {
      ...crowdProject,
      relations: [
        {
          ...crowdProject.relations[0],
          sourceColumnIds: ['column_missing'],
        },
      ],
    }

    const issues = validateProject(project)

    expect(issues.some((issue) => issue.relationIds.includes(crowdProject.relations[0]?.relationId ?? ''))).toBe(true)
  })

  it('blocks duplicate internal column IDs', () => {
    const [firstTable, secondTable] = crowdProject.tables
    const duplicateColumnId = firstTable?.columns[0]?.columnId

    const project = {
      ...crowdProject,
      tables: crowdProject.tables.map((table) =>
        table.tableId === secondTable?.tableId
          ? {
            ...table,
            columns: table.columns.map((column, index) =>
              index === 0 && duplicateColumnId
                ? { ...column, columnId: duplicateColumnId }
                : column,
            ),
          }
          : table,
      ),
    }

    const issues = validateProject(project)

    expect(issues.some((issue) => issue.columnIds.includes(duplicateColumnId ?? ''))).toBe(true)
  })

  it('blocks columns whose tableId does not match the parent table', () => {
    const table = crowdProject.tables[0]

    const project = {
      ...crowdProject,
      tables: crowdProject.tables.map((candidate) =>
        candidate.tableId === table?.tableId
          ? {
            ...candidate,
            columns: candidate.columns.map((column, index) =>
              index === 0 ? { ...column, tableId: 'table_other' } : column,
            ),
          }
          : candidate,
      ),
    }

    const issues = validateProject(project)

    expect(issues.some((issue) => issue.tableIds.includes('table_other'))).toBe(true)
  })

  it('warns when hard FK relations create a table cycle', () => {
    const profile = findTable(crowdProject, sampleIds.profile)
    const rule = findTable(crowdProject, sampleIds.rule)

    const project = {
      ...crowdProject,
      relations: [
        ...crowdProject.relations,
        {
          relationId: 'relation_profile_default_rule',
          name: 'Profile points back to default rule',
          kind: 'hard_fk' as const,
          sourceTableId: sampleIds.profile,
          sourceColumnIds: [profile?.primaryKey.columnIds[0] ?? 'missing'],
          targetTableId: sampleIds.rule,
          targetColumnIds: [rule?.primaryKey.columnIds[0] ?? 'missing'],
          required: true,
        },
      ],
    }

    const issues = validateProject(project)

    expect(issues.some((issue) => issue.severity === 'warning' && issue.relationIds.includes('relation_profile_default_rule'))).toBe(true)
  })

  it('warns for non-key functional dependencies that look transitive', () => {
    const rule = findTable(crowdProject, sampleIds.rule)
    const eventTypeColumn = rule?.columns.find((column) => column.name === 'EventTypeId')
    const priorityColumn = rule?.columns.find((column) => column.name === 'Priority')

    const project = {
      ...crowdProject,
      functionalDependencies: [
        ...crowdProject.functionalDependencies,
        {
          dependencyId: 'dependency_event_priority',
          tableId: sampleIds.rule,
          determinantColumnIds: [eventTypeColumn?.columnId ?? 'missing'],
          dependentColumnIds: [priorityColumn?.columnId ?? 'missing'],
          note: 'Test-only transitive dependency.',
        },
      ],
    }

    const issues = validateProject(project)

    expect(issues.some((issue) => issue.columnIds.includes(priorityColumn?.columnId ?? ''))).toBe(true)
  })
})

describe('validateRows', () => {
  it('accepts the loaded crowd sample rows', () => {
    const issues = validateProjectWithRows(crowdProject, crowdSampleRows)

    expect(issues.filter((issue) => issue.severity === 'error' || issue.severity === 'blocking')).toHaveLength(0)
  })

  it('finds required blanks and wrong cell types', () => {
    const firstRule = crowdSampleRows[sampleIds.rule]?.[0]
    const issues = validateRows(crowdProject, {
      ...crowdSampleRows,
      [sampleIds.rule]: firstRule
        ? [
          {
            ...firstRule,
            cells: {
              ...firstRule.cells,
              column_rule_id: '',
              column_priority: 'urgent',
            },
          },
        ]
        : [],
    })

    expect(issues.some((issue) => issue.columnIds.includes('column_rule_id') && issue.severity === 'error')).toBe(true)
    expect(issues.some((issue) => issue.columnIds.includes('column_priority') && issue.severity === 'error')).toBe(true)
  })

  it('does not flag an entirely empty workbook row', () => {
    const table = findTable(crowdProject, sampleIds.rule)
    const emptyRow = {
      rowId: 'row_empty_canvas',
      cells: Object.fromEntries((table?.columns ?? []).map((column) => [column.columnId, null])),
    }

    const issues = validateRows(crowdProject, {
      ...crowdSampleRows,
      [sampleIds.rule]: [emptyRow],
    })

    expect(issues.filter((issue) => issue.rowIndices?.includes(0))).toHaveLength(0)
  })

  it('finds duplicate primary keys', () => {
    const firstRule = crowdSampleRows[sampleIds.rule]?.[0]

    const issues = validateRows(crowdProject, {
      ...crowdSampleRows,
      [sampleIds.rule]: firstRule
        ? [firstRule, { ...firstRule, rowId: 'row_duplicate_rule', cells: { ...firstRule.cells, column_priority: 101 } }]
        : [],
    })

    expect(issues.some((issue) => issue.columnIds.includes('column_rule_id') && issue.severity === 'error')).toBe(true)
  })

  it('finds orphan foreign keys when target rows are loaded', () => {
    const issues = validateRows(crowdProject, {
      ...crowdSampleRows,
      [sampleIds.eventType]: [
        {
          rowId: 'row_event_goal',
          cells: {
            column_event_type_pk: 'goal',
            column_event_name: 'Goal',
          },
        },
      ],
    })

    expect(issues.some((issue) => issue.relationIds.includes('relation_rule_event') && issue.severity === 'error')).toBe(true)
  })

  it('finds functional dependency conflicts in row data', () => {
    const issues = validateRows(crowdProject, {
      ...crowdSampleRows,
      [sampleIds.animation]: [
        {
          rowId: 'row_animation_cheer_a',
          cells: {
            column_animation_pk: 'cheer',
            column_resource_path: 'animations/cheer_a.anim',
            column_loop_type: 'Once',
            column_animation_duration: 1.2,
          },
        },
        {
          rowId: 'row_animation_cheer_b',
          cells: {
            column_animation_pk: 'cheer',
            column_resource_path: 'animations/cheer_b.anim',
            column_loop_type: 'Once',
            column_animation_duration: 1.2,
          },
        },
      ],
    })

    expect(issues.some((issue) => issue.columnIds.includes('column_resource_path') && issue.severity === 'warning')).toBe(true)
  })
})
