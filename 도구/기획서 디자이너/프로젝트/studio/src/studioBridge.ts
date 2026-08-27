import type { DeckStudioLibrary } from './deckEngine'

const CHANNEL = 'gds:tool'
const pending = new Map<string, (message: ArtifactResponse) => void>()
let listening = false

export type PublishedArtifact = {
  artifactId: string
  toolId?: string
  catalogId?: string
  kind: string
  title: string
  revision?: string | number
  fingerprint?: string
  publishedAt?: string
  summary?: string
  data?: unknown
}

type ArtifactResponse =
  | { type: 'artifact:data'; requestId: string; found: boolean; revision: number; backupCount: number; savedAt?: string; data: unknown }
  | { type: 'artifact:saved'; requestId: string; revision: number; backupCount: number; savedAt: string }
  | { type: 'artifact:conflict'; requestId: string; expectedRevision: number; actualRevision: number; savedAt?: string; data: unknown }
  | { type: 'artifact:catalog'; requestId: string; records: PublishedArtifact[] }
  | { type: 'ai:keyStatus'; requestId: string; configured: boolean; budget: AiBudget }
  | { type: 'ai:models'; requestId: string; models: OpenRouterModel[]; budget: AiBudget }
  | { type: 'ai:response'; requestId: string; result: unknown; charged: number; budget: AiBudget }
  | { type: 'ai:error'; requestId: string; message: string }

export type AiBudget = { month: string; limit: number; spent: number; remaining: number }
export type OpenRouterModel = {
  id: string
  name: string
  contextLength: number
  pricing: { prompt?: string; completion?: string; request?: string }
}

const requestId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`

const startListening = (): void => {
  if (listening) return
  listening = true
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.data?.channel !== CHANNEL) return
    const response = event.data as ArtifactResponse & { channel: string }
    const resolve = pending.get(response.requestId)
    if (!resolve) return
    pending.delete(response.requestId)
    resolve(response)
  })
}

const send = <T extends ArtifactResponse>(message: Record<string, unknown>): Promise<T> => {
  startListening()
  return new Promise((resolve, reject) => {
    const id = String(message.requestId)
    const timeout = window.setTimeout(() => {
      pending.delete(id)
      reject(new Error('게임기획 스튜디오 저장 응답 시간이 초과되었습니다.'))
    }, 10000)
    pending.set(id, (response) => {
      window.clearTimeout(timeout)
      resolve(response as T)
    })
    window.parent.postMessage({ channel: CHANNEL, ...message }, window.location.origin)
  })
}

export const isStudioHosted = (): boolean =>
  new URLSearchParams(window.location.search).get('host') === 'studio' && window.parent !== window

export const isStudioWorkspace = (): boolean =>
  isStudioHosted() && (new URLSearchParams(window.location.search).get('workspaceId') || 'standalone') !== 'standalone'

export const loadStudioLibrary = async (): Promise<Extract<ArtifactResponse, { type: 'artifact:data' }>> => {
  const id = requestId('deck-load')
  return send({ type: 'artifact:load', requestId: id, artifactId: 'library' })
}

export const saveStudioLibrary = async (
  library: DeckStudioLibrary,
  expectedRevision: number,
  force = false
): Promise<Extract<ArtifactResponse, { type: 'artifact:saved' | 'artifact:conflict' }>> => {
  const id = requestId('deck-save')
  return send({
    type: 'artifact:save', requestId: id, artifactId: 'library', expectedRevision, force, data: library
  })
}

export const listStudioArtifacts = async (): Promise<PublishedArtifact[]> => {
  const id = requestId('deck-catalog')
  const response = await send<Extract<ArtifactResponse, { type: 'artifact:catalog' }>>({
    type: 'artifact:list', requestId: id
  })
  return response.records
}

const aiRequest = async <T extends ArtifactResponse>(message: Record<string, unknown>): Promise<T> => {
  if (!isStudioHosted()) throw new Error('AI 연결은 게임기획 스튜디오 안에서만 사용할 수 있습니다.')
  const response = await send<T>(message)
  if (response.type === 'ai:error') throw new Error(response.message)
  return response
}

export const getOpenRouterStatus = (monthlyLimit: number) => aiRequest<Extract<ArtifactResponse, { type: 'ai:keyStatus' }>>({
  type: 'ai:keyStatus', requestId: requestId('ai-status'), monthlyLimit
})

export const saveOpenRouterKey = (key: string, monthlyLimit: number) => aiRequest<Extract<ArtifactResponse, { type: 'ai:keyStatus' }>>({
  type: 'ai:keySave', requestId: requestId('ai-key-save'), key, monthlyLimit
})

export const deleteOpenRouterKey = (monthlyLimit: number) => aiRequest<Extract<ArtifactResponse, { type: 'ai:keyStatus' }>>({
  type: 'ai:keyDelete', requestId: requestId('ai-key-delete'), monthlyLimit
})

export const loadOpenRouterModels = (monthlyLimit: number) => aiRequest<Extract<ArtifactResponse, { type: 'ai:models' }>>({
  type: 'ai:models', requestId: requestId('ai-models'), monthlyLimit
})

export const requestOpenRouterOutline = (options: {
  model: string
  messages: Array<{ role: 'system' | 'user'; content: string }>
  maxTokens: number
  estimatedCost: number
  perRequestLimit: number
  monthlyLimit: number
}) => aiRequest<Extract<ArtifactResponse, { type: 'ai:response' }>>({
  type: 'ai:complete', requestId: requestId('ai-outline'), temperature: 0.2, ...options
})
