import type { WorkbenchDocument } from '../domain/schema'
import { deserializeDocument, serializeDocument } from './projectPersistence'

export interface ProjectSummary {
  readonly id: string
  readonly name: string
  readonly tableCount: number
  readonly updatedAt: string
}

const INDEX_KEY = 'gsw.projects.index'

function projectKey(id: string): string {
  return `gsw.project.${id}`
}

function getStorage(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage
    }
  } catch {
    // localStorage access can throw in sandboxed webviews.
  }

  return null
}

function isProjectSummary(value: unknown): value is ProjectSummary {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const summary = value as Record<string, unknown>

  return (
    typeof summary.id === 'string' &&
    typeof summary.name === 'string' &&
    typeof summary.tableCount === 'number' &&
    typeof summary.updatedAt === 'string'
  )
}

export function listProjects(): readonly ProjectSummary[] {
  const storage = getStorage()

  if (!storage) {
    return []
  }

  const raw = storage.getItem(INDEX_KEY)

  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isProjectSummary).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  } catch {
    return []
  }
}

export function loadProject(id: string): WorkbenchDocument | null {
  const storage = getStorage()

  if (!storage) {
    return null
  }

  const raw = storage.getItem(projectKey(id))

  if (!raw) {
    return null
  }

  const result = deserializeDocument(raw)

  return result.ok && result.document ? result.document : null
}

export function saveProject(id: string, name: string, document: WorkbenchDocument): ProjectSummary {
  const summary: ProjectSummary = {
    id,
    name,
    tableCount: document.schema.tables.length,
    updatedAt: new Date().toISOString(),
  }

  const storage = getStorage()

  if (!storage) {
    return summary
  }

  storage.setItem(projectKey(id), serializeDocument(document))
  const others = listProjects().filter((project) => project.id !== id)
  storage.setItem(INDEX_KEY, JSON.stringify([summary, ...others]))

  return summary
}

export function deleteProject(id: string): void {
  const storage = getStorage()

  if (!storage) {
    return
  }

  storage.removeItem(projectKey(id))
  const others = listProjects().filter((project) => project.id !== id)
  storage.setItem(INDEX_KEY, JSON.stringify(others))
}
