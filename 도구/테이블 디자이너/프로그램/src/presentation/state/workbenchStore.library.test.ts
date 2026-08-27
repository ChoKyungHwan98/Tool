import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkbenchStore } from './workbenchStore'

describe('프로젝트 보관함', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkbenchStore.setState({ appView: 'dashboard', projects: [], currentProjectId: null })
  })

  it('새 프로젝트를 만들면 보관함에 저장되고 목록에 뜬다', () => {
    useWorkbenchStore.getState().openNewProject('게임 A')

    const state = useWorkbenchStore.getState()
    expect(state.currentProjectId).not.toBeNull()
    expect(state.projects.some((project) => project.name === '게임 A')).toBe(true)
  })

  it('A를 만들고 B로 갔다가 A로 돌아오면 A가 그대로 남아 있다', async () => {
    useWorkbenchStore.getState().openNewProject('게임 A')
    const aId = useWorkbenchStore.getState().currentProjectId!
    useWorkbenchStore.getState().returnToDashboard()

    useWorkbenchStore.getState().openNewProject('게임 B')
    useWorkbenchStore.getState().returnToDashboard()

    expect(useWorkbenchStore.getState().projects).toHaveLength(2)

    await useWorkbenchStore.getState().openProjectById(aId)
    const state = useWorkbenchStore.getState()
    expect(state.appView).toBe('workbench')
    expect(state.document.schema.name).toBe('게임 A')
    expect(state.currentProjectId).toBe(aId)
  })

  it('같은 이름으로 새 프로젝트를 두 번 만들면 이름이 자동으로 구분된다', () => {
    useWorkbenchStore.getState().openNewProject('새 프로젝트')
    useWorkbenchStore.getState().returnToDashboard()
    useWorkbenchStore.getState().openNewProject('새 프로젝트')

    const names = useWorkbenchStore.getState().projects.map((project) => project.name).sort()
    expect(new Set(names).size).toBe(2)
  })

  it('이전 프로젝트의 늦은 저장 완료가 새로 연 프로젝트를 덮지 않는다', async () => {
    useWorkbenchStore.getState().openNewProject('게임 A')
    void useWorkbenchStore.getState().returnToDashboard()

    useWorkbenchStore.getState().openNewProject('게임 B')
    const bId = useWorkbenchStore.getState().currentProjectId
    await useWorkbenchStore.getState().saveCurrentProject()

    const state = useWorkbenchStore.getState()
    expect(state.currentProjectId).toBe(bId)
    expect(state.document.schema.name).toBe('게임 B')
    expect(state.projects.some((project) => project.name === '게임 A')).toBe(true)
    expect(state.projects.some((project) => project.name === '게임 B')).toBe(true)
  })

  it('보관함에서 프로젝트를 지우면 목록에서 사라진다', () => {
    useWorkbenchStore.getState().openNewProject('게임 A')
    const aId = useWorkbenchStore.getState().currentProjectId!
    useWorkbenchStore.getState().returnToDashboard()

    useWorkbenchStore.getState().deleteProjectFromLibrary(aId)
    expect(useWorkbenchStore.getState().projects).toHaveLength(0)
  })
})
