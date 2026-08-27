import { expect, test } from '@playwright/test'

const viewports = [
  { width: 1024, height: 720 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const

for (const viewport of viewports) {
  test(`keeps the structure workbench readable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.getByRole('button', { name: '예제', exact: true }).click()
    await page.getByRole('button', { name: '샘플 열기' }).click()
    await expect(page.getByRole('heading', { name: '전체 구조' })).toBeVisible()
    await expect(page.getByLabel('AI 도우미')).toBeVisible()

    const layout = await page.evaluate(() => {
      const box = (selector: string) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect()
        return rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } : null
      }
      return {
        viewportWidth: window.innerWidth,
        bodyWidth: document.body.scrollWidth,
        explorer: box('.project-explorer'),
        main: box('.main-pane'),
        assistant: box('.assistant-panel'),
      }
    })

    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth)
    expect(layout.explorer).not.toBeNull()
    expect(layout.main).not.toBeNull()
    expect(layout.assistant).not.toBeNull()
    expect(layout.explorer!.right).toBeLessThanOrEqual(layout.main!.left + 1)
    expect(layout.main!.right).toBeLessThanOrEqual(layout.assistant!.left + 1)
    expect(layout.main!.width).toBeGreaterThan(500)

    if (viewport.width < 1280) {
      expect(layout.explorer!.width).toBeLessThanOrEqual(50)
      expect(layout.assistant!.width).toBeLessThanOrEqual(50)
      expect(layout.main!.width).toBeGreaterThanOrEqual(800)
    } else {
      const explorerRowHeights = await page.locator('.table-sheet-list .tree-row').evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height))
      expect(explorerRowHeights.length).toBeGreaterThan(0)
      expect(Math.max(...explorerRowHeights)).toBeLessThanOrEqual(40)
      expect(Math.min(...explorerRowHeights)).toBeGreaterThanOrEqual(34)
    }

    await page.screenshot({
      path: `design/screenshots/polish-structure-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    })

    await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()
    await expect(page.locator('.spreadsheet-value-bar')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'A열 선택' })).toBeVisible()

    const dataLayout = await page.evaluate(() => {
      const rect = (selector: string) => {
        const value = document.querySelector(selector)?.getBoundingClientRect()
        return value ? { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height } : null
      }
      return {
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        main: rect('.main-pane'),
        assistant: rect('.assistant-panel'),
        toolbar: rect('.spreadsheet-toolbar'),
        grid: rect('.spreadsheet-viewport'),
        columnHeaders: rect('.spreadsheet-column-headers'),
        firstRow: rect('.spreadsheet-row'),
      }
    })

    expect(dataLayout.bodyWidth).toBeLessThanOrEqual(dataLayout.viewportWidth)
    expect(dataLayout.main!.right).toBeLessThanOrEqual(dataLayout.assistant!.left + 1)
    expect(dataLayout.grid!.top).toBeGreaterThanOrEqual(dataLayout.toolbar!.bottom - 1)
    expect(dataLayout.grid!.height).toBeGreaterThan(360)
    expect(dataLayout.columnHeaders!.height).toBe(58)
    expect(dataLayout.firstRow!.top).toBeGreaterThanOrEqual(dataLayout.columnHeaders!.bottom - 1)

    await page.screenshot({
      path: `design/screenshots/polish-data-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    })

    await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 설계' }).click()
    await expect(page.getByRole('heading', { name: '테이블 설계' })).toBeVisible()
    await expect(page.getByLabel('테이블 설계 보기').getByRole('button', { name: '기본' })).toHaveClass(/active/)
    await page.screenshot({
      path: `design/screenshots/polish-design-basic-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    })

    await page.getByLabel('테이블 설계 보기').getByRole('button', { name: '키와 관계' }).click()
    await expect(page.getByRole('button', { name: '연결 만들기' })).toBeInViewport()
    await page.screenshot({
      path: `design/screenshots/polish-design-relations-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    })
  })
}
