import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  runtimeOptions: null as Record<string, unknown> | null,
  openRouterOptions: null as Record<string, unknown> | null
}))

vi.mock('../../../src/main/agent-runtime/model', () => {
  class CodexLocalStructuredProvider {
    id = 'codex-local'
    billingMode = 'subscription'
  }
  class OfflineStructuredProvider {
    id = 'offline'
    billingMode = 'offline'
  }
  class OpenRouterStructuredProvider {
    id = 'openrouter'
    billingMode = 'metered'
    constructor(options: Record<string, unknown>) {
      state.openRouterOptions = options
    }
  }
  class StructuredAiRuntime {
    constructor(options: Record<string, unknown>) {
      state.runtimeOptions = options
    }
  }
  return {
    CodexLocalStructuredProvider,
    OfflineStructuredProvider,
    OpenRouterStructuredProvider,
    StructuredAiRuntime,
    probeCodexLocalRuntime: vi.fn(async () => ({
      id: 'codex-local',
      available: true,
      authenticated: true,
      billingMode: 'subscription',
      detail: 'chatgpt'
    }))
  }
})

import { createStructuredAiRuntime } from '../../../src/main/ipc/runtime/structured-ai-runtime'

describe('createStructuredAiRuntime', () => {
  it('keeps subscription Codex first and adds an explicitly configured OpenRouter fallback', async () => {
    state.runtimeOptions = null
    state.openRouterOptions = null
    const ctx = {
      db: {
        getSetting: vi.fn(async () => ({
          preferredProvider: 'codex-local',
          paidFallbackEnabled: false
        })),
        listModelConfigs: vi.fn(async () => [
          {
            apiKey: 'encrypted-key',
            model: 'vendor/model',
            baseUrl: 'https://openrouter.ai/api/v1'
          }
        ])
      },
      decryptApiKey: vi.fn(() => 'decrypted-key')
    }

    await createStructuredAiRuntime(ctx as never)

    expect(state.openRouterOptions).toMatchObject({
      apiKey: 'decrypted-key',
      model: 'vendor/model',
      baseUrl: 'https://openrouter.ai/api/v1'
    })
    const providers = state.runtimeOptions?.providers as Array<{ id: string }>
    expect(providers.map((provider) => provider.id)).toEqual([
      'codex-local',
      'offline',
      'openrouter'
    ])
    expect(state.runtimeOptions?.settings).toMatchObject({
      preferredProvider: 'codex-local',
      paidFallbackEnabled: false,
      maxAutomaticRetries: 0
    })
  })
})
