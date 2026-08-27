import { Clock3, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useWorkbenchStore } from '../state/workbenchStore'

interface HistoryItem {
  readonly id: string
  readonly type: string
  readonly summary: string
  readonly createdAt: string
}

const HISTORY_TYPE_LABELS: Readonly<Record<string, string>> = {
  AddColumn: '열 추가',
  AddForeignKey: '관계 추가',
  ApplyWorkbookRange: '범위 붙여넣기',
  ChangeColumnType: '타입 변경',
  ChangeNullable: '필수값 변경',
  ChangePrimaryKey: '기본 키 변경',
  CreateTable: '테이블 추가',
  DeleteColumn: '열 삭제',
  DeleteRows: '행 삭제',
  DeleteTable: '테이블 삭제',
  InsertRows: '행 추가',
  MoveTableLayout: '구조도 이동',
  MoveTablesLayout: '전체 자동 배치',
  RenameColumn: '열 이름 변경',
  RenameTable: '테이블 이름 변경',
  ReorderColumn: '열 이동',
  ReplaceRows: '행 변경',
  ReplaceWorkbookMatches: '찾아 바꾸기',
  UpdateCells: '셀 수정',
}

export function CommandHistoryMenu() {
  const workbenchDocument = useWorkbenchStore((state) => state.document)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const items = useMemo<readonly HistoryItem[]>(() => [
    ...workbenchDocument.schema.commandHistory.map((entry) => ({
      id: entry.commandId,
      type: entry.type,
      summary: entry.summary,
      createdAt: entry.executedAt,
    })),
    ...workbenchDocument.auditLog.map((entry) => ({
      id: entry.auditEventId,
      type: entry.type,
      summary: entry.summary,
      createdAt: entry.createdAt,
    })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 20), [workbenchDocument.auditLog, workbenchDocument.schema.commandHistory])

  useEffect(() => {
    if (!open) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className="command-history-control" ref={rootRef}>
      <button
        className="icon-button"
        type="button"
        title="변경 이력"
        aria-label="변경 이력"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Clock3 aria-hidden="true" size={17} />
      </button>
      {open && (
        <section className="command-history-popover" role="dialog" aria-label="변경 이력">
          <header>
            <div>
              <strong>변경 이력</strong>
              <span>최근 작업 {items.length}개</span>
            </div>
            <button className="history-close" type="button" title="변경 이력 닫기" onClick={() => setOpen(false)}>
              <X aria-hidden="true" size={15} />
            </button>
          </header>
          <div className="command-history-list">
            {items.map((item) => (
              <div className="command-history-item" key={item.id}>
                <span>{HISTORY_TYPE_LABELS[item.type] ?? '작업'}</span>
                <strong>{item.summary}</strong>
                <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleTimeString()}</time>
              </div>
            ))}
            {items.length === 0 && <p className="history-empty">아직 실행한 작업이 없습니다.</p>}
          </div>
        </section>
      )}
    </div>
  )
}
