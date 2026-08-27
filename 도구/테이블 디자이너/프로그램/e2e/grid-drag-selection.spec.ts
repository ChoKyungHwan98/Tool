import { expect, test } from '@playwright/test'

test('표시용 빈 행과 열까지 드래그 선택해도 문서 데이터는 생성되지 않는다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()
  await page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdReactionProfile 3열 0행/ }).click()

  const startCell = page.locator('[data-workbook-row="1"][data-workbook-column="0"]')
  const ghostGrid = page.locator('.spreadsheet-ghost-grid')
  const start = await startCell.boundingBox()
  const ghost = await ghostGrid.boundingBox()
  if (!start || !ghost) throw new Error('드래그 선택 좌표를 찾을 수 없습니다.')

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(ghost.x + Math.min(ghost.width - 12, 250), ghost.y + Math.min(ghost.height - 12, 180), { steps: 8 })
  await page.mouse.up()

  const overlay = page.locator('.spreadsheet-range-selection')
  await expect(overlay).toBeVisible()
  const range = await overlay.getAttribute('data-selection-range')
  expect(range).toMatch(/^1:0-\d+:\d+$/)
  const [, end = ''] = range!.split('-')
  const [endRow = 0, endColumn = 0] = end.split(':').map(Number)
  expect(endRow).toBeGreaterThan(1)
  expect(endColumn).toBeGreaterThan(3)

  await page.locator('.spreadsheet-ghost-column-letter').first().click()
  const columnRange = await overlay.getAttribute('data-selection-range')
  expect(columnRange).toMatch(/^0:\d+-\d+:\d+$/)

  await page.locator('.spreadsheet-ghost-row-number').first().click()
  const rowRange = await overlay.getAttribute('data-selection-range')
  expect(rowRange).toMatch(/^\d+:0-\d+:\d+$/)

  await expect(page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdReactionProfile 3열 0행/ })).toBeVisible()
})
