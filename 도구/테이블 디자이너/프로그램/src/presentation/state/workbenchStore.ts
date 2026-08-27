import { create } from 'zustand'
import type { LinkedProjectFile, ProjectRepository, ProjectSummary, RecoveryPoint, SaveState } from '../../application/projectRepository'
import { projectSummaryFromDocument } from '../../application/projectRepository'
import { serializeProjectRevision } from '../../infrastructure/projectSerialization'
import { importCsvForTable } from '../../application/csvImportExport'
import { compileAiProposalCommands } from '../../application/aiProposalCommands'
import { describeAiBatch, type AiBatchPlan, type GeneratedRowPlan } from '../../application/aiTools'
import {
  ApplyWorkbookRangeCommand,
  DeleteRowsCommand,
  InsertRowsCommand,
  MoveRowsCommand,
  pendingDocumentTransactionFromSerialized,
  ReplaceRowsCommand,
  ReplaceWorkbookMatchesCommand,
  UpdateCellsCommand,
  type CellUpdate,
  type DocumentTransaction,
  type PendingDocumentTransactionSerialized,
} from '../../application/documentCommands'
import {
  applyImportPreview as applyPreparedImport,
  createImportPreview,
  type ImportPreview,
  type ImportSelection,
} from '../../application/importPreview'
import type { SchemaProposal } from '../../application/mockAiProvider'
import { createEmptyProject } from '../../domain/emptyProject'
import {
  createEmptyDataRow,
  createWorkbenchDocument,
  replaceDocumentSchema,
} from '../../application/workbenchDocument'
import {
  AddColumnCommand,
  AddForeignKeyCommand,
  AddUniqueConstraintCommand,
  BackfillColumnCommand,
  ChangeColumnDescriptionCommand,
  ChangeColumnTypeCommand,
  ChangeNullableCommand,
  ChangePrimaryKeyCommand,
  ChangeTableDescriptionCommand,
  commandFromSerialized,
  CreateTableCommand,
  DeleteColumnCommand,
  DeleteForeignKeyCommand,
  DeleteTableCommand,
  materializeCommandForUndo,
  MoveTableLayoutCommand,
  MoveTablesLayoutCommand,
  ReorderColumnCommand,
  RenameColumnCommand,
  RenameTableCommand,
  type SchemaCommand,
  type SerializedCommand,
} from '../../domain/commands'
import { makeId } from '../../domain/ids'
import { getProjectRepository } from '../../infrastructure/projectRepository'
import { deserializeDocument, serializeDocument } from '../../infrastructure/projectPersistence'
import { chooseAndReadExternalProjectFile, chooseAndWriteExternalProjectFile, readExternalProjectFile } from '../../infrastructure/externalProjectFiles'
import { readImportFiles } from '../../infrastructure/importFileReader'
import { requireColumn, requireTable } from '../../domain/projectQueries'
import { crowdProject, crowdSampleRows, sampleIds } from '../../domain/sampleProject'
import { gameCSampleIds, gameCSampleProject, gameCSampleRows } from '../../domain/gameCSampleProject'
import { gameDComplexIds, gameDComplexProject, gameDComplexRows } from '../../domain/gameDComplexProject'
import { createColumn, createRelation, createTable as createSchemaTable, createUniqueConstraint } from '../../domain/schemaFactories'
import type { CanvasNodeLayout, CellValue, ColumnDataType, DataRow, EntityId, SchemaProject, TableWorkbookViewState, ValidationIssue, WorkbenchDocument } from '../../domain/schema'
import type { RoutePoint } from '../smartRelationRouting'
import { EMPTY_TABLE_WORKBOOK_VIEW } from '../../application/workbookViewState'
import astraeContentProjectText from '../../../examples/astrae-territory-case-001/Astrae-Oratio-CASE001.gsw?raw'
import astraeCombatProjectText from '../../../examples/astrae-case001-combat/Astrae-Oratio-CASE001-Combat.gsw?raw'

export type MainView = 'schema' | 'data' | 'design'

export interface AiThreadMessage {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly content: string
  readonly createdAt: string
}

/** AI가 제안했지만 아직 문서에 적용되지 않은 스키마 변경 배치. 승인해야만 적용된다. */
export interface AiPendingBatch {
  readonly id: string
  readonly summary: string
  readonly steps: readonly string[]
  readonly issues: readonly string[]
  readonly commands: readonly SchemaCommand[]
  readonly rowPlans: readonly GeneratedRowPlan[]
}
export type BottomPanel = 'closed' | 'problems' | 'changes'
export type AppView = 'dashboard' | 'workbench'
export type DesignerTab = 'basic' | 'relations'

export interface WorkbenchHistoryEntry {
  readonly historyId: EntityId
  readonly summary: string
  readonly before: WorkbenchDocument
  readonly after: WorkbenchDocument
  readonly command?: SerializedCommand
}

interface WorkbenchState {
  readonly document: WorkbenchDocument
  readonly importIssues: readonly ValidationIssue[]
  readonly selectedTableId: EntityId
  readonly selectedColumnId: EntityId | null
  readonly mainView: MainView
  readonly bottomPanel: BottomPanel
  readonly appView: AppView
  readonly designerTab: DesignerTab
  readonly explorerCollapsed: boolean
  readonly assistantCollapsed: boolean
  readonly assistantWidth: number
  readonly exportOpen: boolean
  readonly importDialogOpen: boolean
  readonly importPreview: ImportPreview | null
  readonly importStatus: 'idle' | 'reading' | 'ready' | 'error'
  readonly importError: string | null
  readonly projects: readonly ProjectSummary[]
  readonly trashedProjects: readonly ProjectSummary[]
  readonly currentProjectId: EntityId | null
  readonly repositoryReady: boolean
  readonly saveState: SaveState
  readonly linkedProjectFile: LinkedProjectFile | null
  readonly externalFileConflict: boolean
  readonly recoveryPoints: readonly RecoveryPoint[]
  readonly recoveryProjectId: EntityId | null
  readonly undoStack: readonly WorkbenchHistoryEntry[]
  readonly redoStack: readonly WorkbenchHistoryEntry[]
  readonly pendingCommand: SerializedCommand | null
  readonly pendingDocumentTransaction: PendingDocumentTransactionSerialized | null
  readonly aiProposal: SchemaProposal | null
  readonly aiStatus: 'idle' | 'running' | 'ready' | 'error'
  readonly aiError: string | null
  readonly aiMessages: readonly AiThreadMessage[]
  readonly aiPendingBatch: AiPendingBatch | null
  selectTable(tableId: EntityId): void
  selectColumn(columnId: EntityId | null): void
  setMainView(view: MainView): void
  setDesignerTab(tab: DesignerTab): void
  setBottomPanel(panel: BottomPanel): void
  setExplorerCollapsed(collapsed: boolean): void
  setAssistantCollapsed(collapsed: boolean): void
  toggleExplorer(): void
  toggleAssistant(): void
  setAssistantWidth(width: number): void
  setExportOpen(open: boolean): void
  updateTableWorkbookView(tableId: EntityId, patch: Partial<TableWorkbookViewState>): void
  prepareImport(files: readonly File[]): Promise<void>
  closeImportDialog(): void
  applyImport(selection: ImportSelection): void
  openSampleProject(): void
  openGameCSampleProject(): void
  openGameDComplexProject(): void
  openNewProject(name?: string): void
  initializeProjectLibrary(): Promise<void>
  openProjectById(projectId: EntityId): Promise<void>
  openProjectFile(file: File): Promise<void>
  openNativeProjectFile(): Promise<void>
  saveProjectAsExternalFile(): Promise<void>
  reloadLinkedProjectFile(): Promise<void>
  renameProjectInLibrary(projectId: EntityId, name: string): Promise<void>
  duplicateProjectFromLibrary(projectId: EntityId): Promise<void>
  getProjectBackup(projectId: EntityId): Promise<{ readonly fileName: string; readonly contents: string } | null>
  loadRecoveryPoints(projectId: EntityId): Promise<void>
  restoreRecoveryPoint(projectId: EntityId, recoveryId: EntityId): Promise<void>
  closeRecoveryPoints(): void
  saveCurrentProject(): Promise<void>
  renameCurrentProject(name: string): void
  deleteProjectFromLibrary(projectId: EntityId): Promise<void>
  loadTrash(): Promise<void>
  restoreProjectFromTrash(projectId: EntityId): Promise<void>
  returnToDashboard(): Promise<void>
  importCsvText(tableId: EntityId, csvText: string): void
  addRow(tableId: EntityId, atIndex?: number): void
  insertRowWithCells(tableId: EntityId, cells: Readonly<Record<EntityId, CellValue>>, atIndex?: number): EntityId
  deleteRows(tableId: EntityId, rowIds: readonly EntityId[]): void
  duplicateRows(tableId: EntityId, rowIds: readonly EntityId[]): void
  updateCell(tableId: EntityId, rowIndex: number, columnId: EntityId, value: unknown): void
  updateCells(tableId: EntityId, updates: readonly CellUpdate[]): void
  applyWorkbookRange(
    tableId: EntityId,
    startWorkbookRowIndex: number,
    startColumnIndex: number,
    matrix: readonly (readonly string[])[],
    targetRowIds?: readonly EntityId[],
  ): void
  replaceWorkbookMatches(tableId: EntityId, query: string, replacement: string): void
  createTable(): void
  deleteTable(tableId: EntityId): void
  addColumnToTable(tableId?: EntityId, options?: { readonly stayInView?: boolean; readonly targetIndex?: number; readonly name?: string }): EntityId | null
  moveColumn(tableId: EntityId, columnId: EntityId, targetIndex: number): void
  moveRows(tableId: EntityId, rowIds: readonly EntityId[], targetIndex: number): void
  deleteColumn(tableId: EntityId, columnId: EntityId): void
  renameTable(tableId: EntityId, nextName: string): void
  renameColumn(tableId: EntityId, columnId: EntityId, nextName: string): void
  changeTableDescription(tableId: EntityId, description: string): void
  changeColumnDescription(tableId: EntityId, columnId: EntityId, description: string): void
  setColumnNullable(tableId: EntityId, columnId: EntityId, nullable: boolean): void
  setPrimaryKey(tableId: EntityId, columnId: EntityId): void
  setPrimaryKeyColumns(tableId: EntityId, columnIds: readonly EntityId[]): void
  setColumnType(tableId: EntityId, columnId: EntityId, dataType: ColumnDataType): void
  setColumnDefault(tableId: EntityId, columnId: EntityId, value: unknown): void
  addUniqueConstraint(tableId: EntityId, columnIds: readonly EntityId[]): void
  moveTableLayout(tableId: EntityId, x: number, y: number): void
  moveTablesLayout(positions: readonly CanvasNodeLayout[]): void
  createForeignKey(sourceTableId: EntityId, sourceColumnId: EntityId, targetTableId: EntityId, targetColumnId: EntityId): void
  createForeignKeyMapping(
    sourceTableId: EntityId,
    sourceColumnIds: readonly EntityId[],
    targetTableId: EntityId,
    targetColumnIds: readonly EntityId[],
  ): void
  deleteRelation(relationId: EntityId): void
  queueCommand(command: SchemaCommand): void
  clearPendingCommand(): void
  applyPendingCommand(options?: { readonly approveDestructive?: boolean }): void
  stageAiCommandSuggestion(): void
  appendAiMessage(role: AiThreadMessage['role'], content: string): void
  clearAiThread(): void
  stageAiToolBatch(plan: AiBatchPlan): void
  applyAiPendingBatch(): void
  discardAiPendingBatch(): void
  runCommand(command: SchemaCommand): void
  runDocumentTransaction(transaction: DocumentTransaction): void
  undo(): void
  redo(): void
  elkRoutes: ReadonlyMap<EntityId, readonly RoutePoint[]>
  setElkRoutes(routes: ReadonlyMap<EntityId, readonly RoutePoint[]>): void
  clearElkRoutes(): void
}

const initialDocument = createWorkbenchDocument(crowdProject, crowdSampleRows)
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
let saveQueue: Promise<void> = Promise.resolve()
let lastRecoveryAt = 0

const bundledPortfolioProjects = [
  astraeContentProjectText,
  astraeCombatProjectText,
] as const

async function installMissingBundledPortfolioProjects(
  repository: ProjectRepository,
  activeProjects: readonly ProjectSummary[],
): Promise<readonly ProjectSummary[]> {
  const trashedProjects = await repository.listTrash()
  const activeProjectIds = new Set(activeProjects.map((project) => project.id))
  const trashedProjectIds = new Set(trashedProjects.map((project) => project.id))
  let installed = false

  for (const serializedDocument of bundledPortfolioProjects) {
    const result = deserializeDocument(serializedDocument)
    if (!result.ok || !result.document) {
      throw new Error(result.error ?? '기본 포트폴리오 프로젝트를 읽지 못했습니다.')
    }

    const document = result.document
    const projectId = document.schema.projectId
    if (trashedProjectIds.has(projectId)) continue

    const existing = activeProjectIds.has(projectId) ? await repository.loadProject(projectId) : null
    if (existing?.document.schema.schemaVersion === document.schema.schemaVersion) continue

    await repository.saveProject(projectId, document.schema.name, document, existing ? {
      createRecovery: true,
      recoveryReason: 'checkpoint',
      recoveryDocument: existing.document,
    } : undefined)
    activeProjectIds.add(projectId)
    installed = true
  }

  return installed ? repository.listProjects() : activeProjects
}

// 자동 배치 직후 ELK가 계산한 엣지 경로 캐시의 다음 상태를 커맨드 타입으로 결정한다.
// 수동 드래그(MoveTableLayout)만 부분 무효화하고 나머지는 전부 비운다 — 잘못된
// 경로가 남는 것보다 라이브 폴백이 낫고, 자동 배치를 다시 누르면 복구된다.
function nextElkRoutesAfterCommand(
  current: ReadonlyMap<EntityId, readonly RoutePoint[]>,
  schema: SchemaProject,
  command: SchemaCommand,
): ReadonlyMap<EntityId, readonly RoutePoint[]> {
  if (current.size === 0) return current

  if (command instanceof MoveTableLayoutCommand) {
    const next = new Map(current)
    for (const relation of schema.relations) {
      if (relation.sourceTableId === command.tableId || relation.targetTableId === command.tableId) {
        next.delete(relation.relationId)
      }
    }
    return next
  }

  return new Map()
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  document: initialDocument,
  elkRoutes: new Map(),
  importIssues: [],
  selectedTableId: sampleIds.rule,
  selectedColumnId: null,
  mainView: 'schema',
  bottomPanel: 'closed',
  appView: 'dashboard',
  designerTab: 'basic',
  explorerCollapsed: false,
  assistantCollapsed: false,
  assistantWidth: 420,
  exportOpen: false,
  importDialogOpen: false,
  importPreview: null,
  importStatus: 'idle',
  importError: null,
  projects: [],
  trashedProjects: [],
  currentProjectId: null,
  repositoryReady: false,
  saveState: { status: 'idle' },
  linkedProjectFile: null,
  externalFileConflict: false,
  recoveryPoints: [],
  recoveryProjectId: null,
  undoStack: [],
  redoStack: [],
  pendingCommand: null,
  pendingDocumentTransaction: null,
  aiProposal: null,
  aiStatus: 'idle',
  aiError: null,
  aiMessages: [],
  aiPendingBatch: null,
  selectTable: (tableId) => set({ selectedTableId: tableId, selectedColumnId: null }),
  selectColumn: (columnId) => set({ selectedColumnId: columnId }),
  setMainView: (view) => set({ mainView: view }),
  setDesignerTab: (designerTab) => set({ designerTab }),
  setBottomPanel: (panel) => set({ bottomPanel: panel }),
  setExplorerCollapsed: (explorerCollapsed) => set({ explorerCollapsed }),
  setAssistantCollapsed: (assistantCollapsed) => set({ assistantCollapsed }),
  toggleExplorer: () => set((state) => ({ explorerCollapsed: !state.explorerCollapsed })),
  toggleAssistant: () => set((state) => ({ assistantCollapsed: !state.assistantCollapsed })),
  setAssistantWidth: (width) => set({ assistantWidth: Math.min(640, Math.max(360, Math.round(width))) }),
  setExportOpen: (open) => set({ exportOpen: open }),
  updateTableWorkbookView: (tableId, patch) => set((state) => {
    if (!state.document.schema.tables.some((table) => table.tableId === tableId)) return state
    const current = state.document.workbookViews[tableId] ?? EMPTY_TABLE_WORKBOOK_VIEW
    const next = {
      document: {
        ...state.document,
        workbookViews: {
          ...state.document.workbookViews,
          [tableId]: { ...current, ...patch },
        },
      },
      saveState: { status: 'dirty' } satisfies SaveState,
    }
    scheduleAutosave()
    return next
  }),
  prepareImport: async (files) => {
    if (files.length === 0) return

    set({ importDialogOpen: true, importStatus: 'reading', importError: null, importPreview: null })

    try {
      const sheets = await readImportFiles(files)
      const preview = createImportPreview(sheets, get().document.schema)
      set({ importPreview: preview, importStatus: 'ready' })
    } catch (error) {
      set({
        importStatus: 'error',
        importError: error instanceof Error ? error.message : '파일을 읽지 못했습니다.',
      })
    }
  },
  closeImportDialog: () => set({ importDialogOpen: false, importPreview: null, importStatus: 'idle', importError: null }),
  applyImport: (selection) => {
    const state = get()
    if (!state.importPreview) return

    const nextDocument = applyPreparedImport(state.document, state.importPreview, selection)
    const firstImported = state.importPreview.tables[0]
    const historyEntry = documentHistory(
      state.document,
      nextDocument,
      `${state.importPreview.tables.length}개 테이블 가져오기`,
    )

    set({
      document: nextDocument,
      selectedTableId: firstImported?.tableId ?? state.selectedTableId,
      selectedColumnId: firstImported?.columns[0]?.columnId ?? null,
      mainView: 'schema',
      undoStack: [...state.undoStack, historyEntry],
      redoStack: [],
      importDialogOpen: false,
      importPreview: null,
      importStatus: 'idle',
      importError: null,
    })
    markCurrentDocumentDirty()
  },
  initializeProjectLibrary: async () => {
    try {
      const repository = await getProjectRepository()
      const currentProjects = await repository.listProjects()
      const projects = await installMissingBundledPortfolioProjects(repository, currentProjects)
      set({ projects, repositoryReady: true })
    } catch (error) {
      set({
        repositoryReady: false,
        saveState: {
          status: 'error',
          message: error instanceof Error ? error.message : '프로젝트 보관함을 열지 못했습니다.',
        },
      })
    }
  },
  openSampleProject: () =>
    set({
      document: createWorkbenchDocument(crowdProject, crowdSampleRows),
      importIssues: [],
      selectedTableId: sampleIds.rule,
      selectedColumnId: null,
      mainView: 'schema',
      bottomPanel: 'closed',
      undoStack: [],
      redoStack: [],
      pendingCommand: null,
      pendingDocumentTransaction: null,
      aiProposal: null,
      aiStatus: 'idle',
      aiError: null,
      aiMessages: [],
      aiPendingBatch: null,
      appView: 'workbench',
      exportOpen: false,
      importDialogOpen: false,
      importPreview: null,
      importStatus: 'idle',
      importError: null,
      currentProjectId: null,
      linkedProjectFile: null,
      externalFileConflict: false,
    }),
  openGameCSampleProject: () => {
    const document = createWorkbenchDocument(gameCSampleProject, gameCSampleRows)

    set({
      document,
      importIssues: [],
      selectedTableId: gameCSampleIds.item,
      selectedColumnId: null,
      mainView: 'schema',
      bottomPanel: 'closed',
      undoStack: [],
      redoStack: [],
      pendingCommand: null,
      pendingDocumentTransaction: null,
      aiProposal: null,
      aiStatus: 'idle',
      aiError: null,
      aiMessages: [],
      aiPendingBatch: null,
      appView: 'workbench',
      exportOpen: false,
      importDialogOpen: false,
      importPreview: null,
      importStatus: 'idle',
      importError: null,
      currentProjectId: gameCSampleProject.projectId,
      saveState: { status: 'dirty' },
      linkedProjectFile: null,
      externalFileConflict: false,
    })
    void hydrateOrPersistSample(gameCSampleProject.projectId, document, gameCSampleIds.item)
  },
  openGameDComplexProject: () => {
    const document = createWorkbenchDocument(gameDComplexProject, gameDComplexRows)

    set({
      document,
      importIssues: [],
      selectedTableId: gameDComplexIds.item,
      selectedColumnId: null,
      mainView: 'schema',
      bottomPanel: 'closed',
      undoStack: [],
      redoStack: [],
      pendingCommand: null,
      pendingDocumentTransaction: null,
      aiProposal: null,
      aiStatus: 'idle',
      aiError: null,
      aiMessages: [],
      aiPendingBatch: null,
      appView: 'workbench',
      exportOpen: false,
      importDialogOpen: false,
      importPreview: null,
      importStatus: 'idle',
      importError: null,
      currentProjectId: gameDComplexProject.projectId,
      saveState: { status: 'dirty' },
      linkedProjectFile: null,
      externalFileConflict: false,
    })
    void hydrateOrPersistSample(gameDComplexProject.projectId, document, gameDComplexIds.item)
  },
  openNewProject: (name) => {
    const uniqueProjectName = uniqueName(
      get().projects.map((project) => project.name),
      name?.trim() || '새 프로젝트',
    )
    const project = createEmptyProject(uniqueProjectName)
    const document = createWorkbenchDocument(project)

    set({
      document,
      importIssues: [],
      selectedTableId: '',
      selectedColumnId: null,
      mainView: 'schema',
      bottomPanel: 'closed',
      undoStack: [],
      redoStack: [],
      pendingCommand: null,
      pendingDocumentTransaction: null,
      aiProposal: null,
      aiStatus: 'idle',
      aiError: null,
      aiMessages: [],
      aiPendingBatch: null,
      appView: 'workbench',
      exportOpen: false,
      importDialogOpen: false,
      importPreview: null,
      importStatus: 'idle',
      importError: null,
      currentProjectId: project.projectId,
      linkedProjectFile: null,
      externalFileConflict: false,
      projects: [
        projectSummaryFromDocument(project.projectId, uniqueProjectName, document, new Date().toISOString(), '저장 준비 중'),
        ...get().projects,
      ],
      saveState: { status: 'dirty' },
    })
    void persistCurrentProject({ checkpoint: true })
  },
  openProjectById: async (projectId) => {
    try {
      await saveQueue
      const repository = await getProjectRepository()
      const record = await repository.loadProject(projectId)
      if (!record) return
      const document = record.document

      const firstTable = document.schema.tables[0]

      set({
        document,
        importIssues: [],
        selectedTableId: firstTable ? firstTable.tableId : '',
        selectedColumnId: null,
        mainView: 'schema',
        bottomPanel: 'closed',
        undoStack: [],
        redoStack: [],
        pendingCommand: null,
        pendingDocumentTransaction: null,
        aiProposal: null,
        aiStatus: 'idle',
        aiError: null,
        appView: 'workbench',
        exportOpen: false,
        importDialogOpen: false,
        importPreview: null,
        importStatus: 'idle',
        importError: null,
        currentProjectId: projectId,
        linkedProjectFile: record.linkedFile ?? null,
        externalFileConflict: false,
        saveState: {
          status: record.recovered ? 'recovered' : 'saved',
          savedAt: record.updatedAt,
          location: record.location,
          recoveryCount: record.recoveryCount,
          message: record.recovered ? '손상된 현재 파일 대신 마지막 정상 복구본을 열었습니다.' : undefined,
        },
      })
    } catch (error) {
      set({ saveState: { status: 'error', message: error instanceof Error ? error.message : '프로젝트를 열지 못했습니다.' } })
    }
  },
  openProjectFile: async (file) => {
    try {
      const text = await file.text()
      const result = deserializeDocument(text)
      if (!result.ok || !result.document) throw new Error(result.error ?? '프로젝트 파일을 읽을 수 없습니다.')
      const document = result.document
      const projectId = document.schema.projectId
      const repository = await getProjectRepository()
      await repository.saveProject(projectId, document.schema.name, document, { createRecovery: true, recoveryReason: 'checkpoint' })
      const firstTable = document.schema.tables[0]
      set({
        document,
        selectedTableId: firstTable?.tableId ?? '',
        selectedColumnId: null,
        mainView: 'schema',
        appView: 'workbench',
        currentProjectId: projectId,
        linkedProjectFile: null,
        externalFileConflict: false,
        projects: await repository.listProjects(),
        undoStack: [],
        redoStack: [],
        saveState: { status: 'saved', savedAt: new Date().toISOString(), location: file.name, recoveryCount: 1 },
      })
    } catch (error) {
      set({ saveState: { status: 'error', message: error instanceof Error ? error.message : '프로젝트 파일을 열지 못했습니다.' } })
    }
  },
  openNativeProjectFile: async () => {
    try {
      const selected = await chooseAndReadExternalProjectFile()
      if (!selected) return
      const result = deserializeDocument(selected.serializedDocument)
      if (!result.ok || !result.document) throw new Error(result.error ?? '프로젝트 파일을 읽을 수 없습니다.')
      const document = result.document
      const repository = await getProjectRepository()
      const record = await repository.saveProject(document.schema.projectId, document.schema.name, document, {
        createRecovery: true,
        recoveryReason: 'checkpoint',
        linkedFile: selected.linkedFile,
      })
      const firstTable = document.schema.tables[0]
      set({
        document,
        selectedTableId: firstTable?.tableId ?? '',
        selectedColumnId: null,
        mainView: 'schema',
        appView: 'workbench',
        currentProjectId: document.schema.projectId,
        linkedProjectFile: selected.linkedFile,
        externalFileConflict: false,
        projects: await repository.listProjects(),
        undoStack: [],
        redoStack: [],
        saveState: {
          status: 'saved',
          savedAt: record.updatedAt,
          location: selected.linkedFile.path,
          recoveryCount: record.recoveryCount,
        },
      })
    } catch (error) {
      set({ saveState: { status: 'error', message: error instanceof Error ? error.message : '프로젝트 파일을 열지 못했습니다.' } })
    }
  },
  saveProjectAsExternalFile: async () => {
    try {
      const state = get()
      const linkedFile = await chooseAndWriteExternalProjectFile(
        `${state.document.schema.name.replaceAll(/[\\/:*?"<>|]/g, '-')}.gsw`,
        serializeDocument(state.document),
      )
      if (!linkedFile) return
      const repository = await getProjectRepository()
      const projectId = state.currentProjectId ?? state.document.schema.projectId
      const record = await repository.saveProject(projectId, state.document.schema.name, state.document, {
        createRecovery: true,
        recoveryReason: 'checkpoint',
        linkedFile,
      })
      set({
        linkedProjectFile: linkedFile,
        externalFileConflict: false,
        projects: await repository.listProjects(),
        saveState: {
          status: 'saved',
          savedAt: record.updatedAt,
          location: linkedFile.path,
          recoveryCount: record.recoveryCount,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '외부 프로젝트 파일을 저장하지 못했습니다.'
      const conflict = message.includes('EXTERNAL_CONFLICT')
      set({
        externalFileConflict: conflict,
        saveState: {
          status: 'error',
          message: conflict ? '연결된 외부 파일이 다른 프로그램에서 변경되었습니다.' : message,
        },
      })
    }
  },
  reloadLinkedProjectFile: async () => {
    const linkedFile = get().linkedProjectFile
    if (!linkedFile) return
    try {
      const selected = await readExternalProjectFile(linkedFile.path)
      const result = deserializeDocument(selected.serializedDocument)
      if (!result.ok || !result.document) throw new Error(result.error ?? '연결된 프로젝트 파일을 읽을 수 없습니다.')
      const document = result.document
      const repository = await getProjectRepository()
      const record = await repository.saveProject(document.schema.projectId, document.schema.name, document, {
        createRecovery: true,
        recoveryReason: 'checkpoint',
        linkedFile: selected.linkedFile,
      })
      const firstTable = document.schema.tables[0]
      set({
        document,
        selectedTableId: firstTable?.tableId ?? '',
        selectedColumnId: null,
        currentProjectId: document.schema.projectId,
        linkedProjectFile: selected.linkedFile,
        externalFileConflict: false,
        undoStack: [],
        redoStack: [],
        projects: await repository.listProjects(),
        saveState: {
          status: 'saved',
          savedAt: record.updatedAt,
          location: selected.linkedFile.path,
          recoveryCount: record.recoveryCount,
        },
      })
    } catch (error) {
      set({ saveState: { status: 'error', message: error instanceof Error ? error.message : '연결된 프로젝트 파일을 다시 불러오지 못했습니다.' } })
    }
  },
  renameProjectInLibrary: async (projectId, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      const repository = await getProjectRepository()
      const record = await repository.loadProject(projectId)
      if (!record) return
      const document = replaceDocumentSchema(record.document, { ...record.document.schema, name: trimmed })
      await repository.saveProject(projectId, trimmed, document, { createRecovery: true, recoveryReason: 'checkpoint', linkedFile: record.linkedFile })
      set({ projects: await repository.listProjects() })
    } catch (error) {
      set({ saveState: { status: 'error', message: error instanceof Error ? error.message : '프로젝트 이름을 변경하지 못했습니다.' } })
    }
  },
  duplicateProjectFromLibrary: async (projectId) => {
    try {
      const repository = await getProjectRepository()
      const record = await repository.loadProject(projectId)
      if (!record) return
      const nextProjectId = makeId('project')
      const nextName = uniqueName(get().projects.map((project) => project.name), `${record.name} 복사본`)
      const document = replaceDocumentSchema(record.document, { ...record.document.schema, projectId: nextProjectId, name: nextName })
      await repository.saveProject(nextProjectId, nextName, document, { createRecovery: true, recoveryReason: 'checkpoint' })
      set({ projects: await repository.listProjects() })
    } catch (error) {
      set({ saveState: { status: 'error', message: error instanceof Error ? error.message : '프로젝트를 복제하지 못했습니다.' } })
    }
  },
  getProjectBackup: async (projectId) => {
    try {
      const repository = await getProjectRepository()
      const record = await repository.loadProject(projectId)
      if (!record) return null
      return { fileName: `${record.name.replaceAll(/\s+/g, '-').toLowerCase()}.gsw`, contents: JSON.stringify(record.document, null, 2) }
    } catch (error) {
      set({ saveState: { status: 'error', message: error instanceof Error ? error.message : '백업 파일을 만들지 못했습니다.' } })
      return null
    }
  },
  loadRecoveryPoints: async (projectId) => {
    try {
      const repository = await getProjectRepository()
      set({ recoveryProjectId: projectId, recoveryPoints: await repository.listRecoveryPoints(projectId) })
    } catch (error) {
      set({ saveState: { status: 'error', message: error instanceof Error ? error.message : '복구 기록을 불러오지 못했습니다.' } })
    }
  },
  restoreRecoveryPoint: async (projectId, recoveryId) => {
    try {
      const repository = await getProjectRepository()
      await repository.restoreRecoveryPoint(projectId, recoveryId)
      set({ projects: await repository.listProjects(), recoveryPoints: await repository.listRecoveryPoints(projectId) })
    } catch (error) {
      set({ saveState: { status: 'error', message: error instanceof Error ? error.message : '복구본을 적용하지 못했습니다.' } })
    }
  },
  closeRecoveryPoints: () => set({ recoveryProjectId: null, recoveryPoints: [] }),
  saveCurrentProject: () => persistCurrentProject({ checkpoint: true }),
  renameCurrentProject: (name) => {
    const state = get()
    const trimmed = name.trim()

    if (!trimmed || trimmed === state.document.schema.name) {
      return
    }

    const nextSchema = { ...state.document.schema, name: trimmed }
    const nextDocument = replaceDocumentSchema(state.document, nextSchema)

    set({ document: nextDocument, saveState: { status: 'dirty' } })
    scheduleAutosave()
  },
  deleteProjectFromLibrary: async (projectId) => {
    const previousProjects = get().projects
    const previousProjectId = get().currentProjectId
    set({
      projects: previousProjects.filter((project) => project.id !== projectId),
      currentProjectId: previousProjectId === projectId ? null : previousProjectId,
    })
    try {
      const repository = await getProjectRepository()
      await repository.moveToTrash(projectId)
      set({
        projects: await repository.listProjects(),
      })
    } catch (error) {
      set({
        projects: previousProjects,
        currentProjectId: previousProjectId,
        saveState: { status: 'error', message: error instanceof Error ? error.message : '프로젝트를 휴지통으로 옮기지 못했습니다.' },
      })
    }
  },
  loadTrash: async () => {
    try {
      const repository = await getProjectRepository()
      set({ trashedProjects: await repository.listTrash() })
    } catch (error) {
      set({ saveState: { status: 'error', message: error instanceof Error ? error.message : '휴지통을 불러오지 못했습니다.' } })
    }
  },
  restoreProjectFromTrash: async (projectId) => {
    try {
      const repository = await getProjectRepository()
      await repository.restoreFromTrash(projectId)
      set({
        projects: await repository.listProjects(),
        trashedProjects: await repository.listTrash(),
      })
    } catch (error) {
      set({ saveState: { status: 'error', message: error instanceof Error ? error.message : '프로젝트를 복원하지 못했습니다.' } })
    }
  },
  returnToDashboard: async () => {
    const leaving = get()
    set({ appView: 'dashboard', exportOpen: false })
    if (leaving.currentProjectId && leaving.saveState.status !== 'saved') {
      await persistCurrentProject({ checkpoint: true })
    }
    try {
      const repository = await getProjectRepository()
      set({ projects: mergeProjectSummaries(await repository.listProjects(), get().projects) })
    } catch { /* The optimistic dashboard and in-memory summaries remain usable. */ }
  },
  importCsvText: (tableId, csvText) => {
    const state = get()
    const result = importCsvForTable(state.document.schema, tableId, csvText)
    const hasBlockingIssue = result.issues.some((issue) => issue.severity === 'blocking' || issue.severity === 'error')

    if (!hasBlockingIssue) {
      get().runDocumentTransaction(new ReplaceRowsCommand(tableId, result.rows, `${result.rows.length}개 CSV 행 가져오기`))
    }

    set({ importIssues: result.issues, selectedTableId: tableId, mainView: 'data', bottomPanel: result.issues.length > 0 ? 'problems' : get().bottomPanel })
  },
  addRow: (tableId, atIndex) => {
    const state = get()
    const rows = state.document.rowsByTable[tableId] ?? []
    get().runDocumentTransaction(new InsertRowsCommand(tableId, atIndex ?? rows.length, [createEmptyDataRow()]))
    set({ selectedTableId: tableId, mainView: 'data' })
  },
  insertRowWithCells: (tableId, cells, atIndex) => {
    const state = get()
    const rows = state.document.rowsByTable[tableId] ?? []
    const rowId = makeId('row')
    get().runDocumentTransaction(new InsertRowsCommand(tableId, atIndex ?? rows.length, [{ rowId, cells: { ...cells } }]))
    set({ selectedTableId: tableId, mainView: 'data' })
    return rowId
  },
  deleteRows: (tableId, rowIds) => {
    if (rowIds.length === 0) return
    get().runDocumentTransaction(new DeleteRowsCommand(tableId, rowIds))
  },
  duplicateRows: (tableId, rowIds) => {
    const state = get()
    const rows = state.document.rowsByTable[tableId] ?? []
    const selected = new Set(rowIds)
    const sourceRows = rows.filter((row) => selected.has(row.rowId))
    if (sourceRows.length === 0) return

    const lastIndex = Math.max(...sourceRows.map((row) => rows.findIndex((candidate) => candidate.rowId === row.rowId)))
    const copies = sourceRows.map((row) => ({ ...row, rowId: makeId('row'), cells: { ...row.cells } }))
    get().runDocumentTransaction(new InsertRowsCommand(tableId, lastIndex + 1, copies))
  },
  updateCell: (tableId, rowIndex, columnId, value) => {
    const state = get()
    const row = state.document.rowsByTable[tableId]?.[rowIndex]
    if (!row) return
    get().updateCells(tableId, [{ rowId: row.rowId, columnId, value: normalizeCellValue(value) }])
  },
  updateCells: (tableId, updates) => {
    if (updates.length === 0) return
    get().runDocumentTransaction(new UpdateCellsCommand(tableId, updates.map((update) => ({
      ...update,
      value: update.value === undefined ? undefined : normalizeCellValue(update.value),
    }))))
  },
  createTable: () => {
    const state = get()
    const tableName = uniqueName(state.document.schema.tables.map((table) => table.name), 'NewTable')
    const tableId = makeId('table')
    const idColumnId = makeId('column')
    const table = createSchemaTable({
      tableId,
      name: tableName,
      columns: [
        {
          columnId: idColumnId,
          name: `${tableName}Id`,
          dataType: { kind: 'string' },
          nullable: false,
        },
      ],
      primaryKeyColumnIds: [idColumnId],
    })
    const index = state.document.schema.tables.length

    get().runCommand(
      new CreateTableCommand({
        table,
        layout: {
          entityId: table.tableId,
          x: 80 + (index % 4) * 230,
          y: 80 + Math.floor(index / 4) * 160,
        },
      }),
    )
    set({ selectedTableId: table.tableId, selectedColumnId: idColumnId, mainView: 'schema' })
  },
  deleteTable: (tableId) => {
    const state = get()
    if (!state.document.schema.tables.some((table) => table.tableId === tableId)) return
    get().queueCommand(new DeleteTableCommand({ tableId }))
  },
  addColumnToTable: (tableId, options) => {
    const state = get()
    const targetTableId = tableId ?? state.selectedTableId
    if (!targetTableId) return null
    const table = requireTable(state.document.schema, targetTableId)
    const column = createColumn({
      tableId: table.tableId,
      name: options?.name?.trim() || uniqueName(table.columns.map((item) => item.name), 'NewColumn'),
      dataType: { kind: 'string' },
      nullable: true,
    })

    get().runCommand(new AddColumnCommand({ tableId: table.tableId, column, targetIndex: options?.targetIndex }))
    set({
      selectedTableId: table.tableId,
      selectedColumnId: column.columnId,
      ...(options?.stayInView ? {} : { mainView: 'design' as const }),
    })
    return column.columnId
  },
  moveColumn: (tableId, columnId, targetIndex) => {
    const state = get()
    const table = requireTable(state.document.schema, tableId)
    const currentIndex = table.columns.findIndex((column) => column.columnId === columnId)
    const boundedTargetIndex = Math.max(0, Math.min(targetIndex, table.columns.length - 1))
    if (currentIndex < 0 || currentIndex === boundedTargetIndex) return

    get().runCommand(new ReorderColumnCommand({ tableId, columnId, targetIndex: boundedTargetIndex }))
    set({ selectedTableId: tableId, selectedColumnId: columnId })
  },
  moveRows: (tableId, rowIds, targetIndex) => {
    if (rowIds.length === 0) return
    get().runDocumentTransaction(new MoveRowsCommand(tableId, rowIds, targetIndex))
    set({ selectedTableId: tableId, mainView: 'data' })
  },
  deleteColumn: (tableId, columnId) => {
    const state = get()
    const table = requireTable(state.document.schema, tableId)
    const column = requireColumn(table, columnId)

    if (table.columns.length <= 1) return
    if (table.primaryKey.columnIds.length === 1 && table.primaryKey.columnIds[0] === columnId) return

    const hasStoredValue = (state.document.rowsByTable[tableId] ?? []).some((row) => {
      const value = row.cells[columnId]
      return value !== undefined && value !== null && value !== ''
    })
    const hasSchemaReference =
      table.primaryKey.columnIds.includes(columnId) ||
      table.uniqueConstraints.some((constraint) => constraint.columnIds.includes(columnId)) ||
      table.checkConstraints.some((constraint) => constraint.columnIds.includes(columnId)) ||
      column.validationRules.length > 0 ||
      state.document.schema.relations.some((relation) => relation.sourceColumnIds.includes(columnId) || relation.targetColumnIds.includes(columnId)) ||
      state.document.schema.functionalDependencies.some(
        (dependency) => dependency.determinantColumnIds.includes(columnId) || dependency.dependentColumnIds.includes(columnId),
      ) ||
      state.document.schema.exportViews.some((view) => view.columns.some((exportColumn) => exportColumn.sourceColumnId === columnId))
    const command = new DeleteColumnCommand({ tableId, columnId, approved: !hasStoredValue && !hasSchemaReference })

    if (hasStoredValue || hasSchemaReference) {
      get().queueCommand(command)
      return
    }

    get().runCommand(command)
    set({ selectedColumnId: null })
  },
  renameTable: (tableId, nextName) => {
    const state = get()
    const table = requireTable(state.document.schema, tableId)
    const normalizedName = nextName.trim()

    if (!normalizedName || normalizedName === table.name) {
      return
    }

    get().runCommand(new RenameTableCommand({ tableId, nextName: normalizedName }))
  },
  changeTableDescription: (tableId, description) => {
    get().runCommand(new ChangeTableDescriptionCommand({ tableId, description }))
  },
  changeColumnDescription: (tableId, columnId, description) => {
    get().runCommand(new ChangeColumnDescriptionCommand({ tableId, columnId, description }))
  },
  renameColumn: (tableId, columnId, nextName) => {
    const state = get()
    const table = requireTable(state.document.schema, tableId)
    const column = requireColumn(table, columnId)
    const normalizedName = nextName.trim()

    if (!normalizedName || normalizedName === column.name) {
      return
    }

    const command = new RenameColumnCommand({ tableId, columnId, nextName: normalizedName })
    if (command.describeImpact(state.document.schema).requiredConfirmations.length > 0) get().queueCommand(command)
    else get().runCommand(command)
  },
  setColumnNullable: (tableId, columnId, nullable) => {
    const state = get()
    const column = requireColumn(requireTable(state.document.schema, tableId), columnId)

    if (column.nullable === nullable) {
      return
    }

    const command = new ChangeNullableCommand({ tableId, columnId, nullable })
    if (command.describeImpact(state.document.schema).requiredConfirmations.length > 0) get().queueCommand(command)
    else get().runCommand(command)
  },
  setPrimaryKey: (tableId, columnId) => {
    const state = get()
    const table = requireTable(state.document.schema, tableId)

    if (table.primaryKey.columnIds.length === 1 && table.primaryKey.columnIds[0] === columnId) {
      return
    }

    get().setPrimaryKeyColumns(tableId, [columnId])
  },
  setPrimaryKeyColumns: (tableId, columnIds) => {
    const state = get()
    const table = requireTable(state.document.schema, tableId)
    const uniqueColumnIds = [...new Set(columnIds)]

    if (
      uniqueColumnIds.length === 0 ||
      (table.primaryKey.columnIds.length === uniqueColumnIds.length &&
        table.primaryKey.columnIds.every((columnId) => uniqueColumnIds.includes(columnId)))
    ) {
      return
    }

    get().queueCommand(new ChangePrimaryKeyCommand({ tableId, nextColumnIds: uniqueColumnIds }))
  },
  setColumnType: (tableId, columnId, dataType) => {
    const state = get()
    const column = requireColumn(requireTable(state.document.schema, tableId), columnId)

    if (column.dataType.kind === dataType.kind) {
      return
    }

    get().queueCommand(new ChangeColumnTypeCommand({ tableId, columnId, nextDataType: dataType }))
  },
  setColumnDefault: (tableId, columnId, value) => {
    const state = get()
    const column = requireColumn(requireTable(state.document.schema, tableId), columnId)

    if (Object.is(column.defaultValue, value)) {
      return
    }

    get().runCommand(new BackfillColumnCommand({
      tableId,
      columnId,
      strategy: 'fixed_default',
      value,
    }))
  },
  applyWorkbookRange: (tableId, startWorkbookRowIndex, startColumnIndex, matrix, targetRowIds = []) => {
    const state = get()
    const transaction = new ApplyWorkbookRangeCommand(
      tableId,
      startWorkbookRowIndex,
      startColumnIndex,
      matrix,
      targetRowIds,
    )
    const errors = transaction.validate(state.document)
    if (errors.length > 0) throw new Error(errors[0])

    if (transaction.requiredConfirmations(state.document).length > 0) {
      set({
        pendingCommand: null,
        pendingDocumentTransaction: transaction.serialize(),
        bottomPanel: 'changes',
      })
      return
    }
    get().runDocumentTransaction(transaction)
  },
  replaceWorkbookMatches: (tableId, query, replacement) => {
    const state = get()
    const transaction = new ReplaceWorkbookMatchesCommand(tableId, query, replacement)
    const errors = transaction.validate(state.document)
    if (errors.length > 0) throw new Error(errors[0])
    if (transaction.requiredConfirmations(state.document).length > 0) {
      set({
        pendingCommand: null,
        pendingDocumentTransaction: transaction.serialize(),
        bottomPanel: 'changes',
      })
      return
    }
    get().runDocumentTransaction(transaction)
  },
  addUniqueConstraint: (tableId, columnIds) => {
    const state = get()
    const table = requireTable(state.document.schema, tableId)
    const selected = [...new Set(columnIds)]

    if (selected.length === 0) return

    const baseName = `UQ_${table.name}_${selected.map((columnId) => requireColumn(table, columnId).name).join('_')}`
    const name = uniqueName(table.uniqueConstraints.map((constraint) => constraint.name), baseName)
    get().runCommand(new AddUniqueConstraintCommand({
      tableId,
      constraint: createUniqueConstraint(name, selected),
    }))
  },
  setElkRoutes: (routes) => {
    set({ elkRoutes: new Map(routes) })
  },
  clearElkRoutes: () => {
    if (get().elkRoutes.size === 0) return
    set({ elkRoutes: new Map() })
  },
  moveTableLayout: (tableId, x, y) => {
    const state = get()
    const roundedX = Math.round(x)
    const roundedY = Math.round(y)
    const current = state.document.schema.layout.nodes.find((node) => node.entityId === tableId)

    if (current && current.x === roundedX && current.y === roundedY) {
      return
    }

    get().runCommand(new MoveTableLayoutCommand({ tableId, x: roundedX, y: roundedY }))
  },
  moveTablesLayout: (positions) => {
    if (positions.length === 0) return
    get().runCommand(new MoveTablesLayoutCommand({
      positions: positions.map((position) => ({
        entityId: position.entityId,
        x: Math.round(position.x),
        y: Math.round(position.y),
      })),
    }))
  },
  createForeignKey: (sourceTableId, sourceColumnId, targetTableId, targetColumnId) => {
    get().createForeignKeyMapping(sourceTableId, [sourceColumnId], targetTableId, [targetColumnId])
  },
  createForeignKeyMapping: (sourceTableId, sourceColumnIds, targetTableId, targetColumnIds) => {
    const state = get()
    const sourceTable = requireTable(state.document.schema, sourceTableId)
    const targetTable = requireTable(state.document.schema, targetTableId)
    const sourceColumns = sourceColumnIds.map((columnId) => requireColumn(sourceTable, columnId))
    targetColumnIds.forEach((columnId) => requireColumn(targetTable, columnId))

    if (sourceColumns.length === 0 || sourceColumns.length !== targetColumnIds.length) {
      return
    }

    const relationName = uniqueName(
      state.document.schema.relations.map((relation) => relation.name),
      `${sourceTable.name}_${sourceColumns.map((column) => column.name).join('_')}_to_${targetTable.name}`,
    )

    get().runCommand(
      new AddForeignKeyCommand({
        relation: createRelation({
          name: relationName,
          sourceTableId,
          sourceColumnIds: sourceColumns.map((column) => column.columnId),
          targetTableId,
          targetColumnIds,
          kind: 'hard_fk',
        }),
      }),
    )
  },
  deleteRelation: (relationId) => {
    const state = get()
    if (!state.document.schema.relations.some((relation) => relation.relationId === relationId)) return
    // 파괴적 명령이므로 즉시 실행하지 않고 검토 대기열로 보낸다(다른 delete*와 동일한 승인 경로).
    get().queueCommand(new DeleteForeignKeyCommand({ relationId }))
  },
  queueCommand: (command) => {
    const state = get()
    const pendingCommand = materializeCommandForUndo(state.document.schema, command)

    set({
      pendingCommand,
      pendingDocumentTransaction: null,
      bottomPanel: 'changes',
    })
  },
  clearPendingCommand: () => set({ pendingCommand: null, pendingDocumentTransaction: null, bottomPanel: 'closed' }),
  applyPendingCommand: (options) => {
    const state = get()

    if (!state.pendingCommand && !state.pendingDocumentTransaction) {
      return
    }

    if (state.pendingDocumentTransaction) {
      const transaction = pendingDocumentTransactionFromSerialized(state.pendingDocumentTransaction, true)
      const nextDocument = transaction.execute(state.document).document
      const historyEntry = documentHistory(state.document, nextDocument, transaction.summary)
      set({
        document: nextDocument,
        undoStack: [...state.undoStack, historyEntry],
        redoStack: [],
        pendingCommand: null,
        pendingDocumentTransaction: null,
        bottomPanel: 'closed',
        saveState: { status: 'dirty' },
      })
      void persistCurrentProject({ checkpoint: true, recoveryDocument: state.document })
      return
    }

    const pendingCommand = state.pendingCommand!

    const command = commandFromSerialized(
      options?.approveDestructive ? approveSerializedCommand(pendingCommand) : pendingCommand,
    )
    const nextSchema = command.execute(state.document.schema)
    const nextDocument = replaceDocumentSchema(state.document, nextSchema)
    let nextSelectedTableId = state.selectedTableId
    let nextSelectedColumnId = pendingCommand.type === 'DeleteColumn' && pendingCommand.columnId === state.selectedColumnId
      ? null
      : state.selectedColumnId
    let nextMainView = state.mainView

    if (pendingCommand.type === 'DeleteTable' && pendingCommand.tableId === state.selectedTableId) {
      const deletedIndex = state.document.schema.tables.findIndex((table) => table.tableId === pendingCommand.tableId)
      nextSelectedTableId = nextSchema.tables[deletedIndex]?.tableId
        ?? nextSchema.tables[deletedIndex - 1]?.tableId
        ?? ''
      nextSelectedColumnId = null
      if (!nextSelectedTableId) nextMainView = 'schema'
    }
    const historyEntry = documentHistory(
      state.document,
      nextDocument,
      command.describe(state.document.schema),
      command.serialize(),
    )

    set({
      document: nextDocument,
      undoStack: [...state.undoStack, historyEntry],
      redoStack: [],
      pendingCommand: null,
      pendingDocumentTransaction: null,
      bottomPanel: 'closed',
      selectedTableId: nextSelectedTableId,
      selectedColumnId: nextSelectedColumnId,
      mainView: nextMainView,
      saveState: { status: 'dirty' },
    })
    void persistCurrentProject({ checkpoint: true, recoveryDocument: state.document })
  },
  appendAiMessage: (role, content) => set((state) => ({
    aiMessages: [
      ...state.aiMessages,
      { id: makeId('ai_message'), role, content, createdAt: new Date().toISOString() },
    ],
  })),
  clearAiThread: () => set({ aiMessages: [], aiProposal: null, aiError: null, aiStatus: 'idle', aiPendingBatch: null }),
  stageAiToolBatch: (plan) => {
    if (plan.commands.length === 0 && plan.rowPlans.length === 0 && plan.issues.length === 0) {
      return
    }

    set({
      aiPendingBatch: {
        id: makeId('ai_batch'),
        summary: describeAiBatch(plan),
        steps: plan.steps,
        issues: plan.issues,
        commands: plan.commands,
        rowPlans: plan.rowPlans,
      },
    })
  },
  discardAiPendingBatch: () => set({ aiPendingBatch: null }),
  applyAiPendingBatch: () => {
    const batch = get().aiPendingBatch

    if (!batch || (batch.commands.length === 0 && batch.rowPlans.length === 0)) {
      return
    }

    // 스키마 변경과 행 생성을 히스토리 항목 하나로 묶어 Undo 한 번에 되돌릴 수 있게 한다.
    get().runDocumentTransaction({
      transactionId: makeId('transaction'),
      type: 'AiSchemaBatch',
      summary: `AI 제안 적용: ${batch.summary}`,
      execute: (document) => {
        const nextSchema = batch.commands.reduce((schema, command) => command.execute(schema), document.schema)
        let nextDocument = replaceDocumentSchema(document, nextSchema)
        const changedRowIds: string[] = []

        for (const rowPlan of batch.rowPlans) {
          const table = nextDocument.schema.tables.find((candidate) => candidate.name === rowPlan.tableName)

          if (!table) {
            continue
          }

          const existingCount = (nextDocument.rowsByTable[table.tableId] ?? []).length
          nextDocument = new InsertRowsCommand(table.tableId, existingCount, rowPlan.rows).execute(nextDocument).document
          changedRowIds.push(...rowPlan.rows.map((row) => row.rowId))
        }

        return {
          document: nextDocument,
          changedTableIds: nextDocument.schema.tables.map((table) => table.tableId),
          changedRowIds,
        }
      },
    })

    set({
      aiPendingBatch: null,
      mainView: batch.rowPlans.length > 0 && batch.commands.length === 0 ? 'data' : 'schema',
    })
  },
  stageAiCommandSuggestion: () => {
    const state = get()
    if (!state.aiProposal) {
      return
    }
    const candidate = compileAiProposalCommands(state.document.schema, state.aiProposal)[0]
    if (!candidate) {
      set({ aiError: '이 제안에는 안전하게 변환할 수 있는 typed Command 초안이 없습니다.' })
      return
    }
    get().queueCommand(candidate.command)
  },
  runCommand: (command) => {
    const state = get()
    const undoable = materializeCommandForUndo(state.document.schema, command)
    const nextSchema = commandFromSerialized(undoable).execute(state.document.schema)
    const nextDocument = replaceDocumentSchema(state.document, nextSchema)
    const historyEntry = documentHistory(
      state.document,
      nextDocument,
      command.describe(state.document.schema),
      undoable,
    )

    set({
      document: nextDocument,
      undoStack: [...state.undoStack, historyEntry],
      redoStack: [],
      saveState: { status: 'dirty' },
      elkRoutes: nextElkRoutesAfterCommand(state.elkRoutes, state.document.schema, command),
    })
    scheduleAutosave()
  },
  runDocumentTransaction: (transaction) => {
    const state = get()
    const nextDocument = transaction.execute(state.document).document
    const historyEntry = documentHistory(state.document, nextDocument, transaction.summary)

    set({
      document: nextDocument,
      undoStack: [...state.undoStack, historyEntry],
      redoStack: [],
      saveState: { status: 'dirty' },
      elkRoutes: new Map(),
    })
    scheduleAutosave()
  },
  undo: () => {
    const state = get()
    const entry = state.undoStack.at(-1)

    if (!entry) {
      return
    }

    set({
      document: entry.before,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, entry],
      saveState: { status: 'dirty' },
      elkRoutes: new Map(),
    })
    scheduleAutosave()
  },
  redo: () => {
    const state = get()
    const entry = state.redoStack.at(-1)

    if (!entry) {
      return
    }

    set({
      document: entry.after,
      undoStack: [...state.undoStack, entry],
      redoStack: state.redoStack.slice(0, -1),
      saveState: { status: 'dirty' },
      elkRoutes: new Map(),
    })
    scheduleAutosave()
  },
}))

function markCurrentDocumentDirty(): void {
  useWorkbenchStore.setState({ saveState: { status: 'dirty' } })
  scheduleAutosave()
}

function scheduleAutosave(): void {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null
    void persistCurrentProject()
  }, 600)
}

async function persistCurrentProject(options: {
  readonly checkpoint?: boolean
  readonly recoveryDocument?: WorkbenchDocument
} = {}): Promise<void> {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
  }

  const requested = useWorkbenchStore.getState()
  const projectId = requested.currentProjectId ?? requested.document.schema.projectId
  const document = requested.document
  const name = document.schema.name
  const now = Date.now()
  const createRecovery = options.checkpoint || now - lastRecoveryAt >= 5 * 60 * 1000

  useWorkbenchStore.setState({ saveState: { ...requested.saveState, status: 'saving', message: undefined } })

  saveQueue = saveQueue.then(async () => {
    try {
      const repository = await getProjectRepository()
      const serialized = await serializeProjectRevision(document)
      const serializedRecovery = options.recoveryDocument
        ? await serializeProjectRevision(options.recoveryDocument)
        : undefined
      const record = await repository.saveProject(projectId, name, document, {
        createRecovery,
        recoveryReason: options.checkpoint ? 'checkpoint' : 'interval',
        linkedFile: requested.linkedProjectFile ?? undefined,
        ...serialized,
        recoveryDocument: options.recoveryDocument,
        serializedRecoveryDocument: serializedRecovery?.serializedDocument,
        recoveryChecksum: serializedRecovery?.checksum,
      })
      if (createRecovery) lastRecoveryAt = Date.now()
      const current = useWorkbenchStore.getState()
      const documentChangedDuringSave = current.currentProjectId === projectId && current.document.revision !== document.revision
      const storedProjects = await repository.listProjects()
      if (current.currentProjectId !== projectId) {
        useWorkbenchStore.setState({ projects: mergeProjectSummaries(storedProjects, current.projects) })
        return
      }
      useWorkbenchStore.setState({
        linkedProjectFile: record.linkedFile ?? requested.linkedProjectFile,
        externalFileConflict: false,
        projects: mergeProjectSummaries(storedProjects, current.projects),
        saveState: documentChangedDuringSave
          ? { status: 'dirty', message: '저장 중 새 변경이 생겨 다음 자동 저장을 기다리고 있습니다.' }
          : {
              status: 'saved',
              savedAt: record.updatedAt,
              location: record.location,
              recoveryCount: record.recoveryCount,
            },
      })
      if (documentChangedDuringSave) scheduleAutosave()
    } catch (error) {
      const message = error instanceof Error ? error.message : '프로젝트 저장에 실패했습니다.'
      const conflict = message.includes('EXTERNAL_CONFLICT')
      if (useWorkbenchStore.getState().currentProjectId === projectId) {
        useWorkbenchStore.setState({
          externalFileConflict: conflict,
          saveState: {
            status: 'error',
            message: conflict ? '연결된 외부 파일이 다른 프로그램에서 변경되었습니다.' : message,
          },
        })
      }
    }
  })

  return saveQueue
}

async function hydrateOrPersistSample(projectId: EntityId, fallback: WorkbenchDocument, selectedTableId: EntityId): Promise<void> {
  try {
    const repository = await getProjectRepository()
    const existing = await repository.loadProject(projectId)
    if (existing) {
      useWorkbenchStore.setState({
        document: existing.document,
        selectedTableId,
        linkedProjectFile: existing.linkedFile ?? null,
        externalFileConflict: false,
        saveState: {
          status: existing.recovered ? 'recovered' : 'saved',
          savedAt: existing.updatedAt,
          location: existing.location,
          recoveryCount: existing.recoveryCount,
        },
      })
      return
    }
    const saved = await repository.saveProject(projectId, fallback.schema.name, fallback, { createRecovery: true, recoveryReason: 'checkpoint' })
    useWorkbenchStore.setState({
      projects: await repository.listProjects(),
      saveState: { status: 'saved', savedAt: saved.updatedAt, location: saved.location, recoveryCount: saved.recoveryCount },
    })
  } catch (error) {
    useWorkbenchStore.setState({ saveState: { status: 'error', message: error instanceof Error ? error.message : '예제 프로젝트를 저장하지 못했습니다.' } })
  }
}

function documentHistory(
  before: WorkbenchDocument,
  after: WorkbenchDocument,
  summary: string,
  command?: SerializedCommand,
): WorkbenchHistoryEntry {
  return {
    historyId: makeId('history'),
    summary,
    before,
    after,
    command,
  }
}

function normalizeCellValue(value: unknown): DataRow['cells'][string] {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(normalizeCellValue)
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeCellValue(item)]))
  }

  return String(value)
}

function uniqueName(existingNames: readonly string[], baseName: string): string {
  const used = new Set(existingNames.map((name) => name.toLowerCase()))

  if (!used.has(baseName.toLowerCase())) {
    return baseName
  }

  let index = 2
  let candidate = `${baseName}${index}`

  while (used.has(candidate.toLowerCase())) {
    index += 1
    candidate = `${baseName}${index}`
  }

  return candidate
}

function mergeProjectSummaries(
  stored: readonly ProjectSummary[],
  current: readonly ProjectSummary[],
): readonly ProjectSummary[] {
  const storedIds = new Set(stored.map((project) => project.id))
  const pending = current.filter((project) => !storedIds.has(project.id))
  return [...pending, ...stored]
}

function approveSerializedCommand(command: SerializedCommand): SerializedCommand {
  switch (command.type) {
    case 'DeleteColumn':
    case 'DeleteTable':
    case 'DeleteForeignKey':
    case 'SplitTable':
    case 'MergeTable':
      return { ...command, approved: true } as SerializedCommand
    default:
      return command
  }
}
