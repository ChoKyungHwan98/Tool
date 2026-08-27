import { expect, test, type Page } from '@playwright/test'

async function openTableEditor(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()
}

async function addNullableColumn(page: Page, name: string) {
  await page.getByRole('button', { name: '열 추가', exact: true }).click()
  const editor = page.getByRole('textbox', { name: 'CrowdReactionRule 1행 NewColumn 편집' })
  await editor.fill(name)
  await editor.press('Enter')
}

test('uses Excel undo and redo shortcuts for committed workbook changes', async ({ page }) => {
  await openTableEditor(page)
  const cell = page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 RuleId' })

  await cell.click()
  await page.keyboard.insertText('shortcut_goal')
  await page.keyboard.press('Enter')
  await expect(cell).toContainText('shortcut_goal')

  await page.keyboard.press('Control+z')
  await expect(cell).toContainText('goal_home_high')
  await page.keyboard.press('Control+y')
  await expect(cell).toContainText('shortcut_goal')
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+Shift+z')
  await expect(cell).toContainText('shortcut_goal')
})

test('starts replacement input immediately after a single cell click', async ({ page }) => {
  await openTableEditor(page)
  const cell = page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 RuleId' })

  await cell.click()
  await page.keyboard.type('click_replace')
  await page.keyboard.press('Enter')
  await expect(cell).toContainText('click_replace')
})

test('supports Excel navigation, row-column selection, fill, and sheet switching shortcuts', async ({ page }) => {
  await openTableEditor(page)
  await addNullableColumn(page, 'LeftNote')
  await addNullableColumn(page, 'RightNote')

  const leftRow2 = page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 LeftNote' })
  const rightRow2 = page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 RightNote' })
  const leftRow3 = page.getByRole('gridcell', { name: 'CrowdReactionRule 3행 LeftNote' })
  await leftRow2.click()
  await page.keyboard.insertText('excel_fill')
  await page.keyboard.press('Enter')

  await leftRow2.click()
  await leftRow3.click({ modifiers: ['Shift'] })
  await page.keyboard.press('Control+d')
  await expect(leftRow3).toContainText('excel_fill')

  await leftRow2.click()
  await rightRow2.click({ modifiers: ['Shift'] })
  await page.keyboard.press('Control+r')
  await expect(rightRow2).toContainText('excel_fill')

  await leftRow2.click()
  await page.keyboard.press('Control+Space')
  await expect(page.getByRole('button', { name: 'K열 선택' })).toHaveClass(/selected/)
  await leftRow2.click()
  await page.keyboard.press('Shift+Space')
  await expect(page.getByRole('rowheader', { name: '2행 선택' })).toHaveClass(/selected/)

  await rightRow2.click()
  await page.keyboard.press('Home')
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 RuleId' })).toHaveClass(/active/)
  await page.keyboard.press('End')
  await expect(rightRow2).toHaveClass(/active/)
  await page.keyboard.press('Control+Home')
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 1행 RuleId' })).toHaveClass(/active/)
  await page.keyboard.press('Control+End')
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 3행 RightNote' })).toHaveClass(/active/)

  await page.keyboard.press('Control+PageDown')
  await expect(page.getByRole('grid', { name: 'CrowdReactionRuleAction 데이터 그리드' })).toBeVisible()
  await page.keyboard.press('Control+PageUp')
  await expect(page.getByRole('grid', { name: 'CrowdReactionRule 데이터 그리드' })).toBeVisible()
})
