import { create } from 'zustand'
import {
  ipc,
  type ImageModelConfig,
  type ImageModelProvider,
  type ModelConfig
} from '@renderer/lib/ipc'
import type { ConfigurableModelTimeoutProfile } from '@shared/model-timeout.js'
import type { ThinkingParameterMode } from '@shared/model-config.js'
import type { AiRuntimeSettings } from '@shared/ai-budget.js'

interface Settings {
  theme: string
  locale: 'ko' | 'en'
  storagePath: string
  timeouts: Record<ConfigurableModelTimeoutProfile, number>
  proxyUrl: string
  aiRuntime: AiRuntimeSettings
}

interface SettingsStore {
  settings: Settings | null
  modelConfigs: ModelConfig[]
  imageModelConfigs: ImageModelConfig[]
  verificationMessage: string | null
  storagePathError: string | null
  loading: boolean

  fetchSettings: () => Promise<void>
  saveSettings: (settings: Partial<Settings>) => Promise<void>
  upsertModelConfig: (config: {
    id?: string
    name: string
    provider: 'anthropic' | 'openai' | 'openai-responses' | 'google'
    model: string
    apiKey: string
    baseUrl: string
    maxTokens?: number
    disableTemperature?: boolean
    thinkingParameterMode?: ThinkingParameterMode
    active?: boolean
  }) => Promise<string | null>
  upsertImageModelConfig: (config: {
    id?: string
    name: string
    provider: ImageModelProvider
    active?: boolean
    modelConfig: string
  }) => Promise<string | null>
  setActiveModelConfig: (id: string) => Promise<void>
  setActiveImageModelConfig: (id: string) => Promise<void>
  deleteModelConfig: (id: string) => Promise<void>
  deleteImageModelConfig: (id: string) => Promise<void>
  setVerificationMessage: (message: string | null) => void
  verifyApiKey: (
    id: string | undefined,
    provider: string,
    apiKey: string,
    model: string,
    baseUrl: string,
    maxTokens: number,
    disableTemperature: boolean,
    thinkingParameterMode: ThinkingParameterMode,
    timeoutMs: number
  ) => Promise<boolean>
  verifyImageModel: (provider: ImageModelProvider, modelConfig: string) => Promise<boolean>
  chooseStoragePath: () => Promise<string | null>
}

const readStoredLocale = (): 'ko' | 'en' => {
  if (typeof window === 'undefined') return 'ko'
  const value =
    window.localStorage.getItem('deck-designer:lang') ||
    window.localStorage.getItem('oh-my-ppt:lang')
  return value === 'en' ? 'en' : 'ko'
}

const fallbackMessage = (ko: string, en: string): string => (readStoredLocale() === 'en' ? en : ko)

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  modelConfigs: [],
  imageModelConfigs: [],
  verificationMessage: null,
  storagePathError: null,
  loading: false,

  fetchSettings: async () => {
    try {
      const [settings, modelConfigs, imageModelConfigs] = await Promise.all([
        ipc.getSettings(),
        ipc.listModelConfigs(),
        ipc.listImageModelConfigs()
      ])
      const typedSettings = settings as unknown as Settings
      const locale = typedSettings.locale === 'en' ? 'en' : 'ko'
      set({
        settings: {
          ...typedSettings,
          locale
        },
        modelConfigs: Array.isArray(modelConfigs) ? modelConfigs : [],
        imageModelConfigs: Array.isArray(imageModelConfigs) ? imageModelConfigs : [],
        storagePathError: null,
        verificationMessage: null
      })
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : fallbackMessage('설정을 불러오지 못했습니다.', 'Failed to read settings.')
      set({ verificationMessage: message })
    }
  },

  saveSettings: async (newSettings) => {
    set({ verificationMessage: null })
    const settingsToSave: Partial<Settings> = { ...newSettings }

    try {
      await ipc.saveSettings(settingsToSave)
      await get().fetchSettings()
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : fallbackMessage('설정을 저장하지 못했습니다.', 'Failed to save settings.')
      set({ verificationMessage: message })
    }
  },

  upsertModelConfig: async (config) => {
    set({ verificationMessage: null })
    try {
      const result = await ipc.upsertModelConfig(config)
      await get().fetchSettings()
      return result.id
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : fallbackMessage('모델 설정을 저장하지 못했습니다.', 'Failed to save model.')
      set({ verificationMessage: message })
      return null
    }
  },

  setActiveModelConfig: async (id) => {
    set({ verificationMessage: null })
    try {
      await ipc.setActiveModelConfig(id)
      await get().fetchSettings()
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : fallbackMessage('모델을 활성화하지 못했습니다.', 'Failed to activate model.')
      set({ verificationMessage: message })
    }
  },

  upsertImageModelConfig: async (config) => {
    set({ verificationMessage: null })
    try {
      const result = await ipc.upsertImageModelConfig(config)
      await get().fetchSettings()
      return result.id
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : fallbackMessage('이미지 모델을 저장하지 못했습니다.', 'Failed to save image model.')
      set({ verificationMessage: message })
      return null
    }
  },

  setActiveImageModelConfig: async (id) => {
    set({ verificationMessage: null })
    try {
      await ipc.setActiveImageModelConfig(id)
      await get().fetchSettings()
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : fallbackMessage(
              '이미지 모델을 활성화하지 못했습니다.',
              'Failed to activate image model.'
            )
      set({ verificationMessage: message })
    }
  },

  deleteModelConfig: async (id) => {
    set({ verificationMessage: null })
    try {
      await ipc.deleteModelConfig(id)
      await get().fetchSettings()
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : fallbackMessage('모델을 삭제하지 못했습니다.', 'Failed to delete model.')
      set({ verificationMessage: message })
    }
  },

  deleteImageModelConfig: async (id) => {
    set({ verificationMessage: null })
    try {
      await ipc.deleteImageModelConfig(id)
      await get().fetchSettings()
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : fallbackMessage('이미지 모델을 삭제하지 못했습니다.', 'Failed to delete image model.')
      set({ verificationMessage: message })
    }
  },

  setVerificationMessage: (message) => set({ verificationMessage: message }),

  verifyApiKey: async (
    id,
    provider,
    apiKey,
    model,
    baseUrl,
    maxTokens,
    disableTemperature,
    thinkingParameterMode,
    timeoutMs
  ) => {
    try {
      const { valid, message } = await ipc.verifyApiKey({
        id,
        provider,
        apiKey,
        model,
        baseUrl,
        maxTokens,
        disableTemperature,
        thinkingParameterMode,
        timeoutMs
      })
      set({ verificationMessage: message || null })
      return valid
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : fallbackMessage(
              '연결 확인 요청을 보내지 못했습니다.',
              'Failed to send verification request.'
            )
      set({ verificationMessage: message })
      return false
    }
  },

  verifyImageModel: async (provider, modelConfig) => {
    try {
      const { valid, message } = await ipc.verifyImageModel({
        provider,
        modelConfig
      })
      set({ verificationMessage: message || null })
      return valid
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : fallbackMessage('이미지 모델을 확인하지 못했습니다.', 'Failed to verify image model.')
      set({ verificationMessage: message })
      return false
    }
  },

  chooseStoragePath: async () => {
    set({ storagePathError: null })
    try {
      const { path, error } = await ipc.chooseStoragePath()
      set({ storagePathError: error || null })
      return path
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : fallbackMessage('폴더를 선택하지 못했습니다.', 'Failed to choose folder.')
      set({ storagePathError: message })
      return null
    }
  }
}))
