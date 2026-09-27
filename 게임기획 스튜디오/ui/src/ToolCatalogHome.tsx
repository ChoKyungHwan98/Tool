import { useState } from 'react';
import { Icon, toolIconName } from './icons';
import {
  availableToolCategories,
  filterToolCatalog,
  isWorkspaceConnectable,
  toolCategory,
  type ToolConnectionFilter,
} from './toolCatalog';
import type { StudioSnapshot } from './types';

const descriptions: Record<string, string> = {
  'table-designer': '게임 수치를 정리하고 검증합니다.',
  'pattern-designer': '전투 행동과 진행 흐름을 설계합니다.',
  'review-analytics': '이용자 평가를 모아 핵심 의견을 찾습니다.',
  'deck-designer': '분석 결과를 기획 문서로 만듭니다.',
  'prompt-library': '자주 쓰는 요청문을 만들고 보관합니다.',
};

const previews: Record<string, string> = {
  'table-designer': '/assets/table-designer-preview.svg',
  'review-analytics': '/assets/review-analytics-preview.svg',
};

function visibleCategoryName(category: string) {
  return category === 'AI·자동화' ? '인공지능·자동화' : category;
}

export function ToolCatalogHome({ snapshot, onTool }: { snapshot: StudioSnapshot; onTool: (toolId: string) => void }) {
  const [query, setQuery] = useState('');
  const [connectionFilter, setConnectionFilter] = useState<ToolConnectionFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const categories = availableToolCategories(snapshot.availableTools);
  const visibleTools = filterToolCatalog(snapshot.availableTools, { query, connection: connectionFilter, category: categoryFilter });

  const selectConnection = (next: ToolConnectionFilter) => {
    setConnectionFilter(next);
    if (next === 'all' || categoryFilter === 'all') return;
    const categoryRemains = snapshot.availableTools.some((tool) => (
      toolCategory(tool) === categoryFilter
      && (next === 'workspace' ? isWorkspaceConnectable(tool) : !isWorkspaceConnectable(tool))
    ));
    if (!categoryRemains) setCategoryFilter('all');
  };

  return (
    <div className="catalog-view all-tools-view">
      <header className="catalog-header">
        <h1>도구 보관함</h1>
        <input className="catalog-search-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="도구 검색" aria-label="도구 검색" />
      </header>

      <nav className="catalog-launcher-nav" aria-label="도구 분류">
        <div className="catalog-launcher-nav-inner">
          <button type="button" className={categoryFilter === 'all' ? 'is-active' : ''} aria-pressed={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>전체</button>
          {categories.map((category) => (
            <button key={category} type="button" className={categoryFilter === category ? 'is-active' : ''} aria-pressed={categoryFilter === category} onClick={() => setCategoryFilter(category)}>{visibleCategoryName(category)}</button>
          ))}
        </div>
      </nav>

      <section className="catalog-controls" aria-label="도구 검색 및 필터">
        <div className="catalog-filter-row">
          <span className="catalog-filter-label">사용 방식</span>
          <div className="catalog-segments" role="group" aria-label="연결 방식">
            {([['all', '전체'], ['workspace', '작업공간 연결 가능'], ['standalone', '독립 도구']] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={connectionFilter === value} onClick={() => selectConnection(value)}>{label}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="catalog-results" aria-live="polite">
        {visibleTools.length > 0 ? (
          <section className="catalog-group">
            <div className="catalog-tool-list">
              {visibleTools.map((tool) => {
                const preview = previews[tool.id];
                return (
                  <button key={tool.id} className="catalog-tool-row" onClick={() => onTool(tool.id)}>
                    <span className={`catalog-tool-cover catalog-tool-cover--${tool.id}${preview ? ' catalog-tool-cover--preview' : ''}`} aria-hidden="true">
                      {preview ? <img className="catalog-cover-preview" src={preview} alt="" /> : (
                        <>
                          <span className="catalog-cover-line catalog-cover-line--one" />
                          <span className="catalog-cover-line catalog-cover-line--two" />
                          <span className="catalog-cover-symbol"><Icon name={toolIconName(tool.id)} /></span>
                        </>
                      )}
                    </span>
                    <span className="catalog-tool-copy"><em>{visibleCategoryName(toolCategory(tool))}</em><strong>{tool.name}</strong><small>{descriptions[tool.id] ?? tool.description}</small></span>
                    <span className="catalog-tool-meta"><em>{isWorkspaceConnectable(tool) ? '작업공간 연결' : '독립 도구'}</em>{tool.status !== 'ready' && <small>개발 중</small>}</span>
                    <Icon className="row-arrow" name="arrow" />
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="catalog-empty">
            <Icon name="search" />
            <strong>조건에 맞는 도구가 없습니다</strong>
            <span>검색어나 필터를 바꿔 보세요.</span>
            <button type="button" onClick={() => { setQuery(''); setConnectionFilter('all'); setCategoryFilter('all'); }}>필터 초기화</button>
          </div>
        )}
      </section>
    </div>
  );
}
