import { invoke } from '@tauri-apps/api/core'
import type {
  ProjectRecord,
  ProjectRepository,
  ProjectSummary,
  RecoveryPoint,
  SaveProjectOptions,
} from '../application/projectRepository'
import { deserializeDocument, serializeDocument } from './projectPersistence'

interface NativeProjectRecord extends Omit<ProjectRecord, 'document'> {
  readonly serializedDocument: string
}

interface NativeRecoveryPoint extends Omit<RecoveryPoint, 'document'> {
  readonly serializedDocument: string
}

function parseRecord(record: NativeProjectRecord): ProjectRecord {
  const result = deserializeDocument(record.serializedDocument)
  if (!result.ok || !result.document) throw new Error(result.error ?? '프로젝트 파일을 읽을 수 없습니다.')
  return { ...record, document: result.document }
}

function parseRecovery(point: NativeRecoveryPoint): RecoveryPoint {
  const result = deserializeDocument(point.serializedDocument)
  if (!result.ok || !result.document) throw new Error(result.error ?? '복구본을 읽을 수 없습니다.')
  return { ...point, document: result.document }
}

export class TauriProjectRepository implements ProjectRepository {
  async initialize(): Promise<void> {
    await invoke('initialize_project_repository')
  }

  listProjects(): Promise<readonly ProjectSummary[]> {
    return invoke('list_project_records')
  }

  async loadProject(projectId: string): Promise<ProjectRecord | null> {
    const record = await invoke<NativeProjectRecord | null>('load_project_record', { projectId })
    return record ? parseRecord(record) : null
  }

  async saveProject(projectId: string, name: string, document: ProjectRecord['document'], options: SaveProjectOptions = {}): Promise<ProjectRecord> {
    const record = await invoke<NativeProjectRecord>('save_project_record', {
      input: {
        projectId,
        name,
        serializedDocument: options.serializedDocument ?? serializeDocument(document),
        revision: document.revision,
        tableCount: document.schema.tables.length,
        relationCount: document.schema.relations.length,
        rowCount: Object.values(document.rowsByTable).reduce((sum, rows) => sum + rows.length, 0),
        createRecovery: options.createRecovery ?? false,
        recoveryReason: options.recoveryReason ?? 'checkpoint',
        serializedRecoveryDocument: options.serializedRecoveryDocument,
        linkedFile: options.linkedFile,
      },
    })
    return parseRecord(record)
  }

  moveToTrash(projectId: string): Promise<void> {
    return invoke('trash_project_record', { projectId })
  }

  listTrash(): Promise<readonly ProjectSummary[]> {
    return invoke('list_trashed_project_records')
  }

  async restoreFromTrash(projectId: string): Promise<ProjectRecord | null> {
    const record = await invoke<NativeProjectRecord | null>('restore_trashed_project_record', { projectId })
    return record ? parseRecord(record) : null
  }

  async listRecoveryPoints(projectId: string): Promise<readonly RecoveryPoint[]> {
    const points = await invoke<NativeRecoveryPoint[]>('list_project_recovery_points', { projectId })
    return points.map(parseRecovery)
  }

  async restoreRecoveryPoint(projectId: string, recoveryId: string): Promise<ProjectRecord> {
    const record = await invoke<NativeProjectRecord>('restore_project_recovery_point', { projectId, recoveryId })
    return parseRecord(record)
  }
}
