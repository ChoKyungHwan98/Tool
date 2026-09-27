import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'native/ProjectStore.cpp'), 'utf8');
const start = source.indexOf('json ProjectStore::availableTools()');
const end = source.indexOf('json ProjectStore::makeHomeTab()', start);
if (start < 0 || end < 0) throw new Error('도구 등록부를 찾을 수 없습니다.');

const registry = source.slice(start, end);
const toolIds = [...registry.matchAll(/\{"id",\s*"([^"]+)"\}/g)].map((match) => match[1]);
const acknowledgement = JSON.parse(readFileSync(resolve(root, 'docs/tool-guideline-ack.json'), 'utf8'));
const acknowledged = new Set(acknowledgement.acknowledgedTools ?? []);
const missing = toolIds.filter((id) => !acknowledged.has(id));

if (missing.length > 0) {
  console.error('\n새 도구가 UI 통합 지침 확인 없이 등록되었습니다.');
  console.error('먼저 docs/TOOL_UI_INTEGRATION_GUIDELINES.md 전체와');
  console.error('SHARED_PRODUCT_UI_GUIDELINE.md 「⚠ 홈 레이아웃은 모든 도구가 똑같다」를 읽고 적용한 뒤');
  console.error(`docs/tool-guideline-ack.json에 다음 ID를 추가하세요: ${missing.join(', ')}\n`);
  process.exit(1);
}

console.log(`도구 UI 통합 지침 확인: ${toolIds.length}개 도구`);

// ── 글자 기준 (SHARED_PRODUCT_UI_GUIDELINE.md 「글자 기준 — 모든 화면」) ──────────
const SIZES = new Set([12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 40, 48]);
const WEIGHTS = new Set([400, 500, 600, 700]);
const EXEMPT = ['thumb', 'sample-pages', 'slide-label', 'mini-map', 'map-node', 'preview-window',
  'table-cell', 'pattern-node', 'connection-wire', 'kbd'];
const toolRoot = resolve(root, '..', '도구');
const styleRoots = [
  [resolve(root, 'ui/src'), /\.css$/],
  [resolve(toolRoot, '테이블 디자이너/프로그램/src'), /\.css$/],
  [resolve(toolRoot, '패턴 디자이너/src'), /\.css$/],
  [resolve(toolRoot, 'PPT 디자이너/game-ppt-designer-next/apps/workbench/src'), /\.css$/],
  [resolve(toolRoot, 'AI 리뷰데이터 분석/프로그램/static'), /\.html$/],
];

function listFiles(dir, pattern) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listFiles(full, pattern);
    return pattern.test(entry.name) ? [full] : [];
  });
}

const typeErrors = [];
for (const [dir, pattern] of styleRoots) {
  for (const file of listFiles(dir, pattern)) {
    let css = readFileSync(file, 'utf8');
    if (file.endsWith('.html')) css = [...css.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = rule[1].trim().replace(/\s+/g, ' ');
      if (EXEMPT.some((word) => selector.includes(word))) continue;
      const where = `${relative(resolve(root, '..'), file)}  ${selector.slice(-60)}`;
      for (const m of rule[2].matchAll(/font-size:\s*([0-9.]+)px/g)) {
        if (!SIZES.has(Number(m[1]))) typeErrors.push(`${where}  글자 크기 ${m[1]}px`);
      }
      for (const m of rule[2].matchAll(/font-weight:\s*([0-9]{3})\b/g)) {
        if (!WEIGHTS.has(Number(m[1]))) typeErrors.push(`${where}  굵기 ${m[1]}`);
      }
      // font: 600 12px/1.5 … 한 줄 표기
      for (const m of rule[2].matchAll(/font:\s*(?:([0-9]{3})\s+)?([0-9.]+)px/g)) {
        if (m[1] && !WEIGHTS.has(Number(m[1]))) typeErrors.push(`${where}  굵기 ${m[1]}`);
        if (!SIZES.has(Number(m[2]))) typeErrors.push(`${where}  글자 크기 ${m[2]}px`);
      }
    }
  }
}

if (typeErrors.length > 0) {
  console.error(`\n글자 기준을 벗어난 곳이 ${typeErrors.length}개 있습니다. 허용 크기: ${[...SIZES].join('·')}px, 굵기: ${[...WEIGHTS].join('·')}`);
  console.error('기준: SHARED_PRODUCT_UI_GUIDELINE.md 「글자 기준 — 모든 화면」\n');
  for (const line of typeErrors.slice(0, 40)) console.error('  ' + line);
  if (typeErrors.length > 40) console.error(`  … 외 ${typeErrors.length - 40}개`);
  process.exit(1);
}
console.log('글자 기준 확인: 통과');
