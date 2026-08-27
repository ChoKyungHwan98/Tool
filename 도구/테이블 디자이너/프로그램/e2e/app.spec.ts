import { expect, test } from '@playwright/test'

test('opens the project into the structure-first workbench', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: '내 프로젝트', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await expect(page.getByRole('heading', { name: '전체 구조' })).toBeVisible()
  await expect(page.getByRole('button', { name: /CrowdReactionRule/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '새 테이블' })).toBeVisible()
  await expect(page.getByLabel('AI 도우미')).toBeVisible()

  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()
  await expect(page.getByRole('heading', { name: '테이블 편집' })).toBeVisible()
  await expect(page.getByRole('button', { name: '열 추가', exact: true })).toHaveCount(1)

  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 설계' }).click()
  await expect(page.getByRole('heading', { name: '테이블 설계' })).toBeVisible()
  await expect(page.getByLabel('테이블 설계 보기').getByRole('button', { name: '기본' })).toHaveClass(/active/)
  await page.screenshot({ path: 'design/screenshots/workbench-design-basic-1280x720.png', fullPage: true })
  await page.getByLabel('테이블 설계 보기').getByRole('button', { name: '키와 관계' }).click()
  await expect(page.getByText('기본 키 (PK)')).toBeVisible()
  await expect(page.getByText('다른 테이블 연결 (FK)')).toBeVisible()
  await page.screenshot({ path: 'design/screenshots/workbench-design-relations-1280x720.png', fullPage: true })

  await page.getByRole('button', { name: '내보내기' }).click()
  await expect(page.getByRole('dialog', { name: '내보내기', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '내보내기 닫기' }).click()

  await page.getByRole('button', { name: '검증' }).dispatchEvent('click')
  await expect(page.getByLabel('워크벤치 세부 패널')).toBeVisible()
  await expect(page.getByRole('button', { name: '문제' })).toBeVisible()
  await expect(page.getByRole('button', { name: '변경 검토' })).toBeVisible()
  await expect(page.getByRole('button', { name: '마이그레이션' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '히스토리' })).toHaveCount(0)
})

test('shows data conversion only for a reviewed type change and keeps history in the toolbar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 설계' }).click()

  await page.getByLabel('데이터 타입').selectOption('int32')
  const reviewPanel = page.getByLabel('워크벤치 세부 패널')
  await expect(reviewPanel).toBeVisible()
  await expect(reviewPanel.getByText('데이터 변환 계획')).toBeVisible()
  await expect(reviewPanel.getByText(/타입을 string에서 int32/)).toBeVisible()
  await reviewPanel.getByRole('button', { name: '취소' }).click()
  await expect(reviewPanel).toHaveCount(0)

  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()
  await page.getByRole('button', { name: '행 추가' }).click()
  await expect(page.getByLabel('워크벤치 세부 패널')).toHaveCount(0)
  await page.getByRole('button', { name: '변경 이력' }).click()
  const historyDialog = page.getByRole('dialog', { name: '변경 이력' })
  await expect(historyDialog).toContainText('행 추가')
  await expect(historyDialog).toContainText('1개 행 추가')
})

test('focuses schema relations and opens table design from the map', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await expect(page.getByRole('heading', { name: '전체 구조' })).toBeVisible()

  await page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdReactionRule \d+열 2행/ }).click()
  await expect(page.locator('.schema-node.selected')).toContainText('CrowdReactionRule')

  await page.getByLabel('관계 표시 범위').getByRole('button', { name: '현재 테이블' }).click()
  await expect(page.getByLabel('관계 표시 범위').getByRole('button', { name: '현재 테이블' })).toHaveClass(/active/)

  await page.getByRole('button', { name: '자동 배치' }).click()
  await expect(page.getByRole('button', { name: '자동 배치' })).toBeEnabled()
  await expect(page.getByText('자동 배치에 실패했습니다.')).toHaveCount(0)

  await page.locator('.schema-node.selected').dblclick()
  await expect(page.getByRole('heading', { name: '테이블 설계' })).toBeVisible()
})

test('adds a data row and accepts keyboard input without crashing', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()
  await expect(page.getByRole('heading', { name: '테이블 편집' })).toBeVisible()
  await expect(page.locator('.spreadsheet-toolbar')).toContainText('2행')
  await page.screenshot({ path: 'design/screenshots/workbench-data-1280x720.png', fullPage: true })

  await page.getByRole('button', { name: '행 추가' }).click()
  await expect(page.locator('.spreadsheet-toolbar')).toContainText('3행')

  const ruleIdCell = page.getByLabel('CrowdReactionRule 4행 RuleId')
  await ruleIdCell.click()
  await page.keyboard.insertText('row_test_001')
  await page.keyboard.press('Enter')
  await expect(ruleIdCell).toContainText('row_test_001')

  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: '테이블 편집' })).toBeVisible()
  await page.getByTitle('실행 취소').click()
  await page.getByTitle('실행 취소').click()
  await expect(page.locator('.spreadsheet-row:not(.spreadsheet-append-row)')).toHaveCount(2)
  await expect(page.locator('.spreadsheet-append-row')).toBeVisible()
  await expect(page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdReactionRule \d+열 2행/ })).toBeVisible()
  await expect(page.locator('.spreadsheet-cell.active, .spreadsheet-schema-cell.active')).toHaveCount(0)
  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
})

test('audit: exposes the schema header at A1 and the first record at A2', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()

  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 1행 RuleId' })).toContainText('RuleId')
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 RuleId' })).toContainText('goal_home_high')
})

test('audit: keeps exactly one primary add-column command in the table editor', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()

  await expect(page.getByRole('button', { name: '열 추가', exact: true })).toHaveCount(1)
})

test('audit: renames a PK column by typing directly into A1', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()

  const a1 = page.getByRole('gridcell', { name: 'CrowdReactionRule 1행 RuleId' })
  await a1.click()
  await expect(a1).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.insertText('RuleKey')
  await page.keyboard.press('Enter')

  await expect(a1).toContainText('RuleId')
  await expect(page.getByLabel('워크벤치 세부 패널')).toBeVisible()
  await page.getByRole('button', { name: '검토 후 적용' }).click()

  const renamedA1 = page.getByRole('gridcell', { name: 'CrowdReactionRule 1행 RuleKey' })
  await expect(renamedA1).toContainText('RuleKey')
  await expect(renamedA1).toContainText('PK')
})

test('edits cells directly with Excel keyboard rules and exact undo', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()

  const ruleIdCell = page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 RuleId' })
  await ruleIdCell.click()
  await expect(ruleIdCell).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.insertText('한글_규칙')
  await expect(page.getByRole('textbox', { name: 'CrowdReactionRule 2행 RuleId 편집' })).toHaveValue('한글_규칙')
  await page.keyboard.press('Enter')
  await expect(ruleIdCell).toContainText('한글_규칙')

  await ruleIdCell.click()
  await page.keyboard.press('F2')
  const preservedEditor = page.getByRole('textbox', { name: 'CrowdReactionRule 2행 RuleId 편집' })
  await expect(preservedEditor).toHaveValue('한글_규칙')
  await preservedEditor.press('End')
  await preservedEditor.pressSequentially('_취소')
  await preservedEditor.press('Escape')
  await expect(ruleIdCell).toContainText('한글_규칙')

  const secondRuleIdCell = page.getByRole('gridcell', { name: 'CrowdReactionRule 3행 RuleId' })
  await secondRuleIdCell.click()
  await page.getByLabel('그리드 키보드 입력').evaluate((element) => {
    const input = element as HTMLTextAreaElement
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    input.value = '한글_조합'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: '한글_조합', inputType: 'insertCompositionText', isComposing: true }))
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한글_조합' }))
  })
  const compositionEditor = page.getByRole('textbox', { name: 'CrowdReactionRule 3행 RuleId 편집' })
  await expect(compositionEditor).toHaveValue('한글_조합')
  await compositionEditor.press('Escape')
  await expect(secondRuleIdCell).toContainText('foul_against_home')

  await ruleIdCell.dblclick()
  const doubleClickEditor = page.getByRole('textbox', { name: 'CrowdReactionRule 2행 RuleId 편집' })
  await doubleClickEditor.press('End')
  await doubleClickEditor.pressSequentially('_수정')
  await doubleClickEditor.press('Tab')
  await expect(ruleIdCell).toContainText('한글_규칙_수정')

  const profileCell = page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 ProfileId' })
  await expect(profileCell).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.insertText('profile_direct')
  await page.keyboard.press('Enter')
  await expect(profileCell).toContainText('profile_direct')

  await page.getByRole('button', { name: 'B열 선택' }).click()
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 1행 ProfileId' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 2행 ProfileId' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 3행 ProfileId' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: '행 삭제' })).toHaveCount(0)
  await page.getByRole('button', { name: '전체 셀 선택' }).click()
  await expect(ruleIdCell).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: '행 삭제' })).toHaveCount(0)

  await page.getByTitle('실행 취소').click()
  await expect(profileCell).toContainText('profile_home_default')
})

test('keeps headers, cells, and empty-grid guides aligned while resizing columns', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()

  const resizer = page.getByRole('separator', { name: 'RuleId 열 너비 조절' })
  const before = await resizer.boundingBox()
  expect(before).not.toBeNull()
  await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2)
  await page.mouse.down()
  await page.mouse.move(before!.x + before!.width / 2 + 96, before!.y + before!.height / 2)
  await page.mouse.up()

  const geometry = await page.evaluate(() => {
    const guides = [...document.querySelectorAll<HTMLElement>('.spreadsheet-column-guide')]
    const stacks = [...document.querySelectorAll<HTMLElement>('.spreadsheet-column-stack')]
    const secondColumnCell = document.querySelector<HTMLElement>('.spreadsheet-row [data-workbook-column="1"]')
    const box = (element: HTMLElement | undefined | null) => {
      if (!element) return null
      const bounds = element.getBoundingClientRect()
      return { left: bounds.left, right: bounds.right, width: bounds.width }
    }
    return {
      firstGuide: box(guides[0]),
      secondGuide: box(guides[1]),
      firstHeader: box(stacks[0]),
      secondHeader: box(stacks[1]),
      secondColumnCell: box(secondColumnCell),
    }
  })

  expect(geometry.firstHeader!.width).toBeGreaterThan(240)
  expect(Math.abs(geometry.firstHeader!.right - geometry.firstGuide!.right)).toBeLessThan(1)
  expect(Math.abs(geometry.secondHeader!.left - geometry.secondGuide!.left)).toBeLessThan(1)
  expect(Math.abs(geometry.secondHeader!.left - geometry.secondColumnCell!.left)).toBeLessThan(1)
  await expect(page.locator('body')).not.toHaveClass(/spreadsheet-column-resizing/)

  await resizer.dblclick()
  await expect(page.getByRole('textbox', { name: 'CrowdReactionRule 1행 RuleId 편집' })).toHaveCount(0)
})

test('keeps empty tables editable and resets the active cell when sheets change', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()
  await page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdReactionProfile 3열 0행/ }).click()

  await expect(page.locator('.spreadsheet-ghost-grid')).toBeVisible()
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionProfile 2행 ProfileId 새 행' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'A열 선택' })).toBeVisible()
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionProfile 1행 ProfileId' })).toBeVisible()
  await expect(page.locator('.spreadsheet-value-bar')).toHaveCount(0)

  await page.getByRole('button', { name: '행 추가' }).click()
  const newCell = page.getByRole('gridcell', { name: 'CrowdReactionProfile 2행 ProfileId' })
  await newCell.click()
  await page.keyboard.insertText('profile_new')
  await page.keyboard.press('Enter')
  await expect(newCell).toContainText('profile_new')

  await page.getByLabel('시트 탭').getByRole('button', { name: 'CrowdReactionAction 0' }).click()
  await expect(page.locator('.spreadsheet-cell.active, .spreadsheet-schema-cell.active')).toHaveCount(0)
})

test('adds, renames, reorders, reviews deletion, and restores a table column', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()

  await page.getByRole('button', { name: '열 추가', exact: true }).click()
  const headerEditor = page.getByLabel('CrowdReactionRule 1행 NewColumn 편집')
  await expect(headerEditor).toBeVisible()
  await headerEditor.fill('DesignerNote')
  await headerEditor.press('Enter')
  let designerHeader = page.getByRole('gridcell', { name: 'CrowdReactionRule 1행 DesignerNote' })
  await expect(designerHeader).toBeVisible()

  await designerHeader.click()
  await page.keyboard.press('F2')
  const preservedHeaderEditor = page.getByLabel('CrowdReactionRule 1행 DesignerNote 편집')
  await expect(preservedHeaderEditor).toHaveValue('DesignerNote')
  await preservedHeaderEditor.press('End')
  await preservedHeaderEditor.pressSequentially('_취소')
  await preservedHeaderEditor.press('Escape')
  await expect(designerHeader).toContainText('DesignerNote')

  await designerHeader.click()
  await page.keyboard.insertText('DesignerMemo')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 1행 DesignerMemo' })).toBeVisible()
  await page.getByTitle('실행 취소').click()
  designerHeader = page.getByRole('gridcell', { name: 'CrowdReactionRule 1행 DesignerNote' })
  await expect(designerHeader).toBeVisible()

  await designerHeader.click()
  await page.keyboard.insertText('RuleId')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('alert')).toContainText('이미 RuleId 열이 있습니다.')
  await expect(designerHeader).toContainText('DesignerNote')

  await page.getByLabel('DesignerNote 열 메뉴').click()
  await page.screenshot({ path: 'design/screenshots/workbench-column-menu-1280x720.png', fullPage: true })
  await page.getByRole('menuitem', { name: '왼쪽으로' }).click()
  const headerNames = await page.locator('.column-title-button > span').allTextContents()
  expect(headerNames.indexOf('DesignerNote')).toBe(headerNames.length - 2)

  const noteCell = page.getByLabel('CrowdReactionRule 2행 DesignerNote')
  await noteCell.dblclick()
  await page.getByLabel('CrowdReactionRule 2행 DesignerNote 편집').fill('밸런스 메모')
  await page.getByLabel('CrowdReactionRule 2행 DesignerNote 편집').press('Enter')
  await expect(noteCell).toContainText('밸런스 메모')

  await page.getByLabel('DesignerNote 열 메뉴').click()
  await page.getByRole('menuitem', { name: '열 삭제' }).click()
  await expect(page.getByLabel('워크벤치 세부 패널')).toBeVisible()
  await page.getByRole('button', { name: '검토 후 적용' }).click()
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 1행 DesignerNote' })).toHaveCount(0)

  await page.getByTitle('실행 취소').click()
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionRule 1행 DesignerNote' })).toBeVisible()
  await expect(page.getByLabel('CrowdReactionRule 2행 DesignerNote')).toContainText('밸런스 메모')
})

test('pastes a cell range and restores it with one undo', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()

  const firstCell = page.getByLabel('CrowdReactionRule 1행 RuleId')
  await firstCell.click()
  await page.evaluate(() => {
    const data = new DataTransfer()
    data.setData('text/plain', 'RuleKey\tProfileId\npasted_rule_1\tprofile_home_default\npasted_rule_2\tprofile_home_default')
    document.querySelector('[role="grid"]')?.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: data }))
  })

  await expect(page.getByLabel('CrowdReactionRule 1행 RuleId')).toContainText('RuleId')
  await page.getByRole('button', { name: '검토 후 적용' }).click()
  await expect(page.getByLabel('CrowdReactionRule 1행 RuleKey')).toContainText('RuleKey')
  await expect(page.getByLabel('CrowdReactionRule 2행 RuleKey')).toContainText('pasted_rule_1')
  await expect(page.getByLabel('CrowdReactionRule 3행 RuleKey')).toContainText('pasted_rule_2')
  await page.getByTitle('실행 취소').click()
  await expect(page.getByLabel('CrowdReactionRule 1행 RuleId')).toContainText('RuleId')
  await expect(page.getByLabel('CrowdReactionRule 2행 RuleId')).toContainText('goal_home_high')
  await expect(page.getByLabel('CrowdReactionRule 3행 RuleId')).toContainText('foul_against_home')
})

test('creates an empty project and imports a CSV through a reviewed preview', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '새 프로젝트' }).click()
  await page.getByLabel('프로젝트 이름').fill('아이템 시스템')
  await page.getByRole('button', { name: '프로젝트 만들기' }).click()

  await expect(page.getByText('CSV·Excel 가져오기')).toBeVisible()
  await expect(page.getByText('직접 테이블 만들기')).toBeVisible()
  await expect(page.getByText('AI에게 구조 요청')).toBeVisible()

  const importOption = page.locator('.start-option').filter({ hasText: 'CSV·Excel 가져오기' })
  await importOption.locator('input[type="file"]').setInputFiles({
    name: 'Item.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('ItemId,Name,Price\nitem_1,Potion,100\nitem_2,Sword,500'),
  })

  await expect(page.getByRole('dialog', { name: '가져오기 미리보기' })).toBeVisible()
  await expect(page.getByText('헤더 1행 · 데이터 2행')).toBeVisible()
  await page.getByRole('button', { name: '1개 테이블 적용' }).click()
  await expect(page.getByRole('heading', { name: '전체 구조' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Item .*열 2행/ })).toBeVisible()
})

test('reviews the schema in the right AI panel and stages a Command for approval', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()

  await page.getByLabel('AI에게 요청').fill('현재 PK와 FK 관계를 검토해 주세요.')
  await page.getByTitle('AI에게 보내기').click()
  await expect(page.getByText(/Mock 제안:/)).toBeVisible()
  await expect(page.getByText(/테이블 11/)).toBeVisible()
  await page.screenshot({ path: 'design/screenshots/workbench-ai-review-1280x720.png', fullPage: true })

  await page.getByRole('button', { name: '제안을 Command로 검토' }).click()
  await expect(page.getByLabel('워크벤치 세부 패널')).toBeVisible()
  await expect(page.getByRole('button', { name: '검토 후 적용' })).toBeVisible()
})

test('previews the integrated Excel and project backup exports with validation status', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByRole('button', { name: '내보내기' }).click()

  const drawer = page.getByRole('dialog', { name: '내보내기', exact: true })
  await expect(drawer.getByRole('heading', { name: '통합 Excel' })).toBeVisible()
  await expect(drawer.getByRole('heading', { name: '프로젝트 백업' })).toBeVisible()
  await expect(drawer.getByText('내보내기 준비가 끝났습니다.')).toBeVisible()
  await expect(drawer.getByRole('button', { name: '통합 Excel 내보내기' })).toBeEnabled()
  await expect(drawer.getByRole('button', { name: '프로젝트 백업(.gsw)' })).toBeEnabled()
  await page.screenshot({ path: 'design/screenshots/workbench-export-1280x720.png', fullPage: true })
})
