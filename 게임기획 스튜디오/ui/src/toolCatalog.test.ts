import { describe, expect, it } from 'vitest';
import { createEmptySnapshot } from './demoState';
import {
  availableToolCategories,
  filterToolCatalog,
  splitToolsByConnection,
  toolCategory,
} from './toolCatalog';

describe('tool catalog', () => {
  const tools = createEmptySnapshot().availableTools;

  it('maps legacy registration categories to stable product categories', () => {
    expect(tools.map(toolCategory)).toEqual([
      '데이터·밸런스',
      '로직·전투',
      '데이터·밸런스',
      '문서·발표',
      'AI·자동화',
    ]);
    expect(availableToolCategories(tools)).toEqual([
      '데이터·밸런스',
      '로직·전투',
      '문서·발표',
      'AI·자동화',
    ]);
  });

  it('separates workspace-connectable and standalone tools', () => {
    const split = splitToolsByConnection(tools);
    expect(split.workspace.map((tool) => tool.id)).toEqual([
      'table-designer', 'pattern-designer', 'review-analytics', 'deck-designer',
    ]);
    expect(split.standalone.map((tool) => tool.id)).toEqual(['prompt-library']);
  });

  it('searches names, descriptions, keywords and product categories together', () => {
    expect(filterToolCatalog(tools, { query: 'FSM', connection: 'all', category: 'all' }).map((tool) => tool.id))
      .toEqual(['pattern-designer']);
    expect(filterToolCatalog(tools, { query: 'AI·자동화', connection: 'all', category: 'all' }).map((tool) => tool.id))
      .toEqual(['prompt-library']);
  });

  it('combines connection and category filters without duplicating tools', () => {
    const filtered = filterToolCatalog(tools, {
      query: '',
      connection: 'workspace',
      category: '문서·발표',
    });
    expect(filtered.map((tool) => tool.id)).toEqual(['deck-designer']);
  });
});
