import { beforeEach, describe, expect, it } from 'vitest'
import { createWorkbenchDocument } from '../application/workbenchDocument'
import { createEmptyProject } from '../domain/emptyProject'
import { deleteProject, listProjects, loadProject, saveProject } from './projectLibrary'

describe('projectLibrary', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('저장한 프로젝트를 목록과 로드로 되찾는다', () => {
    const project = createEmptyProject('게임 A')
    const document = createWorkbenchDocument(project, {})
    saveProject(project.projectId, '게임 A', document)

    const list = listProjects()
    expect(list).toHaveLength(1)
    expect(list[0]!.name).toBe('게임 A')
    expect(list[0]!.tableCount).toBe(0)

    const loaded = loadProject(project.projectId)
    expect(loaded?.schema.name).toBe('게임 A')
    expect(loaded?.schema.tables).toHaveLength(0)
  })

  it('두 프로젝트를 보관하고 하나를 지운다', () => {
    const a = createEmptyProject('게임 A')
    const b = createEmptyProject('게임 B')
    saveProject(a.projectId, '게임 A', createWorkbenchDocument(a, {}))
    saveProject(b.projectId, '게임 B', createWorkbenchDocument(b, {}))
    expect(listProjects()).toHaveLength(2)

    deleteProject(a.projectId)
    const list = listProjects()
    expect(list).toHaveLength(1)
    expect(list[0]!.name).toBe('게임 B')
    expect(loadProject(a.projectId)).toBeNull()
  })

  it('같은 id로 다시 저장하면 항목이 늘지 않고 갱신된다', () => {
    const project = createEmptyProject('게임 A')
    saveProject(project.projectId, '게임 A', createWorkbenchDocument(project, {}))
    saveProject(project.projectId, '게임 A 리네임', createWorkbenchDocument(project, {}))

    const list = listProjects()
    expect(list).toHaveLength(1)
    expect(list[0]!.name).toBe('게임 A 리네임')
  })
})
