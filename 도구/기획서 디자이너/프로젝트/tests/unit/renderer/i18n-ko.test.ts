import { describe, expect, it } from 'vitest'
import { ko } from '../../../src/renderer/src/i18n/ko'

const flattenStrings = (value: unknown): string[] => {
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(flattenStrings)
}

describe('Korean interface locale', () => {
  it('uses Korean for the primary navigation and home entry points', () => {
    expect(ko.nav).toMatchObject({
      home: '홈',
      sessions: '작업',
      settings: '설정',
      newPresentation: '새 프레젠테이션'
    })
    expect(ko.thinking.homeTitle).toBe('프레젠테이션 시작')
    expect(ko.thinking.startQuickCreate).toBe('생성 시작')
    expect(ko.thinking.startExplore).toBe('대화 시작')
  })

  it('does not expose Chinese ideographs in the primary Korean surfaces', () => {
    const primaryStrings = flattenStrings({
      common: ko.common,
      nav: ko.nav,
      thinking: ko.thinking,
      settings: ko.settings,
      sessions: ko.sessions,
      templates: ko.templates,
      fonts: ko.fonts
    })
    expect(primaryStrings.join('\n')).not.toMatch(/[\u4E00-\u9FFF]/)
  })
})
