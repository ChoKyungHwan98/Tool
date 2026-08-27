import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkbenchStore } from './workbenchStore'

describe('워크스페이스 진입 네비게이션', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkbenchStore.setState({ appView: 'dashboard', projects: [], currentProjectId: null })
  })

  it('샘플 프로젝트를 워크벤치로 연다', () => {
    useWorkbenchStore.getState().openSampleProject()

    const state = useWorkbenchStore.getState()
    expect(state.appView).toBe('workbench')
    expect(state.document.schema.tables.length).toBeGreaterThan(0)
    expect(state.undoStack).toHaveLength(0)
  })

  it('빈 새 프로젝트를 전체 구조 화면으로 열고, 대시보드로 돌아온다', () => {
    useWorkbenchStore.getState().openNewProject('테스트')

    let state = useWorkbenchStore.getState()
    expect(state.appView).toBe('workbench')
    expect(state.document.schema.name).toBe('테스트')
    expect(state.document.schema.tables).toHaveLength(0)
    expect(state.selectedTableId).toBe('')
    expect(state.mainView).toBe('schema')

    useWorkbenchStore.getState().returnToDashboard()
    state = useWorkbenchStore.getState()
    expect(state.appView).toBe('dashboard')
  })

  it('좌우 패널의 접힘 상태를 명시적으로 설정한다', () => {
    useWorkbenchStore.getState().setExplorerCollapsed(true)
    useWorkbenchStore.getState().setAssistantCollapsed(true)
    expect(useWorkbenchStore.getState().explorerCollapsed).toBe(true)
    expect(useWorkbenchStore.getState().assistantCollapsed).toBe(true)

    useWorkbenchStore.getState().setExplorerCollapsed(false)
    useWorkbenchStore.getState().setAssistantCollapsed(false)
    expect(useWorkbenchStore.getState().explorerCollapsed).toBe(false)
    expect(useWorkbenchStore.getState().assistantCollapsed).toBe(false)
  })
})
