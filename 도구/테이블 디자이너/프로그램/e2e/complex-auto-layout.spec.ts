import { expect, test } from '@playwright/test'
import { gameDComplexProject } from '../src/domain/gameDComplexProject'

test('복잡한 게임 스키마도 자동 배치가 종료되고 전체 구조를 화면에 맞춘다', async ({ page }) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '게임 D 자동 배치 검증' }).click()

  await expect(page.getByRole('heading', { name: '전체 구조' })).toBeVisible()
  await expect(page.locator('.react-flow__node')).toHaveCount(25)
  await expect(page.locator('.react-flow__edge')).toHaveCount(36)

  const initialOverlapCount = await page.locator('.react-flow__node').evaluateAll((nodes) => {
    const bounds = nodes.map((node) => node.getBoundingClientRect())
    let count = 0
    for (let left = 0; left < bounds.length; left += 1) {
      for (let right = left + 1; right < bounds.length; right += 1) {
        const a = bounds[left]!
        const b = bounds[right]!
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) count += 1
      }
    }
    return count
  })
  expect(initialOverlapCount).toBeGreaterThan(0)

  await page.getByRole('button', { name: '자동 배치' }).click()
  await expect(page.getByRole('button', { name: '자동 배치' })).toBeEnabled({ timeout: 12_000 })
  await expect(page.getByText('자동 배치에 실패했습니다.')).toHaveCount(0)
  await expect(page.getByText('배치 중', { exact: true })).toHaveCount(0)
  // 자동 배치는 ELK가 계산한 경로를 저장해 렌더하므로 모든 관계선이 elk-stored가 된다.
  await expect(page.locator('[data-route-kind="elk-stored"]')).toHaveCount(36)

  const targetPortOffsets = await page.locator('.column-handle.target.relation-handle').evaluateAll((handles) => (
    handles.map((handle) => {
      const bounds = handle.getBoundingClientRect()
      const row = handle.closest<HTMLElement>('.schema-node-column')
      if (!row) return Number.POSITIVE_INFINITY
      const rowBounds = row.getBoundingClientRect()
      return Math.abs(
        (bounds.top + bounds.height / 2)
        - (rowBounds.top + rowBounds.height / 2),
      )
    })
  ))
  expect(Math.max(...targetPortOffsets)).toBeLessThanOrEqual(10)

  const targetArrowOffsets = await page.locator('.react-flow__edge').evaluateAll((edges) => (
    edges.map((edge) => {
      const edgeId = (edge as HTMLElement).dataset.id ?? ''
      const path = edge.querySelector<SVGPathElement>('.react-flow__edge-path')
      const handle = document.querySelector<HTMLElement>(
        `[data-handleid="relation-target:${CSS.escape(edgeId)}"]`,
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
  ))
  expect(Math.max(...targetArrowOffsets)).toBeLessThan(8)

  const terminalApproaches = await page.locator('.react-flow__edge').evaluateAll((edges) => (
    edges.map((edge) => {
      const path = edge.querySelector<SVGPathElement>('.react-flow__edge-path')
      if (!path) return { horizontalDistance: 0, verticalOffset: Number.POSITIVE_INFINITY }
      const length = path.getTotalLength()
      const end = path.getPointAtLength(length)
      const before = path.getPointAtLength(Math.max(0, length - 12))
      return {
        horizontalDistance: Math.abs(end.x - before.x),
        verticalOffset: Math.abs(end.y - before.y),
      }
    })
  ))
  expect(Math.min(...terminalApproaches.map((approach) => approach.horizontalDistance))).toBeGreaterThan(8)
  expect(Math.max(...terminalApproaches.map((approach) => approach.verticalOffset))).toBeLessThanOrEqual(1)

  const layoutAudit = await page.locator('.react-flow').evaluate((canvas) => {
    const nodes = [...document.querySelectorAll<HTMLElement>('.react-flow__node')]
    const canvasBounds = canvas.getBoundingClientRect()
    const bounds = nodes.map((node) => ({ id: node.dataset.id ?? '', bounds: node.getBoundingClientRect() }))
    const overlaps: string[] = []

    for (let left = 0; left < bounds.length; left += 1) {
      for (let right = left + 1; right < bounds.length; right += 1) {
        const a = bounds[left]!
        const b = bounds[right]!
        if (a.bounds.left < b.bounds.right && a.bounds.right > b.bounds.left
          && a.bounds.top < b.bounds.bottom && a.bounds.bottom > b.bounds.top) {
          overlaps.push(`${a.id}:${b.id}`)
        }
      }
    }

    return {
      overlaps,
      outsideCanvas: bounds.filter(({ bounds: nodeBounds }) => (
        nodeBounds.left < canvasBounds.left - 2
        || nodeBounds.top < canvasBounds.top - 2
        || nodeBounds.right > canvasBounds.right + 2
        || nodeBounds.bottom > canvasBounds.bottom + 2
      )).map(({ id }) => id),
    }
  })

  expect(layoutAudit.overlaps).toEqual([])
  expect(layoutAudit.outsideCanvas).toEqual([])

  const relationEnds = Object.fromEntries(gameDComplexProject.relations.map((relation) => [
    relation.relationId,
    [relation.sourceTableId, relation.targetTableId],
  ]))
  const cardIntersections = await page.evaluate((ends) => {
    const nodes = [...document.querySelectorAll<HTMLElement>('.react-flow__node')]
    return [...document.querySelectorAll<SVGGElement>('.react-flow__edge')].flatMap((edge) => {
      const edgeId = edge.dataset.id ?? ''
      const path = edge.querySelector<SVGPathElement>('.react-flow__edge-path')
      const matrix = path?.getScreenCTM()
      const relationEnd = ends[edgeId]
      if (!path || !matrix || !relationEnd) return [`${edgeId}:missing-path`]

      const [sourceId, targetId] = relationEnd
      const length = path.getTotalLength()
      const step = Math.max(6, length / 400)
      return nodes.flatMap((node) => {
        if (node.dataset.id === sourceId || node.dataset.id === targetId) return []
        const bounds = node.getBoundingClientRect()
        for (let distance = step; distance < length - step; distance += step) {
          const point = path.getPointAtLength(distance).matrixTransform(matrix)
          if (point.x > bounds.left + 2 && point.x < bounds.right - 2
            && point.y > bounds.top + 2 && point.y < bounds.bottom - 2) {
            return [`${edgeId}:${node.dataset.id}`]
          }
        }
        return []
      })
    })
  }, relationEnds)

  expect(cardIntersections).toEqual([])
  expect(runtimeErrors).toEqual([])
  await page.screenshot({ path: 'design/screenshots/game-d-auto-layout-1280x720.png' })
})
