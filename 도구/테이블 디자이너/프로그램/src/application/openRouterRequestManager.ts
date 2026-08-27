import { OpenRouterProvider, type OpenRouterSettings } from './openRouterProvider'
import type { SchemaProposal } from './mockAiProvider'
import type { SchemaProject } from '../domain/schema'

export interface OpenRouterManagedRequest {
  readonly project: SchemaProject
  readonly prompt: string
  readonly settings: OpenRouterSettings
}

export interface OpenRouterRequestState {
  readonly active: boolean
  readonly cached: boolean
  readonly lastError: string | null
  readonly retryBudget: number
}

export class OpenRouterRequestManager {
  private readonly cache = new Map<string, SchemaProposal>()
  private activeAbortController: AbortController | null = null
  private lastError: string | null = null
  private readonly retryBudget: number

  constructor(retryBudget = 1) {
    this.retryBudget = retryBudget
  }

  getState(): OpenRouterRequestState {
    return {
      active: this.activeAbortController !== null,
      cached: this.cache.size > 0,
      lastError: this.lastError,
      retryBudget: this.retryBudget,
    }
  }

  cancelActiveRequest(): void {
    this.activeAbortController?.abort()
    this.activeAbortController = null
  }

  clearCache(): void {
    this.cache.clear()
  }

  async runSchemaReview(
    input: OpenRouterManagedRequest,
    fetchImpl: typeof fetch = fetch,
  ): Promise<{ readonly proposal: SchemaProposal; readonly cached: boolean }> {
    const cacheKey = createOpenRouterCacheKey(input)
    const cached = this.cache.get(cacheKey)

    if (cached) {
      return { proposal: cached, cached: true }
    }

    this.cancelActiveRequest()
    const abortController = new AbortController()
    this.activeAbortController = abortController

    try {
      const proposal = await this.runWithRetry(input, abortController.signal, fetchImpl)
      this.cache.set(cacheKey, proposal)
      this.lastError = null

      return { proposal, cached: false }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'OpenRouter request failed.'
      throw error
    } finally {
      if (this.activeAbortController === abortController) {
        this.activeAbortController = null
      }
    }
  }

  private async runWithRetry(input: OpenRouterManagedRequest, signal: AbortSignal, fetchImpl: typeof fetch): Promise<SchemaProposal> {
    let lastError: unknown

    for (let attempt = 0; attempt <= this.retryBudget; attempt += 1) {
      try {
        const provider = new OpenRouterProvider(input.settings, (url, init) => fetchImpl(url, { ...init, signal }))
        return await provider.proposeSchema({ project: input.project, prompt: input.prompt })
      } catch (error) {
        lastError = error

        if (signal.aborted || !isRetryableError(error) || attempt === this.retryBudget) {
          break
        }

        await delay(250 * (attempt + 1), signal)
      }
    }

    throw lastError instanceof Error ? lastError : new Error('OpenRouter request failed.')
  }
}

export function createOpenRouterCacheKey(input: OpenRouterManagedRequest): string {
  return stableHash(JSON.stringify({
    projectId: input.project.projectId,
    schemaVersion: input.project.schemaVersion,
    tableIds: input.project.tables.map((table) => table.tableId),
    relationIds: input.project.relations.map((relation) => relation.relationId),
    exportViewIds: input.project.exportViews.map((view) => view.viewId),
    prompt: input.prompt.trim(),
    modelId: input.settings.modelId ?? 'auto-free',
    freeModelsOnly: input.settings.freeModelsOnly,
    sendRowData: input.settings.sendRowData,
  }))
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return /429|rate|timeout|network|503|502|500/i.test(error.message)
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(resolve, ms)

    signal.addEventListener('abort', () => {
      globalThis.clearTimeout(timeout)
      reject(new Error('OpenRouter request was cancelled.'))
    }, { once: true })
  })
}

function stableHash(value: string): string {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `or-cache-${(hash >>> 0).toString(16)}`
}
