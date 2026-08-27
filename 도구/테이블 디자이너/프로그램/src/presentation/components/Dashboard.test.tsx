import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkbenchStore } from '../state/workbenchStore'
import { Dashboard } from './Dashboard'

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkbenchStore.setState({ appView: 'dashboard', projects: [], currentProjectId: null })
  })

  it('샘플 카드를 누르면 샘플 프로젝트를 워크벤치로 연다', async () => {
    render(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: '예제' }))
    await userEvent.click(screen.getByRole('button', { name: /샘플 열기/ }))
    expect(useWorkbenchStore.getState().appView).toBe('workbench')
  })

  it('게임 C PK/FK 예제를 전체 구조 화면으로 연다', async () => {
    render(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: '예제' }))
    await userEvent.click(screen.getByRole('button', { name: '게임 C PK/FK 예제' }))

    const state = useWorkbenchStore.getState()
    expect(state.appView).toBe('workbench')
    expect(state.mainView).toBe('schema')
    expect(state.document.schema.name).toBe('게임 C (PK·FK 예제)')
    expect(state.document.schema.relations).toHaveLength(5)
  })

  it('게임 D 복잡도 예제를 25개 테이블 구조로 연다', async () => {
    render(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: '예제' }))
    await userEvent.click(screen.getByRole('button', { name: '게임 D 자동 배치 검증' }))

    const state = useWorkbenchStore.getState()
    expect(state.appView).toBe('workbench')
    expect(state.mainView).toBe('schema')
    expect(state.document.schema.name).toBe('게임 D (대규모 자동 배치 검증)')
    expect(state.document.schema.tables).toHaveLength(25)
    expect(state.document.schema.relations).toHaveLength(36)
  })

  it('아스트라 콘텐츠 데이터 예제를 전체 구조 화면으로 연다', async () => {
    render(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: '예제' }))
    await userEvent.click(screen.getByRole('button', { name: '아스트라 CASE 콘텐츠 데이터' }))

    await waitFor(() => {
      const state = useWorkbenchStore.getState()
      expect(state.appView).toBe('workbench')
      expect(state.mainView).toBe('schema')
      expect(state.document.schema.name).toBe('아스트라에 오라티오 CASE형 영지 조정')
      expect(state.document.schema.tables).toHaveLength(6)
      expect(state.document.schema.relations).toHaveLength(6)
    })
  })

  it('아스트라 전투·캐릭터 데이터 예제를 전체 구조 화면으로 연다', async () => {
    render(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: '예제' }))
    await userEvent.click(screen.getByRole('button', { name: '아스트라 전투 캐릭터 데이터' }))

    await waitFor(() => {
      const state = useWorkbenchStore.getState()
      expect(state.appView).toBe('workbench')
      expect(state.mainView).toBe('schema')
      expect(state.document.schema.name).toBe('아스트라에 오라티오 CASE_001 전투·캐릭터 데이터')
      expect(state.document.schema.tables).toHaveLength(6)
      expect(state.document.schema.relations).toHaveLength(4)
    })
  })

  it('프로젝트 이름을 입력하면 시작 방법을 고르는 빈 프로젝트를 연다', async () => {
    render(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: /새 프로젝트/ }))
    await userEvent.type(screen.getByLabelText('프로젝트 이름'), '전투 시스템')
    await userEvent.click(screen.getByRole('button', { name: '프로젝트 만들기' }))
    const state = useWorkbenchStore.getState()
    expect(state.appView).toBe('workbench')
    expect(state.document.schema.name).toBe('전투 시스템')
    expect(state.document.schema.tables).toHaveLength(0)
  })
})
