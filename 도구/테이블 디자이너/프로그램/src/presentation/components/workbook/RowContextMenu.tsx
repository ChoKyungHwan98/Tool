import { CopyPlus, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface RowContextMenuState {
  readonly rowId: string
  readonly rowNumber: number
  readonly originalIndex: number
  readonly x: number
  readonly y: number
}

export function RowContextMenu({
  menu,
  onInsertAbove,
  onInsertBelow,
  onDuplicate,
  onDelete,
  onClose,
}: {
  readonly menu: RowContextMenuState
  readonly onInsertAbove: () => void
  readonly onInsertBelow: () => void
  readonly onDuplicate: () => void
  readonly onDelete: () => void
  readonly onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    menuRef.current?.focus()
    const closeOnPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose()
    }
    const closeOnKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const closeOnScroll = () => onClose()
    document.addEventListener('pointerdown', closeOnPointer)
    document.addEventListener('keydown', closeOnKey)
    window.addEventListener('scroll', closeOnScroll, true)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointer)
      document.removeEventListener('keydown', closeOnKey)
      window.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [onClose])

  const run = (action: () => void) => {
    action()
    onClose()
  }

  return createPortal(
    <div
      ref={menuRef}
      className="table-context-menu"
      role="menu"
      aria-label={`${menu.rowNumber}행 메뉴`}
      tabIndex={-1}
      style={{ left: menu.x, top: menu.y }}
    >
      <strong>{menu.rowNumber}행</strong>
      <button type="button" role="menuitem" onClick={() => run(onInsertAbove)}><Plus aria-hidden="true" size={14} />위에 행 삽입</button>
      <button type="button" role="menuitem" onClick={() => run(onInsertBelow)}><Plus aria-hidden="true" size={14} />아래에 행 삽입</button>
      <button type="button" role="menuitem" onClick={() => run(onDuplicate)}><CopyPlus aria-hidden="true" size={14} />행 복제</button>
      <button className="danger" type="button" role="menuitem" onClick={() => run(onDelete)}><Trash2 aria-hidden="true" size={14} />행 삭제</button>
    </div>,
    document.body,
  )
}
