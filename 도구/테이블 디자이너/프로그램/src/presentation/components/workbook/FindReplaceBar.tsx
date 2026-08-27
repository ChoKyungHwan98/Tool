import { ChevronDown, ChevronUp, Replace, ReplaceAll, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

export interface FindReplaceBarProps {
  readonly mode: 'find' | 'replace'
  readonly query: string
  readonly replacement: string
  readonly matchIndex: number
  readonly matchCount: number
  readonly onQueryChange: (value: string) => void
  readonly onReplacementChange: (value: string) => void
  readonly onPrevious: () => void
  readonly onNext: () => void
  readonly onReplace: () => void
  readonly onReplaceAll: () => void
  readonly onClose: () => void
}

export function FindReplaceBar({
  mode,
  query,
  replacement,
  matchIndex,
  matchCount,
  onQueryChange,
  onReplacementChange,
  onPrevious,
  onNext,
  onReplace,
  onReplaceAll,
  onClose,
}: FindReplaceBarProps) {
  const queryRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    queryRef.current?.focus()
    queryRef.current?.select()
  }, [mode])

  return (
    <section className="find-replace-bar" role="region" aria-label="찾기 및 바꾸기">
      <label>
        <span>찾기</span>
        <input
          ref={queryRef}
          aria-label="찾을 내용"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (event.shiftKey) onPrevious()
              else onNext()
            }
            if (event.key === 'Escape') onClose()
          }}
        />
      </label>
      {mode === 'replace' && (
        <label>
          <span>바꾸기</span>
          <input
            aria-label="바꿀 내용"
            value={replacement}
            onChange={(event) => onReplacementChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onReplace()
              }
              if (event.key === 'Escape') onClose()
            }}
          />
        </label>
      )}
      <output aria-live="polite">{matchCount > 0 ? `${matchIndex + 1} / ${matchCount}` : '결과 없음'}</output>
      <button type="button" className="icon-button" aria-label="이전 찾기" title="이전 찾기" onClick={onPrevious} disabled={matchCount === 0}><ChevronUp aria-hidden="true" size={15} /></button>
      <button type="button" className="icon-button" aria-label="다음 찾기" title="다음 찾기" onClick={onNext} disabled={matchCount === 0}><ChevronDown aria-hidden="true" size={15} /></button>
      {mode === 'replace' && (
        <>
          <button type="button" className="tool-button" onClick={onReplace} disabled={matchCount === 0}><Replace aria-hidden="true" size={14} /><span>바꾸기</span></button>
          <button type="button" className="tool-button" onClick={onReplaceAll} disabled={matchCount === 0}><ReplaceAll aria-hidden="true" size={14} /><span>모두 바꾸기</span></button>
        </>
      )}
      <button type="button" className="icon-button" aria-label="찾기 닫기" title="찾기 닫기" onClick={onClose}><X aria-hidden="true" size={15} /></button>
    </section>
  )
}
