import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../domain/emptyProject'
import { crowdProject } from '../domain/sampleProject'
import {
  buildChatRequestMessages,
  buildChatSystemPrompt,
  MAX_HISTORY_MESSAGE_CHARS,
  MAX_PROMPT_CHARS,
  requestChatCompletion,
  type AiChatMessage,
} from './aiChat'
import { defaultOpenRouterSettings } from './openRouterProvider'

function createFetchStub(completionContent: string) {
  const bodies: string[] = []

  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url)

    if (href.endsWith('/models')) {
      return new Response(
        JSON.stringify({ data: [{ id: 'vendor/model:free', pricing: { prompt: '0', completion: '0' } }] }),
        { status: 200 },
      )
    }

    bodies.push(String(init?.body ?? ''))

    return new Response(
      JSON.stringify({
        choices: [{ message: { content: completionContent } }],
        usage: { prompt_tokens: 1234, completion_tokens: 56 },
      }),
      { status: 200 },
    )
  }) as unknown as typeof fetch

  return { bodies, fetchImpl }
}

describe('buildChatSystemPrompt', () => {
  it('빈 프로젝트임을 알리고 매번 검토하지 말라고 지시한다', () => {
    const prompt = buildChatSystemPrompt(createEmptyProject('내 게임'))

    expect(prompt).toContain('내 게임')
    expect(prompt).toContain('빈 프로젝트')
    expect(prompt).toContain('매번 스키마 검토를 늘어놓지 마세요')
  })

  it('테이블과 관계를 문맥으로 넣는다', () => {
    const prompt = buildChatSystemPrompt(crowdProject)

    expect(prompt).toContain(crowdProject.name)
    expect(prompt).toContain(`테이블 ${crowdProject.tables.length}개`)
    expect(prompt).toContain(crowdProject.tables[0]!.name)
  })

  it('외래키를 컬럼 옆에 붙여 적고 관계 목록을 따로 두지 않는다', () => {
    const prompt = buildChatSystemPrompt(crowdProject)

    expect(prompt).toContain('→')
    // 예전처럼 "관계 8개:" 블록을 중복해서 싣지 않는다.
    expect(prompt).not.toContain(`관계 ${crowdProject.relations.length}개:`)
  })

  it('한 답변에서 도구를 여러 개 호출해도 된다고 알려준다', () => {
    const prompt = buildChatSystemPrompt(crowdProject)

    expect(prompt).toContain('도구를 여러 개 이어서 호출해도 됩니다')
    expect(prompt).toContain('승인을 기다린다며 작업을 나누지 마세요')
  })

  it('행 데이터를 넘기지 않으면 행이 전혀 들어가지 않는다', () => {
    const table = crowdProject.tables[0]!
    const prompt = buildChatSystemPrompt(crowdProject, { focusTableId: table.tableId })

    expect(prompt).not.toContain('기존 데이터')
  })

  it('행 데이터를 넘겨도 앞 20행까지만 넣는다', () => {
    const table = crowdProject.tables[0]!
    const rows = Array.from({ length: 500 }, (_, index) => ({
      rowId: `row_${index}`,
      cells: { [table.columns[0]!.columnId]: `값${index}` },
    }))

    const prompt = buildChatSystemPrompt(crowdProject, {
      focusTableId: table.tableId,
      rowsByTable: { [table.tableId]: rows },
    })

    expect(prompt).toContain('500행 중 앞 20행')
    expect(prompt).toContain('값0')
    expect(prompt).toContain('값19')
    expect(prompt).not.toContain('값20\t')
    expect(prompt).not.toContain('값499')
  })

  it('테이블이 아주 많으면 관련된 것만 자세히 적고 나머지는 이름만 적는다', () => {
    const manyTables = {
      ...crowdProject,
      tables: [
        ...crowdProject.tables,
        ...Array.from({ length: 40 }, (_, index) => ({
          ...crowdProject.tables[0]!,
          tableId: `extra_${index}`,
          name: `ExtraTable${index}`,
        })),
      ],
    }

    const focus = crowdProject.tables[0]!
    const prompt = buildChatSystemPrompt(manyTables, { focusTableId: focus.tableId })

    expect(prompt).toContain(`지금 보고 있는 '${focus.name}'과 연결된 것만`)
    expect(prompt).toContain('나머지')
    expect(prompt).toContain('ExtraTable0')
    // 관련 없는 테이블의 컬럼 상세까지는 싣지 않는다.
    expect(prompt).not.toContain('- ExtraTable0[PK')
  })
})

describe('buildChatRequestMessages', () => {
  it('시스템 프롬프트를 맨 앞에 두고 기존 system 메시지는 버린다', () => {
    const thread: readonly AiChatMessage[] = [
      { role: 'system', content: '오래된 시스템' },
      { role: 'user', content: '안녕' },
      { role: 'assistant', content: '안녕하세요' },
    ]

    const messages = buildChatRequestMessages('새 시스템', thread)

    expect(messages[0]).toEqual({ role: 'system', content: '새 시스템' })
    expect(messages).toHaveLength(3)
    expect(messages.some((message) => message.content === '오래된 시스템')).toBe(false)
  })

  it('히스토리가 길면 최근 것만 남긴다', () => {
    const thread: readonly AiChatMessage[] = Array.from({ length: 30 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `메시지 ${index}`,
    }))

    const messages = buildChatRequestMessages('시스템', thread, 6)

    expect(messages).toHaveLength(7)
    expect(messages.at(-1)?.content).toBe('메시지 29')
  })
})

describe('requestChatCompletion', () => {
  it('대화 기록 전체를 보내고 응답 텍스트를 돌려준다', async () => {
    const { bodies, fetchImpl } = createFetchStub('안녕하세요. 무엇을 도와드릴까요?')

    const turn = await requestChatCompletion({
      messages: [
        { role: 'system', content: '시스템' },
        { role: 'user', content: '안녕' },
      ],
      settings: { ...defaultOpenRouterSettings, apiKey: 'sk-or-test', modelId: 'vendor/model:free' },
      fetchImpl,
    })

    expect(turn.content).toBe('안녕하세요. 무엇을 도와드릴까요?')
    expect(turn.toolCalls).toEqual([])
    // 비용은 추정하지 않고 응답이 알려준 실제 토큰 수를 쓴다.
    expect(turn.usage).toEqual({ promptTokens: 1234, completionTokens: 56 })

    const sent = JSON.parse(bodies[0]!) as { readonly messages: readonly AiChatMessage[]; readonly tools?: unknown }
    expect(sent.messages).toHaveLength(2)
    expect(sent.messages[0]!.role).toBe('system')
    expect(sent.messages[1]!.content).toBe('안녕')
    expect(sent.tools).toBeUndefined()
  })

  it('도구를 넘기면 요청에 싣고, 응답의 tool_calls를 파싱한다', async () => {
    const toolCallResponse = {
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'create_table', arguments: '{"name":"Item"}' },
          }],
        },
      }],
    }

    const bodies: string[] = []
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url)

      if (href.endsWith('/models')) {
        return new Response(
          JSON.stringify({ data: [{ id: 'vendor/model:free', pricing: { prompt: '0', completion: '0' } }] }),
          { status: 200 },
        )
      }

      bodies.push(String(init?.body ?? ''))
      return new Response(JSON.stringify(toolCallResponse), { status: 200 })
    }) as unknown as typeof fetch

    const turn = await requestChatCompletion({
      messages: [{ role: 'user', content: '아이템 테이블 만들어줘' }],
      settings: { ...defaultOpenRouterSettings, apiKey: 'sk-or-test', modelId: 'vendor/model:free' },
      tools: [{ type: 'function', function: { name: 'create_table' } }],
      fetchImpl,
    })

    expect(turn.content).toBeNull()
    expect(turn.toolCalls).toHaveLength(1)
    expect(turn.toolCalls[0]!.name).toBe('create_table')
    expect(turn.toolCalls[0]!.argumentsJson).toBe('{"name":"Item"}')

    const sent = JSON.parse(bodies[0]!) as { readonly tools?: readonly unknown[]; readonly tool_choice?: string }
    expect(sent.tools).toHaveLength(1)
    expect(sent.tool_choice).toBe('auto')
  })

  it('대화에서는 행 샘플 전송을 허용한다 (상한은 프롬프트 생성 단계가 강제)', async () => {
    const { fetchImpl } = createFetchStub('알겠습니다')

    const turn = await requestChatCompletion({
      messages: [{ role: 'user', content: '안녕' }],
      settings: {
        ...defaultOpenRouterSettings,
        sendRowData: true,
        requireStructuredOutput: false,
        apiKey: 'sk-or-test',
        modelId: 'vendor/model:free',
      },
      fetchImpl,
    })

    expect(turn.content).toBe('알겠습니다')
  })

  it('스키마 검토 요청에는 행 데이터를 함께 보낼 수 없다', async () => {
    const { fetchImpl } = createFetchStub('무시됨')

    await expect(requestChatCompletion({
      messages: [{ role: 'user', content: '안녕' }],
      settings: {
        ...defaultOpenRouterSettings,
        sendRowData: true,
        requireStructuredOutput: true,
        apiKey: 'sk-or-test',
        modelId: 'vendor/model:free',
      },
      fetchImpl,
    })).rejects.toThrow('행 데이터를 함께 보낼 수 없습니다')
  })
})

describe('토큰 과사용 방지', () => {
  it('긴 이전 답변은 잘라서 보내고 지금 질문은 남긴다', () => {
    const long = '가'.repeat(MAX_HISTORY_MESSAGE_CHARS * 3)
    const thread: AiChatMessage[] = [
      { role: 'user', content: '몬스터 표 만들어줘' },
      { role: 'assistant', content: long },
      { role: 'user', content: '이제 아이템 표도' },
    ]
    const messages = buildChatRequestMessages('시스템', thread)
    expect(messages[2].content.length).toBeLessThan(MAX_HISTORY_MESSAGE_CHARS + 20)
    expect(messages.at(-1)?.content).toBe('이제 아이템 표도')
  })

  it('대화가 아무리 길어도 전체 글자 상한을 넘지 않는다', () => {
    const thread: AiChatMessage[] = Array.from({ length: 200 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `${index} ${'나'.repeat(1400)}`,
    }))
    const messages = buildChatRequestMessages('시스템', thread)
    const total = messages.reduce((sum, message) => sum + message.content.length, 0)
    expect(total).toBeLessThanOrEqual(MAX_PROMPT_CHARS)
    expect(messages.at(-1)?.content.startsWith('199 ')).toBe(true)
  })

  it('답변 길이 상한(max_tokens)을 요청에 넣는다', async () => {
    const { fetchImpl, bodies } = createFetchStub('좋아요')
    await requestChatCompletion({ messages: [{ role: 'user', content: '안녕' }], settings: defaultOpenRouterSettings, fetchImpl })
    expect(JSON.parse(bodies.at(-1) ?? '{}').max_tokens).toBeGreaterThan(0)
  })
})
