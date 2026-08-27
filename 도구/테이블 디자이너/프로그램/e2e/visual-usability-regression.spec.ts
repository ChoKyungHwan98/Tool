import { expect, test } from '@playwright/test'

test('빈 프로젝트에서도 테이블 편집 화면이 안전한 시작 상태를 제공한다', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/')
  await page.getByRole('button', { name: '새 프로젝트' }).click()
  await page.getByLabel('프로젝트 이름').fill('빈 프로젝트 QA')
  await page.getByRole('button', { name: '프로젝트 만들기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()

  await expect(page.getByRole('heading', { name: '테이블 편집' })).toBeVisible()
  await expect(page.getByText('편집할 테이블이 없습니다.')).toBeVisible()
  await expect(page.getByRole('button', { name: '첫 테이블 만들기' })).toBeVisible()
  expect(pageErrors).toEqual([])
  await page.screenshot({ path: 'design/screenshots/empty-project-table-editor-1280x720.png', fullPage: true })
})

test('구조도 관계는 선만 보고도 서로 구분되며 불필요한 도움말 버튼이 없다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '게임 C PK/FK 예제' }).click()

  await expect(page.getByRole('button', { name: 'PK/FK 도움말' })).toHaveCount(0)
  await page.getByRole('button', { name: '자동 배치' }).click()
  await expect(page.getByRole('button', { name: '자동 배치' })).toBeEnabled()

  const relationColors = await page.locator('.react-flow__edge-path').evaluateAll((paths) => (
    paths.map((path) => getComputedStyle(path).stroke).filter(Boolean)
  ))
  expect(new Set(relationColors).size).toBeGreaterThanOrEqual(4)

  const sharedSamples = await page.evaluate(() => {
    const sample = (edgeId: string) => {
      const path = document.querySelector<SVGPathElement>(`.react-flow__edge[data-id="${edgeId}"] .react-flow__edge-path`)
      if (!path) return [] as string[]
      const points: string[] = []
      for (let distance = 6; distance < path.getTotalLength() - 6; distance += 4) {
        const point = path.getPointAtLength(distance)
        points.push(`${Math.round(point.x / 2) * 2}:${Math.round(point.y / 2) * 2}`)
      }
      return points
    }
    const monsterDropToItem = new Set(sample('relation_game_c_drop_item'))
    return sample('relation_game_c_shop_item_item').filter((point) => monsterDropToItem.has(point)).length
  })
  expect(sharedSamples).toBeLessThan(6)
  await page.screenshot({ path: 'design/screenshots/game-c-auto-layout-readable-1280x720.png', fullPage: true })
})

test('빈 워크북의 실제 열, 입력 열, 표시용 열이 같은 그리드 폭으로 정렬된다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()
  await page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdReactionProfile 3열 0행/ }).click()

  const geometry = await page.evaluate(() => {
    const appendHeader = document.querySelector<HTMLElement>('.spreadsheet-append-column')
    const appendCell = document.querySelector<HTMLElement>('.spreadsheet-append-row .spreadsheet-append-column-cell')
    const firstGhost = document.querySelector<HTMLElement>('.spreadsheet-ghost-column')
    if (!appendHeader || !appendCell || !firstGhost) return null
    const header = appendHeader.getBoundingClientRect()
    const cell = appendCell.getBoundingClientRect()
    const ghost = firstGhost.getBoundingClientRect()
    return {
      headerLeft: header.left,
      headerWidth: header.width,
      cellLeft: cell.left,
      cellWidth: cell.width,
      ghostLeft: ghost.left,
      ghostWidth: ghost.width,
    }
  })

  expect(geometry).not.toBeNull()
  expect(Math.abs(geometry!.headerLeft - geometry!.cellLeft)).toBeLessThan(1)
  expect(Math.abs(geometry!.headerWidth - geometry!.cellWidth)).toBeLessThan(1)
  expect(Math.abs(geometry!.ghostLeft - (geometry!.headerLeft + geometry!.headerWidth))).toBeLessThan(1)
  expect(Math.abs(geometry!.ghostWidth - geometry!.headerWidth)).toBeLessThan(1)
  await page.screenshot({ path: 'design/screenshots/empty-workbook-aligned-grid-1280x720.png', fullPage: true })
})
