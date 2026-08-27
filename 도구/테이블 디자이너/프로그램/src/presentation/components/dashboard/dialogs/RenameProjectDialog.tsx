import { X } from 'lucide-react'
import { useState } from 'react'

export function RenameProjectDialog({ currentName, onCancel, onRename }: {
  readonly currentName: string
  readonly onCancel: () => void
  readonly onRename: (name: string) => void
}) {
  const [draft, setDraft] = useState(currentName)

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="new-project-dialog compact-dialog" role="dialog" aria-modal="true" aria-label="프로젝트 이름 변경">
        <header>
          <div><h2>프로젝트 이름 변경</h2><p>저장된 문서와 복구본의 ID는 유지됩니다.</p></div>
          <button className="icon-button" type="button" title="닫기" onClick={onCancel}><X size={17} /></button>
        </header>
        <label className="field-label" htmlFor="rename-project-name">프로젝트 이름</label>
        <input id="rename-project-name" autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} />
        <footer>
          <button className="tool-button" type="button" onClick={onCancel}>취소</button>
          <button className="primary-action" type="button" disabled={!draft.trim()} onClick={() => onRename(draft)}>변경</button>
        </footer>
      </section>
    </div>
  )
}
