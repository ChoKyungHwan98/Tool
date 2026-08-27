import { describe, expect, it, vi } from 'vitest'
import { OpenRouterStructuredProvider } from '../../../src/main/agent-runtime/structured/openrouter-provider'

const request = {
  purpose: 'storyboard' as const,
  prompt: '원문만 사용한다.',
  outputSchema: {
    type: 'object',
    properties: { slides: { type: 'array' } },
    required: ['slides'],
    additionalProperties: false
  }
}

describe('OpenRouter structured provider', () => {
  it('makes exactly one structured call and reads provider-reported cost', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'or-1',
          choices: [{ message: { content: '{"slides":[]}' } }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 25,
            cost: 0.0012
          }
        }),
        { status: 200 }
      )
    )
    const provider = new OpenRouterStructuredProvider({
      apiKey: 'secret',
      model: 'vendor/model',
      fetchImpl
    })
    const result = await provider.generateJson<{ slides: unknown[] }>(request)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer secret')
    expect(JSON.parse(init.body).response_format.type).toBe('json_schema')
    expect(result.value).toEqual({ slides: [] })
    expect(result.actualCostUsdMicros).toBe(1200)
  })

  it('does not retry failed paid calls', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 }))
    const provider = new OpenRouterStructuredProvider({
      apiKey: 'secret',
      model: 'vendor/model',
      fetchImpl
    })

    await expect(provider.generateJson(request)).rejects.toMatchObject({ code: 'request-failed' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
