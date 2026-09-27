import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { approveCandidate, approvedReferenceRecord, candidateIdFor, ReferenceCandidateAnalysisSchema, ReferenceCandidateSchema, ReferenceCandidateStore, requirePublicImageUrl } from '../src/reference-collection.js';
import { analyzeReferenceWithAi, discoverReferenceLinks, validateReferenceAiSettings } from '../src/reference-ai.js';

const analysis = {
  pageGoal: 'Explain a change', primaryClaim: 'The change preserves choice', semanticShape: 'aligned-before-after-spec',
  informationGroups: ['before', 'after'], relations: ['same criterion comparison'], readingPath: 'before-after', primaryArtifact: 'spec comparison',
  density: 'balanced', grouping: ['aligned pairs'], hierarchy: ['title before detail'], alignment: ['same row'], whitespace: ['separate columns'],
  connectorRoles: ['change direction'], imageTextRoles: 'text carries the spec', whyWorks: ['pairing lowers search cost'],
  useWhen: ['paired change'], avoidWhen: ['no shared criterion'], reusablePrinciples: ['align corresponding items'],
  prohibitedCopy: ['exact geometry', 'palette', 'logos', 'IP', 'original assets'],
} as const;
const pageUrl = 'https://example.org/game-design/slides';
const discovered = ReferenceCandidateSchema.parse({ candidateId: candidateIdFor(pageUrl), title: 'Comparison slide', pageUrl,
  sourceCategory: 'official', imageUrl: 'https://example.org/slide.png', discoveredAt: '2026-09-15T00:00:00.000Z', status: 'discovered' });
const analyzed = ReferenceCandidateSchema.parse({ ...discovered, status: 'analyzed', analysis, imageSha256: 'a'.repeat(64), imageWidth: 1920, imageHeight: 1080, provider: 'local' });
const settings = { openRouterKey: 'test-key', openRouterModel: 'test/vision', localEndpoint: 'http://127.0.0.1:8000/v1/chat/completions', localModel: 'local-vision' };

describe('human-gated external reference collection', () => {
  it('never promotes an unanalysed or rejected candidate and retains unknown-rights copy boundaries', () => {
    expect(() => approveCandidate(discovered, '2026-09-15T00:00:00.000Z')).toThrow(/분석/u);
    const approved = approveCandidate(analyzed, '2026-09-15T00:00:00.000Z', 'Useful aligned pairs');
    const record = approvedReferenceRecord(approved);
    expect(record).toMatchObject({ referenceId: discovered.candidateId, rights: { status: 'unknown' },
      allowedUse: { analyze: true, cacheThumbnail: false, deriveAbstractPattern: true, reuseAsset: false, redistributeAsset: false } });
    expect(record.hashes.sourceSha256).toBe('a'.repeat(64));
    expect(() => approvedReferenceRecord(analyzed)).toThrow(/승인/u);
    expect(ReferenceCandidateAnalysisSchema.safeParse({ ...analysis, prohibitedCopy: ['logos'] }).success).toBe(false);
  });

  it('persists the human decision and returns only approved records to production retrieval', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ppt-references-'));
    try {
      const store = new ReferenceCandidateStore(root);
      await store.upsert(discovered);
      expect(await store.approvedRecords()).toEqual([]);
      await store.upsert(analyzed);
      expect(await store.approvedRecords()).toEqual([]);
      await store.upsert(ReferenceCandidateSchema.parse({ ...discovered, candidateId: candidateIdFor('https://example.org/rejected'), pageUrl: 'https://example.org/rejected', status: 'rejected', decidedAt: '2026-09-15T00:00:00.000Z' }));
      expect(await store.approvedRecords()).toEqual([]);
      await store.upsert(approveCandidate(analyzed, '2026-09-15T00:00:00.000Z'));
      expect((await new ReferenceCandidateStore(root).approvedRecords()).map((item) => item.referenceId)).toEqual([discovered.candidateId]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('requires public HTTPS images and a loopback local AI server', async () => {
    await expect(requirePublicImageUrl('http://example.org/slide.png')).rejects.toThrow(/HTTPS/u);
    await expect(requirePublicImageUrl('https://127.0.0.1/slide.png')).rejects.toThrow(/내부 네트워크/u);
    expect(() => validateReferenceAiSettings({ ...settings, localEndpoint: 'https://remote.example/v1/chat/completions' })).toThrow(/loopback/u);
  });

  it('OpenRouter discovery actually requests web search and quarantines its links as candidates', async () => {
    const fetcher = vi.fn(async (_url: unknown, init: RequestInit) => {
      const request = JSON.parse(String(init.body)) as { tools: unknown[] };
      expect(request.tools).toEqual([{ type: 'openrouter:web_search' }]);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ candidates: [{ title: 'Observed page', pageUrl, sourceCategory: 'official' }] }) } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await discoverReferenceLinks({ query: 'game design slides', settings, fetcher })).toEqual([{ title: 'Observed page', pageUrl, sourceCategory: 'official' }]);
  });

  it('local and remote image analysis return schema-validated abstract principles, not model training', async () => {
    const calls: Array<{ endpoint: string; authorization?: string }> = [];
    const fetcher = vi.fn(async (url: unknown, init: RequestInit) => {
      const request = JSON.parse(String(init.body)) as { messages: Array<{ content: unknown }> };
      expect(JSON.stringify(request.messages)).toContain('data:image/png;base64,');
      calls.push({ endpoint: String(url), ...(init.headers && { authorization: (init.headers as Record<string, string>).Authorization }) });
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(analysis) } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const bytes = new Uint8Array([1, 2, 3]);
    expect((await analyzeReferenceWithAi({ bytes, mimeType: 'image/png', provider: 'local', settings, fetcher })).semanticShape).toBe('aligned-before-after-spec');
    expect((await analyzeReferenceWithAi({ bytes, mimeType: 'image/png', provider: 'openrouter', settings, fetcher })).reusablePrinciples).toEqual(['align corresponding items']);
    expect(calls[0]?.endpoint).toBe(settings.localEndpoint);
    expect(calls[1]?.endpoint).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(calls[1]?.authorization).toBe('Bearer test-key');
  });
});
