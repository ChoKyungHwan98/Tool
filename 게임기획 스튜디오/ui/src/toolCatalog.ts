import type { ToolDefinition } from './types';

export type ToolConnectionFilter = 'all' | 'workspace' | 'standalone';

export interface ToolCatalogFilter {
  query: string;
  connection: ToolConnectionFilter;
  category: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  데이터: '데이터·밸런스',
  전투: '로직·전투',
  문서: '문서·발표',
  생산성: 'AI·자동화',
};

const CATEGORY_ORDER = ['데이터·밸런스', '로직·전투', '문서·발표', 'AI·자동화'];

export function toolCategory(tool: ToolDefinition) {
  return CATEGORY_LABELS[tool.category] ?? tool.category;
}

export function isWorkspaceConnectable(tool: ToolDefinition) {
  return tool.workspace.inputs.length > 0 || tool.workspace.outputs.length > 0;
}

export function toolConnectionLabel(tool: ToolDefinition) {
  return isWorkspaceConnectable(tool) ? '작업공간 연결 가능' : '독립 도구';
}

export function filterToolCatalog(tools: ToolDefinition[], filter: ToolCatalogFilter) {
  const query = filter.query.trim().toLocaleLowerCase('ko-KR');
  return tools.filter((tool) => {
    const connectable = isWorkspaceConnectable(tool);
    if (filter.connection === 'workspace' && !connectable) return false;
    if (filter.connection === 'standalone' && connectable) return false;
    if (filter.category !== 'all' && toolCategory(tool) !== filter.category) return false;
    if (!query) return true;
    return [
      tool.name,
      tool.shortName,
      tool.description,
      toolCategory(tool),
      toolConnectionLabel(tool),
      ...tool.keywords,
    ].some((value) => value.toLocaleLowerCase('ko-KR').includes(query));
  });
}

export function availableToolCategories(tools: ToolDefinition[]) {
  const categories = [...new Set(tools.map(toolCategory))];
  return categories.sort((left, right) => {
    const leftIndex = CATEGORY_ORDER.indexOf(left);
    const rightIndex = CATEGORY_ORDER.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right, 'ko-KR');
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

export function groupToolsByCategory(tools: ToolDefinition[]) {
  return availableToolCategories(tools).map((category) => ({
    category,
    tools: tools.filter((tool) => toolCategory(tool) === category),
  }));
}

export function splitToolsByConnection(tools: ToolDefinition[]) {
  return {
    workspace: tools.filter(isWorkspaceConnectable),
    standalone: tools.filter((tool) => !isWorkspaceConnectable(tool)),
  };
}
