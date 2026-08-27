import { beforeEach, describe, expect, it } from 'vitest'
import {
  actualRequestCostUsd,
  checkSpendLimit,
  DEFAULT_MONTHLY_LIMIT_USD,
  estimateRequestCostUsd,
  readSpend,
  recordSpend,
  resetSpend,
} from './aiSpend'
import type { OpenRouterModel } from './openRouterProvider'

const freeModel: OpenRouterModel = {
  id: 'vendor/free:free',
  pricing: { prompt: '0', completion: '0' },
}

// $0.15 / 1M 입력, $0.60 / 1M 출력
const cheapPaidModel: OpenRouterModel = {
  id: 'vendor/cheap',
  pricing: { prompt: '0.00000015', completion: '0.0000006' },
}

describe('estimateRequestCostUsd', () => {
  it('무료 모델은 0원이다', () => {
    expect(estimateRequestCostUsd({ model: freeModel, promptText: '가'.repeat(10000) })).toBe(0)
  })

  it('저가 유료 모델 한 번 요청이 1센트 미만이다', () => {
    const cost = estimateRequestCostUsd({
      model: cheapPaidModel,
      promptText: '가'.repeat(20000),
      expectedCompletionTokens: 1000,
    })

    expect(cost).toBeGreaterThan(0)
    expect(cost).toBeLessThan(0.01)
  })
})

describe('actualRequestCostUsd', () => {
  it('실제 토큰 수로 계산하며 추정치와 다를 수 있다', () => {
    const actual = actualRequestCostUsd({
      model: cheapPaidModel,
      usage: { promptTokens: 8000, completionTokens: 1000 },
    })

    // 8000 * 0.15/1M + 1000 * 0.60/1M = 0.0012 + 0.0006
    expect(actual).toBeCloseTo(0.0018, 6)
  })

  it('무료 모델은 실제 사용량이 많아도 0원이다', () => {
    expect(actualRequestCostUsd({
      model: freeModel,
      usage: { promptTokens: 500000, completionTokens: 100000 },
    })).toBe(0)
  })
})

describe('월 지출 상한', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSpend()
  })

  it('처음에는 0원이고 상한 안이다', () => {
    expect(readSpend().usd).toBe(0)
    expect(checkSpendLimit({ estimatedUsd: 0.01 }).allowed).toBe(true)
  })

  it('사용액이 누적된다', () => {
    recordSpend(0.5)
    recordSpend(0.25)
    expect(readSpend().usd).toBeCloseTo(0.75, 5)
  })

  it('상한을 넘기면 막는다', () => {
    recordSpend(DEFAULT_MONTHLY_LIMIT_USD - 0.01)

    const check = checkSpendLimit({ estimatedUsd: 0.5 })
    expect(check.allowed).toBe(false)
    expect(check.reason).toContain('상한')
    expect(check.spentUsd).toBeCloseTo(DEFAULT_MONTHLY_LIMIT_USD - 0.01, 5)
  })

  it('달이 바뀌면 사용액이 0부터 다시 센다', () => {
    const january = new Date('2026-01-15T00:00:00Z')
    const february = new Date('2026-02-01T00:00:00Z')

    recordSpend(5, january)
    expect(readSpend(january).usd).toBe(5)
    expect(readSpend(february).usd).toBe(0)
  })
})
