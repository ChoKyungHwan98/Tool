import type { OpenRouterModel } from './openRouterProvider'
import { pricePerMillionTokens } from './openRouterProvider'

/**
 * 유료 모델을 열어주는 대신 지출을 앱이 강제로 막는다.
 * 정확한 청구액은 OpenRouter가 계산하지만, 앱은 보수적으로 추정해 상한을 넘지 않게 한다.
 */

const SPEND_KEY = 'gsw.ai.spend'
export const DEFAULT_MONTHLY_LIMIT_USD = 10

export interface SpendRecord {
  readonly month: string
  readonly usd: number
}

/** 한국어·영어가 섞인 프롬프트 기준 보수적 추정치. 실제보다 조금 높게 잡아 상한을 안전하게 만든다. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2.5)
}

export function estimateRequestCostUsd(input: {
  readonly model: OpenRouterModel
  readonly promptText: string
  readonly expectedCompletionTokens?: number
}): number {
  const price = pricePerMillionTokens(input.model)

  if (!price) {
    return 0
  }

  const promptTokens = estimateTokens(input.promptText)
  const completionTokens = input.expectedCompletionTokens ?? 800

  return (promptTokens * price.prompt + completionTokens * price.completion) / 1_000_000
}

/**
 * OpenRouter가 돌려준 실제 토큰 수로 계산한 비용.
 * 추정치(estimateRequestCostUsd)는 "보내기 전 상한 확인"에만 쓰고,
 * 실제 누적 기록에는 항상 이 값을 쓴다.
 */
export function actualRequestCostUsd(input: {
  readonly model: OpenRouterModel
  readonly usage: { readonly promptTokens: number; readonly completionTokens: number }
}): number {
  const price = pricePerMillionTokens(input.model)

  if (!price) {
    return 0
  }

  return (input.usage.promptTokens * price.prompt + input.usage.completionTokens * price.completion) / 1_000_000
}

function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getStorage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' && globalThis.localStorage ? globalThis.localStorage : null
  } catch {
    return null
  }
}

export function readSpend(now: Date = new Date()): SpendRecord {
  const month = currentMonth(now)
  const storage = getStorage()
  const empty: SpendRecord = { month, usd: 0 }

  if (!storage) return empty

  try {
    const raw = storage.getItem(SPEND_KEY)
    if (!raw) return empty

    const parsed = JSON.parse(raw) as Partial<SpendRecord>
    // 달이 바뀌면 자동으로 0부터 다시 센다.
    return parsed.month === month && typeof parsed.usd === 'number' ? { month, usd: parsed.usd } : empty
  } catch {
    return empty
  }
}

export function recordSpend(amountUsd: number, now: Date = new Date()): SpendRecord {
  const current = readSpend(now)
  const next: SpendRecord = { month: current.month, usd: current.usd + Math.max(0, amountUsd) }
  getStorage()?.setItem(SPEND_KEY, JSON.stringify(next))

  return next
}

export function resetSpend(): void {
  getStorage()?.removeItem(SPEND_KEY)
}

export interface SpendCheck {
  readonly allowed: boolean
  readonly reason?: string
  readonly spentUsd: number
  readonly limitUsd: number
}

export function checkSpendLimit(input: {
  readonly estimatedUsd: number
  readonly limitUsd?: number
  readonly now?: Date
}): SpendCheck {
  const limitUsd = input.limitUsd ?? DEFAULT_MONTHLY_LIMIT_USD
  const spentUsd = readSpend(input.now).usd

  if (spentUsd + input.estimatedUsd > limitUsd) {
    return {
      allowed: false,
      reason: `이번 달 예상 사용액이 상한 $${limitUsd.toFixed(2)}을 넘습니다. (현재 $${spentUsd.toFixed(3)})`,
      spentUsd,
      limitUsd,
    }
  }

  return { allowed: true, spentUsd, limitUsd }
}

export function formatUsd(value: number): string {
  if (value === 0) return '$0'
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`
}
