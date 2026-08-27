import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnSizingState,
  type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { FileSpreadsheet, Filter, GripVertical, MoreHorizontal, Plus, Table2 } from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent as ReactDragEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { DataRow, EntityId, WorkbookColumnFilter } from '../../../domain/schema'
import { requireTable } from '../../../domain/projectQueries'
import { validateProjectWithRows } from '../../../domain/validator'
import { validateColumnName } from '../../../domain/columnNames'
import { EMPTY_TABLE_WORKBOOK_VIEW } from '../../../application/workbookViewState'
import { contextMenuPosition } from '../../contextMenuPosition'
import { calculateWorkbookViewportMetrics, columnIndexToLabel, parseClipboardMatrix, selectionRange, workbookCoordinate, workbookPointerTarget, workbookVirtualEditExpansion, type CellRange, type GridCellPosition, type GridEditEntryMode, type GridEditSession, type GridSelection, type WorkbookDisplayColumn, type WorkbookDisplayColumnMetric, type WorkbookViewportMetrics } from '../../gridTypes'
import { useWorkbenchStore } from '../../state/workbenchStore'
import { TableContextMenu, type TableContextMenuState } from './TableContextMenu'
import { ColumnFilterPopover } from './ColumnFilterPopover'
import { FindReplaceBar } from './FindReplaceBar'
import { HiddenColumnsMenu } from './HiddenColumnsMenu'
import { SpreadsheetToolbar } from './SpreadsheetToolbar'
import { WorkbookSheetTabs } from './WorkbookSheetTabs'
import { WorkbookColumnMenu } from './WorkbookColumnMenu'
import { VirtualWorkbookGrid } from './VirtualWorkbookGrid'
import { matchesWorkbookFilter, replaceWorkbookText, validateCellInput } from '../../workbookGridOperations'
import { autofillExtent, computeMoveTarget, copyFillValuesDirectional, fillValuesDirectional, moveUpdates, pointerToRowInsertionIndex, type FillDirection, type MoveCell } from '../../gridDragOperations'
import { PasteSpecialDialog, type PasteSpecialState } from './PasteSpecialDialog'
import { WorkbookCellEditor } from './WorkbookCellEditor'
import { useDebouncedValue } from './useDebouncedValue'
import {
  COLUMN_LETTER_HEIGHT,
  FIELD_HEADER_HEIGHT,
  GHOST_COLUMN_WIDTH,
  HEADER_HEIGHT,
  ROW_HEADER_WIDTH,
  ROW_HEIGHT,
  WORKBOOK_VIRTUAL_ROW_COUNT,
  cellText,
  columnEditorOptions,
  columnFilterSuggestions,
  parseWorkbookAddress,
  transposeClipboardMatrix,
  type CutSelection,
  type FillPreview,
  type GridDragGesture,
  type PendingVirtualEdit,
  type PointerSelectionDrag,
  type WorkbookMatch,
} from './workbookViewModel'

export function DataGridView() {
  const tables = useWorkbenchStore((state) => state.document.schema.tables)
  const selectedTableId = useWorkbenchStore((state) => state.selectedTableId)
  const selectTable = useWorkbenchStore((state) => state.selectTable)
  const createTable = useWorkbenchStore((state) => state.createTable)
  const prepareImport = useWorkbenchStore((state) => state.prepareImport)
  const setMainView = useWorkbenchStore((state) => state.setMainView)
  const selectedTableExists = tables.some((table) => table.tableId === selectedTableId)

  useEffect(() => {
    if (!selectedTableExists && tables[0]) selectTable(tables[0].tableId)
  }, [selectTable, selectedTableExists, tables])

  if (tables.length > 0) return <PopulatedDataGridView />

  return (
    <section className="data-shell spreadsheet-empty-state" aria-label="데이터 그리드">
      <div className="view-header spreadsheet-header">
        <div><h1>테이블 편집</h1><p>프로젝트에 아직 테이블이 없습니다.</p></div>
      </div>
      <div className="spreadsheet-empty-start">
        <span className="spreadsheet-empty-icon"><Table2 aria-hidden="true" size={24} /></span>
        <strong>편집할 테이블이 없습니다.</strong>
        <p>첫 테이블을 만들거나 CSV·Excel 파일을 가져오면 바로 격자에서 편집할 수 있습니다.</p>
        <div>
          <button
            className="primary-action"
            type="button"
            onClick={() => {
              createTable()
              setMainView('data')
            }}
          >
            <Plus aria-hidden="true" size={16} />
            <span>첫 테이블 만들기</span>
          </button>
          <label className="tool-button spreadsheet-empty-import">
            <FileSpreadsheet aria-hidden="true" size={16} />
            <span>CSV·Excel 가져오기</span>
            <input
              type="file"
              multiple
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                const files = [...(event.currentTarget.files ?? [])]
                if (files.length > 0) void prepareImport(files)
                event.currentTarget.value = ''
              }}
            />
          </label>
        </div>
      </div>
    </section>
  )
}

function PopulatedDataGridView() {
  const project = useWorkbenchStore((state) => state.document.schema)
  const selectedTableId = useWorkbenchStore((state) => state.selectedTableId)
  const selectedColumnId = useWorkbenchStore((state) => state.selectedColumnId)
  const rowsByTable = useWorkbenchStore((state) => state.document.rowsByTable)
  const resolvedTableId = project.tables.some((table) => table.tableId === selectedTableId)
    ? selectedTableId
    : project.tables[0]?.tableId ?? ''
  const persistedWorkbookView = useWorkbenchStore((state) => state.document.workbookViews[resolvedTableId])
  const updateTableWorkbookView = useWorkbenchStore((state) => state.updateTableWorkbookView)
  const addRow = useWorkbenchStore((state) => state.addRow)
  const insertRowWithCells = useWorkbenchStore((state) => state.insertRowWithCells)
  const updateCells = useWorkbenchStore((state) => state.updateCells)
  const applyWorkbookRange = useWorkbenchStore((state) => state.applyWorkbookRange)
  const replaceWorkbookMatches = useWorkbenchStore((state) => state.replaceWorkbookMatches)
  const renameColumn = useWorkbenchStore((state) => state.renameColumn)
  const addColumnToTable = useWorkbenchStore((state) => state.addColumnToTable)
  const moveColumn = useWorkbenchStore((state) => state.moveColumn)
  const moveRows = useWorkbenchStore((state) => state.moveRows)
  const deleteColumn = useWorkbenchStore((state) => state.deleteColumn)
  const selectTable = useWorkbenchStore((state) => state.selectTable)
  const selectColumn = useWorkbenchStore((state) => state.selectColumn)
  const createTable = useWorkbenchStore((state) => state.createTable)
  const deleteTable = useWorkbenchStore((state) => state.deleteTable)
  const setMainView = useWorkbenchStore((state) => state.setMainView)
  const setDesignerTab = useWorkbenchStore((state) => state.setDesignerTab)
  const schemaTable = requireTable(project, resolvedTableId)
  const rows = useMemo(() => [...(rowsByTable[resolvedTableId] ?? [])], [resolvedTableId, rowsByTable])
  const workbookView = persistedWorkbookView ?? EMPTY_TABLE_WORKBOOK_VIEW
  const sorting = useMemo<SortingState>(() => workbookView.sorting.map((sort) => ({
    id: sort.columnId,
    desc: sort.descending,
  })), [workbookView.sorting])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => workbookView.filters.map((filter) => ({ id: filter.columnId, value: filter })))
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => ({ ...workbookView.columnWidths }))
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [selection, setSelection] = useState<GridSelection | null>(null)
  const [selectionKind, setSelectionKind] = useState<'cell' | 'row' | 'column' | 'all'>('cell')
  const [editing, setEditing] = useState<GridEditSession | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [pendingVirtualEdit, setPendingVirtualEdit] = useState<PendingVirtualEdit | null>(null)
  const [pendingSchemaEditId, setPendingSchemaEditId] = useState<EntityId | null>(null)
  const [selectedHeaderId, setSelectedHeaderId] = useState<EntityId | null>(null)
  const [headerMenuId, setHeaderMenuId] = useState<EntityId | null>(null)
  const [draggingColumnId, setDraggingColumnId] = useState<EntityId | null>(null)
  const [resizingColumnId, setResizingColumnId] = useState<EntityId | null>(null)
  const [gridError, setGridError] = useState<string | null>(null)
  const [tableMenu, setTableMenu] = useState<TableContextMenuState | null>(null)
  const [filterPanel, setFilterPanel] = useState<{ readonly columnId: EntityId; readonly x: number; readonly y: number } | null>(null)
  const [findMode, setFindMode] = useState<'find' | 'replace' | null>(null)
  const [findQuery, setFindQuery] = useState('')
  const [findReplacement, setFindReplacement] = useState('')
  const [findMatchIndex, setFindMatchIndex] = useState(0)
  const [cutSelection, setCutSelection] = useState<CutSelection | null>(null)
  const [hiddenColumnsMenu, setHiddenColumnsMenu] = useState<{ readonly x: number; readonly y: number } | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [movePreview, setMovePreview] = useState<CellRange | null>(null)
  const [fillPreview, setFillPreview] = useState<FillPreview | null>(null)
  const [fillModePreference, setFillModePreference] = useState<FillPreview['mode']>('series')
  const [pasteSpecial, setPasteSpecial] = useState<PasteSpecialState | null>(null)
  const [goToOpen, setGoToOpen] = useState(false)
  const [goToAddress, setGoToAddress] = useState('')
  const [rowDropIndex, setRowDropIndex] = useState<number | null>(null)
  const debouncedRowsByTable = useDebouncedValue(rowsByTable, 280)
  const scrollRef = useRef<HTMLDivElement>(null)
  const keyboardCaptureRef = useRef<HTMLTextAreaElement>(null)
  const pointerSelectionRef = useRef<PointerSelectionDrag | null>(null)
  const suppressClickRef = useRef(false)
  // 선택 영역/행을 잡아 끄는 제스처. 범위 선택(pointerSelectionRef)과 배타적으로 동작한다.
  const gestureRef = useRef<GridDragGesture | null>(null)
  const editingRef = useRef<GridEditSession | null>(null)
  const editDraftRef = useRef('')
  const commitActiveEditRef = useRef<(focusAfterCommit?: boolean) => boolean>(() => true)
  const sortingRef = useRef<SortingState>(sorting)
  const columnFiltersRef = useRef<ColumnFiltersState>(columnFilters)
  const columnSizingRef = useRef<ColumnSizingState>(columnSizing)
  const workbookViewRef = useRef(workbookView)
  workbookViewRef.current = workbookView
  sortingRef.current = sorting

  useEffect(() => {
    const viewport = scrollRef.current
    if (!viewport) return
    const update = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setSelection(null)
    setSelectionKind('cell')
    setEditing(null)
    editingRef.current = null
    setEditDraft('')
    editDraftRef.current = ''
    setSearch('')
    const nextWorkbookView = workbookViewRef.current
    const nextSorting = nextWorkbookView.sorting.map((sort) => ({ id: sort.columnId, desc: sort.descending }))
    const nextFilters = nextWorkbookView.filters.map((filter) => ({ id: filter.columnId, value: filter }))
    sortingRef.current = nextSorting
    columnFiltersRef.current = nextFilters
    setColumnFilters(nextFilters)
    const nextColumnSizing = { ...nextWorkbookView.columnWidths }
    columnSizingRef.current = nextColumnSizing
    setColumnSizing(nextColumnSizing)
    setSelectedHeaderId(null)
    setHeaderMenuId(null)
    setGridError(null)
    setTableMenu(null)
    setFilterPanel(null)
    setFindMode(null)
    setFindQuery('')
    setFindReplacement('')
    setFindMatchIndex(0)
    setCutSelection(null)
    setHiddenColumnsMenu(null)
    setPasteSpecial(null)
    setGoToOpen(false)
    setGoToAddress('')
  }, [schemaTable.tableId])

  const changeSorting = useCallback((updater: SortingState | ((current: SortingState) => SortingState)) => {
    const next = typeof updater === 'function' ? updater(sortingRef.current) : updater
    sortingRef.current = next
    updateTableWorkbookView(schemaTable.tableId, {
      sorting: next.map((sort) => ({ columnId: sort.id, descending: sort.desc })),
    })
  }, [schemaTable.tableId, updateTableWorkbookView])

  const changeColumnSizing = useCallback((updater: ColumnSizingState | ((current: ColumnSizingState) => ColumnSizingState)) => {
    const next = typeof updater === 'function' ? updater(columnSizingRef.current) : updater
    columnSizingRef.current = next
    setColumnSizing(next)
    updateTableWorkbookView(schemaTable.tableId, { columnWidths: next })
  }, [schemaTable.tableId, updateTableWorkbookView])

  const changeColumnFilters = useCallback((updater: ColumnFiltersState | ((current: ColumnFiltersState) => ColumnFiltersState)) => {
    const next = typeof updater === 'function' ? updater(columnFiltersRef.current) : updater
    columnFiltersRef.current = next
    setColumnFilters(next)
    updateTableWorkbookView(schemaTable.tableId, {
      filters: next.map((filter) => filter.value as WorkbookColumnFilter),
    })
  }, [schemaTable.tableId, updateTableWorkbookView])

  useEffect(() => {
    const validColumnIds = new Set(schemaTable.columns.map((column) => column.columnId))
    const nextSorting = sortingRef.current.filter((sort) => validColumnIds.has(sort.id))
    const nextFilters = columnFiltersRef.current.filter((filter) => validColumnIds.has(filter.id))
    const nextSizing = Object.fromEntries(Object.entries(columnSizingRef.current).filter(([columnId]) => validColumnIds.has(columnId)))
    const sortingChanged = nextSorting.length !== sortingRef.current.length
    const filtersChanged = nextFilters.length !== columnFiltersRef.current.length
    const sizingChanged = Object.keys(nextSizing).length !== Object.keys(columnSizingRef.current).length
    if (!sortingChanged && !filtersChanged && !sizingChanged) return

    sortingRef.current = nextSorting
    columnFiltersRef.current = nextFilters
    columnSizingRef.current = nextSizing
    setColumnFilters(nextFilters)
    setColumnSizing(nextSizing)
    updateTableWorkbookView(schemaTable.tableId, {
      sorting: nextSorting.map((sort) => ({ columnId: sort.id, descending: sort.desc })),
      filters: nextFilters.map((filter) => filter.value as WorkbookColumnFilter),
      columnWidths: nextSizing,
    })
  }, [schemaTable.columns, schemaTable.tableId, updateTableWorkbookView])

  const columnDefs = useMemo<ColumnDef<DataRow>[]>(() => schemaTable.columns.map((column) => ({
    id: column.columnId,
    accessorFn: (row) => cellText(row.cells[column.columnId]),
    header: column.name,
    size: 160,
    minSize: 92,
    maxSize: 480,
    sortingFn: 'alphanumeric',
    filterFn: (row, columnId, filterValue) => matchesWorkbookFilter(
      cellText(row.original.cells[columnId]),
      filterValue as WorkbookColumnFilter,
      column.dataType.kind,
    ),
  })), [schemaTable.columns])
  const validColumnIds = useMemo(() => new Set(schemaTable.columns.map((column) => column.columnId)), [schemaTable.columns])
  const activeSorting = useMemo(() => sorting.filter((sort) => validColumnIds.has(sort.id)), [sorting, validColumnIds])
  const activeColumnFilters = useMemo(() => columnFilters.filter((filter) => validColumnIds.has(filter.id)), [columnFilters, validColumnIds])
  const activeColumnSizing = useMemo(() => Object.fromEntries(
    Object.entries(columnSizing).filter(([columnId]) => validColumnIds.has(columnId)),
  ), [columnSizing, validColumnIds])
  const columnVisibility = useMemo(() => Object.fromEntries(schemaTable.columns.map((column) => [
    column.columnId,
    !workbookView.hiddenColumnIds.includes(column.columnId),
  ])), [schemaTable.columns, workbookView.hiddenColumnIds])
  const columnPinning = useMemo(() => ({
    left: [...workbookView.frozenColumnIds],
    right: [] as EntityId[],
  }), [workbookView.frozenColumnIds])

  const tableModel = useReactTable({
    data: rows,
    columns: columnDefs,
    state: {
      sorting: activeSorting,
      columnFilters: activeColumnFilters,
      columnSizing: activeColumnSizing,
      columnVisibility,
      columnPinning,
      globalFilter: deferredSearch,
    },
    onColumnFiltersChange: changeColumnFilters,
    onColumnSizingChange: changeColumnSizing,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  const transformedRows = activeSorting.length > 0 || activeColumnFilters.length > 0 || deferredSearch.trim().length > 0 ? tableModel.getRowModel().rows : null
  const viewRowCount = transformedRows?.length ?? rows.length
  const workbookRowCount = viewRowCount + 1
  const viewRowAt = useCallback((index: number) => {
    const transformed = transformedRows?.[index]
    return transformed ? { original: transformed.original, originalIndex: transformed.index } : { original: rows[index]!, originalIndex: index }
  }, [rows, transformedRows])
  const visibleColumns = tableModel.getVisibleLeafColumns()
  const rowVirtualizer = useVirtualizer({
    count: viewRowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: visibleColumns.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => visibleColumns[index]?.getSize() ?? 160,
    overscan: 2,
  })
  useEffect(() => {
    // TanStack Virtual caches horizontal item measurements. Column sizing is
    // owned by TanStack Table, so explicitly invalidate the virtualizer after
    // every live resize to keep headers, cells, and the empty grid aligned.
    columnVirtualizer.measure()
  }, [activeColumnSizing, columnVirtualizer, visibleColumns.length])
  const virtualRows = rowVirtualizer.getVirtualItems()
  const virtualColumns = workbookView.frozenColumnIds.length > 0
    ? visibleColumns.map((column, index) => ({
      index,
      start: column.getStart(),
      size: column.getSize(),
      end: column.getStart() + column.getSize(),
      key: column.id,
      lane: 0,
    }))
    : columnVirtualizer.getVirtualItems().map((virtualColumn) => {
      const column = visibleColumns[virtualColumn.index]
      const start = column?.getStart() ?? virtualColumn.start
      const size = column?.getSize() ?? virtualColumn.size
      return { ...virtualColumn, start, size, end: start + size }
    })
  const frozenColumnIds = new Set(workbookView.frozenColumnIds)
  const lastFrozenColumnId = workbookView.frozenColumnIds.at(-1)
  const authoredColumnsWidth = visibleColumns.reduce((sum, column) => sum + column.getSize(), 0)
  const viewportMetrics: WorkbookViewportMetrics = useMemo(() => calculateWorkbookViewportMetrics({
    width: viewportSize.width,
    height: viewportSize.height,
    authoredWidth: authoredColumnsWidth,
    authoredRowCount: viewRowCount,
    rowHeaderWidth: ROW_HEADER_WIDTH,
    headerHeight: HEADER_HEIGHT,
    rowHeight: ROW_HEIGHT,
    ghostColumnWidth: GHOST_COLUMN_WIDTH,
  }), [authoredColumnsWidth, viewRowCount, viewportSize.height, viewportSize.width])
  const appendColumnIndex = visibleColumns.length
  const appendRowIndex = workbookRowCount
  const displayRowCount = WORKBOOK_VIRTUAL_ROW_COUNT + 1
  const ghostRowVirtualizer = useVirtualizer({
    count: Math.max(0, WORKBOOK_VIRTUAL_ROW_COUNT - appendRowIndex),
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    paddingStart: HEADER_HEIGHT + appendRowIndex * ROW_HEIGHT,
  })
  const virtualGhostRows = ghostRowVirtualizer.getVirtualItems().map((row) => ({
    ...row,
    displayIndex: appendRowIndex + 1 + row.index,
  }))
  const displayColumns = useMemo<readonly WorkbookDisplayColumn[]>(() => [
    ...visibleColumns.map((column, displayIndex) => ({ displayIndex, kind: 'data' as const, columnId: column.id })),
    { displayIndex: appendColumnIndex, kind: 'append' as const, columnId: null },
    ...Array.from({ length: viewportMetrics.ghostColumnCount }, (_, offset) => ({
      displayIndex: appendColumnIndex + 1 + offset,
      kind: 'ghost' as const,
      columnId: null,
    })),
  ], [appendColumnIndex, viewportMetrics.ghostColumnCount, visibleColumns])
  const displayColumnMetrics = useMemo<readonly WorkbookDisplayColumnMetric[]>(() => displayColumns.map((column) => {
    if (column.kind === 'data') {
      const authored = visibleColumns[column.displayIndex]!
      return { displayIndex: column.displayIndex, start: authored.getStart(), size: authored.getSize() }
    }
    return {
      displayIndex: column.displayIndex,
      start: authoredColumnsWidth + (column.displayIndex - appendColumnIndex) * GHOST_COLUMN_WIDTH,
      size: GHOST_COLUMN_WIDTH,
    }
  }), [appendColumnIndex, authoredColumnsWidth, displayColumns, visibleColumns])
  const lastDisplayRowIndex = displayRowCount - 1
  const lastDisplayColumnIndex = displayColumns.at(-1)?.displayIndex ?? 0
  const totalWidth = ROW_HEADER_WIDTH + authoredColumnsWidth + GHOST_COLUMN_WIDTH * (1 + viewportMetrics.ghostColumnCount)
  const totalHeight = HEADER_HEIGHT + ROW_HEIGHT * WORKBOOK_VIRTUAL_ROW_COUNT
  const issues = useMemo(() => validateProjectWithRows(project, debouncedRowsByTable), [project, debouncedRowsByTable])
  const cellIssues = useMemo(() => {
    const next = new Map<string, string>()
    for (const issue of issues) {
      if (!issue.rowIndices?.length || !issue.tableIds.includes(schemaTable.tableId)) continue
      for (const columnId of issue.columnIds) for (const rowIndex of issue.rowIndices) next.set(`${rowIndex}:${columnId}`, issue.title)
    }
    return next
  }, [issues, schemaTable.tableId])
  const foreignKeyColumnIds = useMemo(() => new Set(
    project.relations
      .filter((relation) => relation.sourceTableId === schemaTable.tableId)
      .flatMap((relation) => relation.sourceColumnIds),
  ), [project.relations, schemaTable.tableId])
  const editorOptionsByColumn = useMemo(() => new Map(schemaTable.columns.map((column) => [
    column.columnId,
    columnEditorOptions(project, rowsByTable, schemaTable.tableId, column),
  ])), [project, rowsByTable, schemaTable.columns, schemaTable.tableId])
  const cellInputError = useCallback((columnId: EntityId, value: string) => {
    const column = schemaTable.columns.find((candidate) => candidate.columnId === columnId)
    if (!column) return '열을 찾을 수 없습니다.'
    return validateCellInput(column, value, editorOptionsByColumn.get(columnId)?.options)
  }, [editorOptionsByColumn, schemaTable.columns])
  const range = selection ? selectionRange(selection) : null
  const selectionOverlay = useMemo(() => {
    if (!range || displayColumnMetrics.length === 0 || displayRowCount === 0) return null
    const startColumn = displayColumnMetrics.find((column) => column.displayIndex === Math.max(0, range.startColumn))
    const endColumn = displayColumnMetrics.find((column) => column.displayIndex === Math.min(lastDisplayColumnIndex, range.endColumn))
    if (!startColumn || !endColumn) return null
    const startRow = Math.max(0, Math.min(lastDisplayRowIndex, range.startRow))
    const endRow = Math.max(startRow, Math.min(lastDisplayRowIndex, range.endRow))
    const rowTop = (rowIndex: number) => rowIndex === 0 ? COLUMN_LETTER_HEIGHT : HEADER_HEIGHT + (rowIndex - 1) * ROW_HEIGHT
    const rowBottom = (rowIndex: number) => rowTop(rowIndex) + (rowIndex === 0 ? FIELD_HEADER_HEIGHT : ROW_HEIGHT)
    return {
      left: ROW_HEADER_WIDTH + startColumn.start,
      top: rowTop(startRow),
      width: endColumn.start + endColumn.size - startColumn.start,
      height: rowBottom(endRow) - rowTop(startRow),
    }
  }, [displayColumnMetrics, displayRowCount, lastDisplayColumnIndex, lastDisplayRowIndex, range])
  const findMatches = useMemo<readonly WorkbookMatch[]>(() => {
    const query = findQuery.trim().toLocaleLowerCase('ko-KR')
    if (!query) return []
    const matches: WorkbookMatch[] = []
    visibleColumns.forEach((column, columnIndex) => {
      const schemaColumn = schemaTable.columns.find((candidate) => candidate.columnId === column.id)
      if (schemaColumn?.name.toLocaleLowerCase('ko-KR').includes(query)) {
        matches.push({ kind: 'schema', position: { rowIndex: 0, columnIndex }, columnId: column.id })
      }
    })
    for (let viewIndex = 0; viewIndex < viewRowCount; viewIndex += 1) {
      const row = viewRowAt(viewIndex).original
      visibleColumns.forEach((column, columnIndex) => {
        if (!cellText(row.cells[column.id]).toLocaleLowerCase('ko-KR').includes(query)) return
        matches.push({
          kind: 'data',
          position: { rowIndex: viewIndex + 1, columnIndex },
          columnId: column.id,
          rowId: row.rowId,
        })
      })
    }
    return matches
  }, [findQuery, schemaTable.columns, viewRowAt, viewRowCount, visibleColumns])

  useEffect(() => {
    setFindMatchIndex((current) => Math.max(0, Math.min(current, findMatches.length - 1)))
  }, [findMatches.length])

  useEffect(() => {
    const openFind = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLocaleLowerCase('en-US')
      if (key !== 'f' && key !== 'h') return
      event.preventDefault()
      setFindMode(key === 'h' ? 'replace' : 'find')
    }
    window.addEventListener('keydown', openFind, true)
    return () => window.removeEventListener('keydown', openFind, true)
  }, [])

  useEffect(() => {
    setSelection((current) => {
      if (!current) return current
      const positions = [current.anchor, current.focus]
      return positions.some((position) => (
        position.rowIndex < 0
        || position.rowIndex > appendRowIndex
        || position.columnIndex < 0
        || position.columnIndex > lastDisplayColumnIndex
      )) ? null : current
    })
  }, [appendRowIndex, lastDisplayColumnIndex])

  useEffect(() => {
    if (!selectedHeaderId || pendingSchemaEditId) return
    const index = schemaTable.columns.findIndex((column) => column.columnId === selectedHeaderId)
    if (index >= 0) columnVirtualizer.scrollToIndex(index, { align: 'auto' })
  }, [columnVirtualizer, pendingSchemaEditId, schemaTable.columns, selectedHeaderId])

  useEffect(() => {
    if (!headerMenuId) return
    const closeOnPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.column-menu') && !target.closest('.column-menu-trigger')) setHeaderMenuId(null)
    }
    const closeOnKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setHeaderMenuId(null)
    }
    document.addEventListener('pointerdown', closeOnPointer)
    document.addEventListener('keydown', closeOnKey)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointer)
      document.removeEventListener('keydown', closeOnKey)
    }
  }, [headerMenuId])

  useEffect(() => {
    if (!selectedColumnId) return
    const index = schemaTable.columns.findIndex((column) => column.columnId === selectedColumnId)
    if (index < 0) return
    setSelectedHeaderId(selectedColumnId)
    columnVirtualizer.scrollToIndex(index, { align: 'auto' })
  }, [columnVirtualizer, schemaTable.columns, selectedColumnId])

  const focusKeyboardCapture = useCallback(() => {
    keyboardCaptureRef.current?.focus({ preventScroll: true })
  }, [])

  const focusGridOnPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('input, select, textarea, button, [role="menu"], .column-resizer, .column-drag-handle, .autofill-handle')) return
    if (target.closest('[role="gridcell"]')) focusKeyboardCapture()
  }, [focusKeyboardCapture])

  const changeEditDraft = useCallback((value: string) => {
    editDraftRef.current = value
    setEditDraft(value)
  }, [])

  const clearEditSession = useCallback(() => {
    editingRef.current = null
    setEditing(null)
    changeEditDraft('')
  }, [changeEditDraft])

  const selectCell = useCallback((position: GridCellPosition, extend = false) => {
    if (!commitActiveEditRef.current(false)) return
    setSelectionKind('cell')
    setSelection((current) => ({ anchor: extend && current ? current.anchor : position, focus: position }))
    focusKeyboardCapture()
  }, [focusKeyboardCapture])

  const moveSelection = useCallback((rowDelta: number, columnDelta: number, extend = false, commitBeforeMove = true) => {
    if (commitBeforeMove && !commitActiveEditRef.current(false)) return
    setSelection((current) => {
      const origin = current?.focus ?? { rowIndex: 0, columnIndex: 0 }
      const next = {
        rowIndex: Math.max(0, Math.min(lastDisplayRowIndex, origin.rowIndex + rowDelta)),
        columnIndex: Math.max(0, Math.min(lastDisplayColumnIndex, origin.columnIndex + columnDelta)),
      }
      if (next.rowIndex > 0 && next.rowIndex < appendRowIndex) rowVirtualizer.scrollToIndex(next.rowIndex - 1, { align: 'auto' })
      else if (next.rowIndex >= appendRowIndex && scrollRef.current) {
        scrollRef.current.scrollTop = Math.max(0, HEADER_HEIGHT + (next.rowIndex - 1) * ROW_HEIGHT - scrollRef.current.clientHeight / 2)
      }
      if (next.columnIndex < appendColumnIndex) columnVirtualizer.scrollToIndex(next.columnIndex, { align: 'auto' })
      return { anchor: extend && current ? current.anchor : next, focus: next }
    })
    setSelectionKind('cell')
    focusKeyboardCapture()
  }, [appendColumnIndex, appendRowIndex, columnVirtualizer, focusKeyboardCapture, lastDisplayColumnIndex, lastDisplayRowIndex, rowVirtualizer])

  const jumpSelection = useCallback((rowIndex: number, columnIndex: number, extend = false) => {
    if (!commitActiveEditRef.current(false)) return
    const next = {
      rowIndex: Math.max(0, Math.min(lastDisplayRowIndex, rowIndex)),
      columnIndex: Math.max(0, Math.min(lastDisplayColumnIndex, columnIndex)),
    }
    if (next.rowIndex > 0 && next.rowIndex < appendRowIndex) rowVirtualizer.scrollToIndex(next.rowIndex - 1, { align: 'auto' })
    else if (next.rowIndex >= appendRowIndex && scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, HEADER_HEIGHT + (next.rowIndex - 1) * ROW_HEIGHT - scrollRef.current.clientHeight / 2)
    }
    if (next.columnIndex < appendColumnIndex) columnVirtualizer.scrollToIndex(next.columnIndex, { align: 'auto' })
    setSelection((current) => ({ anchor: extend && current ? current.anchor : next, focus: next }))
    setSelectionKind('cell')
    focusKeyboardCapture()
  }, [appendColumnIndex, appendRowIndex, columnVirtualizer, focusKeyboardCapture, lastDisplayColumnIndex, lastDisplayRowIndex, rowVirtualizer])

  const cellAt = useCallback((position: GridCellPosition) => {
    if (position.rowIndex === 0 && position.columnIndex === appendColumnIndex) {
      return { kind: 'append-column' as const, value: '' }
    }
    // 빈 열의 데이터 칸. 값을 입력하면 열이 자동으로 생기고 그 값이 들어간다.
    if (position.columnIndex === appendColumnIndex) {
      if (position.rowIndex < 1 || position.rowIndex > appendRowIndex) return null
      return {
        kind: 'append-column-cell' as const,
        value: '',
        isAppendRow: position.rowIndex === appendRowIndex,
        dataRowIndex: position.rowIndex - 1,
      }
    }
    const coordinate = workbookCoordinate(position.rowIndex, position.columnIndex)
    if (coordinate.rowIndex < 0 || coordinate.rowIndex > appendRowIndex) return null
    const column = visibleColumns[position.columnIndex]
    if (!column) return null
    const schemaColumn = schemaTable.columns.find((candidate) => candidate.columnId === column.id)
    if (!schemaColumn) return null
    if (coordinate.rowKind === 'schema') {
      return { kind: 'schema' as const, column, schemaColumn, value: schemaColumn.name }
    }
    if (position.rowIndex === appendRowIndex) {
      return { kind: 'append-row' as const, column, schemaColumn, value: '' }
    }
    const row = viewRowAt(coordinate.dataRowIndex!)
    return { kind: 'data' as const, row, column, schemaColumn, value: row.original.cells[column.id] }
  }, [appendColumnIndex, appendRowIndex, schemaTable.columns, viewRowAt, visibleColumns])

  const commitActiveEdit = useCallback((focusAfterCommit = true) => {
    const session = editingRef.current
    if (!session) return true
    const cell = cellAt(session.position)
    const nextValue = editDraftRef.current
    clearEditSession()
    if (cell && nextValue !== cellText(cell.value)) {
      if (cell.kind === 'append-column') {
        const nameError = validateColumnName(schemaTable, '__append_column__', nextValue)
        if (nameError) {
          setGridError(nameError)
          focusKeyboardCapture()
          return false
        }
        addColumnToTable(schemaTable.tableId, { stayInView: true, name: nextValue })
      } else if (cell.kind === 'append-column-cell') {
        // 엑셀처럼 빈 칸에 바로 값을 친다. 열은 기본 이름으로 만들고 이름은 1행에서 고친다.
        const createdColumnId = addColumnToTable(schemaTable.tableId, { stayInView: true })
        if (!createdColumnId) {
          setGridError('열을 만들지 못했습니다.')
          focusKeyboardCapture()
          return false
        }
        if (cell.isAppendRow) insertRowWithCells(schemaTable.tableId, { [createdColumnId]: nextValue })
        else {
          const targetRow = viewRowAt(cell.dataRowIndex).original
          updateCells(schemaTable.tableId, [{ rowId: targetRow.rowId, columnId: createdColumnId, value: nextValue }])
        }
      } else if (cell.kind === 'schema') {
        const nameError = validateColumnName(schemaTable, cell.schemaColumn.columnId, nextValue)
        if (nameError) {
          setGridError(nameError)
          focusKeyboardCapture()
          return false
        }
        renameColumn(schemaTable.tableId, cell.schemaColumn.columnId, nextValue)
      } else if (cell.kind === 'append-row') {
        const inputWarning = cellInputError(cell.schemaColumn.columnId, nextValue)
        insertRowWithCells(schemaTable.tableId, { [cell.column.id]: nextValue })
        if (inputWarning) {
          setGridError(`입력은 저장했습니다. 검증 경고: ${inputWarning}`)
        } else if (activeColumnFilters.length > 0 || activeSorting.length > 0 || deferredSearch.trim()) {
          setGridError('행이 현재 정렬·필터 결과에서 다른 위치로 이동하거나 숨겨질 수 있습니다.')
        }
      } else {
        const inputWarning = cellInputError(cell.schemaColumn.columnId, nextValue)
        updateCells(schemaTable.tableId, [{ rowId: cell.row.original.rowId, columnId: cell.column.id, value: nextValue }])
        setGridError(inputWarning ? `입력은 저장했습니다. 검증 경고: ${inputWarning}` : null)
      }
    }
    if (focusAfterCommit) focusKeyboardCapture()
    return true
  }, [activeColumnFilters.length, activeSorting.length, addColumnToTable, cellAt, cellInputError, clearEditSession, deferredSearch, focusKeyboardCapture, insertRowWithCells, renameColumn, schemaTable, updateCells, viewRowAt])
  commitActiveEditRef.current = commitActiveEdit

  const beginEdit = useCallback((position: GridCellPosition, mode: GridEditEntryMode, seedText?: string) => {
    const cell = cellAt(position)
    if (!cell) return
    setGridError(null)
    const session: GridEditSession = { position, mode, seedText }
    const nextDraft = mode === 'replace' ? seedText ?? '' : cellText(cell.value)
    editingRef.current = session
    setSelectionKind('cell')
    setSelection({ anchor: position, focus: position })
    setEditing(session)
    changeEditDraft(nextDraft)
  }, [cellAt, changeEditDraft])

  const beginGridEdit = useCallback((position: GridCellPosition, mode: GridEditEntryMode, seedText?: string) => {
    if (activeColumnFilters.length > 0 || activeSorting.length > 0 || deferredSearch.trim()) {
      setGridError('필터나 정렬이 적용된 상태에서는 빈 영역을 확장해 입력할 수 없습니다. 필터와 정렬을 먼저 해제하세요.')
      return
    }

    const { columnsToCreate, rowsToCreate } = workbookVirtualEditExpansion(
      position,
      appendColumnIndex,
      rows.length,
    )

    if (columnsToCreate === 0 && rowsToCreate === 0) {
      beginEdit(position, mode, seedText)
      return
    }

    // Excel처럼 보이는 빈 셀에서 바로 입력할 수 있게, 선택한 위치까지 필요한
    // 스키마 열과 데이터 행만 typed Command 경계를 통해 실제로 만든다.
    for (let index = 0; index < columnsToCreate; index += 1) {
      addColumnToTable(schemaTable.tableId, { stayInView: true })
    }
    for (let index = 0; index < rowsToCreate; index += 1) addRow(schemaTable.tableId)
    setPendingVirtualEdit({ position, mode, seedText })
  }, [activeColumnFilters.length, activeSorting.length, addColumnToTable, addRow, appendColumnIndex, beginEdit, deferredSearch, rows.length, schemaTable.tableId])

  useEffect(() => {
    if (
      !pendingVirtualEdit
      || pendingVirtualEdit.position.rowIndex > rows.length
      || pendingVirtualEdit.position.columnIndex >= schemaTable.columns.length
    ) return
    beginEdit(pendingVirtualEdit.position, pendingVirtualEdit.mode, pendingVirtualEdit.seedText)
    setPendingVirtualEdit(null)
  }, [beginEdit, pendingVirtualEdit, rows.length, schemaTable.columns.length])

  useEffect(() => {
    if (!pendingSchemaEditId) return
    const index = schemaTable.columns.findIndex((column) => column.columnId === pendingSchemaEditId)
    if (index < 0) return
    columnVirtualizer.scrollToIndex(index, { align: 'end' })
    beginEdit({ rowIndex: 0, columnIndex: index }, 'preserve')
    setSelectedHeaderId(pendingSchemaEditId)
    setPendingSchemaEditId(null)
  }, [beginEdit, columnVirtualizer, pendingSchemaEditId, schemaTable.columns])

  const finishEdit = useCallback((commit: boolean, rowDelta = 0, columnDelta = 0) => {
    const session = editingRef.current
    if (!session) return
    const cell = cellAt(session.position)
    const nextValue = editDraftRef.current
    clearEditSession()
    if (commit && cell && nextValue !== cellText(cell.value)) {
      if (cell.kind === 'append-column') {
        const nameError = validateColumnName(schemaTable, '__append_column__', nextValue)
        if (nameError) {
          setGridError(nameError)
          focusKeyboardCapture()
          return
        }
        addColumnToTable(schemaTable.tableId, { stayInView: true, name: nextValue })
      } else if (cell.kind === 'append-column-cell') {
        // 엑셀처럼 빈 칸에 바로 값을 친다. 열은 기본 이름으로 만들고 이름은 1행에서 고친다.
        const createdColumnId = addColumnToTable(schemaTable.tableId, { stayInView: true })
        if (!createdColumnId) {
          setGridError('열을 만들지 못했습니다.')
          focusKeyboardCapture()
          return false
        }
        if (cell.isAppendRow) insertRowWithCells(schemaTable.tableId, { [createdColumnId]: nextValue })
        else {
          const targetRow = viewRowAt(cell.dataRowIndex).original
          updateCells(schemaTable.tableId, [{ rowId: targetRow.rowId, columnId: createdColumnId, value: nextValue }])
        }
      } else if (cell.kind === 'schema') {
        const nameError = validateColumnName(schemaTable, cell.schemaColumn.columnId, nextValue)
        if (nameError) {
          setGridError(nameError)
          focusKeyboardCapture()
          return
        }
        renameColumn(schemaTable.tableId, cell.schemaColumn.columnId, nextValue)
      } else if (cell.kind === 'append-row') {
        const inputWarning = cellInputError(cell.schemaColumn.columnId, nextValue)
        insertRowWithCells(schemaTable.tableId, { [cell.column.id]: nextValue })
        if (inputWarning) {
          setGridError(`입력은 저장했습니다. 검증 경고: ${inputWarning}`)
        } else if (activeColumnFilters.length > 0 || activeSorting.length > 0 || deferredSearch.trim()) {
          setGridError('새 행이 현재 정렬·필터 결과에서 다른 위치로 이동하거나 숨겨질 수 있습니다.')
        }
      } else {
        const inputWarning = cellInputError(cell.schemaColumn.columnId, nextValue)
        updateCells(schemaTable.tableId, [{ rowId: cell.row.original.rowId, columnId: cell.column.id, value: nextValue }])
        setGridError(inputWarning ? `입력은 저장했습니다. 검증 경고: ${inputWarning}` : null)
      }
    }
    if (rowDelta !== 0 || columnDelta !== 0) moveSelection(rowDelta, columnDelta)
    else focusKeyboardCapture()
  }, [activeColumnFilters.length, activeSorting.length, addColumnToTable, cellAt, cellInputError, clearEditSession, deferredSearch, focusKeyboardCapture, insertRowWithCells, moveSelection, renameColumn, schemaTable, updateCells, viewRowAt])

  const selectGridColumn = useCallback((columnIndex: number) => {
    if (!commitActiveEditRef.current(false)) return
    setSelectedHeaderId(visibleColumns[columnIndex]?.id ?? null)
    setSelectionKind('column')
    setSelection({ anchor: { rowIndex: lastDisplayRowIndex, columnIndex }, focus: { rowIndex: 0, columnIndex } })
    focusKeyboardCapture()
  }, [focusKeyboardCapture, lastDisplayRowIndex, visibleColumns])

  const selectGridRow = useCallback((rowIndex: number) => {
    if (displayColumns.length === 0) return
    if (!commitActiveEditRef.current(false)) return
    setSelectionKind('row')
    setSelection({ anchor: { rowIndex, columnIndex: lastDisplayColumnIndex }, focus: { rowIndex, columnIndex: 0 } })
    focusKeyboardCapture()
  }, [displayColumns.length, focusKeyboardCapture, lastDisplayColumnIndex])

  const selectAllCells = useCallback(() => {
    if (displayColumns.length === 0) return
    if (!commitActiveEditRef.current(false)) return
    setSelectionKind('all')
    setSelection({ anchor: { rowIndex: lastDisplayRowIndex, columnIndex: lastDisplayColumnIndex }, focus: { rowIndex: 0, columnIndex: 0 } })
    focusKeyboardCapture()
  }, [displayColumns.length, focusKeyboardCapture, lastDisplayColumnIndex, lastDisplayRowIndex])

  const selectUsedRange = useCallback(() => {
    if (visibleColumns.length === 0) return
    if (!commitActiveEditRef.current(false)) return
    setSelectionKind('cell')
    setSelection({
      anchor: { rowIndex: Math.max(0, viewRowCount), columnIndex: visibleColumns.length - 1 },
      focus: { rowIndex: 0, columnIndex: 0 },
    })
    focusKeyboardCapture()
  }, [focusKeyboardCapture, viewRowCount, visibleColumns.length])

  // 정렬·필터·검색이 걸린 화면은 원본 순서와 달라 재정렬 결과가 모호해진다.
  const rowReorderEnabled = activeSorting.length === 0 && activeColumnFilters.length === 0 && deferredSearch.trim().length === 0

  const rowInsertionIndexAt = useCallback((canvasY: number) => pointerToRowInsertionIndex(canvasY, {
    headerHeight: HEADER_HEIGHT,
    rowHeight: ROW_HEIGHT,
    rowCount: viewRowCount,
  }), [viewRowCount])

  const commitCellMove = useCallback((source: CellRange, drop: GridCellPosition) => {
    const target = computeMoveTarget(source, drop, { rowCount: viewRowCount, columnCount: visibleColumns.length })
    if (target.startRow === source.startRow && target.startColumn === source.startColumn) return

    const sourceCells: MoveCell[] = []
    const targetCells: MoveCell[] = []
    for (let rowOffset = 0; rowOffset <= source.endRow - source.startRow; rowOffset += 1) {
      for (let columnOffset = 0; columnOffset <= source.endColumn - source.startColumn; columnOffset += 1) {
        const fromColumn = visibleColumns[source.startColumn + columnOffset]
        const toColumn = visibleColumns[target.startColumn + columnOffset]
        if (!fromColumn || !toColumn) continue
        const fromRow = viewRowAt(source.startRow - 1 + rowOffset).original
        const toRow = viewRowAt(target.startRow - 1 + rowOffset).original
        const value = cellText(fromRow.cells[fromColumn.id])
        sourceCells.push({ rowId: fromRow.rowId, columnId: fromColumn.id, value })
        targetCells.push({ rowId: toRow.rowId, columnId: toColumn.id, value })
      }
    }
    // 붙여넣기와 같은 정책: 채워 넣을 값의 타입만 막는다.
    // 비워지는 원본이 필수 열이어도 이동은 허용하고 validator가 "필수 값 비어 있음"으로
    // 표시한다 — Delete/Backspace 계약과 같은 규칙이라야 조작이 일관된다.
    const inputError = targetCells.map((cell) => cellInputError(cell.columnId, cell.value)).find(Boolean)
    if (inputError) {
      setGridError(inputError)
      return
    }
    const updates = moveUpdates(sourceCells, targetCells)
    updateCells(schemaTable.tableId, updates)
    setSelectionKind('cell')
    setSelection({
      anchor: { rowIndex: target.startRow, columnIndex: target.startColumn },
      focus: { rowIndex: target.endRow, columnIndex: target.endColumn },
    })
    setGridError(null)
  }, [cellInputError, schemaTable.tableId, updateCells, viewRowAt, viewRowCount, visibleColumns])

  const commitRowMove = useCallback((rowIds: readonly EntityId[], sourceIndex: number, targetIndex: number) => {
    // 제자리 드롭(자기 앞/뒤 경계)은 되돌릴 것이 없으니 이력에 남기지 않는다.
    if (targetIndex === sourceIndex || targetIndex === sourceIndex + rowIds.length) return
    moveRows(schemaTable.tableId, rowIds, targetIndex)
  }, [moveRows, schemaTable.tableId])

  const pointerTargetAt = useCallback((clientX: number, clientY: number, canvas: HTMLDivElement) => {
    const bounds = canvas.getBoundingClientRect()
    const x = Math.max(0, Math.min(bounds.width - 1, clientX - bounds.left))
    const y = Math.max(0, Math.min(bounds.height - 1, clientY - bounds.top))
    return workbookPointerTarget({ x, y }, {
      rowHeaderWidth: ROW_HEADER_WIDTH,
      columnLetterHeight: COLUMN_LETTER_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      rowHeight: ROW_HEIGHT,
      displayRowCount,
      columns: displayColumnMetrics,
    })
  }, [displayColumnMetrics, displayRowCount])

  const beginPointerSelection = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('input, select, textarea, [role="menu"], .column-menu-trigger, .column-drag-handle, .column-resizer, .autofill-handle')) return
    const hit = pointerTargetAt(event.clientX, event.clientY, event.currentTarget)
    if (!hit) return

    if (!commitActiveEditRef.current(false)) return
    setGridError(null)

    // 이미 선택된 데이터 범위를 다시 잡으면 새 선택이 아니라 옮기기다.
    if (!event.shiftKey && range && selectionKind === 'cell' && hit.region === 'cell'
      && range.startRow >= 1 && range.endRow <= viewRowCount && range.endColumn < visibleColumns.length
      && hit.position.rowIndex >= range.startRow && hit.position.rowIndex <= range.endRow
      && hit.position.columnIndex >= range.startColumn && hit.position.columnIndex <= range.endColumn) {
      gestureRef.current = { kind: 'move-cells', pointerId: event.pointerId, source: range, moved: false }
      focusKeyboardCapture()
      return
    }

    // 이미 선택된 행 머리글을 다시 잡으면 행 순서를 바꾸는 제스처가 된다.
    if (!event.shiftKey && range && selectionKind === 'row' && hit.region === 'row-header'
      && rowReorderEnabled
      && hit.position.rowIndex >= range.startRow && hit.position.rowIndex <= range.endRow
      && range.startRow >= 1 && range.endRow <= viewRowCount) {
      const draggedRowIds: EntityId[] = []
      for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
        draggedRowIds.push(viewRowAt(rowIndex - 1).original.rowId)
      }
      if (draggedRowIds.length > 0) {
        gestureRef.current = {
          kind: 'move-rows',
          pointerId: event.pointerId,
          rowIds: draggedRowIds,
          sourceIndex: range.startRow - 1,
          moved: false,
        }
        focusKeyboardCapture()
        return
      }
    }

    const extend = event.shiftKey && selection !== null
    const dragAnchor = extend ? selection.anchor : hit.position
    setSelectedHeaderId(hit.region === 'column-header' && hit.position.columnIndex < visibleColumns.length
      ? visibleColumns[hit.position.columnIndex]!.id
      : null)

    if (hit.region === 'corner') {
      setSelectionKind('all')
      setSelection({
        anchor: { rowIndex: lastDisplayRowIndex, columnIndex: lastDisplayColumnIndex },
        focus: { rowIndex: 0, columnIndex: 0 },
      })
    } else if (hit.region === 'row-header') {
      setSelectionKind('row')
      setSelection({
        anchor: { rowIndex: dragAnchor.rowIndex, columnIndex: lastDisplayColumnIndex },
        focus: { rowIndex: hit.position.rowIndex, columnIndex: 0 },
      })
    } else if (hit.region === 'column-header') {
      setSelectionKind('column')
      setSelection({
        anchor: { rowIndex: lastDisplayRowIndex, columnIndex: dragAnchor.columnIndex },
        focus: { rowIndex: 0, columnIndex: hit.position.columnIndex },
      })
    } else {
      setSelectionKind('cell')
      setSelection({ anchor: dragAnchor, focus: hit.position })
    }

    pointerSelectionRef.current = {
      pointerId: event.pointerId,
      region: hit.region,
      anchor: dragAnchor,
      moved: false,
    }
    focusKeyboardCapture()
  }, [focusKeyboardCapture, lastDisplayColumnIndex, lastDisplayRowIndex, pointerTargetAt, range, rowReorderEnabled, selection, selectionKind, viewRowAt, viewRowCount, visibleColumns])

  const updatePointerSelection = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (gesture && gesture.pointerId === event.pointerId) {
      const hit = pointerTargetAt(event.clientX, event.clientY, event.currentTarget)
      if (!hit) return
      if (!gesture.moved) {
        gesture.moved = true
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      if (gesture.kind === 'move-cells') {
        setMovePreview(computeMoveTarget(gesture.source, hit.position, {
          rowCount: viewRowCount,
          columnCount: visibleColumns.length,
        }))
      } else {
        const bounds = event.currentTarget.getBoundingClientRect()
        setRowDropIndex(rowInsertionIndexAt(event.clientY - bounds.top))
      }
      return
    }

    const drag = pointerSelectionRef.current
    if (!drag || drag.pointerId !== event.pointerId || drag.region === 'corner') return
    const hit = pointerTargetAt(event.clientX, event.clientY, event.currentTarget)
    if (!hit) return
    const moved = hit.position.rowIndex !== drag.anchor.rowIndex || hit.position.columnIndex !== drag.anchor.columnIndex
    if (!drag.moved && moved) {
      drag.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    if (drag.region === 'row-header') {
      setSelection({
        anchor: { rowIndex: drag.anchor.rowIndex, columnIndex: lastDisplayColumnIndex },
        focus: { rowIndex: hit.position.rowIndex, columnIndex: 0 },
      })
    } else if (drag.region === 'column-header') {
      setSelection({
        anchor: { rowIndex: lastDisplayRowIndex, columnIndex: drag.anchor.columnIndex },
        focus: { rowIndex: 0, columnIndex: hit.position.columnIndex },
      })
    } else {
      setSelection({ anchor: drag.anchor, focus: hit.position })
    }
  }, [lastDisplayColumnIndex, lastDisplayRowIndex, pointerTargetAt, rowInsertionIndexAt, viewRowCount, visibleColumns.length])

  const finishPointerSelection = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (gesture && gesture.pointerId === event.pointerId) {
      gestureRef.current = null
      setMovePreview(null)
      setRowDropIndex(null)
      suppressClickRef.current = gesture.moved
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      window.setTimeout(() => { suppressClickRef.current = false }, 0)
      if (!gesture.moved || event.type === 'pointercancel') return

      if (gesture.kind === 'move-cells') {
        const hit = pointerTargetAt(event.clientX, event.clientY, event.currentTarget)
        if (hit) commitCellMove(gesture.source, hit.position)
      } else {
        const bounds = event.currentTarget.getBoundingClientRect()
        commitRowMove(gesture.rowIds, gesture.sourceIndex, rowInsertionIndexAt(event.clientY - bounds.top))
      }
      return
    }

    const drag = pointerSelectionRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    suppressClickRef.current = drag.moved
    pointerSelectionRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    window.setTimeout(() => { suppressClickRef.current = false }, 0)
  }, [commitCellMove, commitRowMove, pointerTargetAt, rowInsertionIndexAt])

  const suppressCollapsedClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClickRef.current = false
  }, [])

  const clipboardMatrixForRange = useCallback((targetRange: ReturnType<typeof selectionRange>) => {
    const matrix: string[][] = []
    for (let index = targetRange.startRow; index <= targetRange.endRow; index += 1) {
      if (index === 0) {
        matrix.push(visibleColumns.slice(targetRange.startColumn, targetRange.endColumn + 1).map((column) => (
          schemaTable.columns.find((candidate) => candidate.columnId === column.id)?.name ?? ''
        )))
      } else if (index <= viewRowCount) {
        const row = viewRowAt(index - 1).original
        matrix.push(visibleColumns.slice(targetRange.startColumn, targetRange.endColumn + 1).map((column) => cellText(row.cells[column.id])))
      } else {
        matrix.push(visibleColumns.slice(targetRange.startColumn, targetRange.endColumn + 1).map(() => ''))
      }
    }
    return matrix
  }, [schemaTable.columns, viewRowAt, viewRowCount, visibleColumns])

  const copySelection = (event: ClipboardEvent<HTMLDivElement>) => {
    if (editingRef.current || !range) return
    const text = clipboardMatrixForRange(range).map((line) => line.join('\t')).join('\n')
    event.preventDefault()
    event.clipboardData.setData('text/plain', text)
  }

  const cutSelectedCells = (event: ClipboardEvent<HTMLDivElement>) => {
    if (editingRef.current || !range) return
    event.preventDefault()
    if (range.startRow === 0) {
      setGridError('열 이름은 잘라낼 수 없습니다. 이름 변경을 사용하세요.')
      return
    }
    if (range.endRow > viewRowCount || range.endColumn >= visibleColumns.length) {
      setGridError('입력 대기 중인 빈 행과 열은 잘라낼 수 없습니다.')
      return
    }
    const matrix = clipboardMatrixForRange(range)
    const sourceCells: { rowId: EntityId; columnId: EntityId }[] = []
    for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
      const row = viewRowAt(rowIndex - 1).original
      for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
        const column = visibleColumns[columnIndex]
        if (column) sourceCells.push({ rowId: row.rowId, columnId: column.id })
      }
    }
    event.clipboardData.setData('text/plain', matrix.map((line) => line.join('\t')).join('\n'))
    setCutSelection({ tableId: schemaTable.tableId, range, matrix, sourceCells })
    setGridError(null)
  }

  const pasteSelection = (event: ClipboardEvent<HTMLDivElement>) => {
    if (editingRef.current || !selection) return
    const matrix = parseClipboardMatrix(event.clipboardData.getData('text/plain'))
    if (matrix.length === 0) return
    event.preventDefault()
    if (selection.focus.columnIndex >= visibleColumns.length) {
      setGridError('먼저 1행에 열 이름을 입력하세요.')
      return
    }
    if (cutSelection?.tableId === schemaTable.tableId) {
      if (selection.focus.rowIndex === 0) {
        setGridError('잘라낸 데이터는 2행 아래의 데이터 셀에만 붙여넣을 수 있습니다.')
        return
      }
      const lastRow = selection.focus.rowIndex + cutSelection.matrix.length - 1
      const lastColumn = selection.focus.columnIndex + (cutSelection.matrix[0]?.length ?? 1) - 1
      if (lastRow > viewRowCount || lastColumn >= visibleColumns.length) {
        setGridError('잘라낸 범위는 기존 데이터 영역 안에만 붙여넣을 수 있습니다.')
        return
      }
      const updatesByCell = new Map<string, { rowId: EntityId; columnId: EntityId; value: string }>()
      for (const source of cutSelection.sourceCells) updatesByCell.set(`${source.rowId}:${source.columnId}`, { ...source, value: '' })
      cutSelection.matrix.forEach((line, rowOffset) => {
        const row = viewRowAt(selection.focus.rowIndex - 1 + rowOffset).original
        line.forEach((value, columnOffset) => {
          const column = visibleColumns[selection.focus.columnIndex + columnOffset]!
          updatesByCell.set(`${row.rowId}:${column.id}`, { rowId: row.rowId, columnId: column.id, value })
        })
      })
      const updates = [...updatesByCell.values()]
      const inputWarning = updates.map((update) => cellInputError(update.columnId, update.value)).find(Boolean)
      updateCells(schemaTable.tableId, updates)
      setSelection({ anchor: selection.focus, focus: { rowIndex: lastRow, columnIndex: lastColumn } })
      setSelectionKind('cell')
      setCutSelection(null)
      setGridError(inputWarning ? `붙여넣기는 적용했습니다. 검증 경고: ${inputWarning}` : null)
      return
    }
    const sourceDataRowCount = Math.max(0, matrix.length - (selection.focus.rowIndex === 0 ? 1 : 0))
    const firstDataMatrixRow = selection.focus.rowIndex === 0 ? 1 : 0
    let inputWarning: string | null = null
    for (let rowOffset = firstDataMatrixRow; rowOffset < matrix.length; rowOffset += 1) {
      const line = matrix[rowOffset] ?? []
      for (let columnOffset = 0; columnOffset < line.length; columnOffset += 1) {
        const column = visibleColumns[selection.focus.columnIndex + columnOffset]
        if (!column) continue
        inputWarning ??= cellInputError(column.id, line[columnOffset] ?? '')
      }
    }
    const targetRowIds: EntityId[] = []
    if (selection.focus.rowIndex > 0) {
      const startViewIndex = selection.focus.rowIndex - 1
      for (let offset = 0; offset < sourceDataRowCount && startViewIndex + offset < viewRowCount; offset += 1) {
        targetRowIds.push(viewRowAt(startViewIndex + offset).original.rowId)
      }
    }
    try {
      applyWorkbookRange(
        schemaTable.tableId,
        selection.focus.rowIndex,
        selection.focus.columnIndex,
        matrix,
        targetRowIds,
      )
      setGridError(inputWarning ? `붙여넣기는 적용했습니다. 검증 경고: ${inputWarning}` : null)
      setSelection({
        anchor: selection.focus,
        focus: {
          rowIndex: selection.focus.rowIndex + matrix.length - 1,
          columnIndex: Math.min(visibleColumns.length - 1, selection.focus.columnIndex + Math.max(0, matrix[0]?.length ?? 1) - 1),
        },
      })
      setSelectionKind('cell')
    } catch (error) {
      setGridError(error instanceof Error ? error.message : '붙여넣기에 실패했습니다.')
    }
  }

  const openPasteSpecial = () => {
    const initial: PasteSpecialState = { text: '', transpose: false, skipBlanks: false }
    setPasteSpecial(initial)
    if (!navigator.clipboard?.readText) return
    void navigator.clipboard.readText()
      .then((text) => {
        if (text) setPasteSpecial((current) => current ? { ...current, text } : current)
      })
      .catch(() => {
        // Clipboard permission is optional. The dialog's textarea remains a
        // native paste target when direct reading is unavailable.
      })
  }

  const applyPasteSpecial = () => {
    if (!pasteSpecial || !selection || selection.focus.rowIndex === 0) {
      setGridError('선택하여 붙여넣기는 2행 아래의 데이터 셀에서 사용하세요.')
      setPasteSpecial(null)
      return
    }
    let matrix = parseClipboardMatrix(pasteSpecial.text)
    if (pasteSpecial.transpose) matrix = transposeClipboardMatrix(matrix)
    if (pasteSpecial.skipBlanks) {
      matrix = matrix.map((line, rowOffset) => line.map((value, columnOffset) => {
        if (value !== '') return value
        const targetRowIndex = selection.focus.rowIndex + rowOffset
        const targetColumn = visibleColumns[selection.focus.columnIndex + columnOffset]
        if (!targetColumn || targetRowIndex < 1 || targetRowIndex > viewRowCount) return ''
        return cellText(viewRowAt(targetRowIndex - 1).original.cells[targetColumn.id])
      }))
    }
    const text = matrix.map((line) => line.join('\t')).join('\n')
    pasteSelection({
      clipboardData: { getData: () => text },
      preventDefault: () => undefined,
    } as unknown as ClipboardEvent<HTMLDivElement>)
    setPasteSpecial(null)
  }

  type FillUpdate = { rowId: EntityId; columnId: EntityId; value: string }
  type FillMode = FillPreview['mode']

  const generatedFillValues = (source: readonly string[], count: number, direction: FillDirection, mode: FillMode) => (
    mode === 'copy'
      ? copyFillValuesDirectional(source, count, direction)
      : fillValuesDirectional(source, count, direction)
  )

  // 세로 채우기: 소스 열마다 수열을 만들어 위/아래로 뻗는다.
  const fillVertical = (source: CellRange, count: number, direction: 'up' | 'down', out: FillUpdate[], mode: FillMode = 'series') => {
    for (let columnIndex = source.startColumn; columnIndex <= source.endColumn; columnIndex += 1) {
      const column = visibleColumns[columnIndex]
      if (!column) continue
      const sourceValues: string[] = []
      for (let rowIndex = source.startRow; rowIndex <= source.endRow; rowIndex += 1) {
        sourceValues.push(cellText(viewRowAt(rowIndex - 1).original.cells[column.id]))
      }
      generatedFillValues(sourceValues, count, direction, mode).forEach((value, offset) => {
        const rowIndex = direction === 'down' ? source.endRow + offset + 1 : source.startRow - offset - 1
        if (rowIndex < 1 || rowIndex > viewRowCount) return
        out.push({ rowId: viewRowAt(rowIndex - 1).original.rowId, columnId: column.id, value })
      })
    }
  }

  // 가로 채우기: 소스 행마다 수열을 만들어 좌/우로 뻗는다.
  const fillHorizontal = (source: CellRange, count: number, direction: 'left' | 'right', out: FillUpdate[], mode: FillMode = 'series') => {
    for (let rowIndex = source.startRow; rowIndex <= source.endRow; rowIndex += 1) {
      const row = viewRowAt(rowIndex - 1).original
      const sourceValues: string[] = []
      for (let columnIndex = source.startColumn; columnIndex <= source.endColumn; columnIndex += 1) {
        const column = visibleColumns[columnIndex]
        if (column) sourceValues.push(cellText(row.cells[column.id]))
      }
      generatedFillValues(sourceValues, count, direction, mode).forEach((value, offset) => {
        const columnIndex = direction === 'right' ? source.endColumn + offset + 1 : source.startColumn - offset - 1
        const column = visibleColumns[columnIndex]
        if (column) out.push({ rowId: row.rowId, columnId: column.id, value })
      })
    }
  }

  const commitFill = (updates: readonly FillUpdate[]) => {
    if (updates.length === 0) return
    const inputWarning = updates.map((update) => cellInputError(update.columnId, update.value)).find(Boolean)
    updateCells(schemaTable.tableId, updates)
    setGridError(inputWarning ? `채우기는 적용했습니다. 검증 경고: ${inputWarning}` : null)
  }

  const commitVerticalFillDown = (source: CellRange, count: number, mode: FillMode = 'series') => {
    if (count <= 0) return
    const width = source.endColumn - source.startColumn + 1
    const matrix = Array.from({ length: count }, () => Array.from({ length: width }, () => ''))

    for (let columnOffset = 0; columnOffset < width; columnOffset += 1) {
      const columnIndex = source.startColumn + columnOffset
      const column = visibleColumns[columnIndex]
      if (!column) continue
      const sourceValues = Array.from({ length: source.endRow - source.startRow + 1 }, (_, offset) => {
        const row = viewRowAt(source.startRow - 1 + offset).original
        return cellText(row.cells[column.id])
      })
      const generated = generatedFillValues(sourceValues, count, 'down', mode)
      generated.forEach((value, rowOffset) => { matrix[rowOffset]![columnOffset] = value })
    }

    let inputWarning: string | null = null
    for (const line of matrix) {
      for (let columnOffset = 0; columnOffset < line.length; columnOffset += 1) {
        const column = visibleColumns[source.startColumn + columnOffset]
        inputWarning ??= column ? cellInputError(column.id, line[columnOffset] ?? '') : null
      }
    }

    const targetRowIds: EntityId[] = []
    for (let offset = 0; offset < count && source.endRow + offset + 1 <= viewRowCount; offset += 1) {
      targetRowIds.push(viewRowAt(source.endRow + offset).original.rowId)
    }
    applyWorkbookRange(schemaTable.tableId, source.endRow + 1, source.startColumn, matrix, targetRowIds)
    setGridError(inputWarning ? `채우기는 적용했습니다. 검증 경고: ${inputWarning}` : null)
  }

  const fillPreviewForTarget = (
    source: CellRange,
    target: { readonly row: number; readonly column: number },
    mode: FillMode,
  ): FillPreview => {
    const rowsDelta = target.row - source.endRow
    const columnsDelta = target.column - source.endColumn
    const vertical = Math.abs(rowsDelta) >= Math.abs(columnsDelta)
    const range: CellRange = vertical
      ? { ...source, startRow: Math.min(source.startRow, target.row), endRow: Math.max(source.endRow, target.row) }
      : { ...source, startColumn: Math.min(source.startColumn, target.column), endColumn: Math.max(source.endColumn, target.column) }
    let value = ''
    if (vertical && rowsDelta !== 0) {
      const column = visibleColumns[rowsDelta > 0 ? source.endColumn : source.startColumn]
      if (column) {
        const values = Array.from({ length: source.endRow - source.startRow + 1 }, (_, offset) => {
          const row = viewRowAt(source.startRow - 1 + offset).original
          return cellText(row.cells[column.id])
        })
        const direction: FillDirection = rowsDelta > 0 ? 'down' : 'up'
        value = generatedFillValues(values, Math.abs(rowsDelta), direction, mode).at(-1) ?? ''
      }
    } else if (!vertical && columnsDelta !== 0) {
      const row = viewRowAt((columnsDelta > 0 ? source.endRow : source.startRow) - 1).original
      const values = visibleColumns
        .slice(source.startColumn, source.endColumn + 1)
        .map((column) => cellText(row.cells[column.id]))
      const direction: FillDirection = columnsDelta > 0 ? 'right' : 'left'
      value = generatedFillValues(values, Math.abs(columnsDelta), direction, mode).at(-1) ?? ''
    }
    return { range, value, mode }
  }

  const startAutoFill = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!range || range.startRow < 1) return
    const source = range
    const canvas = event.currentTarget.closest<HTMLElement>('.spreadsheet-canvas')
    let target = { row: source.endRow, column: source.endColumn }
    let fillMode: FillMode = event.ctrlKey || event.metaKey ? 'copy' : fillModePreference
    const move = (pointerEvent: PointerEvent) => {
      if (!canvas) return
      const viewport = scrollRef.current
      if (viewport) {
        const viewportBounds = viewport.getBoundingClientRect()
        if (pointerEvent.clientY > viewportBounds.bottom - 30) viewport.scrollTop += ROW_HEIGHT
        else if (pointerEvent.clientY < viewportBounds.top + HEADER_HEIGHT + 20) viewport.scrollTop -= ROW_HEIGHT
        if (pointerEvent.clientX > viewportBounds.right - 30) viewport.scrollLeft += GHOST_COLUMN_WIDTH
        else if (pointerEvent.clientX < viewportBounds.left + ROW_HEADER_WIDTH + 20) viewport.scrollLeft -= GHOST_COLUMN_WIDTH
      }
      const bounds = canvas.getBoundingClientRect()
      const hit = workbookPointerTarget(
        {
          x: Math.max(0, Math.min(bounds.width - 1, pointerEvent.clientX - bounds.left)),
          y: Math.max(0, Math.min(bounds.height - 1, pointerEvent.clientY - bounds.top)),
        },
        {
          rowHeaderWidth: ROW_HEADER_WIDTH,
          columnLetterHeight: COLUMN_LETTER_HEIGHT,
          headerHeight: HEADER_HEIGHT,
          rowHeight: ROW_HEIGHT,
          displayRowCount,
          columns: displayColumnMetrics,
        },
      )
      if (!hit) return
      target = {
        row: Math.max(1, Math.min(lastDisplayRowIndex, hit.position.rowIndex)),
        column: Math.max(0, Math.min(visibleColumns.length - 1, hit.position.columnIndex)),
      }
      fillMode = pointerEvent.ctrlKey || pointerEvent.metaKey ? 'copy' : fillModePreference
      setFillPreview(fillPreviewForTarget(source, target, fillMode))
    }
    const stop = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', stop)
      setFillPreview(null)
      const rowsDelta = target.row - source.endRow
      const columnsDelta = target.column - source.endColumn
      // 주 이동축을 골라 한 방향으로만 채운다 — 엑셀과 같은 동작.
      const vertical = Math.abs(rowsDelta) >= Math.abs(columnsDelta)
      const updates: FillUpdate[] = []
      if (vertical && rowsDelta > 0) {
        commitVerticalFillDown(source, rowsDelta, fillMode)
      }
      else if (vertical && rowsDelta < 0) fillVertical(source, -rowsDelta, 'up', updates, fillMode)
      else if (!vertical && columnsDelta > 0) fillHorizontal(source, columnsDelta, 'right', updates, fillMode)
      else if (!vertical && columnsDelta < 0) fillHorizontal(source, -columnsDelta, 'left', updates, fillMode)
      else return
      if (!(vertical && rowsDelta > 0)) commitFill(updates)
      setSelection({
        anchor: { rowIndex: source.startRow, columnIndex: source.startColumn },
        focus: vertical
          ? { rowIndex: target.row, columnIndex: source.endColumn }
          : { rowIndex: source.endRow, columnIndex: target.column },
      })
      setSelectionKind('cell')
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', stop, { once: true })
  }

  // 핸들 더블클릭: 인접 열의 데이터가 이어지는 만큼 아래로 채운다.
  // 셀의 onDoubleClick(편집 시작)까지 번지면 채운 직후 편집기가 열리므로 전파를 끊는다.
  const autoFillToNeighbor = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (!range) return
    const neighborColumn = visibleColumns[range.startColumn - 1] ?? visibleColumns[range.endColumn + 1]
    if (!neighborColumn) return
    const neighborValues: string[] = []
    for (let rowIndex = range.endRow; rowIndex < viewRowCount; rowIndex += 1) {
      neighborValues.push(cellText(viewRowAt(rowIndex).original.cells[neighborColumn.id]))
    }
    const count = autofillExtent(neighborValues)
    if (count <= 0) return
    const updates: FillUpdate[] = []
    fillVertical(range, count, 'down', updates)
    commitFill(updates)
    setSelection({
      anchor: { rowIndex: range.startRow, columnIndex: range.startColumn },
      focus: { rowIndex: range.endRow + count, columnIndex: range.endColumn },
    })
    setSelectionKind('cell')
  }

  const fillSelectedRange = (direction: 'down' | 'right') => {
    if (!range || range.startRow < 1 || range.endRow > viewRowCount || range.endColumn >= visibleColumns.length) {
      setGridError('채우기는 기존 데이터 셀 범위에서만 사용할 수 있습니다.')
      return
    }
    const updates: FillUpdate[] = []
    if (direction === 'down') {
      for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
        const column = visibleColumns[columnIndex]
        if (!column) continue
        const sourceValue = cellText(viewRowAt(range.startRow - 1).original.cells[column.id])
        for (let rowIndex = range.startRow + 1; rowIndex <= range.endRow; rowIndex += 1) {
          updates.push({ rowId: viewRowAt(rowIndex - 1).original.rowId, columnId: column.id, value: sourceValue })
        }
      }
    } else {
      const sourceColumn = visibleColumns[range.startColumn]
      if (!sourceColumn) return
      for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
        const row = viewRowAt(rowIndex - 1).original
        const sourceValue = cellText(row.cells[sourceColumn.id])
        for (let columnIndex = range.startColumn + 1; columnIndex <= range.endColumn; columnIndex += 1) {
          const column = visibleColumns[columnIndex]
          if (column) updates.push({ rowId: row.rowId, columnId: column.id, value: sourceValue })
        }
      }
    }
    commitFill(updates)
  }

  const handleGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (editingRef.current || visibleColumns.length === 0) return
    const modifier = event.ctrlKey || event.metaKey
    const key = event.key
    const lowerKey = key.toLowerCase()
    const focus = selection?.focus ?? { rowIndex: 0, columnIndex: 0 }
    const lastUsedRow = Math.max(0, viewRowCount)
    const lastUsedColumn = Math.max(0, visibleColumns.length - 1)

    if (modifier && event.altKey && lowerKey === 'v') {
      event.preventDefault()
      openPasteSpecial()
      return
    }

    if (modifier && !event.altKey) {
      if (lowerKey === 'a') {
        event.preventDefault()
        if (selectionKind === 'all' || (range?.startRow === 0 && range.endRow === lastUsedRow && range.startColumn === 0 && range.endColumn === lastUsedColumn)) {
          selectAllCells()
        } else {
          selectUsedRange()
        }
        return
      }
      if (lowerKey === 'g') {
        event.preventDefault()
        setGoToAddress('')
        setGoToOpen(true)
        return
      }
      if (key === ' ') {
        event.preventDefault()
        selectGridColumn(Math.min(lastUsedColumn, focus.columnIndex))
        return
      }
      if (key === 'PageUp' || key === 'PageDown') {
        event.preventDefault()
        const currentIndex = project.tables.findIndex((table) => table.tableId === schemaTable.tableId)
        const nextIndex = Math.max(0, Math.min(project.tables.length - 1, currentIndex + (key === 'PageUp' ? -1 : 1)))
        const nextTable = project.tables[nextIndex]
        if (nextTable && nextTable.tableId !== schemaTable.tableId) selectTable(nextTable.tableId)
        return
      }
      if (lowerKey === 'd' || lowerKey === 'r') {
        event.preventDefault()
        fillSelectedRange(lowerKey === 'd' ? 'down' : 'right')
        return
      }
      if (key === 'Home') {
        event.preventDefault()
        jumpSelection(0, 0, event.shiftKey)
        return
      }
      if (key === 'End') {
        event.preventDefault()
        jumpSelection(lastUsedRow, lastUsedColumn, event.shiftKey)
        return
      }
      const edgeTarget: Partial<Record<string, GridCellPosition>> = {
        ArrowUp: { rowIndex: 0, columnIndex: focus.columnIndex },
        ArrowDown: { rowIndex: lastUsedRow, columnIndex: focus.columnIndex },
        ArrowLeft: { rowIndex: focus.rowIndex, columnIndex: 0 },
        ArrowRight: { rowIndex: focus.rowIndex, columnIndex: lastUsedColumn },
      }
      const target = edgeTarget[key]
      if (target) {
        event.preventDefault()
        jumpSelection(target.rowIndex, target.columnIndex, event.shiftKey)
        return
      }
      // Ctrl+C/X/V, Ctrl+F/H, Ctrl+S, Ctrl+Z/Y는 브라우저 clipboard,
      // 찾기 UI, 또는 전역 워크벤치 단축키가 처리한다.
      return
    }
    if (event.altKey) return
    if (event.shiftKey && key === ' ') {
      event.preventDefault()
      selectGridRow(focus.rowIndex)
      return
    }
    if (key === 'Home' || key === 'End') {
      event.preventDefault()
      jumpSelection(focus.rowIndex, key === 'Home' ? 0 : lastUsedColumn, event.shiftKey)
      return
    }
    if (key === 'PageUp' || key === 'PageDown') {
      event.preventDefault()
      const visiblePageRows = Math.max(1, Math.floor(Math.max(ROW_HEIGHT, viewportSize.height - HEADER_HEIGHT) / ROW_HEIGHT))
      jumpSelection(focus.rowIndex + (key === 'PageUp' ? -visiblePageRows : visiblePageRows), focus.columnIndex, event.shiftKey)
      return
    }
    const extend = event.shiftKey
    const keyMoves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
      Enter: [event.shiftKey ? -1 : 1, 0],
      Tab: [0, event.shiftKey ? -1 : 1],
    }
    const delta = keyMoves[event.key]
    if (delta) {
      event.preventDefault()
      moveSelection(delta[0], delta[1], extend && event.key.startsWith('Arrow'))
      return
    }
    if (event.key === 'F2' && selection) {
      event.preventDefault()
      beginEdit(selection.focus, 'preserve')
      return
    }
    if (key === 'Escape') {
      event.preventDefault()
      setCutSelection(null)
      setGridError(null)
      return
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && range) {
      event.preventDefault()
      if (range.startRow === 0) {
        setGridError('1행은 열 이름입니다. 이름 변경은 F2 또는 더블클릭을 사용하고, 열 삭제는 열 메뉴에서 실행하세요.')
        return
      }
      const updates: { rowId: EntityId; columnId: EntityId; value: undefined }[] = []
      for (let index = Math.max(1, range.startRow); index <= Math.min(range.endRow, viewRowCount); index += 1) {
        const row = viewRowAt(index - 1).original
        updates.push(...visibleColumns.slice(range.startColumn, range.endColumn + 1).map((column) => ({ rowId: row.rowId, columnId: column.id, value: undefined })))
      }
      if (updates.length > 0) {
        updateCells(schemaTable.tableId, updates)
        setCutSelection(null)
        setGridError(null)
      }
    }
  }

  const beginColumnResize = (columnId: string, startSize: number, event: ReactMouseEvent<HTMLSpanElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    setResizingColumnId(columnId)
    document.body.classList.add('spreadsheet-column-resizing')
    const move = (moveEvent: MouseEvent) => setColumnSizing((current) => {
      const next = {
        ...current,
        [columnId]: Math.max(92, Math.min(480, startSize + moveEvent.clientX - startX)),
      }
      columnSizingRef.current = next
      return next
    })
    const stop = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', stop)
      window.removeEventListener('blur', stop)
      document.body.classList.remove('spreadsheet-column-resizing')
      setResizingColumnId(null)
      updateTableWorkbookView(schemaTable.tableId, { columnWidths: columnSizingRef.current })
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
    window.addEventListener('blur', stop)
  }

  const autoFitColumn = useCallback((columnId: EntityId) => {
    const schemaColumn = schemaTable.columns.find((column) => column.columnId === columnId)
    if (!schemaColumn) return
    const values = [
      schemaColumn.name,
      ...rows.slice(0, 1_000).map((row) => cellText(row.cells[columnId])),
    ]
    const context = document.createElement('canvas').getContext('2d')
    if (context) context.font = '11.5px "Segoe UI", "Malgun Gothic", sans-serif'
    const contentWidth = values.reduce((maximum, value) => {
      const measured = context?.measureText(value).width ?? value.length * 7
      return Math.max(maximum, measured)
    }, 0)
    const badgeWidth = schemaTable.primaryKey.columnIds.includes(columnId) || foreignKeyColumnIds.has(columnId) ? 48 : 0
    const fittedWidth = Math.max(92, Math.min(480, Math.ceil(contentWidth + badgeWidth + 58)))
    changeColumnSizing((current) => ({ ...current, [columnId]: fittedWidth }))
  }, [changeColumnSizing, foreignKeyColumnIds, rows, schemaTable.columns, schemaTable.primaryKey.columnIds])

  const addColumn = () => {
    const columnId = addColumnToTable(schemaTable.tableId, { stayInView: true })
    if (!columnId) return
    setHeaderMenuId(null)
    setPendingSchemaEditId(columnId)
  }

  const addColumnAt = (targetIndex: number) => {
    const columnId = addColumnToTable(schemaTable.tableId, { stayInView: true, targetIndex })
    if (!columnId) return
    setHeaderMenuId(null)
    setPendingSchemaEditId(columnId)
  }

  const openTableMenu = (tableId: EntityId, tableName: string, x: number, y: number) => {
    const position = contextMenuPosition(x, y)
    selectTable(tableId)
    setTableMenu({ tableId, tableName, ...position })
  }

  const applyColumnFilter = (filter: WorkbookColumnFilter | null) => {
    if (!filterPanel) return
    changeColumnFilters((current) => {
      const remaining = current.filter((candidate) => candidate.id !== filterPanel.columnId)
      return filter ? [...remaining, { id: filter.columnId, value: filter }] : remaining
    })
    setFilterPanel(null)
  }

  const hideColumn = (columnId: EntityId) => {
    if (visibleColumns.length <= 1) {
      setGridError('마지막 표시 열은 숨길 수 없습니다.')
      return
    }
    updateTableWorkbookView(schemaTable.tableId, {
      hiddenColumnIds: [...new Set([...workbookView.hiddenColumnIds, columnId])],
      frozenColumnIds: workbookView.frozenColumnIds.filter((candidate) => candidate !== columnId),
    })
    setHeaderMenuId(null)
    setSelection(null)
  }

  const showColumn = (columnId: EntityId) => {
    updateTableWorkbookView(schemaTable.tableId, {
      hiddenColumnIds: workbookView.hiddenColumnIds.filter((candidate) => candidate !== columnId),
    })
  }

  const freezeThroughColumn = (columnIndex: number) => {
    updateTableWorkbookView(schemaTable.tableId, {
      frozenColumnIds: visibleColumns.slice(0, columnIndex + 1).map((column) => column.id),
    })
    setHeaderMenuId(null)
  }

  const addColumnSort = (columnId: EntityId, descending: boolean) => {
    changeSorting([
      ...sortingRef.current.filter((sort) => sort.id !== columnId),
      { id: columnId, desc: descending },
    ])
    setHeaderMenuId(null)
  }

  const clearColumnSort = (columnId: EntityId) => {
    changeSorting(sortingRef.current.filter((sort) => sort.id !== columnId))
    setHeaderMenuId(null)
  }

  const selectFindMatch = useCallback((index: number) => {
    if (findMatches.length === 0) return
    const normalizedIndex = (index + findMatches.length) % findMatches.length
    const match = findMatches[normalizedIndex]!
    setFindMatchIndex(normalizedIndex)
    setSelectionKind('cell')
    setSelection({ anchor: match.position, focus: match.position })
    if (match.position.rowIndex > 0) rowVirtualizer.scrollToIndex(match.position.rowIndex - 1, { align: 'center' })
    columnVirtualizer.scrollToIndex(match.position.columnIndex, { align: 'center' })
  }, [columnVirtualizer, findMatches, rowVirtualizer])

  const replaceCurrentMatch = useCallback(() => {
    const match = findMatches[findMatchIndex]
    if (!match || !findQuery) return
    try {
      if (match.kind === 'schema') {
        const column = schemaTable.columns.find((candidate) => candidate.columnId === match.columnId)
        if (!column) return
        const nextName = replaceWorkbookText(column.name, findQuery, findReplacement).trim()
        const nameError = validateColumnName(schemaTable, column.columnId, nextName)
        if (nameError) throw new Error(nameError)
        renameColumn(schemaTable.tableId, column.columnId, nextName)
      } else if (match.rowId) {
        const row = rows.find((candidate) => candidate.rowId === match.rowId)
        if (!row) return
        updateCells(schemaTable.tableId, [{
          rowId: match.rowId,
          columnId: match.columnId,
          value: replaceWorkbookText(cellText(row.cells[match.columnId]), findQuery, findReplacement),
        }])
      }
      setGridError(null)
    } catch (error) {
      setGridError(error instanceof Error ? error.message : '값을 바꾸지 못했습니다.')
    }
  }, [findMatchIndex, findMatches, findQuery, findReplacement, renameColumn, rows, schemaTable, updateCells])

  const replaceAllMatches = useCallback(() => {
    if (!findQuery) return
    try {
      replaceWorkbookMatches(schemaTable.tableId, findQuery, findReplacement)
      setGridError(null)
    } catch (error) {
      setGridError(error instanceof Error ? error.message : '값을 바꾸지 못했습니다.')
    }
  }, [findQuery, findReplacement, replaceWorkbookMatches, schemaTable.tableId])

  const openColumnSettings = (columnId: EntityId) => {
    selectColumn(columnId)
    setDesignerTab('relations')
    setMainView('design')
  }

  const beginColumnDrag = (columnId: EntityId, event: ReactDragEvent<HTMLSpanElement>) => {
    setDraggingColumnId(columnId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', columnId)
  }

  const dropColumn = (targetIndex: number, event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const columnId = draggingColumnId ?? event.dataTransfer.getData('text/plain')
    if (columnId) moveColumn(schemaTable.tableId, columnId, targetIndex)
    setDraggingColumnId(null)
  }

  const filterColumn = filterPanel
    ? schemaTable.columns.find((column) => column.columnId === filterPanel.columnId)
    : undefined
  const filterSuggestions = filterColumn ? columnFilterSuggestions(project, filterColumn) : []
  const hiddenColumns = schemaTable.columns.filter((column) => workbookView.hiddenColumnIds.includes(column.columnId))

  return (
    <section className={`data-shell spreadsheet-shell${findMode ? ' find-open' : ''}`} aria-label="데이터 그리드">
      <div className="view-header spreadsheet-header">
        <div><h1>테이블 편집</h1><p>{schemaTable.name} · {schemaTable.columns.length}열 · {rows.length}행</p></div>
        <div className="header-actions">
          <button className="tool-button" type="button" onClick={addColumn}><Plus aria-hidden="true" size={15} /><span>열 추가</span></button>
        </div>
      </div>

      <SpreadsheetToolbar
        search={search}
        sortingCount={sorting.length}
        filterCount={columnFilters.length}
        frozenCount={workbookView.frozenColumnIds.length}
        hiddenCount={hiddenColumns.length}
        fillMode={fillModePreference}
        viewRowCount={viewRowCount}
        rowCount={rows.length}
        error={gridError}
        onSearchChange={setSearch}
        onOpenGoTo={() => { setGoToAddress(''); setGoToOpen(true) }}
        onOpenPasteSpecial={openPasteSpecial}
        onToggleFillMode={() => setFillModePreference((current) => current === 'series' ? 'copy' : 'series')}
        onClearSorting={() => changeSorting([])}
        onClearFilters={() => changeColumnFilters([])}
        onClearFrozen={() => updateTableWorkbookView(schemaTable.tableId, { frozenColumnIds: [] })}
        onOpenHiddenColumns={(x, y) => setHiddenColumnsMenu(contextMenuPosition(x, y, 250, 320))}
      />

      {findMode && (
        <FindReplaceBar
          mode={findMode}
          query={findQuery}
          replacement={findReplacement}
          matchIndex={findMatchIndex}
          matchCount={findMatches.length}
          onQueryChange={(value) => { setFindQuery(value); setFindMatchIndex(0) }}
          onReplacementChange={setFindReplacement}
          onPrevious={() => selectFindMatch(findMatchIndex - 1)}
          onNext={() => selectFindMatch(findMatchIndex + 1)}
          onReplace={replaceCurrentMatch}
          onReplaceAll={replaceAllMatches}
          onClose={() => setFindMode(null)}
        />
      )}

      <VirtualWorkbookGrid
        viewportRef={scrollRef}
        keyboardCaptureRef={keyboardCaptureRef}
        label={`${schemaTable.name} 데이터 그리드`}
        rowCount={displayRowCount}
        columnCount={displayColumns.length}
        onCopy={copySelection}
        onCut={cutSelectedCells}
        onPaste={pasteSelection}
        onKeyDown={handleGridKey}
        onPointerDownCapture={focusGridOnPointerDown}
        onTextInput={(text) => {
          if (selection) beginGridEdit(selection.focus, 'replace', text)
        }}
      >
        <div
          className="spreadsheet-canvas"
          style={{ width: totalWidth, height: totalHeight }}
          onClickCapture={suppressCollapsedClick}
          onPointerDown={beginPointerSelection}
          onPointerMove={updatePointerSelection}
          onPointerUp={finishPointerSelection}
          onPointerCancel={finishPointerSelection}
        >
          <div
            aria-hidden="true"
            className="spreadsheet-row-grid"
            style={{
              left: ROW_HEADER_WIDTH,
              top: HEADER_HEIGHT,
              width: totalWidth - ROW_HEADER_WIDTH,
              height: totalHeight - HEADER_HEIGHT,
              backgroundSize: `100% ${ROW_HEIGHT}px`,
            }}
          />
          {visibleColumns.map((column) => (
            <div
              aria-hidden="true"
              className={`spreadsheet-column-guide${resizingColumnId === column.id ? ' resizing' : ''}`}
              key={`guide:${column.id}`}
              style={{
                left: ROW_HEADER_WIDTH + column.getStart(),
                top: HEADER_HEIGHT,
                width: column.getSize(),
                height: totalHeight - HEADER_HEIGHT,
              }}
            />
          ))}
          <div
            aria-hidden="true"
            className="spreadsheet-column-guide spreadsheet-append-column-guide"
            style={{
              left: ROW_HEADER_WIDTH + authoredColumnsWidth,
              top: HEADER_HEIGHT,
              width: GHOST_COLUMN_WIDTH,
              height: totalHeight - HEADER_HEIGHT,
            }}
          />
          {displayColumns.filter((column) => column.kind === 'ghost').map((column) => (
            <div
              aria-hidden="true"
              className="spreadsheet-column-guide spreadsheet-ghost-column-guide"
              key={`ghost-guide:${column.displayIndex}`}
              style={{
                left: ROW_HEADER_WIDTH + authoredColumnsWidth + (column.displayIndex - appendColumnIndex) * GHOST_COLUMN_WIDTH,
                top: HEADER_HEIGHT,
                width: GHOST_COLUMN_WIDTH,
                height: totalHeight - HEADER_HEIGHT,
              }}
            />
          ))}
          <div className="spreadsheet-column-headers" role="row" style={{ width: totalWidth, height: HEADER_HEIGHT }}>
            <div className="spreadsheet-corner-stack" style={{ width: ROW_HEADER_WIDTH }}>
              <button className="spreadsheet-corner" type="button" aria-label="전체 셀 선택" title="전체 셀 선택" onClick={selectAllCells} />
              <button className={`spreadsheet-schema-row-number${range?.startRow === 0 ? ' selected' : ''}`} type="button" role="rowheader" aria-label="1행 선택" onClick={() => selectGridRow(0)}>1</button>
            </div>
            {virtualColumns.map((virtualColumn) => {
              const column = visibleColumns[virtualColumn.index]!
              const schemaColumn = schemaTable.columns.find((candidate) => candidate.columnId === column.id)!
              const schemaColumnIndex = schemaTable.columns.findIndex((candidate) => candidate.columnId === column.id)
              const sorted = column.getIsSorted()
              const sortOrder = sorting.findIndex((sort) => sort.id === column.id) + 1
              const isSelected = selectedHeaderId === column.id
              const isRangeSelected = Boolean(range && range.startColumn <= virtualColumn.index && range.endColumn >= virtualColumn.index)
              const schemaPosition = { rowIndex: 0, columnIndex: virtualColumn.index }
              const schemaCellSelected = Boolean(range && range.startRow === 0 && range.startColumn <= virtualColumn.index && range.endColumn >= virtualColumn.index)
              const schemaCellActive = selection?.focus.rowIndex === 0 && selection.focus.columnIndex === virtualColumn.index
              const isOnlyPrimaryKey = schemaTable.primaryKey.columnIds.length === 1 && schemaTable.primaryKey.columnIds[0] === column.id
              const deleteDisabled = schemaTable.columns.length <= 1 || isOnlyPrimaryKey
              return (
                <div
                  className={`spreadsheet-column-stack${draggingColumnId === column.id ? ' dragging' : ''}${resizingColumnId === column.id ? ' resizing' : ''}${frozenColumnIds.has(column.id) ? ' frozen' : ''}${lastFrozenColumnId === column.id ? ' frozen-end' : ''}`}
                  key={column.id}
                  style={{ left: ROW_HEADER_WIDTH + virtualColumn.start, width: virtualColumn.size }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => dropColumn(schemaColumnIndex, event)}
                >
                  <button
                    className={`spreadsheet-column-letter${isRangeSelected ? ' selected' : ''}`}
                    type="button"
                    aria-label={`${columnIndexToLabel(virtualColumn.index)}열 선택`}
                    title={`${columnIndexToLabel(virtualColumn.index)}열 전체 선택`}
                    onClick={() => selectGridColumn(virtualColumn.index)}
                  >{columnIndexToLabel(virtualColumn.index)}</button>
                  <div
                    className={`spreadsheet-column-header spreadsheet-schema-cell${isSelected || schemaCellSelected ? ' selected' : ''}${schemaCellActive ? ' active' : ''}`}
                    role="gridcell"
                    aria-label={`${schemaTable.name} 1행 ${schemaColumn.name}`}
                    aria-selected={schemaCellSelected}
                    onClick={(event) => { setSelectedHeaderId(column.id); selectCell(schemaPosition, event.shiftKey) }}
                    onDoubleClick={() => beginEdit(schemaPosition, 'preserve')}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      setSelectedHeaderId(column.id)
                      setHeaderMenuId(column.id)
                    }}
                  >
                  {editing && editing.position.rowIndex === 0 && editing.position.columnIndex === virtualColumn.index ? (
                    <WorkbookCellEditor
                      ariaLabel={`${schemaTable.name} 1행 ${schemaColumn.name}`}
                      draft={editDraft}
                      mode={editing.mode}
                      onChange={changeEditDraft}
                      onClose={finishEdit}
                    />
                  ) : (
                    <span className="column-title-button" title="선택 후 입력하거나 더블클릭하여 이름 변경">
                      <span>{schemaColumn.name}</span>
                      {schemaTable.primaryKey.columnIds.includes(schemaColumn.columnId) && <small>PK</small>}
                      {foreignKeyColumnIds.has(schemaColumn.columnId) && <small className="fk">FK</small>}
                      {sorted && <b>{sorted === 'asc' ? '↑' : '↓'}{sortOrder}</b>}
                      {column.getIsFiltered() && <Filter aria-label="필터 적용됨" size={11} />}
                    </span>
                  )}
                  {!(editing && editing.position.rowIndex === 0 && editing.position.columnIndex === virtualColumn.index) && (
                    <>
                      <span
                        className="column-drag-handle"
                        draggable
                        title="열 순서 이동"
                        onDragStart={(event) => beginColumnDrag(column.id, event)}
                        onDragEnd={() => setDraggingColumnId(null)}
                      ><GripVertical aria-hidden="true" size={12} /></span>
                      <button
                        className="column-menu-trigger"
                        type="button"
                        title={`${schemaColumn.name} 열 메뉴`}
                        aria-label={`${schemaColumn.name} 열 메뉴`}
                        aria-expanded={headerMenuId === column.id}
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedHeaderId(column.id)
                          setHeaderMenuId((current) => current === column.id ? null : column.id)
                        }}
                      ><MoreHorizontal aria-hidden="true" size={14} /></button>
                    </>
                  )}
                  {headerMenuId === column.id && (
                    <WorkbookColumnMenu
                      sorted={Boolean(sorted)}
                      canMoveLeft={schemaColumnIndex > 0}
                      canMoveRight={schemaColumnIndex < schemaTable.columns.length - 1}
                      deleteDisabled={deleteDisabled}
                      deleteReason={isOnlyPrimaryKey ? '유일한 PK 열은 먼저 다른 PK를 지정해야 합니다.' : undefined}
                      onRename={() => { beginEdit(schemaPosition, 'preserve'); setHeaderMenuId(null) }}
                      onOpenFilter={(event) => {
                        const bounds = event.currentTarget.getBoundingClientRect()
                        const position = contextMenuPosition(bounds.right + 4, bounds.top, 300, 340)
                        setFilterPanel({ columnId: column.id, ...position })
                        setHeaderMenuId(null)
                      }}
                      onSortAscending={() => addColumnSort(column.id, false)}
                      onSortDescending={() => addColumnSort(column.id, true)}
                      onClearSort={() => clearColumnSort(column.id)}
                      onInsertLeft={() => addColumnAt(schemaColumnIndex)}
                      onInsertRight={() => addColumnAt(schemaColumnIndex + 1)}
                      onMoveLeft={() => { moveColumn(schemaTable.tableId, column.id, schemaColumnIndex - 1); setHeaderMenuId(null) }}
                      onMoveRight={() => { moveColumn(schemaTable.tableId, column.id, schemaColumnIndex + 1); setHeaderMenuId(null) }}
                      onOpenRelations={() => openColumnSettings(column.id)}
                      onDelete={() => { deleteColumn(schemaTable.tableId, column.id); setHeaderMenuId(null) }}
                      onHide={() => hideColumn(column.id)}
                      onFreeze={() => freezeThroughColumn(virtualColumn.index)}
                    />
                  )}
                  <span
                    aria-label={`${schemaColumn.name} 열 너비 조절`}
                    aria-orientation="vertical"
                    className="column-resizer"
                    role="separator"
                    title="드래그하여 너비 조절 · 더블클릭하여 내용에 맞춤"
                    onDoubleClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      autoFitColumn(column.id)
                    }}
                    onMouseDown={(event) => beginColumnResize(column.id, column.getSize(), event)}
                  />
                  </div>
                </div>
              )
            })}
            <div
              className="spreadsheet-column-stack spreadsheet-append-column"
              style={{ left: ROW_HEADER_WIDTH + authoredColumnsWidth, width: GHOST_COLUMN_WIDTH }}
            >
              <button
                className="spreadsheet-column-letter spreadsheet-ghost-column-letter"
                type="button"
                aria-label={`${columnIndexToLabel(appendColumnIndex)}열 선택`}
                title={`${columnIndexToLabel(appendColumnIndex)}1 선택 후 입력하면 열이 생성됩니다`}
                onClick={() => selectCell({ rowIndex: 0, columnIndex: appendColumnIndex })}
              >{columnIndexToLabel(appendColumnIndex)}</button>
              <div
                className={`spreadsheet-column-header spreadsheet-schema-cell spreadsheet-append-schema-cell${selection?.focus.rowIndex === 0 && selection.focus.columnIndex === appendColumnIndex ? ' active' : ''}`}
                role="gridcell"
                aria-label={`${schemaTable.name} ${columnIndexToLabel(appendColumnIndex)}1 빈 셀`}
                onClick={() => selectCell({ rowIndex: 0, columnIndex: appendColumnIndex })}
                onDoubleClick={() => beginEdit({ rowIndex: 0, columnIndex: appendColumnIndex }, 'preserve')}
              >
                {editing && editing.position.rowIndex === 0 && editing.position.columnIndex === appendColumnIndex ? (
                  <WorkbookCellEditor
                    ariaLabel={`${schemaTable.name} ${columnIndexToLabel(appendColumnIndex)}1 빈 셀`}
                    draft={editDraft}
                    mode={editing.mode}
                    onChange={changeEditDraft}
                    onClose={finishEdit}
                  />
                ) : null}
              </div>
            </div>
            {displayColumns.filter((column) => column.kind === 'ghost').map((column, offset) => {
              const selected = Boolean(range && range.startColumn <= column.displayIndex && range.endColumn >= column.displayIndex)
              const schemaSelected = selected && Boolean(range && range.startRow === 0)
              const active = selection?.focus.rowIndex === 0 && selection.focus.columnIndex === column.displayIndex
              return (
                <div
                  className="spreadsheet-column-stack spreadsheet-ghost-column"
                  key={`ghost-column:${column.displayIndex}`}
                  style={{ left: ROW_HEADER_WIDTH + authoredColumnsWidth + GHOST_COLUMN_WIDTH * (offset + 1), width: GHOST_COLUMN_WIDTH }}
                >
                  <button
                    className={`spreadsheet-column-letter spreadsheet-ghost-column-letter${selected ? ' selected' : ''}`}
                    type="button"
                    aria-label={`${columnIndexToLabel(column.displayIndex)}열 전체 선택`}
                    onClick={() => selectGridColumn(column.displayIndex)}
                  >{columnIndexToLabel(column.displayIndex)}</button>
                  <div
                    className={`spreadsheet-column-header spreadsheet-schema-cell${schemaSelected ? ' selected' : ''}${active ? ' active' : ''}`}
                    role="gridcell"
                    aria-label={`${schemaTable.name} ${columnIndexToLabel(column.displayIndex)}1 빈 셀`}
                    onClick={(event) => selectCell({ rowIndex: 0, columnIndex: column.displayIndex }, event.shiftKey)}
                  />
                </div>
              )
            })}
          </div>

          {virtualRows.map((virtualRow) => {
            const row = viewRowAt(virtualRow.index)
            const workbookRowIndex = virtualRow.index + 1
            const rowSelected = Boolean(range && range.startRow <= workbookRowIndex && range.endRow >= workbookRowIndex)
            return (
              <div className="spreadsheet-row" role="row" key={row.original.rowId} style={{ top: HEADER_HEIGHT + virtualRow.start, width: totalWidth, height: virtualRow.size }}>
                <button
                  className={`spreadsheet-row-number${rowSelected ? ' selected' : ''}`}
                  type="button"
                  role="rowheader"
                  aria-label={`${virtualRow.index + 2}행 선택`}
                  style={{ width: ROW_HEADER_WIDTH }}
                  onClick={() => selectGridRow(workbookRowIndex)}
                >{virtualRow.index + 2}</button>
                {virtualColumns.map((virtualColumn) => {
                  const column = visibleColumns[virtualColumn.index]!
                  const position = { rowIndex: workbookRowIndex, columnIndex: virtualColumn.index }
                  const selected = range && position.rowIndex >= range.startRow && position.rowIndex <= range.endRow && position.columnIndex >= range.startColumn && position.columnIndex <= range.endColumn
                  const active = selection?.focus.rowIndex === position.rowIndex && selection.focus.columnIndex === position.columnIndex
                  const issue = cellIssues.get(`${row.originalIndex}:${column.id}`)
                  const ariaLabel = `${schemaTable.name} ${virtualRow.index + 2}행 ${schemaTable.columns.find((candidate) => candidate.columnId === column.id)?.name ?? column.id}`
                  return (
                    <div
                      className={`spreadsheet-cell${selected ? ' selected' : ''}${active ? ' active' : ''}${issue ? ' invalid' : ''}${frozenColumnIds.has(column.id) ? ' frozen' : ''}${lastFrozenColumnId === column.id ? ' frozen-end' : ''}${selected && selectionKind === 'cell' && range && range.startRow >= 1 && range.endRow <= viewRowCount ? ' selected-movable' : ''}`}
                      role="gridcell"
                      aria-label={ariaLabel}
                      aria-selected={Boolean(selected)}
                      title={issue}
                      key={`${row.original.rowId}:${column.id}`}
                      data-workbook-row={workbookRowIndex}
                      data-workbook-column={virtualColumn.index}
                      style={{ left: ROW_HEADER_WIDTH + virtualColumn.start, width: virtualColumn.size, height: virtualRow.size }}
                      onClick={(event) => selectCell(position, event.shiftKey)}
                      onDoubleClick={() => beginEdit(position, 'preserve')}
                    >
                      {editing && editing.position.rowIndex === position.rowIndex && editing.position.columnIndex === position.columnIndex ? (
                        <WorkbookCellEditor
                          ariaLabel={ariaLabel}
                          draft={editDraft}
                          mode={editing.mode}
                          onChange={changeEditDraft}
                          onClose={finishEdit}
                          options={editorOptionsByColumn.get(column.id)?.options}
                          strictChoice={editorOptionsByColumn.get(column.id)?.strictChoice}
                        />
                      ) : <span>{cellText(row.original.cells[column.id])}</span>}
                      {active && range && range.startRow !== 0 && range.endRow <= viewRowCount && position.rowIndex === range.endRow && position.columnIndex === range.endColumn && (
                        <button
                          className="autofill-handle"
                          type="button"
                          aria-label="자동 채우기"
                          title="끌어서 자동 채우기 · 더블클릭하면 옆 열 끝까지 채웁니다"
                          onPointerDown={startAutoFill}
                          onDoubleClick={autoFillToNeighbor}
                        />
                      )}
                    </div>
                  )
                })}
                <div
                  className="spreadsheet-cell spreadsheet-append-column-cell"
                  role="gridcell"
                  aria-label={`${schemaTable.name} ${virtualRow.index + 2}행 새 열`}
                  data-workbook-row={workbookRowIndex}
                  data-workbook-column={appendColumnIndex}
                  style={{ left: ROW_HEADER_WIDTH + authoredColumnsWidth, width: GHOST_COLUMN_WIDTH, height: virtualRow.size }}
                  onClick={() => selectCell({ rowIndex: workbookRowIndex, columnIndex: appendColumnIndex })}
                  onDoubleClick={() => beginEdit({ rowIndex: workbookRowIndex, columnIndex: appendColumnIndex }, 'preserve')}
                >
                  {editing && editing.position.rowIndex === workbookRowIndex && editing.position.columnIndex === appendColumnIndex && (
                    <WorkbookCellEditor
                      ariaLabel={`${schemaTable.name} ${virtualRow.index + 2}행 새 열`}
                      draft={editDraft}
                      mode={editing.mode}
                      onChange={changeEditDraft}
                      onClose={finishEdit}
                    />
                  )}
                </div>
              </div>
            )
          })}

          <div
            className="spreadsheet-row spreadsheet-append-row"
            role="row"
            style={{ top: HEADER_HEIGHT + rowVirtualizer.getTotalSize(), width: totalWidth, height: ROW_HEIGHT }}
          >
            <button
              className={`spreadsheet-row-number${range?.startRow === appendRowIndex ? ' selected' : ''}`}
              type="button"
              role="rowheader"
              aria-label={`${appendRowIndex + 1}행 선택`}
              style={{ width: ROW_HEADER_WIDTH }}
              onClick={() => selectGridRow(appendRowIndex)}
            >{appendRowIndex + 1}</button>
            {virtualColumns.map((virtualColumn) => {
              const column = visibleColumns[virtualColumn.index]!
              const schemaColumn = schemaTable.columns.find((candidate) => candidate.columnId === column.id)!
              const position = { rowIndex: appendRowIndex, columnIndex: virtualColumn.index }
              const selected = range && position.rowIndex >= range.startRow && position.rowIndex <= range.endRow && position.columnIndex >= range.startColumn && position.columnIndex <= range.endColumn
              const active = selection?.focus.rowIndex === position.rowIndex && selection.focus.columnIndex === position.columnIndex
              const ariaLabel = `${schemaTable.name} ${appendRowIndex + 1}행 ${schemaColumn.name} 새 행`
              return (
                <div
                  className={`spreadsheet-cell spreadsheet-append-row-cell${selected ? ' selected' : ''}${active ? ' active' : ''}`}
                  role="gridcell"
                  aria-label={ariaLabel}
                  aria-selected={Boolean(selected)}
                  data-workbook-row={appendRowIndex}
                  data-workbook-column={virtualColumn.index}
                  key={`append-row:${column.id}`}
                  style={{ left: ROW_HEADER_WIDTH + virtualColumn.start, width: virtualColumn.size, height: ROW_HEIGHT }}
                  onClick={(event) => selectCell(position, event.shiftKey)}
                  onDoubleClick={() => beginEdit(position, 'preserve')}
                >
                  {editing && editing.position.rowIndex === position.rowIndex && editing.position.columnIndex === position.columnIndex ? (
                    <WorkbookCellEditor
                      ariaLabel={ariaLabel}
                      draft={editDraft}
                      mode={editing.mode}
                      onChange={changeEditDraft}
                      onClose={finishEdit}
                      options={editorOptionsByColumn.get(column.id)?.options}
                      strictChoice={editorOptionsByColumn.get(column.id)?.strictChoice}
                    />
                  ) : null}
                </div>
              )
            })}
            <div
              className="spreadsheet-cell spreadsheet-append-column-cell"
              role="gridcell"
              aria-label={`${schemaTable.name} ${appendRowIndex + 1}행 새 열`}
              data-workbook-row={appendRowIndex}
              data-workbook-column={appendColumnIndex}
              style={{ left: ROW_HEADER_WIDTH + authoredColumnsWidth, width: GHOST_COLUMN_WIDTH, height: ROW_HEIGHT }}
              onClick={() => selectCell({ rowIndex: appendRowIndex, columnIndex: appendColumnIndex })}
              onDoubleClick={() => beginEdit({ rowIndex: appendRowIndex, columnIndex: appendColumnIndex }, 'preserve')}
            >
              {editing && editing.position.rowIndex === appendRowIndex && editing.position.columnIndex === appendColumnIndex && (
                <WorkbookCellEditor
                  ariaLabel={`${schemaTable.name} ${appendRowIndex + 1}행 새 열`}
                  draft={editDraft}
                  mode={editing.mode}
                  onChange={changeEditDraft}
                  onClose={finishEdit}
                />
              )}
            </div>
          </div>

          {virtualGhostRows.map((row) => (
            <button
              className={`spreadsheet-ghost-row-number${range && range.startRow <= row.displayIndex && range.endRow >= row.displayIndex ? ' selected' : ''}`}
              type="button"
              role="rowheader"
              aria-label={`${row.displayIndex + 1}행 전체 선택`}
              key={`ghost-row:${row.displayIndex}`}
              style={{ top: row.start, width: ROW_HEADER_WIDTH, height: ROW_HEIGHT }}
              onClick={() => selectGridRow(row.displayIndex)}
            >{row.displayIndex + 1}</button>
          ))}

          <div className="spreadsheet-ghost-cells-layer" aria-hidden="false">
            {virtualGhostRows.map((row) => (
              <div className="spreadsheet-ghost-cells-row" role="row" key={`ghost-cells:${row.displayIndex}`} style={{ top: row.start, width: totalWidth, height: ROW_HEIGHT }}>
                {virtualColumns.map((virtualColumn) => {
                  const column = visibleColumns[virtualColumn.index]
                  if (!column) return null
                  const position = { rowIndex: row.displayIndex, columnIndex: virtualColumn.index }
                  const selected = Boolean(range && position.rowIndex >= range.startRow && position.rowIndex <= range.endRow && position.columnIndex >= range.startColumn && position.columnIndex <= range.endColumn)
                  const active = selection?.focus.rowIndex === position.rowIndex && selection.focus.columnIndex === position.columnIndex
                  return (
                    <div
                      className={`spreadsheet-cell spreadsheet-ghost-cell${selected ? ' selected' : ''}${active ? ' active' : ''}`}
                      role="gridcell"
                      aria-label={`${schemaTable.name} ${row.displayIndex + 1}행 ${column.id}`}
                      aria-selected={selected}
                      key={`ghost-cell:${row.displayIndex}:${column.id}`}
                      style={{ left: ROW_HEADER_WIDTH + virtualColumn.start, width: virtualColumn.size, height: ROW_HEIGHT }}
                      onClick={(event) => selectCell(position, event.shiftKey)}
                      onDoubleClick={() => beginGridEdit(position, 'preserve')}
                    />
                  )
                })}
                <div
                  className="spreadsheet-cell spreadsheet-append-column-cell spreadsheet-ghost-cell"
                  role="gridcell"
                  aria-label={`${schemaTable.name} ${row.displayIndex + 1}행 새 열`}
                  style={{ left: ROW_HEADER_WIDTH + authoredColumnsWidth, width: GHOST_COLUMN_WIDTH, height: ROW_HEIGHT }}
                  onClick={(event) => selectCell({ rowIndex: row.displayIndex, columnIndex: appendColumnIndex }, event.shiftKey)}
                  onDoubleClick={() => beginGridEdit({ rowIndex: row.displayIndex, columnIndex: appendColumnIndex }, 'preserve')}
                />
              </div>
            ))}
          </div>

          {selectionOverlay && (
            <div
              aria-hidden="true"
              className="spreadsheet-range-selection"
              data-selection-range={range ? `${range.startRow}:${range.startColumn}-${range.endRow}:${range.endColumn}` : undefined}
              style={selectionOverlay}
            />
          )}

          {rowDropIndex !== null && (
            <div
              aria-hidden="true"
              className="spreadsheet-row-drop-line"
              style={{ top: HEADER_HEIGHT + rowDropIndex * ROW_HEIGHT, width: totalWidth }}
            />
          )}

          {fillPreview && (
            <div
              aria-hidden="true"
              className="spreadsheet-fill-preview"
              style={{
                left: ROW_HEADER_WIDTH + (visibleColumns[fillPreview.range.startColumn]?.getStart() ?? 0),
                top: HEADER_HEIGHT + (fillPreview.range.startRow - 1) * ROW_HEIGHT,
                width: visibleColumns
                  .slice(fillPreview.range.startColumn, fillPreview.range.endColumn + 1)
                  .reduce((sum, column) => sum + column.getSize(), 0),
                height: (fillPreview.range.endRow - fillPreview.range.startRow + 1) * ROW_HEIGHT,
              }}
            >
              <span>{fillPreview.mode === 'copy' ? '복사' : '연속'}{fillPreview.value ? ` · ${fillPreview.value}` : ''}</span>
            </div>
          )}

          {movePreview && (
            <div
              aria-hidden="true"
              className="spreadsheet-move-preview"
              style={{
                left: ROW_HEADER_WIDTH + (visibleColumns[movePreview.startColumn]?.getStart() ?? 0),
                top: HEADER_HEIGHT + (movePreview.startRow - 1) * ROW_HEIGHT,
                width: visibleColumns
                  .slice(movePreview.startColumn, movePreview.endColumn + 1)
                  .reduce((sum, column) => sum + column.getSize(), 0),
                height: (movePreview.endRow - movePreview.startRow + 1) * ROW_HEIGHT,
              }}
            />
          )}

          {viewRowCount === 0 && rows.length > 0 && <div className="spreadsheet-empty">검색 결과가 없습니다.</div>}
        </div>
      </VirtualWorkbookGrid>

      <WorkbookSheetTabs
        tables={project.tables}
        rowsByTable={rowsByTable}
        selectedTableId={schemaTable.tableId}
        onSelect={selectTable}
        onOpenContextMenu={openTableMenu}
        onCreate={() => { createTable(); setMainView('data') }}
      />
      {filterPanel && filterColumn && (
        <ColumnFilterPopover
          key={filterColumn.columnId}
          column={filterColumn}
          existing={workbookView.filters.find((filter) => filter.columnId === filterColumn.columnId)}
          x={filterPanel.x}
          y={filterPanel.y}
          suggestions={filterSuggestions}
          onApply={applyColumnFilter}
          onClose={() => setFilterPanel(null)}
        />
      )}
      {tableMenu && <TableContextMenu menu={tableMenu} onDelete={deleteTable} onClose={() => setTableMenu(null)} />}
      {hiddenColumnsMenu && hiddenColumns.length > 0 && (
        <HiddenColumnsMenu
          columns={hiddenColumns}
          x={hiddenColumnsMenu.x}
          y={hiddenColumnsMenu.y}
          onShow={(columnId) => {
            showColumn(columnId)
            setHiddenColumnsMenu(null)
          }}
          onShowAll={() => {
            updateTableWorkbookView(schemaTable.tableId, { hiddenColumnIds: [] })
            setHiddenColumnsMenu(null)
          }}
          onClose={() => setHiddenColumnsMenu(null)}
        />
      )}
      {pasteSpecial && (
        <PasteSpecialDialog
          state={pasteSpecial}
          onChange={setPasteSpecial}
          onApply={applyPasteSpecial}
          onClose={() => setPasteSpecial(null)}
        />
      )}
      {goToOpen && (
        <div className="paste-special-backdrop" role="presentation">
          <form className="go-to-dialog" role="dialog" aria-modal="true" aria-label="셀로 이동" onSubmit={(event) => {
            event.preventDefault()
            const target = parseWorkbookAddress(goToAddress)
            if (!target || target.rowIndex > lastDisplayRowIndex || target.columnIndex > lastDisplayColumnIndex) {
              setGridError(`이동할 수 없는 주소입니다. A1부터 ${columnIndexToLabel(lastDisplayColumnIndex)}${lastDisplayRowIndex + 1} 사이를 입력하세요.`)
              return
            }
            setGoToOpen(false)
            jumpSelection(target.rowIndex, target.columnIndex)
          }}>
            <header><strong>셀로 이동</strong><button type="button" onClick={() => setGoToOpen(false)}>닫기</button></header>
            <label>셀 주소<input autoFocus value={goToAddress} placeholder="예: A100000" onChange={(event) => setGoToAddress(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Escape') setGoToOpen(false)
            }} /></label>
            <footer><button type="button" onClick={() => setGoToOpen(false)}>취소</button><button className="primary" type="submit">이동</button></footer>
          </form>
        </div>
      )}
    </section>
  )
}
