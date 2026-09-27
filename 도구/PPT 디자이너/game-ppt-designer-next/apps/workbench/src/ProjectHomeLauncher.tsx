import { useEffect, useRef, useState } from 'react';

export type HomeProject = { projectId: string; name: string; createdAt: string; updatedAt: string; documents: Array<{ documentId: string; title: string; mode: 'document' | 'presentation'; updatedAt: string }>; history: Array<{ artifactId: string; documentId: string; title: string; previewPngUrl: string; updatedAt: string }> };
export type HomeEntry = { kind: 'project'; id: string } | { kind: 'folder'; id: string; name: string; projectIds: string[] };
type HomeMenu = { kind: 'project' | 'folder'; id: string; x: number; y: number; folderId?: string };

const STORAGE_KEY = 'ppt-designer:project-home-layout:v1';
const LONG_PRESS_MS = 480;
const keyOf = (entry: HomeEntry) => `${entry.kind}:${entry.id}`;

export function sanitizeHomeLayout(value: unknown): HomeEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is HomeEntry => {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as Record<string, unknown>;
    if (candidate.kind === 'project') return typeof candidate.id === 'string';
    return candidate.kind === 'folder'
      && typeof candidate.id === 'string'
      && typeof candidate.name === 'string'
      && Array.isArray(candidate.projectIds)
      && candidate.projectIds.every((id) => typeof id === 'string');
  });
}

export function reconcileHomeLayout(stored: HomeEntry[], ids: string[]) {
  const available = new Set(ids); const claimed = new Set<string>(); const next: HomeEntry[] = [];
  for (const entry of stored) {
    if (entry.kind === 'project') { if (available.has(entry.id) && !claimed.has(entry.id)) { next.push(entry); claimed.add(entry.id); } continue; }
    const projectIds = entry.projectIds.filter((id) => available.has(id) && !claimed.has(id)); projectIds.forEach((id) => claimed.add(id));
    if (projectIds.length > 1) next.push({ ...entry, projectIds }); else if (projectIds[0]) next.push({ kind: 'project', id: projectIds[0] });
  }
  ids.filter((id) => !claimed.has(id)).forEach((id) => next.push({ kind: 'project', id })); return next;
}

// 폴더는 다른 항목과 합쳐지지 않는다. 폴더를 끌면 언제나 순서만 바뀐다.
export function canCombineHomeEntries(source: HomeEntry | undefined, target: HomeEntry | undefined) {
  if (!source || !target || keyOf(source) === keyOf(target)) return false;
  return source.kind === 'project';
}

export function dropHomeEntry(entries: HomeEntry[], sourceKey: string, targetKey: string, combine: boolean, after: boolean) {
  const source = entries.find((entry) => keyOf(entry) === sourceKey); const target = entries.find((entry) => keyOf(entry) === targetKey);
  if (!source || !target || sourceKey === targetKey) return entries;
  if (combine && canCombineHomeEntries(source, target) && source.kind === 'project') {
    if (target.kind === 'folder') return entries.filter((entry) => keyOf(entry) !== sourceKey).map((entry) => keyOf(entry) === targetKey ? { ...target, projectIds: [...target.projectIds, source.id] } : entry);
    const folder: HomeEntry = { kind: 'folder', id: crypto.randomUUID(), name: '새 폴더', projectIds: [target.id, source.id] };
    return entries.filter((entry) => keyOf(entry) !== sourceKey).map((entry) => keyOf(entry) === targetKey ? folder : entry);
  }
  const sourceIndex = entries.findIndex((entry) => keyOf(entry) === sourceKey); const copy = [...entries]; const [moving] = copy.splice(sourceIndex, 1); const targetIndex = copy.findIndex((entry) => keyOf(entry) === targetKey); copy.splice(targetIndex + (after ? 1 : 0), 0, moving!); return copy;
}

// 프로젝트 하나를 폴더 밖으로 빼 홈 그리드 끝에 되돌린다.
// 남은 것이 하나뿐이면 폴더를 유지할 이유가 없으므로 폴더도 함께 푼다.
export function removeFromHomeFolder(entries: HomeEntry[], folderId: string, projectId: string): HomeEntry[] {
  const target = entries.find((entry): entry is Extract<HomeEntry, { kind: 'folder' }> => entry.kind === 'folder' && entry.id === folderId);
  if (!target || !target.projectIds.includes(projectId)) return entries;
  const remaining = target.projectIds.filter((id) => id !== projectId);
  const replacement: HomeEntry[] = remaining.length > 1 ? [{ ...target, projectIds: remaining }] : remaining.map((id): HomeEntry => ({ kind: 'project', id }));
  return entries.flatMap((entry) => entry.kind === 'folder' && entry.id === folderId ? replacement : [entry]).concat({ kind: 'project', id: projectId });
}

// 폴더만 없애고 안에 있던 프로젝트는 홈 그리드로 되돌린다. 프로젝트는 지우지 않는다.
export function dissolveHomeFolder(entries: HomeEntry[], folderId: string) {
  return entries.flatMap((entry) => entry.kind === 'folder' && entry.id === folderId ? entry.projectIds.map((id): HomeEntry => ({ kind: 'project', id })) : [entry]);
}

function load(ids: string[]) { try { return reconcileHomeLayout(sanitizeHomeLayout(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')), ids); } catch { return reconcileHomeLayout([], ids); } }

export function ProjectHomeLauncher({ projects, visibleIds, onOpen, onDelete, registerBack }: { projects: HomeProject[]; visibleIds: Set<string>; onOpen: (project: HomeProject) => void; onDelete: (id: string) => Promise<void>; registerBack?: (handler: (() => boolean) | null) => void }) {
  const map = new Map(projects.map((project) => [project.projectId, project]));
  const [entries, setEntries] = useState<HomeEntry[]>(() => load(projects.map((project) => project.projectId)));
  const [editing, setEditing] = useState(false); const [dragging, setDragging] = useState<{ key: string; x: number; y: number } | null>(null);
  const [target, setTarget] = useState<{ key: string; combine: boolean; after: boolean } | null>(null); const targetRef = useRef<typeof target>(null);
  const [folderId, setFolderId] = useState<string | null>(null); const [menu, setMenu] = useState<HomeMenu | null>(null); const [deletingId, setDeletingId] = useState<string | null>(null);
  const press = useRef<{ key: string; pointerId: number; x: number; y: number; timer: number; long: boolean } | null>(null); const suppressClick = useRef(false);
  useEffect(() => setEntries((current) => reconcileHomeLayout(current, projects.map((project) => project.projectId))), [projects]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }, [entries]);
  useEffect(() => { if (!menu) return; const close = () => setMenu(null); window.addEventListener('pointerdown', close, { once: true }); return () => window.removeEventListener('pointerdown', close); }, [menu]);
  // 마우스 뒤로가기 버튼은 열려 있는 겹침 화면을 먼저 닫는다. 닫을 것이 없을 때만 화면 이동으로 넘긴다.
  useEffect(() => {
    if (!registerBack) return;
    registerBack(() => {
      if (menu) { setMenu(null); return true; }
      if (deletingId) { setDeletingId(null); return true; }
      if (folderId) { setFolderId(null); return true; }
      if (editing) { setEditing(false); return true; }
      return false;
    });
    return () => registerBack(null);
  }, [registerBack, menu, deletingId, folderId, editing]);
  const visible = entries.filter((entry) => entry.kind === 'project' ? visibleIds.has(entry.id) : entry.projectIds.some((id) => visibleIds.has(id)));
  const folder = entries.find((entry): entry is Extract<HomeEntry, { kind: 'folder' }> => entry.kind === 'folder' && entry.id === folderId) ?? null; const deleting = deletingId ? map.get(deletingId) : null;
  // WebView2는 기본 컨텍스트 메뉴를 끄기 때문에 contextmenu 이벤트와 오른쪽 버튼 pointerdown 양쪽에서 연다.
  const openMenu = (kind: HomeMenu['kind'], id: string, x: number, y: number, folderId?: string) => { press.current = null; setMenu(folderId === undefined ? { kind, id, x, y } : { kind, id, x, y, folderId }); };
  const down = (event: React.PointerEvent<HTMLElement>, key: string, kind: HomeMenu['kind'], id: string) => { if (event.button === 2) { event.stopPropagation(); openMenu(kind, id, event.clientX, event.clientY); return; } if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); const timer = window.setTimeout(() => { if (!press.current || press.current.key !== key) return; press.current.long = true; suppressClick.current = true; setEditing(true); setDragging({ key, x: event.clientX, y: event.clientY }); }, editing ? 0 : LONG_PRESS_MS); press.current = { key, pointerId: event.pointerId, x: event.clientX, y: event.clientY, timer, long: false }; };
  const move = (event: React.PointerEvent<HTMLElement>) => { const current = press.current; if (!current || current.pointerId !== event.pointerId) return; if (!current.long && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8) { clearTimeout(current.timer); press.current = null; return; } if (!current.long) return; setDragging({ key: current.key, x: event.clientX, y: event.clientY }); const element = document.elementsFromPoint(event.clientX, event.clientY).find((node) => node instanceof HTMLElement && node.dataset.homeKey && node.dataset.homeKey !== current.key) as HTMLElement | undefined; if (!element?.dataset.homeKey) { targetRef.current = null; setTarget(null); return; } const rect = element.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width; const y = (event.clientY - rect.top) / rect.height; const combinable = canCombineHomeEntries(entries.find((entry) => keyOf(entry) === current.key), entries.find((entry) => keyOf(entry) === element.dataset.homeKey)); const next = { key: element.dataset.homeKey, combine: combinable && x > .27 && x < .73 && y > .2 && y < .8, after: x >= .5 }; targetRef.current = next; setTarget(next); };
  const up = (event: React.PointerEvent<HTMLElement>) => { const current = press.current; if (!current || current.pointerId !== event.pointerId) return; clearTimeout(current.timer); const dropTarget = targetRef.current; if (current.long && dropTarget) setEntries((value) => dropHomeEntry(value, current.key, dropTarget.key, dropTarget.combine, dropTarget.after)); press.current = null; targetRef.current = null; setDragging(null); setTarget(null); if (current.long) setTimeout(() => { suppressClick.current = false; }, 0); };
  const open = (entry: HomeEntry) => { if (suppressClick.current) { suppressClick.current = false; return; } if (editing) return; if (entry.kind === 'folder') setFolderId(entry.id); else { const project = map.get(entry.id); if (project) onOpen(project); } };
  const takeOutOfFolder = (currentFolderId: string, id: string) => setEntries((items) => removeFromHomeFolder(items, currentFolderId, id));
  const preview = (project: HomeProject) => { const image = project.history[0]?.previewPngUrl; const summary = project.documents[0]; return <span className={`studio-project-preview ${image ? 'has-preview' : ''}`}>{image ? <img src={image} alt=""/> : <><i>{summary?.mode === 'presentation' ? '발표 자료' : '기획 문서'}</i><b>{summary?.title ?? project.name}</b><span/></>}</span>; };
  const copy = (project: HomeProject) => { const summary = project.documents[0]; return <span className="studio-project-copy"><strong>{project.name}</strong><small>{summary ? `${summary.mode === 'presentation' ? '발표' : '기획서'} · ${summary.title}` : '아직 만든 문서가 없습니다.'}</small></span>; };
  const card = (entry: HomeEntry) => { const key = keyOf(entry); const targetClass = target?.key === key ? target.combine ? ' is-folder-target' : ' is-move-target' : '';
    if (entry.kind === 'folder') { const contents = entry.projectIds.map((id) => map.get(id)).filter(Boolean) as HomeProject[]; return <button key={key} type="button" data-home-key={key} className={`studio-project-card studio-project-folder${targetClass}${dragging?.key === key ? ' is-dragging' : ''}`} onContextMenu={(event) => { event.preventDefault(); openMenu('folder', entry.id, event.clientX, event.clientY); }} onPointerDown={(event) => down(event, key, 'folder', entry.id)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={() => open(entry)}><span className="studio-folder-preview">{contents.slice(0, 4).map((project) => <i key={project.projectId}>{project.history[0]?.previewPngUrl ? <img src={project.history[0]!.previewPngUrl} alt=""/> : null}</i>)}</span><span className="studio-project-copy"><strong>{entry.name}</strong><small>{contents.length}개 프로젝트</small></span></button>; }
    const project = map.get(entry.id); if (!project) return null; return <button key={key} type="button" data-home-key={key} className={`studio-project-card${targetClass}${dragging?.key === key ? ' is-dragging' : ''}`} onContextMenu={(event) => { event.preventDefault(); openMenu('project', project.projectId, event.clientX, event.clientY); }} onPointerDown={(event) => down(event, key, 'project', project.projectId)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={() => open(entry)}>{preview(project)}{copy(project)}</button>; };
  return <><div className={`studio-project-edit${editing ? ' is-visible' : ''}`}><span>프로젝트를 끌어 순서를 바꾸거나 겹쳐 폴더로 묶으세요.</span><button type="button" onClick={() => setEditing(false)}>완료</button></div><section className={`studio-project-grid${editing ? ' is-editing' : ''}`} aria-label="전체 프로젝트">{visible.map(card)}</section>
    {dragging && <div className="studio-project-ghost" style={{ transform: `translate3d(${dragging.x}px,${dragging.y}px,0)` }} aria-hidden="true"/>}
    {menu && <div className="studio-project-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()}>{menu.kind === 'project'
      ? <>{menu.folderId !== undefined && <button type="button" className="neutral" onClick={() => { takeOutOfFolder(menu.folderId!, menu.id); setMenu(null); }}>폴더에서 빼기</button>}<button type="button" onClick={() => { setDeletingId(menu.id); setMenu(null); }}>프로젝트 삭제</button></>
      : <><button type="button" className="neutral" onClick={() => { setFolderId(menu.id); setMenu(null); }}>폴더 열기</button><button type="button" onClick={() => { setEntries((items) => dissolveHomeFolder(items, menu.id)); setFolderId(null); setMenu(null); }}>폴더 삭제</button></>}</div>}
    {folder && <div className="studio-folder-backdrop" onPointerDown={(event) => { if (event.currentTarget === event.target) setFolderId(null); }}><section className="studio-folder-sheet" role="dialog" aria-modal="true"><header><input aria-label="폴더 이름" value={folder.name} onChange={(event) => setEntries((items) => items.map((entry) => keyOf(entry) === keyOf(folder) ? { ...folder, name: event.target.value } : entry))}/><button type="button" aria-label="폴더 닫기" onClick={() => setFolderId(null)}>×</button></header><div>{folder.projectIds.map((id) => { const project = map.get(id); return project ? <article key={id}><button type="button" className="studio-project-card" onContextMenu={(event) => { event.preventDefault(); openMenu('project', id, event.clientX, event.clientY, folder.id); }} onPointerDown={(event) => { if (event.button !== 2) return; event.stopPropagation(); openMenu('project', id, event.clientX, event.clientY, folder.id); }} onClick={() => onOpen(project)}>{preview(project)}{copy(project)}</button><button type="button" className="studio-folder-remove" onClick={() => takeOutOfFolder(folder.id, id)}>폴더에서 빼기</button></article> : null; })}</div></section></div>}
    {deleting && <div className="studio-delete-backdrop"><section className="studio-delete-dialog" role="alertdialog" aria-modal="true"><h2>‘{deleting.name}’ 프로젝트를 삭제할까요?</h2><p>프로젝트는 PPT 디자이너 휴지통으로 이동되어 직접 복구할 수 있습니다.</p><footer><button type="button" onClick={() => setDeletingId(null)}>취소</button><button type="button" className="danger" onClick={() => { setFolderId(null); setDeletingId(null); void onDelete(deleting.projectId); }}>삭제</button></footer></section></div>}
  </>;
}
