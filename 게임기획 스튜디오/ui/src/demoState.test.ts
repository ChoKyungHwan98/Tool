import { describe, expect, it } from 'vitest';
import { createEmptySnapshot, createWorkspaceDemoSnapshot, reduceDemoState } from './demoState';

describe('studio demo state', () => {
  it('creates a persistent workspace shell', () => {
    const next = reduceDemoState(createEmptySnapshot(), {
      type: 'project:create',
      name: '전투 프로젝트',
      parentDirectory: 'C:\\Projects',
    });
    expect(next.activeProject?.name).toBe('전투 프로젝트');
    expect(next.activeProject?.tabs[0].id).toBe('project-home');
    expect(next.registry.projects).toHaveLength(1);
  });

  it('keeps tools independent when they are opened in a workspace', () => {
    let state = reduceDemoState(createEmptySnapshot(), {
      type: 'project:create', name: 'A', parentDirectory: 'C:\\Projects',
    });
    state = reduceDemoState(state, { type: 'tool:activate', toolId: 'table-designer' });
    state = reduceDemoState(state, { type: 'tool:activate', toolId: 'deck-designer' });
    expect(state.activeProject?.connections).toHaveLength(0);
    state = reduceDemoState(state, { type: 'tool:activate', toolId: 'pattern-designer' });
    expect(state.activeProject?.connections).toHaveLength(0);
  });

  it('stores a compatible table to pattern graph without connecting document tools', () => {
    let state = reduceDemoState(createEmptySnapshot(), {
      type: 'project:create', name: '던전 RPG', parentDirectory: 'C:\\Projects',
    });
    const now = new Date().toISOString();
    state = reduceDemoState(state, {
      type: 'workspace:graphSave',
      graph: {
        nodes: [
          { id: 'table-1', toolId: 'table-designer', x: 100, y: 120 },
          { id: 'pattern-1', toolId: 'pattern-designer', x: 460, y: 120 },
          { id: 'deck-1', toolId: 'deck-designer', x: 460, y: 330 },
        ],
        viewport: { x: 10, y: 20, zoom: 0.9 },
      },
      connections: [{ id: 'edge-1', from: 'table-1', to: 'pattern-1', kind: 'game-data', status: 'connected', createdAt: now }],
    });
    expect(state.activeProject?.graph.nodes).toHaveLength(3);
    expect(state.activeProject?.connections.map((edge) => edge.to)).toEqual(['pattern-1']);
    expect(state.activeProject?.tools.map((tool) => tool.id)).toEqual([
      'table-designer', 'pattern-designer', 'deck-designer',
    ]);
  });

  it('keeps the project home tab pinned when other tabs close', () => {
    let state = reduceDemoState(createEmptySnapshot(), {
      type: 'project:create', name: 'A', parentDirectory: 'C:\\Projects',
    });
    state = reduceDemoState(state, { type: 'tool:activate', toolId: 'table-designer' });
    state = reduceDemoState(state, { type: 'tab:close', tabId: 'table-designer:overview' });
    expect(state.activeProject?.activeTabId).toBe('project-home');
    expect(state.activeProject?.tabs.map((tab) => tab.id)).toEqual(['project-home']);
  });

  it('opens only the selected registered tool beside project home', () => {
    const state = createWorkspaceDemoSnapshot();
    expect(state.activeProject?.tabs.map((tab) => tab.id)).toEqual([
      'project-home',
      'table-designer:overview',
    ]);
    expect(state.activeProject?.activeTabId).toBe('project-home');
  });

});
