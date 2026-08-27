import { beforeEach, describe, expect, it } from 'vitest'
import { createWorkbenchDocument } from '../application/workbenchDocument'
import { createEmptyProject } from '../domain/emptyProject'
import { IndexedDbProjectRepository } from './indexedDbProjectRepository'
import { serializeDocument } from './projectPersistence'

describe('IndexedDbProjectRepository', () => {
  beforeEach(() => localStorage.clear())

  it('검증된 프로젝트를 저장·로드하고 휴지통에서 복원한다', async () => {
    const repository = new IndexedDbProjectRepository(`repository-${crypto.randomUUID()}`)
    await repository.initialize()
    const project = createEmptyProject(`저장소 QA ${crypto.randomUUID()}`)
    const document = createWorkbenchDocument(project)

    const saved = await repository.saveProject(project.projectId, project.name, document, {
      createRecovery: true,
      recoveryReason: 'checkpoint',
    })
    expect(saved.checksum).toBeTruthy()
    expect((await repository.loadProject(project.projectId))?.document).toEqual(document)
    expect(await repository.listRecoveryPoints(project.projectId)).toHaveLength(1)

    await repository.moveToTrash(project.projectId)
    expect(await repository.loadProject(project.projectId)).toBeNull()
    expect((await repository.listTrash()).some((item) => item.id === project.projectId)).toBe(true)

    const restored = await repository.restoreFromTrash(project.projectId)
    expect(restored?.document).toEqual(document)
  })

  it('복구본을 프로젝트별 최대 30개로 정리한다', async () => {
    const repository = new IndexedDbProjectRepository(`recovery-${crypto.randomUUID()}`)
    await repository.initialize()
    const project = createEmptyProject(`복구 QA ${crypto.randomUUID()}`)
    const document = createWorkbenchDocument(project)

    for (let revision = 0; revision < 34; revision += 1) {
      await repository.saveProject(project.projectId, project.name, { ...document, revision }, {
        createRecovery: true,
        recoveryReason: 'checkpoint',
      })
    }

    expect((await repository.listRecoveryPoints(project.projectId)).length).toBeLessThanOrEqual(30)
  })

  it('기존 localStorage 문서를 검증해 이전하고 원본은 보존한다', async () => {
    const project = createEmptyProject(`이전 QA ${crypto.randomUUID()}`)
    const document = createWorkbenchDocument(project)
    localStorage.setItem('gsw.projects.index', JSON.stringify([{ id: project.projectId, name: project.name }]))
    localStorage.setItem(`gsw.project.${project.projectId}`, serializeDocument(document))

    const repository = new IndexedDbProjectRepository(`migration-${crypto.randomUUID()}`)
    await repository.initialize()

    expect((await repository.loadProject(project.projectId))?.document).toEqual(document)
    expect(localStorage.getItem(`gsw.project.${project.projectId}`)).toBe(serializeDocument(document))
  })
})
