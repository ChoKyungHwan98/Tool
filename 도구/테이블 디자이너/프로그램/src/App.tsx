import '@xyflow/react/dist/style.css'
import './App.css'
import './presentation/styles/polish.css'
import { useEffect, useState, type CSSProperties } from 'react'
import { AiAssistantPanel } from './presentation/components/AiAssistantPanel'
import { BottomPanel } from './presentation/components/BottomPanel'
import { Dashboard } from './presentation/components/Dashboard'
import { DataGridView } from './presentation/components/DataGridView'
import { ExportDrawer } from './presentation/components/ExportDrawer'
import { ImportPreviewDialog } from './presentation/components/ImportPreviewDialog'
import { ProjectExplorer } from './presentation/components/ProjectExplorer'
import { SchemaCanvas } from './presentation/components/SchemaCanvas'
import { TableDesignerView } from './presentation/components/TableDesignerView'
import { TopBar } from './presentation/components/TopBar'
import { installChatPersistence } from './presentation/state/chatPersistence'
import { installScreenHistory } from './presentation/state/screenHistory'
import { useWorkbenchStore } from './presentation/state/workbenchStore'

function isNativeTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.classList.contains('spreadsheet-keyboard-capture')) return false
  return target.matches('input, textarea, select, [contenteditable="true"]')
}

function App() {
  const appView = useWorkbenchStore((state) => state.appView)
  const mainView = useWorkbenchStore((state) => state.mainView)
  const bottomPanel = useWorkbenchStore((state) => state.bottomPanel)
  const explorerCollapsed = useWorkbenchStore((state) => state.explorerCollapsed)
  const assistantCollapsed = useWorkbenchStore((state) => state.assistantCollapsed)
  const assistantWidth = useWorkbenchStore((state) => state.assistantWidth)
  const setExplorerCollapsed = useWorkbenchStore((state) => state.setExplorerCollapsed)
  const setAssistantCollapsed = useWorkbenchStore((state) => state.setAssistantCollapsed)
  const initializeProjectLibrary = useWorkbenchStore((state) => state.initializeProjectLibrary)
  const saveCurrentProject = useWorkbenchStore((state) => state.saveCurrentProject)
  const saveState = useWorkbenchStore((state) => state.saveState)
  const undo = useWorkbenchStore((state) => state.undo)
  const redo = useWorkbenchStore((state) => state.redo)
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1279px)').matches)

  useEffect(() => {
    void initializeProjectLibrary()
  }, [initializeProjectLibrary])

  // 마우스 사이드 버튼 앞뒤 이동 + 스튜디오 상단 뒤로가기 요청 응답
  useEffect(() => installScreenHistory(), [])
  // AI 대화를 프로젝트마다 저장하고 다시 열 때 불러온다
  useEffect(() => installChatPersistence(), [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        void saveCurrentProject()
        return
      }
      if (appView !== 'workbench' || isNativeTextEditingTarget(event.target)) return
      if (key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (key === 'y') {
        event.preventDefault()
        redo()
      }
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saveState.status === 'dirty' || saveState.status === 'saving' || saveState.status === 'error') {
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [appView, redo, saveCurrentProject, saveState.status, undo])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1279px)')
    const update = () => setCompact(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    setExplorerCollapsed(compact)
    setAssistantCollapsed(compact)
  }, [compact, setAssistantCollapsed, setExplorerCollapsed])

  if (appView === 'dashboard') {
    return (
      <div className="app-shell">
        <Dashboard />
      </div>
    )
  }

  const workspaceStyle = {
    '--explorer-width': explorerCollapsed ? '48px' : '248px',
    '--assistant-width': assistantCollapsed ? '48px' : `${assistantWidth}px`,
  } as CSSProperties

  const workspaceClassName = [
    'workspace-grid',
    bottomPanel === 'closed' ? 'panel-closed' : '',
    explorerCollapsed ? 'explorer-collapsed' : 'explorer-expanded',
    assistantCollapsed ? 'assistant-collapsed' : 'assistant-expanded',
    compact ? 'compact-workspace' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="app-shell">
      <TopBar />
      <div
        className={workspaceClassName}
        style={workspaceStyle}
      >
        <ProjectExplorer />
        <main className="main-pane">
          {mainView === 'schema' && <SchemaCanvas />}
          {mainView === 'data' && <DataGridView />}
          {mainView === 'design' && <TableDesignerView />}
        </main>
        <AiAssistantPanel />
        {bottomPanel !== 'closed' && <BottomPanel />}
      </div>
      <ExportDrawer />
      <ImportPreviewDialog />
    </div>
  )
}

export default App
