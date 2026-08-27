import {
  Clock3,
  Copy,
  Database,
  Download,
  Ellipsis,
  FolderOpen,
  Pencil,
  RotateCcw,
  Search,
  Star,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectSummary } from '../../../application/projectRepository'
import { RenameProjectDialog } from './dialogs/RenameProjectDialog'
import { ConfirmDeleteDialog } from './dialogs/ConfirmDeleteDialog'

type SortKey = 'recent' | 'name' | 'size'

const PAGE_SIZE = 25
const BROWSER_LOCATION = '브라우저 앱 보관함 (IndexedDB)'

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '저장 시각 없음'
  return date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** 오늘·어제는 시각만, 그 이전은 날짜만 — 목록을 훑을 때 눈이 덜 피로하다. */
function formatRelativeUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const time = date.getTime()

  if (time >= startOfToday) return `오늘 ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
  if (time >= startOfToday - 86_400_000) return `어제 ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  return date.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' })
}

function locationLabel(location: string): string {
  if (location === BROWSER_LOCATION) return '앱 보관함'
  const segments = location.split(/[\\/]/)
  return segments[segments.length - 1] || location
}

export interface EmptyAction {
  readonly label: string
  readonly icon: LucideIcon
  readonly onClick: () => void
}

export function ProjectListPanel({
  heading,
  headingId,
  projects,
  repositoryReady,
  showControls,
  emptyTitle,
  emptyDescription,
  emptyActions,
  favoriteIds,
  onToggleFavorite,
  onOpen,
  onRename,
  onDuplicate,
  onDownloadBackup,
  onLoadRecovery,
  onDelete,
}: {
  readonly heading: string
  readonly headingId: string
  readonly projects: readonly ProjectSummary[]
  readonly repositoryReady: boolean
  readonly showControls: boolean
  readonly emptyTitle: string
  readonly emptyDescription: string
  readonly emptyActions?: readonly EmptyAction[]
  readonly favoriteIds: ReadonlySet<string>
  readonly onToggleFavorite: (projectId: string) => void
  readonly onOpen: (projectId: string) => void
  readonly onRename: (projectId: string, name: string) => void
  readonly onDuplicate: (projectId: string) => void
  readonly onDownloadBackup: (projectId: string) => void
  readonly onLoadRecovery: (projectId: string) => void
  readonly onDelete: (projectId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ readonly id: string; readonly currentName: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ readonly id: string; readonly name: string } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filteredProjects = useMemo(() => {
    if (!showControls) return projects
    const normalized = query.trim().toLocaleLowerCase()
    const matched = normalized
      ? projects.filter((project) => project.name.toLocaleLowerCase().includes(normalized))
      : projects

    if (sortKey === 'recent') return matched
    const sorted = [...matched]
    if (sortKey === 'name') sorted.sort((left, right) => left.name.localeCompare(right.name, 'ko-KR'))
    else sorted.sort((left, right) => (right.tableCount - left.tableCount) || (right.rowCount - left.rowCount))
    return sorted
  }, [projects, query, sortKey, showControls])

  const visibleProjects = showControls ? filteredProjects.slice(0, visibleCount) : filteredProjects

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [query, sortKey])

  useEffect(() => {
    if (!menuProjectId) return
    const closeOnOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement | null)?.closest('.project-list-row')) setMenuProjectId(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuProjectId(null) }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuProjectId])

  useEffect(() => {
    if (!showControls) return undefined
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    document.addEventListener('keydown', focusSearch)
    return () => document.removeEventListener('keydown', focusSearch)
  }, [showControls])

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const target = event.target as HTMLElement
    if (!target.classList.contains('project-row-main')) return
    event.preventDefault()
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('.project-row-main') ?? [])
    const currentIndex = rows.indexOf(target as HTMLButtonElement)
    if (currentIndex === -1) return
    const nextIndex = event.key === 'ArrowDown' ? Math.min(currentIndex + 1, rows.length - 1) : Math.max(currentIndex - 1, 0)
    rows[nextIndex]?.focus()
  }

  return (
    <section className="project-panel" aria-labelledby={headingId}>
      <div className="dashboard-section-heading">
        <div>
          <h1 id={headingId}>{heading}</h1>
          <span>{showControls && query ? `${filteredProjects.length}개 검색됨 · 전체 ${projects.length}개` : `${projects.length}개`}</span>
        </div>
        {showControls && (
          <div className="dashboard-list-controls">
            <label className="dashboard-search">
              <Search size={15} aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Escape') setQuery('') }}
                placeholder="프로젝트 검색"
              />
              <kbd aria-hidden="true">/</kbd>
            </label>
            <div className="dashboard-sort" role="group" aria-label="정렬 기준">
              {([['recent', '최근순'], ['name', '이름순'], ['size', '규모순']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={sortKey === key ? 'active' : ''}
                  aria-pressed={sortKey === key}
                  onClick={() => setSortKey(key)}
                >{label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!repositoryReady && projects.length === 0 ? (
        <div className="project-list-empty"><Clock3 size={18} aria-hidden="true" />프로젝트 보관함을 확인하고 있습니다.</div>
      ) : filteredProjects.length === 0 ? (
        <div className="project-list-empty">
          <Database size={20} aria-hidden="true" />
          <div>
            <strong>{showControls && query ? `'${query}'와 일치하는 프로젝트가 없습니다.` : emptyTitle}</strong>
            <span>{showControls && query ? '다른 검색어를 시도해 보세요.' : emptyDescription}</span>
            <div className="project-list-empty-actions">
              {showControls && query ? (
                <button className="tool-button" type="button" onClick={() => setQuery('')}>검색 지우기</button>
              ) : emptyActions?.map((action) => {
                const Icon = action.icon
                return (
                  <button key={action.label} className="tool-button" type="button" onClick={action.onClick}>
                    <Icon size={14} aria-hidden="true" />{action.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="project-list" role="list" ref={listRef} onKeyDown={handleRowKeyDown}>
          <div className="project-list-head" aria-hidden="true">
            <span>이름</span>
            <span className="num">테이블</span>
            <span className="num">관계</span>
            <span className="num">행</span>
            <span>수정</span>
          </div>
          {visibleProjects.map((project) => (
            <div className="project-list-row" role="listitem" key={project.id}>
              <button
                className="project-row-main"
                type="button"
                title={`${project.name} — ${project.location}`}
                onClick={() => onOpen(project.id)}
              >
                <span className="project-row-name">
                  <span className="project-row-icon"><Database size={15} aria-hidden="true" /></span>
                  <strong>{project.name}</strong>
                  {favoriteIds.has(project.id) && <Star size={12} className="project-row-favorite-mark" aria-label="즐겨찾기" fill="currentColor" />}
                  {project.recovered && <span className="project-recovered">복구됨</span>}
                  <small>{locationLabel(project.location)}</small>
                </span>
                <span className="project-row-metric">{project.tableCount}</span>
                <span className="project-row-metric">{project.relationCount}</span>
                <span className="project-row-metric">{project.rowCount.toLocaleString()}</span>
                <span className="project-row-date" title={formatUpdatedAt(project.updatedAt)}>{formatRelativeUpdatedAt(project.updatedAt)}</span>
              </button>
              <button
                className="icon-button project-row-menu-button"
                type="button"
                title="프로젝트 메뉴"
                aria-expanded={menuProjectId === project.id}
                onClick={() => setMenuProjectId((current) => current === project.id ? null : project.id)}
              >
                <Ellipsis size={17} aria-hidden="true" />
              </button>
              {menuProjectId === project.id && (
                <div className="project-row-menu" role="menu">
                  <button role="menuitem" type="button" onClick={() => { setMenuProjectId(null); onOpen(project.id) }}><FolderOpen size={14} />열기</button>
                  <button role="menuitem" type="button" onClick={() => { setMenuProjectId(null); onToggleFavorite(project.id) }}>
                    <Star size={14} fill={favoriteIds.has(project.id) ? 'currentColor' : 'none'} />{favoriteIds.has(project.id) ? '즐겨찾기 해제' : '즐겨찾기'}
                  </button>
                  <button role="menuitem" type="button" onClick={() => { setRenameTarget({ id: project.id, currentName: project.name }); setMenuProjectId(null) }}><Pencil size={14} />이름 변경</button>
                  <button role="menuitem" type="button" onClick={() => { setMenuProjectId(null); onDuplicate(project.id) }}><Copy size={14} />복제</button>
                  <button role="menuitem" type="button" onClick={() => { setMenuProjectId(null); onDownloadBackup(project.id) }}><Download size={14} />백업 저장</button>
                  <button role="menuitem" type="button" onClick={() => { setMenuProjectId(null); onLoadRecovery(project.id) }}><RotateCcw size={14} />복구 기록</button>
                  <button role="menuitem" type="button" onClick={() => { setDeleteTarget({ id: project.id, name: project.name }); setMenuProjectId(null) }}><Trash2 size={14} />휴지통으로 이동</button>
                </div>
              )}
            </div>
          ))}
          {showControls && filteredProjects.length > visibleProjects.length && (
            <button
              className="project-list-more"
              type="button"
              onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
            >{filteredProjects.length - visibleProjects.length}개 더 보기</button>
          )}
        </div>
      )}

      {renameTarget && (
        <RenameProjectDialog
          currentName={renameTarget.currentName}
          onCancel={() => setRenameTarget(null)}
          onRename={(name) => { onRename(renameTarget.id, name); setRenameTarget(null) }}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteDialog
          projectName={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null) }}
        />
      )}
    </section>
  )
}
