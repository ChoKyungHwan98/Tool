export const AI_PROVIDER_IDS = ['codex-local', 'openrouter', 'offline'] as const

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number]

export type AiBillingMode = 'subscription' | 'metered' | 'offline'

export type AiTaskPurpose =
  | 'content-inventory'
  | 'outline'
  | 'design-direction'
  | 'storyboard'
  | 'slide-content'
  | 'slide-layout'
  | 'revision'
  | 'quality-review'

export interface AiProviderStatus {
  id: AiProviderId
  available: boolean
  authenticated: boolean
  billingMode: AiBillingMode
  detail?: string
}

export interface AiProviderSelection {
  providerId: AiProviderId
  reason:
    | 'preferred-ready'
    | 'codex-subscription-ready'
    | 'paid-fallback-ready'
    | 'paid-fallback-needs-consent'
    | 'offline-only'
}

export interface SelectAiProviderArgs {
  preferredProvider: AiProviderId
  codexStatus: AiProviderStatus
  openRouterStatus: AiProviderStatus
  paidFallbackEnabled: boolean
}

const isReady = (status: AiProviderStatus): boolean => status.available && status.authenticated

export const selectAiProvider = ({
  preferredProvider,
  codexStatus,
  openRouterStatus,
  paidFallbackEnabled
}: SelectAiProviderArgs): AiProviderSelection => {
  if (preferredProvider === 'codex-local' && isReady(codexStatus)) {
    return { providerId: 'codex-local', reason: 'preferred-ready' }
  }
  if (preferredProvider === 'openrouter' && isReady(openRouterStatus)) {
    return paidFallbackEnabled
      ? { providerId: 'openrouter', reason: 'preferred-ready' }
      : { providerId: 'offline', reason: 'paid-fallback-needs-consent' }
  }
  if (isReady(codexStatus)) {
    return { providerId: 'codex-local', reason: 'codex-subscription-ready' }
  }
  if (isReady(openRouterStatus)) {
    return paidFallbackEnabled
      ? { providerId: 'openrouter', reason: 'paid-fallback-ready' }
      : { providerId: 'offline', reason: 'paid-fallback-needs-consent' }
  }
  return { providerId: 'offline', reason: 'offline-only' }
}
