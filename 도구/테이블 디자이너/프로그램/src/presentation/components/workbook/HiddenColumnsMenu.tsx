import { Eye, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { SchemaColumn } from '../../../domain/schema'

export function HiddenColumnsMenu({
  columns,
  x,
  y,
  onShow,
  onShowAll,
  onClose,
}: {
  readonly columns: readonly SchemaColumn[]
  readonly x: number
  readonly y: number
  readonly onShow: (columnId: string) => void
  readonly onShowAll: () => void
  readonly onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus()
    const pointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', pointer)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('pointerdown', pointer)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  return createPortal(
    <div ref={ref} className="hidden-columns-menu" role="menu" aria-label="숨긴 열 관리" tabIndex={-1} style={{ left: x, top: y }}>
      <header><strong>숨긴 열</strong><button type="button" aria-label="숨긴 열 관리 닫기" onClick={onClose}><X aria-hidden="true" size={14} /></button></header>
      {columns.map((column) => (
        <button key={column.columnId} type="button" role="menuitem" onClick={() => onShow(column.columnId)}><Eye aria-hidden="true" size={14} />{column.name}</button>
      ))}
      <footer><button type="button" onClick={onShowAll}>모두 표시</button></footer>
    </div>,
    document.body,
  )
}
