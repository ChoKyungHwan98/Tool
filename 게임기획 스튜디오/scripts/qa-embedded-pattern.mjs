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

const url = process.argv[2] ?? 'http://127.0.0.1:4318/?demo=pattern';
const screenshotPath = process.argv[3];
const viewportWidth = Number(process.argv[4] ?? 1500);
const viewportHeight = Number(process.argv[5] ?? 920);
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const page = await browser.newPage({ viewport: { width: viewportWidth, height: viewportHeight } });
const errors = [];

page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('requestfailed', (request) => {
  errors.push(`requestfailed: ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`);
});

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  const frameElement = page.locator('iframe[title="패턴 디자이너"]');
  await frameElement.waitFor({ state: 'visible' });

  const frame = page.frameLocator('iframe[title="패턴 디자이너"]');
  const sampleButton = frame.getByRole('button', { name: 'Cinder Knight 예제 불러오기' });
  if (await sampleButton.isVisible().catch(() => false)) {
    await sampleButton.click();
  }
  await frame.getByText('XState', { exact: true }).first().waitFor({ state: 'attached' });
  await frame.locator('body').press('Control+f');
  await frame.getByText('Cinder Knight Combat HFSM', { exact: true }).first().waitFor({ state: 'visible' });
  await frame.locator('.pattern-list-main', { hasText: 'Cinder Knight Combat HFSM' }).click();
  await frame.locator('body').press('Control+f');
  await frame.getByRole('button', { name: 'Engagement 열기' }).click();
  await frame.getByText('Approach', { exact: true }).first().waitFor({ state: 'visible' });
  await frame.getByRole('button', { name: '루트' }).click();
  await frame.getByRole('button', { name: '한 단계 실행' }).click();
  await frame.getByText('1 틱', { exact: true }).first().waitFor({ state: 'attached' });

  await frame.locator('body').press('Control+f');
  await frame.locator('.pattern-list-main', { hasText: 'Cinder Knight Behavior Tree' }).click();
  await frame.getByText('Mistreevous', { exact: true }).first().waitFor({ state: 'attached' });

  await frame.locator('body').press('Control+f');
  await frame.locator('.pattern-list-main', { hasText: 'Cinder Knight FSM' }).click();
  await frame.locator('.react-flow__node', { hasText: 'Idle' }).first().click();
  await frame.getByRole('button', { name: /나감.*Chase.*TargetVisible/ }).click();
  await frame.getByText('전환 속성', { exact: true }).waitFor({ state: 'visible' });
  const triggerType = await frame.getByLabel('전환 방식').inputValue();
  if (triggerType !== 'event') throw new Error(`unexpected transition type: ${triggerType}`);
  await frame.getByLabel('전환 방식').selectOption('condition');
  await frame.getByLabel('블랙보드 키').first().waitFor({ state: 'visible' });
  const exportButton = frame.getByRole('button', { name: /내보내기/ }).first();
  await exportButton.click();
  await frame.getByText('Unity UPM 패키지', { exact: true }).waitFor({ state: 'visible' });
  await frame.getByText('Unreal 플러그인', { exact: true }).waitFor({ state: 'visible' });
  await frame.getByText('진단 보고서', { exact: true }).waitFor({ state: 'visible' });
  await exportButton.click();
  await frame.locator('body').press('Escape');

  await frame.getByRole('button', { name: '단축키' }).click();
  await frame.getByRole('dialog', { name: '편집기 단축키' }).waitFor({ state: 'visible' });
  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath.replace(/(\.png)?$/, '-shortcuts.png'), fullPage: true });
  }
  await frame.getByRole('button', { name: '단축키 닫기' }).click();

  await frame.locator('body').press('Control+f');
  const idleNode = frame.locator('.structure-node', { hasText: /^Idle$/ }).first();
  await idleNode.click();
  await frame.locator('body').press('Control+d');
  await frame.getByText('Idle 복사본', { exact: true }).first().waitFor({ state: 'visible' });
  await frame.locator('body').press('Delete');
  await frame.locator('body').press('Control+z');
  await frame.getByText('Idle 복사본', { exact: true }).first().waitFor({ state: 'visible' });

  const viewportMetrics = await frame.locator('.workbench-shell').evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  if (viewportMetrics.scrollWidth > viewportMetrics.clientWidth || viewportMetrics.scrollHeight > viewportMetrics.clientHeight) {
    throw new Error(`workbench overflow: ${JSON.stringify(viewportMetrics)}`);
  }

  const horizontalMetrics = await frame.locator('body, .editor-app, .workbench-header, .workbench-shell, .graph-editor, .pattern-inspector').evaluateAll((elements) =>
    elements.map((element) => ({
      selector: element.className || element.tagName,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    })),
  );
  const horizontalOverflow = horizontalMetrics.filter((metric) => metric.scrollWidth > metric.clientWidth + 1);
  if (horizontalOverflow.length > 0) {
    throw new Error(`horizontal overflow: ${JSON.stringify(horizontalOverflow)}`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  console.log('PASS: 패턴 디자이너 임베드, 편집 단축키, 전환 속성, XState/Mistreevous 실행, 레이아웃 오버플로를 확인했습니다.');
} finally {
  await browser.close();
}
