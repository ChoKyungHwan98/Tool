import { ClipboardPaste, LocateFixed, Search } from 'lucide-react'

export function SpreadsheetToolbar({
  search,
  sortingCount,
  filterCount,
  frozenCount,
  hiddenCount,
  fillMode,
  viewRowCount,
  rowCount,
  error,
  onSearchChange,
  onOpenGoTo,
  onOpenPasteSpecial,
  onToggleFillMode,
  onClearSorting,
  onClearFilters,
  onClearFrozen,
  onOpenHiddenColumns,
}: {
  readonly search: string
  readonly sortingCount: number
  readonly filterCount: number
  readonly frozenCount: number
  readonly hiddenCount: number
  readonly fillMode: 'series' | 'copy'
  readonly viewRowCount: number
  readonly rowCount: number
  readonly error: string | null
  readonly onSearchChange: (value: string) => void
  readonly onOpenGoTo: () => void
  readonly onOpenPasteSpecial: () => void
  readonly onToggleFillMode: () => void
  readonly onClearSorting: () => void
  readonly onClearFilters: () => void
  readonly onClearFrozen: () => void
  readonly onOpenHiddenColumns: (x: number, y: number) => void
}) {
  return (
    <div className="spreadsheet-toolbar">
      <label className="grid-search"><Search aria-hidden="true" size={14} /><input aria-label="행 검색" placeholder="현재 시트 검색" value={search} onChange={(event) => onSearchChange(event.target.value)} /></label>
      <button className="spreadsheet-status-action" type="button" title="Ctrl+G" onClick={onOpenGoTo}><LocateFixed aria-hidden="true" size={13} />셀로 이동</button>
      <button className="spreadsheet-status-action" type="button" title="Ctrl+Alt+V" onClick={onOpenPasteSpecial}><ClipboardPaste aria-hidden="true" size={13} />선택 붙여넣기</button>
      <button className="spreadsheet-status-action" type="button" title="채우기 핸들의 생성 규칙" onClick={onToggleFillMode}>채우기: {fillMode === 'series' ? '연속' : '복사'}</button>
      {sortingCount > 0 && <button className="spreadsheet-status-action" type="button" onClick={onClearSorting}>정렬 {sortingCount}개 해제</button>}
      {filterCount > 0 && <button className="spreadsheet-status-action" type="button" onClick={onClearFilters}>필터 {filterCount}개 해제</button>}
      {frozenCount > 0 && <button className="spreadsheet-status-action" type="button" onClick={onClearFrozen}>열 고정 해제</button>}
      {hiddenCount > 0 && <button className="spreadsheet-status-action" type="button" onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        onOpenHiddenColumns(bounds.left, bounds.bottom + 4)
      }}>숨긴 열 {hiddenCount}개</button>}
      <span>{viewRowCount === rowCount ? `${rowCount.toLocaleString()}행` : `${viewRowCount.toLocaleString()} / ${rowCount.toLocaleString()}행`}</span>
      {error && <strong className="spreadsheet-error" role="alert">{error}</strong>}
    </div>
  )
}
