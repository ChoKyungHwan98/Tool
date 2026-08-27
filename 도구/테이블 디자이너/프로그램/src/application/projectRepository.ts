import type { WorkbenchDocument } from '../domain/schema'

export type SaveStateStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'recovered'

export interface SaveState {
  readonly status: SaveStateStatus
  readonly savedAt?: string
  readonly message?: string
  readonly location?: string
  readonly recoveryCount?: number
}

export interface LinkedProjectFile {
  readonly path: string
  readonly lastKnownModifiedAt: string
  readonly checksum: string
}

export interface ProjectSummary {
  readonly id: string
  readonly name: string
  readonly tableCount: number
  readonly relationCount: number
  readonly rowCount: number
  readonly updatedAt: string
  readonly location: string
  readonly recoveryCount: number
  readonly recovered: boolean
  readonly linkedFile?: LinkedProjectFile
}

export interface ProjectRecord extends ProjectSummary {
  readonly document: WorkbenchDocument
  readonly checksum: string
  readonly deletedAt?: string
}

export interface RecoveryPoint {
  readonly recoveryId: string
  readonly projectId: string
  readonly createdAt: string
  readonly reason: 'interval' | 'destructive' | 'checkpoint' | 'recovered'
  readonly checksum: string
  readonly document: WorkbenchDocument
}

export interface SaveProjectOptions {
  readonly createRecovery?: boolean
  readonly recoveryReason?: RecoveryPoint['reason']
  readonly linkedFile?: LinkedProjectFile
  readonly serializedDocument?: string
  readonly checksum?: string
  readonly recoveryDocument?: WorkbenchDocument
  readonly serializedRecoveryDocument?: string
  readonly recoveryChecksum?: string
}

export interface ProjectRepository {
  initialize(): Promise<void>
  listProjects(): Promise<readonly ProjectSummary[]>
  loadProject(projectId: string): Promise<ProjectRecord | null>
  saveProject(projectId: string, name: string, document: WorkbenchDocument, options?: SaveProjectOptions): Promise<ProjectRecord>
  moveToTrash(projectId: string): Promise<void>
  listTrash(): Promise<readonly ProjectSummary[]>
  restoreFromTrash(projectId: string): Promise<ProjectRecord | null>
  listRecoveryPoints(projectId: string): Promise<readonly RecoveryPoint[]>
  restoreRecoveryPoint(projectId: string, recoveryId: string): Promise<ProjectRecord>
}

export function projectSummaryFromDocument(
  projectId: string,
  name: string,
  document: WorkbenchDocument,
  updatedAt: string,
  location: string,
  recoveryCount = 0,
  recovered = false,
  linkedFile?: LinkedProjectFile,
): ProjectSummary {
  return {
    id: projectId,
    name,
    tableCount: document.schema.tables.length,
    relationCount: document.schema.relations.length,
    rowCount: Object.values(document.rowsByTable).reduce((sum, rows) => sum + rows.length, 0),
    updatedAt,
    location,
    recoveryCount,
    recovered,
    linkedFile,
  }
}
