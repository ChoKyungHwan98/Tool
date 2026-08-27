import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AI_RUNTIME_SETTINGS,
  DEFAULT_MONTHLY_AI_BUDGET_USD_MICROS,
  evaluateAiBudget,
  normalizeAiRuntimeSettings
} from '../../../src/shared/ai-budget'

describe('AI budget policy', () => {
  it('defaults to Codex, a 10 USD hard limit, and zero automatic retries', () => {
    expect(normalizeAiRuntimeSettings(undefined)).toEqual(DEFAULT_AI_RUNTIME_SETTINGS)
    expect(DEFAULT_MONTHLY_AI_BUDGET_USD_MICROS).toBe(10_000_000)
    expect(normalizeAiRuntimeSettings({ maxAutomaticRetries: 9 }).maxAutomaticRetries).toBe(0)
  })

  it('allows subscription-covered Codex calls without metered pricing', () => {
    expect(
      evaluateAiBudget({
        providerId: 'codex-local',
        billingMode: 'subscription',
        settings: DEFAULT_AI_RUNTIME_SETTINGS,
        monthCommittedUsdMicros: 9_900_000
      })
    ).toMatchObject({ allowed: true, code: 'subscription-covered' })
  })

  it('blocks OpenRouter until paid fallback is explicitly enabled', () => {
    expect(
      evaluateAiBudget({
        providerId: 'openrouter',
        billingMode: 'metered',
        settings: DEFAULT_AI_RUNTIME_SETTINGS,
        monthCommittedUsdMicros: 0,
        estimatedCallUsdMicros: 1
      })
    ).toMatchObject({ allowed: false, code: 'metered-provider-disabled' })
  })

  it('requires pricing, confirmation for larger calls, and respects the monthly cap', () => {
    const settings = { ...DEFAULT_AI_RUNTIME_SETTINGS, paidFallbackEnabled: true }
    expect(
      evaluateAiBudget({
        providerId: 'openrouter',
        billingMode: 'metered',
        settings,
        monthCommittedUsdMicros: 0
      }).code
    ).toBe('pricing-required')
    expect(
      evaluateAiBudget({
        providerId: 'openrouter',
        billingMode: 'metered',
        settings,
        monthCommittedUsdMicros: 0,
        estimatedCallUsdMicros: 250_000
      })
    ).toMatchObject({
      allowed: false,
      requiresConfirmation: true,
      code: 'per-call-confirmation-required'
    })
    expect(
      evaluateAiBudget({
        providerId: 'openrouter',
        billingMode: 'metered',
        settings,
        monthCommittedUsdMicros: 9_900_000,
        estimatedCallUsdMicros: 200_000,
        costConfirmed: true
      }).code
    ).toBe('monthly-budget-exceeded')
  })

  it('never allows background paid calls under the default policy', () => {
    const settings = { ...DEFAULT_AI_RUNTIME_SETTINGS, paidFallbackEnabled: true }
    expect(
      evaluateAiBudget({
        providerId: 'openrouter',
        billingMode: 'metered',
        settings,
        monthCommittedUsdMicros: 0,
        estimatedCallUsdMicros: 10_000,
        background: true
      }).code
    ).toBe('background-call-disabled')
    expect(
      evaluateAiBudget({
        providerId: 'codex-local',
        billingMode: 'subscription',
        settings: DEFAULT_AI_RUNTIME_SETTINGS,
        monthCommittedUsdMicros: 0,
        background: true
      }).code
    ).toBe('background-call-disabled')
  })
})
