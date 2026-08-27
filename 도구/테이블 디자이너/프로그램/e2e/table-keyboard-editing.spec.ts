import { expect, test, type Page } from '@playwright/test'

async function openTableEditor(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()
}

async function addNullableColumn(page: Page, name: string) {
  await page.getByRole('button', { name: '열 추가' }).click()
  const editor = page.getByRole('textbox', { name: 'CrowdReactionRule 1행 NewColumn 편집' })
  await editor.fill(name)
  await editor.press('Enter')
}

test('commits typed cell values when the user clicks away instead of pressing Enter', async ({ page }) => {
  await openTableEditor(page)
  await addNullableColumn(page, 'ClickCommitNote')

  const source = page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 ClickCommitNote' })
  const target = page.getByRole('gridcell', { name: 'CrowdReactionRule 3행 ClickCommitNote' })

  await source.click()
  await page.keyboard.insertText('alpha_click')
  await target.click()

  await expect(source).toContainText('alpha_click')
  await expect(target).toHaveClass(/active/)
})

test('commits append row and append column edits when the user clicks away', async ({ page }) => {
  await openTableEditor(page)

  await page.locator('.spreadsheet-append-schema-cell').click()
  await page.keyboard.insertText('ClickAwayColumn')
  await page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 RuleId' }).click()
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 1행 ClickAwayColumn' })).toBeVisible()

  const appendRowCell = page.getByRole('gridcell', { name: 'CrowdReactionRule 4행 ClickAwayColumn 추가' })
  await appendRowCell.click()
  await page.keyboard.insertText('row_from_click_away')
  await page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 RuleId' }).click()
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 4행 ClickAwayColumn' })).toContainText('row_from_click_away')
})

test('clears data cells with Delete or Backspace without clearing schema row names', async ({ page }) => {
  await openTableEditor(page)
  await addNullableColumn(page, 'ClearNote')

  const cell = page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 ClearNote' })
  await cell.click()
  await page.keyboard.insertText('clear_me')
  await page.keyboard.press('Enter')
  await expect(cell).toContainText('clear_me')

  await cell.click()
  await page.keyboard.press('Delete')
  await expect(cell).toHaveText('')

  await page.getByTitle('실행 취소').click()
  await expect(cell).toContainText('clear_me')

  const requiredCell = page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 RuleId' })
  await requiredCell.click()
  await page.keyboard.press('Backspace')
  await expect(requiredCell).toHaveText('')
  await page.getByRole('button', { name: '검증' }).click()
  await expect(page.getByLabel('워크벤치 세부 패널')).toContainText('필수 값이 비어 있음')

  const header = page.getByRole('gridcell', { name: 'CrowdReactionRule 1행 RuleId' })
  await header.click()
  await page.keyboard.press('Delete')
  await expect(header).toContainText('RuleId')
  await expect(page.getByRole('alert')).toContainText('1행은 열 이름입니다')
})

test('stages selected schema table deletion from Delete and keeps cancel non-mutating', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()

  const tableNode = page.locator('.schema-node').filter({ hasText: 'CrowdReactionRule' })
  await tableNode.click()
  await page.keyboard.press('Delete')

  const reviewPanel = page.getByLabel('워크벤치 세부 패널')
  await expect(reviewPanel).toContainText('테이블 삭제')
  await expect(reviewPanel).toContainText('CrowdReactionRule')
  await reviewPanel.getByRole('button', { name: '취소' }).click()
  await expect(tableNode).toBeVisible()
})
