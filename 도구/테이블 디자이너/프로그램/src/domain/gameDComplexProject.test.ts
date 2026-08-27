import { describe, expect, it } from 'vitest'
import { validateProject } from './validator'
import { gameDComplexProject } from './gameDComplexProject'

describe('게임 D 대규모 자동 배치 검증 예제', () => {
  it('25개 게임 테이블과 36개 유효한 FK를 제공한다', () => {
    expect(gameDComplexProject.tables).toHaveLength(25)
    expect(gameDComplexProject.relations).toHaveLength(36)
    expect(validateProject(gameDComplexProject).filter((issue) => issue.severity === 'error' || issue.severity === 'blocking')).toEqual([])
  })

  it('허브와 복합 PK 연결 테이블을 함께 포함한다', () => {
    const itemId = gameDComplexProject.tables.find((table) => table.name === 'Item')?.tableId
    const itemRelations = gameDComplexProject.relations.filter((relation) => (
      relation.sourceTableId === itemId || relation.targetTableId === itemId
    ))
    const junctionTables = gameDComplexProject.tables.filter((table) => table.primaryKey.columnIds.length > 1)

    expect(itemRelations.length).toBeGreaterThanOrEqual(8)
    expect(junctionTables.length).toBeGreaterThanOrEqual(7)
  })
})
