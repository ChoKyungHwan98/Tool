import { expect, test, type Page } from '@playwright/test'

async function openTableEditor(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()
}

test('audit: exposes reviewed table deletion from the explorer context menu', async ({ page }) => {
  await openTableEditor(page)

  await page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdReactionRule \d+열 2행/ }).click({ button: 'right' })
  await expect(page.getByRole('menuitem', { name: '테이블 삭제' })).toBeVisible()
})

test('audit: exposes reviewed table deletion from a sheet-tab context menu', async ({ page }) => {
  await openTableEditor(page)

  await page.getByLabel('시트 탭').getByRole('button', { name: 'CrowdReactionRule 2' }).click({ button: 'right' })
  await expect(page.getByRole('menuitem', { name: '테이블 삭제' })).toBeVisible()
})

test('deletes a table only after review and restores it with undo', async ({ page }) => {
  await openTableEditor(page)

  const table = page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdReactionRule \d+열 2행/ })
  await table.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '테이블 삭제' }).click()
  const review = page.getByLabel('워크벤치 세부 패널')
  await expect(review).toContainText('행 2개')
  await expect(table).toBeVisible()

  await review.getByRole('button', { name: '검토 후 적용' }).click()
  await expect(table).toHaveCount(0)
  await page.getByTitle('실행 취소').click()
  await expect(page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdReactionRule \d+열 2행/ })).toBeVisible()
})

test('audit: exposes typed filtering and additive sorting from a column menu', async ({ page }) => {
  await openTableEditor(page)

  await page.getByLabel('RuleId 열 메뉴').click()
  await expect(page.getByRole('menuitem', { name: '열 필터' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '오름차순 정렬에 추가' })).toBeVisible()
})

test('audit: opens find-replace and exposes an autofill handle', async ({ page }) => {
  await openTableEditor(page)

  await page.keyboard.press('Control+h')
  await expect(page.getByRole('region', { name: '찾기 및 바꾸기' })).toBeVisible()

  await page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 RuleId' }).click()
  await expect(page.getByRole('button', { name: '자동 채우기' })).toBeVisible()
})

test('inserts rows from the row context menu and columns from the header menu', async ({ page }) => {
  await openTableEditor(page)

  await page.getByRole('rowheader', { name: '2행 선택' }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: '아래에 행 삽입' }).click()
  await expect(page.getByRole('rowheader', { name: '4행 선택' })).toBeVisible()

  await page.getByLabel('RuleId 열 메뉴').click()
  await expect(page.getByRole('menuitem', { name: '왼쪽에 열 삽입' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '오른쪽에 열 삽입' })).toBeVisible()
})

test('hides, restores, and freezes columns as workbook view state', async ({ page }) => {
  await openTableEditor(page)

  await page.getByLabel('RuleId 열 메뉴').click()
  await page.getByRole('menuitem', { name: '열 숨기기' }).click()
  const hiddenButton = page.getByRole('button', { name: '숨긴 열 1개' })
  await expect(hiddenButton).toBeVisible()
  await hiddenButton.click()
  await page.getByRole('menuitem', { name: 'RuleId' }).click()
  await expect(page.getByLabel('RuleId 열 메뉴')).toBeVisible()

  await page.getByLabel('RuleId 열 메뉴').click()
  await page.getByRole('menuitem', { name: '이 열까지 고정' }).click()
  await expect(page.getByRole('button', { name: '열 고정 해제' })).toBeVisible()
})

test('replaces workbook matches and blocks invalid numeric input', async ({ page }) => {
  await openTableEditor(page)

  await page.keyboard.press('Control+h')
  await page.getByLabel('찾을 내용').fill('home')
  await page.getByLabel('바꿀 내용').fill('player')
  await page.getByRole('button', { name: '모두 바꾸기' }).click()
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 RuleId' })).toContainText('goal_player_high')

  await page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdZone \d+열 2행/ }).click()
  const capacityCell = page.getByRole('gridcell', { name: 'CrowdZone 2행 Capacity' })
  await capacityCell.dblclick()
  await page.getByLabel('CrowdZone 2행 Capacity 편집').fill('not-a-number')
  await page.getByLabel('CrowdZone 2행 Capacity 편집').press('Enter')
  await expect(page.getByRole('alert')).toContainText('정수')
  await expect(capacityCell).toContainText('8200')
})

test('moves data cells with cut and paste in one undoable operation', async ({ page }) => {
  await openTableEditor(page)

  await page.getByRole('button', { name: '열 추가' }).click()
  const headerEditor = page.getByLabel('CrowdReactionRule 1행 NewColumn 편집')
  await headerEditor.fill('MoveValue')
  await headerEditor.press('Enter')

  const source = page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 MoveValue' })
  const target = page.getByRole('gridcell', { name: 'CrowdReactionRule 3행 MoveValue' })
  await source.dblclick()
  await page.getByLabel('CrowdReactionRule 2행 MoveValue 편집').fill('alpha')
  await page.getByLabel('CrowdReactionRule 2행 MoveValue 편집').press('Enter')
  await target.dblclick()
  await page.getByLabel('CrowdReactionRule 3행 MoveValue 편집').fill('beta')
  await page.getByLabel('CrowdReactionRule 3행 MoveValue 편집').press('Enter')

  await source.click()
  await page.keyboard.press('Control+x')
  await target.click()
  await page.keyboard.press('Control+v')
  await expect(source).toHaveText('')
  await expect(target).toContainText('alpha')

  await page.getByTitle('실행 취소').click()
  await expect(source).toContainText('alpha')
  await expect(target).toContainText('beta')
})

test('extends a numeric series with the autofill handle inside existing rows', async ({ page }) => {
  await openTableEditor(page)

  await page.getByRole('button', { name: '열 추가' }).click()
  const headerEditor = page.getByLabel('CrowdReactionRule 1행 NewColumn 편집')
  await headerEditor.fill('SeriesValue')
  await headerEditor.press('Enter')
  await page.getByRole('button', { name: '행 추가' }).click()

  const first = page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 SeriesValue' })
  const second = page.getByRole('gridcell', { name: 'CrowdReactionRule 3행 SeriesValue' })
  const third = page.getByRole('gridcell', { name: 'CrowdReactionRule 4행 SeriesValue' })
  await first.dblclick()
  await page.getByLabel('CrowdReactionRule 2행 SeriesValue 편집').fill('10')
  await page.getByLabel('CrowdReactionRule 2행 SeriesValue 편집').press('Enter')
  await second.dblclick()
  await page.getByLabel('CrowdReactionRule 3행 SeriesValue 편집').fill('20')
  await page.getByLabel('CrowdReactionRule 3행 SeriesValue 편집').press('Enter')

  await first.click()
  await second.click({ modifiers: ['Shift'] })
  await page.getByRole('button', { name: '자동 채우기' }).dragTo(third)
  await expect(third).toContainText('30')
})
