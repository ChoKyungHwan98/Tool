import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import type { ProjectSummary } from './types';

type ProjectEntry = { kind: 'project'; id: string };
type ProjectFolder = { kind: 'folder'; id: string; name: string; projectIds: string[] };
export type ProjectLauncherEntry = ProjectEntry | ProjectFolder;

const STORAGE_KEY = 'game-design-studio:project-launcher-layout:v1';
const LONG_PRESS_MS = 480;
const MOVE_THRESHOLD = 8;

const keyOf = (entry: ProjectLauncherEntry) => `${entry.kind}:${entry.id}`;

export function reconcileProjectLayout(stored: ProjectLauncherEntry[], projectIds: string[]) {
  const available = new Set(projectIds);
  const claimed = new Set<string>();
  const result: ProjectLauncherEntry[] = [];
  for (const entry of stored) {
    if (entry.kind === 'project') {
      if (available.has(entry.id) && !claimed.has(entry.id)) {
        result.push(entry);
        claimed.add(entry.id);
      }
      continue;
    }
    const ids = entry.projectIds.filter((id) => available.has(id) && !claimed.has(id));
    ids.forEach((id) => claimed.add(id));
    if (ids.length > 1) result.push({ ...entry, projectIds: ids });
    else if (ids.length === 1) result.push({ kind: 'project', id: ids[0] });
  }
  projectIds.filter((id) => !claimed.has(id)).forEach((id) => result.push({ kind: 'project', id }));
  return result;
}

function moveEntry(entries: ProjectLauncherEntry[], sourceKey: string, targetKey: string, after: boolean) {
  const sourceIndex = entries.findIndex((entry) => keyOf(entry) === sourceKey);
  const targetIndex = entries.findIndex((entry) => keyOf(entry) === targetKey);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return entries;
  const next = [...entries];
  const [source] = next.splice(sourceIndex, 1);
  const adjusted = next.findIndex((entry) => keyOf(entry) === targetKey);
  next.splice(adjusted + (after ? 1 : 0), 0, source);
  return next;
}

// 폴더는 다른 항목과 합쳐지지 않는다. 폴더를 끌면 언제나 순서만 바뀐다.
export function canCombineProjectEntries(source: ProjectLauncherEntry | undefined, target: ProjectLauncherEntry | undefined) {
  if (!source || !target || keyOf(source) === keyOf(target)) return false;
  return source.kind === 'project';
}

// 프로젝트 하나를 폴더 밖으로 빼 홈 그리드 끝에 되돌린다.
// 남은 것이 하나뿐이면 폴더를 유지할 이유가 없으므로 폴더도 함께 푼다.
export function removeProjectFromFolder(entries: ProjectLauncherEntry[], folderId: string, projectId: string): ProjectLauncherEntry[] {
  const target = entries.find((entry): entry is ProjectFolder => entry.kind === 'folder' && entry.id === folderId);
  if (!target || !target.projectIds.includes(projectId)) return entries;
  const remaining = target.projectIds.filter((id) => id !== projectId);
  const replacement: ProjectLauncherEntry[] = remaining.length > 1
    ? [{ ...target, projectIds: remaining }]
    : remaining.map((id): ProjectLauncherEntry => ({ kind: 'project', id }));
  return entries.flatMap((entry) => entry.kind === 'folder' && entry.id === folderId ? replacement : [entry]).concat({ kind: 'project', id: projectId });
}

// 폴더만 없애고 안에 있던 프로젝트는 홈 그리드로 되돌린다. 프로젝트는 지우지 않는다.
export function dissolveProjectFolder(entries: ProjectLauncherEntry[], folderId: string) {
  return entries.flatMap((entry) => entry.kind === 'folder' && entry.id === folderId
    ? entry.projectIds.map((id): ProjectLauncherEntry => ({ kind: 'project', id }))
    : [entry]);
}

export function dropProjectEntry(entries: ProjectLauncherEntry[], sourceKey: string, targetKey: string, combine: boolean, after = false) {
  const source = entries.find((entry) => keyOf(entry) === sourceKey);
  const target = entries.find((entry) => keyOf(entry) === targetKey);
  if (!source || !target || sourceKey === targetKey) return entries;
  if (!combine || !canCombineProjectEntries(source, target)) return moveEntry(entries, sourceKey, targetKey, after);
  if (target.kind === 'folder') {
    return entries.filter((entry) => keyOf(entry) !== sourceKey).map((entry) => keyOf(entry) === targetKey
      ? { ...target, projectIds: [...target.projectIds, source.id] }
      : entry);
  }
  const folder: ProjectFolder = { kind: 'folder', id: crypto.randomUUID(), name: '새 폴더', projectIds: [target.id, source.id] };
  return entries.filter((entry) => keyOf(entry) !== sourceKey).map((entry) => keyOf(entry) === targetKey ? folder : entry);
}

function loadLayout(projectIds: string[]) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as ProjectLauncherEntry[];
    return reconcileProjectLayout(Array.isArray(stored) ? stored : [], projectIds);
  } catch {
    return reconcileProjectLayout([], projectIds);
  }
}

function formatRecent(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
}

export function ProjectLauncher({ projects, visibleProjectIds, onOpen, onDelete }: { projects: ProjectSummary[]; visibleProjectIds: Set<string>; onOpen: (projectId: string) => void; onDelete: (projectId: string) => void }) {
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const [entries, setEntries] = useState<ProjectLauncherEntry[]>(() => loadLayout(projects.map((project) => project.id)));
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState<{ key: string; x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ key: string; combine: boolean; after: boolean } | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [context, setContext] = useState<{ kind: 'project' | 'folder'; id: string; x: number; y: number; folderId?: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const press = useRef<{ key: string; pointerId: number; x: number; y: number; timer: number; long: boolean } | null>(null);
  const dropTargetRef = useRef<{ key: string; combine: boolean; after: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => setEntries((current) => reconcileProjectLayout(current, projects.map((project) => project.id))), [projects]);
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)), [entries]);
  useEffect(() => {
    if (!context) return;
    const close = () => setContext(null);
    window.addEventListener('pointerdown', close, { once: true });
    return () => window.removeEventListener('pointerdown', close);
  }, [context]);

  useEffect(() => {
    const consume = (event: MouseEvent) => {
      if (event.button !== 3) return;
      const closed = context !== null || confirmDeleteId !== null || folderId !== null || editing;
      if (!closed) return;
      event.preventDefault();
      event.stopPropagation();
      if (context !== null) return setContext(null);
      if (confirmDeleteId !== null) return setConfirmDeleteId(null);
      if (folderId !== null) return setFolderId(null);
      setEditing(false);
    };
    window.addEventListener('mouseup', consume, true);
    return () => window.removeEventListener('mouseup', consume, true);
  }, [context, confirmDeleteId, folderId, editing]);

  const folder = entries.find((entry): entry is ProjectFolder => entry.kind === 'folder' && entry.id === folderId) ?? null;
  const projectToDelete = confirmDeleteId ? projectMap.get(confirmDeleteId) : null;
  const visibleEntries = entries.filter((entry) => entry.kind === 'project'
    ? visibleProjectIds.has(entry.id)
    : entry.projectIds.some((id) => visibleProjectIds.has(id)));

  const openContext = (kind: 'project' | 'folder', id: string, x: number, y: number, folderId?: string) => {
    press.current = null;
    setContext(folderId === undefined ? { kind, id, x, y } : { kind, id, x, y, folderId });
  };

  const pointerDown = (event: React.PointerEvent<HTMLElement>, key: string, kind: 'project' | 'folder', id: string) => {
    // WebView2는 기본 컨텍스트 메뉴를 끄므로 contextmenu와 오른쪽 버튼 pointerdown 양쪽에서 연다.
    if (event.button === 2) { event.stopPropagation(); openContext(kind, id, event.clientX, event.clientY); return; }
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const timer = window.setTimeout(() => {
      if (!press.current || press.current.key !== key) return;
      press.current.long = true;
      suppressClick.current = true;
      setEditing(true);
      setDragging({ key, x: event.clientX, y: event.clientY });
    }, editing ? 0 : LONG_PRESS_MS);
    press.current = { key, pointerId: event.pointerId, x: event.clientX, y: event.clientY, timer, long: false };
  };

  const pointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const current = press.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.long && Math.hypot(event.clientX - current.x, event.clientY - current.y) > MOVE_THRESHOLD) {
      window.clearTimeout(current.timer);
      press.current = null;
      return;
    }
    if (!current.long) return;
    setDragging({ key: current.key, x: event.clientX, y: event.clientY });
    const target = document.elementsFromPoint(event.clientX, event.clientY).find((item) => item instanceof HTMLElement && item.dataset.projectLauncherKey && item.dataset.projectLauncherKey !== current.key) as HTMLElement | undefined;
    if (!target?.dataset.projectLauncherKey) {
      dropTargetRef.current = null;
      return setDropTarget(null);
    }
    const rect = target.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const combinable = canCombineProjectEntries(
      entries.find((entry) => keyOf(entry) === current.key),
      entries.find((entry) => keyOf(entry) === target.dataset.projectLauncherKey),
    );
    const nextTarget = { key: target.dataset.projectLauncherKey, combine: combinable && x > .27 && x < .73 && y > .2 && y < .8, after: x >= .5 };
    dropTargetRef.current = nextTarget;
    setDropTarget(nextTarget);
  };

  const pointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const current = press.current;
    if (!current || current.pointerId !== event.pointerId) return;
    window.clearTimeout(current.timer);
    const target = dropTargetRef.current;
    if (current.long && target) setEntries((value) => dropProjectEntry(value, current.key, target.key, target.combine, target.after));
    press.current = null;
    setDragging(null);
    setDropTarget(null);
    dropTargetRef.current = null;
    if (current.long) window.setTimeout(() => { suppressClick.current = false; }, 0);
  };

  const clickEntry = (entry: ProjectLauncherEntry) => {
    if (suppressClick.current) return void (suppressClick.current = false);
    if (editing) return;
    if (entry.kind === 'project') onOpen(entry.id);
    else setFolderId(entry.id);
  };

  const takeOutOfFolder = (currentFolderId: string, projectId: string) => {
    setEntries((current) => removeProjectFromFolder(current, currentFolderId, projectId));
  };

  const renderEntry = (entry: ProjectLauncherEntry) => {
    const key = keyOf(entry);
    const targetClass = dropTarget?.key === key ? dropTarget.combine ? ' is-folder-target' : ' is-move-target' : '';
    if (entry.kind === 'folder') {
      const contents = entry.projectIds.map((id) => projectMap.get(id)).filter(Boolean) as ProjectSummary[];
      return <button key={key} type="button" data-project-launcher-key={key} className={`project-launcher-item project-folder${targetClass}${dragging?.key === key ? ' is-dragging' : ''}`} onContextMenu={(event) => { event.preventDefault(); openContext('folder', entry.id, event.clientX, event.clientY); }} onPointerDown={(event) => pointerDown(event, key, 'folder', entry.id)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onClick={() => clickEntry(entry)}>
        <span className="project-folder-preview">{contents.slice(0, 4).map((project) => <i key={project.id}><Icon name="projects" /></i>)}</span>
        <span><strong>{entry.name}</strong><small>{contents.length}개 프로젝트</small></span>
      </button>;
    }
    const project = projectMap.get(entry.id);
    if (!project) return null;
    return <button key={key} type="button" data-project-launcher-key={key} className={`project-launcher-item${targetClass}${dragging?.key === key ? ' is-dragging' : ''}`} onContextMenu={(event) => { event.preventDefault(); openContext('project', project.id, event.clientX, event.clientY); }} onPointerDown={(event) => pointerDown(event, key, 'project', project.id)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onClick={() => clickEntry(entry)}>
      <span className="workspace-library-icon"><Icon name="projects" /></span>
      <span className="workspace-library-copy"><strong>{project.name}</strong><small>{project.path}</small></span>
      <time>{formatRecent(project.updatedAt)}</time>
    </button>;
  };

  return <>
    <div className={`project-edit-bar${editing ? ' is-visible' : ''}`}><span>프로젝트를 끌어 순서를 바꾸거나 겹쳐서 폴더로 묶으세요.</span><button type="button" onClick={() => setEditing(false)}>완료</button></div>
    <div className={`project-launcher-grid${editing ? ' is-editing' : ''}`}>{visibleEntries.map(renderEntry)}</div>
    {dragging && <div className="project-drag-ghost" style={{ transform: `translate3d(${dragging.x}px, ${dragging.y}px, 0)` }} aria-hidden="true"><Icon name="projects" /></div>}
    {context && <div className="project-context-menu" style={{ left: context.x, top: context.y }} onPointerDown={(event) => event.stopPropagation()}>{context.kind === 'project'
      ? <>{context.folderId !== undefined && <button type="button" className="is-neutral" onClick={() => { takeOutOfFolder(context.folderId!, context.id); setContext(null); }}><Icon name="projects" /> 폴더에서 빼기</button>}<button type="button" onClick={() => { setConfirmDeleteId(context.id); setContext(null); }}><Icon name="trash" /> 프로젝트 삭제</button></>
      : <><button type="button" className="is-neutral" onClick={() => { setFolderId(context.id); setContext(null); }}><Icon name="projects" /> 폴더 열기</button><button type="button" onClick={() => { setEntries((current) => dissolveProjectFolder(current, context.id)); setFolderId(null); setContext(null); }}><Icon name="trash" /> 폴더 삭제</button></>}</div>}
    {folder && <div className="project-folder-backdrop" onPointerDown={(event) => { if (event.currentTarget === event.target) setFolderId(null); }}><section className="project-folder-sheet" role="dialog" aria-modal="true" aria-label={folder.name}><header><input aria-label="폴더 이름" value={folder.name} onChange={(event) => setEntries((current) => current.map((entry) => keyOf(entry) === keyOf(folder) ? { ...folder, name: event.target.value } : entry))}/><button type="button" aria-label="폴더 닫기" onClick={() => setFolderId(null)}><Icon name="close" /></button></header><div>{folder.projectIds.map((id) => { const project = projectMap.get(id); return project ? <article key={id}><button type="button" onContextMenu={(event) => { event.preventDefault(); openContext('project', id, event.clientX, event.clientY, folder.id); }} onPointerDown={(event) => { if (event.button !== 2) return; event.stopPropagation(); openContext('project', id, event.clientX, event.clientY, folder.id); }} onClick={() => onOpen(id)}><span className="workspace-library-icon"><Icon name="projects" /></span><strong>{project.name}</strong></button><button type="button" className="folder-remove" onClick={() => takeOutOfFolder(folder.id, id)}>폴더에서 빼기</button></article> : null; })}</div></section></div>}
    {projectToDelete && <div className="project-delete-backdrop"><section className="project-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="project-delete-title"><h2 id="project-delete-title">‘{projectToDelete.name}’ 프로젝트를 삭제할까요?</h2><p>프로젝트 폴더는 같은 위치의 스튜디오 휴지통으로 이동하므로 직접 복구할 수 있습니다.</p><footer><button type="button" onClick={() => setConfirmDeleteId(null)}>취소</button><button type="button" className="is-danger" onClick={() => { setFolderId(null); onDelete(projectToDelete.id); setConfirmDeleteId(null); }}>삭제</button></footer></section></div>}
  </>;
}
