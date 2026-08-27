import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  LayoutDashboard,
  LoaderCircle,
  Redo2,
  RotateCcw,
  Rows3,
  Save,
  Settings2,
  ShieldCheck,
  Undo2,
  Upload,
} from 'lucide-react'
import { useState } from 'react'
import { isDesktopRuntime } from '../../infrastructure/externalProjectFiles'
import { useWorkbenchStore, type MainView } from '../state/workbenchStore'
import { CommandHistoryMenu } from './CommandHistoryMenu'

const viewButtons: readonly { readonly id: MainView; readonly label: string; readonly icon: typeof Database }[] = [
  { id: 'schema', label: '전체 구조', icon: Database },
  { id: 'data', label: '테이블 편집', icon: Rows3 },
  { id: 'design', label: '테이블 설계', icon: Settings2 },
]

export function TopBar() {
  const project = useWorkbenchStore((state) => state.document.schema)
  const mainView = useWorkbenchStore((state) => state.mainView)
  const undoStack = useWorkbenchStore((state) => state.undoStack)
  const redoStack = useWorkbenchStore((state) => state.redoStack)
  const setMainView = useWorkbenchStore((state) => state.setMainView)
  const setBottomPanel = useWorkbenchStore((state) => state.setBottomPanel)
  const setExportOpen = useWorkbenchStore((state) => state.setExportOpen)
  const prepareImport = useWorkbenchStore((state) => state.prepareImport)
  const undo = useWorkbenchStore((state) => state.undo)
  const redo = useWorkbenchStore((state) => state.redo)
  const returnToDashboard = useWorkbenchStore((state) => state.returnToDashboard)
  const saveCurrentProject = useWorkbenchStore((state) => state.saveCurrentProject)
  const renameCurrentProject = useWorkbenchStore((state) => state.renameCurrentProject)
  const saveProjectAsExternalFile = useWorkbenchStore((state) => state.saveProjectAsExternalFile)
  const reloadLinkedProjectFile = useWorkbenchStore((state) => state.reloadLinkedProjectFile)
  const saveState = useWorkbenchStore((state) => state.saveState)
  const linkedProjectFile = useWorkbenchStore((state) => state.linkedProjectFile)
  const externalFileConflict = useWorkbenchStore((state) => state.externalFileConflict)
  const [saveDetailsOpen, setSaveDetailsOpen] = useState(false)

  const saveLabel = saveState.status === 'dirty'
    ? '변경됨'
    : saveState.status === 'saving'
      ? '저장 중'
      : saveState.status === 'error'
        ? '저장 실패'
        : saveState.status === 'recovered'
          ? '복구됨'
          : saveState.status === 'saved' && saveState.savedAt
            ? `저장됨 · ${new Date(saveState.savedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
            : '변경됨'
  const SaveStateIcon = saveState.status === 'saving'
    ? LoaderCircle
    : saveState.status === 'error'
      ? AlertTriangle
      : saveState.status === 'recovered'
        ? RotateCcw
        : CheckCircle2

  return (
    <header className="top-bar">
      <div className="project-context">
        <button className="icon-button" type="button" title="내 프로젝트로" onClick={returnToDashboard}>
          <LayoutDashboard aria-hidden="true" size={17} />
        </button>
        <div className="project-identity">
          <input
            key={project.projectId}
            className="project-name-input"
            defaultValue={project.name}
            aria-label="프로젝트 이름"
            onBlur={(event) => renameCurrentProject(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
          <div className="save-status-wrap">
            <button
              className={`save-indicator save-indicator--${saveState.status}`}
              type="button"
              role="status"
              aria-expanded={saveDetailsOpen}
              onClick={() => setSaveDetailsOpen((open) => !open)}
            >
              <SaveStateIcon aria-hidden="true" size={12} className={saveState.status === 'saving' ? 'spin' : undefined} />
              {saveLabel}
            </button>
            {saveDetailsOpen && (
              <div className="save-status-popover" role="dialog" aria-label="프로젝트 저장 정보">
                <strong>{saveLabel}</strong>
                <span>위치: {saveState.location ?? '앱 보관함'}</span>
                <span>복구본: {saveState.recoveryCount ?? 0}개</span>
                {saveState.message && <p>{saveState.message}</p>}
                {saveState.status === 'error' && (
                  <button className="tool-button" type="button" onClick={() => void saveCurrentProject()}>다시 저장</button>
                )}
                {externalFileConflict && linkedProjectFile && (
                  <div className="save-conflict-actions">
                    <button className="tool-button" type="button" onClick={() => void reloadLinkedProjectFile()}>다시 불러오기</button>
                    <button className="tool-button" type="button" onClick={() => void saveProjectAsExternalFile()}>복사본 저장</button>
                  </div>
                )}
                {isDesktopRuntime() && !externalFileConflict && (
                  <button className="tool-button" type="button" onClick={() => void saveProjectAsExternalFile()}>
                    {linkedProjectFile ? '연결 파일 바꾸기' : '외부 .gsw 파일로 저장'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <nav className="view-switch" aria-label="주요 보기">
        {viewButtons.map((view) => {
          const Icon = view.icon
          return (
            <button
              key={view.id}
              className={mainView === view.id ? 'segmented active' : 'segmented'}
              type="button"
              onClick={() => setMainView(view.id)}
            >
              <Icon aria-hidden="true" size={15} />
              <span>{view.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="toolbar primary-toolbar" aria-label="주요 작업">
        <label className="tool-button compact-tool" title="CSV 묶음 또는 Excel 통합 문서 가져오기">
          <Upload aria-hidden="true" size={15} />
          <span>가져오기</span>
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            multiple
            onChange={(event) => {
              const files = [...(event.currentTarget.files ?? [])]
              if (files.length === 0) return
              void prepareImport(files)
              event.currentTarget.value = ''
            }}
          />
        </label>
        <button className="icon-button" type="button" title="실행 취소" aria-keyshortcuts="Control+Z Meta+Z" disabled={undoStack.length === 0} onClick={undo}>
          <Undo2 aria-hidden="true" size={17} />
        </button>
        <button className="icon-button" type="button" title="다시 실행" aria-keyshortcuts="Control+Y Control+Shift+Z Meta+Shift+Z" disabled={redoStack.length === 0} onClick={redo}>
          <Redo2 aria-hidden="true" size={17} />
        </button>
        <CommandHistoryMenu />
        <button className="tool-button compact-tool" type="button" onClick={() => setBottomPanel('problems')}>
          <ShieldCheck aria-hidden="true" size={15} />
          <span>검증</span>
        </button>
        <button className="tool-button strong compact-tool" type="button" title="지금 저장하고 복구 지점 만들기 (Ctrl+S)" onClick={() => void saveCurrentProject()}>
          <Save aria-hidden="true" size={15} />
          <span>저장</span>
        </button>
        <button className="tool-button compact-tool" type="button" onClick={() => setExportOpen(true)}>
          <Download aria-hidden="true" size={15} />
          <span>내보내기</span>
        </button>
      </div>
    </header>
  )
}
