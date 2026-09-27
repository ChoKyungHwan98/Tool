import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const studioRoot = path.resolve(scriptDirectory, '..');
const toolRoot = path.resolve(studioRoot, '..');
const playwrightEntry = path.join(toolRoot, '도구', '테이블 디자이너', '프로그램', 'node_modules', 'playwright', 'index.mjs');
const { chromium } = await import(pathToFileURL(playwrightEntry).href);

const url = process.argv[2] ?? 'http://127.0.0.1:4321/?demo=workspace';
const screenshotPath = process.argv[3];
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 920 } });
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('.workspace-graph').waitFor({ state: 'visible' });
  const canvasChrome = await page.evaluate(() => ({
    appClass: document.querySelector('.studio-app')?.className,
    topBar: getComputedStyle(document.querySelector('.top-bar')).backgroundColor,
    rail: getComputedStyle(document.querySelector('.activity-rail')).backgroundColor,
  }));
  if (!String(canvasChrome.appClass).includes('studio-app--canvas-mode')) throw new Error('작업공간 밝은 크롬 모드가 활성화되지 않았습니다.');
  if (canvasChrome.topBar === 'rgb(32, 32, 32)' || canvasChrome.topBar === 'rgb(0, 0, 0)') {
    throw new Error(`상단바가 밝은 캔버스 크롬으로 전환되지 않았습니다: ${JSON.stringify(canvasChrome)}`);
  }

  const addTool = async (name) => {
    await page.getByRole('button', { name: '도구 추가' }).click();
    await page.locator('.tool-palette-list').getByRole('button', { name: new RegExp(name) }).click();
  };
  await addTool('테이블 디자이너');
  await addTool('패턴 디자이너');
  await addTool('AI 리뷰데이터 분석');
  await addTool('PPT 디자이너');

  const table = page.locator('.workspace-node').filter({ hasText: '테이블 디자이너' });
  const pattern = page.locator('.workspace-node').filter({ hasText: '패턴 디자이너' });
  const review = page.locator('.workspace-node').filter({ hasText: 'AI 리뷰데이터 분석' });
  const deck = page.locator('.workspace-node').filter({ hasText: 'PPT 디자이너' });
  if (await deck.locator('.workspace-node-port--input').count() !== 1) throw new Error('PPT 디자이너의 리뷰 인사이트 입력 포트가 없습니다.');

  const output = await table.locator('.workspace-node-port--output').boundingBox();
  const input = await pattern.locator('.workspace-node-port--input').boundingBox();
  if (!output || !input) throw new Error('연결 포트를 찾지 못했습니다.');
  await page.mouse.move(output.x + output.width / 2, output.y + output.height / 2);
  await page.mouse.down();
  await page.mouse.move(input.x + input.width / 2, input.y + input.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  if (await page.locator('.workspace-graph-wires g').count() !== 1) throw new Error('호환 연결이 생성되지 않았습니다.');

  const reviewOutput = await review.locator('.workspace-node-port--output').boundingBox();
  const deckInput = await deck.locator('.workspace-node-port--input').boundingBox();
  if (!reviewOutput || !deckInput) throw new Error('AI 리뷰데이터 분석·PPT 연결 포트를 찾지 못했습니다.');
  await page.mouse.move(reviewOutput.x + reviewOutput.width / 2, reviewOutput.y + reviewOutput.height / 2);
  await page.mouse.down();
  await page.mouse.move(deckInput.x + deckInput.width / 2, deckInput.y + deckInput.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  if (await page.locator('.workspace-graph-wires g').count() !== 2) throw new Error('리뷰 인사이트 연결이 생성되지 않았습니다.');
  if (await page.locator('.error-toast').count() !== 0) throw new Error('정상 연결 뒤 전역 오류 토스트가 표시되었습니다.');

  const toolbar = page.locator('.workspace-graph-toolbar');
  const toolbarBox = await toolbar.boundingBox();
  if (!toolbarBox || toolbarBox.x < 900) throw new Error('캔버스 도구막대가 MiniMax형 우측 상단 위치에 있지 않습니다.');

  await toolbar.getByRole('button', { name: '캔버스 정리' }).click();
  await page.getByRole('menuitem', { name: /연결 관계로 정리/ }).click();
  await toolbar.getByRole('button', { name: '캔버스 정리' }).click();
  const revert = page.getByRole('menuitem', { name: /정리 되돌리기/ });
  if (await revert.isDisabled()) throw new Error('캔버스 정리 후 되돌리기가 활성화되지 않았습니다.');
  await revert.click();

  await toolbar.locator('.workspace-graph-zoom').click();
  await page.getByRole('menuitem', { name: '75%' }).click();
  if (!(await toolbar.locator('.workspace-graph-zoom').textContent())?.includes('75%')) throw new Error('배율 프리셋이 적용되지 않았습니다.');

  await toolbar.getByRole('button', { name: '캔버스 표시' }).click();
  await page.getByRole('button', { name: '격자' }).click();
  if (!(await page.locator('.workspace-graph').getAttribute('class'))?.includes('workspace-graph--pattern-grid')) throw new Error('격자 배경이 적용되지 않았습니다.');

  await toolbar.getByRole('button', { name: '연결선 숨기기' }).click();
  if (await page.locator('.workspace-graph-wires').count() !== 0) throw new Error('연결선 숨기기가 동작하지 않았습니다.');
  await toolbar.getByRole('button', { name: '연결선 표시' }).click();
  if (await page.locator('.workspace-graph-wires g').count() !== 2) throw new Error('연결선 다시 표시가 동작하지 않았습니다.');

  await toolbar.getByRole('button', { name: '미니맵' }).click();
  if (await page.locator('.workspace-minimap').count() !== 0) throw new Error('미니맵 숨기기가 동작하지 않았습니다.');
  await toolbar.getByRole('button', { name: '미니맵' }).click();
  if (await page.locator('.workspace-minimap').count() !== 1) throw new Error('미니맵 다시 표시가 동작하지 않았습니다.');

  await pattern.dblclick();
  await page.getByRole('button', { name: /패턴/ }).waitFor({ state: 'visible' });
  const graphMetrics = await page.locator('.editor-content').evaluate((element) => ({
    scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight, clientHeight: element.clientHeight,
  }));
  if (graphMetrics.scrollWidth > graphMetrics.clientWidth + 1 || graphMetrics.scrollHeight > graphMetrics.clientHeight + 1) {
    throw new Error(`작업공간 오버플로: ${JSON.stringify(graphMetrics)}`);
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));
  if (screenshotPath) {
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.getByRole('button', { name: '작업공간 홈' }).click();
    await page.locator('.studio-app--canvas-mode').waitFor({ state: 'visible' });
    await page.waitForTimeout(180);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
  console.log('PASS: 노드/연결, 정리/되돌리기, 배율, 배경, 연결선, 미니맵, 탭 열기, 오버플로를 확인했습니다.');
} finally {
  await browser.close();
}
