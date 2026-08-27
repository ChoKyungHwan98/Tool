import type {
  ProjectRecord,
  ProjectRepository,
  ProjectSummary,
  RecoveryPoint,
  SaveProjectOptions,
} from '../application/projectRepository'
import { projectSummaryFromDocument } from '../application/projectRepository'
import { deserializeDocument } from './projectPersistence'
import { checksumDocument } from './projectChecksum'

const DB_NAME = 'game-schema-workbench'
const DB_VERSION = 1
const PROJECTS = 'projects'
const RECOVERY = 'recovery'
const TRASH = 'trash'
const META = 'meta'
const LEGACY_INDEX_KEY = 'gsw.projects.index'
const MIGRATION_MARKER = 'legacy-local-storage-migrated-v1'

interface StoredProjectRecord extends ProjectRecord {
  readonly serializedDocument: string
}

interface StoredRecoveryPoint extends RecoveryPoint {
  readonly serializedDocument: string
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB 요청에 실패했습니다.')))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve())
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('IndexedDB 트랜잭션이 중단되었습니다.')))
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('IndexedDB 트랜잭션에 실패했습니다.')))
  })
}

function deserializeStored(record: StoredProjectRecord): ProjectRecord {
  const result = deserializeDocument(record.serializedDocument)
  if (!result.ok || !result.document) throw new Error(result.error ?? '저장된 프로젝트가 손상되었습니다.')
  return { ...record, document: result.document }
}

export class IndexedDbProjectRepository implements ProjectRepository {
  private database: IDBDatabase | null = null
  private readonly databaseName: string

  constructor(databaseName = DB_NAME) {
    this.databaseName = databaseName
  }

  async initialize(): Promise<void> {
    if (!globalThis.indexedDB) throw new Error('이 브라우저에서는 안전한 프로젝트 저장소를 사용할 수 없습니다.')
    this.database = await this.openDatabase()
    await this.migrateLegacyLocalStorage()
    await this.normalizeLegacyLocations()
    await this.pruneRecoveryPoints()
    await this.pruneTrash()
  }

  async listProjects(): Promise<readonly ProjectSummary[]> {
    const records = await this.getAll<StoredProjectRecord>(PROJECTS)
    return records
      .map(({ serializedDocument: _serializedDocument, document: _document, checksum: _checksum, ...summary }) => summary)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async loadProject(projectId: string): Promise<ProjectRecord | null> {
    const current = await this.get<StoredProjectRecord>(PROJECTS, projectId)
    if (!current) return null

    try {
      const record = deserializeStored(current)
      if (await checksumDocument(record.document) !== current.checksum) throw new Error('체크섬이 일치하지 않습니다.')
      return record
    } catch {
      const recovery = (await this.listRecoveryPoints(projectId))[0]
      if (!recovery) throw new Error('현재 프로젝트가 손상되었고 사용할 수 있는 복구본이 없습니다.')
      const restored = await this.saveProject(projectId, current.name, recovery.document, {
        createRecovery: true,
        recoveryReason: 'recovered',
        linkedFile: current.linkedFile,
      })
      return { ...restored, recovered: true }
    }
  }

  async saveProject(projectId: string, name: string, document: ProjectRecord['document'], options: SaveProjectOptions = {}): Promise<ProjectRecord> {
    const database = this.requireDatabase()
    const now = new Date().toISOString()
    const checksum = options.checksum ?? await checksumDocument(document)
    const serializedDocument = options.serializedDocument ?? JSON.stringify(document)
    const recoveryCount = (await this.listRecoveryPoints(projectId)).length + (options.createRecovery ? 1 : 0)
    const summary = projectSummaryFromDocument(
      projectId,
      name,
      document,
      now,
      options.linkedFile?.path ?? '브라우저 앱 보관함 (IndexedDB)',
      Math.min(recoveryCount, 30),
      false,
      options.linkedFile,
    )
    const record: StoredProjectRecord = { ...summary, document, checksum, serializedDocument }
    const recovery = options.createRecovery
      ? {
          recoveryId: `${projectId}:${now}:${document.revision}`,
          projectId,
          createdAt: now,
          reason: options.recoveryReason ?? 'checkpoint',
          checksum: options.recoveryChecksum ?? await checksumDocument(options.recoveryDocument ?? document),
          document: options.recoveryDocument ?? document,
          serializedDocument: options.serializedRecoveryDocument ?? JSON.stringify(options.recoveryDocument ?? document),
        } satisfies StoredRecoveryPoint
      : null
    const transaction = database.transaction([PROJECTS, RECOVERY], 'readwrite', { durability: 'strict' })
    transaction.objectStore(PROJECTS).put(record)
    if (recovery) transaction.objectStore(RECOVERY).put(recovery)

    await transactionDone(transaction)
    const verified = await this.get<StoredProjectRecord>(PROJECTS, projectId)
    if (!verified || verified.checksum !== checksum || deserializeStored(verified).document.revision !== document.revision) {
      throw new Error('저장 후 검증에 실패했습니다. 기존 문서는 변경됨 상태로 유지됩니다.')
    }
    await this.pruneRecoveryPoints(projectId)
    return deserializeStored(verified)
  }

  async moveToTrash(projectId: string): Promise<void> {
    const database = this.requireDatabase()
    const current = await this.get<StoredProjectRecord>(PROJECTS, projectId)
    if (!current) return
    const transaction = database.transaction([PROJECTS, TRASH], 'readwrite', { durability: 'strict' })
    transaction.objectStore(TRASH).put({ ...current, deletedAt: new Date().toISOString() })
    transaction.objectStore(PROJECTS).delete(projectId)
    await transactionDone(transaction)
  }

  async listTrash(): Promise<readonly ProjectSummary[]> {
    return (await this.getAll<StoredProjectRecord>(TRASH))
      .map(({ serializedDocument: _serializedDocument, document: _document, checksum: _checksum, ...summary }) => summary)
      .sort((left, right) => (right.deletedAt ?? '').localeCompare(left.deletedAt ?? ''))
  }

  async restoreFromTrash(projectId: string): Promise<ProjectRecord | null> {
    const database = this.requireDatabase()
    const trashed = await this.get<StoredProjectRecord>(TRASH, projectId)
    if (!trashed) return null
    const transaction = database.transaction([PROJECTS, TRASH], 'readwrite', { durability: 'strict' })
    transaction.objectStore(PROJECTS).put({ ...trashed, deletedAt: undefined, updatedAt: new Date().toISOString() })
    transaction.objectStore(TRASH).delete(projectId)
    await transactionDone(transaction)
    return this.loadProject(projectId)
  }

  async listRecoveryPoints(projectId: string): Promise<readonly RecoveryPoint[]> {
    const records = (await this.getAll<StoredRecoveryPoint>(RECOVERY)).filter((record) => record.projectId === projectId)
    return records
      .map((record) => {
        const result = deserializeDocument(record.serializedDocument)
        if (!result.ok || !result.document) throw new Error('복구본을 읽을 수 없습니다.')
        return { ...record, document: result.document }
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  async restoreRecoveryPoint(projectId: string, recoveryId: string): Promise<ProjectRecord> {
    const point = (await this.listRecoveryPoints(projectId)).find((item) => item.recoveryId === recoveryId)
    if (!point) throw new Error('선택한 복구본이 없습니다.')
    const current = await this.loadProject(projectId)
    return this.saveProject(projectId, current?.name ?? point.document.schema.name, point.document, {
      createRecovery: true,
      recoveryReason: 'recovered',
      linkedFile: current?.linkedFile,
    })
  }

  private async openDatabase(): Promise<IDBDatabase> {
    const request = indexedDB.open(this.databaseName, DB_VERSION)
    request.addEventListener('upgradeneeded', () => {
      const database = request.result
      if (!database.objectStoreNames.contains(PROJECTS)) database.createObjectStore(PROJECTS, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(RECOVERY)) database.createObjectStore(RECOVERY, { keyPath: 'recoveryId' })
      if (!database.objectStoreNames.contains(TRASH)) database.createObjectStore(TRASH, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(META)) database.createObjectStore(META, { keyPath: 'key' })
    })
    return requestResult(request)
  }

  private requireDatabase(): IDBDatabase {
    if (!this.database) throw new Error('프로젝트 저장소가 아직 준비되지 않았습니다.')
    return this.database
  }

  private async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    const transaction = this.requireDatabase().transaction(storeName, 'readonly')
    const result = await requestResult(transaction.objectStore(storeName).get(key))
    await transactionDone(transaction)
    return result as T | undefined
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    const transaction = this.requireDatabase().transaction(storeName, 'readonly')
    const result = await requestResult(transaction.objectStore(storeName).getAll())
    await transactionDone(transaction)
    return result as T[]
  }

  private async migrateLegacyLocalStorage(): Promise<void> {
    if (await this.get<{ key: string; value: boolean }>(META, MIGRATION_MARKER)) return
    let storage: Storage | null = null
    try { storage = globalThis.localStorage } catch { storage = null }
    if (!storage) return
    const rawIndex = storage.getItem(LEGACY_INDEX_KEY)

    if (rawIndex) {
      const summaries = JSON.parse(rawIndex) as { id?: unknown; name?: unknown }[]
      for (const summary of summaries) {
        if (typeof summary.id !== 'string' || typeof summary.name !== 'string') continue
        const rawDocument = storage.getItem(`gsw.project.${summary.id}`)
        if (!rawDocument) continue
        const parsed = deserializeDocument(rawDocument)
        if (!parsed.ok || !parsed.document) continue
        await this.saveProject(summary.id, summary.name, parsed.document, { createRecovery: true, recoveryReason: 'checkpoint' })
      }
    }

    const transaction = this.requireDatabase().transaction(META, 'readwrite')
    transaction.objectStore(META).put({ key: MIGRATION_MARKER, value: true })
    await transactionDone(transaction)
  }

  private async pruneRecoveryPoints(projectId?: string): Promise<void> {
    const all = await this.getAll<StoredRecoveryPoint>(RECOVERY)
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    const grouped = new Map<string, StoredRecoveryPoint[]>()
    for (const point of all) {
      if (projectId && point.projectId !== projectId) continue
      const values = grouped.get(point.projectId) ?? []
      values.push(point)
      grouped.set(point.projectId, values)
    }
    const removals: string[] = []
    for (const points of grouped.values()) {
      points.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      points.forEach((point, index) => {
        if (index >= 30 || new Date(point.createdAt).getTime() < cutoff) removals.push(point.recoveryId)
      })
    }
    if (removals.length === 0) return
    const transaction = this.requireDatabase().transaction(RECOVERY, 'readwrite')
    removals.forEach((key) => transaction.objectStore(RECOVERY).delete(key))
    await transactionDone(transaction)
  }

  private async normalizeLegacyLocations(): Promise<void> {
    const records = await this.getAll<StoredProjectRecord>(PROJECTS)
    const legacy = records.filter((record) => record.location === '이 기기' || record.location === '앱 보관함')
    if (legacy.length === 0) return
    const transaction = this.requireDatabase().transaction(PROJECTS, 'readwrite')
    legacy.forEach((record) => transaction.objectStore(PROJECTS).put({
      ...record,
      location: '브라우저 앱 보관함 (IndexedDB)',
    }))
    await transactionDone(transaction)
  }

  private async pruneTrash(): Promise<void> {
    const records = await this.getAll<StoredProjectRecord>(TRASH)
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    const removals = records
      .filter((record) => record.deletedAt && new Date(record.deletedAt).getTime() < cutoff)
      .map((record) => record.id)
    if (removals.length === 0) return
    const transaction = this.requireDatabase().transaction(TRASH, 'readwrite')
    removals.forEach((key) => transaction.objectStore(TRASH).delete(key))
    await transactionDone(transaction)
  }
}
