import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../domain/emptyProject'
import { crowdProject } from '../domain/sampleProject'
import { compileAiProposalCommands } from './aiProposalCommands'
import { MockAiProvider } from './mockAiProvider'

describe('compileAiProposalCommands', () => {
  it('converts a linked export draft into a validated typed Command', async () => {
    const proposal = await new MockAiProvider().proposeSchema({ project: crowdProject, prompt: 'Review export' })
    const candidates = compileAiProposalCommands(crowdProject, proposal)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.command.type).toBe('ModifyExportView')
    expect(candidates[0]!.command.validate(crowdProject).ok).toBe(true)
    expect(candidates[0]!.command.preview(crowdProject).exportViews[0]!.columns.length)
      .toBe(crowdProject.exportViews[0]!.columns.length + 1)
  })

  it('creates local immutable IDs for an approved new-table draft', async () => {
    const project = createEmptyProject('AI Structure')
    const proposal = await new MockAiProvider().proposeSchema({ project, prompt: 'Create a table' })
    const candidates = compileAiProposalCommands(project, proposal)
    const preview = candidates[0]!.command.preview(project)

    expect(candidates[0]!.command.type).toBe('CreateTable')
    expect(preview.tables[0]!.columns).toHaveLength(2)
    expect(preview.tables[0]!.primaryKey.columnIds).toEqual([preview.tables[0]!.columns[0]!.columnId])
    expect(preview.tables[0]!.columns.every((column) => column.tableId === preview.tables[0]!.tableId)).toBe(true)
  })
})
