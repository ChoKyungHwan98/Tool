import { useEffect, useRef, useState } from 'react';
import { studioBridge } from './bridge';
import { commandFromToolMessage, TOOL_BRIDGE_CHANNEL } from './toolBroker';
import { Icon, toolIconName, type IconName } from './icons';
import { PromptLibraryTool } from './PromptLibraryTool';
import {
  availableToolCategories,
  filterToolCatalog,
  groupToolsByCategory,
  isWorkspaceConnectable,
  toolCategory,
  toolConnectionLabel,
  type ToolConnectionFilter,
} from './toolCatalog';
import { WorkspaceGraph } from './WorkspaceGraph';
import type {
  HostMessage,
  ProjectState,
  StudioSnapshot,
  TabState,
  ToolDefinition,
} from './types';

function formatRecent(iso: string) {
  const date = new Date(iso);
  const elapsed = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(elapsed / 60_000));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(date);
}

function parentDirectory(path: string) {
  const separator = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  return separator > 0 ? path.slice(0, separator) : path;
}

function toolFor(snapshot: StudioSnapshot, id: string) {
  return snapshot.availableTools.find((tool) => tool.id === id);
}

function activeTabOf(project: ProjectState | null) {
  if (!project) return null;
  const visibleTabs = project.tabs.filter((tab) => tab.kind !== 'connections');
  return visibleTabs.find((tab) => tab.id === project.activeTabId) ?? visibleTabs[0] ?? null;
}

type StudioView = 'all-tools' | 'tool' | 'workspace-library' | 'workspace';

export function App() {
  const demoMode = new URLSearchParams(window.location.search).get('demo');
  const [snapshot, setSnapshot] = useState<StudioSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<StudioView>(
    demoMode === 'workspace'
      ? 'workspace'
      : demoMode === 'table' || demoMode === 'pattern' || demoMode === 'deck' || demoMode === 'prompt'
        ? 'tool'
        : 'all-tools',
  );
  const [standaloneToolId, setStandaloneToolId] = useState<string | null>(
    demoMode === 'table'
      ? 'table-designer'
      : demoMode === 'pattern'
        ? 'pattern-designer'
        : demoMode === 'deck'
          ? 'deck-designer'
          : demoMode === 'prompt'
            ? 'prompt-library'
          : null,
  );
  const toolRequestOwners = useRef(new Map<string, Window>());

  useEffect(() => {
    const unsubscribe = studioBridge.subscribe((message: HostMessage) => {
      if (message.type === 'state:snapshot') {
        setSnapshot(message);
        setError(null);
      } else if (message.type === 'app:error') {
        setError(message.message);
      } else if (
        message.type === 'artifact:data'
        || message.type === 'artifact:saved'
        || message.type === 'artifact:conflict'
        || message.type === 'artifact:catalog'
        || message.type === 'ai:keyStatus'
        || message.type === 'ai:models'
        || message.type === 'ai:response'
        || message.type === 'ai:error'
        || message.type === 'prompt:state'
        || message.type === 'tableProject:records'
        || message.type === 'tableProject:written'
        || message.type === 'tableProject:trashed'
      ) {
        const owner = toolRequestOwners.current.get(message.requestId);
        owner?.postMessage({ channel: TOOL_BRIDGE_CHANNEL, ...message }, window.location.origin);
        toolRequestOwners.current.delete(message.requestId);
      }
    });
    studioBridge.start();
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleToolMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !event.source) return;
      const frame = [...document.querySelectorAll<HTMLIFrameElement>('.embedded-tool-frame')]
        .find((candidate) => candidate.contentWindow === event.source);
      const toolId = frame?.dataset.toolId;
      if (!toolId) return;
      const command = commandFromToolMessage(event.data, toolId);
      if (!command) return;
      if ('requestId' in command) {
        toolRequestOwners.current.set(command.requestId, event.source as Window);
      }
      studioBridge.send(command);
    };
    window.addEventListener('message', handleToolMessage);
    return () => window.removeEventListener('message', handleToolMessage);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNewProjectOpen(false);
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!snapshot) {
    return (
      <div className="loading-screen">
        <div className="brand-mark brand-mark--large">G</div>
        <span>작업공간을 준비하고 있습니다</span>
      </div>
    );
  }

  const project = snapshot.activeProject;
  const activeTab = view === 'workspace' ? activeTabOf(project) : null;
  const canvasMode = view === 'workspace' && activeTab?.kind === 'project';
  const lightShell = canvasMode || view === 'all-tools' || view === 'tool' || view === 'workspace-library';
  const workspaceTool = activeTab ? toolFor(snapshot, activeTab.toolId) : undefined;
  const standaloneTool = standaloneToolId ? toolFor(snapshot, standaloneToolId) : undefined;

  const openAllTools = () => {
    setView('all-tools');
    setStandaloneToolId(null);
  };

  const openTool = (toolId: string) => {
    if (view === 'workspace' && project) {
      studioBridge.send({ type: 'tool:activate', toolId });
      return;
    }
    setStandaloneToolId(toolId);
    setView('tool');
  };

  const openWorkspaceLibrary = () => {
    setView('workspace-library');
    setStandaloneToolId(null);
  };

  const openWorkspace = (workspaceId: string) => {
    if (project?.id !== workspaceId) {
      studioBridge.send({ type: 'project:activate', projectId: workspaceId });
    }
    setView('workspace');
    setStandaloneToolId(null);
  };

  const goBack = () => {
    if (view === 'workspace') openWorkspaceLibrary();
    else openAllTools();
  };

  return (
    <div className={`studio-app ${lightShell ? 'studio-app--canvas-mode' : ''}`}>
      <TopBar canGoBack={view !== 'all-tools'} onBack={goBack} />

      <div className="workspace-shell">
        <ActivityRail
          view={view}
          settingsActive={settingsOpen}
          onAllTools={openAllTools}
          onWorkspaces={openWorkspaceLibrary}
          onSettings={() => setSettingsOpen(true)}
        />

        <section className="editor-region">
          {view === 'workspace' && project && (
            <TabBar project={project} snapshot={snapshot} activeTab={activeTab} />
          )}

          <div className="editor-content">
            {view === 'all-tools' ? (
              <AllToolsHome snapshot={snapshot} onTool={openTool} />
            ) : view === 'tool' && standaloneTool ? (
              <ToolWorkspace tool={standaloneTool} workspaceId="standalone" />
            ) : view === 'workspace-library' ? (
              <WorkspaceLibrary
                snapshot={snapshot}
                onNewWorkspace={() => setNewProjectOpen(true)}
                onOpenWorkspace={openWorkspace}
              />
            ) : view === 'workspace' && project ? (
              activeTab?.kind === 'tool' && workspaceTool
                ? <ToolWorkspace tool={workspaceTool} workspaceId={project.id} />
                : <WorkspaceGraph workspace={project} snapshot={snapshot} />
            ) : (
              <AllToolsHome snapshot={snapshot} onTool={openTool} />
            )}
          </div>
        </section>
      </div>

      {newProjectOpen && (
        <NewWorkspaceDialog
          defaultDirectory={snapshot.defaultProjectDirectory}
          onClose={() => setNewProjectOpen(false)}
          onCreated={() => {
            setNewProjectOpen(false);
            setView('workspace');
          }}
        />
      )}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {error && <ErrorToast message={error} onClose={() => setError(null)} />}
    </div>
  );
}

function TopBar({ canGoBack, onBack }: { canGoBack: boolean; onBack: () => void }) {
  return (
    <header className="top-bar">
      <button
        className="titlebar-back"
        disabled={!canGoBack}
        onClick={onBack}
        title="뒤로"
      >
        <Icon name="back" />
      </button>
      <div className="product-name">
        <span>게임기획 스튜디오</span>
      </div>
      <div
        className="titlebar-drag-region"
        onPointerDown={(event) => {
          if (event.button === 0) studioBridge.send({ type: 'window:startDrag' });
        }}
        aria-hidden="true"
      >
      </div>

      <div className="window-controls" aria-label="창 제어">
        <button onClick={() => studioBridge.send({ type: 'window:minimize' })} aria-label="최소화" title="최소화">
          <span className="window-control-minimize" />
        </button>
        <button onClick={() => studioBridge.send({ type: 'window:toggleMaximize' })} aria-label="최대화 또는 복원" title="최대화 또는 복원">
          <span className="window-control-maximize" />
        </button>
        <button className="window-control-close" onClick={() => studioBridge.send({ type: 'window:hide' })} aria-label="트레이로 숨기기" title="트레이로 숨기기">
          <span>×</span>
        </button>
      </div>
    </header>
  );
}

function ActivityRailItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`activity-rail-item ${active ? 'activity-rail-item--active' : ''}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      <Icon name={icon} />
      <span className="activity-rail-tooltip" role="tooltip">{label}</span>
    </button>
  );
}

function ActivityRail({
  view,
  settingsActive,
  onAllTools,
  onWorkspaces,
  onSettings,
}: {
  view: StudioView;
  settingsActive: boolean;
  onAllTools: () => void;
  onWorkspaces: () => void;
  onSettings: () => void;
}) {
  return (
    <nav className="activity-rail" aria-label="전역 탐색">
      <div className="activity-rail-primary">
        <ActivityRailItem
          icon="grid"
          label="모든 도구"
          active={!settingsActive && (view === 'all-tools' || view === 'tool')}
          onClick={onAllTools}
        />
        <ActivityRailItem
          icon="projects"
          label="작업공간"
          active={!settingsActive && (view === 'workspace-library' || view === 'workspace')}
          onClick={onWorkspaces}
        />
      </div>
      <div className="activity-rail-footer">
        <ActivityRailItem icon="settings" label="설정" active={settingsActive} onClick={onSettings} />
      </div>
    </nav>
  );
}

function TabBar({ project, snapshot, activeTab }: { project: ProjectState; snapshot: StudioSnapshot; activeTab: TabState | null }) {
  return (
    <div className="tab-bar">
      <div className="tab-scroll">
        {project.tabs.filter((tab) => tab.kind !== 'connections').map((tab) => {
          const tool = toolFor(snapshot, tab.toolId);
          return (
            <button
              key={tab.id}
              className={`workspace-tab ${activeTab?.id === tab.id ? 'workspace-tab--active' : ''}`}
              onClick={() => studioBridge.send({ type: 'tab:select', tabId: tab.id })}
            >
              <span className={`tab-icon tab-icon--${tool?.accent ?? 'neutral'}`}>
                <Icon name={tab.kind === 'project' ? 'home' : toolIconName(tab.toolId)} />
              </span>
              <span className="tab-title">{tab.kind === 'project' ? '작업공간 홈' : tab.title}</span>
              {!tab.pinned && (
                <span
                  className="tab-close"
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    studioBridge.send({ type: 'tab:close', tabId: tab.id });
                  }}
                ><Icon name="close" /></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AllToolsHome({ snapshot, onTool }: { snapshot: StudioSnapshot; onTool: (toolId: string) => void }) {
  const [query, setQuery] = useState('');
  const [connectionFilter, setConnectionFilter] = useState<ToolConnectionFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const categories = availableToolCategories(snapshot.availableTools);
  const visibleTools = filterToolCatalog(snapshot.availableTools, {
    query,
    connection: connectionFilter,
    category: categoryFilter,
  });
  const groupedTools = groupToolsByCategory(visibleTools);

  const selectConnection = (next: ToolConnectionFilter) => {
    setConnectionFilter(next);
    if (next !== 'all' && categoryFilter !== 'all') {
      const stillAvailable = snapshot.availableTools.some((tool) => (
        toolCategory(tool) === categoryFilter
        && (next === 'workspace' ? isWorkspaceConnectable(tool) : !isWorkspaceConnectable(tool))
      ));
      if (!stillAvailable) setCategoryFilter('all');
    }
  };

  return (
    <div className="catalog-view all-tools-view">
      <header className="catalog-header">
        <div className="catalog-title-block">
          <span className="catalog-kicker">게임기획 스튜디오 <em>v{snapshot.version}</em></span>
          <h1>도구 보관함</h1>
          <p>등록된 도구를 검색하고 바로 실행합니다.</p>
        </div>
        <span className="catalog-count">{visibleTools.length}<small> / {snapshot.availableTools.length}개</small></span>
      </header>

      <section className="catalog-controls" aria-label="도구 검색 및 필터">
        <label className="catalog-search">
          <Icon name="search" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름, 기능, 키워드로 검색"
            aria-label="도구 검색"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="검색어 지우기">
              <Icon name="close" />
            </button>
          )}
        </label>
        <div className="catalog-filter-row">
          <span className="catalog-filter-label">연결</span>
          <div className="catalog-segments" role="group" aria-label="연결 방식">
            {([
              ['all', '전체'],
              ['workspace', '작업공간 연결 가능'],
              ['standalone', '독립 도구'],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={connectionFilter === value} onClick={() => selectConnection(value)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="catalog-filter-row">
          <span className="catalog-filter-label">분류</span>
          <div className="catalog-segments catalog-segments--categories" role="group" aria-label="기능 분류">
            <button type="button" aria-pressed={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>전체</button>
            {categories.map((category) => (
              <button key={category} type="button" aria-pressed={categoryFilter === category} onClick={() => setCategoryFilter(category)}>{category}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="catalog-results" aria-live="polite">
        {groupedTools.length > 0 ? groupedTools.map((group) => (
          <section key={group.category} className="catalog-group">
            <header><h2>{group.category}</h2><span>{group.tools.length}</span></header>
            <div className="catalog-tool-list">
              {group.tools.map((tool) => (
                <button key={tool.id} className="catalog-tool-row" onClick={() => onTool(tool.id)}>
                  <span className={`catalog-tool-icon catalog-tool-icon--${tool.accent}`}><Icon name={toolIconName(tool.id)} /></span>
                  <span className="catalog-tool-copy"><strong>{tool.name}</strong><small>{tool.description}</small></span>
                  <span className="catalog-tool-meta">
                    <em>{toolConnectionLabel(tool)}</em>
                    <small>{tool.status === 'ready' ? '사용 가능' : '개발 중'}</small>
                  </span>
                  <Icon className="row-arrow" name="arrow" />
                </button>
              ))}
            </div>
          </section>
        )) : (
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

function WorkspaceLibrary({
  snapshot,
  onNewWorkspace,
  onOpenWorkspace,
}: {
  snapshot: StudioSnapshot;
  onNewWorkspace: () => void;
  onOpenWorkspace: (workspaceId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');
  const projects = [...snapshot.registry.projects]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .filter((project) => (
      !normalizedQuery
      || [project.name, project.path].some((value) => value.toLocaleLowerCase('ko-KR').includes(normalizedQuery))
    ));

  return (
    <div className="workspace-library-view">
      <header className="workspace-library-header">
        <div>
          <span className="catalog-kicker">도구 연결 작업</span>
          <h1>작업공간</h1>
          <p>연결 가능한 도구와 산출물을 한 화면에서 이어서 사용합니다.</p>
        </div>
        <button className="workspace-new-button" onClick={onNewWorkspace}><Icon name="plus" /> 새 작업공간</button>
      </header>

      <section className="workspace-library-section">
        <div className="workspace-library-section-head">
          <h2>최근 작업공간</h2>
          <span>{projects.length}개</span>
        </div>
        <label className="catalog-search workspace-search">
          <Icon name="search" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="작업공간 이름 또는 위치 검색" aria-label="작업공간 검색" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="검색어 지우기"><Icon name="close" /></button>}
        </label>
        {projects.length > 0 ? (
          <div className="workspace-library-list">
            {projects.map((project) => (
              <button key={project.id} className="workspace-library-row" onClick={() => onOpenWorkspace(project.id)}>
                <span className="workspace-library-icon"><Icon name="projects" /></span>
                <span className="workspace-library-copy"><strong>{project.name}</strong><small>{parentDirectory(project.path)}</small></span>
                <span className="workspace-library-time">{formatRecent(project.updatedAt)}</span>
                <Icon className="row-arrow" name="arrow" />
              </button>
            ))}
          </div>
        ) : (
          <div className="workspace-library-empty">
            <Icon name="projects" />
            <strong>{query ? '일치하는 작업공간이 없습니다' : '아직 작업공간이 없습니다'}</strong>
            <span>{query ? '다른 이름이나 위치로 검색해 보세요.' : '테이블과 패턴처럼 연결 가능한 도구를 함께 사용할 수 있습니다.'}</span>
            {!query && <button type="button" onClick={onNewWorkspace}><Icon name="plus" /> 첫 작업공간 만들기</button>}
          </div>
        )}
      </section>
    </div>
  );
}

function ToolWorkspace({ tool, workspaceId }: { tool: ToolDefinition; workspaceId: string }) {
  if (tool.id === 'prompt-library') return <PromptLibraryTool />;

  const embeddedTool = tool.id === 'table-designer'
    ? { source: `/tools/table/index.html?host=studio&workspaceId=${encodeURIComponent(workspaceId)}`, title: '테이블 디자이너' }
    : tool.id === 'pattern-designer'
      ? { source: `/tools/pattern/index.html?host=studio&workspaceId=${encodeURIComponent(workspaceId)}`, title: '패턴 디자이너' }
      : tool.id === 'deck-designer'
        ? { source: `/tools/deck/index.html?host=studio&workspaceId=${encodeURIComponent(workspaceId)}`, title: '기획서 디자이너' }
        : null;

  if (embeddedTool) {
    return (
      <div className="tool-host-surface tool-host-surface--embedded" data-tool-id={tool.id} aria-label={`${tool.name} 작업 영역`}>
        <iframe
          className="embedded-tool-frame"
          data-tool-id={tool.id}
          src={embeddedTool.source}
          title={embeddedTool.title}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    );
  }

  return (
    <div className="tool-host-surface" data-tool-id={tool.id} aria-label={`${tool.name} 작업 영역`}>
      <span className="visually-hidden">{tool.name} 이식 영역</span>
    </div>
  );
}

function NewWorkspaceDialog({ defaultDirectory, onClose, onCreated }: { defaultDirectory: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [directory, setDirectory] = useState(defaultDirectory);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const unsubscribe = studioBridge.subscribe((message) => {
      if (message.type === 'dialog:folderSelected') setDirectory(message.path);
    });
    return unsubscribe;
  }, []);

  const create = () => {
    if (!name.trim()) return;
    studioBridge.send({ type: 'project:create', name: name.trim(), parentDirectory: directory });
    onCreated();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="dialog new-project-dialog" role="dialog" aria-modal="true" aria-label="새 작업공간">
        <div className="dialog-header"><div className="dialog-symbol"><Icon name="projects" /></div><div><span className="section-kicker">여러 도구 함께 사용</span><h2>작업공간 만들기</h2></div><button className="icon-button" onClick={onClose}><Icon name="close" /></button></div>
        <div className="dialog-body">
          <label className="form-field"><span>작업공간 이름</span><input ref={inputRef} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && create()} placeholder="예: 보스 전투 포트폴리오" /></label>
          <label className="form-field"><span>저장 위치</span><div className="path-field"><input value={directory} onChange={(event) => setDirectory(event.target.value)} /><button onClick={() => studioBridge.send({ type: 'dialog:chooseFolder' })}><Icon name="folder" /> 선택</button></div><small>선택한 위치 아래에 작업공간 폴더를 만듭니다.</small></label>
          <div className="project-folder-preview"><Icon name="folder" /><span><strong>{name.trim() || '작업공간 이름'}</strong><small>여러 도구의 작업 참조와 열린 탭을 저장합니다.</small></span></div>
        </div>
        <div className="dialog-footer"><button className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" onClick={create} disabled={!name.trim()}><Icon name="plus" /> 작업공간 만들기</button></div>
      </div>
    </div>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="dialog settings-dialog" role="dialog" aria-modal="true" aria-label="설정">
        <div className="dialog-header"><div className="dialog-symbol"><Icon name="settings" /></div><div><span className="section-kicker">애플리케이션</span><h2>설정</h2></div><button className="icon-button" onClick={onClose}><Icon name="close" /></button></div>
        <div className="settings-list">
          <div className="settings-row"><span><strong>X 버튼 동작</strong><small>창을 닫아도 작업공간은 트레이에서 계속 실행됩니다.</small></span><em>트레이로 숨김</em></div>
          <div className="settings-row"><span><strong>작업공간 복원</strong><small>다시 실행하면 마지막 작업공간과 열린 탭을 복원합니다.</small></span><em>사용</em></div>
          <div className="settings-row"><span><strong>프롬프트 사용 기록</strong><small>트레이에 있는 동안만 유지됩니다. 완전 종료하면 지워지고, 저장 프롬프트와 설정은 남습니다.</small></span><em>세션 전용</em></div>
          <div className="settings-row"><span><strong>네트워크</strong><small>기본 작업공간은 API와 localhost 없이 동작합니다.</small></span><em>로컬 전용</em></div>
        </div>
        <div className="dialog-footer"><button className="danger-button" onClick={() => studioBridge.send({ type: 'app:quit' })}>완전 종료 · 세션 기록 삭제</button><button className="primary-button" onClick={onClose}>확인</button></div>
      </div>
    </div>
  );
}

function ErrorToast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="error-toast"><span className="error-toast-icon"><Icon name="warning" /></span><span><strong>작업을 완료하지 못했습니다</strong><small>{message}</small></span><button onClick={onClose}><Icon name="close" /></button></div>
  );
}
