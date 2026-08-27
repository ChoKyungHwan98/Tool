import type { AiCostLedger, AiCostLedgerReservation } from '../../agent-runtime/model'
import type { PPTDatabase } from '../../db/database'

type AiCostDatabasePort = Pick<
  PPTDatabase,
  'getAiCommittedCostUsdMicros' | 'reserveAiCall' | 'completeAiCall' | 'failAiCall'
>

export class DbAiCostLedger implements AiCostLedger {
  constructor(private readonly db: AiCostDatabasePort) {}

  getCommittedCostUsdMicros(startedAtEpochSeconds: number): Promise<number> {
    return this.db.getAiCommittedCostUsdMicros(startedAtEpochSeconds)
  }

  async reserve(input: Omit<AiCostLedgerReservation, 'id'>): Promise<AiCostLedgerReservation> {
    const id = await this.db.reserveAiCall(input)
    return { id, ...input }
  }

  complete(
    id: string,
    result: {
      actualCostUsdMicros: number | null
      inputTokens: number
      outputTokens: number
    }
  ): Promise<void> {
    return this.db.completeAiCall(id, result)
  }

  fail(id: string, errorCode: string): Promise<void> {
    return this.db.failAiCall(id, errorCode)
  }
}
