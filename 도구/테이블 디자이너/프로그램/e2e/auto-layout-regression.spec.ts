import { expect, test } from '@playwright/test'

test('자동 배치는 고정된 테이블을 재정렬하고 선택 테이블의 직접 관계를 강조한다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '샘플 열기' }).click()

  const zoneNode = page.locator('.react-flow__node[data-id="table_crowd_zone"]')
  const zonePosition = () => zoneNode.evaluate((node) => (node as HTMLElement).style.transform)
  const zoneBounds = await zoneNode.boundingBox()
  expect(zoneBounds).not.toBeNull()

  const originalTransform = await zonePosition()
  await page.mouse.move(zoneBounds!.x + zoneBounds!.width / 2, zoneBounds!.y + 18)
  await page.mouse.down()
  await page.mouse.move(zoneBounds!.x + zoneBounds!.width / 2 + 260, zoneBounds!.y + 198, { steps: 12 })
  await page.mouse.up()

  await expect.poll(zonePosition).not.toBe(originalTransform)
  const draggedTransform = await zonePosition()

  await page.getByLabel('테이블 목록').getByRole('button', { name: /CrowdZone \d+열 2행/ }).click()
  const relationStyles = await page.locator('.react-flow__edge').evaluateAll((edges) => edges.map((edge) => {
    const path = edge.querySelector<SVGPathElement>('.react-flow__edge-path')
    const state = edge.querySelector<SVGGElement>('[data-relation-state]')?.dataset.relationState
    return { state, opacity: Number(path?.style.strokeOpacity || '1') }
  }))
  expect(relationStyles.filter(({ state }) => state === 'active').length).toBeGreaterThan(0)
  expect(relationStyles.filter(({ state }) => state === 'active').every(({ opacity }) => opacity === 1)).toBe(true)
  expect(relationStyles.filter(({ state }) => state === 'dimmed').every(({ opacity }) => opacity <= 0.14)).toBe(true)

  await page.getByRole('button', { name: '자동 배치' }).click()
  await expect(page.getByRole('button', { name: '자동 배치' })).toBeEnabled()
  await expect.poll(zonePosition).not.toBe(draggedTransform)
  const arrangedTransform = await zonePosition()

  const graphBounds = await page.locator('.react-flow__node').evaluateAll((nodes) => {
    const bounds = nodes.map((node) => node.getBoundingClientRect())
    return {
      left: Math.min(...bounds.map((bound) => bound.left)),
      top: Math.min(...bounds.map((bound) => bound.top)),
      right: Math.max(...bounds.map((bound) => bound.right)),
      bottom: Math.max(...bounds.map((bound) => bound.bottom)),
    }
  })
  const canvasBounds = await page.locator('.react-flow').evaluate((canvas) => canvas.getBoundingClientRect())

  expect(graphBounds.left).toBeGreaterThanOrEqual(canvasBounds.left - 2)
  expect(graphBounds.top).toBeGreaterThanOrEqual(canvasBounds.top - 2)
  expect(graphBounds.right).toBeLessThanOrEqual(canvasBounds.right + 2)
  expect(graphBounds.bottom).toBeLessThanOrEqual(canvasBounds.bottom + 2)

  await page.getByRole('button', { name: '실행 취소' }).click()
  await expect.poll(zonePosition).toBe(draggedTransform)

  await page.getByRole('button', { name: '다시 실행' }).click()
  await expect.poll(zonePosition).toBe(arrangedTransform)
})
