import { describe, expect, it } from 'vitest';
import { applyDynamicChoices, composePrompt, extractPromptVariables, filterAndSortPrompts, renderPrompt } from './promptLibrary';
import type { SavedPrompt } from './types';

const prompt = (id: string, title: string, updatedAt: string, lastUsedAt: string | null): SavedPrompt => ({
  id, title, description: '', content: `${title} {{대상}}`, category: '전투', tags: ['FSM'],
  beginning: '', ending: '', negativePrompt: '', searchOptions: '', removeDuplicateTags: true,
  target: 'ChatGPT', model: '', temperature: 0.2, variableDefaults: {},
  createdAt: updatedAt, updatedAt, lastUsedAt, usageCount: 0,
});

describe('prompt library helpers', () => {
  it('extracts unique variables and renders only supplied values', () => {
    expect(extractPromptVariables('{{대상}}과 {{ 조건 }} 그리고 {{대상}}')).toEqual(['대상', '조건']);
    expect(renderPrompt('{{대상}}의 {{조건}}을 분석', { 대상: '보스' })).toBe('보스의 {{조건}}을 분석');
  });

  it('searches prompt settings and sorts by most recently used', () => {
    const prompts = [
      prompt('a', '패턴 분석', '2026-01-01T00:00:00Z', '2026-01-03T00:00:00Z'),
      prompt('b', '밸런스 검토', '2026-01-02T00:00:00Z', null),
    ];
    expect(filterAndSortPrompts(prompts, 'FSM', 'lastUsed').map((item) => item.id)).toEqual(['a', 'b']);
    expect(filterAndSortPrompts(prompts, '밸런스', 'updated').map((item) => item.id)).toEqual(['b']);
  });

  it('ports Prombot-style dynamic choices and prompt composition locally', () => {
    expect(applyDynamicChoices('<Idle|Attack>', () => 0.99)).toBe('Attack');
    const result = composePrompt({
      beginning: 'best quality, {{대상}}',
      content: 'best quality, <Idle|Attack>, watermark',
      ending: 'highres',
      negativePrompt: 'watermark',
      searchOptions: 'boss, ~text',
      removeDuplicateTags: true,
      variableDefaults: { 대상: 'knight' },
    }, () => 0);
    expect(result.positiveText).toBe('best quality, knight, boss, Idle, highres');
    expect(result.negativeText).toBe('watermark');
    expect(result.excludedTags).toEqual(['text']);
  });
});
