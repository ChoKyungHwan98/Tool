import { ChevronsLeft, ChevronsRight, Plus, Search, Table2 } from 'lucide-react'
import { useCallback, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { contextMenuPosition } from '../contextMenuPosition'
import { useWorkbenchStore } from '../state/workbenchStore'
import { TableContextMenu, type TableContextMenuState } from './TableContextMenu'

export function ProjectExplorer() {
  const project = useWorkbenchStore((state) => state.document.schema)
  const rowsByTable = useWorkbenchStore((state) => state.document.rowsByTable)
  const selectedTableId = useWorkbenchStore((state) => state.selectedTableId)
  const explorerCollapsed = useWorkbenchStore((state) => state.explorerCollapsed)
  const selectTable = useWorkbenchStore((state) => state.selectTable)
  const createTable = useWorkbenchStore((state) => state.createTable)
  const deleteTable = useWorkbenchStore((state) => state.deleteTable)
  const setExplorerCollapsed = useWorkbenchStore((state) => state.setExplorerCollapsed)
  const setAssistantCollapsed = useWorkbenchStore((state) => state.setAssistantCollapsed)
  const [query, setQuery] = useState('')
  const [tableMenu, setTableMenu] = useState<TableContextMenuState | null>(null)
  const filteredTables = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ko-KR')
    return normalized
      ? project.tables.filter((table) => table.name.toLocaleLowerCase('ko-KR').includes(normalized))
      : project.tables
  }, [project.tables, query])

  const openTableMenu = useCallback((tableId: string, tableName: string, x: number, y: number) => {
    const position = contextMenuPosition(x, y)
    selectTable(tableId)
    setTableMenu({ tableId, tableName, ...position })
  }, [selectTable])

  const handleContextMenu = (tableId: string, tableName: string, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    openTableMenu(tableId, tableName, event.clientX, event.clientY)
  }

  const handleMenuKey = (tableId: string, tableName: string, event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
    event.preventDefault()
    const bounds = event.currentTarget.getBoundingClientRect()
    openTableMenu(tableId, tableName, bounds.left + 20, bounds.bottom - 4)
  }

  const contextMenu = tableMenu && (
    <TableContextMenu menu={tableMenu} onDelete={deleteTable} onClose={() => setTableMenu(null)} />
  )

  const setCollapsed = (collapsed: boolean) => {
    if (!collapsed && window.matchMedia('(max-width: 1279px)').matches) setAssistantCollapsed(true)
    setExplorerCollapsed(collapsed)
  }

  if (explorerCollapsed) {
    return (
      <aside className="project-explorer collapsed" aria-label="테이블 목록">
        <button className="explorer-expand" type="button" title="테이블 목록 열기" aria-label="테이블 목록 열기" onClick={() => setCollapsed(false)}>
          <ChevronsRight aria-hidden="true" size={17} />
        </button>
        <div className="collapsed-table-list">
          {project.tables.map((table) => (
            <button
              key={table.tableId}
              className={selectedTableId === table.tableId ? 'collapsed-table active' : 'collapsed-table'}
              type="button"
              title={table.name}
              onClick={() => selectTable(table.tableId)}
              onContextMenu={(event) => handleContextMenu(table.tableId, table.name, event)}
              onKeyDown={(event) => handleMenuKey(table.tableId, table.name, event)}
            >
              <Table2 aria-hidden="true" size={16} />
            </button>
          ))}
        </div>
        {contextMenu}
      </aside>
    )
  }

  return (
    <aside className="project-explorer" aria-label="테이블 목록">
      <div className="panel-heading explorer-heading">
        <div>
          <span>테이블</span>
          <small>{project.tables.length}개</small>
        </div>
        <div className="panel-heading-actions">
          <button className="icon-button subtle" type="button" title="새 테이블" onClick={createTable}>
            <Plus aria-hidden="true" size={16} />
          </button>
          <button className="icon-button subtle" type="button" title="테이블 목록 접기" aria-label="테이블 목록 접기" onClick={() => setCollapsed(true)}>
            <ChevronsLeft aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
      <label className="explorer-search">
        <Search aria-hidden="true" size={15} />
        <input aria-label="테이블 검색" placeholder="테이블 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="tree-list table-sheet-list">
        {filteredTables.map((table) => (
          <button
            key={table.tableId}
            className={selectedTableId === table.tableId ? 'tree-row selected' : 'tree-row'}
            type="button"
            aria-label={`${table.name} ${table.columns.length}열 ${(rowsByTable[table.tableId]?.length ?? 0)}행`}
            onClick={() => selectTable(table.tableId)}
            onContextMenu={(event) => handleContextMenu(table.tableId, table.name, event)}
            onKeyDown={(event) => handleMenuKey(table.tableId, table.name, event)}
          >
            <Table2 aria-hidden="true" size={15} />
            <span>{table.name}</span>
            <small>{table.columns.length}열 · {rowsByTable[table.tableId]?.length ?? 0}행</small>
          </button>
        ))}
        {filteredTables.length === 0 && <div className="explorer-empty">일치하는 테이블이 없습니다.</div>}
      </div>
      {contextMenu}
    </aside>
  )
}
