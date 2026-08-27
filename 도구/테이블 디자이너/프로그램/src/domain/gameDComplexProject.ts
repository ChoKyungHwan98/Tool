import { createRelation, createTable } from './schemaFactories'
import type { RowsByTable, SchemaProject } from './schema'

type SimpleKind = 'string' | 'int32' | 'float' | 'boolean' | 'date' | 'datetime'

interface ColumnSpec {
  readonly name: string
  readonly kind?: SimpleKind
  readonly nullable?: boolean
}

interface TableSpec {
  readonly name: string
  readonly displayName: string
  readonly columns: readonly ColumnSpec[]
  readonly primaryKey: readonly string[]
  readonly tags?: readonly string[]
}

interface RelationSpec {
  readonly sourceTable: string
  readonly sourceColumn: string
  readonly targetTable: string
  readonly targetColumn: string
  readonly required?: boolean
}

function snakeCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

function tableId(tableName: string): string {
  return `table_game_d_${snakeCase(tableName)}`
}

function columnId(tableName: string, columnName: string): string {
  return `column_game_d_${snakeCase(tableName)}_${snakeCase(columnName)}`
}

const tableSpecs: readonly TableSpec[] = [
  { name: 'ItemType', displayName: '아이템 종류', columns: [{ name: 'ItemTypeId' }, { name: 'Name' }], primaryKey: ['ItemTypeId'], tags: ['lookup'] },
  { name: 'ItemRarity', displayName: '아이템 등급', columns: [{ name: 'RarityId' }, { name: 'Name' }, { name: 'SortOrder', kind: 'int32' }], primaryKey: ['RarityId'], tags: ['lookup'] },
  { name: 'Item', displayName: '아이템', columns: [{ name: 'ItemId' }, { name: 'ItemTypeId' }, { name: 'RarityId' }, { name: 'SellCurrencyId' }, { name: 'Name' }, { name: 'BasePrice', kind: 'int32' }], primaryKey: ['ItemId'] },
  { name: 'Currency', displayName: '재화', columns: [{ name: 'CurrencyId' }, { name: 'Name' }, { name: 'MaxAmount', kind: 'int32' }], primaryKey: ['CurrencyId'], tags: ['lookup'] },
  { name: 'CharacterClass', displayName: '캐릭터 직업', columns: [{ name: 'ClassId' }, { name: 'Name' }], primaryKey: ['ClassId'], tags: ['lookup'] },
  { name: 'SkillCategory', displayName: '스킬 분류', columns: [{ name: 'CategoryId' }, { name: 'Name' }], primaryKey: ['CategoryId'], tags: ['lookup'] },
  { name: 'Skill', displayName: '스킬', columns: [{ name: 'SkillId' }, { name: 'ClassId' }, { name: 'CategoryId' }, { name: 'Name' }, { name: 'Cooldown', kind: 'float' }], primaryKey: ['SkillId'] },
  { name: 'SkillCost', displayName: '스킬 비용', columns: [{ name: 'SkillId' }, { name: 'CurrencyId' }, { name: 'Amount', kind: 'int32' }], primaryKey: ['SkillId', 'CurrencyId'], tags: ['junction'] },
  { name: 'MonsterFamily', displayName: '몬스터 종족', columns: [{ name: 'FamilyId' }, { name: 'Name' }], primaryKey: ['FamilyId'], tags: ['lookup'] },
  { name: 'Monster', displayName: '몬스터', columns: [{ name: 'MonsterId' }, { name: 'FamilyId' }, { name: 'RegionId' }, { name: 'HomeStageId' }, { name: 'Name' }, { name: 'Level', kind: 'int32' }], primaryKey: ['MonsterId'] },
  { name: 'MonsterDrop', displayName: '몬스터 드롭', columns: [{ name: 'MonsterId' }, { name: 'ItemId' }, { name: 'DropRate', kind: 'float' }, { name: 'MinCount', kind: 'int32' }, { name: 'MaxCount', kind: 'int32' }], primaryKey: ['MonsterId', 'ItemId'], tags: ['junction'] },
  { name: 'Region', displayName: '지역', columns: [{ name: 'RegionId' }, { name: 'Name' }, { name: 'RecommendedLevel', kind: 'int32' }], primaryKey: ['RegionId'], tags: ['lookup'] },
  { name: 'Stage', displayName: '스테이지', columns: [{ name: 'StageId' }, { name: 'RegionId' }, { name: 'Name' }, { name: 'EntryLevel', kind: 'int32' }], primaryKey: ['StageId'] },
  { name: 'StageMonster', displayName: '스테이지 몬스터', columns: [{ name: 'StageId' }, { name: 'MonsterId' }, { name: 'SpawnCount', kind: 'int32' }, { name: 'Weight', kind: 'float' }], primaryKey: ['StageId', 'MonsterId'], tags: ['junction'] },
  { name: 'NPC', displayName: 'NPC', columns: [{ name: 'NpcId' }, { name: 'RegionId' }, { name: 'Name' }, { name: 'Role' }], primaryKey: ['NpcId'] },
  { name: 'Quest', displayName: '퀘스트', columns: [{ name: 'QuestId' }, { name: 'GiverNpcId' }, { name: 'StageId' }, { name: 'Name' }, { name: 'RequiredLevel', kind: 'int32' }], primaryKey: ['QuestId'] },
  { name: 'QuestPrerequisite', displayName: '퀘스트 선행 조건', columns: [{ name: 'QuestId' }, { name: 'RequiredQuestId' }], primaryKey: ['QuestId', 'RequiredQuestId'], tags: ['junction'] },
  { name: 'QuestReward', displayName: '퀘스트 보상', columns: [{ name: 'QuestId' }, { name: 'RewardSlot', kind: 'int32' }, { name: 'ItemId', nullable: true }, { name: 'CurrencyId', nullable: true }, { name: 'Amount', kind: 'int32' }], primaryKey: ['QuestId', 'RewardSlot'], tags: ['junction'] },
  { name: 'Shop', displayName: '상점', columns: [{ name: 'ShopId' }, { name: 'KeeperNpcId' }, { name: 'RegionId' }, { name: 'DefaultCurrencyId' }, { name: 'Name' }], primaryKey: ['ShopId'] },
  { name: 'ShopItem', displayName: '상점 판매 품목', columns: [{ name: 'ShopId' }, { name: 'ItemId' }, { name: 'CurrencyId' }, { name: 'Price', kind: 'int32' }, { name: 'PurchaseLimit', kind: 'int32', nullable: true }], primaryKey: ['ShopId', 'ItemId', 'CurrencyId'], tags: ['junction'] },
  { name: 'Recipe', displayName: '제작법', columns: [{ name: 'RecipeId' }, { name: 'ResultItemId' }, { name: 'ResultCount', kind: 'int32' }, { name: 'CraftTime', kind: 'float' }], primaryKey: ['RecipeId'] },
  { name: 'RecipeMaterial', displayName: '제작 재료', columns: [{ name: 'RecipeId' }, { name: 'ItemId' }, { name: 'Quantity', kind: 'int32' }], primaryKey: ['RecipeId', 'ItemId'], tags: ['junction'] },
  { name: 'EquipmentSet', displayName: '장비 세트', columns: [{ name: 'SetId' }, { name: 'Name' }, { name: 'BonusDescription' }], primaryKey: ['SetId'] },
  { name: 'EquipmentSetItem', displayName: '장비 세트 구성', columns: [{ name: 'SetId' }, { name: 'ItemId' }, { name: 'Required', kind: 'boolean' }], primaryKey: ['SetId', 'ItemId'], tags: ['junction'] },
  { name: 'Dialogue', displayName: '대화', columns: [{ name: 'DialogueId' }, { name: 'NpcId' }, { name: 'QuestId', nullable: true }, { name: 'Sequence', kind: 'int32' }, { name: 'TextKey' }], primaryKey: ['DialogueId'] },
] as const

const relationSpecs: readonly RelationSpec[] = [
  { sourceTable: 'Item', sourceColumn: 'ItemTypeId', targetTable: 'ItemType', targetColumn: 'ItemTypeId' },
  { sourceTable: 'Item', sourceColumn: 'RarityId', targetTable: 'ItemRarity', targetColumn: 'RarityId' },
  { sourceTable: 'Item', sourceColumn: 'SellCurrencyId', targetTable: 'Currency', targetColumn: 'CurrencyId' },
  { sourceTable: 'Skill', sourceColumn: 'ClassId', targetTable: 'CharacterClass', targetColumn: 'ClassId' },
  { sourceTable: 'Skill', sourceColumn: 'CategoryId', targetTable: 'SkillCategory', targetColumn: 'CategoryId' },
  { sourceTable: 'SkillCost', sourceColumn: 'SkillId', targetTable: 'Skill', targetColumn: 'SkillId' },
  { sourceTable: 'SkillCost', sourceColumn: 'CurrencyId', targetTable: 'Currency', targetColumn: 'CurrencyId' },
  { sourceTable: 'Monster', sourceColumn: 'FamilyId', targetTable: 'MonsterFamily', targetColumn: 'FamilyId' },
  { sourceTable: 'Monster', sourceColumn: 'RegionId', targetTable: 'Region', targetColumn: 'RegionId' },
  { sourceTable: 'Monster', sourceColumn: 'HomeStageId', targetTable: 'Stage', targetColumn: 'StageId' },
  { sourceTable: 'MonsterDrop', sourceColumn: 'MonsterId', targetTable: 'Monster', targetColumn: 'MonsterId' },
  { sourceTable: 'MonsterDrop', sourceColumn: 'ItemId', targetTable: 'Item', targetColumn: 'ItemId' },
  { sourceTable: 'Stage', sourceColumn: 'RegionId', targetTable: 'Region', targetColumn: 'RegionId' },
  { sourceTable: 'StageMonster', sourceColumn: 'StageId', targetTable: 'Stage', targetColumn: 'StageId' },
  { sourceTable: 'StageMonster', sourceColumn: 'MonsterId', targetTable: 'Monster', targetColumn: 'MonsterId' },
  { sourceTable: 'NPC', sourceColumn: 'RegionId', targetTable: 'Region', targetColumn: 'RegionId' },
  { sourceTable: 'Quest', sourceColumn: 'GiverNpcId', targetTable: 'NPC', targetColumn: 'NpcId' },
  { sourceTable: 'Quest', sourceColumn: 'StageId', targetTable: 'Stage', targetColumn: 'StageId' },
  { sourceTable: 'QuestPrerequisite', sourceColumn: 'QuestId', targetTable: 'Quest', targetColumn: 'QuestId' },
  { sourceTable: 'QuestPrerequisite', sourceColumn: 'RequiredQuestId', targetTable: 'Quest', targetColumn: 'QuestId' },
  { sourceTable: 'QuestReward', sourceColumn: 'QuestId', targetTable: 'Quest', targetColumn: 'QuestId' },
  { sourceTable: 'QuestReward', sourceColumn: 'ItemId', targetTable: 'Item', targetColumn: 'ItemId', required: false },
  { sourceTable: 'QuestReward', sourceColumn: 'CurrencyId', targetTable: 'Currency', targetColumn: 'CurrencyId', required: false },
  { sourceTable: 'Shop', sourceColumn: 'KeeperNpcId', targetTable: 'NPC', targetColumn: 'NpcId' },
  { sourceTable: 'Shop', sourceColumn: 'RegionId', targetTable: 'Region', targetColumn: 'RegionId' },
  { sourceTable: 'Shop', sourceColumn: 'DefaultCurrencyId', targetTable: 'Currency', targetColumn: 'CurrencyId' },
  { sourceTable: 'ShopItem', sourceColumn: 'ShopId', targetTable: 'Shop', targetColumn: 'ShopId' },
  { sourceTable: 'ShopItem', sourceColumn: 'ItemId', targetTable: 'Item', targetColumn: 'ItemId' },
  { sourceTable: 'ShopItem', sourceColumn: 'CurrencyId', targetTable: 'Currency', targetColumn: 'CurrencyId' },
  { sourceTable: 'Recipe', sourceColumn: 'ResultItemId', targetTable: 'Item', targetColumn: 'ItemId' },
  { sourceTable: 'RecipeMaterial', sourceColumn: 'RecipeId', targetTable: 'Recipe', targetColumn: 'RecipeId' },
  { sourceTable: 'RecipeMaterial', sourceColumn: 'ItemId', targetTable: 'Item', targetColumn: 'ItemId' },
  { sourceTable: 'EquipmentSetItem', sourceColumn: 'SetId', targetTable: 'EquipmentSet', targetColumn: 'SetId' },
  { sourceTable: 'EquipmentSetItem', sourceColumn: 'ItemId', targetTable: 'Item', targetColumn: 'ItemId' },
  { sourceTable: 'Dialogue', sourceColumn: 'NpcId', targetTable: 'NPC', targetColumn: 'NpcId' },
  { sourceTable: 'Dialogue', sourceColumn: 'QuestId', targetTable: 'Quest', targetColumn: 'QuestId', required: false },
] as const

const tables = tableSpecs.map((spec) => createTable({
  tableId: tableId(spec.name),
  name: spec.name,
  displayName: spec.displayName,
  description: `${spec.displayName} 데이터를 관리합니다.`,
  tags: spec.tags,
  columns: spec.columns.map((column) => ({
    columnId: columnId(spec.name, column.name),
    name: column.name,
    dataType: { kind: column.kind ?? 'string' },
    nullable: column.nullable ?? false,
  })),
  primaryKeyColumnIds: spec.primaryKey.map((name) => columnId(spec.name, name)),
}))

const relations = relationSpecs.map((spec) => createRelation({
  relationId: `relation_game_d_${snakeCase(spec.sourceTable)}_${snakeCase(spec.sourceColumn)}`,
  name: `${spec.sourceTable}.${spec.sourceColumn} -> ${spec.targetTable}.${spec.targetColumn}`,
  sourceTableId: tableId(spec.sourceTable),
  sourceColumnIds: [columnId(spec.sourceTable, spec.sourceColumn)],
  targetTableId: tableId(spec.targetTable),
  targetColumnIds: [columnId(spec.targetTable, spec.targetColumn)],
  required: spec.required ?? true,
}))

export const gameDComplexProject: SchemaProject = {
  projectId: 'project_game_d_complex_layout',
  name: '게임 D (대규모 자동 배치 검증)',
  schemaVersion: '0.1.0',
  tables,
  enums: [],
  relations,
  functionalDependencies: [],
  exportViews: [],
  layout: {
    nodes: tables.map((table, index) => ({
      entityId: table.tableId,
      x: (index % 5) * 156 + (index % 2) * 44,
      y: Math.floor(index / 5) * 112 + (index % 3) * 36,
    })),
  },
  commandHistory: [],
}

export const gameDComplexRows: RowsByTable = {}

export const gameDComplexIds = {
  item: tableId('Item'),
  quest: tableId('Quest'),
  shopItem: tableId('ShopItem'),
} as const
