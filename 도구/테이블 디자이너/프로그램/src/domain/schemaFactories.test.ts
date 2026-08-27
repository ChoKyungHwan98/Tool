import { describe, expect, it } from 'vitest'
import { createColumn, createRelation, createTable, createUniqueConstraint } from './schemaFactories'

describe('schema factories', () => {
  it('creates tables with immutable generated IDs and normalized defaults', () => {
    const table = createTable({
      name: 'Item',
      columns: [
        { name: 'ItemId', dataType: { kind: 'string' }, nullable: false },
        { name: 'Name', dataType: { kind: 'string' } },
      ],
    })

    expect(table.tableId).toMatch(/^table_/)
    expect(table.columns[0]?.columnId).toMatch(/^column_/)
    expect(table.columns[1]?.nullable).toBe(true)
    expect(table.columns.every((column) => column.tableId === table.tableId)).toBe(true)
  })

  it('creates constraints and relations by IDs, not names', () => {
    const item = createTable({
      tableId: 'table_item',
      name: 'Item',
      columns: [{ columnId: 'column_item_id', name: 'ItemId', dataType: { kind: 'string' }, nullable: false }],
      primaryKeyColumnIds: ['column_item_id'],
      uniqueConstraints: [createUniqueConstraint('uq_item_id', ['column_item_id'])],
    })
    const dropColumn = createColumn({
      tableId: 'table_drop',
      columnId: 'column_drop_item_id',
      name: 'ItemId',
      dataType: { kind: 'string' },
      nullable: false,
    })
    const relation = createRelation({
      name: 'Drop uses item',
      sourceTableId: 'table_drop',
      sourceColumnIds: [dropColumn.columnId],
      targetTableId: item.tableId,
      targetColumnIds: ['column_item_id'],
    })

    expect(item.uniqueConstraints[0]?.columnIds).toEqual(['column_item_id'])
    expect(relation.targetTableId).toBe('table_item')
    expect(relation.targetColumnIds).toEqual(['column_item_id'])
  })
})
