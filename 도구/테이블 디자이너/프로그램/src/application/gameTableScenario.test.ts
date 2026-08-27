import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../domain/emptyProject'
import { createRelation, createTable } from '../domain/schemaFactories'
import type { DataRow, ExportView, RowsByTable } from '../domain/schema'
import { validateProjectWithRows } from '../domain/validator'
import { createWorkbenchDocument } from './workbenchDocument'
import { ApplyWorkbookRangeCommand } from './documentCommands'
import { exportRuntimeView, toCsv } from './exportRuntime'

describe('game designer table workflow scenario', () => {
  it('designs Item, ItemType, MonsterDrop, and Shop through validation and CSV export', () => {
    const itemType = createTable({
      tableId: 'table_item_type',
      name: 'ItemType',
      columns: [
        { columnId: 'column_item_type_id', name: 'ItemTypeId', dataType: { kind: 'string' }, nullable: false },
        { columnId: 'column_item_type_name', name: 'Name', dataType: { kind: 'string' }, nullable: false },
      ],
      primaryKeyColumnIds: ['column_item_type_id'],
    })
    const item = createTable({
      tableId: 'table_item',
      name: 'Item',
      columns: [
        { columnId: 'column_item_id', name: 'ItemId', dataType: { kind: 'string' }, nullable: false },
        { columnId: 'column_item_type_ref', name: 'ItemTypeId', dataType: { kind: 'string' }, nullable: false },
        { columnId: 'column_item_name', name: 'Name', dataType: { kind: 'string' }, nullable: false },
        { columnId: 'column_item_price', name: 'Price', dataType: { kind: 'int32' }, nullable: false },
      ],
      primaryKeyColumnIds: ['column_item_id'],
    })
    const monsterDrop = createTable({
      tableId: 'table_monster_drop',
      name: 'MonsterDrop',
      columns: [
        { columnId: 'column_drop_id', name: 'DropId', dataType: { kind: 'string' }, nullable: false },
        { columnId: 'column_monster_id', name: 'MonsterId', dataType: { kind: 'string' }, nullable: false },
        { columnId: 'column_drop_item_id', name: 'ItemId', dataType: { kind: 'string' }, nullable: false },
        { columnId: 'column_drop_rate', name: 'DropRate', dataType: { kind: 'float' }, nullable: false },
      ],
      primaryKeyColumnIds: ['column_drop_id'],
    })
    const shop = createTable({
      tableId: 'table_shop',
      name: 'Shop',
      columns: [
        { columnId: 'column_shop_id', name: 'ShopId', dataType: { kind: 'string' }, nullable: false },
        { columnId: 'column_shop_item_id', name: 'ItemId', dataType: { kind: 'string' }, nullable: false },
        { columnId: 'column_shop_price', name: 'Price', dataType: { kind: 'int32' }, nullable: false },
      ],
      primaryKeyColumnIds: ['column_shop_id'],
    })
    const relations = [
      createRelation({ name: 'Item_to_ItemType', sourceTableId: item.tableId, sourceColumnIds: ['column_item_type_ref'], targetTableId: itemType.tableId, targetColumnIds: ['column_item_type_id'] }),
      createRelation({ name: 'MonsterDrop_to_Item', sourceTableId: monsterDrop.tableId, sourceColumnIds: ['column_drop_item_id'], targetTableId: item.tableId, targetColumnIds: ['column_item_id'] }),
      createRelation({ name: 'Shop_to_Item', sourceTableId: shop.tableId, sourceColumnIds: ['column_shop_item_id'], targetTableId: item.tableId, targetColumnIds: ['column_item_id'] }),
    ]
    const exportView: ExportView = {
      viewId: 'export_item_runtime',
      name: 'ItemRuntime',
      displayName: '아이템 런타임',
      description: '게임 런타임용 아이템 데이터',
      format: 'csv',
      rootTableId: item.tableId,
      columns: [
        { exportColumnId: 'export_item_id', sourceTableId: item.tableId, sourceColumnId: 'column_item_id', header: 'ItemId' },
        { exportColumnId: 'export_item_name', sourceTableId: item.tableId, sourceColumnId: 'column_item_name', header: 'Name' },
        { exportColumnId: 'export_item_type_name', sourceTableId: itemType.tableId, sourceColumnId: 'column_item_type_name', header: 'ItemTypeName' },
        { exportColumnId: 'export_item_price', sourceTableId: item.tableId, sourceColumnId: 'column_item_price', header: 'Price' },
      ],
    }
    const base = createEmptyProject('아이템 시스템 QA')
    const project = { ...base, tables: [itemType, item, monsterDrop, shop], relations, exportViews: [exportView] }
    const rowsByTable: RowsByTable = {
      [itemType.tableId]: [row('row_item_type', { column_item_type_id: 'consumable', column_item_type_name: '소모품' })],
      [item.tableId]: [row('row_item', { column_item_id: 'potion_small', column_item_type_ref: 'consumable', column_item_name: '소형 회복약', column_item_price: 100 })],
      [monsterDrop.tableId]: [row('row_drop', { column_drop_id: 'slime_potion', column_monster_id: 'slime', column_drop_item_id: 'potion_small', column_drop_rate: 0.25 })],
      [shop.tableId]: [row('row_shop', { column_shop_id: 'village_potion', column_shop_item_id: 'potion_small', column_shop_price: 120 })],
    }

    const issues = validateProjectWithRows(project, rowsByTable)
    expect(issues.filter((issue) => issue.severity === 'blocking' || issue.severity === 'error')).toEqual([])
    expect(project.relations).toHaveLength(3)

    const result = exportRuntimeView(project, exportView, rowsByTable)
    expect(result.rows).toEqual([{ ItemId: 'potion_small', Name: '소형 회복약', ItemTypeName: '소모품', Price: 100 }])
    expect(result.lineage.find((entry) => entry.header === 'ItemTypeName')?.relationPath).toHaveLength(1)
    expect(toCsv(result)).toContain('potion_small,소형 회복약,소모품,100')

    const document = createWorkbenchDocument(project, rowsByTable)
    const pasted = new ApplyWorkbookRangeCommand(item.tableId, 0, 0, [
      ['ItemId', 'ItemTypeId', 'Name', 'Price'],
      ['potion_large', 'consumable', '대형 회복약', '300'],
    ]).execute(document).document
    expect(pasted.rowsByTable[item.tableId]?.[0]?.cells.column_item_id).toBe('potion_large')
    expect(pasted.schema.tables.find((table) => table.tableId === item.tableId)?.columns[0]?.columnId).toBe('column_item_id')
  })
})

function row(rowId: string, cells: DataRow['cells']): DataRow {
  return { rowId, cells }
}
