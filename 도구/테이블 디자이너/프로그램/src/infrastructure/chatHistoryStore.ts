import type { EntityId } from '../domain/schema'
import { isStudioHosted } from './studioSharedProjectRepository'

/**
 * AI 대화 기록. 프로젝트마다 한 파일이고, 표 파일(.gsw)과 분리해 둔다.
 * - 스튜디오 안: `테이블 디자이너/프로젝트/.table-designer/chats/<프로젝트ID>.json` (스튜디오가 씀)
 * - 단독 실행·브라우저: 이 앱의 로컬 저장소
 * API 키는 절대 넣지 않는다.
 */
export interface StoredChatMessage {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly content: string
  readonly createdAt: string
}

export interface StoredConversation {
  readonly id: string
  readonly title: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly messages: readonly StoredChatMessage[]
  /** 이 대화에서 쓴 토큰 합계(OpenRouter가 알려준 실제 사용량). */
  readonly tokens: { readonly input: number; readonly output: number }
}

export interface ChatHistoryFile {
  readonly version: 1
  readonly activeConversationId: string | null
  readonly conversations: readonly StoredConversation[]
}

export const EMPTY_CHAT_HISTORY: ChatHistoryFile = { version: 1, activeConversationId: null, conversations: [] }

/** 한 프로젝트에 남기는 대화 수. 오래된 것부터 지운다. */
export const MAX_STORED_CONVERSATIONS = 50

const CHANNEL = 'gds:tool'
const LOCAL_PREFIX = 'gsw-chat:'

function normalize(value: unknown): ChatHistoryFile {
  if (!value || typeof value !== 'object') return EMPTY_CHAT_HISTORY
  const raw = value as Partial<ChatHistoryFile>
  const conversations = Array.isArray(raw.conversations)
    ? raw.conversations.filter((item): item is StoredConversation =>
      Boolean(item) && typeof item.id === 'string' && Array.isArray(item.messages))
      .map((item) => ({ ...item, tokens: item.tokens ?? { input: 0, output: 0 } }))
    : []
  const activeConversationId = typeof raw.activeConversationId === 'string'
    && conversations.some((item) => item.id === raw.activeConversationId)
    ? raw.activeConversationId
    : null
  return { version: 1, activeConversationId, conversations }
}

function requestStudio<T>(request: Record<string, unknown>, expectedType: string): Promise<T> {
  const requestId = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', handle)
      reject(new Error('게임기획 스튜디오가 대화 저장 요청에 응답하지 않습니다.'))
    }, 10_000)
    const handle = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return
      const data = event.data as { requestId?: string; type?: string }
      if (!data || data.requestId !== requestId || data.type !== expectedType) return
      window.clearTimeout(timeout)
      window.removeEventListener('message', handle)
      resolve(data as T)
    }
    window.addEventListener('message', handle)
    window.parent.postMessage({ channel: CHANNEL, requestId, ...request }, window.location.origin)
  })
}

export async function loadChatHistory(projectId: EntityId): Promise<ChatHistoryFile> {
  if (isStudioHosted()) {
    const response = await requestStudio<{ data: unknown }>({ type: 'tableChat:load', projectId }, 'tableChat:data')
    return normalize(response.data)
  }
  try {
    const text = window.localStorage.getItem(LOCAL_PREFIX + projectId)
    return text ? normalize(JSON.parse(text)) : EMPTY_CHAT_HISTORY
  } catch {
    return EMPTY_CHAT_HISTORY
  }
}

export async function saveChatHistory(projectId: EntityId, history: ChatHistoryFile): Promise<void> {
  const trimmed: ChatHistoryFile = {
    ...history,
    conversations: [...history.conversations]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, MAX_STORED_CONVERSATIONS),
  }
  if (isStudioHosted()) {
    await requestStudio({ type: 'tableChat:save', projectId, data: trimmed }, 'tableChat:saved')
    return
  }
  try {
    window.localStorage.setItem(LOCAL_PREFIX + projectId, JSON.stringify(trimmed))
  } catch {
    // 저장 공간이 없으면 이번 저장만 건너뛴다. 대화는 화면에 남아 있다.
  }
}
