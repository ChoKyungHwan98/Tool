import { ArrowLeft, ArrowRight, Filter, KeyRound, PenLine, Plus, Trash2 } from 'lucide-react'
import type { MouseEvent } from 'react'

interface WorkbookColumnMenuProps {
  readonly sorted: boolean
  readonly canMoveLeft: boolean
  readonly canMoveRight: boolean
  readonly deleteDisabled: boolean
  readonly deleteReason?: string
  readonly onRename: () => void
  readonly onOpenFilter: (event: MouseEvent<HTMLButtonElement>) => void
  readonly onSortAscending: () => void
  readonly onSortDescending: () => void
  readonly onClearSort: () => void
  readonly onInsertLeft: () => void
  readonly onInsertRight: () => void
  readonly onMoveLeft: () => void
  readonly onMoveRight: () => void
  readonly onOpenRelations: () => void
  readonly onDelete: () => void
  readonly onHide: () => void
  readonly onFreeze: () => void
}

export function WorkbookColumnMenu(props: WorkbookColumnMenuProps) {
  return (
    <div className="column-menu" role="menu">
      <span className="column-menu-group-title">편집</span>
      <button type="button" role="menuitem" onClick={props.onRename}><PenLine aria-hidden="true" size={14} />이름 변경</button>

      <span className="column-menu-group-title">정렬·필터</span>
      <button type="button" role="menuitem" onClick={props.onOpenFilter}><Filter aria-hidden="true" size={14} />열 필터</button>
      <button type="button" role="menuitem" onClick={props.onSortAscending}>오름차순 정렬에 추가</button>
      <button type="button" role="menuitem" onClick={props.onSortDescending}>내림차순 정렬에 추가</button>
      {props.sorted && <button type="button" role="menuitem" onClick={props.onClearSort}>이 열 정렬 해제</button>}

      <span className="column-menu-group-title">구조</span>
      <button type="button" role="menuitem" onClick={props.onInsertLeft}><Plus aria-hidden="true" size={14} />왼쪽에 열 삽입</button>
      <button type="button" role="menuitem" onClick={props.onInsertRight}><Plus aria-hidden="true" size={14} />오른쪽에 열 삽입</button>
      <button type="button" role="menuitem" disabled={!props.canMoveLeft} onClick={props.onMoveLeft}><ArrowLeft aria-hidden="true" size={14} />왼쪽으로</button>
      <button type="button" role="menuitem" disabled={!props.canMoveRight} onClick={props.onMoveRight}><ArrowRight aria-hidden="true" size={14} />오른쪽으로</button>
      <button type="button" role="menuitem" onClick={props.onOpenRelations}><KeyRound aria-hidden="true" size={14} />키와 관계 설정</button>
      <button className="danger" type="button" role="menuitem" disabled={props.deleteDisabled} title={props.deleteReason} onClick={props.onDelete}><Trash2 aria-hidden="true" size={14} />열 삭제</button>

      <span className="column-menu-group-title">표시</span>
      <button type="button" role="menuitem" onClick={props.onHide}>열 숨기기</button>
      <button type="button" role="menuitem" onClick={props.onFreeze}>이 열까지 고정</button>
    </div>
  )
}
