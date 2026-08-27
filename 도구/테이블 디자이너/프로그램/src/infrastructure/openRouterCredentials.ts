import { invoke } from '@tauri-apps/api/core'

export interface OpenRouterCredentialStatus {
  readonly available: boolean
  readonly stored: boolean
  readonly message: string
}

export interface OpenRouterCredentialLoadResult extends OpenRouterCredentialStatus {
  readonly apiKey?: string
}

const BROWSER_SESSION_KEY = 'gsw.openrouter.sessionKey'

/**
 * 브라우저 개발 모드에서는 sessionStorage에 담는다.
 * 모듈 변수만 쓰면 새로고침(HMR 포함)마다 키가 사라져 매번 다시 입력해야 했다.
 * sessionStorage는 탭을 닫으면 지워지므로 localStorage보다 수명이 짧다.
 * 패키징된 앱(Tauri)에서는 이 경로를 타지 않고 OS 자격 증명 저장소를 쓴다.
 */
function readBrowserSessionKey(): string {
  try {
    return globalThis.sessionStorage?.getItem(BROWSER_SESSION_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeBrowserSessionKey(apiKey: string): void {
  try {
    if (apiKey) {
      globalThis.sessionStorage?.setItem(BROWSER_SESSION_KEY, apiKey)
    } else {
      globalThis.sessionStorage?.removeItem(BROWSER_SESSION_KEY)
    }
  } catch {
    // sessionStorage를 못 쓰는 환경이면 조용히 넘어간다.
  }
}

export async function getOpenRouterCredentialStatus(): Promise<OpenRouterCredentialStatus> {
  if (!isTauriRuntime()) {
    const stored = readBrowserSessionKey()
    return {
      available: true,
      stored: stored.length > 0,
      message: stored
        ? '브라우저 탭 세션에 키가 보관되어 있습니다. 탭을 닫으면 지워집니다.'
        : '브라우저 개발 모드는 탭을 닫으면 키가 지워집니다.',
    }
  }
  return invokeCredentialCommand('get_openrouter_credential_status')
}

export async function saveOpenRouterApiKey(apiKey: string): Promise<OpenRouterCredentialStatus> {
  if (!isTauriRuntime()) {
    const trimmed = apiKey.trim()
    writeBrowserSessionKey(trimmed)
    return {
      available: true,
      stored: trimmed.length > 0,
      message: '키를 이 브라우저 탭에 보관했습니다. 새로고침해도 유지되고, 탭을 닫으면 지워집니다.',
    }
  }
  return invokeCredentialCommand('save_openrouter_api_key', { apiKey })
}

export async function loadOpenRouterApiKey(): Promise<OpenRouterCredentialLoadResult> {
  if (!isTauriRuntime()) {
    const stored = readBrowserSessionKey()
    return {
      available: true,
      stored: stored.length > 0,
      apiKey: stored || undefined,
      message: stored ? '브라우저 탭에 보관된 키를 불러왔습니다.' : '이 브라우저 탭에 보관된 키가 없습니다.',
    }
  }

  try {
    return await invoke<OpenRouterCredentialLoadResult>('load_openrouter_api_key')
  } catch (error) {
    return {
      available: false,
      stored: false,
      message: error instanceof Error ? error.message : 'OS 자격 증명 저장소에서 키를 불러오지 못했습니다.',
    }
  }
}

export async function deleteOpenRouterApiKey(): Promise<OpenRouterCredentialStatus> {
  if (!isTauriRuntime()) {
    writeBrowserSessionKey('')
    return { available: true, stored: false, message: '이 브라우저 탭에서 키를 제거했습니다.' }
  }
  return invokeCredentialCommand('delete_openrouter_api_key')
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function invokeCredentialCommand(command: string, args?: Record<string, unknown>): Promise<OpenRouterCredentialStatus> {
  try {
    return await invoke<OpenRouterCredentialStatus>(command, args)
  } catch (error) {
    return {
      available: false,
      stored: false,
      message: error instanceof Error ? error.message : '이 실행 환경에서는 Tauri 자격 증명 저장소를 사용할 수 없습니다.',
    }
  }
}
