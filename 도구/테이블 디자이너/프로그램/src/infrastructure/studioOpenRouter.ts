import { isStudioHosted } from './studioSharedProjectRepository'

/**
 * 게임기획 스튜디오 안에서는 OpenRouter 키와 월 예산을 스튜디오가 한곳에서 관리한다.
 * 이 파일은 OpenRouter로 가는 요청을 스튜디오에 대신 보내는 fetch 대용품이다.
 * 키는 도구(iframe)로 넘어오지 않는다. 한 번 저장하면 모든 도구가 같이 쓰고, 껐다 켜도 남는다.
 */
const CHANNEL = 'gds:tool'
const REPLY_TYPES = new Set(['ai:keyStatus', 'ai:models', 'ai:response', 'ai:error'])

interface StudioReply {
  readonly type: string
  readonly requestId: string
  readonly message?: string
  readonly configured?: boolean
  readonly models?: readonly unknown[]
  readonly result?: unknown
}

function askStudio(request: Record<string, unknown>, timeoutMs = 120_000): Promise<StudioReply> {
  const requestId = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', handle)
      reject(new Error('게임기획 스튜디오가 AI 요청에 응답하지 않습니다.'))
    }, timeoutMs)
    const handle = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return
      const data = event.data as StudioReply
      if (!data || data.requestId !== requestId || !REPLY_TYPES.has(data.type)) return
      window.clearTimeout(timeout)
      window.removeEventListener('message', handle)
      if (data.type === 'ai:error') reject(new Error(data.message ?? 'AI 요청에 실패했습니다.'))
      else resolve(data)
    }
    window.addEventListener('message', handle)
    window.parent.postMessage({ channel: CHANNEL, requestId, ...request }, window.location.origin)
  })
}

const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })

/** OpenRouter의 /models, /chat/completions만 흉내 낸다. */
export const studioOpenRouterFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.endsWith('/models')) {
    const reply = await askStudio({ type: 'ai:models' }, 30_000)
    return json({ data: reply.models ?? [] })
  }
  if (url.endsWith('/chat/completions')) {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      model?: string; messages?: unknown[]; tools?: unknown[]; max_tokens?: number; temperature?: number
    }
    const reply = await askStudio({
      type: 'ai:complete',
      model: body.model ?? '',
      messages: body.messages ?? [],
      tools: body.tools,
      maxTokens: body.max_tokens ?? 2000,
      temperature: body.temperature ?? 0.6,
      estimatedCost: 0,
    })
    return json(reply.result ?? {})
  }
  throw new Error(`스튜디오 경유로 지원하지 않는 OpenRouter 요청입니다: ${url}`)
}

/** 스튜디오 안이면 스튜디오 경유, 아니면 브라우저 fetch. */
export function defaultOpenRouterFetch(): typeof fetch {
  return isStudioHosted() ? studioOpenRouterFetch : fetch.bind(globalThis)
}

export async function studioKeyConfigured(): Promise<boolean> {
  const reply = await askStudio({ type: 'ai:keyStatus' }, 10_000)
  return reply.configured === true
}

export async function studioSaveKey(key: string): Promise<boolean> {
  const reply = await askStudio({ type: 'ai:keySave', key }, 10_000)
  return reply.configured === true
}

export async function studioDeleteKey(): Promise<void> {
  await askStudio({ type: 'ai:keyDelete' }, 10_000)
}
