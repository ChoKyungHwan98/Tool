import { createEmptySnapshot, createWorkspaceDemoSnapshot, reduceDemoState } from './demoState';
import type { HostMessage, StudioCommand, StudioSnapshot } from './types';

type Listener = (message: HostMessage) => void;

declare global {
  interface Window {
    chrome?: {
      webview?: {
        postMessage(message: StudioCommand): void;
        addEventListener(type: 'message', listener: (event: MessageEvent<HostMessage>) => void): void;
        removeEventListener(type: 'message', listener: (event: MessageEvent<HostMessage>) => void): void;
      };
    };
  }
}

const listeners = new Set<Listener>();
const demoArtifacts = new Map<string, { revision: number; data: unknown; savedAt: string }>();
let demoTableProjects: Extract<HostMessage, { type: 'tableProject:records' }>['records'] = [];
let demoCatalog: Extract<HostMessage, { type: 'artifact:catalog' }>['records'] = [];
let demoPromptLibrary: Extract<HostMessage, { type: 'prompt:state' }>['library'] = {
  schemaVersion: 1,
  prompts: [],
  settings: { copyOnUse: true, sortBy: 'lastUsed', historyLimit: 100 },
  updatedAt: new Date().toISOString(),
};
let demoPromptHistory: Extract<HostMessage, { type: 'prompt:state' }>['history'] = [];
const demoMode = new URLSearchParams(window.location.search).get('demo');
let demoState: StudioSnapshot = demoMode === 'workspace'
  ? createWorkspaceDemoSnapshot()
  : createEmptySnapshot();
let nativeListener: ((event: MessageEvent<HostMessage>) => void) | null = null;

function emit(message: HostMessage) {
  for (const listener of listeners) listener(message);
}

export const studioBridge = {
  start() {
    const native = window.chrome?.webview;
    if (native) {
      if (!nativeListener) {
        nativeListener = (event) => emit(event.data);
        native.addEventListener('message', nativeListener);
      }
      native.postMessage({ type: 'app:getState' });
      return;
    }
    queueMicrotask(() => emit(demoState));
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  send(command: StudioCommand) {
    const native = window.chrome?.webview;
    if (native) {
      native.postMessage(command);
      return;
    }

    if (command.type === 'dialog:chooseFolder') {
      emit({ type: 'dialog:folderSelected', path: demoState.defaultProjectDirectory });
      return;
    }
    if (command.type === 'artifact:load') {
      const key = `${command.toolId}:${command.artifactId}`;
      const artifact = demoArtifacts.get(key);
      emit({
        type: 'artifact:data', requestId: command.requestId, toolId: command.toolId,
        artifactId: command.artifactId, found: Boolean(artifact), revision: artifact?.revision ?? 0,
        backupCount: Math.max(0, (artifact?.revision ?? 1) - 1), path: `demo://${key}`,
        savedAt: artifact?.savedAt, data: artifact?.data ?? null,
      });
      return;
    }
    if (command.type === 'tableProject:list') {
      emit({ type: 'tableProject:records', requestId: command.requestId, records: demoTableProjects });
      return;
    }
    if (command.type === 'tableProject:write') {
      const parsed = JSON.parse(command.serializedDocument) as { schema?: { tables?: unknown[]; relations?: unknown[] }; rowsByTable?: Record<string, unknown[]> };
      const record = {
        id: command.projectId, name: command.name,
        tableCount: parsed.schema?.tables?.length ?? 0,
        relationCount: parsed.schema?.relations?.length ?? 0,
        rowCount: Object.values(parsed.rowsByTable ?? {}).reduce((sum, rows) => sum + rows.length, 0),
        path: `demo://${command.name}.gsw`, serializedDocument: command.serializedDocument,
        linkedFile: { path: `demo://${command.name}.gsw`, lastKnownModifiedAt: new Date().toISOString(), checksum: '' },
      };
      demoTableProjects = [record, ...demoTableProjects.filter((item) => item.id !== command.projectId)];
      emit({ type: 'tableProject:written', requestId: command.requestId, record });
      return;
    }
    if (command.type === 'tableProject:trash') {
      demoTableProjects = demoTableProjects.filter((item) => item.id !== command.projectId);
      emit({ type: 'tableProject:trashed', requestId: command.requestId, projectId: command.projectId });
      return;
    }
    if (command.type === 'artifact:save') {
      const key = `${command.toolId}:${command.artifactId}`;
      const current = demoArtifacts.get(key);
      const actualRevision = current?.revision ?? 0;
      if (!command.force && command.expectedRevision !== actualRevision) {
        emit({
          type: 'artifact:conflict', requestId: command.requestId, toolId: command.toolId,
          artifactId: command.artifactId, expectedRevision: command.expectedRevision,
          actualRevision, savedAt: current?.savedAt, data: current?.data ?? null,
        });
        return;
      }
      const savedAt = new Date().toISOString();
      const revision = actualRevision + 1;
      demoArtifacts.set(key, { revision, data: command.data, savedAt });
      emit({
        type: 'artifact:saved', requestId: command.requestId, toolId: command.toolId,
        artifactId: command.artifactId, revision, backupCount: Math.max(0, revision - 1),
        path: `demo://${key}`, savedAt,
      });
      return;
    }
    if (command.type === 'artifact:list') {
      emit({ type: 'artifact:catalog', requestId: command.requestId, records: demoCatalog });
      return;
    }
    if (command.type === 'artifact:publish') {
      const catalogId = `${command.toolId}:${command.record.artifactId}`;
      const record = {
        ...command.record, toolId: command.toolId, catalogId, publishedAt: new Date().toISOString(),
      };
      demoCatalog = [...demoCatalog.filter((item) => item.catalogId !== catalogId), record];
      emit({ type: 'artifact:catalog', requestId: command.requestId, records: demoCatalog });
      return;
    }
    if (command.type === 'ai:keyStatus' || command.type === 'ai:keyDelete') {
      emit({ type: 'ai:keyStatus', requestId: command.requestId, configured: false, budget: { month: 'demo', limit: command.monthlyLimit, spent: 0, remaining: command.monthlyLimit } });
      return;
    }
    if (command.type === 'ai:keySave') {
      emit({ type: 'ai:keyStatus', requestId: command.requestId, configured: true, budget: { month: 'demo', limit: command.monthlyLimit, spent: 0, remaining: command.monthlyLimit } });
      return;
    }
    if (command.type === 'ai:models') {
      emit({ type: 'ai:models', requestId: command.requestId, models: [], budget: { month: 'demo', limit: command.monthlyLimit, spent: 0, remaining: command.monthlyLimit } });
      return;
    }
    if (command.type === 'ai:complete') {
      emit({ type: 'ai:error', requestId: command.requestId, message: '데모 모드에서는 AI 요청을 보내지 않습니다.' });
      return;
    }
    if (command.type.startsWith('prompt:')) {
      const now = new Date().toISOString();
      if (command.type === 'prompt:save') {
        const existing = demoPromptLibrary.prompts.find((item) => item.id === command.prompt.id);
        const saved = {
          id: existing?.id ?? crypto.randomUUID(),
          title: command.prompt.title?.trim() || '이름 없는 프롬프트',
          description: command.prompt.description ?? '', content: command.prompt.content ?? '',
          category: command.prompt.category ?? '', tags: command.prompt.tags ?? [],
          beginning: command.prompt.beginning ?? '', ending: command.prompt.ending ?? '',
          negativePrompt: command.prompt.negativePrompt ?? '', searchOptions: command.prompt.searchOptions ?? '',
          removeDuplicateTags: command.prompt.removeDuplicateTags ?? true,
          target: command.prompt.target ?? '', model: command.prompt.model ?? '',
          temperature: command.prompt.temperature ?? 0.2,
          variableDefaults: command.prompt.variableDefaults ?? {},
          createdAt: existing?.createdAt ?? now, updatedAt: now,
          lastUsedAt: existing?.lastUsedAt ?? null, usageCount: existing?.usageCount ?? 0,
        };
        demoPromptLibrary = {
          ...demoPromptLibrary, updatedAt: now,
          prompts: [saved, ...demoPromptLibrary.prompts.filter((item) => item.id !== saved.id)],
        };
      } else if (command.type === 'prompt:delete') {
        demoPromptLibrary = { ...demoPromptLibrary, updatedAt: now, prompts: demoPromptLibrary.prompts.filter((item) => item.id !== command.promptId) };
      } else if (command.type === 'prompt:updateSettings') {
        demoPromptLibrary = { ...demoPromptLibrary, updatedAt: now, settings: { ...demoPromptLibrary.settings, ...command.settings } };
      } else if (command.type === 'prompt:use') {
        const current = demoPromptLibrary.prompts.find((item) => item.id === command.promptId);
        if (current) {
          demoPromptLibrary = {
            ...demoPromptLibrary, updatedAt: now,
            prompts: demoPromptLibrary.prompts.map((item) => item.id === current.id
              ? { ...item, lastUsedAt: now, usageCount: item.usageCount + 1 }
              : item),
          };
          demoPromptHistory = [{ id: crypto.randomUUID(), promptId: current.id, title: current.title, renderedText: command.renderedText, usedAt: now }, ...demoPromptHistory]
            .slice(0, demoPromptLibrary.settings.historyLimit);
        }
      } else if (command.type === 'prompt:clearHistory') {
        demoPromptHistory = [];
      }
      const requestId = 'requestId' in command ? command.requestId : '';
      emit({ type: 'prompt:state', requestId, library: demoPromptLibrary, history: demoPromptHistory, historyPersistence: 'process-memory' });
      return;
    }
    if (command.type.startsWith('window:') || command.type === 'app:quit') return;
    demoState = reduceDemoState(demoState, command);
    emit(demoState);
  },
};
