import { describe, expect, it } from 'vitest'
import { crowdProject } from '../domain/sampleProject'
import { defaultEvaluationCases, renderEvaluationReportMarkdown, runModelEvaluation } from './modelEvaluation'

describe('modelEvaluation', () => {
  it('contains the requested minimum evaluation coverage', () => {
    expect(defaultEvaluationCases).toHaveLength(18)
  })

  it('runs a local model evaluation without row data', async () => {
    const report = await runModelEvaluation({
      project: crowdProject,
      generatedAt: '2026-06-27T00:00:00.000Z',
      cases: defaultEvaluationCases.slice(0, 3),
    })

    expect(report.modelId).toBe('mock-ai-provider')
    expect(report.rowDataSent).toBe(false)
    expect(report.results).toHaveLength(3)
  })

  it('renders a markdown report', async () => {
    const report = await runModelEvaluation({
      project: crowdProject,
      generatedAt: '2026-06-27T00:00:00.000Z',
      cases: defaultEvaluationCases.slice(0, 1),
    })

    expect(renderEvaluationReportMarkdown(report)).toContain('| Case | Score | Result | Notes |')
  })
})
