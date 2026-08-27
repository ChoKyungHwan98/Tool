import { describe, expect, it, vi } from 'vitest'
import { createEmptyDeckIr } from '../../../src/shared/deck-ir'
import {
  DeckIrAiOutputError,
  DeckIrContentService,
  type StructuredJsonGenerator
} from '../../../src/main/deck-ir/content-service'

const result = <T>(value: T) => ({
  providerId: 'codex-local' as const,
  billingMode: 'subscription' as const,
  model: 'account-default',
  value,
  rawResponse: JSON.stringify(value),
  usage: {
    inputTokens: 1,
    cachedInputTokens: 0,
    outputTokens: 1,
    reasoningTokens: 0
  },
  actualCostUsdMicros: null
})

const createDocument = () =>
  createEmptyDeckIr({
    sessionId: 'session-1',
    title: '전투 기획',
    rawBrief: '회피 후딜은 실측 12프레임이다. 실패하면 경직 상태로 전이한다.',
    now: 100,
    idFactory: (prefix) => `${prefix}-1`
  })

describe('DeckIrContentService', () => {
  it('accepts only verbatim inventory excerpts and keeps inferred context unconfirmed', async () => {
    const generateJson = vi.fn(async () =>
      result({
        contextSignals: [{ label: '중심 논점', value: '회피의 손해' }],
        inventory: [
          {
            sourceId: 'source-1',
            originalText: '회피 후딜은 실측 12프레임이다.',
            type: 'measurement',
            tags: ['회피', '실측']
          }
        ]
      })
    )
    const service = new DeckIrContentService({ generateJson } as StructuredJsonGenerator, {
      idFactory: (prefix) => `${prefix}-generated`
    })
    const next = await service.extractInventory(createDocument())

    expect(next.inventory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          originalText: '회피 후딜은 실측 12프레임이다.',
          verbatimNumbers: ['12'],
          userConfirmed: false
        })
      ])
    )
    expect(next.brief.contextSignals).toContainEqual(
      expect.objectContaining({ origin: 'inferred', confirmed: false })
    )
    expect(generateJson).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'content-inventory' })
    )
    expect(generateJson.mock.calls[0][0]).not.toHaveProperty('background')
  })

  it('rejects an inventory excerpt that the AI invented', async () => {
    const ai = {
      generateJson: vi.fn(async () =>
        result({
          contextSignals: [],
          inventory: [
            {
              sourceId: 'source-1',
              originalText: '회피 후딜은 8프레임이다.',
              type: 'measurement',
              tags: []
            }
          ]
        })
      )
    }
    const service = new DeckIrContentService(ai)
    await expect(service.extractInventory(createDocument())).rejects.toBeInstanceOf(
      DeckIrAiOutputError
    )
  })

  it('builds an evidence-linked outline without choosing a fixed visual layout', async () => {
    let counter = 0
    const ai = {
      generateJson: vi.fn(async () =>
        result({
          slides: [
            {
              role: 'content',
              logicalStructure: 'mechanism',
              customStructure: null,
              headline: {
                text: '회피 후딜은 12프레임이다.',
                sourceItemIds: ['inventory-1']
              },
              body: [
                {
                  text: '실패하면 경직 상태로 전이한다.',
                  sourceItemIds: ['inventory-1']
                }
              ],
              takeaway: null,
              notes: '상태 전이를 보여준다.'
            }
          ]
        })
      )
    }
    const service = new DeckIrContentService(ai, {
      idFactory: (prefix) => `${prefix}-${++counter}`
    })
    const next = await service.proposeOutline(createDocument())

    expect(next.slides[0]).toMatchObject({
      logicalStructure: 'mechanism',
      headline: { sourceItemIds: ['inventory-1'], claimIds: [expect.any(String)] }
    })
    expect(next.claims[0]).toMatchObject({ status: 'supported', createdBy: 'ai' })
    expect(next.slides[0]).not.toHaveProperty('layoutId')
  })

  it('rejects an outline when a cited source does not contain the generated number', async () => {
    const ai = {
      generateJson: vi.fn(async () =>
        result({
          slides: [
            {
              role: 'content',
              logicalStructure: 'number-focus',
              customStructure: null,
              headline: { text: '회피 후딜은 8프레임이다.', sourceItemIds: ['inventory-1'] },
              body: [],
              takeaway: null,
              notes: ''
            }
          ]
        })
      )
    }
    const service = new DeckIrContentService(ai)
    await expect(service.proposeOutline(createDocument())).rejects.toMatchObject({
      name: 'DeckIrIntegrityError'
    })
  })
})
