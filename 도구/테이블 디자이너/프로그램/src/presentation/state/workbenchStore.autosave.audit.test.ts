import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AddColumnCommand } from '../../domain/commands'
import { createColumn } from '../../domain/schemaFactories'
import type { ProjectRepository } from '../../application/projectRepository'
import { getProjectRepository, setProjectRepositoryForTests } from '../../infrastructure/projectRepository'
import { useWorkbenchStore } from './workbenchStore'

describe('Gate 0 프로젝트 보존 감사', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    useWorkbenchStore.setState({ appView: 'dashboard', projects: [], currentProjectId: null })
  })

  afterEach(() => {
    vi.useRealTimers()
    setProjectRepositoryForTests(null)
  })

  it('typed Command 실행 후 600ms가 지나면 프로젝트가 자동 저장된다', async () => {
    useWorkbenchStore.getState().openNewProject('자동 저장 감사')
    useWorkbenchStore.getState().createTable()
    const state = useWorkbenchStore.getState()
    const table = state.document.schema.tables[0]!
    const projectId = state.currentProjectId!
    const column = createColumn({ tableId: table.tableId, name: 'AutoSavedValue', dataType: { kind: 'string' } })

    useWorkbenchStore.getState().runCommand(new AddColumnCommand({ tableId: table.tableId, column }))
    await vi.advanceTimersByTimeAsync(650)
    vi.useRealTimers()

    await vi.waitFor(() => expect(useWorkbenchStore.getState().saveState.status).toBe('saved'))
    const persisted = await (await getProjectRepository()).loadProject(projectId)
    expect(persisted?.document.schema.tables[0]?.columns.some((item) => item.columnId === column.columnId)).toBe(true)
  })

  it('편집 직후 저장 상태를 변경됨으로 표시한다', () => {
    useWorkbenchStore.getState().createTable()

    expect(useWorkbenchStore.getState()).toMatchObject({
      saveState: { status: 'dirty' },
    })
  })

  it('저장 매체 오류를 숨기지 않고 다시 저장 가능한 상태로 표시한다', async () => {
    vi.useRealTimers()
    const failingRepository: ProjectRepository = {
      initialize: () => Promise.resolve(),
      listProjects: () => Promise.resolve([]),
      loadProject: () => Promise.resolve(null),
      saveProject: () => Promise.reject(new Error('디스크 용량이 부족합니다.')),
      moveToTrash: () => Promise.resolve(),
      listTrash: () => Promise.resolve([]),
      restoreFromTrash: () => Promise.resolve(null),
      listRecoveryPoints: () => Promise.resolve([]),
      restoreRecoveryPoint: () => Promise.reject(new Error('복구본이 없습니다.')),
    }
    setProjectRepositoryForTests(failingRepository)
    useWorkbenchStore.setState((state) => ({
      currentProjectId: state.document.schema.projectId,
      saveState: { status: 'dirty' },
    }))

    await useWorkbenchStore.getState().saveCurrentProject()

    expect(useWorkbenchStore.getState().saveState).toMatchObject({
      status: 'error',
      message: '디스크 용량이 부족합니다.',
    })
  })
})
