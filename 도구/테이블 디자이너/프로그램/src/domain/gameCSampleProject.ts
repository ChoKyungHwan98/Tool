import { createRelation, createTable } from './schemaFactories'
import type { DataRow, RowsByTable, SchemaProject } from './schema'

const ids = {
  project: 'project_game_c_pk_fk_sample',
  itemType: 'table_game_c_item_type',
  item: 'table_game_c_item',
  monster: 'table_game_c_monster',
  monsterDrop: 'table_game_c_monster_drop',
  shop: 'table_game_c_shop',
  shopItem: 'table_game_c_shop_item',
  itemTypeId: 'column_game_c_item_type_id',
  itemTypeName: 'column_game_c_item_type_name',
  itemId: 'column_game_c_item_id',
  itemTypeRef: 'column_game_c_item_type_ref',
  itemName: 'column_game_c_item_name',
  itemPrice: 'column_game_c_item_price',
  monsterId: 'column_game_c_monster_id',
  monsterName: 'column_game_c_monster_name',
  monsterLevel: 'column_game_c_monster_level',
  dropOrder: 'column_game_c_drop_order',
  dropMonsterId: 'column_game_c_drop_monster_id',
  dropItemId: 'column_game_c_drop_item_id',
  dropRate: 'column_game_c_drop_rate',
  shopId: 'column_game_c_shop_id',
  shopName: 'column_game_c_shop_name',
  shopItemShopId: 'column_game_c_shop_item_shop_id',
  shopItemItemId: 'column_game_c_shop_item_item_id',
  shopItemPrice: 'column_game_c_shop_item_price',
} as const

const itemType = createTable({
  tableId: ids.itemType,
  name: 'ItemType',
  displayName: '아이템 종류',
  description: '아이템 분류를 관리하는 기준 테이블입니다.',
  tags: ['lookup'],
  columns: [
    { columnId: ids.itemTypeId, name: 'ItemTypeId', dataType: { kind: 'string' }, nullable: false },
    { columnId: ids.itemTypeName, name: 'Name', dataType: { kind: 'string' }, nullable: false },
  ],
  primaryKeyColumnIds: [ids.itemTypeId],
})

const item = createTable({
  tableId: ids.item,
  name: 'Item',
  displayName: '아이템',
  description: '게임에서 사용하는 아이템의 공통 정보를 관리합니다.',
  columns: [
    { columnId: ids.itemId, name: 'ItemId', dataType: { kind: 'string' }, nullable: false },
    { columnId: ids.itemTypeRef, name: 'ItemTypeId', dataType: { kind: 'string' }, nullable: false },
    { columnId: ids.itemName, name: 'Name', dataType: { kind: 'string' }, nullable: false },
    { columnId: ids.itemPrice, name: 'BasePrice', dataType: { kind: 'int32' }, nullable: false },
  ],
  primaryKeyColumnIds: [ids.itemId],
})

const monster = createTable({
  tableId: ids.monster,
  name: 'Monster',
  displayName: '몬스터',
  description: '몬스터의 기본 정보를 관리합니다.',
  columns: [
    { columnId: ids.monsterId, name: 'MonsterId', dataType: { kind: 'string' }, nullable: false },
    { columnId: ids.monsterName, name: 'Name', dataType: { kind: 'string' }, nullable: false },
    { columnId: ids.monsterLevel, name: 'Level', dataType: { kind: 'int32' }, nullable: false },
  ],
  primaryKeyColumnIds: [ids.monsterId],
})

const monsterDrop = createTable({
  tableId: ids.monsterDrop,
  name: 'MonsterDrop',
  displayName: '몬스터 드롭',
  description: '몬스터와 아이템의 다대다 드롭 관계를 관리합니다. B와 C 열이 복합 PK입니다.',
  tags: ['junction'],
  columns: [
    { columnId: ids.dropOrder, name: 'DisplayOrder', dataType: { kind: 'int32' }, nullable: false },
    { columnId: ids.dropMonsterId, name: 'MonsterId', dataType: { kind: 'string' }, nullable: false },
    { columnId: ids.dropItemId, name: 'ItemId', dataType: { kind: 'string' }, nullable: false },
    { columnId: ids.dropRate, name: 'DropRate', dataType: { kind: 'float' }, nullable: false },
  ],
  primaryKeyColumnIds: [ids.dropMonsterId, ids.dropItemId],
})

const shop = createTable({
  tableId: ids.shop,
  name: 'Shop',
  displayName: '상점',
  description: '상점의 기본 정보를 관리합니다.',
  columns: [
    { columnId: ids.shopId, name: 'ShopId', dataType: { kind: 'string' }, nullable: false },
    { columnId: ids.shopName, name: 'Name', dataType: { kind: 'string' }, nullable: false },
  ],
  primaryKeyColumnIds: [ids.shopId],
})

const shopItem = createTable({
  tableId: ids.shopItem,
  name: 'ShopItem',
  displayName: '상점 판매 아이템',
  description: '상점과 아이템의 다대다 판매 관계를 관리합니다.',
  tags: ['junction'],
  columns: [
    { columnId: ids.shopItemShopId, name: 'ShopId', dataType: { kind: 'string' }, nullable: false },
    { columnId: ids.shopItemItemId, name: 'ItemId', dataType: { kind: 'string' }, nullable: false },
    { columnId: ids.shopItemPrice, name: 'Price', dataType: { kind: 'int32' }, nullable: false },
  ],
  primaryKeyColumnIds: [ids.shopItemShopId, ids.shopItemItemId],
})

export const gameCSampleProject: SchemaProject = {
  projectId: ids.project,
  name: '게임 C (PK·FK 예제)',
  schemaVersion: '0.1.0',
  tables: [itemType, item, monster, monsterDrop, shop, shopItem],
  enums: [],
  relations: [
    createRelation({
      relationId: 'relation_game_c_item_type',
      name: 'Item belongs to ItemType',
      sourceTableId: ids.item,
      sourceColumnIds: [ids.itemTypeRef],
      targetTableId: ids.itemType,
      targetColumnIds: [ids.itemTypeId],
    }),
    createRelation({
      relationId: 'relation_game_c_drop_monster',
      name: 'MonsterDrop belongs to Monster',
      sourceTableId: ids.monsterDrop,
      sourceColumnIds: [ids.dropMonsterId],
      targetTableId: ids.monster,
      targetColumnIds: [ids.monsterId],
    }),
    createRelation({
      relationId: 'relation_game_c_drop_item',
      name: 'MonsterDrop uses Item',
      sourceTableId: ids.monsterDrop,
      sourceColumnIds: [ids.dropItemId],
      targetTableId: ids.item,
      targetColumnIds: [ids.itemId],
    }),
    createRelation({
      relationId: 'relation_game_c_shop_item_shop',
      name: 'ShopItem belongs to Shop',
      sourceTableId: ids.shopItem,
      sourceColumnIds: [ids.shopItemShopId],
      targetTableId: ids.shop,
      targetColumnIds: [ids.shopId],
    }),
    createRelation({
      relationId: 'relation_game_c_shop_item_item',
      name: 'ShopItem uses Item',
      sourceTableId: ids.shopItem,
      sourceColumnIds: [ids.shopItemItemId],
      targetTableId: ids.item,
      targetColumnIds: [ids.itemId],
    }),
  ],
  functionalDependencies: [],
  exportViews: [],
  layout: {
    nodes: [
      { entityId: ids.itemType, x: 20, y: 20 },
      { entityId: ids.item, x: 340, y: 20 },
      { entityId: ids.monster, x: 20, y: 310 },
      { entityId: ids.monsterDrop, x: 700, y: 150 },
      { entityId: ids.shop, x: 340, y: 470 },
      { entityId: ids.shopItem, x: 700, y: 450 },
    ],
  },
  commandHistory: [],
}

function row(rowId: string, cells: DataRow['cells']): DataRow {
  return { rowId, cells }
}

export const gameCSampleRows: RowsByTable = {
  [ids.itemType]: [
    row('row_game_c_item_type_weapon', { [ids.itemTypeId]: 'weapon', [ids.itemTypeName]: '무기' }),
    row('row_game_c_item_type_consumable', { [ids.itemTypeId]: 'consumable', [ids.itemTypeName]: '소모품' }),
  ],
  [ids.item]: [
    row('row_game_c_item_sword', {
      [ids.itemId]: 'bronze_sword',
      [ids.itemTypeRef]: 'weapon',
      [ids.itemName]: '청동 검',
      [ids.itemPrice]: 1200,
    }),
    row('row_game_c_item_potion', {
      [ids.itemId]: 'small_potion',
      [ids.itemTypeRef]: 'consumable',
      [ids.itemName]: '소형 회복 물약',
      [ids.itemPrice]: 100,
    }),
  ],
  [ids.monster]: [
    row('row_game_c_monster_slime', { [ids.monsterId]: 'slime', [ids.monsterName]: '슬라임', [ids.monsterLevel]: 1 }),
    row('row_game_c_monster_goblin', { [ids.monsterId]: 'goblin', [ids.monsterName]: '고블린', [ids.monsterLevel]: 4 }),
  ],
  [ids.monsterDrop]: [
    row('row_game_c_drop_slime_potion', {
      [ids.dropOrder]: 1,
      [ids.dropMonsterId]: 'slime',
      [ids.dropItemId]: 'small_potion',
      [ids.dropRate]: 0.35,
    }),
    row('row_game_c_drop_goblin_sword', {
      [ids.dropOrder]: 1,
      [ids.dropMonsterId]: 'goblin',
      [ids.dropItemId]: 'bronze_sword',
      [ids.dropRate]: 0.08,
    }),
  ],
  [ids.shop]: [
    row('row_game_c_shop_village', { [ids.shopId]: 'village_shop', [ids.shopName]: '시작 마을 상점' }),
  ],
  [ids.shopItem]: [
    row('row_game_c_shop_item_potion', {
      [ids.shopItemShopId]: 'village_shop',
      [ids.shopItemItemId]: 'small_potion',
      [ids.shopItemPrice]: 120,
    }),
    row('row_game_c_shop_item_sword', {
      [ids.shopItemShopId]: 'village_shop',
      [ids.shopItemItemId]: 'bronze_sword',
      [ids.shopItemPrice]: 1500,
    }),
  ],
}

export const gameCSampleIds = ids
