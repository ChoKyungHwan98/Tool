import { FilePlus2, Menu } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { isDesktopRuntime } from '../../../infrastructure/externalProjectFiles'
import { useWorkbenchStore } from '../../state/workbenchStore'
import { DashboardRail } from './DashboardRail'
import { RAIL_ITEMS, type DashboardSection } from './railItems'
import { ProjectListPanel } from './ProjectListPanel'
import { TrashPanel } from './TrashPanel'
import { ExamplesPanel } from './ExamplesPanel'
import { NewProjectDialog } from './dialogs/NewProjectDialog'
import { RecoveryPointsDialog } from './dialogs/RecoveryPointsDialog'
import { useFavoriteProjects } from './useFavoriteProjects'
import astraeContentProjectText from '../../../../examples/astrae-territory-case-001/Astrae-Oratio-CASE001.gsw?raw'
import astraeCombatProjectText from '../../../../examples/astrae-case001-combat/Astrae-Oratio-CASE001-Combat.gsw?raw'

const RECENT_LIMIT = 10

export function DashboardShell() {
  const projects = useWorkbenchStore((state) => state.projects)
  const trashedProjects = useWorkbenchStore((state) => state.trashedProjects)
  const repositoryReady = useWorkbenchStore((state) => state.repositoryReady)
  const openSampleProject = useWorkbenchStore((state) => state.openSampleProject)
  const openGameCSampleProject = useWorkbenchStore((state) => state.openGameCSampleProject)
  const openGameDComplexProject = useWorkbenchStore((state) => state.openGameDComplexProject)
  const openNewProject = useWorkbenchStore((state) => state.openNewProject)
  const openProjectById = useWorkbenchStore((state) => state.openProjectById)
  const openProjectFile = useWorkbenchStore((state) => state.openProjectFile)
  const openNativeProjectFile = useWorkbenchStore((state) => state.openNativeProjectFile)
  const prepareImport = useWorkbenchStore((state) => state.prepareImport)
  const deleteProjectFromLibrary = useWorkbenchStore((state) => state.deleteProjectFromLibrary)
  const renameProjectInLibrary = useWorkbenchStore((state) => state.renameProjectInLibrary)
  const duplicateProjectFromLibrary = useWorkbenchStore((state) => state.duplicateProjectFromLibrary)
  const getProjectBackup = useWorkbenchStore((state) => state.getProjectBackup)
  const loadRecoveryPoints = useWorkbenchStore((state) => state.loadRecoveryPoints)
  const restoreRecoveryPoint = useWorkbenchStore((state) => state.restoreRecoveryPoint)
  const closeRecoveryPoints = useWorkbenchStore((state) => state.closeRecoveryPoints)
  const recoveryPoints = useWorkbenchStore((state) => state.recoveryPoints)
  const recoveryProjectId = useWorkbenchStore((state) => state.recoveryProjectId)
  const loadTrash = useWorkbenchStore((state) => state.loadTrash)
  const restoreProjectFromTrash = useWorkbenchStore((state) => state.restoreProjectFromTrash)

  const [activeSection, setActiveSection] = useState<DashboardSection>('all')
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { favoriteIds, toggleFavorite } = useFavoriteProjects()
  const desktopRuntime = isDesktopRuntime()

  const selectSection = (section: DashboardSection) => {
    setActiveSection(section)
    setMobileNavOpen(false)
  }

  useEffect(() => {
    if (activeSection === 'trash') void loadTrash()
  }, [activeSection, loadTrash])

  const recentProjects = useMemo(
    () => [...projects].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, RECENT_LIMIT),
    [projects],
  )
  const favoriteProjects = useMemo(
    () => projects.filter((project) => favoriteIds.has(project.id)),
    [projects, favoriteIds],
  )

  const startFromDataFiles = async (files: readonly File[]) => {
    if (files.length === 0) return
    const baseName = files[0]!.name.replace(/\.(csv|xlsx)$/i, '') || '가져온 프로젝트'
    openNewProject(baseName)
    await prepareImport(files)
  }

  const downloadBackup = async (projectId: string) => {
    const backup = await getProjectBackup(projectId)
    if (!backup) return
    const url = URL.createObjectURL(new Blob([backup.contents], { type: 'application/json;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = backup.fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  const createProject = (name: string) => {
    openNewProject(name)
    setNewProjectOpen(false)
  }

  const openBundledProject = (contents: string, fileName: string) => {
    void openProjectFile(new File([contents], fileName, { type: 'application/json;charset=utf-8' }))
  }

  const sharedListProps = {
    repositoryReady,
    favoriteIds,
    onToggleFavorite: toggleFavorite,
    onOpen: (projectId: string) => void openProjectById(projectId),
    onRename: (projectId: string, name: string) => void renameProjectInLibrary(projectId, name),
    onDuplicate: (projectId: string) => void duplicateProjectFromLibrary(projectId),
    onDownloadBackup: (projectId: string) => void downloadBackup(projectId),
    onLoadRecovery: (projectId: string) => void loadRecoveryPoints(projectId),
    onDelete: (projectId: string) => void deleteProjectFromLibrary(projectId),
  }

  const currentSectionLabel = RAIL_ITEMS.find((item) => item.id === activeSection)?.label ?? ''

  return (
    <div className="dashboard dashboard--hub">
      <div className="dashboard-mobile-bar">
        <button className="icon-button" type="button" aria-label="메뉴 열기" onClick={() => setMobileNavOpen(true)}>
          <Menu size={18} aria-hidden="true" />
        </button>
        <strong>{currentSectionLabel}</strong>
      </div>

      {mobileNavOpen && <div className="dashboard-rail-backdrop" role="presentation" onClick={() => setMobileNavOpen(false)} />}

      <DashboardRail
        active={activeSection}
        onSelect={selectSection}
        totalCount={projects.length}
        favoriteCount={favoriteIds.size}
        trashCount={trashedProjects.length}
        onNewProject={() => { setNewProjectOpen(true); setMobileNavOpen(false) }}
        desktopRuntime={desktopRuntime}
        onOpenNativeFile={() => void openNativeProjectFile()}
        onOpenProjectFile={(file) => void openProjectFile(file)}
        onStartFromDataFiles={(files) => void startFromDataFiles(files)}
        mobileOpen={mobileNavOpen}
      />

      <main className="dashboard-main">
        {activeSection === 'all' && (
          <ProjectListPanel
            heading="내 프로젝트"
            headingId="recent-projects-title"
            projects={projects}
            showControls
            emptyTitle="아직 만든 프로젝트가 없습니다."
            emptyDescription="새 프로젝트를 만들거나 기존 .gsw 파일을 여세요."
            emptyActions={[
              { label: '새 프로젝트', icon: FilePlus2, onClick: () => setNewProjectOpen(true) },
            ]}
            {...sharedListProps}
          />
        )}
        {activeSection === 'recent' && (
          <ProjectListPanel
            heading="최근 작업"
            headingId="recent-work-title"
            projects={recentProjects}
            showControls={false}
            emptyTitle="최근 작업한 프로젝트가 없습니다."
            emptyDescription="프로젝트를 열면 여기 최근 목록에 나타납니다."
            {...sharedListProps}
          />
        )}
        {activeSection === 'favorites' && (
          <ProjectListPanel
            heading="즐겨찾기"
            headingId="favorites-title"
            projects={favoriteProjects}
            showControls={false}
            emptyTitle="즐겨찾기한 프로젝트가 없습니다."
            emptyDescription="행 메뉴의 별표를 눌러 자주 쓰는 프로젝트를 등록하세요."
            {...sharedListProps}
          />
        )}
        {activeSection === 'trash' && (
          <TrashPanel projects={trashedProjects} onRestore={(projectId) => void restoreProjectFromTrash(projectId)} />
        )}
        {activeSection === 'examples' && (
          <ExamplesPanel
            onOpenSample={openSampleProject}
            onOpenGameC={openGameCSampleProject}
            onOpenGameD={openGameDComplexProject}
            onOpenAstraeContent={() => openBundledProject(astraeContentProjectText, 'Astrae-Oratio-CASE001.gsw')}
            onOpenAstraeCombat={() => openBundledProject(astraeCombatProjectText, 'Astrae-Oratio-CASE001-Combat.gsw')}
          />
        )}
      </main>

      {newProjectOpen && (
        <NewProjectDialog onCancel={() => setNewProjectOpen(false)} onCreate={createProject} />
      )}
      {recoveryProjectId && (
        <RecoveryPointsDialog
          points={recoveryPoints}
          onClose={closeRecoveryPoints}
          onRestore={(recoveryId) => void restoreRecoveryPoint(recoveryProjectId, recoveryId)}
        />
      )}
    </div>
  )
}
