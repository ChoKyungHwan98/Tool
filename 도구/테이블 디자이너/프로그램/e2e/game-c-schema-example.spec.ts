import { expect, test } from '@playwright/test'

test('게임 C 예제에서 단일 PK, 복합 PK, FK 관계를 전체 구조로 확인한다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '예제', exact: true }).click()
  await page.getByRole('button', { name: '게임 C PK/FK 예제' }).click()

  await expect(page.getByRole('heading', { name: '전체 구조' })).toBeVisible()
  await expect(page.getByText('6개 테이블 · 5개 관계')).toBeVisible()
  await expect(page.getByRole('button', { name: '자동 배치' })).toBeVisible()
  await expect(page.getByRole('button', { name: '전체 맞춤' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'PK FK MonsterId → Monster.MonsterId' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'PK FK ItemId → Item.ItemId' })).toHaveCount(2)
  await expect(page.getByText('복합 PK')).toHaveCount(2)
})
