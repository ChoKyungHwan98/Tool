import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  deleteOpenRouterApiKey,
  getOpenRouterCredentialStatus,
  loadOpenRouterApiKey,
  saveOpenRouterApiKey,
} from './openRouterCredentials'

describe('browser OpenRouter credentials', () => {
  afterEach(async () => {
    await deleteOpenRouterApiKey()
    vi.restoreAllMocks()
  })

  it('탭 세션에 키를 보관하고 다시 읽어온다', async () => {
    expect((await saveOpenRouterApiKey('test-api-key')).stored).toBe(true)
    expect((await getOpenRouterCredentialStatus()).stored).toBe(true)
    expect((await loadOpenRouterApiKey()).apiKey).toBe('test-api-key')

    expect((await deleteOpenRouterApiKey()).stored).toBe(false)
    expect((await loadOpenRouterApiKey()).apiKey).toBeUndefined()
  })

  it('새로고침을 견디도록 sessionStorage에만 쓰고 localStorage에는 절대 쓰지 않는다', async () => {
    localStorage.clear()
    await saveOpenRouterApiKey('test-api-key')

    // sessionStorage는 탭을 닫으면 지워진다. localStorage는 디스크에 남으므로 키를 두면 안 된다.
    const sessionValues = Object.keys(sessionStorage).map((key) => sessionStorage.getItem(key))
    const localValues = Object.keys(localStorage).map((key) => localStorage.getItem(key))

    expect(sessionValues).toContain('test-api-key')
    expect(localValues).not.toContain('test-api-key')
  })

  it('저장된 키가 없으면 stored가 false다', async () => {
    await deleteOpenRouterApiKey()

    const status = await getOpenRouterCredentialStatus()
    expect(status.stored).toBe(false)
    expect((await loadOpenRouterApiKey()).apiKey).toBeUndefined()
  })
})
