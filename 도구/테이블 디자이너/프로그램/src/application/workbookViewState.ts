import type { EntityId, TableWorkbookViewState } from '../domain/schema'

export const EMPTY_TABLE_WORKBOOK_VIEW: TableWorkbookViewState = Object.freeze({
  columnWidths: Object.freeze({}),
  hiddenColumnIds: Object.freeze([]),
  frozenColumnIds: Object.freeze([]),
  sorting: Object.freeze([]),
  filters: Object.freeze([]),
})

export function tableWorkbookView(
  views: Readonly<Record<EntityId, TableWorkbookViewState>>,
  tableId: EntityId,
): TableWorkbookViewState {
  return views[tableId] ?? EMPTY_TABLE_WORKBOOK_VIEW
}
