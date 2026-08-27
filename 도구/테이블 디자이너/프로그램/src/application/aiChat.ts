import { assertOpenRouterPolicy, fetchOpenRouterCatalog, type OpenRouterSettings } from './openRouterProvider'
import type { AiToolCall } from './aiTools'
import type { EntityId, RowsByTable, SchemaProject, SchemaTable } from '../domain/schema'

export type AiChatRole = 'system' | 'user' | 'assistant'

export interface AiChatMessage {
  readonly role: AiChatRole
  readonly content: string
}

/** OpenRouter가 응답에 실제로 돌려주는 토큰 사용량. 추정치보다 항상 이걸 우선한다. */
export interface AiTokenUsage {
  readonly promptTokens: number
  readonly completionTokens: number
}

export interface AiChatTurn {
  readonly content: string | null
  readonly toolCalls: readonly AiToolCall[]
  readonly usage: AiTokenUsage | null
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
export const MAX_CHAT_HISTORY = 20
/** AI에게 보여줄 기존 행의 최대 개수. 이 상한은 호출자가 아니라 여기서 강제한다. */
export const MAX_SAMPLE_ROWS = 20
/** 테이블이 이보다 많으면 관련 테이블만 자세히 적고 나머지는 이름만 적는다. */
const DETAIL_TABLE_LIMIT = 25

const TYPE_SHORTHAND: Readonly<Record<string, string>> = {
  string: 's',
  int32: 'i',
  int64: 'i64',
  float: 'f',
  double: 'd',
  boolean: 'b',
  enum: 'e',
  date: 'date',
  datetime: 'dt',
  resource_ref: 'res',
  localization_ref: 'loc',
  json: 'json',
  list: 'list',
}

/** columnId -> "TargetTable.TargetColumn". FK를 컬럼 옆에 붙여 적어 관계 목록 중복을 없앤다. */
function buildForeignKeyLabels(project: SchemaProject): ReadonlyMap<EntityId, string> {
  const labels = new Map<EntityId, string>()

  for (const relation of project.relations) {
    const targetTable = project.tables.find((table) => table.tableId === relation.targetTableId)
    if (!targetTable) continue

    relation.sourceColumnIds.forEach((sourceColumnId, index) => {
      const targetColumnId = relation.targetColumnIds[index] ?? relation.targetColumnIds[0]
      const targetColumn = targetTable.columns.find((column) => column.columnId === targetColumnId)
      if (targetColumn) labels.set(sourceColumnId, `${targetTable.name}.${targetColumn.name}`)
    })
  }

  return labels
}

function describeTable(table: SchemaTable, foreignKeyLabels: ReadonlyMap<EntityId, string>): string {
  const primaryKeyNames = table.primaryKey.columnIds
    .map((columnId) => table.columns.find((column) => column.columnId === columnId)?.name)
    .filter((name): name is string => Boolean(name))

  const columns = table.columns
    .map((column) => {
      const type = TYPE_SHORTHAND[column.dataType.kind] ?? column.dataType.kind
      const foreignKey = foreignKeyLabels.get(column.columnId)
      return `${column.name}:${type}${foreignKey ? `→${foreignKey}` : ''}`
    })
    .join(', ')

  return `- ${table.name}[PK ${primaryKeyNames.join('+') || '없음'}] ${columns || '컬럼 없음'}`
}

/** focus 테이블과 그것에 FK로 연결된 테이블만 추린다. */
function relatedTableIds(project: SchemaProject, focusTableId: EntityId): ReadonlySet<EntityId> {
  const ids = new Set<EntityId>([focusTableId])

  for (const relation of project.relations) {
    if (relation.sourceTableId === focusTableId) ids.add(relation.targetTableId)
    if (relation.targetTableId === focusTableId) ids.add(relation.sourceTableId)
  }

  return ids
}

function buildSampleRowLines(table: SchemaTable, rowsByTable: RowsByTable): readonly string[] {
  const rows = (rowsByTable[table.tableId] ?? []).slice(0, MAX_SAMPLE_ROWS)
  if (rows.length === 0) return []

  const total = (rowsByTable[table.tableId] ?? []).length
  const header = table.columns.map((column) => column.name).join('\t')
  const body = rows.map((row) =>
    table.columns
      .map((column) => {
        const value = row.cells[column.columnId]
        return value === undefined || value === null ? '' : String(value)
      })
      .join('\t'),
  )

  return [
    '',
    `${table.name}의 기존 데이터 ${total.toLocaleString()}행 중 앞 ${rows.length}행 (스타일 참고용):`,
    header,
    ...body,
  ]
}

export function buildChatSystemPrompt(
  project: SchemaProject,
  options: {
    readonly focusTableId?: EntityId
    /** 넘기면 focus 테이블의 앞 20행만 붙는다. 넘기지 않으면 행은 전혀 보내지 않는다. */
    readonly rowsByTable?: RowsByTable
  } = {},
): string {
  const foreignKeyLabels = buildForeignKeyLabels(project)
  const focusTable = options.focusTableId
    ? project.tables.find((table) => table.tableId === options.focusTableId)
    : undefined

  let schemaLines: readonly string[]

  if (project.tables.length === 0) {
    schemaLines = ['아직 테이블이 하나도 없는 빈 프로젝트입니다.']
  } else if (project.tables.length <= DETAIL_TABLE_LIMIT || !focusTable) {
    schemaLines = [
      `테이블 ${project.tables.length}개 (타입: s=문자, i=정수, f=실수, b=참거짓, e=열거, →는 외래키):`,
      ...project.tables.slice(0, DETAIL_TABLE_LIMIT).map((table) => describeTable(table, foreignKeyLabels)),
      ...(project.tables.length > DETAIL_TABLE_LIMIT
        ? [`그 외 ${project.tables.length - DETAIL_TABLE_LIMIT}개: ${project.tables.slice(DETAIL_TABLE_LIMIT).map((table) => table.name).join(', ')}`,
          '자세한 내용이 필요한 테이블이 있으면 이름을 말하고 물어보세요.']
        : []),
    ]
  } else {
    // 테이블이 많으면 지금 보고 있는 것과 연결된 것만 자세히, 나머지는 이름만 보낸다.
    const related = relatedTableIds(project, focusTable.tableId)
    const detailed = project.tables.filter((table) => related.has(table.tableId))
    const others = project.tables.filter((table) => !related.has(table.tableId))

    schemaLines = [
      `테이블 ${project.tables.length}개. 지금 보고 있는 '${focusTable.name}'과 연결된 것만 자세히 적습니다.`,
      '(타입: s=문자, i=정수, f=실수, b=참거짓, e=열거, →는 외래키)',
      ...detailed.map((table) => describeTable(table, foreignKeyLabels)),
      '',
      `나머지 ${others.length}개 테이블 이름: ${others.map((table) => table.name).join(', ')}`,
      '이 중 자세한 내용이 필요하면 이름을 말하고 물어보세요.',
    ]
  }

  const sampleLines = focusTable && options.rowsByTable
    ? buildSampleRowLines(focusTable, options.rowsByTable)
    : []

  return [
    '당신은 게임 기획자와 함께 게임 데이터 테이블을 설계하는 작업 파트너입니다.',
    '',
    '대화 규칙:',
    '- 한국어로, 간결하고 구체적으로 답합니다.',
    '- 사용자가 인사하거나 가벼운 질문을 하면 평범하게 대화하세요. 매번 스키마 검토를 늘어놓지 마세요.',
    '- 구조를 제안할 때는 정규화와 확장성의 근거를 함께 설명합니다.',
    '- 확실하지 않으면 모른다고 말합니다. 지어내지 마세요.',
    '- 한 번의 답변에서 도구를 여러 개 이어서 호출해도 됩니다. 같은 답변에서 만든 테이블에는 곧바로 행을 넣을 수 있습니다.',
    '  예: "아이템 표 만들고 1000행 채워줘" -> create_table 다음에 insert_rows를 한 번에 호출하세요.',
    '- 도구 호출은 제안일 뿐이고 사용자가 승인해야 적용됩니다. 승인을 기다린다며 작업을 나누지 마세요.',
    '',
    `현재 프로젝트: ${project.name}`,
    ...schemaLines,
    ...sampleLines,
  ].join('\n')
}

export function buildChatRequestMessages(
  systemPrompt: string,
  thread: readonly AiChatMessage[],
  maxHistory: number = MAX_CHAT_HISTORY,
): readonly AiChatMessage[] {
  const history = thread.filter((message) => message.role !== 'system').slice(-maxHistory)

  return [{ role: 'system', content: systemPrompt }, ...history]
}

export async function requestChatCompletion(input: {
  readonly messages: readonly AiChatMessage[]
  readonly settings: OpenRouterSettings
  readonly tools?: readonly unknown[]
  readonly signal?: AbortSignal
  readonly fetchImpl?: typeof fetch
}): Promise<AiChatTurn> {
  const fetchImpl = input.fetchImpl ?? fetch
  const catalog = await fetchOpenRouterCatalog({ apiKey: input.settings.apiKey, fetchImpl })
  const selectedModel = input.settings.modelId
    ? catalog.models.find((candidate) => candidate.id === input.settings.modelId)
    : undefined

  if (input.settings.modelId && !selectedModel) {
    throw new Error(`${input.settings.modelId} 모델이 현재 OpenRouter 카탈로그에 없습니다.`)
  }

  const model = selectedModel ?? [...catalog.freeModels].sort((left, right) => left.id.localeCompare(right.id))[0]

  if (!model) {
    throw new Error('이 요청에 사용할 수 있는 무료 OpenRouter 모델이 없습니다.')
  }

  assertOpenRouterPolicy(input.settings, model)

  const response = await fetchImpl(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.settings.apiKey?.trim() ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model.id,
      messages: input.messages,
      temperature: 0.6,
      ...(input.tools && input.tools.length > 0 ? { tools: input.tools, tool_choice: 'auto' } : {}),
    }),
    signal: input.signal,
  })

  if (!response.ok) {
    throw new Error(`OpenRouter 대화 요청이 ${response.status} 상태로 실패했습니다.`)
  }

  const payload = await response.json() as {
    readonly choices?: readonly {
      readonly message?: {
        readonly content?: string
        readonly tool_calls?: readonly {
          readonly id?: string
          readonly function?: { readonly name?: string; readonly arguments?: string }
        }[]
      }
    }[]
    readonly usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number }
  }
  const message = payload.choices?.[0]?.message
  const content = message?.content?.trim() ?? null
  const toolCalls: readonly AiToolCall[] = (message?.tool_calls ?? []).flatMap((call, index) => {
    const name = call.function?.name

    return name
      ? [{ id: call.id ?? `tool_call_${index}`, name, argumentsJson: call.function?.arguments ?? '{}' }]
      : []
  })

  if (!content && toolCalls.length === 0) {
    throw new Error('OpenRouter가 빈 응답을 반환했습니다.')
  }

  const promptTokens = payload.usage?.prompt_tokens
  const completionTokens = payload.usage?.completion_tokens
  const usage = typeof promptTokens === 'number' && typeof completionTokens === 'number'
    ? { promptTokens, completionTokens }
    : null

  return { content, toolCalls, usage }
}
