import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => path.join(os.tmpdir(), 'ohmyppt-test-user-data'))
  }
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

import { PPTDatabase } from '../../../src/main/db/database'
import { DEFAULT_AI_RUNTIME_SETTINGS } from '../../../src/shared/ai-budget'

describe('AI cost ledger persistence', () => {
  const roots: string[] = []

  afterEach(async () => {
    for (const root of roots.splice(0)) {
      await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 })
    }
  }, 30_000)

  it('reserves pending cost and replaces it with actual completed cost', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ohmyppt-ai-cost-ledger-'))
    roots.push(root)
    const db = new PPTDatabase(path.join(root, 'test.db'))
    await db.init()

    try {
      await expect(db.getSetting('ai_runtime')).resolves.toEqual(DEFAULT_AI_RUNTIME_SETTINGS)
      const monthStart = 0
      const failedId = await db.reserveAiCall({
        providerId: 'openrouter',
        billingMode: 'metered',
        model: 'vendor/model',
        purpose: 'outline',
        estimatedCostUsdMicros: 300_000
      })
      await expect(db.getAiCommittedCostUsdMicros(monthStart)).resolves.toBe(300_000)
      await db.failAiCall(failedId, 'request-failed')
      await expect(db.getAiCommittedCostUsdMicros(monthStart)).resolves.toBe(300_000)

      const completedId = await db.reserveAiCall({
        providerId: 'openrouter',
        billingMode: 'metered',
        model: 'vendor/model',
        purpose: 'storyboard',
        estimatedCostUsdMicros: 250_000
      })
      await db.completeAiCall(completedId, {
        actualCostUsdMicros: 120_000,
        inputTokens: 100,
        outputTokens: 25
      })
      await expect(db.getAiCommittedCostUsdMicros(monthStart)).resolves.toBe(420_000)
    } finally {
      await db.close()
    }
  }, 30_000)
})
