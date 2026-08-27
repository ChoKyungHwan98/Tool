import { describe, expect, it } from 'vitest'
import { crowdProject } from '../domain/sampleProject'
import { MockAiProvider } from './mockAiProvider'

describe('MockAiProvider', () => {
  it('links every schema proposal to stable schema IDs', async () => {
    const proposal = await new MockAiProvider().proposeSchema({ project: crowdProject, prompt: 'Review structure' })
    const knownTableIds = new Set(crowdProject.tables.map((table) => table.tableId))
    const knownColumnIds = new Set(crowdProject.tables.flatMap((table) => table.columns.map((column) => column.columnId)))
    const knownRelationIds = new Set(crowdProject.relations.map((relation) => relation.relationId))

    expect(proposal.tableIds.length).toBe(crowdProject.tables.length)
    expect(proposal.tableIds.every((tableId) => knownTableIds.has(tableId))).toBe(true)
    expect(proposal.columnIds.every((columnId) => knownColumnIds.has(columnId))).toBe(true)
    expect(proposal.relationIds.every((relationId) => knownRelationIds.has(relationId))).toBe(true)
  })
})
