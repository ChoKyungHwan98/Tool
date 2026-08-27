import { describe, expect, it } from 'vitest'
import { createWorkbenchDocument } from '../application/workbenchDocument'
import { crowdProject, crowdSampleRows } from '../domain/sampleProject'
import { tableArtifactRecords } from './studioArtifact'

describe('table studio artifact', () => {
  it('publishes native table fields and sample rows for traceable deck references', () => {
    const document = createWorkbenchDocument(crowdProject, crowdSampleRows)
    const records = tableArtifactRecords(document)
    expect(records.length).toBe(crowdProject.tables.length)
    expect(records[0]?.data.columns.length).toBeGreaterThan(0)
    expect(records[0]?.data.rows).toBeDefined()
  })
})
