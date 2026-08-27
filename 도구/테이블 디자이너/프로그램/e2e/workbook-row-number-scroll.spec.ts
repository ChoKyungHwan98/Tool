import { expect, test } from '@playwright/test'

test('가로 스크롤 시 1행 번호도 나머지 행 번호와 함께 이동한다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')

  await page.getByRole('button', { name: '아스트라에 오라티오 CASE형 영지 조정' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()

  const viewport = page.locator('.spreadsheet-viewport')
  const firstRowNumber = page.getByRole('rowheader', { name: '1행 선택' })
  const secondRowNumber = page.getByRole('rowheader', { name: '2행 선택' })

  await expect(firstRowNumber).toBeInViewport()
  await expect(secondRowNumber).toBeInViewport()

  await viewport.evaluate((element) => { element.scrollLeft = 500 })

  await expect(firstRowNumber).not.toBeInViewport()
  await expect(secondRowNumber).not.toBeInViewport()
})
