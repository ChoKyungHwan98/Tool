import { useEffect, useMemo, useRef, useState } from 'react';
import { studioBridge } from './bridge';
import { Icon, toolIconName } from './icons';
import { filterToolCatalog, splitToolsByConnection, toolCategory } from './toolCatalog';
import { layoutAsGrid, layoutByCategory, layoutByConnections } from './workspaceLayout';
import type {
  ConnectionState,
  ProjectState,
  StudioSnapshot,
  ToolDefinition,
  WorkspaceGraphState,
  WorkspaceNodeState,
  WorkspaceViewportState,
} from './types';

const NODE_WIDTH = 248;
const NODE_HEIGHT = 118;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2;

type Point = { x: number; y: number };
type CanvasMenu = 'tidy' | 'zoom' | 'appearance' | null;
type CanvasPattern = 'dots' | 'grid' | 'blank';

function readCanvasPreference<T extends string>(key: string, fallback: T): T {
  try {
    return (window.localStorage.getItem(key) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeCanvasPreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preferences are optional when storage is unavailable.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function connectionPath(from: Point, to: Point) {
  const bend = Math.max(72, Math.abs(to.x - from.x) * 0.48);
  return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
}

function toolById(snapshot: StudioSnapshot, toolId: string) {
  return snapshot.availableTools.find((tool) => tool.id === toolId);
}

function capabilityName(capability: string) {
  if (capability === 'game-data') return '게임 데이터';
  if (capability === 'review-insights') return '리뷰 인사이트';
  return capability;
}

function nodeRole(tool: ToolDefinition) {
  if (tool.workspace.outputs.length > 0 && tool.workspace.inputs.length > 0) return '입력·출력';
  if (tool.workspace.outputs.length > 0) return '데이터 제공';
  if (tool.workspace.inputs.length > 0) return '데이터 사용';
  return '독립 도구';
}

function uniqueId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function WorkspaceGraph({ workspace, snapshot }: { workspace: ProjectState; snapshot: StudioSnapshot }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const viewportTimer = useRef<number | null>(null);
  const layoutUndoRef = useRef<WorkspaceNodeState[] | null>(null);
  const [graph, setGraph] = useState<WorkspaceGraphState>(workspace.graph);
  const [connections, setConnections] = useState<ConnectionState[]>(workspace.connections);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [minimapVisible, setMinimapVisible] = useState(() => readCanvasPreference('gds:canvas:minimap', 'true') === 'true');
  const [edgesVisible, setEdgesVisible] = useState(() => readCanvasPreference('gds:canvas:edges', 'true') === 'true');
  const [canvasPattern, setCanvasPattern] = useState<CanvasPattern>(() => readCanvasPreference('gds:canvas:pattern', 'dots'));
  const [activeMenu, setActiveMenu] = useState<CanvasMenu>(null);
  const [panState, setPanState] = useState<null | { pointer: Point; viewport: WorkspaceViewportState }>(null);
  const [dragState, setDragState] = useState<null | { nodeId: string; pointer: Point; node: Point }>(null);
  const [pendingConnection, setPendingConnection] = useState<null | { fromNodeId: string; kind: string; cursor: Point }>(null);

  useEffect(() => {
    setGraph(workspace.graph);
    setConnections(workspace.connections);
  }, [workspace.id, workspace.updatedAt]);

  useEffect(() => {
    layoutUndoRef.current = null;
  }, [workspace.id]);

  useEffect(() => () => {
    if (viewportTimer.current !== null) window.clearTimeout(viewportTimer.current);
  }, []);

  useEffect(() => {
    if (!activeMenu) return undefined;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) setActiveMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveMenu(null);
    };
    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [activeMenu]);

  const nodeMap = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );

  const persist = (nextGraph: WorkspaceGraphState, nextConnections = connections) => {
    studioBridge.send({ type: 'workspace:graphSave', graph: nextGraph, connections: nextConnections });
  };

  const persistViewportSoon = (nextGraph: WorkspaceGraphState) => {
    if (viewportTimer.current !== null) window.clearTimeout(viewportTimer.current);
    viewportTimer.current = window.setTimeout(() => {
      persist(nextGraph);
      viewportTimer.current = null;
    }, 180);
  };

  const screenToWorld = (clientX: number, clientY: number): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - graph.viewport.x) / graph.viewport.zoom,
      y: (clientY - rect.top - graph.viewport.y) / graph.viewport.zoom,
    };
  };

  const addTool = (tool: ToolDefinition) => {
    if (graph.nodes.some((node) => node.toolId === tool.id)) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    const center = rect
      ? {
          x: (rect.width / 2 - graph.viewport.x) / graph.viewport.zoom - NODE_WIDTH / 2,
          y: (rect.height / 2 - graph.viewport.y) / graph.viewport.zoom - NODE_HEIGHT / 2,
        }
      : { x: 160, y: 120 };
    const column = graph.nodes.length % 2;
    const row = Math.floor(graph.nodes.length / 2);
    const node: WorkspaceNodeState = {
      id: uniqueId(tool.id), toolId: tool.id,
      x: Math.round(center.x + (column === 0 ? -168 : 168)),
      y: Math.round(center.y + row * 170),
    };
    const nextGraph = { ...graph, nodes: [...graph.nodes, node] };
    layoutUndoRef.current = null;
    setGraph(nextGraph);
    setSelectedNodeId(node.id);
    setSelectedConnectionId(null);
    setPaletteOpen(false);
    persist(nextGraph);
  };

  const removeSelection = () => {
    if (selectedNodeId) {
      const nextGraph = { ...graph, nodes: graph.nodes.filter((node) => node.id !== selectedNodeId) };
      const nextConnections = connections.filter((edge) => edge.from !== selectedNodeId && edge.to !== selectedNodeId);
      layoutUndoRef.current = null;
      setGraph(nextGraph);
      setConnections(nextConnections);
      setSelectedNodeId(null);
      persist(nextGraph, nextConnections);
      return;
    }
    if (selectedConnectionId) {
      const nextConnections = connections.filter((edge) => edge.id !== selectedConnectionId);
      setConnections(nextConnections);
      setSelectedConnectionId(null);
      persist(graph, nextConnections);
    }
  };

  const zoomAroundCenter = (zoom: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    const centerWorld = {
      x: (rect.width / 2 - graph.viewport.x) / graph.viewport.zoom,
      y: (rect.height / 2 - graph.viewport.y) / graph.viewport.zoom,
    };
    const viewport = {
      x: rect.width / 2 - centerWorld.x * nextZoom,
      y: rect.height / 2 - centerWorld.y * nextZoom,
      zoom: nextZoom,
    };
    const nextGraph = { ...graph, viewport };
    setGraph(nextGraph);
    persistViewportSoon(nextGraph);
  };

  const fitNodes = (nodes = graph.nodes) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (nodes.length === 0) {
      const nextGraph = { ...graph, viewport: { x: 0, y: 0, zoom: 1 } };
      setGraph(nextGraph);
      persist(nextGraph);
      return;
    }
    const minX = Math.min(...nodes.map((node) => node.x));
    const minY = Math.min(...nodes.map((node) => node.y));
    const maxX = Math.max(...nodes.map((node) => node.x + NODE_WIDTH));
    const maxY = Math.max(...nodes.map((node) => node.y + NODE_HEIGHT));
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const zoom = clamp(Math.min((rect.width - 180) / width, (rect.height - 180) / height), MIN_ZOOM, 1.2);
    const viewport = {
      x: (rect.width - width * zoom) / 2 - minX * zoom,
      y: (rect.height - height * zoom) / 2 - minY * zoom,
      zoom,
    };
    const nextGraph = { ...graph, nodes, viewport };
    setGraph(nextGraph);
    persist(nextGraph);
  };

  const applyLayout = (nodes: WorkspaceNodeState[]) => {
    if (nodes.length === 0) return;
    layoutUndoRef.current = graph.nodes.map((node) => ({ ...node }));
    const nextGraph = { ...graph, nodes };
    setGraph(nextGraph);
    persist(nextGraph);
    setActiveMenu(null);
    window.requestAnimationFrame(() => fitNodes(nodes));
  };

  const revertLayout = () => {
    if (!layoutUndoRef.current) return;
    const nodes = layoutUndoRef.current;
    layoutUndoRef.current = null;
    const nextGraph = { ...graph, nodes };
    setGraph(nextGraph);
    persist(nextGraph);
    setActiveMenu(null);
    window.requestAnimationFrame(() => fitNodes(nodes));
  };

  const toggleEdges = () => {
    setEdgesVisible((current) => {
      const next = !current;
      writeCanvasPreference('gds:canvas:edges', String(next));
      return next;
    });
  };

  const toggleMinimap = () => {
    setMinimapVisible((current) => {
      const next = !current;
      writeCanvasPreference('gds:canvas:minimap', String(next));
      return next;
    });
  };

  const selectCanvasPattern = (pattern: CanvasPattern) => {
    setCanvasPattern(pattern);
    writeCanvasPreference('gds:canvas:pattern', pattern);
    setActiveMenu(null);
  };

  const connectPendingTo = (toNodeId: string | undefined) => {
    if (!pendingConnection) return;
    if (toNodeId && toNodeId !== pendingConnection.fromNodeId) {
      const targetTool = toolById(snapshot, nodeMap.get(toNodeId)?.toolId ?? '');
      const compatible = targetTool?.workspace.inputs.includes(pendingConnection.kind);
      const duplicate = connections.some((edge) => (
        edge.from === pendingConnection.fromNodeId && edge.to === toNodeId && edge.kind === pendingConnection.kind
      ));
      if (compatible && !duplicate) {
        const nextConnections: ConnectionState[] = [...connections, {
          id: uniqueId('connection'), from: pendingConnection.fromNodeId, to: toNodeId,
          kind: pendingConnection.kind, status: 'connected', createdAt: new Date().toISOString(),
        }];
        setConnections(nextConnections);
        persist(graph, nextConnections);
      }
    }
    setPendingConnection(null);
  };

  const finishConnection = (event: PointerEvent) => {
    const input = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-input-node-id]');
    connectPendingTo(input?.dataset.inputNodeId);
  };

  useEffect(() => {
    if (!pendingConnection) return undefined;
    const move = (event: PointerEvent) => setPendingConnection((current) => current
      ? { ...current, cursor: screenToWorld(event.clientX, event.clientY) }
      : null);
    const up = (event: PointerEvent) => finishConnection(event);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  });

  const handleCanvasKeyDown = (event: React.KeyboardEvent) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') && !(event.target instanceof HTMLInputElement)) {
      event.preventDefault();
      removeSelection();
    }
    if (event.key === 'Escape') {
      setActiveMenu(null);
      setPaletteOpen(false);
      setPendingConnection(null);
      setSelectedConnectionId(null);
      setSelectedNodeId(null);
    }
  };

  const availableToAdd = snapshot.availableTools.filter((tool) => !graph.nodes.some((node) => node.toolId === tool.id));
  const paletteTools = filterToolCatalog(snapshot.availableTools, {
    query: paletteQuery,
    connection: 'all',
    category: 'all',
  });
  const paletteGroups = splitToolsByConnection(paletteTools);
  const viewportStyle = {
    transform: `translate(${graph.viewport.x}px, ${graph.viewport.y}px) scale(${graph.viewport.zoom})`,
  };
  const dotStyle = {
    backgroundPosition: `${graph.viewport.x}px ${graph.viewport.y}px`,
    backgroundSize: `${20 * graph.viewport.zoom}px ${20 * graph.viewport.zoom}px`,
  };

  return (
    <div
      ref={canvasRef}
      className={`workspace-graph workspace-graph--pattern-${canvasPattern} ${panState ? 'workspace-graph--panning' : ''}`}
      style={dotStyle}
      tabIndex={0}
      onKeyDown={handleCanvasKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0 || (event.target as HTMLElement).closest('.workspace-node, .graph-floating-control, .tool-palette')) return;
        setSelectedNodeId(null);
        setSelectedConnectionId(null);
        setPaletteOpen(false);
        setPanState({ pointer: { x: event.clientX, y: event.clientY }, viewport: graph.viewport });
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!panState) return;
        setGraph((current) => ({
          ...current,
          viewport: {
            ...current.viewport,
            x: panState.viewport.x + event.clientX - panState.pointer.x,
            y: panState.viewport.y + event.clientY - panState.pointer.y,
          },
        }));
      }}
      onPointerUp={(event) => {
        if (!panState) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        setPanState(null);
        persist(graph);
      }}
      onWheel={(event) => {
        event.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const world = screenToWorld(event.clientX, event.clientY);
        const zoom = clamp(graph.viewport.zoom * (event.deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM);
        const viewport = {
          x: event.clientX - rect.left - world.x * zoom,
          y: event.clientY - rect.top - world.y * zoom,
          zoom,
        };
        const nextGraph = { ...graph, viewport };
        setGraph(nextGraph);
        persistViewportSoon(nextGraph);
      }}
    >
      <div className="workspace-graph-heading graph-floating-control">
        <strong>{workspace.name}</strong>
        <span>{graph.nodes.length}개 도구 · {connections.length}개 연결</span>
      </div>

      <div ref={toolbarRef} className="workspace-graph-toolbar graph-floating-control" aria-label="캔버스 보기 제어">
        <div className="workspace-control-group workspace-control-menu-wrap">
          <button className={activeMenu === 'tidy' ? 'is-active' : ''} onClick={() => setActiveMenu((menu) => menu === 'tidy' ? null : 'tidy')} title="캔버스 정리" aria-label="캔버스 정리" aria-expanded={activeMenu === 'tidy'}><Icon name="layout" /></button>
          {activeMenu === 'tidy' && (
            <div className="workspace-control-menu workspace-control-menu--tidy" role="menu">
              <header>캔버스 정리</header>
              <button role="menuitem" onClick={() => applyLayout(layoutByConnections(graph.nodes, connections))}><Icon name="edges" /><span><strong>연결 관계로 정리</strong><small>상·하류 흐름을 왼쪽에서 오른쪽으로 배치</small></span></button>
              <button role="menuitem" onClick={() => applyLayout(layoutByCategory(graph.nodes, snapshot.availableTools))}><Icon name="grid" /><span><strong>도구 분류로 정리</strong><small>같은 업무 분류를 한 줄에 배치</small></span></button>
              <button role="menuitem" onClick={() => applyLayout(layoutAsGrid(graph.nodes, 3))}><Icon name="layout" /><span><strong>균등하게 정리</strong><small>노드를 3열 바둑판으로 정렬</small></span></button>
              <div className="workspace-control-menu-separator" />
              <button role="menuitem" disabled={!layoutUndoRef.current} onClick={revertLayout}><Icon name="undo" /><span><strong>정리 되돌리기</strong><small>정리 전 위치로 한 번 되돌립니다</small></span></button>
            </div>
          )}
        </div>
        <span />
        <div className="workspace-control-group workspace-control-menu-wrap">
          <button onClick={() => zoomAroundCenter(graph.viewport.zoom - 0.1)} aria-label="축소" disabled={graph.viewport.zoom <= MIN_ZOOM}>−</button>
          <button className={`workspace-graph-zoom ${activeMenu === 'zoom' ? 'is-active' : ''}`} onClick={() => setActiveMenu((menu) => menu === 'zoom' ? null : 'zoom')} aria-haspopup="menu" aria-expanded={activeMenu === 'zoom'}>{Math.round(graph.viewport.zoom * 100)}% <Icon name="chevron" /></button>
          <button onClick={() => zoomAroundCenter(graph.viewport.zoom + 0.1)} aria-label="확대" disabled={graph.viewport.zoom >= MAX_ZOOM}>＋</button>
          {activeMenu === 'zoom' && (
            <div className="workspace-control-menu workspace-control-menu--zoom" role="menu">
              <button role="menuitem" onClick={() => { fitNodes(); setActiveMenu(null); }}><Icon name="focus" /><span><strong>화면에 맞추기</strong><small>모든 노드를 한 화면에 표시</small></span></button>
              <div className="workspace-control-menu-separator" />
              {[50, 75, 100, 125, 150, 200].map((percent) => <button key={percent} role="menuitem" className={Math.round(graph.viewport.zoom * 100) === percent ? 'is-current' : ''} onClick={() => { zoomAroundCenter(percent / 100); setActiveMenu(null); }}><span><strong>{percent}%</strong></span>{Math.round(graph.viewport.zoom * 100) === percent && <Icon name="check" />}</button>)}
            </div>
          )}
        </div>
        <span />
        <div className="workspace-control-group workspace-control-menu-wrap">
          <button className={activeMenu === 'appearance' ? 'is-active' : ''} onClick={() => setActiveMenu((menu) => menu === 'appearance' ? null : 'appearance')} title="캔버스 표시" aria-label="캔버스 표시" aria-expanded={activeMenu === 'appearance'}><Icon name="grid" /></button>
          {activeMenu === 'appearance' && (
            <div className="workspace-control-menu workspace-control-menu--appearance" role="dialog" aria-label="캔버스 표시 설정">
              <header>캔버스 배경</header>
              <div className="workspace-pattern-options">
                {([['dots', '점'], ['grid', '격자'], ['blank', '없음']] as const).map(([pattern, label]) => <button key={pattern} className={canvasPattern === pattern ? 'is-current' : ''} onClick={() => selectCanvasPattern(pattern)}><span className={`workspace-pattern-swatch workspace-pattern-swatch--${pattern}`} />{label}</button>)}
              </div>
            </div>
          )}
          <button className={edgesVisible ? 'is-active' : ''} onClick={toggleEdges} title={edgesVisible ? '연결선 숨기기' : '연결선 표시'} aria-label={edgesVisible ? '연결선 숨기기' : '연결선 표시'} aria-pressed={edgesVisible}><Icon name="edges" /></button>
          <button className={`workspace-minimap-toggle ${minimapVisible ? 'is-active' : ''}`} onClick={toggleMinimap} title="미니맵" aria-label="미니맵" aria-pressed={minimapVisible}><Icon name="map" /><span>미니맵</span></button>
        </div>
      </div>

      {graph.nodes.length === 0 && (
        <div className="workspace-graph-empty">
          <strong>빈 작업공간입니다</strong>
          <span>아래의 + 버튼으로 첫 도구를 놓으세요.</span>
        </div>
      )}

      <div className="workspace-graph-world" style={viewportStyle}>
        {edgesVisible && <svg className="workspace-graph-wires" aria-hidden="true">
          {connections.map((edge) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return null;
            const path = connectionPath(
              { x: from.x + NODE_WIDTH, y: from.y + NODE_HEIGHT / 2 },
              { x: to.x, y: to.y + NODE_HEIGHT / 2 },
            );
            return (
              <g key={edge.id} className={selectedConnectionId === edge.id ? 'is-selected' : ''}>
                <path className="workspace-wire-hit" d={path} onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelectedConnectionId(edge.id);
                  setSelectedNodeId(null);
                }} />
                <path className="workspace-wire" d={path} />
                <text className="workspace-wire-label" x={(from.x + NODE_WIDTH + to.x) / 2} y={(from.y + to.y) / 2 + NODE_HEIGHT / 2 - 8}>
                  {capabilityName(edge.kind)}
                </text>
              </g>
            );
          })}
          {pendingConnection && (() => {
            const from = nodeMap.get(pendingConnection.fromNodeId);
            if (!from) return null;
            return <path className="workspace-wire workspace-wire--pending" d={connectionPath(
              { x: from.x + NODE_WIDTH, y: from.y + NODE_HEIGHT / 2 }, pendingConnection.cursor,
            )} />;
          })()}
        </svg>}

        {graph.nodes.map((node) => {
          const tool = toolById(snapshot, node.toolId);
          if (!tool) return null;
          const connectable = tool.workspace.inputs.length > 0 || tool.workspace.outputs.length > 0;
          return (
            <article
              key={node.id}
              className={`workspace-node workspace-node--${tool.accent} ${selectedNodeId === node.id ? 'is-selected' : ''}`}
              style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
              onPointerDown={(event) => {
                if (event.button !== 0 || (event.target as HTMLElement).closest('.workspace-node-port')) return;
                event.stopPropagation();
                canvasRef.current?.focus({ preventScroll: true });
                setSelectedNodeId(node.id);
                setSelectedConnectionId(null);
                setDragState({ nodeId: node.id, pointer: { x: event.clientX, y: event.clientY }, node: { x: node.x, y: node.y } });
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (!dragState || dragState.nodeId !== node.id) return;
                const dx = (event.clientX - dragState.pointer.x) / graph.viewport.zoom;
                const dy = (event.clientY - dragState.pointer.y) / graph.viewport.zoom;
                setGraph((current) => ({
                  ...current,
                  nodes: current.nodes.map((item) => item.id === node.id
                    ? { ...item, x: Math.round(dragState.node.x + dx), y: Math.round(dragState.node.y + dy) }
                    : item),
                }));
              }}
              onPointerUp={(event) => {
                if (!dragState || dragState.nodeId !== node.id) return;
                event.currentTarget.releasePointerCapture(event.pointerId);
                setDragState(null);
                layoutUndoRef.current = null;
                persist(graph);
              }}
              onDoubleClick={() => studioBridge.send({ type: 'tool:activate', toolId: tool.id })}
            >
              {tool.workspace.inputs.map((capability) => (
                <button
                  key={capability}
                  className={`workspace-node-port workspace-node-port--input ${pendingConnection ? (tool.workspace.inputs.includes(pendingConnection.kind) ? 'is-compatible' : 'is-incompatible') : ''}`}
                  data-input-node-id={node.id}
                  data-capability={capability}
                  title={`${capabilityName(capability)} 받기`}
                  aria-label={`${capabilityName(capability)} 받기`}
                  onPointerUp={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    connectPendingTo(node.id);
                  }}
                />
              ))}
              <div className="workspace-node-preview"><Icon name={toolIconName(tool.id)} /></div>
              <div className="workspace-node-copy">
                <span className="workspace-node-kind">{nodeRole(tool)}</span>
                <strong>{tool.name}</strong>
                <small>{tool.description}</small>
              </div>
              <span className={`workspace-node-status ${connectable ? 'is-connectable' : ''}`}>
                {connectable ? '연결 가능' : '독립 실행'}
              </span>
              {tool.workspace.outputs.map((capability) => (
                <button
                  key={capability}
                  className="workspace-node-port workspace-node-port--output"
                  data-capability={capability}
                  title={`${capabilityName(capability)} 연결`}
                  aria-label={`${capabilityName(capability)} 연결`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    canvasRef.current?.focus({ preventScroll: true });
                    setPendingConnection({ fromNodeId: node.id, kind: capability, cursor: screenToWorld(event.clientX, event.clientY) });
                  }}
                />
              ))}
            </article>
          );
        })}
      </div>

      {minimapVisible && graph.nodes.length > 0 && (
        <WorkspaceMinimap graph={graph} tools={snapshot.availableTools} />
      )}

      {paletteOpen && (
        <div className="tool-palette graph-floating-control">
          <div className="tool-palette-header">
            <div><strong>도구 추가</strong><span>작업공간에 놓을 도구를 선택하세요.</span></div>
            <button onClick={() => setPaletteOpen(false)} aria-label="닫기"><Icon name="close" /></button>
          </div>
          <label className="tool-palette-search">
            <Icon name="search" />
            <input value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} placeholder="도구 이름 또는 기능 검색" aria-label="추가할 도구 검색" />
            {paletteQuery && <button type="button" onClick={() => setPaletteQuery('')} aria-label="검색어 지우기"><Icon name="close" /></button>}
          </label>
          <div className="tool-palette-list">
            {([
              ['작업공간 연결 가능', paletteGroups.workspace],
              ['독립 도구', paletteGroups.standalone],
            ] as const).map(([label, tools]) => tools.length > 0 && (
              <section key={label} className="tool-palette-group">
                <header><strong>{label}</strong><span>{tools.length}</span></header>
                {tools.map((tool) => {
                  const added = !availableToAdd.some((item) => item.id === tool.id);
                  const connectable = tool.workspace.inputs.length > 0 || tool.workspace.outputs.length > 0;
                  return (
                    <button key={tool.id} disabled={added} onClick={() => addTool(tool)}>
                      <span className={`tool-palette-icon tool-palette-icon--${tool.accent}`}><Icon name={toolIconName(tool.id)} /></span>
                      <span><strong>{tool.name}</strong><small>{connectable ? `${nodeRole(tool)} · ${[...tool.workspace.inputs, ...tool.workspace.outputs].map(capabilityName).join(', ')}` : toolCategory(tool)}</small></span>
                      <em>{added ? '추가됨' : '추가'}</em>
                    </button>
                  );
                })}
              </section>
            ))}
            {paletteTools.length === 0 && <div className="tool-palette-empty">일치하는 도구가 없습니다.</div>}
          </div>
        </div>
      )}

      <div className="workspace-graph-bottom-bar graph-floating-control">
        <button className="workspace-graph-add" onClick={() => setPaletteOpen((value) => !value)} aria-label="도구 추가"><Icon name="plus" /></button>
        <span />
        <button className="is-active" aria-label="선택 도구"><Icon name="arrow" /></button>
        <small>노드를 더블클릭하면 도구가 탭으로 열립니다</small>
      </div>
    </div>
  );
}

function WorkspaceMinimap({ graph, tools }: { graph: WorkspaceGraphState; tools: ToolDefinition[] }) {
  const minX = Math.min(...graph.nodes.map((node) => node.x));
  const minY = Math.min(...graph.nodes.map((node) => node.y));
  const maxX = Math.max(...graph.nodes.map((node) => node.x + NODE_WIDTH));
  const maxY = Math.max(...graph.nodes.map((node) => node.y + NODE_HEIGHT));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const scale = Math.min(154 / width, 92 / height);
  return (
    <div className="workspace-minimap graph-floating-control" aria-label="작업공간 미니맵">
      {graph.nodes.map((node) => {
        const accent = tools.find((tool) => tool.id === node.toolId)?.accent ?? 'cyan';
        return <span key={node.id} className={`workspace-minimap-node workspace-minimap-node--${accent}`} style={{
          left: 8 + (node.x - minX) * scale,
          top: 8 + (node.y - minY) * scale,
          width: Math.max(14, NODE_WIDTH * scale),
          height: Math.max(7, NODE_HEIGHT * scale),
        }} />;
      })}
    </div>
  );
}
