import { Codex, type CodexOptions, type ThreadOptions } from '@openai/codex-sdk'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { promisify } from 'node:util'
import type { AiProviderStatus } from '@shared/ai-provider'
import type {
  StructuredAiProvider,
  StructuredAiRequest,
  StructuredAiResult,
  StructuredAiUsage
} from './types'
import { StructuredAiError } from './types'

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)

type CodexClientFactory = (options: CodexOptions) => Pick<Codex, 'startThread'>

export const sanitizeCodexEnvironment = (
  source: NodeJS.ProcessEnv = process.env
): Record<string, string> => {
  const sanitized: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== 'string') continue
    if (key === 'OPENAI_API_KEY' || key === 'CODEX_API_KEY') continue
    sanitized[key] = value
  }
  return sanitized
}

export const parseCodexLoginStatus = (output: string): AiProviderStatus => {
  const normalized = output.trim().toLowerCase()
  if (normalized.includes('logged in using chatgpt')) {
    return {
      id: 'codex-local',
      available: true,
      authenticated: true,
      billingMode: 'subscription',
      detail: 'chatgpt'
    }
  }
  if (normalized.includes('logged in using') && normalized.includes('api')) {
    return {
      id: 'codex-local',
      available: true,
      authenticated: false,
      billingMode: 'metered',
      detail: 'api-key-auth-is-not-subscription'
    }
  }
  return {
    id: 'codex-local',
    available: true,
    authenticated: false,
    billingMode: 'subscription',
    detail: normalized ? 'unknown-auth-mode' : 'login-required'
  }
}

const PLATFORM_PACKAGE_BY_TARGET: Record<string, string> = {
  'x86_64-unknown-linux-musl': '@openai/codex-linux-x64',
  'aarch64-unknown-linux-musl': '@openai/codex-linux-arm64',
  'x86_64-apple-darwin': '@openai/codex-darwin-x64',
  'aarch64-apple-darwin': '@openai/codex-darwin-arm64',
  'x86_64-pc-windows-msvc': '@openai/codex-win32-x64',
  'aarch64-pc-windows-msvc': '@openai/codex-win32-arm64'
}

const resolveTargetTriple = (): string => {
  if (process.platform === 'win32' && process.arch === 'x64') return 'x86_64-pc-windows-msvc'
  if (process.platform === 'win32' && process.arch === 'arm64') return 'aarch64-pc-windows-msvc'
  if (process.platform === 'darwin' && process.arch === 'x64') return 'x86_64-apple-darwin'
  if (process.platform === 'darwin' && process.arch === 'arm64') return 'aarch64-apple-darwin'
  if (process.platform === 'linux' && process.arch === 'x64') return 'x86_64-unknown-linux-musl'
  if (process.platform === 'linux' && process.arch === 'arm64') return 'aarch64-unknown-linux-musl'
  throw new Error(`Unsupported Codex platform: ${process.platform}/${process.arch}`)
}

export const resolveAsarUnpackedPath = (
  filePath: string,
  exists: (candidate: string) => boolean = fs.existsSync
): string => {
  const marker = `${path.sep}app.asar${path.sep}`
  if (!filePath.includes(marker)) return filePath
  const unpackedPath = filePath.replace(marker, `${path.sep}app.asar.unpacked${path.sep}`)
  return exists(unpackedPath) ? unpackedPath : filePath
}

export const resolveCodexNativeExecutable = (): string => {
  const targetTriple = resolveTargetTriple()
  const packageName = PLATFORM_PACKAGE_BY_TARGET[targetTriple]
  if (!packageName) throw new Error(`Missing Codex package mapping for ${targetTriple}`)
  const packagePath = require.resolve(`${packageName}/package.json`)
  const executableName = process.platform === 'win32' ? 'codex.exe' : 'codex'
  const packageDirectory = path.dirname(packagePath)
  const candidates = [
    path.join(packageDirectory, 'vendor', targetTriple, 'bin', executableName),
    path.join(packageDirectory, 'vendor', targetTriple, 'codex', executableName)
  ].map((candidate) => resolveAsarUnpackedPath(candidate))
  const executablePath = candidates.find((candidate) => fs.existsSync(candidate))
  if (!executablePath) throw new Error(`Codex native executable is missing for ${targetTriple}`)
  return executablePath
}

export const probeCodexLocalRuntime = async (): Promise<AiProviderStatus> => {
  try {
    const executablePath = resolveCodexNativeExecutable()
    const { stdout, stderr } = await execFileAsync(executablePath, ['login', 'status'], {
      env: sanitizeCodexEnvironment(),
      timeout: 5_000,
      windowsHide: true
    })
    return parseCodexLoginStatus(`${stdout}\n${stderr}`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return {
      id: 'codex-local',
      available: false,
      authenticated: false,
      billingMode: 'subscription',
      detail
    }
  }
}

const parseStructuredResponse = <T>(rawResponse: string): T => {
  try {
    return JSON.parse(rawResponse) as T
  } catch (error) {
    throw new StructuredAiError(
      'provider-response-invalid',
      'Codex returned a response that does not match the requested JSON output.',
      error instanceof Error ? error.message : String(error)
    )
  }
}

const toUsage = (
  usage: {
    input_tokens: number
    cached_input_tokens: number
    output_tokens: number
    reasoning_output_tokens: number
  } | null
): StructuredAiUsage => ({
  inputTokens: usage?.input_tokens ?? 0,
  cachedInputTokens: usage?.cached_input_tokens ?? 0,
  outputTokens: usage?.output_tokens ?? 0,
  reasoningTokens: usage?.reasoning_output_tokens ?? 0
})

export class CodexLocalStructuredProvider implements StructuredAiProvider {
  readonly id = 'codex-local' as const
  readonly billingMode = 'subscription' as const

  constructor(
    private readonly createClient: CodexClientFactory = (options) => new Codex(options),
    private readonly probeRuntime: () => Promise<AiProviderStatus> = probeCodexLocalRuntime
  ) {}

  async generateJson<T>(request: StructuredAiRequest): Promise<StructuredAiResult<T>> {
    const status = await this.probeRuntime()
    if (!status.available || !status.authenticated || status.billingMode !== 'subscription') {
      throw new StructuredAiError(
        'provider-auth-required',
        'Codex local requires a saved ChatGPT sign-in; API-key authentication is not used.'
      )
    }
    const env = sanitizeCodexEnvironment()
    const codex = this.createClient({ env, codexPathOverride: resolveCodexNativeExecutable() })
    const threadOptions: ThreadOptions = {
      model: request.model,
      sandboxMode: 'read-only',
      workingDirectory: request.workingDirectory,
      skipGitRepoCheck: true,
      modelReasoningEffort: request.reasoningEffort,
      networkAccessEnabled: false,
      webSearchMode: 'disabled',
      approvalPolicy: 'never'
    }
    const thread = codex.startThread(threadOptions)
    const content = [
      {
        type: 'text' as const,
        text: [
          'Use only the content supplied in this request.',
          'Do not read or write files, execute commands, browse the web, or invent missing facts.',
          'Return only the JSON value required by the supplied output schema.',
          '',
          request.prompt
        ].join('\n')
      },
      ...(request.imagePaths || []).map((imagePath) => ({
        type: 'local_image' as const,
        path: imagePath
      }))
    ]

    try {
      const turn = await thread.run(content, {
        outputSchema: request.outputSchema,
        signal: request.signal
      })
      return {
        providerId: this.id,
        billingMode: this.billingMode,
        model: request.model || 'codex-account-default',
        value: parseStructuredResponse<T>(turn.finalResponse),
        rawResponse: turn.finalResponse,
        usage: toUsage(turn.usage),
        actualCostUsdMicros: 0,
        providerRunId: thread.id || undefined
      }
    } catch (error) {
      if (error instanceof StructuredAiError) throw error
      throw new StructuredAiError(
        'request-failed',
        'Codex local generation failed.',
        error instanceof Error ? error.message : String(error)
      )
    }
  }
}
