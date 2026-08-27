import { Plus } from 'lucide-react'
import type { EntityId, RowsByTable, SchemaTable } from '../../../domain/schema'

export function WorkbookSheetTabs({
  tables,
  rowsByTable,
  selectedTableId,
  onSelect,
  onOpenContextMenu,
  onCreate,
}: {
  readonly tables: readonly SchemaTable[]
  readonly rowsByTable: RowsByTable
  readonly selectedTableId: EntityId
  readonly onSelect: (tableId: EntityId) => void
  readonly onOpenContextMenu: (tableId: EntityId, tableName: string, x: number, y: number) => void
  readonly onCreate: () => void
}) {
  return (
    <nav className="sheet-tabs" aria-label="시트 탭">
      <div className="sheet-tab-scroll">
        {tables.map((table) => (
          <button
            key={table.tableId}
            className={table.tableId === selectedTableId ? 'sheet-tab active' : 'sheet-tab'}
            type="button"
            onClick={() => onSelect(table.tableId)}
            onContextMenu={(event) => {
              event.preventDefault()
              onOpenContextMenu(table.tableId, table.name, event.clientX, event.clientY)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
              event.preventDefault()
              const bounds = event.currentTarget.getBoundingClientRect()
              onOpenContextMenu(table.tableId, table.name, bounds.left + 20, bounds.top)
            }}
          >
            {table.name}<small>{rowsByTable[table.tableId]?.length ?? 0}</small>
          </button>
        ))}
        <button className="sheet-add" type="button" title="새 테이블" onClick={onCreate}><Plus aria-hidden="true" size={15} /></button>
      </div>
    </nav>
  )
}
