import { useEffect, useRef } from 'react'

export interface PasteSpecialState {
  readonly text: string
  readonly transpose: boolean
  readonly skipBlanks: boolean
}

export function PasteSpecialDialog({
  state,
  onChange,
  onApply,
  onClose,
}: {
  readonly state: PasteSpecialState
  readonly onChange: (state: PasteSpecialState) => void
  readonly onApply: () => void
  readonly onClose: () => void
}) {
  const captureRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    captureRef.current?.focus()
  }, [])

  return (
    <div className="paste-special-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="paste-special-dialog" role="dialog" aria-modal="true" aria-label="선택하여 붙여넣기">
        <header><strong>선택하여 붙여넣기</strong><button type="button" onClick={onClose}>닫기</button></header>
        <p>값만 붙여넣습니다. 외부에서 복사했다면 아래 입력 영역에서 Ctrl+V를 누르세요.</p>
        <textarea ref={captureRef} aria-label="붙여넣을 데이터" placeholder="여기에 Ctrl+V" value={state.text} onChange={(event) => onChange({ ...state, text: event.target.value })} onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
          if (event.key === 'Enter' && event.ctrlKey && state.text) onApply()
        }} />
        <label><input type="checkbox" checked={state.transpose} onChange={(event) => onChange({ ...state, transpose: event.target.checked })} />행과 열 바꾸기</label>
        <label><input type="checkbox" checked={state.skipBlanks} onChange={(event) => onChange({ ...state, skipBlanks: event.target.checked })} />빈 셀은 기존 값 유지</label>
        <footer><button type="button" onClick={onClose}>취소</button><button className="primary" type="button" disabled={!state.text} onClick={onApply}>값 붙여넣기</button></footer>
      </section>
    </div>
  )
}
