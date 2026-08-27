import { describe, expect, it } from 'vitest'
import { selectAiProvider, type AiProviderStatus } from '../../../src/shared/ai-provider'

const status = (
  id: AiProviderStatus['id'],
  ready: boolean,
  billingMode: AiProviderStatus['billingMode']
): AiProviderStatus => ({
  id,
  available: ready,
  authenticated: ready,
  billingMode
})

describe('AI provider selection', () => {
  it('uses Codex subscription first', () => {
    expect(
      selectAiProvider({
        preferredProvider: 'codex-local',
        codexStatus: status('codex-local', true, 'subscription'),
        openRouterStatus: status('openrouter', true, 'metered'),
        paidFallbackEnabled: true
      })
    ).toEqual({ providerId: 'codex-local', reason: 'preferred-ready' })
  })

  it('does not silently switch to paid OpenRouter', () => {
    expect(
      selectAiProvider({
        preferredProvider: 'codex-local',
        codexStatus: status('codex-local', false, 'subscription'),
        openRouterStatus: status('openrouter', true, 'metered'),
        paidFallbackEnabled: false
      })
    ).toEqual({ providerId: 'offline', reason: 'paid-fallback-needs-consent' })
  })

  it('keeps manual offline work available when no provider is ready', () => {
    expect(
      selectAiProvider({
        preferredProvider: 'codex-local',
        codexStatus: status('codex-local', false, 'subscription'),
        openRouterStatus: status('openrouter', false, 'metered'),
        paidFallbackEnabled: false
      }).providerId
    ).toBe('offline')
  })
})
