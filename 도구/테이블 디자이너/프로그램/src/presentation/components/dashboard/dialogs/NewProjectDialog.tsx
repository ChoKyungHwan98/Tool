import { X } from 'lucide-react'
import { useState } from 'react'

export function NewProjectDialog({ onCancel, onCreate }: {
  readonly onCancel: () => void
  readonly onCreate: (name: string) => void
}) {
  const [name, setName] = useState('')

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="new-project-dialog" role="dialog" aria-modal="true" aria-label="새 프로젝트 만들기">
        <header>
          <div><h2>새 프로젝트</h2><p>게임 전체 또는 하나의 콘텐츠 단위로 관리하세요.</p></div>
          <button className="icon-button" type="button" title="닫기" onClick={onCancel}><X aria-hidden="true" size={17} /></button>
        </header>
        <label className="field-label" htmlFor="new-project-name">프로젝트 이름</label>
        <input
          id="new-project-name"
          autoFocus
          placeholder="예: 전투 시스템"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
            if (event.key === 'Escape') onCancel()
          }}
        />
        <footer>
          <button className="tool-button" type="button" onClick={onCancel}>취소</button>
          <button className="primary-action" type="button" disabled={!name.trim()} onClick={submit}>프로젝트 만들기</button>
        </footer>
      </section>
    </div>
  )
}
