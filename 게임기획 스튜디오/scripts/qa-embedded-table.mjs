import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const toolRoot = path.resolve(scriptDirectory, '..', '..');
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

const url = process.argv[2] ?? 'http://127.0.0.1:4318/?demo=table';
const screenshotPath = process.argv[3];
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 920 } });
const errors = [];

page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('requestfailed', (request) => {
  errors.push(`requestfailed: ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`);
});

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  const frameElement = page.locator('iframe[title="테이블 디자이너"]');
  await frameElement.waitFor({ state: 'visible' });

  const frame = page.frameLocator('iframe[title="테이블 디자이너"]');
  await frame.getByText('내 프로젝트', { exact: true }).waitFor({ state: 'visible' });
  await frame.getByRole('button', { name: '새 프로젝트' }).first().waitFor({ state: 'visible' });
  await frame.getByText('프로젝트 보관함을 확인하고 있습니다.').waitFor({
    state: 'hidden',
    timeout: 15_000,
  });

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  await frame.getByRole('button', { name: '새 프로젝트' }).first().click();
  await frame.getByRole('dialog', { name: '새 프로젝트 만들기' }).waitFor({ state: 'visible' });
  await frame.getByLabel('프로젝트 이름').waitFor({ state: 'visible' });

  console.log('PASS: 테이블 디자이너 로드, 프로젝트 보관함 초기화, 새 프로젝트 대화상자 동작을 확인했습니다.');
} finally {
  await browser.close();
}
