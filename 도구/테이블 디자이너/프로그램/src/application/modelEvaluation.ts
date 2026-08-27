import { MockAiProvider, type AiProvider, type SchemaProposal } from './mockAiProvider'
import { defaultOpenRouterSettings, isFreeOpenRouterModel, type OpenRouterModel } from './openRouterProvider'
import type { SchemaProject } from '../domain/schema'

export interface EvaluationCase {
  readonly caseId: string
  readonly title: string
  readonly prompt: string
  readonly expectedSignals: readonly string[]
}

export interface EvaluationResult {
  readonly caseId: string
  readonly title: string
  readonly passed: boolean
  readonly score: number
  readonly notes: readonly string[]
}

export interface ModelEvaluationReport {
  readonly modelId: string
  readonly generatedAt: string
  readonly freeModelOnly: boolean
  readonly rowDataSent: boolean
  readonly results: readonly EvaluationResult[]
  readonly averageScore: number
}

export const defaultEvaluationCases: readonly EvaluationCase[] = [
  evaluationCase('repeated-columns', 'Repeated columns', 'Find repeated column groups.', ['repeated', 'child table']),
  evaluationCase('multi-value-cell', 'Multi-value cell', 'Detect multiple IDs packed into one cell.', ['1NF', 'split']),
  evaluationCase('partial-dependency', 'Partial dependency', 'Review composite primary key dependencies.', ['partial', 'composite']),
  evaluationCase('transitive-dependency', 'Transitive dependency', 'Find lookup data stored on the wrong table.', ['lookup', 'dependency']),
  evaluationCase('bcnf-determinant', 'BCNF determinant', 'Find determinants that are not candidate keys.', ['determinant']),
  evaluationCase('multivalued-dependency', 'Multivalued dependency', 'Review independent multi-value sets.', ['4NF', 'junction']),
  evaluationCase('composite-pk-choice', 'Composite PK choice', 'Compare composite key and surrogate key options.', ['primary key']),
  evaluationCase('foreign-key-integrity', 'FK integrity', 'Check FK target risks.', ['foreign', 'target']),
  evaluationCase('enum-safety', 'Enum safety', 'Review enum columns and invalid enum risks.', ['enum']),
  evaluationCase('required-column-migration', 'Required column migration', 'Plan a required column addition.', ['nullable', 'backfill']),
  evaluationCase('column-type-change', 'Column type change', 'Plan a column type conversion.', ['shadow', 'convert']),
  evaluationCase('table-split-impact', 'Table split impact', 'Explain table split impact.', ['split', 'relation']),
  evaluationCase('table-merge-impact', 'Table merge impact', 'Explain table merge risks.', ['merge', 'rollback']),
  evaluationCase('runtime-export-lineage', 'Runtime export lineage', 'Explain runtime export lineage.', ['export', 'lineage']),
  evaluationCase('naming-review', 'Naming review', 'Review column naming consistency.', ['name']),
  evaluationCase('privacy-filter', 'Privacy filter', 'Avoid sending row data.', ['schema', 'row data']),
  evaluationCase('invalid-ai-command', 'Invalid AI command', 'Reject operations that reference missing IDs.', ['validate']),
  evaluationCase('korean-explanation', 'Designer language', 'Explain issues in designer-friendly language.', ['designer']),
]

function evaluationCase(caseId: string, title: string, prompt: string, expectedSignals: readonly string[]): EvaluationCase {
  return { caseId, title, prompt, expectedSignals }
}

export async function runModelEvaluation(input: {
  readonly project: SchemaProject
  readonly provider?: AiProvider
  readonly model?: OpenRouterModel
  readonly generatedAt?: string
  readonly cases?: readonly EvaluationCase[]
}): Promise<ModelEvaluationReport> {
  const provider = input.provider ?? new MockAiProvider()
  const cases = input.cases ?? defaultEvaluationCases
  const freeModelOnly = input.model ? isFreeOpenRouterModel(input.model) : defaultOpenRouterSettings.freeModelsOnly
  const results: EvaluationResult[] = []

  for (const evaluation of cases) {
    const proposal = await provider.proposeSchema({ project: input.project, prompt: evaluation.prompt })
    results.push(scoreProposal(evaluation, proposal))
  }

  const averageScore = results.length === 0
    ? 0
    : results.reduce((sum, result) => sum + result.score, 0) / results.length

  return {
    modelId: input.model?.id ?? 'mock-ai-provider',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    freeModelOnly,
    rowDataSent: false,
    results,
    averageScore,
  }
}

export function renderEvaluationReportMarkdown(report: ModelEvaluationReport): string {
  return [
    `# Model Evaluation Report - ${report.modelId}`,
    '',
    `Generated: ${report.generatedAt}`,
    `Free model only: ${report.freeModelOnly ? 'yes' : 'no'}`,
    `Row data sent: ${report.rowDataSent ? 'yes' : 'no'}`,
    `Average score: ${report.averageScore.toFixed(2)}`,
    '',
    '| Case | Score | Result | Notes |',
    '| --- | ---: | --- | --- |',
    ...report.results.map((result) =>
      `| ${result.title} | ${result.score.toFixed(2)} | ${result.passed ? 'pass' : 'review'} | ${result.notes.join('; ')} |`,
    ),
    '',
  ].join('\n')
}

function scoreProposal(evaluation: EvaluationCase, proposal: SchemaProposal): EvaluationResult {
  const haystack = [
    proposal.summary,
    ...proposal.assumptions,
    ...proposal.alternatives,
    ...proposal.proposedOperations,
    ...proposal.migrationPlan,
    ...proposal.risks,
  ].join(' ').toLowerCase()

  const matchedSignals = evaluation.expectedSignals.filter((signal) => haystack.includes(signal.toLowerCase()))
  const structuredScore = proposal.summary.trim().length > 0 ? 0.35 : 0
  const confidenceScore = Math.min(0.25, Math.max(0, proposal.confidence) * 0.25)
  const signalScore = evaluation.expectedSignals.length === 0 ? 0.4 : (matchedSignals.length / evaluation.expectedSignals.length) * 0.4
  const score = structuredScore + confidenceScore + signalScore

  return {
    caseId: evaluation.caseId,
    title: evaluation.title,
    passed: score >= 0.55,
    score,
    notes: matchedSignals.length > 0 ? [`matched: ${matchedSignals.join(', ')}`] : ['expected signals need manual review'],
  }
}
