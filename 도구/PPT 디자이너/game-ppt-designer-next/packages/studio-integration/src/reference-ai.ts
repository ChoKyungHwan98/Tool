import { z } from 'zod';
import { ReferenceCandidateAnalysisSchema, parseModelJson } from './reference-collection.js';

export type ReferenceAiSettings = {
  openRouterKey: string;
  openRouterModel: string;
  localEndpoint: string;
  localModel: string;
};

const DiscoverySchema = z.strictObject({ candidates: z.array(z.strictObject({
  title: z.string().min(1), pageUrl: z.url(), sourceCategory: z.enum(['official', 'public-blog', 'public-portfolio']), imageUrl: z.url().optional(),
})).max(8) });

function replyText(value: unknown): string {
  const response = value as { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }> };
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  return Array.isArray(content) ? content.map((item) => item.text ?? '').join('') : '';
}

async function completion(input: {
  endpoint: string; model: string; key?: string | undefined; messages: unknown[]; webSearch?: boolean; fetcher?: typeof fetch | undefined;
}): Promise<string> {
  const response = await (input.fetcher ?? fetch)(input.endpoint, {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { 'Content-Type': 'application/json', ...(input.key ? { Authorization: `Bearer ${input.key}` } : {}) },
    body: JSON.stringify({ model: input.model, messages: input.messages, response_format: { type: 'json_object' },
      ...(input.webSearch ? { tools: [{ type: 'openrouter:web_search' }], web_search_options: { max_total_results: 8 } } : {}) }),
  });
  if (!response.ok) throw new Error(`AI 연결 실패 (${response.status}). 키, 모델, 서버 상태를 확인하세요.`);
  const raw = replyText(await response.json());
  if (!raw) throw new Error('AI가 분석 결과를 반환하지 않았습니다.');
  return raw;
}

export async function discoverReferenceLinks(input: { query: string; settings: ReferenceAiSettings; fetcher?: typeof fetch }) {
  if (!input.settings.openRouterKey || !input.settings.openRouterModel) throw new Error('웹 후보 검색에는 OpenRouter 키와 모델 설정이 필요합니다.');
  const raw = await completion({ endpoint: 'https://openrouter.ai/api/v1/chat/completions', model: input.settings.openRouterModel,
    key: input.settings.openRouterKey, webSearch: true, fetcher: input.fetcher,
    messages: [{ role: 'system', content: 'Search the web for genuine game-design presentation slides from official developer/conference sources, public blogs, and public portfolios. Return JSON only: {"candidates":[{"title":"...","pageUrl":"https://...","sourceCategory":"official|public-blog|public-portfolio","imageUrl":"https://..."}]}. Use only URLs observed in search results; never invent a URL. Prefer original source pages. An imageUrl must point to a directly observed slide image; omit it otherwise. Public does not imply asset-reuse rights. Maximum 8.' },
      { role: 'user', content: input.query }] });
  return DiscoverySchema.parse(parseModelJson(raw)).candidates.filter((item) => new URL(item.pageUrl).protocol === 'https:');
}

export async function analyzeReferenceWithAi(input: {
  bytes: Uint8Array; mimeType: string; provider: 'local' | 'openrouter'; settings: ReferenceAiSettings; fetcher?: typeof fetch;
}) {
  const remote = input.provider === 'openrouter';
  const model = remote ? input.settings.openRouterModel : input.settings.localModel;
  if (!model || remote && !input.settings.openRouterKey) throw new Error(`${remote ? 'OpenRouter' : '로컬'} 모델 설정이 필요합니다.`);
  const endpoint = remote ? 'https://openrouter.ai/api/v1/chat/completions' : input.settings.localEndpoint;
  const image = `data:${input.mimeType};base64,${Buffer.from(input.bytes).toString('base64')}`;
  const raw = await completion({ endpoint, model, key: remote ? input.settings.openRouterKey : undefined, fetcher: input.fetcher,
    messages: [{ role: 'system', content: `Analyze only what is visible in this game-design slide. Do not infer missing facts or evaluate brand style. Return a JSON object with exactly these keys: pageGoal, primaryClaim, semanticShape (one of process-diagnosis, artifact-annotation, hierarchy, tradeoff, aligned-before-after-spec, layered-countermeasure), informationGroups (2+ strings), relations (1+ strings), readingPath (left-to-right, top-to-bottom, center-out, radial, before-after, guided-sequence), primaryArtifact, density (sparse, balanced, dense), grouping (strings), hierarchy (strings), alignment (strings), whitespace (strings), connectorRoles (strings), imageTextRoles, whyWorks (strings), useWhen (strings), avoidWhen (strings), reusablePrinciples (strings), prohibitedCopy (strings). Keep uncertainty explicit in descriptions. Reusable principles must be abstract; prohibitedCopy must include exact geometry, palette, logos, IP and original assets. No numeric measurement unless actually measured.` },
      { role: 'user', content: [{ type: 'text', text: 'Analyze this single slide image for human curation.' }, { type: 'image_url', image_url: { url: image } }] }] });
  return ReferenceCandidateAnalysisSchema.parse(parseModelJson(raw));
}

export function validateReferenceAiSettings(input: ReferenceAiSettings) {
  const url = new URL(input.localEndpoint);
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('로컬 AI는 이 컴퓨터의 loopback 주소만 연결할 수 있습니다.');
  }
  if (!url.pathname.endsWith('/chat/completions')) throw new Error('로컬 AI의 OpenAI-compatible chat/completions 주소가 필요합니다.');
  return input;
}
