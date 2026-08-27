import { Filter, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SchemaColumn, WorkbookColumnFilter, WorkbookFilterOperator } from '../../../domain/schema'

const textOperators: readonly [WorkbookFilterOperator, string][] = [
  ['contains', '포함'],
  ['equals', '같음'],
  ['starts_with', '시작 문자'],
  ['is_blank', '빈 셀'],
  ['is_not_blank', '빈 셀이 아님'],
]

const numericOperators: readonly [WorkbookFilterOperator, string][] = [
  ['equals', '같음'],
  ['greater_than', '보다 큼'],
  ['less_than', '보다 작음'],
  ['between', '범위'],
  ['is_blank', '빈 셀'],
  ['is_not_blank', '빈 셀이 아님'],
]

export function ColumnFilterPopover({
  column,
  existing,
  x,
  y,
  suggestions,
  onApply,
  onClose,
}: {
  readonly column: SchemaColumn
  readonly existing?: WorkbookColumnFilter
  readonly x: number
  readonly y: number
  readonly suggestions: readonly string[]
  readonly onApply: (filter: WorkbookColumnFilter | null) => void
  readonly onClose: () => void
}) {
  const useChoiceFilter = suggestions.length > 0 || column.dataType.kind === 'boolean' || column.dataType.kind === 'enum'
  const operators = useChoiceFilter
    ? [['one_of', '선택 목록'], ['is_blank', '빈 셀'], ['is_not_blank', '빈 셀이 아님']] as const
    : isNumericType(column.dataType.kind) ? numericOperators : textOperators
  const [operator, setOperator] = useState<WorkbookFilterOperator>(existing?.operator ?? operators[0]![0])
  const [value, setValue] = useState(existing?.value ?? '')
  const [secondValue, setSecondValue] = useState(existing?.secondValue ?? '')
  const [values, setValues] = useState<readonly string[]>(existing?.values ?? [])
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('select, input, button')?.focus()
    const closeOnPointer = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose()
    }
    const closeOnKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', closeOnPointer)
    document.addEventListener('keydown', closeOnKey)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointer)
      document.removeEventListener('keydown', closeOnKey)
    }
  }, [onClose])

  const apply = () => {
    onApply({
      columnId: column.columnId,
      operator,
      ...(operator === 'between' ? { value, secondValue } : {}),
      ...(operator === 'one_of' ? { values } : {}),
      ...(!['between', 'one_of', 'is_blank', 'is_not_blank'].includes(operator) ? { value } : {}),
    })
  }

  return createPortal(
    <div ref={panelRef} className="column-filter-popover" role="dialog" aria-label={`${column.name} 열 필터`} style={{ left: x, top: y }}>
      <header><span><Filter aria-hidden="true" size={15} />{column.name} 필터</span><button type="button" title="필터 닫기" onClick={onClose}><X aria-hidden="true" size={14} /></button></header>
      <label>조건<select value={operator} onChange={(event) => setOperator(event.target.value as WorkbookFilterOperator)}>{operators.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      {operator === 'one_of' && (
        <div className="filter-choice-list">
          {suggestions.map((suggestion) => <label key={suggestion}><input type="checkbox" checked={values.includes(suggestion)} onChange={(event) => setValues(event.target.checked ? [...values, suggestion] : values.filter((value) => value !== suggestion))} />{suggestion || '(빈 값)'}</label>)}
        </div>
      )}
      {!['one_of', 'is_blank', 'is_not_blank'].includes(operator) && <label>값<input value={value} onChange={(event) => setValue(event.target.value)} /></label>}
      {operator === 'between' && <label>두 번째 값<input value={secondValue} onChange={(event) => setSecondValue(event.target.value)} /></label>}
      <footer><button type="button" onClick={() => onApply(null)}>필터 해제</button><button className="primary" type="button" onClick={apply}>적용</button></footer>
    </div>,
    document.body,
  )
}

function isNumericType(kind: SchemaColumn['dataType']['kind']): boolean {
  return ['int32', 'int64', 'float', 'double', 'date', 'datetime'].includes(kind)
}
