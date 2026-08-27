import type { ProjectRepository } from '../application/projectRepository'
import { IndexedDbProjectRepository } from './indexedDbProjectRepository'
import { TauriProjectRepository } from './tauriProjectRepository'
import { isStudioHosted, StudioSharedProjectRepository } from './studioSharedProjectRepository'

let repository: ProjectRepository | null = null
let initialization: Promise<ProjectRepository> | null = null

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function getProjectRepository(): Promise<ProjectRepository> {
  if (repository) return repository
  if (initialization) return initialization

  initialization = (async () => {
    const candidate: ProjectRepository = isStudioHosted()
      ? new StudioSharedProjectRepository()
      : isTauriRuntime()
        ? new TauriProjectRepository()
        : new IndexedDbProjectRepository()
    await candidate.initialize()
    repository = candidate
    return candidate
  })()

  try {
    return await initialization
  } catch (error) {
    initialization = null
    throw error
  }
}

export function setProjectRepositoryForTests(next: ProjectRepository | null): void {
  repository = next
  initialization = next ? Promise.resolve(next) : null
}
