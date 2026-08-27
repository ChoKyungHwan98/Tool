import { describe, expect, it } from 'vitest'
import { crowdProject } from '../domain/sampleProject'
import { describeRelationMapping } from './relationMapping'

describe('relationMapping', () => {
  it('resolves a relation to a readable source-to-target label', () => {
    const relation = crowdProject.relations[0]
    expect(relation).toBeTruthy()

    const label = describeRelationMapping(crowdProject, relation!)

    expect(label.sourceTableName).toBeTruthy()
    expect(label.targetTableName).toBeTruthy()
    expect(label.text).toContain(' → ')
    expect(label.sourceColumnNames.length).toBe(relation!.sourceColumnIds.length)
    expect(label.targetColumnNames.length).toBe(relation!.targetColumnIds.length)
  })

  it('keeps missing IDs visible instead of hiding a broken mapping', () => {
    const relation = { ...crowdProject.relations[0]!, sourceColumnIds: ['missing_column'] }

    expect(describeRelationMapping(crowdProject, relation).text).toContain('missing_column')
  })
})
