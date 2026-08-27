import {
  evaluateAiBudget,
  normalizeAiRuntimeSettings,
  startOfLocalMonthEpochSeconds,
  type AiRuntimeSettings
} from '@shared/ai-budget'
import { selectAiProvider, type AiProviderStatus } from '@shared/ai-provider'
import type {
  AiCostLedger,
  StructuredAiProvider,
  StructuredAiRequest,
  StructuredAiResult
} from './types'
import { StructuredAiError } from './types'

export interface StructuredAiRuntimeOptions {
  settings: AiRuntimeSettings
  providers: StructuredAiProvider[]
  providerStatuses: AiProviderStatus[]
  ledger: AiCostLedger
  now?: () => Date
}

export class StructuredAiRuntime {
  private readonly settings: AiRuntimeSettings
  private readonly providers: Map<string, StructuredAiProvider>
  private readonly statuses: Map<string, AiProviderStatus>
  private readonly ledger: AiCostLedger
  private readonly now: () => Date

  constructor(options: StructuredAiRuntimeOptions) {
    this.settings = normalizeAiRuntimeSettings(options.settings)
    this.providers = new Map(options.providers.map((provider) => [provider.id, provider]))
    this.statuses = new Map(options.providerStatuses.map((status) => [status.id, status]))
    this.ledger = options.ledger
    this.now = options.now || (() => new Date())
  }

  async generateJson<T>(request: StructuredAiRequest): Promise<StructuredAiResult<T>> {
    const codexStatus = this.statuses.get('codex-local') || {
      id: 'codex-local',
      available: false,
      authenticated: false,
      billingMode: 'subscription'
    }
    const openRouterStatus = this.statuses.get('openrouter') || {
      id: 'openrouter',
      available: false,
      authenticated: false,
      billingMode: 'metered'
    }
    const selection = selectAiProvider({
      preferredProvider: this.settings.preferredProvider,
      codexStatus,
      openRouterStatus,
      paidFallbackEnabled: this.settings.paidFallbackEnabled
    })
    const provider = this.providers.get(selection.providerId)
    if (!provider || provider.id === 'offline') {
      throw new StructuredAiError(
        'provider-unavailable',
        selection.reason === 'paid-fallback-needs-consent'
          ? 'Codex is unavailable and paid OpenRouter fallback is not enabled.'
          : 'No authenticated AI provider is available.'
      )
    }

    const monthStartedAt = startOfLocalMonthEpochSeconds(this.now())
    const committed = await this.ledger.getCommittedCostUsdMicros(monthStartedAt)
    const decision = evaluateAiBudget({
      providerId: provider.id,
      billingMode: provider.billingMode,
      settings: this.settings,
      monthCommittedUsdMicros: committed,
      estimatedCallUsdMicros: request.estimatedCostUsdMicros,
      costConfirmed: request.costConfirmed,
      background: request.background
    })
    if (!decision.allowed) {
      throw new StructuredAiError(
        decision.requiresConfirmation ? 'budget-confirmation-required' : 'budget-blocked',
        `AI call blocked by cost policy: ${decision.code}.`
      )
    }

    const reservation = await this.ledger.reserve({
      providerId: provider.id,
      billingMode: provider.billingMode,
      model: request.model || 'account-default',
      purpose: request.purpose,
      estimatedCostUsdMicros:
        provider.billingMode === 'metered' ? request.estimatedCostUsdMicros || 0 : 0
    })
    try {
      const result = await provider.generateJson<T>(request)
      await this.ledger.complete(reservation.id, {
        actualCostUsdMicros: result.actualCostUsdMicros,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens
      })
      return result
    } catch (error) {
      const errorCode = error instanceof StructuredAiError ? error.code : 'request-failed'
      await this.ledger.fail(reservation.id, errorCode)
      throw error
    }
  }
}
