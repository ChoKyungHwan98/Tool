import { describe, expect, it } from 'vitest'
import { crowdProject } from './sampleProject'
import { parseProject, safeParseProject } from './schemaValidation'

describe('schemaValidation', () => {
  it('parses the sample project persistence shape', () => {
    expect(parseProject(crowdProject).projectId).toBe(crowdProject.projectId)
  })

  it('rejects malformed persisted projects', () => {
    const result = safeParseProject({
      ...crowdProject,
      tables: [
        {
          ...crowdProject.tables[0],
          columns: [
            {
              ...crowdProject.tables[0]?.columns[0],
              name: '',
            },
          ],
        },
      ],
    })

    expect(result.success).toBe(false)
  })
})
