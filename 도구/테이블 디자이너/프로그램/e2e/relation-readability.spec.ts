import { expect, test, type Page } from '@playwright/test'

const directRelationIds = [
  'relation_game_c_item_type',
  'relation_game_c_drop_item',
  'relation_game_c_shop_item_item',
] as const

const unrelatedRelationIds = [
  'relation_game_c_drop_monster',
  'relation_game_c_shop_item_shop',
] as const

async function relationScreenPoint(page: Page, relationId: string) {
  return page.locator(`.react-flow__edge[data-id="${relationId}"] .react-flow__edge-interaction`).evaluate((path) => {
    const svgPath = path as SVGPathElement
    const point = svgPath.getPointAtLength(svgPath.getTotalLength() / 2)
    const matrix = svgPath.getScreenCTM()
    if (!matrix) throw new Error('관계선 화면 좌표를 계산할 수 없습니다.')
    const screenPoint = point.matrixTransform(matrix)
    return { x: screenPoint.x, y: screenPoint.y }
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '게임 C PK/FK 예제' }).click()
  await expect(page.locator('[data-route-kind="worker-smart-step"]')).toHaveCount(5)
})

test('audit: 선택 테이블의 직접 관계만 선명하게 표시한다', async ({ page }) => {
  await expect(page.locator('[data-relation-state="dimmed"]')).toHaveCount(0)
  await page.getByRole('button', { name: '현재 테이블', exact: true }).click()
  await expect(page.locator('.react-flow__edge')).toHaveCount(5)
  const styles = await page.locator('.react-flow__edge').evaluateAll((edges) => Object.fromEntries(edges.map((edge) => {
    const path = edge.querySelector<SVGPathElement>('.react-flow__edge-path')
    if (!path) return [(edge as HTMLElement).dataset.id ?? '', null]
    const style = getComputedStyle(path)
    return [(edge as HTMLElement).dataset.id ?? '', {
      opacity: Number(style.strokeOpacity),
      stroke: style.stroke,
      width: Number.parseFloat(style.strokeWidth),
    }]
  })))

  for (const relationId of directRelationIds) {
    expect(styles[relationId]).toMatchObject({ opacity: 1, width: 2.6 })
  }
  for (const relationId of unrelatedRelationIds) {
    expect(styles[relationId]?.opacity).toBeLessThanOrEqual(0.14)
    expect(styles[relationId]?.width).toBe(1.2)
    expect(styles[relationId]?.stroke).toBe('rgb(135, 149, 166)')
  }
})

test('audit: 관계선에서 FK와 PK 전체 경로를 바로 확인한다', async ({ page }) => {
  const hoverPoint = await relationScreenPoint(page, 'relation_game_c_item_type')
  await page.mouse.move(hoverPoint.x, hoverPoint.y)

  const popover = page.getByRole('tooltip')
  await expect(popover).toContainText('Item.ItemTypeId')
  await expect(popover).toContainText('ItemType.ItemTypeId')
  await expect(popover).toContainText('대상 키를 참조합니다')
  await expect(page.locator('[data-id="table_game_c_item"] .relation-emphasis-source')).toHaveCount(1)
  await expect(page.locator('[data-id="table_game_c_item_type"] .relation-emphasis-target')).toHaveCount(1)

  const hoveredStyle = await page.locator('.react-flow__edge[data-id="relation_game_c_item_type"] .react-flow__edge-path').evaluate((path) => {
    const style = getComputedStyle(path)
    return { opacity: Number(style.strokeOpacity), width: Number.parseFloat(style.strokeWidth) }
  })
  const suppressedOpacity = await page.locator('.react-flow__edge[data-id="relation_game_c_drop_item"] .react-flow__edge-path').evaluate((path) => Number(getComputedStyle(path).strokeOpacity))
  expect(hoveredStyle).toEqual({ opacity: 1, width: 3.2 })
  expect(suppressedOpacity).toBeLessThanOrEqual(0.1)
})

test('관계 설명을 클릭·Escape·캔버스 클릭·키보드로 고정하고 닫는다', async ({ page }) => {
  const relationId = 'relation_game_c_item_type'
  const point = await relationScreenPoint(page, relationId)
  await page.mouse.click(point.x, point.y)

  const dialog = page.getByRole('dialog', { name: 'Item.ItemTypeId (FK)에서 ItemType.ItemTypeId (PK)를 참조합니다' })
  await expect(dialog).toBeVisible()
  await page.mouse.move(point.x + 80, point.y + 80)
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  const edge = page.locator(`.react-flow__edge[data-id="${relationId}"]`)
  await edge.focus()
  await edge.press('Enter')
  await expect(dialog).toBeVisible()

  const pane = page.locator('.react-flow__pane')
  const paneBounds = await pane.boundingBox()
  if (!paneBounds) throw new Error('구조도 캔버스 좌표를 찾을 수 없습니다.')
  await page.mouse.click(paneBounds.x + paneBounds.width / 2, paneBounds.y + paneBounds.height - 24)
  await expect(dialog).toHaveCount(0)
})

test('관계 범위 명령은 간결한 문구와 설명을 제공한다', async ({ page }) => {
  await expect(page.getByRole('button', { name: '전체', exact: true })).toHaveAttribute('title', '모든 관계 표시')
  await expect(page.getByRole('button', { name: '현재 테이블', exact: true })).toHaveAttribute('title', '선택 테이블의 직접 관계')
  await expect(page.getByRole('button', { name: '연결 경로', exact: true })).toHaveAttribute('title', '다단계 연결 경로')
})

test('관계 설명은 지원 해상도에서 구조도 경계 안에 표시된다', async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport)
    const point = await relationScreenPoint(page, 'relation_game_c_item_type')
    await page.mouse.click(point.x, point.y)

    const dialog = page.getByRole('dialog', { name: 'Item.ItemTypeId (FK)에서 ItemType.ItemTypeId (PK)를 참조합니다' })
    await expect(dialog).toBeVisible()
    const dialogBounds = await dialog.boundingBox()
    const canvasBounds = await page.locator('.react-flow').boundingBox()
    if (!dialogBounds || !canvasBounds) throw new Error('관계 설명 또는 구조도의 경계를 측정할 수 없습니다.')
    expect(dialogBounds.x).toBeGreaterThanOrEqual(canvasBounds.x - 1)
    expect(dialogBounds.y).toBeGreaterThanOrEqual(canvasBounds.y - 1)
    expect(dialogBounds.x + dialogBounds.width).toBeLessThanOrEqual(canvasBounds.x + canvasBounds.width + 1)
    expect(dialogBounds.y + dialogBounds.height).toBeLessThanOrEqual(canvasBounds.y + canvasBounds.height + 1)

    if (viewport.width === 1440) {
      await page.screenshot({ path: 'design/screenshots/relation-readability-1440x900.png' })
    }
    await page.keyboard.press('Escape')
  }
})

test('FK 포트에서 출발해 PK 행 내부의 개별 대상 포트로 도착한다', async ({ page }) => {
  const distances = await page.evaluate(() => {
    const relationId = 'relation_game_c_item_type'
    const edge = document.querySelector<SVGGElement>(`.react-flow__edge[data-id="${relationId}"]`)
    const path = edge?.querySelector<SVGPathElement>('.react-flow__edge-path')
    const source = document.querySelector<HTMLElement>(`[data-handleid="relation-source:${relationId}"]`)
    const target = document.querySelector<HTMLElement>(`[data-handleid="relation-target:${relationId}"]`)
    const matrix = path?.getScreenCTM()
    if (!path || !source || !target || !matrix) return { source: Number.POSITIVE_INFINITY, target: Number.POSITIVE_INFINITY }
    const start = path.getPointAtLength(0).matrixTransform(matrix)
    const end = path.getPointAtLength(path.getTotalLength()).matrixTransform(matrix)
    const sourceBounds = source.getBoundingClientRect()
    const targetBounds = target.getBoundingClientRect()
    return {
      source: Math.hypot(start.x - (sourceBounds.left + sourceBounds.width / 2), start.y - (sourceBounds.top + sourceBounds.height / 2)),
      target: Math.hypot(end.x - (targetBounds.left + targetBounds.width / 2), end.y - (targetBounds.top + targetBounds.height / 2)),
    }
  })

  expect(distances.source).toBeLessThan(8)
  expect(distances.target).toBeLessThan(8)
})

test('같은 ItemId를 참조하는 두 관계는 겹치지 않는 대상 슬롯을 사용한다', async ({ page }) => {
  const audit = await page.evaluate(() => {
    const relationIds = [
      'relation_game_c_drop_item',
      'relation_game_c_shop_item_item',
    ]
    return relationIds.map((relationId) => {
      const handle = document.querySelector<HTMLElement>(`[data-handleid="relation-target:${relationId}"]`)
      const row = handle?.closest<HTMLElement>('.schema-node-column')
      const edge = document.querySelector<SVGGElement>(`.react-flow__edge[data-id="${relationId}"]`)
      const path = edge?.querySelector<SVGPathElement>('.react-flow__edge-path')
      const matrix = path?.getScreenCTM()
      if (!handle || !row || !path || !matrix) throw new Error(`${relationId}의 대상 포트를 찾을 수 없습니다.`)

      const handleBounds = handle.getBoundingClientRect()
      const rowBounds = row.getBoundingClientRect()
      const end = path.getPointAtLength(path.getTotalLength()).matrixTransform(matrix)
      const handleCenter = {
        x: handleBounds.left + handleBounds.width / 2,
        y: handleBounds.top + handleBounds.height / 2,
      }
      return {
        endpointDistance: Math.hypot(end.x - handleCenter.x, end.y - handleCenter.y),
        handleY: handleCenter.y,
        insideRow: handleCenter.y > rowBounds.top && handleCenter.y < rowBounds.bottom,
        slotOffset: Number(handle.dataset.targetSlotOffset),
      }
    })
  })

  expect(audit.every((result) => result.insideRow)).toBe(true)
  expect(Math.max(...audit.map((result) => result.endpointDistance))).toBeLessThan(8)
  expect(Math.abs(audit[1]!.handleY - audit[0]!.handleY)).toBeGreaterThanOrEqual(5)
  expect(audit.map((result) => result.slotOffset)).toEqual([-4, 4])
})
