import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const studioRoot = path.resolve(scriptDirectory, '..');
const toolRoot = path.resolve(studioRoot, '..');
const playwrightEntry = path.join(toolRoot, '도구', '테이블 디자이너', '프로그램', 'node_modules', 'playwright', 'index.mjs');
const { chromium } = await import(pathToFileURL(playwrightEntry).href);

const url = process.argv[2] ?? 'http://127.0.0.1:4317/';
const outputDirectory = process.argv[3] ?? path.join(studioRoot, 'qa-output');
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 920 } });
await page.addInitScript(() => localStorage.removeItem('game-design-studio:project-launcher-layout:v1'));
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
  assert((await page.locator('.catalog-tool-row').count()) === 5, '도구 보관함에 등록 도구 5개가 모두 표시되지 않았습니다.');
  assert((await page.locator('.catalog-group').count()) === 1, '도구 목록이 표시되지 않았습니다.');
  assert((await page.locator('.catalog-feature, .catalog-count').count()) === 0, '추천 도구나 도구 개수 표시가 남아 있습니다.');
  assert((await page.locator('.studio-app').getAttribute('class'))?.includes('studio-app--canvas-mode'), '도구 보관함에 밝은 셸이 적용되지 않았습니다.');

  await page.getByRole('button', { name: '작업공간 연결 가능', exact: true }).click();
  assert((await page.locator('.catalog-tool-row').count()) === 4, '연결 가능한 도구 필터가 4개를 반환하지 않았습니다.');
  await page.getByRole('button', { name: '독립 도구', exact: true }).click();
  assert((await page.locator('.catalog-tool-row').count()) === 1, '독립 도구 필터가 1개를 반환하지 않았습니다.');
  await page.getByRole('button', { name: '전체', exact: true }).first().click();
  await page.getByRole('button', { name: '인공지능·자동화', exact: true }).click();
  assert((await page.locator('.catalog-tool-row').count()) === 1, 'AI·자동화 분류가 프롬프트 도구 하나를 반환하지 않았습니다.');
  await page.getByRole('searchbox', { name: '도구 검색', exact: true }).fill('FSM');
  assert((await page.locator('.catalog-tool-row').count()) === 0, '분류와 검색의 교차 필터가 적용되지 않았습니다.');
  await page.getByRole('button', { name: '필터 초기화' }).click();
  await assertNoOverflow('.editor-content');

  fs.mkdirSync(outputDirectory, { recursive: true });
  await page.reload({ waitUntil: 'networkidle' });
  await page.mouse.move(20, 20);
  await page.screenshot({ path: path.join(outputDirectory, 'tool-catalog-polished.png'), fullPage: true });

  await page.locator('.catalog-tool-row').first().click();
  await page.locator('.embedded-tool-frame').waitFor({ state: 'visible' });
  assert((await page.locator('.studio-app').getAttribute('class'))?.includes('studio-app--canvas-mode'), '도구로 이동한 후 모든 도구 화면의 셸 기준이 유지되지 않았습니다.');
  await page.locator('.titlebar-back').click();
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
  assert((await page.locator('.project-launcher-item').count()) === 1, '생성한 작업공간이 최근 목록에 표시되지 않았습니다.');
  await page.getByLabel('작업공간 검색').fill('던전');
  assert((await page.locator('.project-launcher-item').count()) === 1, '작업공간 검색 결과가 올바르지 않습니다.');
  await page.getByLabel('작업공간 검색').fill('');

  await page.getByRole('button', { name: '새 작업공간', exact: true }).click();
  await page.getByLabel('작업공간 이름').fill('전투 시스템');
  await page.getByRole('button', { name: '작업공간 만들기', exact: true }).click();
  await page.locator('.workspace-graph').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '작업공간', exact: true }).click();
  await page.getByRole('heading', { name: '작업공간', exact: true }).waitFor({ state: 'visible' });
  assert((await page.locator('.project-launcher-item').count()) === 2, '두 번째 작업공간이 홈에 추가되지 않았습니다.');

  const firstProject = await page.locator('.project-launcher-item').nth(0).boundingBox();
  const secondProject = await page.locator('.project-launcher-item').nth(1).boundingBox();
  assert(firstProject && secondProject, '프로젝트 카드 위치를 확인할 수 없습니다.');
  await page.mouse.move(firstProject.x + firstProject.width / 2, firstProject.y + firstProject.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(520);
  assert(await page.locator('.project-edit-bar').evaluate((element) => element.classList.contains('is-visible')), '길게 누르기로 프로젝트 편집 모드가 열리지 않았습니다.');
  await page.mouse.move(secondProject.x + secondProject.width / 2, secondProject.y + secondProject.height / 2, { steps: 8 });
  assert((await page.locator('.project-launcher-item.is-folder-target').count()) === 1, '프로젝트 겹치기 대상이 표시되지 않았습니다.');
  await page.mouse.up();
  assert((await page.locator('.project-folder').count()) === 1, '프로젝트 겹치기 폴더가 생성되지 않았습니다.');
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await page.locator('.project-folder').click();
  const folderProject = page.locator('.project-folder-sheet article > button:first-child').first();
  await folderProject.click({ button: 'right' });
  await page.getByRole('button', { name: '프로젝트 삭제', exact: true }).click();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await page.locator('.project-folder-sheet').waitFor({ state: 'detached' });
  await page.locator('.project-launcher-item:not(.project-folder)').waitFor({ state: 'visible' });
  assert((await page.locator('.project-launcher-item').count()) === 1, '삭제한 프로젝트가 홈과 폴더에서 제거되지 않았습니다.');
  await assertNoOverflow('.editor-content');
  await page.screenshot({ path: path.join(outputDirectory, 'workspace-library-polished.png'), fullPage: true });

  await page.locator('.project-launcher-item:not(.project-folder)').click();
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
