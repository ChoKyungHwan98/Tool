import { Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { EntityId } from '../../../domain/schema'

export interface TableContextMenuState {
  readonly tableId: EntityId
  readonly tableName: string
  readonly x: number
  readonly y: number
}

export function TableContextMenu({
  menu,
  onDelete,
  onClose,
}: {
  readonly menu: TableContextMenuState
  readonly onDelete: (tableId: EntityId) => void
  readonly onClose: () => void
}) {
  const firstItemRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    firstItemRef.current?.focus()
    const close = () => onClose()
    const closeOnKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', close)
    window.addEventListener('blur', close)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    document.addEventListener('keydown', closeOnKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
      document.removeEventListener('keydown', closeOnKey)
    }
  }, [onClose])

  return createPortal(
    <div
      className="table-context-menu"
      role="menu"
      aria-label={`${menu.tableName} 테이블 메뉴`}
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        ref={firstItemRef}
        className="danger"
        type="button"
        role="menuitem"
        onClick={() => {
          onDelete(menu.tableId)
          onClose()
        }}
      >
        <Trash2 aria-hidden="true" size={15} />
        테이블 삭제
      </button>
    </div>,
    document.body,
  )
}
