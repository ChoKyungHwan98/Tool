import { X } from 'lucide-react'
import type { RecoveryPoint } from '../../../../application/projectRepository'

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '저장 시각 없음'
  return date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function RecoveryPointsDialog({ points, onClose, onRestore }: {
  readonly points: readonly RecoveryPoint[]
  readonly onClose: () => void
  readonly onRestore: (recoveryId: string) => void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="recovery-dialog" role="dialog" aria-modal="true" aria-label="프로젝트 복구 기록">
        <header>
          <div><h2>복구 기록</h2><p>최근 30개, 최대 30일의 정상 저장본입니다.</p></div>
          <button className="icon-button" type="button" title="닫기" onClick={onClose}><X size={17} /></button>
        </header>
        <div className="recovery-list">
          {points.length === 0 ? <p>아직 생성된 복구본이 없습니다.</p> : points.map((point) => (
            <div key={point.recoveryId}>
              <span><strong>{formatUpdatedAt(point.createdAt)}</strong><small>{point.reason} · revision {point.document.revision}</small></span>
              <button className="tool-button" type="button" onClick={() => onRestore(point.recoveryId)}>이 시점으로 복구</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
