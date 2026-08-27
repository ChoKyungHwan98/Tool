import type {
  ProjectRecord,
  ProjectRepository,
  ProjectSummary,
  RecoveryPoint,
  SaveProjectOptions,
} from '../application/projectRepository'
import type { WorkbenchDocument } from '../domain/schema'
import { IndexedDbProjectRepository } from './indexedDbProjectRepository'
import { deserializeDocument, serializeDocument } from './projectPersistence'

const CHANNEL = 'gds:tool'

interface SharedProjectRecord {
  readonly id: string
  readonly name: string
  readonly serializedDocument: string
  readonly linkedFile: {
    readonly path: string
    readonly lastKnownModifiedAt: string
    readonly checksum: string
  }
}

type SharedProjectResponse =
  | { type: 'tableProject:records'; requestId: string; records: SharedProjectRecord[] }
  | { type: 'tableProject:written'; requestId: string; record: SharedProjectRecord }
  | { type: 'tableProject:trashed'; requestId: string; projectId: string }

function requestSharedProject<T extends SharedProjectResponse>(request: Record<string, unknown>): Promise<T> {
  const requestId = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', handleMessage)
      reject(new Error('게임기획 스튜디오의 공용 프로젝트 폴더가 응답하지 않습니다.'))
    }, 10_000)
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return
      const data = event.data as Partial<T>
      if (!data || data.requestId !== requestId) return
      window.clearTimeout(timeout)
      window.removeEventListener('message', handleMessage)
      resolve(data as T)
    }
    window.addEventListener('message', handleMessage)
    window.parent.postMessage({ channel: CHANNEL, requestId, ...request }, window.location.origin)
  })
}

function parseSharedDocument(record: SharedProjectRecord): WorkbenchDocument {
  const result = deserializeDocument(record.serializedDocument)
  if (!result.ok || !result.document) throw new Error(result.error ?? `${record.name} 프로젝트를 읽을 수 없습니다.`)
  return result.document
}

export function isStudioHosted(): boolean {
  if (typeof window === 'undefined' || window.parent === window) return false
  return new URLSearchParams(window.location.search).get('host') === 'studio'
}

/**
 * Studio의 물리적 `테이블 디자이너/프로젝트` 폴더를 원본으로 사용한다.
 * IndexedDB는 브라우저 프레임의 복구본과 빠른 읽기만 담당한다.
 */
export class StudioSharedProjectRepository implements ProjectRepository {
  private readonly cache: IndexedDbProjectRepository

  constructor(cache = new IndexedDbProjectRepository('game-schema-workbench-studio-cache')) {
    this.cache = cache
  }

  async initialize(): Promise<void> {
    await this.cache.initialize()
    const response = await requestSharedProject<Extract<SharedProjectResponse, { type: 'tableProject:records' }>>({
      type: 'tableProject:list',
    })
    const centralIds = new Set(response.records.map((record) => record.id))
    for (const summary of await this.cache.listProjects()) {
      if (!centralIds.has(summary.id)) await this.cache.moveToTrash(summary.id)
    }
    for (const record of response.records) {
      const document = parseSharedDocument(record)
      await this.cache.saveProject(record.id, record.name, document, {
        serializedDocument: record.serializedDocument,
        linkedFile: record.linkedFile,
      })
    }
  }

  listProjects(): Promise<readonly ProjectSummary[]> {
    return this.cache.listProjects()
  }

  loadProject(projectId: string): Promise<ProjectRecord | null> {
    return this.cache.loadProject(projectId)
  }

  async saveProject(projectId: string, name: string, document: WorkbenchDocument, options: SaveProjectOptions = {}): Promise<ProjectRecord> {
    const serializedDocument = options.serializedDocument ?? serializeDocument(document)
    const response = await requestSharedProject<Extract<SharedProjectResponse, { type: 'tableProject:written' }>>({
      type: 'tableProject:write', projectId, name, serializedDocument,
    })
    return this.cache.saveProject(projectId, name, document, {
      ...options, serializedDocument, linkedFile: response.record.linkedFile,
    })
  }

  async moveToTrash(projectId: string): Promise<void> {
    await requestSharedProject<Extract<SharedProjectResponse, { type: 'tableProject:trashed' }>>({
      type: 'tableProject:trash', projectId,
    })
    await this.cache.moveToTrash(projectId)
  }

  listTrash(): Promise<readonly ProjectSummary[]> {
    return this.cache.listTrash()
  }

  async restoreFromTrash(projectId: string): Promise<ProjectRecord | null> {
    const restored = await this.cache.restoreFromTrash(projectId)
    if (!restored) return null
    return this.saveProject(restored.id, restored.name, restored.document, { linkedFile: restored.linkedFile })
  }

  listRecoveryPoints(projectId: string): Promise<readonly RecoveryPoint[]> {
    return this.cache.listRecoveryPoints(projectId)
  }

  async restoreRecoveryPoint(projectId: string, recoveryId: string): Promise<ProjectRecord> {
    const restored = await this.cache.restoreRecoveryPoint(projectId, recoveryId)
    return this.saveProject(restored.id, restored.name, restored.document, { linkedFile: restored.linkedFile })
  }
}
