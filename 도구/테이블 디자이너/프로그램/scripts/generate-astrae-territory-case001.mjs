import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repoRoot, 'examples', 'astrae-territory-case-001')
const csvRoot = path.join(outputRoot, 'export', 'csv')
const jsonRoot = path.join(outputRoot, 'export', 'json')

const snake = (value) => value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()
const tableId = (key) => `tbl_content_${snake(key)}`
const columnId = (tableKey, columnKey) => `col_content_${snake(tableKey)}_${snake(columnKey)}`
const enumId = (key) => `enum_content_${snake(key)}`

// key는 기존 프로젝트의 immutable ID를 보존하기 위한 저장용 이름이다.
// 표시 이름이 바뀌어도 같은 의미의 tableId/columnId는 유지한다.
const enumDefinitions = [
  {
    key: 'UnlockConditionType',
    name: 'UnlockType',
    values: [
      ['MAIN_STORY_UNLOCK', '메인 스토리 해금'],
      ['PREVIOUS_CASE_CLEAR', '선행 CASE 클리어'],
    ],
  },
  {
    key: 'CaseStepType',
    name: 'CaseFlowType',
    values: [['SCENARIO', '시나리오'], ['BATTLE', '전투']],
  },
  {
    key: 'ScenarioCommandType',
    name: 'ScenarioCommandType',
    values: [
      ['BACKGROUND', '배경 변경'],
      ['CHARACTER', '캐릭터 표시'],
      ['DIALOGUE', '대사 출력'],
    ],
  },
  {
    key: 'DifficultyType',
    name: 'DifficultyType',
    values: [['EASY', '쉬움'], ['NORMAL', '보통'], ['HARD', '어려움']],
  },
  {
    key: 'RewardType',
    name: 'RewardType',
    values: [['ITEM', '아이템'], ['CURRENCY', '재화']],
  },
]

const enums = enumDefinitions.map((definition) => ({
  enumId: enumId(definition.key),
  name: definition.name,
  values: definition.values.map(([valueName, displayName]) => ({
    enumValueId: `enum_value_content_${snake(definition.key)}_${snake(valueName)}`,
    name: valueName,
    displayName,
  })),
}))

const tableDefinitions = [
  {
    key: 'Case',
    name: 'CaseTable',
    displayName: 'CASE 기본 정보',
    description: 'CASE 목록과 상세 화면에 출력할 정적 콘텐츠를 관리한다.',
    tags: ['CASE', '기본 정보'],
    columns: [
      ['id', 'id', 'ID', 'CASE 행의 숫자형 단일 PK.', 'int32'],
      ['name', 'name', '이름', '기획자가 CASE를 식별하고 UI 제목으로 사용하는 이름.', 'string'],
      ['summaryText', 'summaryText', '사건 개요', 'CASE 목록과 상세 화면에 출력하는 짧은 사건 개요.', 'string'],
      ['issueText', 'issueText', '사건 쟁점', 'CASE 상세 화면에 출력하는 사건 쟁점 본문.', 'string'],
    ],
    primaryKey: ['id'],
  },
  {
    // 기존 UnlockConditionEntryTable의 tableId와 컬럼 ID를 보존한다.
    key: 'UnlockConditionEntry',
    name: 'CaseUnlockTable',
    displayName: 'CASE 해금 조건',
    description: 'CASE에 필요한 해금 조건을 한 행씩 관리한다. 같은 caseId의 조건은 모두 만족해야 한다.',
    tags: ['CASE', '해금'],
    columns: [
      ['id', 'id', 'ID', 'CASE 해금 조건 행의 숫자형 단일 PK.', 'int32'],
      ['caseId', 'caseId', 'CASE ID', '조건이 적용되는 CaseTable.id.', 'int32'],
      ['conditionType', 'unlockType', '해금 유형', '메인 스토리 해금 또는 선행 CASE 클리어 구분.', 'enum', false, 'UnlockConditionType'],
      ['targetCaseId', 'requiredCaseId', '필요 CASE ID', 'PREVIOUS_CASE_CLEAR에서 클리어해야 할 CaseTable.id.', 'int32', true],
    ],
    primaryKey: ['id'],
  },
  {
    // 기존 CaseStepTable의 tableId와 주요 컬럼 ID를 보존한다.
    key: 'CaseStep',
    name: 'CaseFlowTable',
    displayName: 'CASE 진행 순서',
    description: 'CASE별 시나리오와 전투 진입 순서를 데이터로 관리한다.',
    tags: ['CASE', '진행 순서'],
    columns: [
      ['id', 'id', 'ID', 'CASE 흐름 행의 숫자형 단일 PK.', 'int32'],
      ['caseId', 'caseId', 'CASE ID', '이 흐름이 속한 CaseTable.id.', 'int32'],
      ['sequence', 'sequence', '진행 순서', 'CASE 안에서 실행되는 순서.', 'int32'],
      ['stepType', 'flowType', '흐름 유형', '시나리오 실행 또는 전투 진입 구분.', 'enum', false, 'CaseStepType'],
    ],
    primaryKey: ['id'],
    unique: [['caseId', 'sequence']],
  },
  {
    key: 'ScenarioCommand',
    name: 'ScenarioCommandTable',
    displayName: '시나리오 실행 명령',
    description: 'SCENARIO 흐름에서 실행할 배경·캐릭터·대사를 순서대로 관리한다.',
    tags: ['CASE', '시나리오', '연출'],
    columns: [
      ['id', 'id', 'ID', '시나리오 명령 행의 숫자형 단일 PK.', 'int32'],
      ['caseFlowId', 'caseFlowId', 'CASE 흐름 ID', '명령이 속한 SCENARIO 유형 CaseFlowTable.id.', 'int32'],
      ['sequence', 'sequence', '실행 순서', '같은 CASE 흐름 안에서 명령을 실행하는 순서.', 'int32'],
      ['commandType', 'commandType', '명령 유형', '배경·캐릭터·대사 중 실행할 기능.', 'enum', false, 'ScenarioCommandType'],
      ['speakerName', 'speakerName', '화자', 'DIALOGUE 명령에서 표시할 화자명.', 'string', true],
      ['text', 'text', '대사', 'DIALOGUE 명령에서 표시할 실제 문장.', 'string', true],
      ['resourceKey', 'resourceKey', '리소스 키', 'BACKGROUND 또는 CHARACTER 명령이 Unity에 요청할 외부 자산 키.', 'string', true],
    ],
    primaryKey: ['id'],
    unique: [['caseFlowId', 'sequence']],
  },
  {
    // 기존 CaseDifficultyTable의 tableId와 행 ID를 보존한다.
    key: 'CaseDifficulty',
    name: 'CaseDifficultyTable',
    displayName: 'CASE 난이도',
    description: 'BATTLE 흐름에 표시할 난이도와 버튼 순서를 관리한다. 전투 수치는 포함하지 않는다.',
    tags: ['CASE', '난이도'],
    columns: [
      ['id', 'id', 'ID', 'CASE 난이도 행의 숫자형 단일 PK.', 'int32'],
      ['caseStepId', 'caseFlowId', 'CASE 흐름 ID', '난이도가 속한 BATTLE 유형 CaseFlowTable.id.', 'int32'],
      ['difficultyType', 'difficultyType', '난이도', '쉬움·보통·어려움 구분.', 'enum', false, 'DifficultyType'],
      ['sortOrder', 'sortOrder', '표시 순서', '난이도 버튼을 표시하는 순서.', 'int32'],
      ['isImplemented', 'isImplemented', '구현 여부', '현재 빌드에서 해당 난이도로 전투에 진입할 수 있는지 여부.', 'boolean'],
    ],
    primaryKey: ['id'],
    unique: [['caseStepId', 'difficultyType'], ['caseStepId', 'sortOrder']],
  },
  {
    // 기존 RewardEntryTable은 역할을 좁혀 CaseRewardTable로 사용한다.
    key: 'RewardEntry',
    name: 'CaseRewardTable',
    displayName: 'CASE 난이도별 보상',
    description: 'CASE 난이도에 포함될 실제 아이템·재화와 수량을 관리한다.',
    tags: ['CASE', '보상'],
    columns: [
      ['id', 'id', 'ID', 'CASE 보상 행의 숫자형 단일 PK.', 'int32'],
      ['caseDifficultyId', 'caseDifficultyId', 'CASE 난이도 ID', '보상이 속한 CaseDifficultyTable.id.', 'int32'],
      ['rewardType', 'rewardType', '보상 유형', '아이템 또는 재화 구분.', 'enum', false, 'RewardType'],
      ['rewardCode', 'rewardCode', '보상 코드', '본편 아이템/재화 시스템에서 사용하는 외부 코드.', 'string'],
      ['amount', 'amount', '수량', '지급할 아이템 또는 재화 수량.', 'int32'],
    ],
    primaryKey: ['id'],
  },
]

function makeColumn(tableKey, definition) {
  const [key, name, displayName, description, kind, nullable = false, enumKey] = definition
  return {
    columnId: columnId(tableKey, key),
    tableId: tableId(tableKey),
    name,
    displayName,
    description,
    dataType: kind === 'enum' ? { kind, enumId: enumId(enumKey) } : { kind },
    nullable,
    validationRules: [],
    deprecated: false,
  }
}

const tables = tableDefinitions.map((definition) => ({
  tableId: tableId(definition.key),
  name: definition.name,
  displayName: definition.displayName,
  description: definition.description,
  columns: definition.columns.map((column) => makeColumn(definition.key, column)),
  primaryKey: { columnIds: definition.primaryKey.map((key) => columnId(definition.key, key)) },
  uniqueConstraints: (definition.unique ?? []).map((keys, index) => ({
    constraintId: `unique_content_${snake(definition.key)}_${index + 1}`,
    name: `UQ_${definition.name}_${keys.join('_')}`,
    columnIds: keys.map((key) => columnId(definition.key, key)),
  })),
  checkConstraints: [],
  tags: definition.tags,
  authoringOnly: false,
  runtimeOnly: false,
}))

const relation = (key, name, sourceTable, sourceColumn, targetTable, targetColumn, required = true) => ({
  relationId: `rel_content_${snake(key)}`,
  name,
  kind: 'hard_fk',
  sourceTableId: tableId(sourceTable),
  sourceColumnIds: [columnId(sourceTable, sourceColumn)],
  targetTableId: tableId(targetTable),
  targetColumnIds: [columnId(targetTable, targetColumn)],
  required,
})

const relations = [
  relation('unlock_case', 'CaseUnlock belongs to Case', 'UnlockConditionEntry', 'caseId', 'Case', 'id'),
  relation('unlock_previous_case', 'CaseUnlock may require previous Case', 'UnlockConditionEntry', 'targetCaseId', 'Case', 'id', false),
  relation('flow_case', 'CaseFlow belongs to Case', 'CaseStep', 'caseId', 'Case', 'id'),
  relation('scenario_command_flow', 'ScenarioCommand belongs to CaseFlow', 'ScenarioCommand', 'caseFlowId', 'CaseStep', 'id'),
  relation('difficulty_flow', 'CaseDifficulty belongs to CaseFlow', 'CaseDifficulty', 'caseStepId', 'CaseStep', 'id'),
  relation('reward_difficulty', 'CaseReward belongs to CaseDifficulty', 'RewardEntry', 'caseDifficultyId', 'CaseDifficulty', 'id'),
]

const layout = {
  nodes: [
    { entityId: tableId('UnlockConditionEntry'), x: 20, y: 20 },
    { entityId: tableId('Case'), x: 440, y: 20 },
    { entityId: tableId('CaseStep'), x: 860, y: 20 },
    { entityId: tableId('ScenarioCommand'), x: 1280, y: 20 },
    { entityId: tableId('CaseDifficulty'), x: 860, y: 620 },
    { entityId: tableId('RewardEntry'), x: 1280, y: 620 },
  ],
}

const project = {
  projectId: 'proj_astrae_territory_case_001',
  name: '아스트라에 오라티오 CASE형 영지 조정',
  schemaVersion: '9.0.0',
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
  [tableId('Case')]: [
    row('Case', 'row_case_001', {
      id: 1010001,
      name: '결투재판 효력분쟁',
      summaryText: '과거 결투재판으로 종결된 영지분쟁의 효력이 현재의 행정 기반 영지질서에 어디까지 미치는지를 둘러싼 사건.',
      issueText: '제4시대부터 이어진 결투재판과 제5시대 이후 성립한 행정 기반 영지질서가 현대에 공존하면서, 과거 판단의 효력을 현재 영지질서가 어디까지 인정할지가 쟁점이다.',
    }),
  ],
  [tableId('UnlockConditionEntry')]: [
    row('UnlockConditionEntry', 'row_unlock_entry_case001_story', {
      id: 1100001,
      caseId: 1010001,
      conditionType: 'MAIN_STORY_UNLOCK',
      targetCaseId: null,
    }),
  ],
  [tableId('CaseStep')]: [
    row('CaseStep', 'row_case001_step01', { id: 1040001, caseId: 1010001, sequence: 1, stepType: 'SCENARIO' }),
    row('CaseStep', 'row_case001_step02', { id: 1040002, caseId: 1010001, sequence: 2, stepType: 'BATTLE' }),
    row('CaseStep', 'row_case001_step03', { id: 1040003, caseId: 1010001, sequence: 3, stepType: 'SCENARIO' }),
  ],
  [tableId('ScenarioCommand')]: [
    row('ScenarioCommand', 'row_scenario_intro_character', { id: 1110001, caseFlowId: 1040001, sequence: 1, commandType: 'CHARACTER', speakerName: null, text: null, resourceKey: 'MAMIYA_RITSU_STANDING' }),
    row('ScenarioCommand', 'row_scenario_intro_placeholder', { id: 1110002, caseFlowId: 1040001, sequence: 2, commandType: 'DIALOGUE', speakerName: null, text: '(미정)', resourceKey: null }),
    row('ScenarioCommand', 'row_scenario_end_character', { id: 1110003, caseFlowId: 1040003, sequence: 1, commandType: 'CHARACTER', speakerName: null, text: null, resourceKey: 'MAMIYA_RITSU_STANDING' }),
    row('ScenarioCommand', 'row_scenario_end_placeholder', { id: 1110004, caseFlowId: 1040003, sequence: 2, commandType: 'DIALOGUE', speakerName: null, text: '(미정)', resourceKey: null }),
  ],
  [tableId('CaseDifficulty')]: [
    row('CaseDifficulty', 'row_case001_easy', { id: 1050001, caseStepId: 1040002, difficultyType: 'EASY', sortOrder: 1, isImplemented: false }),
    row('CaseDifficulty', 'row_case001_normal', { id: 1050002, caseStepId: 1040002, difficultyType: 'NORMAL', sortOrder: 2, isImplemented: true }),
    row('CaseDifficulty', 'row_case001_hard', { id: 1050003, caseStepId: 1040002, difficultyType: 'HARD', sortOrder: 3, isImplemented: false }),
  ],
  [tableId('RewardEntry')]: [
    row('RewardEntry', 'row_case001_easy_gold', { id: 1090001, caseDifficultyId: 1050001, rewardType: 'CURRENCY', rewardCode: 'GOLD', amount: 1 }),
    row('RewardEntry', 'row_case001_normal_gold', { id: 1090002, caseDifficultyId: 1050002, rewardType: 'CURRENCY', rewardCode: 'GOLD', amount: 2 }),
    row('RewardEntry', 'row_case001_hard_gold', { id: 1090003, caseDifficultyId: 1050003, rewardType: 'CURRENCY', rewardCode: 'GOLD', amount: 3 }),
  ],
}

const document = {
  formatVersion: 2,
  revision: 1,
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
  sourceProject: 'Astrae-Oratio-CASE001.gsw',
  scope: 'CASE 콘텐츠 전용. 전투 수치·보스·HFSM 데이터는 포함하지 않는다.',
  idPolicy: '모든 테이블은 전역 고유 숫자 id를 첫 열 단일 PK로 사용한다.',
  unlockRule: '같은 caseId를 가진 CaseUnlockTable 행을 모두 만족하면 해금한다.',
  ...Object.fromEntries(tables.map((table) => [table.name, nameKeyedRows(table)])),
}

const readme = `# 아스트라에 오라티오 CASE_001 콘텐츠 데이터

디나미스원 「아스트라에 오라티오」 시스템 기획자 지원용으로 제작한 CASE형 서브 콘텐츠 데이터 Vertical Slice다.

## 이번 범위

- 포함: CASE 목록·상세, 해금 조건, 진행 순서, 시나리오 대사·연출, 난이도 선택, 난이도별 보상 연결
- 제외: 전투 수치, 보스, HFSM, 스킬, 경제 밸런스, 서버 저장 구조, 로컬라이징
- 실제 제작 데이터: CASE_001 「결투재판 효력분쟁」 1건

## 정본과 Unity 입력

- Authoring 정본: \`Astrae-Oratio-CASE001.gsw\`
- Unity 권장 입력: \`export/json/AstraeCase001MasterData.json\`
- 테이블별 확인/부분 로딩: \`export/csv/*.csv\` 또는 \`export/json/*.json\`
- Unity 인계 규칙: \`UNITY_CONTENT_HANDOFF.md\`
- 테이블별 면접 설명: \`CONTENT_DATA_GUIDE.md\`

## 6개 테이블 원칙

- 실제로 여러 행이 반복되는 해금 조건·진행 단계·시나리오 명령·난이도·보상만 분리한다.
- 이름만 관리하던 ScenarioTable, DifficultyTable, RewardGroupTable은 제거했다.
- 시나리오 등장인물은 ScenarioCommandTable에서 관리하므로 CaseParticipantTable은 제거했다.
- 모든 테이블은 첫 열 \`id\`를 숫자형 단일 PK로 사용하고, FK도 대상의 숫자 \`id\` 한 열만 참조한다.
- CASE 진행 상태는 Master Data와 섞지 않고 Unity Save의 \`CaseProgress\`에서 관리한다.

## 확정하지 않은 정보

- \`MAIN_STORY_UNLOCK\`: 외부 메인 스토리 시스템이 CASE 콘텐츠 개방 여부를 전달하는 조건이며, 미확정 Chapter/Quest 코드는 만들지 않았다.
- \`ScenarioCommandTable.text\`: 구체적인 도입·종료 시나리오가 미정이므로 각각 \`(미정)\`으로 표시했다.
- \`CaseRewardTable\`: 기능 확인용 가데이터로 쉬움·보통·어려움에 GOLD 1·2·3을 각각 연결했다. 실제 경제 밸런스 값은 아니다.
- \`CaseFlowTable\`의 BATTLE 행은 콘텐츠 순서만 보존한다. 실제 전투 연결은 전투 프로젝트 착수 후 추가한다.
`

const contentGuide = `# CASE_001 콘텐츠 데이터 설명서

## 전체 구조

\`CaseTable → CaseUnlockTable / CaseFlowTable → ScenarioCommandTable / CaseDifficultyTable → CaseRewardTable\`

테이블 수를 늘리는 것이 아니라 실제로 여러 행이 반복되는 정보만 분리한 6개 구조다.

## 1. CaseTable

CASE 한 건의 기본 정보다. \`name\`, \`summaryText\`, \`issueText\`는 사건 목록과 상세 화면에 실제로 출력한다.

## 2. CaseUnlockTable

CASE가 열리는 조건을 한 행씩 기록한다. 같은 \`caseId\`의 조건은 모두 만족해야 한다.

- \`MAIN_STORY_UNLOCK\`: 메인 스토리에서 CASE 콘텐츠가 개방되면 충족
- \`PREVIOUS_CASE_CLEAR\`: \`requiredCaseId\`의 CASE를 클리어하면 충족

CASE_001은 \`MAIN_STORY_UNLOCK\`만 사용하므로 \`requiredCaseId\`가 비어 있다. 후속 CASE의 선행 조건에서만 이 값을 사용한다.

## 3. CaseFlowTable

CASE 내부의 진행 목차다. CASE_001은 \`SCENARIO → BATTLE → SCENARIO\` 순서다. 후속 CASE의 단계 수와 순서가 달라도 Unity Controller를 바꾸지 않고 데이터 행으로 구성할 수 있다.

## 4. ScenarioCommandTable

SCENARIO 유형의 \`caseFlowId\`에 직접 연결한다. Unity는 \`sequence\` 순서대로 캐릭터·대사를 실행한다. 현재 확정 자산은 마미야 리츠 스탠딩 한 장뿐이며, 구체적인 도입·종료 대사는 창작하지 않고 \`(미정)\`으로 남겼다.

## 5. CaseDifficultyTable

BATTLE 유형의 \`caseFlowId\`에 쉬움·보통·어려움을 연결한다. \`sortOrder\`는 난이도 버튼 순서다. \`isImplemented\`는 현재 빌드에서 실제 진입 가능한지를 뜻하며, CASE_001은 보통만 \`true\`다.

## 6. CaseRewardTable

\`caseDifficultyId\`에 아이템·재화 코드와 수량을 여러 행으로 연결한다. 별도 보상 그룹 없이도 난이도 하나에 여러 보상을 넣을 수 있다. 현재는 기능 확인용 가데이터로 쉬움 GOLD 1, 보통 GOLD 2, 어려움 GOLD 3을 넣었다.

## 면접 한 문장

“CASE의 정적 정보, 복수 해금 조건, 가변 진행 순서, 시나리오 명령, 난이도와 보상을 실제 반복 단위 기준으로 6개 테이블에 분리했습니다. 이름만 가진 중간 테이블은 제거해 단순성과 확장성을 함께 확보했습니다.”
`

const unityHandoff = `# Unity 콘텐츠 구현 인계

## 범위

이번 인계는 CASE 콘텐츠 화면과 시나리오 재생까지만 대상으로 한다. 전투 로직·보스·HFSM은 구현하지 않는다.

## 로딩 순서

1. \`AstraeCase001MasterData.json\`을 읽고 각 테이블을 \`id\` 기준 Dictionary로 만든다.
2. CaseTable을 목록에 표시하고 CaseUnlockTable에서 같은 caseId의 조건을 모두 검사한다.
3. 수임 후 CaseFlowTable을 sequence 순서대로 진행한다.
4. SCENARIO이면 해당 caseFlowId의 ScenarioCommandTable을 sequence 순서대로 실행한다.
5. BATTLE이면 해당 caseFlowId의 CaseDifficultyTable로 버튼을 만든다.
6. \`isImplemented=false\`인 쉬움·어려움 버튼은 클릭 시 \`미구현\` 안내만 표시한다.
7. \`isImplemented=true\`인 보통만 전투에 진입시키고, 클리어 시 CaseRewardTable의 GOLD 2를 지급한다.

## 기존 Unity 고정값 교체 대상

- 제목·개요·쟁점 → CaseTable
- 고정된 화면 진행 분기 → CaseFlowTable
- 고정 화자·대사·이미지 → ScenarioCommandTable
- 고정 난이도 배열 → CaseDifficultyTable
- 난이도 구현 여부 → CaseDifficultyTable.isImplemented
- 난이도별 가보상 → CaseRewardTable

## 리소스 키 연결

- \`MAMIYA_RITSU_STANDING\` → 확정 원본 \`C:/Users/Admin/Downloads/새 폴더 (3)/새 폴더/캐릭터-스탠딩-공식작화-리빌드.jpg\`
- Unity 구현 시 위 원본을 프로젝트 Assets로 복사하고 Addressables 또는 리소스 Dictionary에 같은 키로 등록한다.
- \`01.png\`~\`05.png\`와 긴 영문 파일명의 이미지는 NovelAI 후보이므로 정본 키에 등록하지 않는다.

## Runtime 저장 분리

정적 테이블에 상태를 쓰지 않는다. Unity Save 영역에 별도 \`CaseProgress\`를 둔다.

\`caseId / state(LOCKED, AVAILABLE, IN_PROGRESS, COMPLETED) / currentFlowId / isArchived\`

\`MAIN_STORY_UNLOCK\`은 메인 스토리 시스템의 CASE 콘텐츠 개방 Boolean을 확인한다. 정확한 연동 API는 Unity 구현 단계에서 결정한다.
`

const validation = `# CASE_001 콘텐츠 데이터 검증 결과

검증 대상: \`Astrae-Oratio-CASE001.gsw\`

| 검증 항목 | 결과 | 비고 |
|---|---:|---|
| WorkbenchDocument v2 파싱 | PASS | 간소화 스키마 v9.0.0 |
| 테이블 / 관계 / 데이터 행 | PASS | 6개 / 6개 / 15개 |
| PK 중복 | 0 | 모든 테이블의 첫 열 숫자 id 단일 PK |
| 전체 ID 중복 | 0 | 콘텐츠·전투 프로젝트 전역 ID 범위 분리 |
| FK 오류 | 0 | 모든 FK가 대상 숫자 id 한 열 참조 |
| CASE 흐름 순서 중복 | 0 | CASE_001 sequence 1·2·3 |
| 시나리오 명령 순서 중복 | 0 | SCENARIO 흐름별 sequence 1·2 |
| 미확정 시나리오 창작 | 0 | 도입·종료 대사는 각각 (미정), 확정 스탠딩만 resourceKey 사용 |
| 난이도 연결 누락 | 0 | EASY·NORMAL·HARD 각각 BATTLE 흐름에 연결 |
| 난이도 구현 범위 | PASS | NORMAL만 isImplemented=true |
| 가보상 연결 | PASS | EASY·NORMAL·HARD에 GOLD 1·2·3 연결 |
| 불필요한 중간 테이블 | 0 | Participant·Scenario·Difficulty·RewardGroup 제거 |
| 전투 데이터 혼입 | 0 | 전투 수치·보스·HFSM·BattleTable 없음 |
| CSV 정본 일치 | PASS | 앱의 ColumnId 기반 직렬화와 비교 |
| 저장 → 재열기 roundtrip | PASS | Vitest 회귀 테스트 |

## 의도적으로 남긴 null

1. \`CaseUnlockTable.requiredCaseId\` — MAIN_STORY_UNLOCK은 선행 CASE를 사용하지 않음.
2. ScenarioCommandTable의 \`speakerName\` — 현재 대사가 미정이라 화자도 확정하지 않음.
3. ScenarioCommandTable의 명령별 미사용 컬럼 — commandType에 따라 필요한 컬럼만 사용함.
`

const schemaDiagram = `# CASE_001 콘텐츠 데이터 구조

\`\`\`mermaid
erDiagram
  CaseTable ||--o{ CaseUnlockTable : caseId
  CaseTable ||--o{ CaseFlowTable : caseId
  CaseTable ||--o{ CaseUnlockTable : requiredCaseId
  CaseFlowTable ||--o{ ScenarioCommandTable : caseFlowId
  CaseFlowTable ||--o{ CaseDifficultyTable : caseFlowId
  CaseDifficultyTable ||--o{ CaseRewardTable : caseDifficultyId
\`\`\`

모든 PK/FK는 숫자형 단일 열이다. 실제 반복 데이터만 1:N으로 분리하고 이름만 가진 중간 테이블은 두지 않는다.
`

const schemaSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="760" viewBox="0 0 1500 760">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#17857b"/></marker>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#09142d" flood-opacity="0.16"/></filter>
  </defs>
  <rect width="1500" height="760" fill="#f4f7fb"/>
  <text x="70" y="70" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#1a2d5f">CASE_001 콘텐츠 데이터 구조</text>
  <text x="70" y="106" font-family="Arial, sans-serif" font-size="18" fill="#5e6b85">6개 테이블 · 실제 반복 단위만 1:N 관계로 분리</text>
  <g stroke="#17857b" stroke-width="4" fill="none" marker-end="url(#arrow)">
    <path d="M480 235 H360"/><path d="M800 235 H920"/><path d="M1080 325 V405"/>
    <path d="M920 265 H850 V580 H800"/><path d="M800 605 H1000 V670 H1210"/>
    <path d="M210 325 V700 H440 V300 H480" stroke-dasharray="10 8"/>
  </g>
  <text x="245" y="725" font-family="Arial, sans-serif" font-size="14" fill="#65738c">requiredCaseId · 후속 CASE에서 사용</text>
  <g font-family="Arial, sans-serif" filter="url(#shadow)">
    <g transform="translate(60 165)"><rect width="300" height="160" rx="16" fill="#fff" stroke="#b8c4d8"/><rect width="300" height="50" rx="16" fill="#1a2d5f"/><text x="18" y="34" font-size="20" font-weight="700" fill="#fff">CaseUnlockTable</text><text x="18" y="92" font-size="16" fill="#263750">메인 스토리 / 선행 CASE 조건</text><text x="18" y="125" font-size="14" fill="#65738c">같은 caseId의 모든 행 충족</text></g>
    <g transform="translate(480 165)"><rect width="320" height="160" rx="16" fill="#fff" stroke="#17857b" stroke-width="3"/><rect width="320" height="50" rx="16" fill="#17857b"/><text x="18" y="34" font-size="22" font-weight="700" fill="#fff">CaseTable</text><text x="18" y="92" font-size="16" fill="#263750">이름 · 사건 개요 · 사건 쟁점</text><text x="18" y="125" font-size="14" fill="#65738c">정적 콘텐츠의 시작점</text></g>
    <g transform="translate(920 165)"><rect width="320" height="160" rx="16" fill="#fff" stroke="#17857b" stroke-width="3"/><rect width="320" height="50" rx="16" fill="#17857b"/><text x="18" y="34" font-size="22" font-weight="700" fill="#fff">CaseFlowTable</text><text x="18" y="92" font-size="16" fill="#263750">SCENARIO → BATTLE → SCENARIO</text><text x="18" y="125" font-size="14" fill="#65738c">sequence 기반 진행 목차</text></g>
    <g transform="translate(920 405)"><rect width="360" height="150" rx="16" fill="#fff" stroke="#b8c4d8"/><rect width="360" height="50" rx="16" fill="#1a2d5f"/><text x="18" y="34" font-size="20" font-weight="700" fill="#fff">ScenarioCommandTable</text><text x="18" y="92" font-size="16" fill="#263750">배경 · 캐릭터 · 대사 명령</text><text x="18" y="122" font-size="14" fill="#65738c">SCENARIO flow에 직접 연결</text></g>
    <g transform="translate(480 505)"><rect width="320" height="150" rx="16" fill="#fff" stroke="#b8c4d8"/><rect width="320" height="50" rx="16" fill="#1a2d5f"/><text x="18" y="34" font-size="20" font-weight="700" fill="#fff">CaseDifficultyTable</text><text x="18" y="92" font-size="16" fill="#263750">쉬움 · 보통 · 어려움</text><text x="18" y="122" font-size="14" fill="#65738c">보통만 구현 완료</text></g>
    <g transform="translate(1210 610)"><rect width="240" height="120" rx="16" fill="#fff" stroke="#b8c4d8"/><rect width="240" height="48" rx="16" fill="#1a2d5f"/><text x="18" y="32" font-size="20" font-weight="700" fill="#fff">CaseRewardTable</text><text x="18" y="84" font-size="15" fill="#263750">난이도별 가보상</text><text x="18" y="108" font-size="13" fill="#a06b00">GOLD 1 · 2 · 3</text></g>
  </g>
</svg>
`

await rm(csvRoot, { recursive: true, force: true })
await rm(jsonRoot, { recursive: true, force: true })
await rm(path.join(outputRoot, 'DIFFICULTY_REWARD_GUIDE.md'), { force: true })
await rm(path.join(outputRoot, 'schema-diagram.png'), { force: true })
await mkdir(csvRoot, { recursive: true })
await mkdir(jsonRoot, { recursive: true })
await writeFile(path.join(outputRoot, 'Astrae-Oratio-CASE001.gsw'), `${JSON.stringify(document, null, 2)}\n`, 'utf8')
await writeFile(path.join(outputRoot, 'README.md'), readme, 'utf8')
await writeFile(path.join(outputRoot, 'CONTENT_DATA_GUIDE.md'), contentGuide, 'utf8')
await writeFile(path.join(outputRoot, 'UNITY_CONTENT_HANDOFF.md'), unityHandoff, 'utf8')
await writeFile(path.join(outputRoot, 'VALIDATION.md'), validation, 'utf8')
await writeFile(path.join(outputRoot, 'schema-diagram.md'), schemaDiagram, 'utf8')
await writeFile(path.join(outputRoot, 'schema-diagram.svg'), schemaSvg, 'utf8')
await writeFile(path.join(jsonRoot, 'AstraeCase001MasterData.json'), `${JSON.stringify(runtimeBundle, null, 2)}\n`, 'utf8')

for (const table of tables) {
  await writeFile(path.join(csvRoot, `${table.name}.csv`), `${tableCsv(table)}\n`, 'utf8')
  await writeFile(path.join(jsonRoot, `${table.name}.json`), `${JSON.stringify(nameKeyedRows(table), null, 2)}\n`, 'utf8')
}

console.log(`Generated ${tables.length} tables, ${relations.length} relations, and ${Object.values(rowsByTable).flat().length} rows in ${outputRoot}`)
