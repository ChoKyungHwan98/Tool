import { describe, expect, it } from 'vitest'
import { createEmptyDeckIr } from '../../../src/shared/deck-ir'
import {
  DeckIrChecksumMismatchError,
  DeckIrRepository,
  type DeckIrDatabase
} from '../../../src/main/deck-ir/repository'
import { sha256Text } from '../../../src/main/deck-ir/stable-json'
import type { SaveDeckIrSnapshotData } from '../../../src/main/db/database'
import type { DeckIrDocumentRow, DeckIrRevisionRow } from '../../../src/main/db/schema'

class FakeDeckIrDatabase implements DeckIrDatabase {
  current?: DeckIrDocumentRow
  revisions: DeckIrRevisionRow[] = []

  async getDeckIrDocumentRow(): Promise<DeckIrDocumentRow | undefined> {
    return this.current
  }

  async listDeckIrDocumentRows(): Promise<DeckIrDocumentRow[]> {
    return this.current ? [this.current] : []
  }

  async listDeckIrRevisionRows(): Promise<DeckIrRevisionRow[]> {
    return [...this.revisions].reverse()
  }

  async getDeckIrRevisionRow(
    _sessionId: string,
    revision: number
  ): Promise<DeckIrRevisionRow | undefined> {
    return this.revisions.find((row) => row.revision === revision)
  }

  async saveDeckIrSnapshot(data: SaveDeckIrSnapshotData): Promise<DeckIrDocumentRow> {
    this.current = {
      sessionId: data.sessionId,
      revision: data.revision,
      documentJson: data.documentJson,
      checksum: data.checksum,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    }
    this.revisions.push({
      id: `revision-${data.revision}`,
      sessionId: data.sessionId,
      revision: data.revision,
      actor: data.actor,
      reason: data.reason,
      checksum: data.checksum,
      documentJson: data.documentJson,
      createdAt: data.updatedAt
    })
    return this.current
  }
}

describe('DeckIrRepository', () => {
  it('saves immutable full snapshots with incrementing revisions', async () => {
    const db = new FakeDeckIrDatabase()
    const repository = new DeckIrRepository(db, () => 200)
    const initial = createEmptyDeckIr({
      sessionId: 'session-1',
      title: '테스트',
      now: 100,
      idFactory: (prefix) => `${prefix}-1`
    })
    const revision1 = await repository.save(initial, {
      expectedRevision: 0,
      actor: 'user',
      reason: '초안'
    })
    const revision2 = await repository.save(
      { ...revision1, title: '수정된 제목' },
      { expectedRevision: 1, actor: 'user', reason: '제목 수정' }
    )

    expect(revision2.revision).toBe(2)
    await expect(repository.list()).resolves.toEqual([
      expect.objectContaining({ revision: 2, title: '수정된 제목' })
    ])
    await expect(repository.getRevision('session-1', 1)).resolves.toMatchObject({
      revision: 1,
      title: '테스트'
    })
    await expect(repository.listRevisions('session-1')).resolves.toEqual([
      expect.objectContaining({ revision: 2, reason: '제목 수정' }),
      expect.objectContaining({ revision: 1, reason: '초안' })
    ])
  })

  it('detects stored JSON tampering before parsing the document', async () => {
    const db = new FakeDeckIrDatabase()
    db.current = {
      sessionId: 'session-1',
      revision: 1,
      documentJson: '{"tampered":true}',
      checksum: sha256Text('{"different":true}'),
      createdAt: 1,
      updatedAt: 1
    }
    const repository = new DeckIrRepository(db)
    await expect(repository.get('session-1')).rejects.toBeInstanceOf(DeckIrChecksumMismatchError)
  })
})
