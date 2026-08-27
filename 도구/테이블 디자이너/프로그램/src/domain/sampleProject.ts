import type {
  CanvasNodeLayout,
  ColumnDataType,
  DataRow,
  EntityId,
  ExportView,
  FunctionalDependency,
  Relation,
  RowsByTable,
  SchemaColumn,
  SchemaProject,
  SchemaTable,
} from './schema'

type ColumnInput = Omit<SchemaColumn, 'tableId' | 'displayName' | 'description' | 'validationRules' | 'deprecated'> & {
  readonly displayName?: string
  readonly description?: string
}

const ids = {
  project: 'project_crowd_system',
  zone: 'table_crowd_zone',
  profile: 'table_crowd_reaction_profile',
  rule: 'table_crowd_reaction_rule',
  ruleAction: 'table_crowd_reaction_rule_action',
  action: 'table_crowd_reaction_action',
  animation: 'table_animation',
  presetCharacter: 'table_crowd_visual_preset_character',
  presetColor: 'table_crowd_visual_preset_color',
  eventType: 'table_event_type',
  character: 'table_character',
  color: 'table_color',
  audienceSide: 'enum_audience_side',
} as const

const type = {
  string: { kind: 'string' },
  int32: { kind: 'int32' },
  float: { kind: 'float' },
  resource: { kind: 'resource_ref' },
} satisfies Record<string, ColumnDataType>

function column(tableId: EntityId, input: ColumnInput): SchemaColumn {
  return {
    tableId,
    displayName: input.displayName ?? input.name,
    description: input.description ?? '',
    validationRules: [],
    deprecated: false,
    ...input,
  }
}

function table(
  tableId: EntityId,
  name: string,
  description: string,
  columns: readonly ColumnInput[],
  primaryKey: readonly EntityId[],
  tags: readonly string[] = [],
): SchemaTable {
  return {
    tableId,
    name,
    displayName: name,
    description,
    columns: columns.map((input) => column(tableId, input)),
    primaryKey: { columnIds: primaryKey },
    uniqueConstraints: [],
    checkConstraints: [],
    tags,
    authoringOnly: false,
    runtimeOnly: false,
  }
}

const c = {
  zoneId: 'column_zone_id',
  capacity: 'column_capacity',
  density: 'column_density',
  supportTeam: 'column_support_team',
  visualPresetId: 'column_visual_preset_id',
  zoneProfileId: 'column_zone_reaction_profile_id',
  defaultStateId: 'column_default_state_id',
  profileId: 'column_profile_id',
  profileName: 'column_profile_display_name',
  profileDescription: 'column_profile_description',
  ruleId: 'column_rule_id',
  ruleProfileId: 'column_rule_profile_id',
  eventTypeId: 'column_event_type_id',
  audienceSide: 'column_audience_side',
  participationRate: 'column_participation_rate',
  delayMin: 'column_delay_min',
  delayMax: 'column_delay_max',
  durationMin: 'column_duration_min',
  durationMax: 'column_duration_max',
  priority: 'column_priority',
  ruleActionRuleId: 'column_rule_action_rule_id',
  ruleActionActionId: 'column_rule_action_action_id',
  ruleActionWeight: 'column_rule_action_weight',
  actionId: 'column_action_id',
  animationId: 'column_animation_id',
  returnStateId: 'column_return_state_id',
  intensity: 'column_intensity',
  animationPk: 'column_animation_pk',
  resourcePath: 'column_resource_path',
  loopType: 'column_loop_type',
  animationDuration: 'column_animation_duration',
  presetCharacterPresetId: 'column_preset_character_preset_id',
  presetCharacterCharacterId: 'column_preset_character_character_id',
  presetCharacterWeight: 'column_preset_character_weight',
  presetColorPresetId: 'column_preset_color_preset_id',
  presetColorColorId: 'column_preset_color_color_id',
  presetColorWeight: 'column_preset_color_weight',
  eventTypePk: 'column_event_type_pk',
  eventName: 'column_event_name',
  characterPk: 'column_character_pk',
  characterName: 'column_character_name',
  colorPk: 'column_color_pk',
  colorName: 'column_color_name',
} as const

const tables: readonly SchemaTable[] = [
  table(
    ids.zone,
    'CrowdZone',
    '경기장 관중 구역별 런타임 진입점입니다.',
    [
      { columnId: c.zoneId, name: 'ZoneId', dataType: type.string, nullable: false },
      { columnId: c.capacity, name: 'Capacity', dataType: type.int32, nullable: false },
      { columnId: c.density, name: 'Density', dataType: type.float, nullable: false },
      { columnId: c.supportTeam, name: 'SupportTeam', dataType: type.string, nullable: false },
      { columnId: c.visualPresetId, name: 'VisualPresetId', dataType: type.string, nullable: false },
      { columnId: c.zoneProfileId, name: 'ReactionProfileId', dataType: type.string, nullable: false },
      { columnId: c.defaultStateId, name: 'DefaultStateId', dataType: type.string, nullable: false },
    ],
    [c.zoneId],
    ['runtime-root'],
  ),
  table(
    ids.profile,
    'CrowdReactionProfile',
    '관중 구역에서 사용하는 이름 있는 규칙 묶음입니다.',
    [
      { columnId: c.profileId, name: 'ProfileId', dataType: type.string, nullable: false },
      { columnId: c.profileName, name: 'DisplayName', dataType: type.string, nullable: false },
      { columnId: c.profileDescription, name: 'Description', dataType: type.string, nullable: true },
    ],
    [c.profileId],
  ),
  table(
    ids.rule,
    'CrowdReactionRule',
    '프로필에 적용할 반응을 선택하는 조건입니다.',
    [
      { columnId: c.ruleId, name: 'RuleId', dataType: type.string, nullable: false },
      { columnId: c.ruleProfileId, name: 'ProfileId', dataType: type.string, nullable: false },
      { columnId: c.eventTypeId, name: 'EventTypeId', dataType: type.string, nullable: false },
      { columnId: c.audienceSide, name: 'AudienceSide', dataType: { kind: 'enum', enumId: ids.audienceSide }, nullable: false },
      { columnId: c.participationRate, name: 'ParticipationRate', dataType: type.float, nullable: false },
      { columnId: c.delayMin, name: 'DelayMin', dataType: type.float, nullable: false },
      { columnId: c.delayMax, name: 'DelayMax', dataType: type.float, nullable: false },
      { columnId: c.durationMin, name: 'DurationMin', dataType: type.float, nullable: false },
      { columnId: c.durationMax, name: 'DurationMax', dataType: type.float, nullable: false },
      { columnId: c.priority, name: 'Priority', dataType: type.int32, nullable: false },
    ],
    [c.ruleId],
  ),
  table(
    ids.ruleAction,
    'CrowdReactionRuleAction',
    '반응 규칙에서 사용할 수 있는 가중치 기반 액션입니다.',
    [
      { columnId: c.ruleActionRuleId, name: 'RuleId', dataType: type.string, nullable: false },
      { columnId: c.ruleActionActionId, name: 'ActionId', dataType: type.string, nullable: false },
      { columnId: c.ruleActionWeight, name: 'Weight', dataType: type.float, nullable: false },
    ],
    [c.ruleActionRuleId, c.ruleActionActionId],
    ['junction'],
  ),
  table(
    ids.action,
    'CrowdReactionAction',
    '규칙 액션이 재생할 애니메이션과 강도 데이터입니다.',
    [
      { columnId: c.actionId, name: 'ActionId', dataType: type.string, nullable: false },
      { columnId: c.animationId, name: 'AnimationId', dataType: type.string, nullable: false },
      { columnId: c.returnStateId, name: 'ReturnStateId', dataType: type.string, nullable: true },
      { columnId: c.intensity, name: 'Intensity', dataType: type.float, nullable: false },
    ],
    [c.actionId],
  ),
  table(
    ids.animation,
    'Animation',
    '반응 액션이 참조하는 애니메이션 에셋 카탈로그입니다.',
    [
      { columnId: c.animationPk, name: 'AnimationId', dataType: type.string, nullable: false },
      { columnId: c.resourcePath, name: 'ResourcePath', dataType: type.resource, nullable: false },
      { columnId: c.loopType, name: 'LoopType', dataType: type.string, nullable: false },
      { columnId: c.animationDuration, name: 'Duration', dataType: type.float, nullable: false },
    ],
    [c.animationPk],
  ),
  table(
    ids.presetCharacter,
    'CrowdVisualPresetCharacter',
    '비주얼 프리셋에 포함되는 가중치 기반 캐릭터 항목입니다.',
    [
      { columnId: c.presetCharacterPresetId, name: 'PresetId', dataType: type.string, nullable: false },
      { columnId: c.presetCharacterCharacterId, name: 'CharacterId', dataType: type.string, nullable: false },
      { columnId: c.presetCharacterWeight, name: 'Weight', dataType: type.float, nullable: false },
    ],
    [c.presetCharacterPresetId, c.presetCharacterCharacterId],
    ['junction'],
  ),
  table(
    ids.presetColor,
    'CrowdVisualPresetColor',
    '비주얼 프리셋에 포함되는 가중치 기반 색상 항목입니다.',
    [
      { columnId: c.presetColorPresetId, name: 'PresetId', dataType: type.string, nullable: false },
      { columnId: c.presetColorColorId, name: 'ColorId', dataType: type.string, nullable: false },
      { columnId: c.presetColorWeight, name: 'Weight', dataType: type.float, nullable: false },
    ],
    [c.presetColorPresetId, c.presetColorColorId],
    ['junction'],
  ),
  table(ids.eventType, 'EventType', '이벤트 카탈로그입니다.', [
    { columnId: c.eventTypePk, name: 'EventTypeId', dataType: type.string, nullable: false },
    { columnId: c.eventName, name: 'DisplayName', dataType: type.string, nullable: false },
  ], [c.eventTypePk], ['lookup']),
  table(ids.character, 'Character', '관중 캐릭터 카탈로그입니다.', [
    { columnId: c.characterPk, name: 'CharacterId', dataType: type.string, nullable: false },
    { columnId: c.characterName, name: 'DisplayName', dataType: type.string, nullable: false },
  ], [c.characterPk], ['lookup']),
  table(ids.color, 'Color', '관중 색상 카탈로그입니다.', [
    { columnId: c.colorPk, name: 'ColorId', dataType: type.string, nullable: false },
    { columnId: c.colorName, name: 'DisplayName', dataType: type.string, nullable: false },
  ], [c.colorPk], ['lookup']),
]

const relations: readonly Relation[] = [
  relation('relation_zone_profile', 'Zone uses reaction profile', ids.zone, [c.zoneProfileId], ids.profile, [c.profileId]),
  relation('relation_rule_profile', 'Rule belongs to profile', ids.rule, [c.ruleProfileId], ids.profile, [c.profileId]),
  relation('relation_rule_event', 'Rule listens to event', ids.rule, [c.eventTypeId], ids.eventType, [c.eventTypePk]),
  relation('relation_rule_action_rule', 'Rule action belongs to rule', ids.ruleAction, [c.ruleActionRuleId], ids.rule, [c.ruleId]),
  relation('relation_rule_action_action', 'Rule action uses action', ids.ruleAction, [c.ruleActionActionId], ids.action, [c.actionId]),
  relation('relation_action_animation', 'Action uses animation', ids.action, [c.animationId], ids.animation, [c.animationPk]),
  relation('relation_preset_character_catalog', 'Preset character uses catalog', ids.presetCharacter, [c.presetCharacterCharacterId], ids.character, [c.characterPk]),
  relation('relation_preset_color_catalog', 'Preset color uses catalog', ids.presetColor, [c.presetColorColorId], ids.color, [c.colorPk]),
]

function relation(
  relationId: EntityId,
  name: string,
  sourceTableId: EntityId,
  sourceColumnIds: readonly EntityId[],
  targetTableId: EntityId,
  targetColumnIds: readonly EntityId[],
): Relation {
  return {
    relationId,
    name,
    kind: 'hard_fk',
    sourceTableId,
    sourceColumnIds,
    targetTableId,
    targetColumnIds,
    required: true,
  }
}

const functionalDependencies: readonly FunctionalDependency[] = [
  {
    dependencyId: 'dependency_animation_resource',
    tableId: ids.animation,
    determinantColumnIds: [c.animationPk],
    dependentColumnIds: [c.resourcePath, c.loopType, c.animationDuration],
    note: 'AnimationId determines the asset metadata.',
  },
  {
    dependencyId: 'dependency_rule_delay_range',
    tableId: ids.rule,
    determinantColumnIds: [c.ruleId],
    dependentColumnIds: [c.delayMin, c.delayMax, c.durationMin, c.durationMax],
    note: 'RuleId가 런타임 출력에 쓰이는 타이밍 범위를 소유합니다.',
  },
]

const exportViews: readonly ExportView[] = [
  {
    viewId: 'export_crowd_reaction_runtime',
    name: 'CrowdReactionRuntime',
    displayName: '관중 반응 런타임 CSV',
    description: '정규화된 작성 테이블에서 생성되는 런타임용 평탄화 뷰입니다.',
    format: 'csv',
    rootTableId: ids.rule,
    columns: [
      exportColumn('export_rule_id', ids.rule, c.ruleId, 'RuleId'),
      exportColumn('export_profile_id', ids.rule, c.ruleProfileId, 'ProfileId'),
      exportColumn('export_event_type', ids.rule, c.eventTypeId, 'EventTypeId'),
      exportColumn('export_audience_side', ids.rule, c.audienceSide, 'AudienceSide'),
      exportColumn('export_priority', ids.rule, c.priority, 'Priority'),
    ],
  },
]

function exportColumn(exportColumnId: EntityId, sourceTableId: EntityId, sourceColumnId: EntityId, header: string) {
  return {
    exportColumnId,
    sourceTableId,
    sourceColumnId,
    header,
    transform: 'copy' as const,
  }
}

const layout: readonly CanvasNodeLayout[] = [
  { entityId: ids.zone, x: 0, y: 34 },
  { entityId: ids.profile, x: 210, y: 34 },
  { entityId: ids.rule, x: 420, y: 34 },
  { entityId: ids.ruleAction, x: 630, y: 34 },
  { entityId: ids.action, x: 630, y: 270 },
  { entityId: ids.animation, x: 840, y: 270 },
  { entityId: ids.eventType, x: 420, y: 312 },
  { entityId: ids.presetCharacter, x: 0, y: 300 },
  { entityId: ids.presetColor, x: 210, y: 300 },
  { entityId: ids.character, x: 0, y: 520 },
  { entityId: ids.color, x: 210, y: 520 },
]

export const crowdProject: SchemaProject = {
  projectId: ids.project,
  name: '관중 시스템 워크벤치 샘플',
  schemaVersion: '0.1.0',
  tables,
  enums: [
    {
      enumId: ids.audienceSide,
      name: 'AudienceSide',
      values: [
        { enumValueId: 'enum_value_home', name: 'Home', displayName: 'Home' },
        { enumValueId: 'enum_value_away', name: 'Away', displayName: 'Away' },
        { enumValueId: 'enum_value_neutral', name: 'Neutral', displayName: 'Neutral' },
      ],
    },
  ],
  relations,
  functionalDependencies,
  exportViews,
  layout: { nodes: layout },
  commandHistory: [],
}

function dataRow(rowId: string, cells: DataRow['cells']): DataRow {
  return { rowId, cells }
}

export const crowdSampleRows: RowsByTable = {
  [ids.zone]: [
    dataRow('row_zone_north_stand', {
      [c.zoneId]: 'north_stand',
      [c.capacity]: 8200,
      [c.density]: 0.78,
      [c.supportTeam]: 'Home',
      [c.visualPresetId]: 'preset_home_dense',
      [c.zoneProfileId]: 'profile_home_default',
      [c.defaultStateId]: 'idle_wave',
    }),
    dataRow('row_zone_away_corner', {
      [c.zoneId]: 'away_corner',
      [c.capacity]: 1800,
      [c.density]: 0.64,
      [c.supportTeam]: 'Away',
      [c.visualPresetId]: 'preset_away_corner',
      [c.zoneProfileId]: 'profile_away_default',
      [c.defaultStateId]: 'idle_clap',
    }),
  ],
  [ids.rule]: [
    dataRow('row_rule_goal_home_high', {
      [c.ruleId]: 'goal_home_high',
      [c.ruleProfileId]: 'profile_home_default',
      [c.eventTypeId]: 'goal',
      [c.audienceSide]: 'Home',
      [c.participationRate]: 0.95,
      [c.delayMin]: 0.1,
      [c.delayMax]: 0.6,
      [c.durationMin]: 5,
      [c.durationMax]: 8,
      [c.priority]: 100,
    }),
    dataRow('row_rule_foul_against_home', {
      [c.ruleId]: 'foul_against_home',
      [c.ruleProfileId]: 'profile_home_default',
      [c.eventTypeId]: 'foul',
      [c.audienceSide]: 'Home',
      [c.participationRate]: 0.72,
      [c.delayMin]: 0.2,
      [c.delayMax]: 1.1,
      [c.durationMin]: 2,
      [c.durationMax]: 4,
      [c.priority]: 60,
    }),
  ],
}

export const sampleIds = ids
