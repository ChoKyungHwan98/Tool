import type { StudioCommand, StudioSnapshot, TabState } from './types';

const tools: StudioSnapshot['availableTools'] = [
  {
    id: 'table-designer', name: '테이블 디자이너', shortName: '테이블',
    description: '게임 데이터와 밸런스 수치를 구조화하고 검증합니다.',
    category: '데이터', status: 'ready', accent: 'cyan',
    keywords: ['테이블', '밸런스', '스키마', '엑셀', '데이터'],
    workspace: { inputs: [], outputs: ['game-data'] },
  },
  {
    id: 'pattern-designer', name: '패턴 디자이너', shortName: '패턴',
    description: 'FSM·HFSM·BT와 전투 행동 흐름을 설계합니다.',
    category: '전투', status: 'prototype', accent: 'amber',
    keywords: ['패턴', '전투', 'FSM', 'HFSM', 'BT', '보스'],
    workspace: { inputs: ['game-data'], outputs: [] },
  },
  {
    id: 'deck-designer', name: '기획서 디자이너', shortName: '기획서',
    description: '논리와 근거를 PPTX·Word 기획서로 구성합니다.',
    category: '문서', status: 'ready', accent: 'violet',
    keywords: ['기획서', 'PPT', 'PPTX', 'Word', '문서'],
    workspace: { inputs: [], outputs: [] },
  },
  {
    id: 'prompt-library', name: '프롬프트 빌더', shortName: '프롬프트',
    description: 'Prombot 방식으로 프롬프트를 조합하고 프리셋을 저장합니다.',
    category: '생산성', status: 'ready', accent: 'violet',
    keywords: ['프롬프트', 'Prompt', 'Prombot', '프리셋', '랜덤', '기록', 'AI', '복사'],
    workspace: { inputs: [], outputs: [] },
  },
];

export function createEmptySnapshot(): StudioSnapshot {
  return {
    type: 'state:snapshot',
    version: '0.1.0-preview',
    defaultProjectDirectory: 'C:\\Users\\Admin\\Documents\\GameDesignStudio\\Projects',
    registry: { schemaVersion: 1, lastProjectId: null, projects: [] },
    availableTools: tools,
    activeProject: null,
  };
}

export function createWorkspaceDemoSnapshot(): StudioSnapshot {
  let state = reduceDemoState(createEmptySnapshot(), {
    type: 'project:create',
    name: '보스 전투 리워크',
    parentDirectory: 'C:\\GameDesignStudio\\Projects',
  });
  state = reduceDemoState(state, { type: 'tool:activate', toolId: 'table-designer' });
  state = reduceDemoState(state, { type: 'project:home' });
  return state;
}

function toolTab(toolId: string, title: string): TabState {
  return {
    id: `${toolId}:overview`, kind: 'tool', title, toolId,
    artifactId: 'overview', pinned: false,
  };
}

export function reduceDemoState(state: StudioSnapshot, command: StudioCommand): StudioSnapshot {
  const now = new Date().toISOString();
  if (command.type === 'project:create') {
    const id = `demo-${Date.now()}`;
    const project = {
      schemaVersion: 2,
      id,
      name: command.name,
      root: `${command.parentDirectory}\\${command.name}`,
      createdAt: now,
      updatedAt: now,
      tools: [],
      graph: { nodes: [], viewport: { x: 0, y: 0, zoom: 1 } },
      connections: [],
      tabs: [{ id: 'project-home', kind: 'project' as const, title: '작업공간 홈', toolId: 'project', artifactId: 'home', pinned: true }],
      activeTabId: 'project-home',
    };
    return {
      ...state,
      registry: {
        ...state.registry,
        lastProjectId: id,
        projects: [{ id, name: command.name, path: `${project.root}\\project.gds.json`, updatedAt: now }, ...state.registry.projects],
      },
      activeProject: project,
    };
  }

  if (!state.activeProject) return state;
  const project = structuredClone(state.activeProject);

  if (command.type === 'tool:activate') {
    if (!project.tools.some((tool) => tool.id === command.toolId)) {
      project.tools.push({ id: command.toolId, addedAt: now });
    }
    const existingTab = [...project.tabs].reverse().find((item) => item.toolId === command.toolId);
    if (existingTab) {
      project.activeTabId = existingTab.id;
    } else {
      const definition = state.availableTools.find((tool) => tool.id === command.toolId);
      const tab = toolTab(command.toolId, definition?.shortName ?? command.toolId);
      project.tabs.push(tab);
      project.activeTabId = tab.id;
    }
  } else if (command.type === 'workspace:graphSave') {
    project.graph = structuredClone(command.graph);
    project.connections = structuredClone(command.connections);
    const addedAt = new Map(project.tools.map((tool) => [tool.id, tool.addedAt]));
    project.tools = [...new Set(command.graph.nodes.map((node) => node.toolId))]
      .map((id) => ({ id, addedAt: addedAt.get(id) ?? now }));
  } else if (command.type === 'project:home') {
    project.activeTabId = 'project-home';
  } else if (command.type === 'tab:select') {
    project.activeTabId = command.tabId;
  } else if (command.type === 'tab:close' && command.tabId !== 'project-home') {
    const index = project.tabs.findIndex((tab) => tab.id === command.tabId);
    project.tabs = project.tabs.filter((tab) => tab.id !== command.tabId);
    if (project.activeTabId === command.tabId) {
      project.activeTabId = project.tabs[Math.max(0, index - 1)]?.id ?? 'project-home';
    }
  }

  project.updatedAt = now;
  return { ...state, activeProject: project };
}
