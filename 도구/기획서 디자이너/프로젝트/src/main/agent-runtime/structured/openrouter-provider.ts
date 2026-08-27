import type {
  StructuredAiProvider,
  StructuredAiRequest,
  StructuredAiResult,
  StructuredAiUsage
} from './types'
import { StructuredAiError } from './types'

type FetchLike = typeof fetch

interface OpenRouterProviderOptions {
  apiKey: string
  model: string
  baseUrl?: string
  fetchImpl?: FetchLike
}

type UnknownRecord = Record<string, unknown>

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : null

const readNumber = (record: UnknownRecord | null, key: string): number => {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

const extractContent = (payload: UnknownRecord): string => {
  const choices = Array.isArray(payload.choices) ? payload.choices : []
  const first = asRecord(choices[0])
  const message = asRecord(first?.message)
  const content = message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => asRecord(part)?.text)
      .filter((part): part is string => typeof part === 'string')
      .join('')
  }
  return ''
}

const parseUsage = (payload: UnknownRecord): StructuredAiUsage => {
  const usage = asRecord(payload.usage)
  return {
    inputTokens: readNumber(usage, 'prompt_tokens'),
    cachedInputTokens: readNumber(usage, 'cached_tokens'),
    outputTokens: readNumber(usage, 'completion_tokens'),
    reasoningTokens: readNumber(usage, 'reasoning_tokens')
  }
}

const parseActualCostUsdMicros = (payload: UnknownRecord): number | null => {
  const usage = asRecord(payload.usage)
  const cost = usage?.cost
  return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0
    ? Math.round(cost * 1_000_000)
    : null
}

export class OpenRouterStructuredProvider implements StructuredAiProvider {
  readonly id = 'openrouter' as const
  readonly billingMode = 'metered' as const
  private readonly apiKey: string
  private readonly model: string
  private readonly baseUrl: string
  private readonly fetchImpl: FetchLike

  constructor(options: OpenRouterProviderOptions) {
    this.apiKey = options.apiKey.trim()
    this.model = options.model.trim()
    this.baseUrl = (options.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl || fetch
  }

  async generateJson<T>(request: StructuredAiRequest): Promise<StructuredAiResult<T>> {
    if (!this.apiKey) {
      throw new StructuredAiError('provider-auth-required', 'OpenRouter API key is not configured.')
    }
    const model = request.model?.trim() || this.model
    if (!model) {
      throw new StructuredAiError('provider-unavailable', 'OpenRouter model is not configured.')
    }

    let response: Response
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Deck Designer'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'Use only supplied content. Do not invent missing facts. Return only valid JSON matching the requested schema.'
            },
            { role: 'user', content: request.prompt }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: `oh_my_ppt_${request.purpose.replace(/-/g, '_')}`,
              strict: true,
              schema: request.outputSchema
            }
          }
        }),
        signal: request.signal
      })
    } catch (error) {
      throw new StructuredAiError(
        'request-failed',
        'OpenRouter request failed before a response was received.',
        error instanceof Error ? error.message : String(error)
      )
    }

    const rawBody = await response.text()
    if (!response.ok) {
      throw new StructuredAiError(
        response.status === 401 ? 'provider-auth-required' : 'request-failed',
        `OpenRouter request failed with HTTP ${response.status}.`,
        rawBody.slice(0, 500)
      )
    }

    let payload: UnknownRecord
    try {
      payload = JSON.parse(rawBody) as UnknownRecord
    } catch (error) {
      throw new StructuredAiError(
        'provider-response-invalid',
        'OpenRouter returned an invalid JSON envelope.',
        error instanceof Error ? error.message : String(error)
      )
    }
    const content = extractContent(payload)
    try {
      return {
        providerId: this.id,
        billingMode: this.billingMode,
        model,
        value: JSON.parse(content) as T,
        rawResponse: content,
        usage: parseUsage(payload),
        actualCostUsdMicros: parseActualCostUsdMicros(payload),
        providerRunId: typeof payload.id === 'string' ? payload.id : undefined
      }
    } catch (error) {
      throw new StructuredAiError(
        'provider-response-invalid',
        'OpenRouter returned content that is not valid structured JSON.',
        error instanceof Error ? error.message : String(error)
      )
    }
  }
}
