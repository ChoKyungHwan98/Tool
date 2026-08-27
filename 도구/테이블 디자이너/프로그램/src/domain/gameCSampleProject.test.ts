import { describe, expect, it } from 'vitest'
import { validateProjectWithRows } from './validator'
import { gameCSampleIds, gameCSampleProject, gameCSampleRows } from './gameCSampleProject'

describe('게임 C PK/FK 예제', () => {
  it('단일 PK, 복합 PK, 5개 FK를 유효한 게임 테이블 구조로 제공한다', () => {
    const dropTable = gameCSampleProject.tables.find((table) => table.tableId === gameCSampleIds.monsterDrop)

    expect(gameCSampleProject.tables).toHaveLength(6)
    expect(gameCSampleProject.relations).toHaveLength(5)
    expect(dropTable?.columns[0]?.columnId).toBe(gameCSampleIds.dropOrder)
    expect(dropTable?.primaryKey.columnIds).toEqual([
      gameCSampleIds.dropMonsterId,
      gameCSampleIds.dropItemId,
    ])

    const blockingIssues = validateProjectWithRows(gameCSampleProject, gameCSampleRows)
      .filter((issue) => issue.severity === 'blocking' || issue.severity === 'error')
    expect(blockingIssues).toEqual([])
  })
})
