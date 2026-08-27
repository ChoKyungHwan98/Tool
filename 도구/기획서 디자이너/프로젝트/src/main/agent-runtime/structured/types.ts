import type { AiBillingMode, AiProviderId, AiTaskPurpose } from '@shared/ai-provider'

export type JsonSchema = Record<string, unknown>

export interface StructuredAiUsage {
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
}

export interface StructuredAiRequest {
  purpose: AiTaskPurpose
  prompt: string
  outputSchema: JsonSchema
  workingDirectory?: string
  imagePaths?: string[]
  model?: string
  reasoningEffort?: 'low' | 'medium' | 'high'
  estimatedCostUsdMicros?: number
  costConfirmed?: boolean
  background?: boolean
  signal?: AbortSignal
}

export interface StructuredAiResult<T> {
  providerId: AiProviderId
  billingMode: AiBillingMode
  model: string
  value: T
  rawResponse: string
  usage: StructuredAiUsage
  actualCostUsdMicros: number | null
  providerRunId?: string
}

export interface StructuredAiProvider {
  readonly id: AiProviderId
  readonly billingMode: AiBillingMode
  generateJson<T>(request: StructuredAiRequest): Promise<StructuredAiResult<T>>
}

export type StructuredAiErrorCode =
  | 'provider-unavailable'
  | 'provider-auth-required'
  | 'provider-response-invalid'
  | 'budget-blocked'
  | 'budget-confirmation-required'
  | 'request-failed'

export class StructuredAiError extends Error {
  constructor(
    readonly code: StructuredAiErrorCode,
    message: string,
    readonly detail?: string
  ) {
    super(message)
    this.name = 'StructuredAiError'
  }
}

export interface AiCostLedgerReservation {
  id: string
  providerId: AiProviderId
  billingMode: AiBillingMode
  model: string
  purpose: AiTaskPurpose
  estimatedCostUsdMicros: number
}

export interface AiCostLedger {
  getCommittedCostUsdMicros(startedAtEpochSeconds: number): Promise<number>
  reserve(input: Omit<AiCostLedgerReservation, 'id'>): Promise<AiCostLedgerReservation>
  complete(
    id: string,
    result: {
      actualCostUsdMicros: number | null
      inputTokens: number
      outputTokens: number
    }
  ): Promise<void>
  fail(id: string, errorCode: string): Promise<void>
}
