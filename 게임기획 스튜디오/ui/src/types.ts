export type ToolStatus = 'ready' | 'prototype';
export type ToolAccent = 'cyan' | 'amber' | 'violet';

export interface ToolDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: string;
  status: ToolStatus;
  accent: ToolAccent;
  keywords: string[];
  workspace: {
    inputs: string[];
    outputs: string[];
  };
}

export interface ProjectSummary {
  id: string;
  name: string;
  path: string;
  updatedAt: string;
}

export interface ProjectTool {
  id: string;
  addedAt: string;
}

export interface ConnectionState {
  id: string;
  from: string;
  to: string;
  kind: string;
  status: 'connected' | 'stale' | 'error';
  createdAt: string;
}

export interface WorkspaceNodeState {
  id: string;
  toolId: string;
  x: number;
  y: number;
}

export interface WorkspaceViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface WorkspaceGraphState {
  nodes: WorkspaceNodeState[];
  viewport: WorkspaceViewportState;
}

export interface TabState {
  id: string;
  kind: 'project' | 'tool' | 'connections';
  title: string;
  toolId: string;
  artifactId: string;
  pinned: boolean;
}

export interface ProjectState {
  schemaVersion: number;
  id: string;
  name: string;
  root: string;
  createdAt: string;
  updatedAt: string;
  tools: ProjectTool[];
  graph: WorkspaceGraphState;
  connections: ConnectionState[];
  tabs: TabState[];
  activeTabId: string;
}

export interface StudioSnapshot {
  type: 'state:snapshot';
  version: string;
  defaultProjectDirectory: string;
  registry: {
    schemaVersion: number;
    lastProjectId: string | null;
    projects: ProjectSummary[];
  };
  availableTools: ToolDefinition[];
  activeProject: ProjectState | null;
}

export interface PublishedArtifactRecord {
  artifactId: string;
  toolId?: string;
  catalogId?: string;
  kind: string;
  title: string;
  revision?: string | number;
  fingerprint?: string;
  publishedAt?: string;
  summary?: string;
  data?: unknown;
}

export interface AiBudgetStatus {
  month: string;
  limit: number;
  spent: number;
  remaining: number;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number;
  pricing: { prompt?: string; completion?: string; request?: string };
}

export interface SavedPrompt {
  id: string;
  title: string;
  description: string;
  content: string;
  beginning: string;
  ending: string;
  negativePrompt: string;
  searchOptions: string;
  removeDuplicateTags: boolean;
  category: string;
  tags: string[];
  target: string;
  model: string;
  temperature: number;
  variableDefaults: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  usageCount: number;
}

export interface PromptLibrarySettings {
  copyOnUse: boolean;
  sortBy: 'lastUsed' | 'updated' | 'title';
  historyLimit: number;
}

export interface PromptLibraryState {
  schemaVersion: number;
  prompts: SavedPrompt[];
  settings: PromptLibrarySettings;
  updatedAt: string;
}

export interface PromptHistoryEntry {
  id: string;
  promptId: string;
  title: string;
  renderedText: string;
  usedAt: string;
}

export interface TableProjectRecord {
  readonly id: string;
  readonly name: string;
  readonly tableCount: number;
  readonly relationCount: number;
  readonly rowCount: number;
  readonly path: string;
  readonly serializedDocument: string;
  readonly linkedFile: {
    readonly path: string;
    readonly lastKnownModifiedAt: string;
    readonly checksum: string;
  };
}

export type StudioCommand =
  | { type: 'app:getState' }
  | { type: 'dialog:chooseFolder' }
  | { type: 'project:create'; name: string; parentDirectory: string }
  | { type: 'project:activate'; projectId: string }
  | { type: 'project:home' }
  | { type: 'tool:activate'; toolId: string }
  | { type: 'workspace:graphSave'; graph: WorkspaceGraphState; connections: ConnectionState[] }
  | { type: 'tab:select'; tabId: string }
  | { type: 'tab:close'; tabId: string }
  | { type: 'artifact:load'; requestId: string; toolId: string; artifactId: string }
  | { type: 'artifact:save'; requestId: string; toolId: string; artifactId: string; expectedRevision: number; force?: boolean; data: unknown }
  | { type: 'artifact:list'; requestId: string }
  | { type: 'artifact:publish'; requestId: string; toolId: string; record: PublishedArtifactRecord }
  | { type: 'ai:keyStatus'; requestId: string; monthlyLimit: number }
  | { type: 'ai:keySave'; requestId: string; key: string; monthlyLimit: number }
  | { type: 'ai:keyDelete'; requestId: string; monthlyLimit: number }
  | { type: 'ai:models'; requestId: string; monthlyLimit: number }
  | { type: 'ai:complete'; requestId: string; model: string; messages: Array<{ role: 'system' | 'user'; content: string }>; maxTokens: number; temperature: number; estimatedCost: number; perRequestLimit: number; monthlyLimit: number }
  | { type: 'prompt:getState'; requestId: string }
  | { type: 'prompt:save'; requestId: string; prompt: Partial<SavedPrompt> }
  | { type: 'prompt:delete'; requestId: string; promptId: string }
  | { type: 'prompt:updateSettings'; requestId: string; settings: Partial<PromptLibrarySettings> }
  | { type: 'prompt:use'; requestId: string; promptId: string; renderedText: string }
  | { type: 'prompt:clearHistory'; requestId: string }
  | { type: 'tableProject:list'; requestId: string }
  | { type: 'tableProject:write'; requestId: string; projectId: string; name: string; serializedDocument: string }
  | { type: 'tableProject:trash'; requestId: string; projectId: string }
  | { type: 'window:startDrag' }
  | { type: 'window:minimize' }
  | { type: 'window:toggleMaximize' }
  | { type: 'window:hide' }
  | { type: 'app:quit' };

export type HostMessage =
  | StudioSnapshot
  | { type: 'dialog:folderSelected'; path: string }
  | { type: 'artifact:data'; requestId: string; toolId: string; artifactId: string; found: boolean; revision: number; backupCount: number; path: string; savedAt?: string; data: unknown }
  | { type: 'artifact:saved'; requestId: string; toolId: string; artifactId: string; revision: number; backupCount: number; path: string; savedAt: string }
  | { type: 'artifact:conflict'; requestId: string; toolId: string; artifactId: string; expectedRevision: number; actualRevision: number; savedAt?: string; data: unknown }
  | { type: 'artifact:catalog'; requestId: string; records: PublishedArtifactRecord[] }
  | { type: 'ai:keyStatus'; requestId: string; configured: boolean; budget: AiBudgetStatus }
  | { type: 'ai:models'; requestId: string; models: OpenRouterModel[]; budget: AiBudgetStatus }
  | { type: 'ai:response'; requestId: string; result: unknown; charged: number; budget: AiBudgetStatus }
  | { type: 'ai:error'; requestId: string; message: string }
  | { type: 'prompt:state'; requestId: string; library: PromptLibraryState; history: PromptHistoryEntry[]; historyPersistence: 'process-memory' }
  | { type: 'tableProject:records'; requestId: string; records: TableProjectRecord[] }
  | { type: 'tableProject:written'; requestId: string; record: TableProjectRecord }
  | { type: 'tableProject:trashed'; requestId: string; projectId: string }
  | { type: 'app:error'; message: string };
