// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDeckIr } from '../../../src/shared/deck-ir'
;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const ipcMock = vi.hoisted(() => ({
  createDeckIrWorkspace: vi.fn(),
  getDeckIr: vi.fn(),
  listDeckIrRevisions: vi.fn(async () => []),
  validateDeckIr: vi.fn(async () => ({ valid: true, issues: [] })),
  runDeckIrStage: vi.fn(),
  updateDeckIrBrief: vi.fn(),
  updateDeckIrSlide: vi.fn(),
  selectDeckIrLayout: vi.fn(),
  regenerateDeckIrSlideLayout: vi.fn(),
  exportDeckIrPptx: vi.fn(),
  exportDeckIrDocx: vi.fn()
}))

vi.mock('../../../src/renderer/src/lib/ipc', () => ({ ipc: ipcMock }))

import { DeckDesignerPage } from '../../../src/renderer/src/pages/deck-designer'

describe('DeckDesignerPage', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    ipcMock.listDeckIrRevisions.mockResolvedValue([])
    ipcMock.validateDeckIr.mockResolvedValue({ valid: true, issues: [] })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('starts from one freeform brief instead of fixed company/project/job fields', async () => {
    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/designer'] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: '/designer/:id?',
              element: React.createElement(DeckDesignerPage)
            })
          )
        )
      )
    })

    expect(container.textContent).toContain('머릿속 논리를 그대로 시작점으로 씁니다.')
    expect(container.textContent).toContain('자유 입력 원고')
    expect(container.textContent).not.toContain('지원 회사')
    expect(container.textContent).not.toContain('지원 직무')
    expect(container.querySelectorAll('textarea')).toHaveLength(1)
  })

  it('shows evidence, outline, direction, layout, and audit as separate review surfaces', async () => {
    const document = createEmptyDeckIr({
      sessionId: 'session-1',
      title: '전투 기획',
      rawBrief: '회피 손해와 판정 상태를 설명한다.',
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
          text: '회피의 손해는 후속 선택을 막는다.',
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
    ipcMock.getDeckIr.mockResolvedValue(document)

    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/designer/session-1'] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: '/designer/:id?',
              element: React.createElement(DeckDesignerPage)
            })
          )
        )
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('목차와 주장')
    expect(container.textContent).toContain('디자인 방향')
    expect(container.textContent).toContain('장별 레이아웃')
    expect(container.textContent).toContain('근거와 검증')
    expect(container.textContent).toContain('PPTX')
    expect(container.textContent).toContain('Word')
    expect(container.textContent).toContain('API를 호출하지 않습니다')
    expect(
      (container.querySelector('input[aria-label="1번 슬라이드 주장"]') as HTMLInputElement).value
    ).toBe('회피의 손해는 후속 선택을 막는다.')
    expect(container.textContent).toContain('그 장에서 증명할 문장')
  })
})
