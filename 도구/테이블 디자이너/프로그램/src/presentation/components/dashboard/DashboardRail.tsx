import { FileInput, FilePlus2, FolderOpen } from 'lucide-react'
import { RAIL_ITEMS, type DashboardSection } from './railItems'

export type { DashboardSection } from './railItems'

export function DashboardRail({
  active,
  onSelect,
  onNewProject,
  desktopRuntime,
  onOpenNativeFile,
  onOpenProjectFile,
  onStartFromDataFiles,
  mobileOpen,
}: {
  readonly active: DashboardSection
  readonly onSelect: (section: DashboardSection) => void
  readonly onNewProject: () => void
  readonly desktopRuntime: boolean
  readonly onOpenNativeFile: () => void
  readonly onOpenProjectFile: (file: File) => void
  readonly onStartFromDataFiles: (files: readonly File[]) => void
  readonly mobileOpen: boolean
}) {
  return (
    <nav className={mobileOpen ? 'dashboard-rail dashboard-rail--open' : 'dashboard-rail'} aria-label="워크벤치 탐색">
      <div className="dashboard-rail-brand">
        <strong>테이블 디자이너</strong>
      </div>

      <div className="dashboard-rail-groups">
        {(['library', 'resource'] as const).map((group) => (
          <div className="dashboard-rail-group" key={group}>
            <span className="dashboard-rail-group-label">{group === 'library' ? '프로젝트 관리' : '자료'}</span>
            {RAIL_ITEMS.filter((item) => item.group === group).map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  className={active === item.id ? 'dashboard-rail-item active' : 'dashboard-rail-item'}
                  aria-current={active === item.id ? 'page' : undefined}
                  title={item.label}
                  onClick={() => onSelect(item.id)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="dashboard-rail-actions">
        <button className="btn-primary" type="button" onClick={onNewProject}>
          <FilePlus2 size={16} aria-hidden="true" />새 프로젝트
        </button>
        {desktopRuntime ? (
          <button className="btn-ghost" type="button" onClick={onOpenNativeFile}>
            <FolderOpen size={16} aria-hidden="true" />프로젝트 열기
          </button>
        ) : (
          <label className="btn-ghost">
            <FolderOpen size={16} aria-hidden="true" />프로젝트 열기
            <input
              type="file"
              accept=".gsw,.json,.gsw.json,application/json"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                if (file) onOpenProjectFile(file)
                event.currentTarget.value = ''
              }}
            />
          </label>
        )}
        <label className="btn-ghost">
          <FileInput size={16} aria-hidden="true" />CSV·Excel로 시작
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            multiple
            onChange={(event) => {
              onStartFromDataFiles([...(event.currentTarget.files ?? [])])
              event.currentTarget.value = ''
            }}
          />
        </label>
      </div>
    </nav>
  )
}
