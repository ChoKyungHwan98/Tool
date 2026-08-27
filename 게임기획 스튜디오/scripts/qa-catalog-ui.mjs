import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const studioRoot = path.resolve(scriptDirectory, '..');
const toolRoot = path.resolve(studioRoot, '..');
const playwrightEntry = path.join(toolRoot, '도구', '테이블 디자이너', '프로그램', 'node_modules', 'playwright', 'index.mjs');
const { chromium } = await import(pathToFileURL(playwrightEntry).href);

const url = process.argv[2] ?? 'http://127.0.0.1:4321/';
const outputDirectory = process.argv[3] ?? path.join(studioRoot, 'qa-output');
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 920 } });
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertNoOverflow(selector) {
  const metrics = await page.locator(selector).evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  assert(metrics.scrollWidth <= metrics.clientWidth + 1, `${selector} 가로 오버플로: ${JSON.stringify(metrics)}`);
}

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '도구 보관함' }).waitFor({ state: 'visible' });
  assert((await page.locator('.catalog-tool-row').count()) === 4, '도구 보관함에 등록 도구 4개가 모두 표시되지 않았습니다.');
  assert((await page.locator('.catalog-group').count()) === 4, '업무 분류 4개가 만들어지지 않았습니다.');
  assert((await page.locator('.studio-app').getAttribute('class'))?.includes('studio-app--canvas-mode'), '도구 보관함에 밝은 셸이 적용되지 않았습니다.');

  await page.getByRole('button', { name: '작업공간 연결 가능', exact: true }).click();
  assert((await page.locator('.catalog-tool-row').count()) === 2, '연결 가능한 도구 필터가 2개를 반환하지 않았습니다.');
  await page.getByRole('button', { name: '독립 도구', exact: true }).click();
  assert((await page.locator('.catalog-tool-row').count()) === 2, '독립 도구 필터가 2개를 반환하지 않았습니다.');
  await page.getByRole('button', { name: '전체', exact: true }).first().click();
  await page.getByRole('button', { name: 'AI·자동화', exact: true }).click();
  assert((await page.locator('.catalog-tool-row').count()) === 1, 'AI·자동화 분류가 프롬프트 도구 하나를 반환하지 않았습니다.');
  await page.getByRole('textbox', { name: '도구 검색', exact: true }).fill('FSM');
  assert((await page.locator('.catalog-tool-row').count()) === 0, '분류와 검색의 교차 필터가 적용되지 않았습니다.');
  await page.getByRole('button', { name: '필터 초기화' }).click();
  await assertNoOverflow('.editor-content');

  fs.mkdirSync(outputDirectory, { recursive: true });
  await page.screenshot({ path: path.join(outputDirectory, 'tool-catalog-polished.png'), fullPage: true });

  await page.locator('.catalog-tool-row').first().click();
  await page.locator('.embedded-tool-frame').waitFor({ state: 'visible' });
  assert((await page.locator('.studio-app').getAttribute('class'))?.includes('studio-app--canvas-mode'), '도구로 이동한 후 모든 도구 화면의 셸 기준이 유지되지 않았습니다.');
  await page.getByRole('button', { name: '뒤로', exact: true }).click();
  await page.getByRole('heading', { name: '도구 보관함' }).waitFor({ state: 'visible' });

  await page.getByRole('button', { name: '작업공간', exact: true }).click();
  await page.getByRole('heading', { name: '작업공간', exact: true }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '새 작업공간', exact: true }).click();
  await page.getByLabel('새 작업공간').waitFor({ state: 'visible' });
  await page.getByLabel('작업공간 이름').fill('던전 RPG');
  await page.getByRole('button', { name: '작업공간 만들기', exact: true }).click();
  await page.locator('.workspace-graph').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '작업공간', exact: true }).click();
  await page.getByRole('heading', { name: '작업공간', exact: true }).waitFor({ state: 'visible' });
  assert((await page.locator('.workspace-library-row').count()) === 1, '생성한 작업공간이 최근 목록에 표시되지 않았습니다.');
  await page.getByLabel('작업공간 검색').fill('던전');
  assert((await page.locator('.workspace-library-row').count()) === 1, '작업공간 검색 결과가 올바르지 않습니다.');
  await assertNoOverflow('.editor-content');
  await page.screenshot({ path: path.join(outputDirectory, 'workspace-library-polished.png'), fullPage: true });

  await page.locator('.workspace-library-row').click();
  await page.locator('.workspace-graph').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '도구 추가', exact: true }).click();
  await page.locator('.tool-palette').waitFor({ state: 'visible' });
  assert((await page.locator('.tool-palette-group').count()) === 2, '도구 추가 창이 연결 가능/독립 도구 두 그룹으로 나뉘지 않았습니다.');
  await page.screenshot({ path: path.join(outputDirectory, 'workspace-tool-palette-polished.png'), fullPage: true });

  if (errors.length > 0) throw new Error(errors.join('\n'));
  console.log('PASS: 밝은 셸, 도구 분류·연결 필터·검색, 작업공간 생성·검색, 가로 오버플로를 확인했습니다.');
} finally {
  await browser.close();
}
