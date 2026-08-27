import { normalizeAiRuntimeSettings } from '@shared/ai-budget'
import type { AiProviderStatus } from '@shared/ai-provider'
import {
  CodexLocalStructuredProvider,
  OfflineStructuredProvider,
  OpenRouterStructuredProvider,
  StructuredAiRuntime,
  type StructuredAiProvider,
  probeCodexLocalRuntime
} from '../../agent-runtime/model'
import type { IpcContext } from './context'
import { DbAiCostLedger } from './ai-cost-ledger'

const isOpenRouterConfig = (baseUrl: string): boolean => {
  try {
    return new URL(baseUrl).hostname.toLowerCase() === 'openrouter.ai'
  } catch {
    return false
  }
}

export const createStructuredAiRuntime = async (ctx: IpcContext): Promise<StructuredAiRuntime> => {
  const settings = normalizeAiRuntimeSettings(await ctx.db.getSetting('ai_runtime'))
  const configs = await ctx.db.listModelConfigs()
  const openRouterConfig = configs.find((config) => isOpenRouterConfig(config.baseUrl.trim()))
  const openRouterApiKey = openRouterConfig ? ctx.decryptApiKey(openRouterConfig.apiKey).trim() : ''
  const codexStatus = await probeCodexLocalRuntime()
  const openRouterStatus: AiProviderStatus = {
    id: 'openrouter',
    available: Boolean(openRouterConfig && openRouterApiKey),
    authenticated: Boolean(openRouterConfig && openRouterApiKey),
    billingMode: 'metered',
    detail: openRouterConfig && openRouterApiKey ? 'configured' : 'not-configured'
  }
  const offlineStatus: AiProviderStatus = {
    id: 'offline',
    available: true,
    authenticated: true,
    billingMode: 'offline',
    detail: 'manual-editing-and-export'
  }
  const providers: StructuredAiProvider[] = [
    new CodexLocalStructuredProvider(),
    new OfflineStructuredProvider()
  ]
  if (openRouterConfig && openRouterApiKey) {
    providers.push(
      new OpenRouterStructuredProvider({
        apiKey: openRouterApiKey,
        model: openRouterConfig.model,
        baseUrl: openRouterConfig.baseUrl
      })
    )
  }
  return new StructuredAiRuntime({
    settings,
    providers,
    providerStatuses: [codexStatus, openRouterStatus, offlineStatus],
    ledger: new DbAiCostLedger(ctx.db)
  })
}
