import { describe, expect, it } from 'vitest'
import { commandFromSerialized, materializeCommandForUndo, RenameColumnCommand } from '../domain/commands'
import { findColumn, requireTable } from '../domain/projectQueries'
import { crowdProject, sampleIds } from '../domain/sampleProject'
import type { DataRow, SchemaProject } from '../domain/schema'
import { validateRows } from '../domain/validator'
import { deserializeDocument, serializeDocument } from '../infrastructure/projectPersistence'
import { serializeTableRowsToCsv } from './csvImportExport'
import { exportRuntimeView } from './exportRuntime'
import { createWorkbenchDocument, replaceDocumentSchema } from './workbenchDocument'

const renamedColumnName = 'RuleKey'

function ruleIdColumnId(project: SchemaProject): string {
  const table = requireTable(project, sampleIds.rule)
  const column = findColumn(table, 'column_rule_id')

  if (!column) {
    throw new Error('Audit fixture could not find RuleId column.')
  }

  return column.columnId
}

function renameRuleId(project: SchemaProject): SchemaProject {
  return new RenameColumnCommand({
    tableId: sampleIds.rule,
    columnId: ruleIdColumnId(project),
    nextName: renamedColumnName,
  }).execute(project)
}

function populatedRuleRow(rowId = 'row_audit_rule_001'): DataRow {
  return {
    rowId,
    cells: {
      column_rule_id: 'audit_rule_001',
      column_rule_profile_id: 'profile_home_default',
      column_event_type_id: 'goal',
      column_audience_side: 'Home',
      column_participation_rate: 0.95,
      column_delay_min: 0.1,
      column_delay_max: 0.6,
      column_duration_min: 5,
      column_duration_max: 8,
      column_priority: 100,
    },
  }
}

describe('external audit regression contract', () => {
  it('A. keeps populated cell values under the same ColumnId after RenameColumn', () => {
    const project = renameRuleId(crowdProject)
    const row = populatedRuleRow()

    expect(project.tables.flatMap((table) => table.columns).find((column) => column.columnId === ruleIdColumnId(project))?.name).toBe(renamedColumnName)
    expect(row.cells[ruleIdColumnId(project)]).toBe('audit_rule_001')
  })

  it('B. exports renamed CSV headers without dropping populated values', () => {
    const project = renameRuleId(crowdProject)
    const table = requireTable(project, sampleIds.rule)
    const csv = serializeTableRowsToCsv(table, [populatedRuleRow()])

    expect(csv.split('\n')[0]).toContain(renamedColumnName)
    expect(csv).toContain('audit_rule_001')
  })

  it('C. validates renamed populated rows without treating the renamed column as blank', () => {
    const project = renameRuleId(crowdProject)
    const issues = validateRows(project, { [sampleIds.rule]: [populatedRuleRow()] })

    expect(issues.some((issue) => issue.columnIds.includes(ruleIdColumnId(project)) && issue.severity === 'error')).toBe(false)
  })

  it('D. exports runtime values from ColumnId lineage after RenameColumn', () => {
    const project = renameRuleId(crowdProject)
    const view = project.exportViews[0]
    const result = exportRuntimeView(project, view, { [sampleIds.rule]: [populatedRuleRow()] })

    expect(result.lineage.find((item) => item.columnId === ruleIdColumnId(project))?.columnName).toBe(renamedColumnName)
    expect(result.rows[0]?.RuleId).toBe('audit_rule_001')
  })

  it('E. reopens saved documents with row data still present', () => {
    const project = renameRuleId(crowdProject)
    const document = createWorkbenchDocument(project, { [sampleIds.rule]: [populatedRuleRow()] })
    const result = deserializeDocument(serializeDocument(document))

    expect(result.ok).toBe(true)
    expect(result.document?.rowsByTable[sampleIds.rule]?.[0]?.cells.column_rule_id).toBe('audit_rule_001')
  })

  it('F. preserves populated values through undo and redo without duplicate audit events', () => {
    const document = createWorkbenchDocument(crowdProject, { [sampleIds.rule]: [populatedRuleRow()] })
    const undoable = materializeCommandForUndo(
      document.schema,
      new RenameColumnCommand({
        tableId: sampleIds.rule,
        columnId: ruleIdColumnId(document.schema),
        nextName: renamedColumnName,
      }),
    )
    const command = commandFromSerialized(undoable)
    const renamed = replaceDocumentSchema(document, command.execute(document.schema))
    const undone = replaceDocumentSchema(renamed, command.undo(renamed.schema))
    const redone = replaceDocumentSchema(undone, command.execute(undone.schema))

    expect(redone.rowsByTable[sampleIds.rule]?.[0]?.cells.column_rule_id).toBe('audit_rule_001')
    expect(redone.auditLog.map((event) => event.auditEventId)).toHaveLength(new Set(redone.auditLog.map((event) => event.auditEventId)).size)
  })

  it('G. migrates unambiguous legacy name-keyed rows to ColumnId-keyed rows', () => {
    const result = deserializeDocument(JSON.stringify({
      schema: crowdProject,
      rowsByTable: {
        [sampleIds.rule]: [
          {
            RuleId: 'legacy_rule',
            ProfileId: 'profile_home_default',
            EventTypeId: 'goal',
            AudienceSide: 'Home',
            ParticipationRate: 0.95,
            DelayMin: 0.1,
            DelayMax: 0.6,
            DurationMin: 5,
            DurationMax: 8,
            Priority: 100,
          },
        ],
      },
    }))

    expect(result.ok).toBe(true)
    expect(result.document?.rowsByTable[sampleIds.rule]?.[0]?.cells.column_rule_id).toBe('legacy_rule')
  })

  it('H. blocks ambiguous legacy migration instead of guessing a column', () => {
    const ruleTable = requireTable(crowdProject, sampleIds.rule)
    const duplicatedRuleIdProject = {
      ...crowdProject,
      tables: crowdProject.tables.map((table) =>
        table.tableId === sampleIds.rule
          ? {
            ...table,
            columns: [
              ...table.columns,
              {
                ...ruleTable.columns[0],
                columnId: 'column_rule_id_duplicate',
              },
            ],
          }
          : table,
      ),
    }
    const result = deserializeDocument(JSON.stringify({
      schema: duplicatedRuleIdProject,
      rowsByTable: {
        [sampleIds.rule]: [{ RuleId: 'ambiguous_rule' }],
      },
    }))

    expect(result.ok).toBe(false)
    expect(result.migrationIssues?.some((issue) => issue.includes('multiple columns'))).toBe(true)
  })
})
