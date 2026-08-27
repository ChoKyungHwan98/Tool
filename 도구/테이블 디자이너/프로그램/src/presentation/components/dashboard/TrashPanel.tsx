import { Database, RotateCcw, Trash2 } from 'lucide-react'
import type { ProjectSummary } from '../../../application/projectRepository'

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '저장 시각 없음'
  return date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function TrashPanel({ projects, onRestore }: {
  readonly projects: readonly ProjectSummary[]
  readonly onRestore: (projectId: string) => void
}) {
  return (
    <section className="project-panel" aria-labelledby="trash-panel-title">
      <div className="dashboard-section-heading">
        <div>
          <h1 id="trash-panel-title">휴지통</h1>
          <span>{projects.length}개 · 30일 뒤 자동으로 완전히 삭제됩니다</span>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="project-list-empty">
          <Trash2 size={20} aria-hidden="true" />
          <div><strong>휴지통이 비어 있습니다.</strong><span>삭제한 프로젝트가 여기 30일간 보관됩니다.</span></div>
        </div>
      ) : (
        <div className="project-list" role="list">
          <div className="project-list-head" aria-hidden="true">
            <span>이름</span>
            <span className="num">테이블</span>
            <span>마지막 수정</span>
            <span />
          </div>
          {projects.map((project) => (
            <div className="project-list-row project-list-row--trash" role="listitem" key={project.id}>
              <span className="project-row-main project-row-main--static">
                <span className="project-row-name">
                  <span className="project-row-icon"><Database size={15} aria-hidden="true" /></span>
                  <strong>{project.name}</strong>
                </span>
                <span className="project-row-metric">{project.tableCount}</span>
                <span className="project-row-date">{formatUpdatedAt(project.updatedAt)}</span>
              </span>
              <button className="tool-button project-row-restore" type="button" onClick={() => onRestore(project.id)}>
                <RotateCcw size={14} aria-hidden="true" />복원
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
