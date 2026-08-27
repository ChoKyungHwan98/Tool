import { BrowserWindow, app, dialog, ipcMain } from 'electron'
import log from 'electron-log/main.js'
import { resolveModel } from '../agent-runtime/model'
import { applyProxy } from '../utils/proxy'
import type { IpcContext } from '../ipc/context'
import {
  CONFIGURABLE_MODEL_TIMEOUT_PROFILES,
  type ConfigurableModelTimeoutProfile,
  resolveModelTimeoutMs
} from '@shared/model-timeout'
import { readAppLocale, uiText } from './locale-utils'
import {
  OPENAI_RESPONSES_FORMAT_ERROR_EN,
  OPENAI_RESPONSES_FORMAT_ERROR_ZH,
  isOpenAIResponsesFormatError,
  runWithModelTemperatureControl
} from '../agent-runtime/model'
import type { ModelUsagePeriod } from '@shared/model-usage'
import { normalizeThinkingParameterMode } from '@shared/model-config'
import { normalizeAiRuntimeSettings, startOfLocalMonthEpochSeconds } from '@shared/ai-budget'
import type { AiProviderStatus } from '@shared/ai-provider'
import { probeCodexLocalRuntime } from '../agent-runtime/model'
import { toPublicModelConfig } from './model-config-public'

const readGlobalTimeouts = (
  settings: Record<string, unknown>
): Record<ConfigurableModelTimeoutProfile, number> =>
  Object.fromEntries(
    CONFIGURABLE_MODEL_TIMEOUT_PROFILES.map((profile) => [
      profile,
      resolveModelTimeoutMs(settings[`timeout_ms_${profile}`], profile)
    ])
  ) as Record<ConfigurableModelTimeoutProfile, number>

const VALID_PROVIDERS = ['anthropic', 'openai', 'openai-responses', 'google'] as const
type Provider = (typeof VALID_PROVIDERS)[number]
const normalizeProvider = (provider: unknown): Provider =>
  VALID_PROVIDERS.includes(provider as Provider) ? (provider as Provider) : 'openai'
const normalizeMaxTokens = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 4096
  return Math.max(256, Math.min(16384, Math.floor(value)))
}

const normalizeVerifyErrorMessage = (
  error: unknown,
  options: {
    locale: 'zh' | 'en'
    provider: unknown
  }
): string | null => {
  const message = error instanceof Error ? error.message : ''
  const unsupportedThinkingPattern = [
    /(?:unsupported|unknown|unrecognized|invalid|unexpected).*(?:argument|parameter|field).*thinking/i,
    /thinking.*(?:unsupported|unknown|unrecognized|invalid)/i
  ]
  const isThinkingParameterError =
    unsupportedThinkingPattern.some((pattern) => pattern.test(message)) ||
    (/(?:argument|parameter|field)/i.test(message) && /thinking/i.test(message))
  if (options.provider === 'openai-responses' && isOpenAIResponsesFormatError(error)) {
    return uiText(
      options.locale,
      OPENAI_RESPONSES_FORMAT_ERROR_ZH,
      OPENAI_RESPONSES_FORMAT_ERROR_EN
    )
  }
  if (options.provider === 'openai' && isThinkingParameterError) {
    return uiText(
      options.locale,
      '当前模型不支持 thinking 参数，请在模型设置中改为“不发送 thinking 参数”。',
      'This model does not support the thinking parameter. In model settings, choose "Do not send thinking".'
    )
  }
  return message || null
}

export function registerSettingsHandlers(ctx: IpcContext): void {
  const { mainWindow, db, encryptApiKey, decryptApiKey } = ctx

  ipcMain.handle('app:getVersion', async () => {
    return { version: app.getVersion() }
  })

  ipcMain.handle('settings:get', async () => {
    log.info('[settings:get] requested')
    const settings = await db.getAllSettings()
    const storagePath =
      typeof settings.storage_path === 'string' && settings.storage_path.trim().length > 0
        ? settings.storage_path.trim()
        : ''
    const proxyUrl =
      typeof settings.proxy_url === 'string' && settings.proxy_url.trim().length > 0
        ? settings.proxy_url.trim()
        : ''
    return {
      theme: settings.theme || 'light',
      locale: settings.locale === 'en' ? 'en' : 'ko',
      storagePath,
      timeouts: readGlobalTimeouts(settings),
      proxyUrl,
      aiRuntime: normalizeAiRuntimeSettings(settings.ai_runtime)
    }
  })

  ipcMain.handle('settings:listModelConfigs', async () => {
    return (await db.listModelConfigs()).map((config) => toPublicModelConfig(config, decryptApiKey))
  })

  ipcMain.handle('settings:getModelUsage', async (_event, requestedPeriod) => {
    const period: ModelUsagePeriod =
      requestedPeriod === 'today' ||
      requestedPeriod === '7d' ||
      requestedPeriod === '30d' ||
      requestedPeriod === 'all'
        ? requestedPeriod
        : '30d'
    return db.getModelUsageStats(period)
  })

  ipcMain.handle('settings:getAiRuntimeStatus', async () => {
    const settings = normalizeAiRuntimeSettings(await db.getSetting('ai_runtime'))
    const codexStatus = await probeCodexLocalRuntime()
    const modelConfigs = await db.listModelConfigs()
    const openRouterConfig = modelConfigs.find((config) => {
      const baseUrl = String(config.baseUrl || '').trim()
      if (!baseUrl) return false
      try {
        return new URL(baseUrl).hostname.toLowerCase() === 'openrouter.ai'
      } catch {
        return false
      }
    })
    const openRouterConfigured =
      !!openRouterConfig && decryptApiKey(openRouterConfig.apiKey).trim().length > 0
    const openRouterStatus: AiProviderStatus = {
      id: 'openrouter',
      available: openRouterConfigured,
      authenticated: openRouterConfigured,
      billingMode: 'metered',
      detail: openRouterConfigured ? 'configured' : 'not-configured'
    }
    return {
      settings,
      statuses: [
        codexStatus,
        openRouterStatus,
        {
          id: 'offline',
          available: true,
          authenticated: true,
          billingMode: 'offline',
          detail: 'manual-editing-and-export'
        } satisfies AiProviderStatus
      ],
      committedUsdMicros: await db.getAiCommittedCostUsdMicros(startOfLocalMonthEpochSeconds())
    }
  })

  ipcMain.handle('settings:validateUploadPrerequisites', async () => {
    const locale = await readAppLocale(ctx)
    const settings = await db.getAllSettings()
    const storagePath =
      typeof settings.storage_path === 'string' && settings.storage_path.trim().length > 0
        ? settings.storage_path.trim()
        : ''
    const activeModel = (await db.listModelConfigs()).find((config) => config.active === 1)
    const hasModel = !!activeModel
    const hasApiKey =
      typeof activeModel?.apiKey === 'string' && decryptApiKey(activeModel.apiKey).trim().length > 0
    const hasModelName =
      typeof activeModel?.model === 'string' && activeModel.model.trim().length > 0

    const missing: Array<'storagePath' | 'activeModel' | 'apiKey' | 'model'> = []
    if (!storagePath) missing.push('storagePath')
    if (!hasModel) missing.push('activeModel')
    if (hasModel && !hasApiKey) missing.push('apiKey')
    if (hasModel && !hasModelName) missing.push('model')

    return {
      ready: missing.length === 0,
      missing,
      message:
        missing.length === 0
          ? ''
          : uiText(
              locale,
              '请先前往系统设置完成模型与存储目录配置。',
              'Please complete model and storage configuration in Settings first.'
            )
    }
  })

  ipcMain.handle('settings:save', async (_event, settings) => {
    log.info('[settings:save] received', {
      hasStoragePath:
        typeof settings?.storagePath === 'string' && settings.storagePath.trim().length > 0
    })
    if (settings.theme !== undefined) await db.setSetting('theme', settings.theme)
    if (settings.locale === 'ko' || settings.locale === 'en')
      await db.setSetting('locale', settings.locale)
    if (typeof settings.storagePath === 'string' && settings.storagePath.trim().length > 0) {
      await db.setStoragePath(settings.storagePath)
    }
    if (settings.timeouts && typeof settings.timeouts === 'object') {
      const timeouts = settings.timeouts as Partial<
        Record<ConfigurableModelTimeoutProfile, unknown>
      >
      for (const profile of CONFIGURABLE_MODEL_TIMEOUT_PROFILES) {
        const value = timeouts[profile]
        if (value !== undefined) {
          await db.setSetting(`timeout_ms_${profile}`, resolveModelTimeoutMs(value, profile))
        }
      }
    }
    if ('proxyUrl' in settings) {
      const nextProxy = typeof settings.proxyUrl === 'string' ? settings.proxyUrl.trim() : ''
      try {
        applyProxy(nextProxy || undefined)
      } catch (proxyError) {
        log.error('[settings:save] failed to apply proxy', {
          proxyUrl: nextProxy,
          message: proxyError instanceof Error ? proxyError.message : String(proxyError)
        })
        throw new Error(
          uiText(
            await readAppLocale(ctx),
            `代理设置无效：${proxyError instanceof Error ? proxyError.message : '请检查地址格式'}`,
            `Invalid proxy: ${proxyError instanceof Error ? proxyError.message : 'check the address format'}`
          )
        )
      }
      await db.setSetting('proxy_url', nextProxy)
    }
    if ('aiRuntime' in settings) {
      await db.setSetting('ai_runtime', normalizeAiRuntimeSettings(settings.aiRuntime))
    }
    return { success: true }
  })

  ipcMain.handle('settings:upsertModelConfig', async (_event, payload) => {
    const locale = await readAppLocale(ctx)
    const record =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    const provider = normalizeProvider(record.provider)
    const model = typeof record.model === 'string' ? record.model.trim() : ''
    const apiKey = typeof record.apiKey === 'string' ? record.apiKey.trim() : ''
    const baseUrl = typeof record.baseUrl === 'string' ? record.baseUrl.trim() : ''
    const id =
      typeof record.id === 'string' && record.id.trim().length > 0 ? record.id.trim() : undefined
    if (!name) throw new Error(uiText(locale, '请填写模型名称。', 'Enter model name.'))
    if (!model) throw new Error(uiText(locale, '请填写 model。', 'Enter model.'))
    const existing = id ? await db.getModelConfig(id) : undefined
    const encryptedApiKey = apiKey ? encryptApiKey(apiKey) : existing?.apiKey || ''
    if (!encryptedApiKey) throw new Error(uiText(locale, '请填写 api_key。', 'Enter api_key.'))
    const maxTokens = normalizeMaxTokens(record.maxTokens)
    const thinkingParameterMode = normalizeThinkingParameterMode(record.thinkingParameterMode)
    const savedId = await db.upsertModelConfig({
      id,
      name,
      provider,
      model,
      apiKey: encryptedApiKey,
      baseUrl,
      maxTokens,
      disableTemperature: record.disableTemperature === true,
      thinkingParameterMode,
      active: record.active === true
    })
    return { success: true, id: savedId }
  })

  ipcMain.handle('settings:setActiveModelConfig', async (_event, id) => {
    const locale = await readAppLocale(ctx)
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error(uiText(locale, '模型配置 ID 不能为空。', 'Model config ID is required.'))
    }
    const modelId = id.trim()
    try {
      await db.setActiveModelConfig(modelId)
    } catch (error) {
      if (error instanceof Error && error.message === 'Model config does not exist') {
        throw new Error(uiText(locale, '模型配置不存在。', 'Model config does not exist.'))
      }
      throw error
    }
    return { success: true }
  })

  ipcMain.handle('settings:deleteModelConfig', async (_event, id) => {
    const locale = await readAppLocale(ctx)
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error(uiText(locale, '模型配置 ID 不能为空。', 'Model config ID is required.'))
    }
    try {
      await db.deleteModelConfig(id.trim())
    } catch (error) {
      if (error instanceof Error && error.message === 'Model config does not exist') {
        throw new Error(uiText(locale, '模型配置不存在。', 'Model config does not exist.'))
      }
      throw error
    }
    return { success: true }
  })

  ipcMain.handle(
    'settings:verifyApiKey',
    async (
      _event,
      {
        provider,
        id,
        apiKey,
        model,
        baseUrl,
        maxTokens,
        disableTemperature,
        thinkingParameterMode,
        timeoutMs
      }
    ) => {
      const locale = await readAppLocale(ctx)
      const resolvedTimeoutMs = resolveModelTimeoutMs(timeoutMs, 'verify')
      const resolvedMaxTokens = normalizeMaxTokens(maxTokens)
      const resolvedThinkingParameterMode = normalizeThinkingParameterMode(thinkingParameterMode)
      log.info('[settings:verifyApiKey] received', {
        provider,
        model,
        hasApiKey: typeof apiKey === 'string' && apiKey.trim().length > 0,
        baseUrl: typeof baseUrl === 'string' ? baseUrl : '',
        maxTokens: resolvedMaxTokens,
        thinkingParameterMode: resolvedThinkingParameterMode,
        timeoutMs: resolvedTimeoutMs
      })

      const existing =
        typeof id === 'string' && id.trim().length > 0
          ? await db.getModelConfig(id.trim())
          : undefined
      const resolvedApiKey =
        typeof apiKey === 'string' && apiKey.trim().length > 0
          ? apiKey.trim()
          : existing
            ? decryptApiKey(existing.apiKey).trim()
            : ''
      if (!resolvedApiKey) {
        return {
          valid: false,
          message: uiText(locale, '请先填写 api_key。', 'Enter api_key first.')
        }
      }
      if (typeof model !== 'string' || model.trim().length === 0) {
        return { valid: false, message: uiText(locale, '请先填写 model。', 'Enter model first.') }
      }

      try {
        const client = runWithModelTemperatureControl(
          {
            disableTemperature: disableTemperature === true,
            thinkingParameterMode: resolvedThinkingParameterMode
          },
          () =>
            resolveModel(
              provider,
              resolvedApiKey,
              model.trim(),
              typeof baseUrl === 'string' ? baseUrl.trim() : '',
              undefined,
              resolvedMaxTokens,
              ctx.modelRuntime
            )
        )
        await client.invoke('Reply with OK.', {
          signal: AbortSignal.timeout(resolvedTimeoutMs)
        })
        log.info('[settings:verifyApiKey] success', { provider, model })
        return { valid: true, message: uiText(locale, '连接验证成功。', 'Connection verified.') }
      } catch (error) {
        const message =
          normalizeVerifyErrorMessage(error, { locale, provider }) ||
          uiText(
            locale,
            '连接验证失败，请检查 api_key、model 或 base_url。',
            'Connection verification failed. Check api_key, model, or base_url.'
          )
        log.error('[settings:verifyApiKey] failed', {
          provider,
          model,
          baseUrl: typeof baseUrl === 'string' ? baseUrl : '',
          message
        })
        return { valid: false, message }
      }
    }
  )

  ipcMain.handle('settings:chooseStoragePath', async (event) => {
    log.info('[settings:chooseStoragePath] received')
    const targetWindow =
      BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow() ?? mainWindow

    try {
      const settings = await db.getAllSettings()
      const currentStoragePath =
        typeof settings.storage_path === 'string' && settings.storage_path.trim().length > 0
          ? settings.storage_path.trim()
          : ''
      const result = await dialog.showOpenDialog(targetWindow, {
        title: '기획서 디자이너 저장 폴더 선택',
        buttonLabel: '폴더 선택',
        ...(currentStoragePath ? { defaultPath: currentStoragePath } : {}),
        properties: ['openDirectory', 'createDirectory', 'promptToCreate']
      })
      if (!result.canceled && result.filePaths.length > 0) {
        return { path: result.filePaths[0] }
      }
      return { path: null }
    } catch (error) {
      const message =
        error instanceof Error && error.message.length > 0
          ? error.message
          : '시스템 폴더 선택 창을 열 수 없습니다.'
      log.error('[settings:chooseStoragePath] failed', { message })
      return { path: null, error: message }
    }
  })
}
