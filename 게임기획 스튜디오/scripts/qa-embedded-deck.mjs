import fs from 'node:fs';
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

const url = process.argv[2] ?? 'http://127.0.0.1:4319/?demo=deck';
const screenshotPath = process.argv[3];
const viewportWidth = Number(process.argv[4] ?? 1500);
const viewportHeight = Number(process.argv[5] ?? 920);
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const context = await browser.newContext({
  viewport: { width: viewportWidth, height: viewportHeight },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
const downloads = [];

page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('requestfailed', (request) => {
  errors.push(`requestfailed: ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`);
});
page.on('download', (download) => downloads.push(download));

const assertZipDownload = async (extension) => {
  const download = downloads.find((item) => item.suggestedFilename().endsWith(extension));
  if (!download) throw new Error(`${extension} 다운로드를 찾을 수 없습니다.`);
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error(`${extension} 다운로드 경로가 없습니다.`);
  const signature = fs.readFileSync(downloadPath).subarray(0, 2).toString('ascii');
  if (signature !== 'PK') throw new Error(`${extension} 파일이 ZIP 기반 Office 문서가 아닙니다.`);
};

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  const frameElement = page.locator('iframe[title="PPT 디자이너"]');
  await frameElement.waitFor({ state: 'visible' });
  const frame = page.frameLocator('iframe[title="PPT 디자이너"]');

  await frame.getByRole('heading', { name: '논리부터 레이아웃까지 한 흐름으로 설계합니다.' }).waitFor({ state: 'visible' });
  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath.replace(/(\.png)?$/, '-library.png'), fullPage: true });
  }
  await frame.getByLabel('기획서 제목').fill('회피 손해 개선 전투 기획');
  await frame.getByLabel('자유 원고').fill([
    '회피 후딜은 실측 18프레임이다.',
    '기존 회피와 신규 회피의 손해를 비교한다.',
    '피격 때문에 방어 행동만 반복되는 문제가 발생한다.',
    '입력 이후 무적 판정까지 3단계로 진행한다.',
  ].join('\n'));
  await frame.getByRole('button', { name: '로컬 초안 만들기' }).click();
  await frame.getByText('목차가 아니라 슬라이드별 주장', { exact: true }).waitFor({ state: 'visible' });

  await frame.getByRole('button', { name: '디자인 방향' }).click();
  await frame.getByText('내용에서 갈라진 세 가지 표현 방향', { exact: true }).waitFor({ state: 'visible' });
  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath.replace(/(\.png)?$/, '-direction.png'), fullPage: true });
  }
  await frame.getByRole('button', { name: '이 방향으로 레이아웃 계산' }).first().click();
  await frame.getByText('장마다 다른 이유가 있는 레이아웃', { exact: true }).waitFor({ state: 'visible' });

  await frame.getByRole('button', { name: '근거와 검증' }).click();
  await frame.getByText('모든 문장은 원문으로 돌아갈 수 있어야 합니다.', { exact: true }).waitFor({ state: 'visible' });

  const workbenchMetrics = await frame.locator('.deck-app').evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  if (workbenchMetrics.scrollWidth > workbenchMetrics.clientWidth + 1 || workbenchMetrics.scrollHeight > workbenchMetrics.clientHeight + 1) {
    throw new Error(`기획서 작업 화면 오버플로: ${JSON.stringify(workbenchMetrics)}`);
  }

  downloads.length = 0;
  await frame.getByRole('button', { name: 'PPTX' }).click();
  await frame.getByText('PPTX와 검증 보고서를 저장했습니다.').waitFor({ state: 'attached', timeout: 15_000 });
  await page.waitForTimeout(250);
  await assertZipDownload('.pptx');

  downloads.length = 0;
  await frame.getByRole('button', { name: 'Word' }).click();
  await frame.getByText('DOCX와 검증 보고서를 저장했습니다.').waitFor({ state: 'attached', timeout: 15_000 });
  await page.waitForTimeout(250);
  await assertZipDownload('.docx');

  if (errors.length > 0) throw new Error(errors.join('\n'));
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });

  console.log(`PASS: ${viewportWidth}x${viewportHeight} 기획서 임베드, 자유 원고, 디자인 방향, 레이아웃, 무결성, PPTX·Word 출력을 확인했습니다.`);
} finally {
  await browser.close();
}
