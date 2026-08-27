import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repoRoot, 'examples', 'astrae-case001-combat')
const csvRoot = path.join(outputRoot, 'export', 'csv')
const jsonRoot = path.join(outputRoot, 'export', 'json')

const snake = (value) => value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()
const tableId = (key) => `tbl_combat_${snake(key)}`
const columnId = (tableKey, columnKey) => `col_combat_${snake(tableKey)}_${snake(columnKey)}`

const enumDefinitions = [
  ['BattleType', [['Boss', '보스전']]],
  ['VictoryConditionType', [['BossDefeat', '보스 격파']]],
  ['DefeatConditionType', [['PartyDefeat', '파티 전멸']]],
  ['ActionType', [
    ['NormalAttack', '일반공격'],
    ['SkillAttack', '스킬공격'],
    ['SwapAttack', '교대 공격'],
    ['Response', '대응 행동'],
    ['Ultimate', '영지선언(궁극기)'],
  ]],
  ['TelegraphType', [
    ['None', '예고 없음'],
    ['Single', '단일 대상'],
    ['Line', '직선'],
    ['Circle', '원형 범위'],
    ['Wide', '광역'],
  ]],
  ['TargetType', [
    ['EnemySingle', '적 단일'],
    ['Self', '자신'],
    ['PlayerSingle', '플레이어 단일'],
    ['PlayerAll', '플레이어 전체'],
  ]],
  ['BreakTriggerType', [['GaugeZero', 'BREAK Gauge 0']]],
  ['BreakGaugeResetTiming', [['NextTurnStart', '다음 Turn 시작']]],
]

const enums = enumDefinitions.map(([name, values]) => ({
  enumId: `enum_combat_${snake(name)}`,
  name,
  values: values.map(([valueName, displayName]) => ({
    enumValueId: `enum_value_combat_${snake(name)}_${snake(valueName)}`,
    name: valueName,
    displayName,
  })),
}))

const enumId = (name) => `enum_combat_${snake(name)}`

const tableDefinitions = [
  {
    key: 'CombatRule',
    name: 'CombatRuleTable',
    displayName: '전투 규칙',
    description: 'CASE_001 전투가 따르는 공통 턴·AP·행동 예고·BREAK 발생 규칙이다.',
    tags: ['전투', '규칙'],
    columns: [
      ['id', 'id', 'ID', '전투 규칙 행의 숫자형 단일 PK.', 'int32'],
      ['name', 'name', '이름', '기획자가 전투 규칙을 식별하기 위한 편의 이름.', 'string'],
      ['partySize', 'maxPartySize', '최대 파티 인원', '정식 전투 규칙이 허용하는 최대 파티 인원. 현재 목업 캐릭터는 1명이다.', 'int32'],
      ['turnStartAp', 'turnStartAp', '턴 시작 AP', '플레이어 Turn 시작 시 지급되는 공용 AP.', 'int32'],
      ['enemyIntentCount', 'enemyIntentCount', '적 행동 예고 수', '적 Turn에 표시할 행동 예고 슬롯 수.', 'int32'],
      ['breakTriggerType', 'breakTriggerType', 'BREAK 발생 조건', '모든 적에게 공통 적용할 BREAK 발생 조건.', 'enum', false, 'BreakTriggerType'],
      ['breakEnemyActionReduction', 'breakEnemyActionReduction', 'BREAK 적 행동 감소 수', 'BREAK 발생 Turn에 줄어드는 적 행동 예고·실행 수. Prototype 임의 규칙.', 'int32'],
      ['breakGaugeResetTiming', 'breakGaugeResetTiming', 'BREAK Gauge 초기화 시점', 'BREAK 이후 Gauge를 최대치로 되돌리는 시점. Prototype 임의 규칙.', 'enum', false, 'BreakGaugeResetTiming'],
    ],
    primaryKey: ['id'],
  },
  {
    key: 'Battle',
    name: 'BattleTable',
    displayName: '난이도별 전투',
    description: '콘텐츠 프로젝트의 CaseDifficultyTable.id와 전투 규칙·보스·보정 배율을 직접 연결한다.',
    tags: ['전투', '진입점'],
    columns: [
      ['id', 'id', 'ID', '전투 행의 숫자형 단일 PK.', 'int32'],
      ['caseDifficultyId', 'caseDifficultyId', 'CASE 난이도 ID', '콘텐츠 프로젝트 CaseDifficultyTable.id. 프로젝트 간 계약값이다.', 'int32'],
      ['battleType', 'battleType', '전투 유형', '보스전 등 전투 분류.', 'enum', false, 'BattleType'],
      ['combatRuleId', 'combatRuleId', '전투 규칙 ID', '적용할 CombatRuleTable.id.', 'int32'],
      ['bossId', 'bossId', '보스 ID', '등장할 BossTable.id.', 'int32'],
      ['bossHpMultiplier', 'bossHpMultiplier', '보스 HP 배율', 'BossTable의 기본 HP에 곱하는 난이도별 Prototype 배율.', 'float'],
      ['bossDamageMultiplier', 'bossDamageMultiplier', '보스 공격 배율', 'BossActionTable의 공격 계수에 곱하는 난이도별 Prototype 배율.', 'float'],
      ['breakGaugeMultiplier', 'breakGaugeMultiplier', 'BREAK Gauge 배율', 'BossTable의 기본 BREAK Gauge에 곱하는 난이도별 Prototype 배율.', 'float'],
      ['victoryConditionType', 'victoryConditionType', '승리 조건', '전투 승리 판정 유형.', 'enum', false, 'VictoryConditionType'],
      ['defeatConditionType', 'defeatConditionType', '패배 조건', '전투 패배 판정 유형.', 'enum', false, 'DefeatConditionType'],
    ],
    primaryKey: ['id'],
    unique: [['caseDifficultyId']],
  },
  {
    key: 'Character',
    name: 'CharacterTable',
    displayName: '캐릭터 전투 정보',
    description: '플레이어블 캐릭터의 전투용 기본 수치를 관리한다. 현재 수치는 기능 검증용 가안이다.',
    tags: ['캐릭터', '전투 수치'],
    columns: [
      ['id', 'id', 'ID', '캐릭터 행의 숫자형 단일 PK.', 'int32'],
      ['name', 'name', '이름', '기획자가 캐릭터를 식별하기 위한 편의 이름.', 'string'],
      ['maxHp', 'maxHp', '최대 HP', '기능 목업용 최대 HP 가안.', 'int32'],
      ['maxUltimateGauge', 'maxUltimateGauge', '최대 궁극기 Gauge', '영지선언 사용에 필요한 Gauge 최대값 가안.', 'int32'],
    ],
    primaryKey: ['id'],
  },
  {
    key: 'CharacterAction',
    name: 'CharacterActionTable',
    displayName: '캐릭터 행동',
    description: '마미야 리츠가 사용할 일반공격·스킬·교대·대응·영지선언 데이터를 관리한다.',
    tags: ['캐릭터', '행동'],
    columns: [
      ['id', 'id', 'ID', '캐릭터 행동 행의 숫자형 단일 PK.', 'int32'],
      ['characterId', 'characterId', '캐릭터 ID', '행동을 소유한 CharacterTable.id.', 'int32'],
      ['name', 'name', '이름', '기획자가 행동을 식별하기 위한 편의 이름.', 'string'],
      ['actionType', 'actionType', '행동 유형', '일반공격·스킬·교대·대응·영지선언 구분.', 'enum', false, 'ActionType'],
      ['targetType', 'targetType', '대상 유형', '행동을 적용할 대상.', 'enum', false, 'TargetType'],
      ['apCost', 'apCost', 'AP 비용', '행동을 사용할 때 소비하는 공용 AP. 현재 값은 기능 목업용 가안이다.', 'int32'],
      ['cooldownRound', 'cooldownRound', 'Round 쿨다운', '재사용 대기 Round 수. 적용되지 않으면 0.', 'int32'],
      ['hpPower', 'hpDamage', 'HP 피해', 'Unity 기능 목업에서 적 HP에 직접 적용할 고정 피해.', 'int32'],
      ['breakPower', 'breakDamage', 'BREAK 피해', '적 BREAK Gauge에 직접 적용할 고정 피해.', 'int32'],
      ['ultimateGaugeGain', 'ultimateGaugeGain', '궁극기 Gauge 획득', '공격 행동 적중 시 얻는 Gauge 가안.', 'int32'],
      ['cancelsCurrentEnemyAction', 'cancelsCurrentEnemyAction', '현재 적 행동 취소', '대응 창에서 사용했을 때 현재 해결 중인 적 행동 1개를 취소하는가.', 'boolean'],
      ['isImplemented', 'isImplemented', '구현 여부', '현재 NORMAL 전투 목업에서 실제 사용할 수 있는 행동인지 여부.', 'boolean'],
      ['unityActionKey', 'unityActionKey', 'Unity 행동 키', 'Unity가 실제 행동 코드를 찾기 위한 키.', 'string'],
    ],
    primaryKey: ['id'],
    unique: [['unityActionKey']],
  },
  {
    key: 'Boss',
    name: 'BossTable',
    displayName: '보스 전투 정보',
    description: 'CASE_001 보스의 HP Bar·BREAK와 Unity HFSM 연결 키를 관리한다.',
    tags: ['보스', 'HFSM 연결'],
    columns: [
      ['id', 'id', 'ID', '보스 행의 숫자형 단일 PK.', 'int32'],
      ['name', 'name', '이름', '기획자가 보스를 식별하기 위한 편의 이름.', 'string'],
      ['hpPerBar', 'hpPerBar', 'HP Bar당 HP', '기능 목업용 HP 가안.', 'int32'],
      ['hpBarCount', 'hpBarCount', 'HP Bar 개수', '×N으로 표시할 HP Bar 수 가안.', 'int32'],
      ['breakGaugeMax', 'breakGaugeMax', 'BREAK Gauge 최대값', '기능 목업용 BREAK Gauge 가안.', 'int32'],
      ['hfsmControllerKey', 'hfsmControllerKey', 'Unity HFSM 키', 'Unity에서 생성할 보스 HFSM Controller 키.', 'string'],
    ],
    primaryKey: ['id'],
    unique: [['hfsmControllerKey']],
  },
  {
    key: 'BossAction',
    name: 'BossActionTable',
    displayName: '보스 행동',
    description: 'Unity HFSM이 ID로 선택하고 실행할 보스 행동과 목업 수치를 관리한다.',
    tags: ['보스', '행동'],
    columns: [
      ['id', 'id', 'ID', '보스 행동 행의 숫자형 단일 PK.', 'int32'],
      ['bossId', 'bossId', '보스 ID', '행동을 소유한 BossTable.id.', 'int32'],
      ['name', 'name', '이름', '기획자가 보스 행동을 식별하기 위한 편의 이름.', 'string'],
      ['telegraphType', 'telegraphType', '예고 형태', '적 행동 예고와 공격 범위 표시 방식.', 'enum', false, 'TelegraphType'],
      ['targetType', 'targetType', '대상 유형', '행동 적용 대상.', 'enum', false, 'TargetType'],
      ['hpPower', 'hpDamage', 'HP 피해', 'Unity 기능 목업에서 대상 HP에 직접 적용할 고정 피해.', 'int32'],
      ['responseWindowMs', 'responseWindowMs', '대응 시간(ms)', '방어·패링 계열 대응을 입력할 수 있는 Unity 목업용 시간 가안.', 'int32'],
      ['selectionWeight', 'selectionWeight', '선택 가중치', '현재 단일 패턴 HFSM에서 행동을 선택할 상대 가중치.', 'int32'],
      ['unityActionKey', 'unityActionKey', 'Unity 행동 키', 'Unity가 실제 보스 행동 코드를 찾기 위한 키.', 'string'],
    ],
    primaryKey: ['id'],
    unique: [['unityActionKey']],
  },
]

function makeColumn(tableKey, definition) {
  const [key, name, displayName, description, kind, nullable = false, enumName] = definition
  return {
    key,
    value: {
      columnId: columnId(tableKey, key),
      tableId: tableId(tableKey),
      name,
      displayName,
      description,
      dataType: kind === 'enum' ? { kind, enumId: enumId(enumName) } : { kind },
      nullable,
      validationRules: [],
      deprecated: false,
    },
  }
}

const tables = tableDefinitions.map((definition) => {
  const columns = definition.columns.map((column) => makeColumn(definition.key, column))
  return {
    tableId: tableId(definition.key),
    name: definition.name,
    displayName: definition.displayName,
    description: definition.description,
    columns: columns.map((column) => column.value),
    primaryKey: { columnIds: definition.primaryKey.map((key) => columnId(definition.key, key)) },
    uniqueConstraints: (definition.unique ?? []).map((keys, index) => ({
      constraintId: `unique_combat_${snake(definition.key)}_${index + 1}`,
      name: `UQ_${definition.name}_${keys.join('_')}`,
      columnIds: keys.map((key) => columnId(definition.key, key)),
    })),
    checkConstraints: [],
    tags: definition.tags,
    authoringOnly: false,
    runtimeOnly: false,
  }
})

const relation = (key, name, sourceTable, sourceColumn, targetTable, targetColumn, required = true) => ({
  relationId: `rel_combat_${snake(key)}`,
  name,
  kind: 'hard_fk',
  sourceTableId: tableId(sourceTable),
  sourceColumnIds: [columnId(sourceTable, sourceColumn)],
  targetTableId: tableId(targetTable),
  targetColumnIds: [columnId(targetTable, targetColumn)],
  required,
})

const relations = [
  relation('battle_rule', 'Battle uses CombatRule', 'Battle', 'combatRuleId', 'CombatRule', 'id'),
  relation('battle_boss', 'Battle uses Boss', 'Battle', 'bossId', 'Boss', 'id'),
  relation('character_action', 'CharacterAction belongs to Character', 'CharacterAction', 'characterId', 'Character', 'id'),
  relation('boss_action', 'BossAction belongs to Boss', 'BossAction', 'bossId', 'Boss', 'id'),
]

const layout = {
  nodes: [
    { entityId: tableId('CombatRule'), x: 20, y: 20 },
    { entityId: tableId('Battle'), x: 450, y: 20 },
    { entityId: tableId('Boss'), x: 900, y: 20 },
    { entityId: tableId('BossAction'), x: 900, y: 600 },
    { entityId: tableId('Character'), x: 20, y: 600 },
    { entityId: tableId('CharacterAction'), x: 450, y: 600 },
  ],
}

const project = {
  projectId: 'proj_astrae_case001_combat',
  name: '아스트라에 오라티오 CASE_001 전투·캐릭터 데이터',
  schemaVersion: '6.2.0',
  tables,
  enums,
  relations,
  functionalDependencies: [],
  exportViews: [],
  layout,
  commandHistory: [],
}

const row = (tableKey, rowId, values) => ({
  rowId,
  cells: Object.fromEntries(Object.entries(values).map(([key, value]) => [columnId(tableKey, key), value])),
})

const rowsByTable = {
  [tableId('CombatRule')]: [
    row('CombatRule', 'row_rule_case001', {
      id: 2010001,
      name: 'CASE_001 공통 전투 규칙',
      partySize: 3,
      turnStartAp: 3,
      enemyIntentCount: 3,
      breakTriggerType: 'GaugeZero',
      breakEnemyActionReduction: 1,
      breakGaugeResetTiming: 'NextTurnStart',
    }),
  ],
  [tableId('Battle')]: [
    row('Battle', 'row_battle_case001_easy', {
      id: 2030001,
      caseDifficultyId: 1050001,
      battleType: 'Boss',
      combatRuleId: 2010001,
      bossId: 2060001,
      bossHpMultiplier: 0.8,
      bossDamageMultiplier: 0.85,
      breakGaugeMultiplier: 0.85,
      victoryConditionType: 'BossDefeat',
      defeatConditionType: 'PartyDefeat',
    }),
    row('Battle', 'row_battle_case001_normal', {
      id: 2030002,
      caseDifficultyId: 1050002,
      battleType: 'Boss',
      combatRuleId: 2010001,
      bossId: 2060001,
      bossHpMultiplier: 1,
      bossDamageMultiplier: 1,
      breakGaugeMultiplier: 1,
      victoryConditionType: 'BossDefeat',
      defeatConditionType: 'PartyDefeat',
    }),
    row('Battle', 'row_battle_case001_hard', {
      id: 2030003,
      caseDifficultyId: 1050003,
      battleType: 'Boss',
      combatRuleId: 2010001,
      bossId: 2060001,
      bossHpMultiplier: 1.35,
      bossDamageMultiplier: 1.25,
      breakGaugeMultiplier: 1.2,
      victoryConditionType: 'BossDefeat',
      defeatConditionType: 'PartyDefeat',
    }),
  ],
  [tableId('Character')]: [
    row('Character', 'row_character_mamiya_ritsu', {
      id: 2040001,
      name: '마미야 리츠',
      maxHp: 2400,
      maxUltimateGauge: 100,
    }),
  ],
  [tableId('CharacterAction')]: [
    row('CharacterAction', 'row_action_ritsu_normal', {
      id: 2050001, characterId: 2040001, name: '일반공격',
      actionType: 'NormalAttack', targetType: 'EnemySingle', apCost: 1, cooldownRound: 0, hpPower: 100, breakPower: 20,
      ultimateGaugeGain: 10, cancelsCurrentEnemyAction: false, isImplemented: true, unityActionKey: 'RitsuNormalAttack',
    }),
    row('CharacterAction', 'row_action_ritsu_skill', {
      id: 2050002, characterId: 2040001, name: '경계 조정',
      actionType: 'SkillAttack', targetType: 'EnemySingle', apCost: 1, cooldownRound: 3, hpPower: 165, breakPower: 45,
      ultimateGaugeGain: 15, cancelsCurrentEnemyAction: false, isImplemented: true, unityActionKey: 'RitsuSkillAttack',
    }),
    row('CharacterAction', 'row_action_ritsu_swap', {
      id: 2050003, characterId: 2040001, name: '교대 공격',
      actionType: 'SwapAttack', targetType: 'EnemySingle', apCost: 1, cooldownRound: 0, hpPower: 110, breakPower: 25,
      ultimateGaugeGain: 10, cancelsCurrentEnemyAction: false, isImplemented: false, unityActionKey: 'RitsuSwapAttack',
    }),
    row('CharacterAction', 'row_action_ritsu_response', {
      id: 2050004, characterId: 2040001, name: '회피',
      actionType: 'Response', targetType: 'Self', apCost: 1, cooldownRound: 0, hpPower: 0, breakPower: 0,
      ultimateGaugeGain: 0, cancelsCurrentEnemyAction: true, isImplemented: true, unityActionKey: 'RitsuResponse',
    }),
    row('CharacterAction', 'row_action_ritsu_ultimate', {
      id: 2050005, characterId: 2040001, name: '영지선언',
      actionType: 'Ultimate', targetType: 'EnemySingle', apCost: 1, cooldownRound: 0, hpPower: 320, breakPower: 90,
      ultimateGaugeGain: 0, cancelsCurrentEnemyAction: false, isImplemented: true, unityActionKey: 'RitsuUltimate',
    }),
  ],
  [tableId('Boss')]: [
    row('Boss', 'row_boss_case001', {
      id: 2060001,
      name: '영지 결정에 불복하는 마법사 A',
      hpPerBar: 1000,
      hpBarCount: 2,
      breakGaugeMax: 300,
      hfsmControllerKey: 'BossCase001Hfsm',
    }),
  ],
  [tableId('BossAction')]: [
    row('BossAction', 'row_boss_action_magic_bolt', {
      id: 2070001, bossId: 2060001, name: '마력탄',
      telegraphType: 'Single', targetType: 'PlayerSingle', hpPower: 120, responseWindowMs: 850,
      selectionWeight: 50, unityActionKey: 'BossMagicBolt',
    }),
    row('BossAction', 'row_boss_action_magic_volley', {
      id: 2070002, bossId: 2060001, name: '연속 마력탄',
      telegraphType: 'Single', targetType: 'PlayerSingle', hpPower: 155, responseWindowMs: 700,
      selectionWeight: 30, unityActionKey: 'BossMagicVolley',
    }),
    row('BossAction', 'row_boss_action_magic_burst', {
      id: 2070003, bossId: 2060001, name: '광역 마력 폭발',
      telegraphType: 'Wide', targetType: 'PlayerAll', hpPower: 95, responseWindowMs: 950,
      selectionWeight: 20, unityActionKey: 'BossMagicBurst',
    }),
  ],
}

const document = {
  formatVersion: 2,
  revision: 0,
  schema: project,
  rowsByTable,
  workbookViews: {},
  migrationState: { pending: [], unresolvedRows: [] },
  auditLog: [],
}

function nameKeyedRows(table) {
  return (rowsByTable[table.tableId] ?? []).map((dataRow) => Object.fromEntries(
    table.columns.map((column) => [column.name, dataRow.cells[column.columnId] ?? null]),
  ))
}

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function tableCsv(table) {
  const header = table.columns.map((column) => csvCell(column.name)).join(',')
  const body = nameKeyedRows(table).map((dataRow) => table.columns.map((column) => csvCell(dataRow[column.name])).join(','))
  return [header, ...body].join('\n')
}

const runtimeBundle = {
  schemaVersion: project.schemaVersion,
  sourceProject: 'Astrae-Oratio-CASE001-Combat.gsw',
  note: 'NORMAL 전투 기능 목업용 Prototype 수치다. EASY/HARD 행은 확장용으로 유지하며 현재 Unity에서 진입하지 않는다.',
  ...Object.fromEntries(tables.map((table) => [table.name, nameKeyedRows(table)])),
}

const readme = `# 아스트라에 오라티오 CASE_001 전투·캐릭터 데이터

## 역할

이 프로젝트는 콘텐츠 프로젝트의 난이도 ID 3개를 공통 전투 규칙, 공통 BREAK 규칙, 마미야 리츠와 단순 마법사 보스 행동 데이터로 연결한다.

- Authoring 정본: \`Astrae-Oratio-CASE001-Combat.gsw\`
- Unity 권장 입력: \`export/json/AstraeCase001CombatData.json\`
- 테이블별 쉬운 설명: \`COMBAT_DATA_GUIDE.md\`
- HFSM 최소 계약·후속 범위: \`BOSS_CASE001_HFSM_DESIGN.md\`
- 콘텐츠 연결 키: \`CaseDifficultyTable.id\` 1050001·1050002·1050003
- Unity HFSM 연결 키: \`BossCase001Hfsm\`

## ID 규칙

- 모든 테이블의 첫 열 \`id\`는 다른 테이블과도 겹치지 않는 숫자형 단일 PK다.
- 예: \`2010001\` = 전투 프로젝트(2) + CombatRuleTable(01) + 첫 행(0001)
- FK도 대상 행의 전체 숫자 ID를 그대로 사용한다.

## 책임 분리

- Table Designer: AP, HP, 공통 BREAK 발생 조건·적 행동 감소·Gauge 초기화 시점, 행동 ID, 수치와 행동 가중치
- 후속 Unity HFSM: 보스 행동 3개 선택·예고·실행 순서
- 공통 Battle Controller: BREAK 발생과 이후 공통 처리
- Unity Action Code: 피해 계산, 애니메이션과 VFX

## 정규화 기준

- \`name\`은 기획자가 숫자 ID의 대상을 확인하기 위한 편의값이다.
- \`BattleTable.caseDifficultyId\`는 콘텐츠 프로젝트와의 연결, \`unityActionKey\`와 \`hfsmControllerKey\`는 Unity 실행 연결에 실제로 사용하므로 유지한다.
- 설명·근거 상태·미확정 연결 키는 실행 데이터에서 제거하고 본 문서에서 관리한다.

## 난이도 처리

- \`BattleTable\`의 각 행은 콘텐츠 \`CaseDifficultyTable.id\` 하나와 직접 연결된다.
- 세 난이도는 같은 \`BossTable\`과 \`CombatRuleTable\`을 재사용한다.
- HP·공격력·BREAK Gauge만 배율로 조정하므로 보스 행동표와 HFSM을 복제하지 않는다.
- EASY/HARD 행은 확장용으로 유지하지만 콘텐츠의 \`isImplemented=false\`이므로 현재 Unity에서는 진입하지 않는다.
- NORMAL(1050002)만 현재 Unity 구현 대상이다.

## 수치 주의

캐릭터·보스·행동 수치와 난이도 배율은 기능 목업을 위한 가안이다. Unity가 계산식을 추측하지 않도록 \`hpDamage\`와 \`breakDamage\`는 고정 피해로 사용한다. 회피 AP 1·현재 적 행동 1개 취소와 BREAK 시 적 행동 1개 감소·다음 Turn Gauge 초기화도 목업용 결정이며 공식 규칙이 아니다.
`

const combatGuide = `# CASE_001 전투 데이터 설명서

## 전체 연결

\`CaseDifficultyTable.id → BattleTable.caseDifficultyId → CombatRuleTable / BossTable → 행동 테이블 → Unity HFSM\`

콘텐츠 프로젝트가 고른 난이도 ID를 전투 프로젝트가 그대로 받는다. 현재 Unity는 NORMAL의 \`1050002\`만 실행한다. EASY \`1050001\`과 HARD \`1050003\`은 향후 확장용 데이터다.

## 1. CombatRuleTable

전투 전체가 공유하는 규칙이다. 최대 파티는 3명, Turn 시작 AP는 3, 적 행동 예고는 3개다. 현재 목업 캐릭터는 한 명뿐이므로 \`maxPartySize=3\`은 최대 허용 인원을 뜻한다.

BREAK Gauge가 0이 되면 BREAK가 발생한다는 공통 조건도 이 테이블에서 관리한다. BREAK가 발생한 Turn에는 적 행동 예고와 실제 실행 수를 1개 줄이고, 다음 Turn 시작 시 Gauge를 최대치로 초기화한다. 세 난이도 전투가 같은 CombatRule 행을 공유하므로 BREAK는 보스 전용이 아니라 공통 규칙이다. 이 행동 감소·초기화 규칙은 공식 자료에서 확인된 내용이 아니라 목업의 전략성을 검증하기 위한 Prototype 임의 설정이다.

## 2. BattleTable

콘텐츠 난이도 한 행을 실제 전투 규칙과 보스에 연결하는 전투 입구다. 세 난이도 데이터는 같은 보스와 HFSM을 재사용하고 배율만 다르다. 현재 진입 가능한 행은 NORMAL에 연결된 \`2030002\`다.

## 3. CharacterTable

플레이어 캐릭터의 기본 HP와 영지선언 Gauge 최대값을 관리한다. 현재는 확정된 마미야 리츠 한 명만 있다.

## 4. CharacterActionTable

캐릭터가 사용할 행동과 AP·쿨다운·고정 HP/BREAK 피해를 관리한다. 회피는 대응 창에서 AP 1을 소비하고 현재 적 행동 1개를 취소한다. 이 여부는 \`cancelsCurrentEnemyAction\`으로 명시한다. \`unityActionKey\`로 Unity 행동 코드를 찾으며, 두 번째 캐릭터가 없으므로 교대 공격만 \`isImplemented=false\`다.

## 5. BossTable

보스의 HP Bar, BREAK Gauge, Unity HFSM 키를 관리한다. 보스는 영지 결정에 불복한 단순 마법사 A이며 경계 마법이나 전용 BREAK 규칙을 사용하지 않는다.

## 6. BossActionTable

보스의 마력탄·연속 마력탄·광역 마력 폭발에 대상·예고·고정 피해·대응 시간·선택 가중치를 연결한다. 모두 기능 목업용 범용 마법이다. 현재 보스는 페이즈나 조건별 패턴이 없으므로 별도 선택 테이블을 만들지 않는다. 나중에 페이즈마다 가중치가 달라질 때만 패턴 테이블을 추가한다.

## NORMAL 전투의 최소 계산

- 보스 HP: \`hpPerBar 1000 × hpBarCount 2 × bossHpMultiplier 1.0\`
- 캐릭터 공격: \`CharacterActionTable.hpDamage\`를 HP에 직접 차감
- BREAK 공격: \`breakDamage\`를 BREAK Gauge에 직접 차감
- 보스 공격: \`BossActionTable.hpDamage × bossDamageMultiplier\`

이 값은 짧은 Unity 영상에서 전투 흐름을 검증하기 위한 Prototype이며 공식 밸런스가 아니다.

## HFSM 확정 경계

현재 테이블은 HFSM이 사용할 컨트롤러 키·행동 키·선택 가중치까지만 제공한다. 상세 상태와 전이는 Unity 전투 설계 단계로 미룬다.

## 면접 한 문장

“콘텐츠 난이도 ID를 전투 입구에 직접 연결하고, 공통 규칙·캐릭터 행동·보스 행동·선택 가중치를 실제 반복 단위로 분리했습니다. 쉬움과 어려움은 확장 데이터로 보존하고 보통 난이도만 Vertical Slice로 구현합니다.”
`

const schemaDiagram = `# CASE_001 전투·캐릭터 데이터 구조

\`\`\`mermaid
erDiagram
  CombatRuleTable ||--o{ BattleTable : combatRuleId
  BossTable ||--o{ BattleTable : bossId
  CharacterTable ||--o{ CharacterActionTable : characterId
  BossTable ||--o{ BossActionTable : bossId
\`\`\`

\`BattleTable\`의 난이도별 행은 같은 보스와 HFSM을 사용하고 HP·공격력·BREAK Gauge 배율만 다르게 전달한다. Unity 보스 HFSM은 \`BossTable.hfsmControllerKey\`와 각 행동의 \`unityActionKey\`·\`selectionWeight\`를 사용한다. BREAK는 \`CombatRuleTable.breakTriggerType\`·\`breakEnemyActionReduction\`·\`breakGaugeResetTiming\`을 읽는 공통 Battle Controller가 처리한다.
`

await rm(csvRoot, { recursive: true, force: true })
await rm(jsonRoot, { recursive: true, force: true })
await mkdir(csvRoot, { recursive: true })
await mkdir(jsonRoot, { recursive: true })
await writeFile(path.join(outputRoot, 'Astrae-Oratio-CASE001-Combat.gsw'), `${JSON.stringify(document, null, 2)}\n`, 'utf8')
await writeFile(path.join(outputRoot, 'README.md'), readme, 'utf8')
await writeFile(path.join(outputRoot, 'COMBAT_DATA_GUIDE.md'), combatGuide, 'utf8')
await writeFile(path.join(outputRoot, 'schema-diagram.md'), schemaDiagram, 'utf8')
await writeFile(path.join(jsonRoot, 'AstraeCase001CombatData.json'), `${JSON.stringify(runtimeBundle, null, 2)}\n`, 'utf8')

for (const table of tables) {
  await writeFile(path.join(csvRoot, `${table.name}.csv`), `${tableCsv(table)}\n`, 'utf8')
  await writeFile(path.join(jsonRoot, `${table.name}.json`), `${JSON.stringify(nameKeyedRows(table), null, 2)}\n`, 'utf8')
}

console.log(`Generated ${tables.length} tables and ${Object.values(rowsByTable).flat().length} rows in ${outputRoot}`)
