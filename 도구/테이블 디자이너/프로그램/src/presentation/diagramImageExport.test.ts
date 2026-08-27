import { describe, expect, it } from 'vitest'
import {
  computeExportTransform,
  diagramImageFileName,
  exportCaptureFilter,
} from './diagramImageExport'

describe('diagramImageFileName', () => {
  it('프로젝트명-구조도-날짜.png 형식을 만든다', () => {
    expect(diagramImageFileName('게임 C', new Date(2026, 6, 19)))
      .toBe('게임 C-구조도-20260719.png')
  })

  it('파일명에 못 쓰는 문자는 _로 치환하고 빈 이름은 기본값을 쓴다', () => {
    expect(diagramImageFileName('a/b:c', new Date(2026, 0, 5)))
      .toBe('a_b_c-구조도-20260105.png')
    expect(diagramImageFileName('   ', new Date(2026, 0, 5)))
      .toBe('프로젝트-구조도-20260105.png')
  })
})

describe('exportCaptureFilter', () => {
  it('미니맵·컨트롤·배경·패널을 제외한다', () => {
    for (const className of ['react-flow__minimap', 'react-flow__controls', 'react-flow__background', 'react-flow__panel']) {
      const element = document.createElement('div')
      element.classList.add(className)
      expect(exportCaptureFilter(element)).toBe(false)
    }
  })

  it('일반 요소와 비요소 노드는 통과시킨다', () => {
    expect(exportCaptureFilter(document.createElement('div'))).toBe(true)
    expect(exportCaptureFilter(document.createTextNode('text'))).toBe(true)
  })
})

describe('computeExportTransform', () => {
  it('여백 48px을 더한 크기와 원점 이동 transform을 만든다', () => {
    const result = computeExportTransform({ x: 100, y: 200, width: 1000, height: 500 })
    expect(result.width).toBe(1096)
    expect(result.height).toBe(596)
    expect(result.pixelRatio).toBe(2)
    expect(result.transform).toBe('translate(-52px, -152px) scale(1)')
  })

  it('출력 최장변이 16000px을 넘으면 pixelRatio를 줄인다', () => {
    const result = computeExportTransform({ x: 0, y: 0, width: 12000, height: 3000 })
    expect(result.width * result.pixelRatio).toBeLessThanOrEqual(16_000)
    expect(result.pixelRatio).toBeGreaterThanOrEqual(1)
  })
})
