import type { StructuredAiProvider, StructuredAiRequest, StructuredAiResult } from './types'
import { StructuredAiError } from './types'

export class OfflineStructuredProvider implements StructuredAiProvider {
  readonly id = 'offline' as const
  readonly billingMode = 'offline' as const

  async generateJson<T>(_request: StructuredAiRequest): Promise<StructuredAiResult<T>> {
    throw new StructuredAiError(
      'provider-unavailable',
      'AI generation is offline. Manual editing and exports remain available.'
    )
  }
}
