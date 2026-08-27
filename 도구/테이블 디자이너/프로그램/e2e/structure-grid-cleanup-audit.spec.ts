import { expect, test } from '@playwright/test'

test('구조도는 핵심 키와 관계만 상시 표시한다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '게임 C PK/FK 예제' }).click()

  await expect(page.getByRole('heading', { name: '전체 구조' })).toBeVisible()
  await expect(page.locator('.schema-badge.ref')).toHaveCount(0)
  await expect(page.getByText('TABLE', { exact: true })).toHaveCount(0)
  await expect(page.locator('.legend-strip')).toHaveCount(0)
  await expect(page.locator('.zoom-status')).toHaveCount(0)
  await expect(page.locator('.schema-minimap')).toHaveCount(0)
  await expect(page.locator('.schema-node-column.referenced')).toHaveCount(0)
  await expect(page.getByLabel('관계 표시 범위').getByRole('button', { name: '전체' })).toBeVisible()
  await expect(page.getByLabel('관계 표시 범위').getByRole('button', { name: '현재 테이블' })).toBeVisible()
  await expect(page.getByLabel('관계 표시 범위').getByRole('button', { name: '연결 경로' })).toBeVisible()
})

test('테이블 편집은 셀 값 표시줄 없이 격자에서 직접 입력한다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '게임 C PK/FK 예제' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()
  await page.getByLabel('테이블 목록').getByRole('button', { name: 'ItemType 2열 2행' }).click()

  await expect(page.locator('.spreadsheet-value-bar')).toHaveCount(0)
  const header = page.getByRole('gridcell', { name: 'ItemType 1행 ItemTypeId' })
  await header.click()
  await page.keyboard.press('F2')
  await expect(page.getByRole('textbox', { name: 'ItemType 1행 ItemTypeId 편집' })).toHaveValue('ItemTypeId')
})

test('Game C 관계선은 실제 FK 열 포트에서 출발하고 다른 카드를 통과하지 않는다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '게임 C PK/FK 예제' }).click()
  await expect(page.locator('[data-route-kind="worker-smart-step"]')).toHaveCount(5)

  const sourceDistance = await page.evaluate(() => {
    const edge = document.querySelector<SVGGElement>('.react-flow__edge[data-id="relation_game_c_item_type"]')
    const path = edge?.querySelector<SVGPathElement>('.react-flow__edge-path')
    const handle = document.querySelector<HTMLElement>('[data-id="table_game_c_item"] [data-handleid="column_game_c_item_type_ref"][data-handlepos="right"]')
    const matrix = path?.getScreenCTM()
    if (!path || !handle || !matrix) return Number.POSITIVE_INFINITY
    const start = path.getPointAtLength(0)
    const point = new DOMPoint(start.x, start.y).matrixTransform(matrix)
    const bounds = handle.getBoundingClientRect()
    return Math.hypot(point.x - (bounds.left + bounds.width / 2), point.y - (bounds.top + bounds.height / 2))
  })
  expect(sourceDistance).toBeLessThan(8)

  const shopItemTargetOffset = await page.evaluate(() => {
    const handle = document.querySelector<HTMLElement>(
      '[data-id="table_game_c_item"] [data-handleid="relation-target:relation_game_c_shop_item_item"]',
    )
    const columnRow = handle?.closest<HTMLElement>('.schema-node-column')
    if (!handle || !columnRow) return Number.POSITIVE_INFINITY
    const handleBounds = handle.getBoundingClientRect()
    const rowBounds = columnRow.getBoundingClientRect()
    return Math.abs(
      (handleBounds.top + handleBounds.height / 2)
      - (rowBounds.top + rowBounds.height / 2),
    )
  })
  // 같은 PK 행으로 모이는 관계는 행 내부의 안정적인 개별 슬롯을 사용한다.
  expect(shopItemTargetOffset).toBeLessThanOrEqual(10)

  const shopItemArrowOffset = await page.evaluate(() => {
    const edge = document.querySelector<SVGGElement>(
      '.react-flow__edge[data-id="relation_game_c_shop_item_item"]',
    )
    const path = edge?.querySelector<SVGPathElement>('.react-flow__edge-path')
    const handle = document.querySelector<HTMLElement>(
      '[data-id="table_game_c_item"] [data-handleid="relation-target:relation_game_c_shop_item_item"]',
    )
    const matrix = path?.getScreenCTM()
    if (!path || !handle || !matrix) return Number.POSITIVE_INFINITY
    const end = path.getPointAtLength(path.getTotalLength()).matrixTransform(matrix)
    const handleBounds = handle.getBoundingClientRect()
    return Math.hypot(
      end.x - (handleBounds.left + handleBounds.width / 2),
      end.y - (handleBounds.top + handleBounds.height / 2),
    )
  })
  expect(shopItemArrowOffset).toBeLessThan(8)

  await page.getByRole('button', { name: '자동 배치' }).click()
  await expect(page.getByRole('button', { name: '자동 배치' })).toBeEnabled()
  // 자동 배치 후에는 ELK 저장 경로로 렌더된다.
  await expect(page.locator('[data-route-kind="elk-stored"]')).toHaveCount(5)

  const intersections = await page.evaluate(() => {
    const relationEnds: Record<string, readonly [string, string]> = {
      relation_game_c_item_type: ['table_game_c_item', 'table_game_c_item_type'],
      relation_game_c_drop_monster: ['table_game_c_monster_drop', 'table_game_c_monster'],
      relation_game_c_drop_item: ['table_game_c_monster_drop', 'table_game_c_item'],
      relation_game_c_shop_item_shop: ['table_game_c_shop_item', 'table_game_c_shop'],
      relation_game_c_shop_item_item: ['table_game_c_shop_item', 'table_game_c_item'],
    }
    const nodes = [...document.querySelectorAll<HTMLElement>('.react-flow__node')]
    return [...document.querySelectorAll<SVGGElement>('.react-flow__edge')].flatMap((edge) => {
      const edgeId = edge.dataset.id ?? ''
      const path = edge.querySelector<SVGPathElement>('.react-flow__edge-path')
      const matrix = path?.getScreenCTM()
      if (!path || !matrix || !relationEnds[edgeId]) return [`${edgeId}:missing-path`]
      const [sourceId, targetId] = relationEnds[edgeId]!
      const length = path.getTotalLength()
      return nodes.flatMap((node) => {
        if (node.dataset.id === sourceId || node.dataset.id === targetId) return []
        const bounds = node.getBoundingClientRect()
        for (let distance = 4; distance < length - 4; distance += 4) {
          const point = path.getPointAtLength(distance).matrixTransform(matrix)
          if (point.x > bounds.left + 3 && point.x < bounds.right - 3 && point.y > bounds.top + 3 && point.y < bounds.bottom - 3) {
            return [`${edgeId}:${node.dataset.id}`]
          }
        }
        return []
      })
    })
  })
  expect(intersections).toEqual([])
  await page.screenshot({ path: 'design/screenshots/game-c-target-column-alignment-1280x720.png' })
})

test('빈 테이블은 표시용 격자와 다음 입력 행·열을 제공한다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()
  await page.getByLabel('주요 보기').getByRole('button', { name: '테이블 편집' }).click()
  await page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdReactionProfile 3열 0행/ }).click()

  await expect(page.getByText('데이터 행이 없습니다.')).toHaveCount(0)
  await expect(page.locator('.spreadsheet-ghost-grid')).toBeVisible()
  await expect(page.locator('.spreadsheet-ghost-column-letter')).not.toHaveCount(0)
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionProfile 2행 ProfileId 새 행' })).toBeVisible()
  const emptyAppendColumn = page.getByRole('gridcell', { name: 'CrowdReactionProfile 1행 새 열' })
  await expect(emptyAppendColumn).toBeVisible()
  await expect(emptyAppendColumn).toHaveText('')

  const appendCell = page.getByRole('gridcell', { name: 'CrowdReactionProfile 2행 ProfileId 새 행' })
  await appendCell.click()
  await page.keyboard.insertText('profile_from_grid')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionProfile 2행 ProfileId' })).toContainText('profile_from_grid')
  await expect(page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdReactionProfile 3열 1행/ })).toBeVisible()

  await page.getByTitle('실행 취소').click()
  await expect(page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdReactionProfile 3열 0행/ })).toBeVisible()

  const appendColumn = page.getByRole('gridcell', { name: 'CrowdReactionProfile 1행 새 열' })
  await appendColumn.click()
  await page.keyboard.insertText('DesignerNote')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('gridcell', { name: 'CrowdReactionProfile 1행 DesignerNote' })).toBeVisible()
  await expect(page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdReactionProfile 4열 0행/ })).toBeVisible()

  await page.getByTitle('실행 취소').click()
  await expect(page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdReactionProfile 3열 0행/ })).toBeVisible()
})
