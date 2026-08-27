import { expect, test } from '@playwright/test'

async function openSample(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
}

test('compact workspace keeps both side panels as rails until opened', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 720 })
  await openSample(page)

  const layout = await page.evaluate(() => {
    const width = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().width ?? 0
    return {
      explorer: width('.project-explorer'),
      main: width('.main-pane'),
      assistant: width('.assistant-panel'),
    }
  })

  expect(layout.explorer).toBeLessThanOrEqual(50)
  expect(layout.assistant).toBeLessThanOrEqual(50)
  expect(layout.main).toBeGreaterThanOrEqual(800)

  await page.getByRole('button', { name: 'AI 패널 열기' }).click()
  await expect(page.getByLabel('AI 대화 패널')).toBeVisible()
  await page.getByRole('button', { name: 'AI 패널 접기' }).click()
  await expect(page.getByLabel('AI 대화 패널')).toHaveCount(0)
})

test('AI provider choice is available only inside connection settings', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSample(page)

  await expect(page.getByLabel('AI 실행 방식')).toHaveCount(0)
  await page.getByTitle('AI 연결 설정').click()
  await expect(page.getByLabel('AI 실행 방식')).toBeVisible()
})

test('relations designer keeps its active apply command inside a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 720 })
  await openSample(page)
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 설계' }).click()
  await page.getByLabel('테이블 설계 보기').getByRole('button', { name: '키와 관계' }).click()

  const connectButton = page.getByRole('button', { name: '연결 만들기' })
  await expect(connectButton).toBeVisible()
  await expect(connectButton).toBeInViewport()
  await expect(page.getByText('현재 키와 연결', { exact: true })).toBeInViewport()
})

test('column menu is grouped and stays in the viewport with internal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 720 })
  await openSample(page)
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()
  await page.getByLabel('RuleId 열 메뉴').click()

  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  for (const group of ['편집', '정렬·필터', '구조', '표시']) {
    await expect(menu.getByText(group, { exact: true })).toBeVisible()
  }
  const metrics = await menu.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      bottom: rect.bottom,
      overflowY: getComputedStyle(element).overflowY,
      viewportHeight: window.innerHeight,
    }
  })
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight)
  expect(['auto', 'scroll']).toContain(metrics.overflowY)
})

test('schema map keeps visible table summaries at the product typography floor', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openSample(page)

  const fontSizes = await page.locator('.schema-node-title strong, .schema-node-summary, .schema-node-column').evaluateAll((elements) => elements
    .filter((element) => {
      const style = getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getBoundingClientRect().height > 0
    })
    .map((element) => Number.parseFloat(getComputedStyle(element).fontSize)))

  expect(fontSizes.length).toBeGreaterThan(0)
  expect(Math.min(...fontSizes)).toBeGreaterThanOrEqual(11)
})
