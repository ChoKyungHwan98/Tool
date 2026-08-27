import { Trash2, X } from 'lucide-react'

export function ConfirmDeleteDialog({ projectName, onCancel, onConfirm }: {
  readonly projectName: string
  readonly onCancel: () => void
  readonly onConfirm: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="new-project-dialog compact-dialog" role="dialog" aria-modal="true" aria-label="프로젝트 삭제 확인">
        <header>
          <div><h2>휴지통으로 이동</h2><p>'{projectName}' 프로젝트를 휴지통으로 옮깁니다. 30일 안에는 복원할 수 있습니다.</p></div>
          <button className="icon-button" type="button" title="닫기" onClick={onCancel}><X size={17} /></button>
        </header>
        <footer>
          <button className="tool-button" type="button" onClick={onCancel}>취소</button>
          <button className="primary-action danger-action" type="button" onClick={onConfirm}><Trash2 size={14} aria-hidden="true" />휴지통으로 이동</button>
        </footer>
      </section>
    </div>
  )
}
