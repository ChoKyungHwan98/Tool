import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()
  return {
    handlers,
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
        handlers.set(channel, handler)
      })
    }
  }
})

vi.mock('electron', () => ({ ipcMain: state.ipcMain }))

import { registerDeckIrHandlers } from '../../../src/main/deck-ir/handlers'
import { createEmptyDeckIr } from '../../../src/shared/deck-ir'
import { sha256Text, stableStringify } from '../../../src/main/deck-ir/stable-json'

describe('DeckIR IPC handlers', () => {
  beforeEach(() => {
    state.handlers.clear()
    state.ipcMain.handle.mockClear()
  })

  it('registers freeform create/load/save/history endpoints without a fixed job form', async () => {
    const saved: unknown[] = []
    const db = {
      getDeckIrDocumentRow: vi.fn(async () => undefined),
      listDeckIrDocumentRows: vi.fn(async () => []),
      listDeckIrRevisionRows: vi.fn(async () => []),
      getDeckIrRevisionRow: vi.fn(async () => undefined),
      saveDeckIrSnapshot: vi.fn(async (data: unknown) => {
        saved.push(data)
        return data
      })
    }
    registerDeckIrHandlers({ db } as never)

    expect([...state.handlers.keys()]).toEqual(
      expect.arrayContaining([
        'deckIr:get',
        'deckIr:listWorkspaces',
        'deckIr:create',
        'deckIr:save',
        'deckIr:validate',
        'deckIr:listRevisions',
        'deckIr:getRevision',
        'deckIr:createWorkspace',
        'deckIr:runStage',
        'deckIr:updateBrief',
        'deckIr:updateSlide',
        'deckIr:selectLayout',
        'deckIr:regenerateSlideLayout',
        'deckIr:exportPptx',
        'deckIr:exportDocx'
      ])
    )
    const created = await state.handlers.get('deckIr:create')?.(undefined, {
      sessionId: 'session-1',
      title: '전투 기획',
      rawBrief: '회사와 직무 맥락을 문장으로 자유롭게 입력한다.'
    })
    expect(created).toMatchObject({ revision: 1, brief: { rawText: expect.any(String) } })
    expect(saved).toHaveLength(1)
  })

  it('records direct slide edits as new user evidence so edited numbers remain traceable', async () => {
    const document = createEmptyDeckIr({
      sessionId: 'session-1',
      title: '테스트',
      rawBrief: '기존 원고',
      now: 1,
      idFactory: (prefix) => `${prefix}-1`
    })
    document.slides = [
      {
        id: 'slide-1',
        order: 1,
        role: 'content',
        logicalStructure: 'mechanism',
        headline: {
          id: 'text-1',
          text: '기존 주장',
          sourceItemIds: ['inventory-1'],
          claimIds: [],
          transform: 'compressed'
        },
        body: [],
        claimIds: [],
        dataRequirementIds: [],
        imageSlotIds: [],
        notes: ''
      }
    ]
    const documentJson = stableStringify(document)
    let current = {
      sessionId: 'session-1',
      revision: 0,
      documentJson,
      checksum: sha256Text(documentJson),
      createdAt: 1,
      updatedAt: 1
    }
    const db = {
      getDeckIrDocumentRow: vi.fn(async () => current),
      listDeckIrRevisionRows: vi.fn(async () => []),
      getDeckIrRevisionRow: vi.fn(async () => undefined),
      saveDeckIrSnapshot: vi.fn(async (data: typeof current & { expectedRevision: number }) => {
        current = {
          sessionId: data.sessionId,
          revision: data.revision,
          documentJson: data.documentJson,
          checksum: data.checksum,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        }
        return current
      })
    }
    registerDeckIrHandlers({ db } as never)

    const updated = (await state.handlers.get('deckIr:updateSlide')?.(undefined, {
      sessionId: 'session-1',
      slideId: 'slide-1',
      headline: '회피 후딜은 12프레임이다.',
      body: ['실측값을 직접 기록했다.']
    })) as ReturnType<typeof createEmptyDeckIr>

    const sourceItemId = updated.slides[0].headline.sourceItemIds[0]
    expect(updated.slides[0].headline.text).toContain('12프레임')
    expect(updated.inventory.find((item) => item.id === sourceItemId)).toMatchObject({
      originalText: expect.stringContaining('12프레임'),
      verbatimNumbers: ['12'],
      userConfirmed: true
    })
  })

  it('returns actionable validation errors for invented numbers', async () => {
    const db = {
      getDeckIrDocumentRow: vi.fn(),
      listDeckIrRevisionRows: vi.fn(),
      getDeckIrRevisionRow: vi.fn(),
      saveDeckIrSnapshot: vi.fn()
    }
    registerDeckIrHandlers({ db } as never)
    const document = {
      schemaVersion: 1,
      sessionId: 'session-1',
      revision: 0,
      title: '테스트',
      brief: { rawText: '실측 12프레임', contextSignals: [] },
      sources: [
        { id: 'source-1', kind: 'user-input', name: '입력', rawText: '실측 12프레임', createdAt: 1 }
      ],
      inventory: [
        {
          id: 'inventory-1',
          sourceId: 'source-1',
          originalText: '실측 12프레임',
          type: 'measurement',
          locator: {},
          verbatimNumbers: ['12'],
          tags: [],
          userConfirmed: true
        }
      ],
      claims: [],
      slides: [
        {
          id: 'slide-1',
          order: 1,
          role: 'content',
          logicalStructure: 'mechanism',
          headline: {
            id: 'text-1',
            text: '후딜 8프레임',
            sourceItemIds: ['inventory-1'],
            claimIds: [],
            transform: 'compressed'
          },
          body: [],
          claimIds: [],
          dataRequirementIds: [],
          imageSlotIds: [],
          notes: ''
        }
      ],
      dataRequirements: [],
      imageSlots: [],
      extensions: {},
      createdAt: 1,
      updatedAt: 1
    }

    const result = await state.handlers.get('deckIr:validate')?.(undefined, { document })
    expect(result).toEqual({
      valid: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'untraceable-number' })])
    })
  })
})
