import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_AI_RUNTIME_SETTINGS } from '../../../src/shared/ai-budget'
import type { AiProviderStatus } from '../../../src/shared/ai-provider'
import { StructuredAiRuntime } from '../../../src/main/agent-runtime/structured/runtime'
import type {
  AiCostLedger,
  StructuredAiProvider,
  StructuredAiResult
} from '../../../src/main/agent-runtime/structured/types'

const readyStatus = (
  id: AiProviderStatus['id'],
  billingMode: AiProviderStatus['billingMode'],
  ready = true
): AiProviderStatus => ({
  id,
  billingMode,
  available: ready,
  authenticated: ready
})

const result: StructuredAiResult<{ ok: boolean }> = {
  providerId: 'codex-local',
  billingMode: 'subscription',
  model: 'account-default',
  value: { ok: true },
  rawResponse: '{"ok":true}',
  usage: { inputTokens: 10, cachedInputTokens: 0, outputTokens: 2, reasoningTokens: 0 },
  actualCostUsdMicros: 0
}

const createLedger = (): AiCostLedger & {
  reserve: ReturnType<typeof vi.fn>
  complete: ReturnType<typeof vi.fn>
  fail: ReturnType<typeof vi.fn>
} => ({
  getCommittedCostUsdMicros: vi.fn().mockResolvedValue(0),
  reserve: vi.fn().mockResolvedValue({
    id: 'reservation-1',
    providerId: 'codex-local',
    billingMode: 'subscription',
    model: 'account-default',
    purpose: 'outline',
    estimatedCostUsdMicros: 0
  }),
  complete: vi.fn().mockResolvedValue(undefined),
  fail: vi.fn().mockResolvedValue(undefined)
})

describe('structured AI runtime', () => {
  it('routes through Codex and persists the completed usage reservation', async () => {
    const generateJson = vi.fn().mockResolvedValue(result)
    const provider: StructuredAiProvider = {
      id: 'codex-local',
      billingMode: 'subscription',
      generateJson
    }
    const ledger = createLedger()
    const runtime = new StructuredAiRuntime({
      settings: DEFAULT_AI_RUNTIME_SETTINGS,
      providers: [provider],
      providerStatuses: [
        readyStatus('codex-local', 'subscription'),
        readyStatus('openrouter', 'metered', false)
      ],
      ledger
    })

    await expect(
      runtime.generateJson({
        purpose: 'outline',
        prompt: '정리',
        outputSchema: { type: 'object' }
      })
    ).resolves.toMatchObject({ value: { ok: true } })
    expect(ledger.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'codex-local', estimatedCostUsdMicros: 0 })
    )
    expect(ledger.complete).toHaveBeenCalledWith(
      'reservation-1',
      expect.objectContaining({ inputTokens: 10, outputTokens: 2 })
    )
  })

  it('blocks paid fallback before reserving or calling when consent is absent', async () => {
    const generateJson = vi.fn()
    const provider: StructuredAiProvider = {
      id: 'openrouter',
      billingMode: 'metered',
      generateJson
    }
    const ledger = createLedger()
    const runtime = new StructuredAiRuntime({
      settings: DEFAULT_AI_RUNTIME_SETTINGS,
      providers: [provider],
      providerStatuses: [
        readyStatus('codex-local', 'subscription', false),
        readyStatus('openrouter', 'metered')
      ],
      ledger
    })

    await expect(
      runtime.generateJson({
        purpose: 'outline',
        prompt: '정리',
        outputSchema: { type: 'object' },
        estimatedCostUsdMicros: 1
      })
    ).rejects.toMatchObject({ code: 'provider-unavailable' })
    expect(ledger.reserve).not.toHaveBeenCalled()
    expect(generateJson).not.toHaveBeenCalled()
  })
})
