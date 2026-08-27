import type { AiBillingMode, AiProviderId } from './ai-provider'

export const USD_MICROS_PER_USD = 1_000_000
export const DEFAULT_MONTHLY_AI_BUDGET_USD_MICROS = 10 * USD_MICROS_PER_USD
export const DEFAULT_PER_CALL_CONFIRM_USD_MICROS = 250_000

export interface AiRuntimeSettings {
  preferredProvider: AiProviderId
  paidFallbackEnabled: boolean
  monthlyBudgetUsdMicros: number
  perCallConfirmUsdMicros: number
  allowBackgroundCalls: boolean
  maxAutomaticRetries: number
}

export const DEFAULT_AI_RUNTIME_SETTINGS: AiRuntimeSettings = {
  preferredProvider: 'codex-local',
  paidFallbackEnabled: false,
  monthlyBudgetUsdMicros: DEFAULT_MONTHLY_AI_BUDGET_USD_MICROS,
  perCallConfirmUsdMicros: DEFAULT_PER_CALL_CONFIRM_USD_MICROS,
  allowBackgroundCalls: false,
  maxAutomaticRetries: 0
}

const clampInteger = (value: unknown, fallback: number, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

export const normalizeAiRuntimeSettings = (value: unknown): AiRuntimeSettings => {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const preferredProvider =
    record.preferredProvider === 'openrouter' || record.preferredProvider === 'offline'
      ? record.preferredProvider
      : 'codex-local'
  const monthlyBudgetUsdMicros = clampInteger(
    record.monthlyBudgetUsdMicros,
    DEFAULT_MONTHLY_AI_BUDGET_USD_MICROS,
    0,
    1_000 * USD_MICROS_PER_USD
  )
  const perCallConfirmUsdMicros = clampInteger(
    record.perCallConfirmUsdMicros,
    DEFAULT_PER_CALL_CONFIRM_USD_MICROS,
    0,
    monthlyBudgetUsdMicros
  )
  return {
    preferredProvider,
    paidFallbackEnabled: record.paidFallbackEnabled === true,
    monthlyBudgetUsdMicros,
    perCallConfirmUsdMicros,
    allowBackgroundCalls: record.allowBackgroundCalls === true,
    maxAutomaticRetries: clampInteger(record.maxAutomaticRetries, 0, 0, 0)
  }
}

export type AiBudgetDecisionCode =
  | 'subscription-covered'
  | 'offline-no-charge'
  | 'metered-provider-disabled'
  | 'background-call-disabled'
  | 'pricing-required'
  | 'monthly-budget-exceeded'
  | 'per-call-confirmation-required'
  | 'within-budget'

export interface AiBudgetDecision {
  allowed: boolean
  requiresConfirmation: boolean
  code: AiBudgetDecisionCode
  remainingUsdMicros: number
}

export interface EvaluateAiBudgetArgs {
  providerId: AiProviderId
  billingMode: AiBillingMode
  settings: AiRuntimeSettings
  monthCommittedUsdMicros: number
  estimatedCallUsdMicros?: number
  costConfirmed?: boolean
  background?: boolean
}

export const evaluateAiBudget = ({
  providerId,
  billingMode,
  settings,
  monthCommittedUsdMicros,
  estimatedCallUsdMicros,
  costConfirmed = false,
  background = false
}: EvaluateAiBudgetArgs): AiBudgetDecision => {
  const committed = Math.max(0, Math.floor(monthCommittedUsdMicros))
  const remaining = Math.max(0, settings.monthlyBudgetUsdMicros - committed)
  if (background && !settings.allowBackgroundCalls) {
    return {
      allowed: false,
      requiresConfirmation: false,
      code: 'background-call-disabled',
      remainingUsdMicros: remaining
    }
  }
  if (billingMode === 'subscription') {
    return {
      allowed: true,
      requiresConfirmation: false,
      code: 'subscription-covered',
      remainingUsdMicros: remaining
    }
  }
  if (billingMode === 'offline') {
    return {
      allowed: true,
      requiresConfirmation: false,
      code: 'offline-no-charge',
      remainingUsdMicros: remaining
    }
  }
  if (providerId === 'openrouter' && !settings.paidFallbackEnabled) {
    return {
      allowed: false,
      requiresConfirmation: false,
      code: 'metered-provider-disabled',
      remainingUsdMicros: remaining
    }
  }
  if (
    typeof estimatedCallUsdMicros !== 'number' ||
    !Number.isFinite(estimatedCallUsdMicros) ||
    estimatedCallUsdMicros < 0
  ) {
    return {
      allowed: false,
      requiresConfirmation: false,
      code: 'pricing-required',
      remainingUsdMicros: remaining
    }
  }
  const estimate = Math.floor(estimatedCallUsdMicros)
  if (committed + estimate > settings.monthlyBudgetUsdMicros) {
    return {
      allowed: false,
      requiresConfirmation: false,
      code: 'monthly-budget-exceeded',
      remainingUsdMicros: remaining
    }
  }
  if (estimate >= settings.perCallConfirmUsdMicros && !costConfirmed) {
    return {
      allowed: false,
      requiresConfirmation: true,
      code: 'per-call-confirmation-required',
      remainingUsdMicros: remaining
    }
  }
  return {
    allowed: true,
    requiresConfirmation: false,
    code: 'within-budget',
    remainingUsdMicros: Math.max(0, remaining - estimate)
  }
}

export const startOfLocalMonthEpochSeconds = (now = new Date()): number =>
  Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000)
