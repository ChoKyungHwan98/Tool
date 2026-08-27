import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const studioRoot = path.resolve(scriptDirectory, '..');
const toolRoot = path.resolve(studioRoot, '..');
const playwrightEntry = path.join(
  toolRoot,
  '도구',
  '테이블 디자이너',
  '프로그램',
  'node_modules',
  'playwright',
  'index.mjs',
);
const { chromium } = await import(pathToFileURL(playwrightEntry).href);

const url = process.argv[2] ?? 'http://127.0.0.1:4320/?demo=prompt';
const screenshotPath = process.argv[3];
const viewportWidth = Number(process.argv[4] ?? 1500);
const viewportHeight = Number(process.argv[5] ?? 920);
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const context = await browser.newContext({ viewport: { width: viewportWidth, height: viewportHeight } });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
const page = await context.newPage();
const errors = [];

page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('requestfailed', (request) => errors.push(`requestfailed: ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`));

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '프롬프트 빌더' }).waitFor({ state: 'visible' });
  await page.getByLabel('이름').fill('보스 패턴 검토');
  await page.getByLabel('분류').fill('전투');
  await page.getByLabel('설명').fill('FSM 관점에서 전투 흐름을 검토할 때 사용');
  await page.getByLabel('시작 프롬프트').fill('{{대상}}, best quality');
  await page.getByLabel(/포함·제외 조건/).fill('boss, ~watermark');
  await page.getByLabel(/본문 프롬프트/).fill('전투 패턴을 FSM 관점에서 검토, watermark');
  await page.getByLabel('끝 프롬프트').fill('highres');
  await page.getByLabel('네거티브 프롬프트').fill('watermark');
  await page.getByLabel('대상 도구').fill('ChatGPT');
  await page.getByLabel('선호 모델').fill('GPT');
  await page.getByRole('textbox', { name: '태그 · 쉼표로 구분' }).fill('FSM, 보스, 검증');
  await page.getByPlaceholder('대상 값').fill('튜토리얼 보스');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.getByRole('button', { name: '복사하고 사용' }).click();
  await page.getByText('세션 기록 1개').waitFor({ state: 'visible' });
  const expectedPrompt = '튜토리얼 보스, best quality, boss, 전투 패턴을 FSM 관점에서 검토, highres\n\nNegative Prompt:\nwatermark';
  await page.getByText(/튜토리얼 보스, best quality, boss/).last().waitFor({ state: 'visible' });

  const metrics = await page.locator('.prompt-tool').evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  if (metrics.scrollWidth > metrics.clientWidth + 1 || metrics.scrollHeight > metrics.clientHeight + 1) {
    throw new Error(`프롬프트 도구 오버플로: ${JSON.stringify(metrics)}`);
  }

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  if (clipboardText.replace(/\r\n?/g, '\n') !== expectedPrompt) {
    throw new Error(`클립보드 내용 불일치: ${clipboardText}`);
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));
  if (screenshotPath) {
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
  console.log(`PASS: ${viewportWidth}x${viewportHeight} 저장·변수 치환·복사·세션 기록·오버플로를 확인했습니다.`);
} finally {
  await browser.close();
}
