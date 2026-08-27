import { describe, expect, it } from 'vitest'
import { createWorkbenchDocument } from '../application/workbenchDocument'
import { crowdProject, crowdSampleRows, sampleIds } from '../domain/sampleProject'
import { deserializeDocument, deserializeProject, serializeDocument, serializeProject } from './projectPersistence'

describe('projectPersistence', () => {
  it('round-trips a project through JSON validation', () => {
    const result = deserializeProject(serializeProject(crowdProject))

    expect(result.ok).toBe(true)
    expect(result.project?.projectId).toBe(crowdProject.projectId)
  })

  it('returns a safe error for invalid project JSON', () => {
    const result = deserializeProject('{ "name": "Broken" }')

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('round-trips a full WorkbenchDocument with rows', () => {
    const document = createWorkbenchDocument(crowdProject, crowdSampleRows, {
      workbookViews: {
        [sampleIds.rule]: {
          columnWidths: { column_rule_id: 220 },
          hiddenColumnIds: [],
          frozenColumnIds: ['column_rule_id'],
          sorting: [{ columnId: 'column_priority_id', descending: true }],
          filters: [{ columnId: 'column_rule_id', operator: 'contains', value: 'goal' }],
        },
      },
    })
    const result = deserializeDocument(serializeDocument(document))

    expect(result.ok).toBe(true)
    expect(result.document?.rowsByTable[sampleIds.rule]?.[0]?.cells.column_rule_id).toBe('goal_home_high')
    expect(result.document?.workbookViews[sampleIds.rule]?.columnWidths.column_rule_id).toBe(220)
  })

  it('opens a format v1 document with an empty workbook view state', () => {
    const document = createWorkbenchDocument(crowdProject, crowdSampleRows)
    const legacy: Record<string, unknown> = { ...document, formatVersion: 1 }
    delete legacy.workbookViews

    const result = deserializeDocument(JSON.stringify(legacy))

    expect(result.ok).toBe(true)
    expect(result.document?.formatVersion).toBe(2)
    expect(result.document?.workbookViews).toEqual({})
  })

  it('rejects a document from a future format instead of silently downgrading it', () => {
    const document = createWorkbenchDocument(crowdProject, crowdSampleRows)
    const future: Record<string, unknown> = { ...document, formatVersion: 999 }

    const result = deserializeDocument(JSON.stringify(future))

    expect(result.ok).toBe(false)
    expect(result.error).toContain('더 새로운 형식')
  })
})
