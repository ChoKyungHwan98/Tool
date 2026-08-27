import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../domain/emptyProject'
import { createWorkbenchDocument } from './workbenchDocument'
import { applyImportPreview, createImportPreview, type RawImportSheet } from './importPreview'

const sheets: readonly RawImportSheet[] = [
  {
    sourceName: 'ItemBox.xlsx',
    sheetName: 'Item',
    rows: [
      ['ItemId', 'Name', 'Price'],
      ['item_1', 'Potion', 100],
      ['item_2', 'Sword', 500],
    ],
  },
  {
    sourceName: 'ItemBox.xlsx',
    sheetName: 'ItemBox',
    rows: [
      ['ItemBoxId', 'ItemId', 'Count'],
      ['box_1', 'item_1', 2],
      ['box_2', 'item_2', 1],
    ],
  },
]

describe('Excel/CSV import preview', () => {
  it('creates table, type, PK and FK candidates without approving the relation', () => {
    const preview = createImportPreview(sheets)

    expect(preview.tables).toHaveLength(2)
    expect(preview.tables[0]?.columns.map((column) => column.dataType.kind)).toEqual(['string', 'string', 'int32'])
    expect(preview.tables[0]?.primaryKeyColumnIds).toHaveLength(1)
    expect(preview.relationCandidates).toHaveLength(1)
    expect(preview.relationCandidates[0]?.name).toContain('ItemId')
  })

  it('applies all tables atomically and only creates explicitly approved relations', () => {
    const project = createEmptyProject('Import Test')
    const document = createWorkbenchDocument(project)
    const preview = createImportPreview(sheets, project)

    const withoutRelations = applyImportPreview(document, preview, { approvedRelationCandidateIds: [] })
    expect(withoutRelations.schema.tables).toHaveLength(2)
    expect(withoutRelations.schema.relations).toHaveLength(0)
    expect(Object.values(withoutRelations.rowsByTable).map((rows) => rows.length)).toEqual([2, 2])

    const withRelations = applyImportPreview(document, preview, {
      approvedRelationCandidateIds: preview.relationCandidates.map((relation) => relation.candidateId),
    })
    expect(withRelations.schema.relations).toHaveLength(1)
  })
})
