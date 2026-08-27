import { validateProject } from '../domain/validator'
import type { AiCommandDraft, AiProvider, SchemaProposal } from './mockAiProvider'
import type { EntityId, SchemaProject } from '../domain/schema'

export interface OpenRouterModelPricing {
  readonly prompt?: string
  readonly completion?: string
  readonly request?: string
  readonly image?: string
  readonly web_search?: string
  readonly internal_reasoning?: string
}

export interface OpenRouterModel {
  readonly id: string
  readonly name?: string
  readonly description?: string
  readonly context_length?: number
  readonly architecture?: {
    readonly input_modalities?: readonly string[]
    readonly output_modalities?: readonly string[]
  }
  readonly pricing?: OpenRouterModelPricing
  readonly supported_parameters?: readonly string[]
}

export interface OpenRouterCatalog {
  readonly models: readonly OpenRouterModel[]
  readonly freeModels: readonly OpenRouterModel[]
}

export interface OpenRouterSettings {
  readonly apiKey?: string
  readonly modelId?: string
  readonly freeModelsOnly: boolean
  readonly allowPaidFallback: boolean
  readonly sendRowData: boolean
  readonly requireStructuredOutput: boolean
}

export interface OpenRouterCompletionResponse {
  readonly choices?: readonly {
    readonly message?: {
      readonly content?: string
    }
  }[]
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export const defaultOpenRouterSettings: OpenRouterSettings = {
  freeModelsOnly: true,
  allowPaidFallback: false,
  sendRowData: false,
  requireStructuredOutput: true,
}

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim()

  if (trimmed.length <= 8) {
    return '****'
  }

  return `${trimmed.slice(0, 7)}...${trimmed.slice(-4)}`
}

export function isFreeOpenRouterModel(model: OpenRouterModel): boolean {
  const pricing = model.pricing

  if (!pricing) {
    return model.id.endsWith(':free')
  }

  return [
    pricing.prompt,
    pricing.completion,
    pricing.request,
    pricing.image,
    pricing.web_search,
    pricing.internal_reasoning,
  ].every((value) => value === undefined || Number(value) === 0)
}

/** 도구 호출을 지원하지 않는 모델을 고르면 테이블 생성이 조용히 실패한다. 목록 단계에서 걸러낸다. */
export function supportsToolCalls(model: OpenRouterModel): boolean {
  return (model.supported_parameters ?? []).includes('tools')
}

/** 100만 토큰당 가격(USD). 가격 정보가 없으면 null. */
export function pricePerMillionTokens(model: OpenRouterModel): { readonly prompt: number; readonly completion: number } | null {
  const prompt = Number(model.pricing?.prompt)
  const completion = Number(model.pricing?.completion)

  if (!Number.isFinite(prompt) || !Number.isFinite(completion)) {
    return null
  }

  return { prompt: prompt * 1_000_000, completion: completion * 1_000_000 }
}

export function assertOpenRouterPolicy(settings: OpenRouterSettings, model?: OpenRouterModel): void {
  if (settings.allowPaidFallback) {
    throw new Error('프로젝트 정책상 유료 모델 fallback은 비활성화되어 있습니다.')
  }

  // 행 데이터는 이제 사용자가 켰을 때만, 그리고 buildChatSystemPrompt가 앞 20행으로 잘라서만 나간다.
  // 상한이 프롬프트 생성 단계에서 구조적으로 강제되므로 여기서 전면 차단하지 않는다.
  // 스키마 검토 경로(proposeSchema)는 행을 전혀 쓰지 않으므로 켜져 있으면 막는다.
  if (settings.sendRowData && settings.requireStructuredOutput) {
    throw new Error('스키마 검토 요청에는 행 데이터를 함께 보낼 수 없습니다.')
  }

  if (settings.freeModelsOnly && model && !isFreeOpenRouterModel(model)) {
    throw new Error(`${model.id} 모델은 무료 OpenRouter 모델이 아니므로 사용할 수 없습니다.`)
  }
}

export async function fetchOpenRouterCatalog(input: {
  readonly apiKey?: string
  readonly fetchImpl?: typeof fetch
} = {}): Promise<OpenRouterCatalog> {
  const fetchImpl = input.fetchImpl ?? fetch
  const headers: Record<string, string> = {}

  if (input.apiKey?.trim()) {
    headers.Authorization = `Bearer ${input.apiKey.trim()}`
  }

  const response = await fetchImpl(`${OPENROUTER_BASE_URL}/models`, { headers })

  if (!response.ok) {
    throw new Error(`OpenRouter 모델 카탈로그 요청이 ${response.status} 상태로 실패했습니다.`)
  }

  const payload = await response.json() as { readonly data?: readonly OpenRouterModel[] }
  const models = payload.data ?? []

  return {
    models,
    freeModels: models.filter(isFreeOpenRouterModel),
  }
}

export function buildSchemaOnlyPrompt(project: SchemaProject, userPrompt: string): string {
  const schemaDigest = {
    project: project.name,
    schemaVersion: project.schemaVersion,
    tables: project.tables.map((table) => ({
      tableId: table.tableId,
      name: table.name,
      primaryKey: table.primaryKey.columnIds,
      columns: table.columns.map((column) => ({
        columnId: column.columnId,
        name: column.name,
        dataType: column.dataType,
        nullable: column.nullable,
      })),
    })),
    relations: project.relations.map((relation) => ({
      relationId: relation.relationId,
      kind: relation.kind,
      sourceTableId: relation.sourceTableId,
      sourceColumnIds: relation.sourceColumnIds,
      targetTableId: relation.targetTableId,
      targetColumnIds: relation.targetColumnIds,
      required: relation.required,
    })),
    exportViews: project.exportViews.map((view) => ({
      viewId: view.viewId,
      name: view.name,
      rootTableId: view.rootTableId,
      columns: view.columns.map((column) => ({
        sourceTableId: column.sourceTableId,
        sourceColumnId: column.sourceColumnId,
        header: column.header,
      })),
    })),
  }

  return [
    'You are reviewing a game data schema. Return compact JSON only.',
    'Always include tableIds, columnIds, and relationIds arrays using only IDs present in the schema digest.',
    'commandDrafts may contain only create_table or add_export_column drafts. create_table columns use string, int32, float, or boolean. add_export_column must use IDs from the digest.',
    'Do not suggest applying changes automatically.',
    `User request: ${userPrompt}`,
    `Schema digest: ${JSON.stringify(schemaDigest)}`,
  ].join('\n')
}

export class OpenRouterProvider implements AiProvider {
  private readonly settings: OpenRouterSettings
  private readonly fetchImpl: typeof fetch

  constructor(settings: OpenRouterSettings, fetchImpl: typeof fetch = fetch) {
    this.settings = settings
    this.fetchImpl = fetchImpl
  }

  async proposeSchema(input: { readonly project: SchemaProject; readonly prompt: string }): Promise<SchemaProposal> {
    const catalog = await fetchOpenRouterCatalog({ apiKey: this.settings.apiKey, fetchImpl: this.fetchImpl })
    const selectedModel = this.settings.modelId
      ? catalog.models.find((candidate) => candidate.id === this.settings.modelId)
      : undefined
    if (this.settings.modelId && !selectedModel) {
      throw new Error(`${this.settings.modelId} 모델이 현재 OpenRouter 카탈로그에 없습니다.`)
    }
    if (selectedModel) assertOpenRouterPolicy(this.settings, selectedModel)
    const model = selectedModel ?? [...catalog.freeModels].sort((left, right) => left.id.localeCompare(right.id))[0]

    if (!model) {
      throw new Error('이 요청에 사용할 수 있는 무료 OpenRouter 모델이 없습니다.')
    }

    assertOpenRouterPolicy(this.settings, model)

    const response = await this.fetchImpl(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.settings.apiKey?.trim() ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.id,
        messages: [
          {
            role: 'user',
            content: buildSchemaOnlyPrompt(input.project, input.prompt),
          },
        ],
        temperature: 0.2,
        response_format: this.settings.requireStructuredOutput ? { type: 'json_object' } : undefined,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenRouter completion 요청이 ${response.status} 상태로 실패했습니다.`)
    }

    const payload = await response.json() as OpenRouterCompletionResponse
    const content = payload.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('OpenRouter가 빈 응답을 반환했습니다.')
    }

    return parseSchemaProposal(content, input.project)
  }

  async reviewNormalization(input: { readonly project: SchemaProject }): Promise<SchemaProposal> {
    return this.proposeSchema({
      project: input.project,
      prompt: '정규화 문제를 검토하고 안전한 Command 단위 변경을 제안해줘.',
    })
  }

  async explainImpact(input: { readonly project: SchemaProject; readonly entityIds: readonly string[] }): Promise<SchemaProposal> {
    return this.proposeSchema({
      project: input.project,
      prompt: `다음 엔티티 ID의 영향을 설명해줘: ${input.entityIds.join(', ')}`,
    })
  }
}

function parseSchemaProposal(content: string, project: SchemaProject): SchemaProposal {
  try {
    const parsed = JSON.parse(content) as Partial<SchemaProposal>
    const findings = validateProject(project)
    const validTableIds = new Set(project.tables.map((table) => table.tableId))
    const validColumnIds = new Set(project.tables.flatMap((table) => table.columns.map((column) => column.columnId)))
    const validRelationIds = new Set(project.relations.map((relation) => relation.relationId))
    const tableIds = filterKnownIds(parsed.tableIds, validTableIds, findings.flatMap((finding) => finding.tableIds))
    const columnIds = filterKnownIds(parsed.columnIds, validColumnIds, findings.flatMap((finding) => finding.columnIds))
    const relationIds = filterKnownIds(parsed.relationIds, validRelationIds, findings.flatMap((finding) => finding.relationIds))
    const commandDrafts = normalizeCommandDrafts(parsed.commandDrafts, project)

    return {
      summary: String(parsed.summary ?? 'OpenRouter 제안이 생성되었습니다.'),
      assumptions: normalizeStringArray(parsed.assumptions),
      clarificationQuestions: normalizeStringArray(parsed.clarificationQuestions),
      findings,
      alternatives: normalizeStringArray(parsed.alternatives),
      proposedOperations: normalizeStringArray(parsed.proposedOperations),
      commandDrafts,
      migrationPlan: normalizeStringArray(parsed.migrationPlan),
      risks: normalizeStringArray(parsed.risks),
      affectedEntityIds: normalizeStringArray(parsed.affectedEntityIds),
      tableIds,
      columnIds,
      relationIds,
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
    }
  } catch {
    return {
      summary: content.slice(0, 280),
      assumptions: ['OpenRouter 응답이 올바른 JSON이 아니어서 텍스트 요약으로 낮춰 처리했습니다.'],
      clarificationQuestions: [],
      findings: validateProject(project),
      alternatives: [],
      proposedOperations: [],
      commandDrafts: [],
      migrationPlan: [],
      risks: ['구조화 출력 검증에 실패했습니다. 이 응답으로는 Command를 대기열에 올릴 수 없습니다.'],
      affectedEntityIds: [],
      tableIds: [],
      columnIds: [],
      relationIds: [],
      confidence: 0.2,
    }
  }
}

function normalizeStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function filterKnownIds(value: unknown, allowed: ReadonlySet<EntityId>, fallback: readonly EntityId[]): readonly EntityId[] {
  const requested = normalizeStringArray(value).filter((entityId) => allowed.has(entityId))
  return [...new Set(requested.length > 0 ? requested : fallback)]
}

function normalizeCommandDrafts(value: unknown, project: SchemaProject): readonly AiCommandDraft[] {
  if (!Array.isArray(value)) return []
  const tableIds = new Set(project.tables.map((table) => table.tableId))
  const columnIds = new Set(project.tables.flatMap((table) => table.columns.map((column) => column.columnId)))
  const viewIds = new Set(project.exportViews.map((view) => view.viewId))
  const drafts: AiCommandDraft[] = []

  for (const item of value.slice(0, 12)) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as Record<string, unknown>
    if (candidate.kind === 'add_export_column'
      && typeof candidate.viewId === 'string' && viewIds.has(candidate.viewId)
      && typeof candidate.tableId === 'string' && tableIds.has(candidate.tableId)
      && typeof candidate.columnId === 'string' && columnIds.has(candidate.columnId)) {
      drafts.push({
        kind: 'add_export_column',
        viewId: candidate.viewId,
        tableId: candidate.tableId,
        columnId: candidate.columnId,
        header: typeof candidate.header === 'string' ? candidate.header : undefined,
      })
      continue
    }

    if (candidate.kind !== 'create_table' || typeof candidate.name !== 'string' || !Array.isArray(candidate.columns)) continue
    const columns = candidate.columns.slice(0, 64).flatMap((column): Extract<AiCommandDraft, { readonly kind: 'create_table' }>['columns'] => {
      if (!column || typeof column !== 'object') return []
      const input = column as Record<string, unknown>
      if (typeof input.name !== 'string' || !['string', 'int32', 'float', 'boolean'].includes(String(input.dataType))) return []
      return [{
        name: input.name,
        dataType: input.dataType as 'string' | 'int32' | 'float' | 'boolean',
        nullable: typeof input.nullable === 'boolean' ? input.nullable : undefined,
        primaryKey: typeof input.primaryKey === 'boolean' ? input.primaryKey : undefined,
      }]
    })
    if (columns.length > 0) drafts.push({
      kind: 'create_table',
      name: candidate.name,
      description: typeof candidate.description === 'string' ? candidate.description : undefined,
      columns,
    })
  }

  return drafts
}
