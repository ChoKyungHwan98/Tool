import {
  assertDeckIrIntegrity,
  createEmptyDeckIr,
  migrateDeckIrDocument,
  type DeckIrDocument
} from '@shared/deck-ir'
import type { DeckIrDocumentRow, DeckIrRevisionRow } from '../db/schema'
import type { DeckIrRevisionActor, SaveDeckIrSnapshotData } from '../db/database'
import { sha256Text, stableStringify } from './stable-json'

export interface DeckIrDatabase {
  getDeckIrDocumentRow(sessionId: string): Promise<DeckIrDocumentRow | undefined>
  listDeckIrDocumentRows(): Promise<DeckIrDocumentRow[]>
  listDeckIrRevisionRows(sessionId: string): Promise<DeckIrRevisionRow[]>
  getDeckIrRevisionRow(sessionId: string, revision: number): Promise<DeckIrRevisionRow | undefined>
  saveDeckIrSnapshot(data: SaveDeckIrSnapshotData): Promise<DeckIrDocumentRow>
}

export interface DeckIrRevisionSummary {
  revision: number
  actor: DeckIrRevisionActor
  reason: string
  checksum: string
  createdAt: number
}

export class DeckIrChecksumMismatchError extends Error {
  readonly code = 'DECK_IR_CHECKSUM_MISMATCH'

  constructor(
    readonly sessionId: string,
    readonly revision: number
  ) {
    super(`DeckIR checksum mismatch for ${sessionId} revision ${revision}.`)
    this.name = 'DeckIrChecksumMismatchError'
  }
}

const parseVerifiedDocument = (
  row: Pick<DeckIrDocumentRow, 'sessionId' | 'revision' | 'documentJson' | 'checksum'>
): DeckIrDocument => {
  if (sha256Text(row.documentJson) !== row.checksum) {
    throw new DeckIrChecksumMismatchError(row.sessionId, row.revision)
  }
  const document = migrateDeckIrDocument(JSON.parse(row.documentJson))
  if (document.sessionId !== row.sessionId || document.revision !== row.revision) {
    throw new DeckIrChecksumMismatchError(row.sessionId, row.revision)
  }
  return document
}

export class DeckIrRepository {
  constructor(
    private readonly db: DeckIrDatabase,
    private readonly now: () => number = Date.now
  ) {}

  async get(sessionId: string): Promise<DeckIrDocument | null> {
    const row = await this.db.getDeckIrDocumentRow(sessionId)
    return row ? parseVerifiedDocument(row) : null
  }

  async list(): Promise<DeckIrDocument[]> {
    const rows = await this.db.listDeckIrDocumentRows()
    return rows.map(parseVerifiedDocument)
  }

  async create(args: {
    sessionId: string
    title: string
    rawBrief?: string
    actor?: DeckIrRevisionActor
    reason?: string
  }): Promise<DeckIrDocument> {
    const existing = await this.db.getDeckIrDocumentRow(args.sessionId)
    if (existing) throw new Error(`DeckIR already exists for session: ${args.sessionId}`)
    const document = createEmptyDeckIr({
      sessionId: args.sessionId,
      title: args.title,
      rawBrief: args.rawBrief,
      now: this.now()
    })
    return this.save(document, {
      expectedRevision: 0,
      actor: args.actor || 'user',
      reason: args.reason || 'Initial DeckIR'
    })
  }

  async save(
    input: unknown,
    args: {
      expectedRevision: number
      actor: DeckIrRevisionActor
      reason: string
    }
  ): Promise<DeckIrDocument> {
    const parsed = migrateDeckIrDocument(input)
    if (parsed.revision !== args.expectedRevision) {
      throw new Error(
        `DeckIR payload revision ${parsed.revision} does not match expected revision ${args.expectedRevision}.`
      )
    }
    const next: DeckIrDocument = {
      ...parsed,
      revision: args.expectedRevision + 1,
      updatedAt: this.now()
    }
    assertDeckIrIntegrity(next)
    const documentJson = stableStringify(next)
    const checksum = sha256Text(documentJson)
    await this.db.saveDeckIrSnapshot({
      sessionId: next.sessionId,
      expectedRevision: args.expectedRevision,
      revision: next.revision,
      actor: args.actor,
      reason: args.reason.trim() || 'DeckIR update',
      checksum,
      documentJson,
      createdAt: next.createdAt,
      updatedAt: next.updatedAt
    })
    return next
  }

  async listRevisions(sessionId: string): Promise<DeckIrRevisionSummary[]> {
    const rows = await this.db.listDeckIrRevisionRows(sessionId)
    return rows.map((row) => ({
      revision: row.revision,
      actor: row.actor as DeckIrRevisionActor,
      reason: row.reason,
      checksum: row.checksum,
      createdAt: row.createdAt
    }))
  }

  async getRevision(sessionId: string, revision: number): Promise<DeckIrDocument | null> {
    const row = await this.db.getDeckIrRevisionRow(sessionId, revision)
    return row ? parseVerifiedDocument(row) : null
  }
}
