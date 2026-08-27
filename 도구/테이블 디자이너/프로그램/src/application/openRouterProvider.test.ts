import { describe, expect, it } from 'vitest'
import { crowdProject } from '../domain/sampleProject'
import {
  assertOpenRouterPolicy,
  buildSchemaOnlyPrompt,
  defaultOpenRouterSettings,
  fetchOpenRouterCatalog,
  isFreeOpenRouterModel,
  maskApiKey,
  OpenRouterProvider,
  type OpenRouterModel,
} from './openRouterProvider'

const freeModel: OpenRouterModel = {
  id: 'example/free-model:free',
  name: 'Free Model',
  pricing: { prompt: '0', completion: '0' },
}

const paidModel: OpenRouterModel = {
  id: 'example/paid-model',
  name: 'Paid Model',
  pricing: { prompt: '0.000001', completion: '0.000001' },
}

describe('openRouterProvider', () => {
  it('masks API keys without exposing the full secret', () => {
    expect(maskApiKey('secret-1234567890abcdef')).toBe('secret-...cdef')
  })

  it('detects free models by id suffix or zero pricing', () => {
    expect(isFreeOpenRouterModel(freeModel)).toBe(true)
    expect(isFreeOpenRouterModel({ id: 'example/no-price:free' })).toBe(true)
    expect(isFreeOpenRouterModel(paidModel)).toBe(false)
    expect(isFreeOpenRouterModel({ ...paidModel, id: 'example/suspicious:free' })).toBe(false)
  })

  it('blocks paid fallback and paid models', () => {
    expect(() =>
      assertOpenRouterPolicy({ ...defaultOpenRouterSettings, allowPaidFallback: true }, freeModel),
    ).toThrow(/유료 모델 fallback/)

    expect(() =>
      assertOpenRouterPolicy(defaultOpenRouterSettings, paidModel),
    ).toThrow(/무료 OpenRouter 모델/)
  })

  it('fetches and filters the model catalog without logging secrets', async () => {
    const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toEqual({ Authorization: 'Bearer test-key' })

      return new Response(JSON.stringify({ data: [freeModel, paidModel] }), { status: 200 })
    }

    const catalog = await fetchOpenRouterCatalog({ apiKey: 'test-key', fetchImpl })

    expect(catalog.models).toHaveLength(2)
    expect(catalog.freeModels.map((model) => model.id)).toEqual([freeModel.id])
  })

  it('builds schema-only prompts without sample row values', () => {
    const prompt = buildSchemaOnlyPrompt(crowdProject, 'Review')

    expect(prompt).toContain('CrowdReactionRule')
    expect(prompt).not.toContain('goal_home_high')
  })

  it('rejects an explicitly selected paid model without falling back to a free model', async () => {
    let completionRequests = 0
    const fetchImpl = async (url: string | URL | Request) => {
      if (String(url).endsWith('/models')) {
        return new Response(JSON.stringify({ data: [freeModel, paidModel] }), { status: 200 })
      }
      completionRequests += 1
      return new Response('{}', { status: 200 })
    }
    const provider = new OpenRouterProvider({
      ...defaultOpenRouterSettings,
      apiKey: 'test-key',
      modelId: paidModel.id,
    }, fetchImpl)

    await expect(provider.proposeSchema({ project: crowdProject, prompt: 'Review' })).rejects.toThrow(/무료 OpenRouter 모델/)
    expect(completionRequests).toBe(0)
  })
})
