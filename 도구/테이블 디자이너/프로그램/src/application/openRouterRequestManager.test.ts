import { describe, expect, it } from 'vitest'
import { crowdProject } from '../domain/sampleProject'
import { defaultOpenRouterSettings } from './openRouterProvider'
import { createOpenRouterCacheKey, OpenRouterRequestManager } from './openRouterRequestManager'

describe('OpenRouterRequestManager', () => {
  it('creates stable cache keys without row data', () => {
    const key = createOpenRouterCacheKey({
      project: crowdProject,
      prompt: 'Review',
      settings: defaultOpenRouterSettings,
    })

    expect(key).toMatch(/^or-cache-/)
    expect(key).not.toContain('goal_home_high')
  })

  it('caches schema-only review results', async () => {
    let fetchCount = 0
    const fetchImpl = async (url: string | URL | Request) => {
      fetchCount += 1
      const textUrl = String(url)

      if (textUrl.endsWith('/models')) {
        return new Response(JSON.stringify({
          data: [
            {
              id: 'example/free:free',
              name: 'Free',
              pricing: { prompt: '0', completion: '0' },
            },
          ],
        }), { status: 200 })
      }

      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: 'Cached review',
                assumptions: [],
                clarificationQuestions: [],
                alternatives: [],
                proposedOperations: [],
                commandDrafts: [],
                migrationPlan: [],
                risks: [],
                affectedEntityIds: [],
                tableIds: [],
                columnIds: [],
                relationIds: [],
                confidence: 0.8,
              }),
            },
          },
        ],
      }), { status: 200 })
    }

    const manager = new OpenRouterRequestManager(0)
    const input = {
      project: crowdProject,
      prompt: 'Review',
      settings: {
        ...defaultOpenRouterSettings,
        apiKey: 'mock-key',
        modelId: 'example/free:free',
      },
    }

    const first = await manager.runSchemaReview(input, fetchImpl)
    const second = await manager.runSchemaReview(input, fetchImpl)

    expect(first.cached).toBe(false)
    expect(second.cached).toBe(true)
    expect(second.proposal.summary).toBe('Cached review')
    expect(fetchCount).toBe(2)
  })
})
