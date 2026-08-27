import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => path.join(os.tmpdir(), 'ohmyppt-test-user-data')) }
}))

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))

import { DeckIrRevisionConflictError, PPTDatabase } from '../../../src/main/db/database'
import { DeckIrRepository } from '../../../src/main/deck-ir/repository'

describe('DeckIR database persistence', () => {
  const roots: string[] = []

  afterEach(async () => {
    for (const root of roots.splice(0)) {
      // libsql's Windows worker can retain the WAL handle after close; the OS temp cleaner
      // removes these test directories later without making the assertion suite flaky.
      if (process.platform === 'win32') continue
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  })

  it('persists revisions atomically and rejects stale saves', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ohmyppt-deck-ir-'))
    roots.push(root)
    const db = new PPTDatabase(path.join(root, 'test.db'))
    await db.init()

    try {
      const sessionId = await db.createSession({
        title: 'DeckIR test',
        provider: 'offline',
        model: 'manual',
        slideSizeId: 'wide-16-9',
        slideWidth: 1600,
        slideHeight: 900
      })
      const repository = new DeckIrRepository(db, () => 100)
      const first = await repository.create({
        sessionId,
        title: '자유 형식 기획서',
        rawBrief: '실측 12프레임을 근거로 사용한다.'
      })
      const second = await repository.save(
        { ...first, title: '수정안' },
        { expectedRevision: 1, actor: 'user', reason: '제목 수정' }
      )

      expect(second.revision).toBe(2)
      await expect(repository.listRevisions(sessionId)).resolves.toHaveLength(2)
      await expect(
        repository.save(first, {
          expectedRevision: 1,
          actor: 'ai',
          reason: '오래된 AI 결과'
        })
      ).rejects.toBeInstanceOf(DeckIrRevisionConflictError)
      await expect(repository.get(sessionId)).resolves.toMatchObject({
        revision: 2,
        title: '수정안'
      })
    } finally {
      await db.close()
    }
  })
})
