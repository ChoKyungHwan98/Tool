import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import type { GridEditEntryMode } from '../../gridTypes'

export function WorkbookCellEditor({
  ariaLabel,
  draft,
  mode,
  onChange,
  onClose,
  options = [],
  strictChoice = false,
}: {
  readonly ariaLabel: string
  readonly draft: string
  readonly mode: GridEditEntryMode
  readonly onChange: (value: string) => void
  readonly onClose: (commit: boolean, rowDelta?: number, columnDelta?: number) => void
  readonly options?: readonly string[]
  readonly strictChoice?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const selectRef = useRef<HTMLSelectElement>(null)
  const datalistId = useId()
  const closed = useRef(false)

  const close = (commit: boolean, rowDelta = 0, columnDelta = 0) => {
    if (closed.current) return
    closed.current = true
    onClose(commit, rowDelta, columnDelta)
  }

  useEffect(() => {
    const input = strictChoice ? selectRef.current : inputRef.current
    if (!input) return
    input.focus({ preventScroll: true })
    if (input instanceof HTMLInputElement) {
      const caret = input.value.length
      input.setSelectionRange(caret, caret)
    }
  }, [mode, strictChoice])

  const handleEditorKey = (event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    event.stopPropagation()
    if (event.key === 'Escape') close(false)
    if (event.key === 'Enter') {
      event.preventDefault()
      close(true, event.shiftKey ? -1 : 1, 0)
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      close(true, 0, event.shiftKey ? -1 : 1)
    }
  }

  if (strictChoice) {
    return (
      <select ref={selectRef} aria-label={`${ariaLabel} 편집`} className="spreadsheet-editor" value={draft} onBlur={() => close(true)} onChange={(event) => onChange(event.target.value)} onKeyDown={handleEditorKey}>
        <option value="">선택</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    )
  }

  return (
    <>
      <input ref={inputRef} aria-label={`${ariaLabel} 편집`} className="spreadsheet-editor" list={options.length > 0 ? datalistId : undefined} value={draft} onBlur={() => close(true)} onChange={(event) => onChange(event.target.value)} onKeyDown={handleEditorKey} />
      {options.length > 0 && <datalist id={datalistId}>{options.map((option) => <option key={option} value={option} />)}</datalist>}
    </>
  )
}
