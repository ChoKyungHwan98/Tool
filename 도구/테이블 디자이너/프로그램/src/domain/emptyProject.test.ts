import { describe, expect, it } from 'vitest'
import { createEmptyProject } from './emptyProject'

describe('createEmptyProject', () => {
  it('사용자가 시작 방법을 고를 수 있는 빈 프로젝트를 만든다', () => {
    const project = createEmptyProject('My Game')

    expect(project.name).toBe('My Game')
    expect(project.tables).toEqual([])
    expect(project.layout.nodes).toEqual([])
  })
})
