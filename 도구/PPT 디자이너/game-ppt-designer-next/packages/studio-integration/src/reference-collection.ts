import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { ReferenceRecordSchema, TeacherSemanticShapeSchema, type ReferenceRecord } from '@game-presentation/contracts';

const hex = (value: string) => createHash('sha256').update(value).digest('hex');

export const ReferenceCandidateAnalysisSchema = z.strictObject({
  pageGoal: z.string().min(1),
  primaryClaim: z.string().min(1),
  semanticShape: TeacherSemanticShapeSchema,
  informationGroups: z.array(z.string().min(1)).min(2),
  relations: z.array(z.string().min(1)).min(1),
  readingPath: z.enum(['left-to-right', 'top-to-bottom', 'center-out', 'radial', 'before-after', 'guided-sequence']),
  primaryArtifact: z.string().min(1),
  density: z.enum(['sparse', 'balanced', 'dense']),
  grouping: z.array(z.string().min(1)).min(1),
  hierarchy: z.array(z.string().min(1)).min(1),
  alignment: z.array(z.string().min(1)).min(1),
  whitespace: z.array(z.string().min(1)).min(1),
  connectorRoles: z.array(z.string().min(1)),
  imageTextRoles: z.string().min(1),
  whyWorks: z.array(z.string().min(1)).min(1),
  useWhen: z.array(z.string().min(1)).min(1),
  avoidWhen: z.array(z.string().min(1)).min(1),
  reusablePrinciples: z.array(z.string().min(1)).min(1),
  prohibitedCopy: z.array(z.string().min(1)).min(1),
}).superRefine((analysis, context) => {
  for (const boundary of ['exact geometry', 'palette', 'logos', 'IP', 'original assets']) {
    if (!analysis.prohibitedCopy.includes(boundary)) context.addIssue({ code: 'custom', path: ['prohibitedCopy'], message: `복제 금지 경계가 빠졌습니다: ${boundary}` });
  }
});
export type ReferenceCandidateAnalysis = z.infer<typeof ReferenceCandidateAnalysisSchema>;

export const ReferenceCandidateSchema = z.strictObject({
  candidateId: z.string().min(1),
  title: z.string().min(1),
  pageUrl: z.url(),
  sourceCategory: z.enum(['official', 'public-blog', 'public-portfolio']),
  imageUrl: z.url().optional(),
  discoveredAt: z.iso.datetime(),
  status: z.enum(['discovered', 'analyzed', 'approved', 'rejected']),
  analysis: ReferenceCandidateAnalysisSchema.optional(),
  imageSha256: z.string().regex(/^[a-f0-9]{64}$/u).optional(),
  imageWidth: z.number().int().positive().optional(),
  imageHeight: z.number().int().positive().optional(),
  provider: z.enum(['local', 'openrouter']).optional(),
  decidedAt: z.iso.datetime().optional(),
  humanReason: z.string().optional(),
}).superRefine((candidate, context) => {
  if (candidate.status === 'approved' && (!candidate.analysis || !candidate.imageSha256 || !candidate.imageUrl || !candidate.decidedAt)) {
    context.addIssue({ code: 'custom', path: ['status'], message: '실제 이미지 분석과 사용자 판단 없이는 reference를 승인할 수 없습니다.' });
  }
});
export type ReferenceCandidate = z.infer<typeof ReferenceCandidateSchema>;

export function candidateIdFor(pageUrl: string) { return `external-${hex(pageUrl).slice(0, 20)}`; }

function isPrivateIp(address: string): boolean {
  if (address.includes(':')) return address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80') || address.startsWith('::ffff:');
  const parts = address.split('.').map(Number);
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] === 169 && parts[1] === 254
    || parts[0] === 172 && (parts[1] ?? 0) >= 16 && (parts[1] ?? 0) <= 31 || parts[0] === 192 && parts[1] === 168;
}

/** Only public HTTPS images may be fetched by the local reference service. */
export async function requirePublicImageUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('공개 HTTPS 이미지 URL만 허용합니다.');
  const answers = await lookup(url.hostname, { all: true });
  if (!answers.length || answers.some((answer) => isPrivateIp(answer.address))) throw new Error('내부 네트워크 이미지 URL은 허용하지 않습니다.');
  return url;
}

export async function fetchReferenceImage(raw: string, fetcher: typeof fetch = fetch): Promise<Uint8Array> {
  const url = await requirePublicImageUrl(raw);
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok || !(response.headers.get('content-type') ?? '').startsWith('image/')) throw new Error('접근 가능한 이미지 파일이 아닙니다.');
  if (Number(response.headers.get('content-length') ?? 0) > 8 * 1024 * 1024) throw new Error('이미지는 8 MB 이하여야 합니다.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('이미지는 8 MB 이하여야 합니다.');
  return bytes;
}

export function parseModelJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '');
  return JSON.parse(trimmed);
}

export function approveCandidate(candidate: ReferenceCandidate, decidedAt: string, humanReason = ''): ReferenceCandidate {
  if (candidate.status !== 'analyzed' || !candidate.analysis || !candidate.imageSha256 || !candidate.imageUrl) throw new Error('이미지를 분석한 후보만 승인할 수 있습니다.');
  return ReferenceCandidateSchema.parse({ ...candidate, status: 'approved', decidedAt, humanReason });
}

export function approvedReferenceRecord(candidate: ReferenceCandidate): ReferenceRecord {
  const approved = ReferenceCandidateSchema.parse(candidate);
  if (approved.status !== 'approved' || !approved.analysis || !approved.imageSha256 || !approved.imageUrl || !approved.decidedAt) throw new Error('사용자 승인된 분석 후보만 검색 record가 됩니다.');
  const analysis = approved.analysis;
  return ReferenceRecordSchema.parse({
    schemaVersion: '0.1', referenceId: approved.candidateId, title: approved.title,
    source: { pageUrl: approved.pageUrl, assetUrl: approved.imageUrl, discoveredAt: approved.discoveredAt },
    provenance: { status: 'declared', evidenceUrl: approved.pageUrl, checkedAt: approved.decidedAt },
    rights: { status: 'unknown' },
    allowedUse: { analyze: true, cacheThumbnail: false, deriveAbstractPattern: true, reuseAsset: false, redistributeAsset: false },
    hashes: { metadataSha256: hex(JSON.stringify(approved)), sourceSha256: approved.imageSha256 },
    analysis: { intentTags: analysis.useWhen, semanticShapes: [analysis.semanticShape], relationshipShapes: analysis.relations,
      primaryArtifacts: [analysis.primaryArtifact], densityBand: analysis.density, readingPaths: [analysis.readingPath],
      graphicLanguages: analysis.reusablePrinciples, avoidCopying: analysis.prohibitedCopy },
  });
}

export class ReferenceCandidateStore {
  constructor(private readonly root: string) {}
  private get file() { return resolve(this.root, 'candidates.v1.json'); }
  async list(): Promise<ReferenceCandidate[]> {
    try { return z.array(ReferenceCandidateSchema).parse(JSON.parse(await readFile(this.file, 'utf8'))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
  async upsert(candidate: ReferenceCandidate): Promise<ReferenceCandidate[]> {
    const valid = ReferenceCandidateSchema.parse(candidate);
    const current = await this.list();
    const next = [valid, ...current.filter((item) => item.candidateId !== valid.candidateId)];
    await mkdir(this.root, { recursive: true });
    await writeFile(this.file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return next;
  }
  async approvedRecords() { return (await this.list()).filter((item) => item.status === 'approved').map(approvedReferenceRecord); }
}
