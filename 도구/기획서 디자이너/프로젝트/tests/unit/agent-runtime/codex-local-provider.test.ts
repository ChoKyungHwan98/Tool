import { describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import {
  CodexLocalStructuredProvider,
  parseCodexLoginStatus,
  resolveAsarUnpackedPath,
  resolveCodexNativeExecutable,
  sanitizeCodexEnvironment
} from '../../../src/main/agent-runtime/structured/codex-local-provider'

describe('Codex local structured provider', () => {
  it('resolves the bundled native executable and rewrites packaged asar paths', () => {
    expect(resolveCodexNativeExecutable()).toMatch(/codex(?:\.exe)?$/i)
    const packaged = path.join(
      path.parse(process.cwd()).root,
      'app',
      'resources',
      'app.asar',
      'node_modules',
      'codex.exe'
    )
    expect(resolveAsarUnpackedPath(packaged, () => true)).toContain('app.asar.unpacked')
  })

  it('removes API-billed credentials from the child environment', () => {
    expect(
      sanitizeCodexEnvironment({
        PATH: 'safe',
        OPENAI_API_KEY: 'must-not-pass',
        CODEX_API_KEY: 'must-not-pass-either',
        CODEX_ACCESS_TOKEN: 'allowed-saved-auth-equivalent'
      })
    ).toEqual({ PATH: 'safe', CODEX_ACCESS_TOKEN: 'allowed-saved-auth-equivalent' })
  })

  it('accepts ChatGPT auth and rejects API-key auth as subscription auth', () => {
    expect(parseCodexLoginStatus('Logged in using ChatGPT')).toMatchObject({
      authenticated: true,
      billingMode: 'subscription'
    })
    expect(parseCodexLoginStatus('Logged in using API key')).toMatchObject({
      authenticated: false,
      billingMode: 'metered'
    })
  })

  it('runs read-only with structured output and records zero metered cost', async () => {
    const run = vi.fn().mockResolvedValue({
      finalResponse: '{"title":"근거 중심"}',
      usage: {
        input_tokens: 120,
        cached_input_tokens: 80,
        cache_write_input_tokens: 0,
        output_tokens: 20,
        reasoning_output_tokens: 5
      }
    })
    const startThread = vi.fn().mockReturnValue({ id: 'thread-1', run })
    const provider = new CodexLocalStructuredProvider(
      () => ({ startThread }) as never,
      async () => ({
        id: 'codex-local',
        available: true,
        authenticated: true,
        billingMode: 'subscription'
      })
    )
    const result = await provider.generateJson<{ title: string }>({
      purpose: 'outline',
      prompt: '주어진 원문만 정리한다.',
      outputSchema: {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: ['title'],
        additionalProperties: false
      },
      workingDirectory: 'C:\\safe-project'
    })

    expect(startThread).toHaveBeenCalledWith(
      expect.objectContaining({
        sandboxMode: 'read-only',
        networkAccessEnabled: false,
        webSearchMode: 'disabled',
        approvalPolicy: 'never'
      })
    )
    expect(run).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: 'text', text: expect.stringContaining('Do not read') })
      ]),
      expect.objectContaining({ outputSchema: expect.any(Object) })
    )
    expect(result.value).toEqual({ title: '근거 중심' })
    expect(result.actualCostUsdMicros).toBe(0)
    expect(result.usage.cachedInputTokens).toBe(80)
  })

  it('refuses saved API-key auth before starting a thread', async () => {
    const startThread = vi.fn()
    const provider = new CodexLocalStructuredProvider(
      () => ({ startThread }) as never,
      async () => ({
        id: 'codex-local',
        available: true,
        authenticated: false,
        billingMode: 'metered'
      })
    )

    await expect(
      provider.generateJson({
        purpose: 'outline',
        prompt: '정리',
        outputSchema: { type: 'object' }
      })
    ).rejects.toMatchObject({ code: 'provider-auth-required' })
    expect(startThread).not.toHaveBeenCalled()
  })
})
