import { describe, expect, it } from 'vitest'
import { toPublicModelConfig } from '../../../src/main/config/model-config-public'

describe('public model configuration', () => {
  it('never sends the decrypted API key to the renderer', () => {
    const result = toPublicModelConfig(
      {
        id: 'model-1',
        name: 'OpenRouter',
        provider: 'openai',
        model: 'vendor/model',
        apiKey: 'encrypted-value',
        baseUrl: 'https://openrouter.ai/api/v1',
        maxTokens: 4096,
        disableTemperature: 0,
        thinkingParameterMode: 'auto',
        active: 1,
        createdAt: 1,
        updatedAt: 2
      },
      () => 'decrypted-secret'
    )

    expect(result.apiKey).toBe('')
    expect(result.hasApiKey).toBe(true)
    expect(JSON.stringify(result)).not.toContain('decrypted-secret')
  })
})
