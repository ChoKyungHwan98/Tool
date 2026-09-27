import type { PublishedArtifactRecord, StudioCommand } from './types'

export const TOOL_BRIDGE_CHANNEL = 'gds:tool'

export interface ToolBridgeRequest {
  channel: typeof TOOL_BRIDGE_CHANNEL
  type: 'artifact:load' | 'artifact:save' | 'artifact:list' | 'artifact:publish'
    | 'ai:keyStatus' | 'ai:keySave' | 'ai:keyDelete' | 'ai:models' | 'ai:complete'
    | 'tableProject:list' | 'tableProject:write' | 'tableProject:trash'
    | 'tableChat:load' | 'tableChat:save'
  requestId: string
  toolId?: string
  artifactId?: string
  expectedRevision?: number
  force?: boolean
  data?: unknown
  record?: unknown
  key?: string
  monthlyLimit?: number
  perRequestLimit?: number
  estimatedCost?: number
  model?: string
  messages?: Array<{ role: string; content: unknown; [key: string]: unknown }>
  tools?: unknown[]
  maxTokens?: number
  temperature?: number
  projectId?: string
  name?: string
  serializedDocument?: string
}

export function commandFromToolMessage(data: unknown, actualToolId: string): StudioCommand | null {
  if (!data || typeof data !== 'object') return null
  const request = data as Partial<ToolBridgeRequest>
  if (request.channel !== TOOL_BRIDGE_CHANNEL || typeof request.requestId !== 'string') return null

  if (request.type === 'tableChat:load' || request.type === 'tableChat:save') {
    if (actualToolId !== 'table-designer' || typeof request.projectId !== 'string') return null
    if (request.type === 'tableChat:load') return { type: request.type, requestId: request.requestId, projectId: request.projectId }
    return { type: request.type, requestId: request.requestId, projectId: request.projectId, data: request.data ?? {} }
  }

  if (request.type?.startsWith('tableProject:')) {
    if (actualToolId !== 'table-designer') return null
    if (request.type === 'tableProject:list') {
      return { type: request.type, requestId: request.requestId }
    }
    if (request.type === 'tableProject:trash' && typeof request.projectId === 'string') {
      return { type: request.type, requestId: request.requestId, projectId: request.projectId }
    }
    if (
      request.type === 'tableProject:write'
      && typeof request.projectId === 'string'
      && typeof request.name === 'string'
      && typeof request.serializedDocument === 'string'
    ) {
      return {
        type: request.type, requestId: request.requestId, projectId: request.projectId,
        name: request.name, serializedDocument: request.serializedDocument,
      }
    }
    return null
  }

  if (request.type === 'artifact:list') {
    return { type: 'artifact:list', requestId: request.requestId }
  }
  if (request.type === 'artifact:load' && typeof request.artifactId === 'string') {
    return {
      type: 'artifact:load', requestId: request.requestId,
      toolId: actualToolId, artifactId: request.artifactId,
    }
  }
  if (
    request.type === 'artifact:save'
    && typeof request.artifactId === 'string'
    && typeof request.expectedRevision === 'number'
  ) {
    return {
      type: 'artifact:save', requestId: request.requestId,
      toolId: actualToolId, artifactId: request.artifactId,
      expectedRevision: request.expectedRevision, force: request.force, data: request.data,
    }
  }
  if (request.type === 'artifact:publish' && request.record && typeof request.record === 'object') {
    const record = request.record as Record<string, unknown>
    if (
      typeof record.artifactId !== 'string'
      || typeof record.kind !== 'string'
      || typeof record.title !== 'string'
    ) return null
    return {
      type: 'artifact:publish', requestId: request.requestId,
      toolId: actualToolId,
      record: record as unknown as PublishedArtifactRecord,
    }
  }
  const monthlyLimit = typeof request.monthlyLimit === 'number' ? request.monthlyLimit : 10
  if (request.type === 'ai:keyStatus') return { type: request.type, requestId: request.requestId, monthlyLimit }
  if (request.type === 'ai:keyDelete') return { type: request.type, requestId: request.requestId, monthlyLimit }
  if (request.type === 'ai:keySave' && typeof request.key === 'string') {
    return { type: request.type, requestId: request.requestId, key: request.key, monthlyLimit }
  }
  if (request.type === 'ai:models') return { type: request.type, requestId: request.requestId, monthlyLimit }
  if (
    request.type === 'ai:complete'
    && typeof request.model === 'string'
    && Array.isArray(request.messages)
  ) {
    return {
      type: request.type, requestId: request.requestId, model: request.model,
      messages: request.messages, maxTokens: request.maxTokens || 1600,
      ...(Array.isArray(request.tools) && request.tools.length > 0 ? { tools: request.tools } : {}),
      temperature: request.temperature ?? 0.2, estimatedCost: request.estimatedCost || 0,
      perRequestLimit: request.perRequestLimit ?? 0.5, monthlyLimit,
    }
  }
  return null
}
