import { normalizeThinkingParameterMode } from '@shared/model-config'

interface ModelConfigRowLike {
  id: string
  name: string
  provider: string
  model: string
  apiKey: string
  baseUrl: string
  maxTokens?: number | null
  disableTemperature?: number | boolean | null
  thinkingParameterMode?: string | null
  active: number | boolean
  createdAt: number
  updatedAt: number
}

export const toPublicModelConfig = (
  config: ModelConfigRowLike,
  decryptApiKey: (value: string) => string
) => ({
  id: config.id,
  name: config.name,
  provider: config.provider,
  model: config.model,
  apiKey: '',
  hasApiKey: decryptApiKey(config.apiKey).trim().length > 0,
  baseUrl: config.baseUrl,
  maxTokens: config.maxTokens || 4096,
  disableTemperature: config.disableTemperature === 1 || config.disableTemperature === true,
  thinkingParameterMode: normalizeThinkingParameterMode(config.thinkingParameterMode),
  active: config.active === 1 || config.active === true,
  createdAt: config.createdAt,
  updatedAt: config.updatedAt
})
