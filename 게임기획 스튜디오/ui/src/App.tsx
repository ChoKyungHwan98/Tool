import { useCallback, useEffect, useRef, useState } from 'react';
import { studioBridge } from './bridge';
import { commandFromToolMessage, TOOL_BRIDGE_CHANNEL } from './toolBroker';
import { Icon, toolIconName, type IconName } from './icons';
import { PromptLibraryTool } from './PromptLibraryTool';
import { ToolCatalogHome } from './ToolCatalogHome';
import { WorkspaceGraph } from './WorkspaceGraph';
import { ProjectLauncher } from './ProjectLauncher';
import { DownloadsPanel } from './components/DownloadsPanel';
import type {
  DownloadRecord,
  HostMessage,
  ProjectState,
  StudioSnapshot,
  TabState,
  ToolDefinition,
} from './types';

function toolFor(snapshot: StudioSnapshot, id: string) {
  return snapshot.availableTools.find((tool) => tool.id === id);
}

function activeTabOf(project: ProjectState | null) {
  if (!project) return null;
  const visibleTabs = project.tabs.filter((tab) => tab.kind !== 'connections');
  return visibleTabs.find((tab) => tab.id === project.activeTabId) ?? visibleTabs[0] ?? null;
}

type StudioView = 'all-tools' | 'tool' | 'workspace-library' | 'workspace';
const REVIEW_ANALYTICS_ORIGIN = 'http://127.0.0.1:8765';
const TOOL_NAVIGATION_CHANNEL = 'game-design-studio:tool-navigation';

export function App() {
  const demoMode = new URLSearchParams(window.location.search).get('demo');
  const [snapshot, setSnapshot] = useState<StudioSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [downloadsUnseen, setDownloadsUnseen] = useState(false);
  const closeDownloads = useCallback(() => setDownloadsOpen(false), []);
  const viewPast = useRef<StudioView[]>([]);
  const viewFuture = useRef<StudioView[]>([]);
  const viewPrevious = useRef<StudioView | null>(null);
  const viewJump = useRef(false);
  const [view, setView] = useState<StudioView>(
    demoMode === 'workspace'
      ? 'workspace'
      : demoMode === 'table' || demoMode === 'pattern' || demoMode === 'review' || demoMode === 'deck' || demoMode === 'prompt'
        ? 'tool'
        : 'all-tools',
  );
  // 스튜디오 화면 기록을 한 칸 옮긴다. 마우스 사이드 버튼과, 도구가 "더 갈 곳 없음"으로 넘긴 신호가 함께 쓴다.
  const stepView = (direction: 'back' | 'forward') => {
    const from = direction === 'back' ? viewPast : viewFuture;
    const to = direction === 'back' ? viewFuture : viewPast;
    const next = from.current.pop();
    if (next === undefined || viewPrevious.current === null) return;
    to.current.push(viewPrevious.current);
    viewJump.current = true;
    setView(next);
  };
  // 마우스 4번(뒤로)·5번 버튼(앞으로)으로 화면을 오간다.
  // 도구(iframe) 위에서 누른 버튼은 도구가 먼저 처리하고, 도구 안에 더 갈 곳이 없을 때만 'side-navigate'로 넘어온다.
  // 프로젝트 홈의 겹침 화면은 캡처 단계에서 먼저 소비하므로 여기까지 오지 않는다.
  useEffect(() => {
    if (viewPrevious.current === view) return;
    if (viewPrevious.current === null) { viewPrevious.current = view; return; }
    if (viewJump.current) viewJump.current = false;
    else { viewPast.current.push(viewPrevious.current); viewFuture.current = []; }
    viewPrevious.current = view;
  }, [view]);
  useEffect(() => {
    const swallow = (event: MouseEvent) => { if (event.button === 3 || event.button === 4) event.preventDefault(); };
    const navigate = (event: MouseEvent) => {
      if (event.button !== 3 && event.button !== 4) return;
      event.preventDefault();
      stepView(event.button === 3 ? 'back' : 'forward');
    };
    window.addEventListener('mousedown', swallow);
    window.addEventListener('auxclick', swallow);
    window.addEventListener('mouseup', navigate);
    return () => { window.removeEventListener('mousedown', swallow); window.removeEventListener('auxclick', swallow); window.removeEventListener('mouseup', navigate); };
  }, []);
  const [standaloneToolId, setStandaloneToolId] = useState<string | null>(
    demoMode === 'table'
      ? 'table-designer'
      : demoMode === 'pattern'
        ? 'pattern-designer'
        : demoMode === 'review'
          ? 'review-analytics'
        : demoMode === 'deck'
          ? 'deck-designer'
          : demoMode === 'prompt'
            ? 'prompt-library'
          : null,
  );
  const toolRequestOwners = useRef(new Map<string, { window: Window; origin: string }>());
  const toolBackRequests = useRef(new Map<string, { resolve: (handled: boolean) => void; timer: number }>());

  useEffect(() => {
    const unsubscribe = studioBridge.subscribe((message: HostMessage) => {
      if (message.type === 'state:snapshot') {
        setSnapshot(message);
        setError(null);
      } else if (message.type === 'downloads:list') {
        setDownloads((current) => {
          // 새로 끝난 다운로드가 있으면 아이콘에 점을 찍는다.
          const known = new Set(current.filter((item) => item.state === 'completed').map((item) => item.id));
          if (message.items.some((item) => item.state === 'completed' && !known.has(item.id)) && current.length > 0) setDownloadsUnseen(true);
          return message.items;
        });
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
        || message.type === 'tableChat:data'
        || message.type === 'tableChat:saved'
      ) {
        const owner = toolRequestOwners.current.get(message.requestId);
        owner?.window.postMessage({ channel: TOOL_BRIDGE_CHANNEL, ...message }, owner.origin);
        toolRequestOwners.current.delete(message.requestId);
      }
    });
    studioBridge.start();
    studioBridge.send({ type: 'downloads:list', requestId: crypto.randomUUID() });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleToolMessage = (event: MessageEvent) => {
      if (!event.source) return;
      const frame = [...document.querySelectorAll<HTMLIFrameElement>('.embedded-tool-frame')]
        .find((candidate) => candidate.contentWindow === event.source);
      const toolId = frame?.dataset.toolId;
      if (!toolId) return;
      const allowedOrigin = event.origin === window.location.origin
        || (toolId === 'review-analytics' && event.origin === REVIEW_ANALYTICS_ORIGIN);
      if (!allowedOrigin) return;
      if (event.data?.channel === TOOL_NAVIGATION_CHANNEL && event.data?.type === 'navigate-back:result') {
        const pending = toolBackRequests.current.get(event.data.requestId);
        if (!pending) return;
        window.clearTimeout(pending.timer);
        toolBackRequests.current.delete(event.data.requestId);
        pending.resolve(event.data.handled === true);
        return;
      }
      if (event.data?.channel === TOOL_NAVIGATION_CHANNEL && event.data?.type === 'side-navigate') {
        stepView(event.data.direction === 'forward' ? 'forward' : 'back');
        return;
      }
      const command = commandFromToolMessage(event.data, toolId);
      if (!command) return;
      if ('requestId' in command) {
        toolRequestOwners.current.set(command.requestId, { window: event.source as Window, origin: event.origin });
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

  const requestToolBack = (toolId: string) => {
    const frame = document.querySelector<HTMLIFrameElement>(`.embedded-tool-frame[data-tool-id="${toolId}"]`);
    if (!frame?.contentWindow) return Promise.resolve(false);
    const requestId = crypto.randomUUID();
    return new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => {
        toolBackRequests.current.delete(requestId);
        resolve(false);
      }, 350);
      toolBackRequests.current.set(requestId, { resolve, timer });
      // AI 리뷰데이터 분석은 자체 서버(다른 주소)에서 뜬다. 주소를 맞춰야 메시지가 전달된다.
      const targetOrigin = toolId === 'review-analytics' ? REVIEW_ANALYTICS_ORIGIN : window.location.origin;
      frame.contentWindow?.postMessage({ channel: TOOL_NAVIGATION_CHANNEL, type: 'navigate-back', requestId }, targetOrigin);
    });
  };

  const goBack = async () => {
    // 도구 안에 뒤로 갈 화면이 있으면 도구가 처리한다(도구 공통 계약: navigate-back → navigate-back:result).
    const openToolId = view === 'tool' ? standaloneToolId : view === 'workspace' ? workspaceTool?.id : null;
    if (openToolId && await requestToolBack(openToolId)) return;
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
          downloadsOpen={downloadsOpen}
          downloadsUnseen={downloadsUnseen}
          onDownloads={() => { setDownloadsOpen((open) => !open); setDownloadsUnseen(false); }}
        />

        <section className="editor-region">
          {view === 'workspace' && project && (
            <TabBar project={project} snapshot={snapshot} activeTab={activeTab} />
          )}

          <div className="editor-content">
            {view === 'all-tools' ? (
              <ToolCatalogHome snapshot={snapshot} onTool={openTool} />
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
              <ToolCatalogHome snapshot={snapshot} onTool={openTool} />
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
      {downloadsOpen && <DownloadsPanel items={downloads} onClose={closeDownloads} />}
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
        title="도구 보관함으로 돌아가기"
      >
        <Icon name="back" />
      </button>
      <div className="product-name product-name--empty" aria-hidden="true" />
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
  badge = false,
  onClick,
  ...rest
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  badge?: boolean;
  onClick: () => void;
  'data-downloads-toggle'?: boolean;
}) {
  return (
    <button
      {...rest}
      className={`activity-rail-item ${active ? 'activity-rail-item--active' : ''} ${badge ? 'activity-rail-item--badge' : ''}`}
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
  downloadsOpen,
  downloadsUnseen,
  onDownloads,
}: {
  view: StudioView;
  settingsActive: boolean;
  onAllTools: () => void;
  onWorkspaces: () => void;
  onSettings: () => void;
  downloadsOpen: boolean;
  downloadsUnseen: boolean;
  onDownloads: () => void;
}) {
  return (
    <nav className="activity-rail" aria-label="전역 탐색">
      <div className="activity-rail-primary">
        <ActivityRailItem
          icon="grid"
          label="도구 보관함"
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
        <ActivityRailItem icon="download" label="다운로드" active={downloadsOpen} badge={downloadsUnseen} onClick={onDownloads} data-downloads-toggle />
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
  const allProjects = [...snapshot.registry.projects]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const projects = allProjects.filter((project) => (
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
          <ProjectLauncher
            projects={allProjects}
            visibleProjectIds={new Set(projects.map((project) => project.id))}
            onOpen={onOpenWorkspace}
            onDelete={(projectId) => studioBridge.send({ type: 'project:trash', projectId })}
          />
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
      : tool.id === 'review-analytics'
        ? { source: `${REVIEW_ANALYTICS_ORIGIN}/?embedded=studio&ui=sidebar-geometry-v4&workspaceId=${encodeURIComponent(workspaceId)}`, title: 'AI 리뷰데이터 분석' }
      : tool.id === 'deck-designer'
        ? { source: `/tools/deck/index.html?host=studio&workspaceId=${encodeURIComponent(workspaceId)}`, title: 'PPT 디자이너' }
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
