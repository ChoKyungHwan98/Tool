import { expect, test } from '@playwright/test'

test('runs the isolated workbook command and menu QA without browser errors', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()

  await expect(page.getByRole('button', { name: '열 추가', exact: true })).toHaveCount(1)
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 1행 RuleId' })).toContainText('PK')
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 RuleId' })).toContainText('goal_home_high')

  await page.getByRole('rowheader', { name: '1행 선택' }).click()
  await expect(page.getByRole('button', { name: '행 복제' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '행 삭제' })).toHaveCount(0)

  await page.getByRole('button', { name: '열 추가', exact: true }).click()
  const editor = page.getByRole('textbox', { name: 'CrowdReactionRule 1행 NewColumn 편집' })
  await editor.fill('QANote')
  await editor.press('Enter')

  await page.getByLabel('QANote 열 메뉴').click()
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitem', { name: '이름 변경' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: '오름차순 정렬' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: '내림차순 정렬' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: '왼쪽으로' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: '오른쪽으로' })).toBeDisabled()
  await expect(menu.getByRole('menuitem', { name: '키와 관계 설정' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: '열 삭제' })).toBeVisible()
  await menu.getByRole('menuitem', { name: '오름차순 정렬' }).click()

  await page.getByLabel('QANote 열 메뉴').click()
  await page.getByRole('menuitem', { name: '키와 관계 설정' }).click()
  await expect(page.getByRole('heading', { name: '테이블 설계' })).toBeVisible()
  await expect(page.getByLabel('테이블 설계 보기').getByRole('button', { name: '키와 관계' })).toHaveClass(/active/)

  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()
  await page.getByLabel('QANote 열 메뉴').click()
  await page.getByRole('menuitem', { name: '열 삭제' }).click()
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 1행 QANote' })).toHaveCount(0)

  await page.getByRole('button', { name: '행 추가', exact: true }).click()
  await expect(page.getByRole('rowheader', { name: '4행 선택' })).toBeVisible()
  await page.getByTitle('실행 취소').click()
  await expect(page.locator('.spreadsheet-row:not(.spreadsheet-append-row)')).toHaveCount(2)
  await expect(page.locator('.spreadsheet-append-row')).toBeVisible()
  await expect(page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdReactionRule \d+열 2행/ })).toBeVisible()

  await page.getByRole('button', { name: '내보내기', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: '내보내기', exact: true })
  await expect(drawer.getByRole('button', { name: '프로젝트 백업(.gsw)', exact: true })).toBeVisible()
  await page.screenshot({ path: 'design/screenshots/workbook-interaction-qa-1440x900.png', fullPage: true })

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})
