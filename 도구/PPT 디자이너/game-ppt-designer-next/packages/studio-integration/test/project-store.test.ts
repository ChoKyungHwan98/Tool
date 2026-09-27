import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalProjectStore } from '../src/project-store.js';

describe('local project persistence', () => {
  it('creates, reloads, searches, and records recent work', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'ppt-projects-'));
    try {
      const store = new LocalProjectStore(root);
      const created = await store.create('도로시아', '2026-09-06T00:00:00.000Z');
      expect((await store.list('도로')).map((project) => project.projectId)).toEqual([created.projectId]);
      await store.recordArtifact({ projectId: created.projectId, artifactId: 'artifact-1', documentId: 'document-1', mode: 'document', title: '전투 구조', previewPngUrl: '/preview.png', updatedAt: '2026-09-06T01:00:00.000Z' });
      const reloaded = await new LocalProjectStore(root).get(created.projectId);
      expect(reloaded.documents).toHaveLength(1); expect(reloaded.history[0]).toMatchObject({ artifactId: 'artifact-1', title: '전투 구조' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('moves deleted projects to a recoverable trash directory', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'ppt-projects-trash-'));
    const trash = resolve(root, '..', '.ppt-designer-trash');
    try {
      const store = new LocalProjectStore(root);
      const created = await store.create('삭제 대상', '2026-09-06T00:00:00.000Z');
      await store.trash(created.projectId);
      expect(await store.list()).toEqual([]);
      const { readdir } = await import('node:fs/promises');
      expect((await readdir(trash)).some((name) => name.startsWith(created.projectId))).toBe(true);
    } finally { await rm(root, { recursive: true, force: true }); await rm(trash, { recursive: true, force: true }); }
  });
});
