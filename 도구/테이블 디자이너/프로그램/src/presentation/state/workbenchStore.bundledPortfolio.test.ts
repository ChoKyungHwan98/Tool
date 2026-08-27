import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IndexedDbProjectRepository } from '../../infrastructure/indexedDbProjectRepository'
import { setProjectRepositoryForTests } from '../../infrastructure/projectRepository'
import { useWorkbenchStore } from './workbenchStore'

describe('기본 포트폴리오 프로젝트 등록', () => {
  beforeEach(() => {
    useWorkbenchStore.setState({
      appView: 'dashboard',
      projects: [],
      trashedProjects: [],
      currentProjectId: null,
      repositoryReady: false,
    })
  })

  afterEach(() => {
    setProjectRepositoryForTests(null)
  })

  it('빈 보관함을 처음 열면 콘텐츠와 전투 프로젝트가 내 프로젝트에 나타난다', async () => {
    const repository = new IndexedDbProjectRepository(`bundled-portfolio-${crypto.randomUUID()}`)
    await repository.initialize()
    setProjectRepositoryForTests(repository)

    await useWorkbenchStore.getState().initializeProjectLibrary()

    const projects = useWorkbenchStore.getState().projects
    expect(projects).toHaveLength(2)
    expect(projects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'proj_astrae_territory_case_001',
        name: '아스트라에 오라티오 CASE형 영지 조정',
        tableCount: 6,
        relationCount: 6,
      }),
      expect.objectContaining({
        id: 'proj_astrae_case001_combat',
        name: '아스트라에 오라티오 CASE_001 전투·캐릭터 데이터',
        tableCount: 6,
        relationCount: 4,
      }),
    ]))
    expect(useWorkbenchStore.getState().repositoryReady).toBe(true)
  })
})
