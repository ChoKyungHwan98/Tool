import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { appendEvaluationEvent } from './studio-bridge.js';
import { ReferenceLibrary } from './ReferenceLibrary.js';
import { ProjectHomeLauncher } from './ProjectHomeLauncher.js';

type Finding = { findingId: string; issueType: string; severity: 'info' | 'warning' | 'error'; region?: string; problem: string; reason: string; revisionDirection: string };
type Candidate = { candidateId: string; previewPngUrl: string; label: string; pngSha256: string; provenance: { patternFragmentIds: string[]; referenceIds: string[]; layoutFamily: string; readingPath: string }; validation: { hardGatePassed: boolean } };
type DesignOutput = { artifactId: string; projectId: string; comparisonId: string; previewPngUrl: string; candidates: Candidate[]; exports: Array<{ kind: 'png' | 'html' | 'pdf' | 'pptx'; url: string; editable: boolean }>; validation: { hardGatePassed: boolean }; critic: null | { firstFixation: { target: string; assessment: string }; submissionReadiness: 'ready' | 'needs-review' | 'not-ready'; findings: Finding[] }; readiness: string; trace: { semanticShape: string; domain: string; selectedTeacherIds: string[]; appliedGuidanceIds: string[]; authoredContentHash: string; pngSha256: string } };
type CriticRun = { provider: string; model: string; execution?: 'local' | 'remote'; inputTokens?: number; outputTokens?: number; reasoningTokens?: number; totalTokens?: number; estimatedCostUsd?: number; cacheHit?: boolean; latencyMs?: number };
type AIUsage = { totalInputTokens: number; totalOutputTokens: number; totalReasoningTokens: number; totalTokens: number; totalEstimatedCostUsd: number; cacheHitCount: number };
type Surface = 'none' | 'source' | 'review' | 'activity' | 'history' | 'compare';
type ProductArea = '기획서' | '발표자료';
type TrainingStatus = { evaluationCount: number; readyCount: number; rejectCount: number; preferenceCount: number; pairwiseCount: number; reasonTags: Array<[string, number]>; dataset: null | { datasetId: string; sha256: string; trainCount: number; validationCount: number }; eligibility: { meaningfulTraining: boolean; dataEligible: boolean; runtimeEligible: boolean; reason: string; reasons: string[] }; runtime: { baseModel: string; gpuName: string | null; gpuMemoryMb: number | null; diskFreeGb: number }; latestRun: null | { trainingRunId: string; status: string; modelStatus: string; datasetId: string } };
type TrainedModels = { activeVisualCriticModelId: string | null; routerVisualCriticModelId: string | null; rollbackStack: string[]; models: Array<{ modelId: string; displayName: string; baseModel: string; version: string; createdAt: string; trainingDatasetId: string; benchmarkStatus: 'installed' | 'unbenchmarked' | 'qualified' | 'rejected' | 'disabled'; active: boolean; benchmark: null | { findingRecall: number; falsePositiveRate: number; readinessAccuracy: number; latencyMs: number } }> };
type StudioProject = { projectId: string; name: string; createdAt: string; updatedAt: string; documents: Array<{ documentId: string; title: string; mode: 'document' | 'presentation'; updatedAt: string }>; history: Array<{ artifactId: string; documentId: string; title: string; previewPngUrl: string; updatedAt: string }> };

const api = 'http://127.0.0.1:8766';
const TOOL_NAVIGATION_CHANNEL = 'game-design-studio:tool-navigation';
const projectModeKey = (projectId: string) => `ppt-designer:project-mode:${projectId}`;

function rememberedProjectMode(project: StudioProject): 'document' | 'presentation' | null {
  try {
    const stored = localStorage.getItem(projectModeKey(project.projectId));
    if (stored === 'document' || stored === 'presentation') return stored;
  } catch {
    // The project data remains the durable fallback if storage is unavailable.
  }
  return project.documents[0]?.mode ?? null;
}

const samples = {
  hierarchy: '제목: 전투 시스템 역할 구조\n메시지: 전투 규칙의 책임 범위를 기능 단위로 분리한다.\n구조:\n전투 시스템 책임자\n  플레이어 전투\n    이동/회피\n    공격/방어\n  보스 전투\n    패턴 선택\n    페이즈 전환',
  'aligned-before-after-spec': '제목: 보상 구조 개선\n기존 보상 구조:\n- 보상 상자 1개\n- 주간 보상 고정\n개선 보상 구조:\n- 보상 상자 2개\n- 주간 보상 선택\n메시지: 플레이 목표에 맞는 보상을 선택할 수 있는 보상 구조',
} as const;

function HomeIcon({ kind }: { kind: 'projects' | 'recent' | 'learning' | 'models' | 'search' | 'plus' | 'document' | 'presentation' | 'close' }) {
  const paths = {
    projects: <><path d="M3.5 7.5h6l2-2h9v12h-17z"/><path d="M3.5 9h17"/></>,
    recent: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>,
    learning: <><path d="M5 15.5V19h14v-3.5"/><path d="m8 10 4-4 4 4M12 6v9"/></>,
    models: <><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></>,
    search: <><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    document: <><path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 15h6"/></>,
    presentation: <><rect x="3.5" y="4.5" width="17" height="12" rx="1"/><path d="M8 20l4-3.5 4 3.5M8 9h8M8 12h5"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
  } as const;
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;
}

function NewProjectDialog({ name, busy, onName, onClose, onCreate }: { name: string; busy: boolean; onName: (value: string) => void; onClose: () => void; onCreate: () => void }) {
  return <div className="new-project-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onClose(); }}>
    <section className="new-project-dialog" role="dialog" aria-modal="true" aria-labelledby="new-project-title">
      <header><div><span>새 작업</span><h2 id="new-project-title">새 프로젝트</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="닫기"><HomeIcon kind="close"/></button></header>
      <label className="project-name-field"><span>프로젝트 이름</span><input autoFocus value={name} onChange={(event) => onName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && name.trim() !== '' && !busy) onCreate(); }} placeholder="예: 도로시아 전투 시스템"/></label>
      <footer><button type="button" onClick={onClose} disabled={busy}>취소</button><button className="create-confirm" type="button" onClick={onCreate} disabled={busy || name.trim() === ''}>{busy ? '만드는 중' : '프로젝트 만들기'}</button></footer>
    </section>
  </div>;
}

function LearningModule({ projectName, status, onBuildDataset, onStart, onBack }: { projectName: string; status: TrainingStatus | null; onBuildDataset: () => void; onStart: () => void; onBack: () => void }) {
return <div className="product-shell"><header className="product-top"><button className="crumb" onClick={onBack}>‹ {projectName}</button><b>AI 학습</b><span>PPT 디자이너</span></header><main className="module-overview training-module"><header><h1>AI 학습</h1><p>사람이 남긴 실제 판단만 학습 자료로 묶고, 품질 검증 전에는 모델을 사용하지 않습니다.</p></header><div className="training-grid"><section className="training-summary"><article><small>사람 평가</small><b>{status?.evaluationCount ?? '—'}</b><p>사용 승인 {status?.readyCount ?? 0} · 거절 {status?.rejectCount ?? 0}</p></article><article><small>후보 선택</small><b>{status?.preferenceCount ?? '—'}</b><p>학습 가능한 비교쌍 {status?.pairwiseCount ?? 0}</p></article><article><small>최신 데이터</small><b>{status?.dataset ? `${status.dataset.trainCount} / ${status.dataset.validationCount}` : '없음'}</b><p>학습 / 검증</p></article></section><section className="training-run"><div><small>학습 가능 여부</small><strong>{status?.eligibility.meaningfulTraining ? '품질 학습 가능' : status?.eligibility.dataEligible ? '컴퓨터 설정 확인 필요' : '평가 자료 부족'}</strong><p>{status?.eligibility.reason ?? '학습 상태를 불러오는 중입니다.'}</p></div><button onClick={onBuildDataset}>학습 자료 만들기</button><button disabled={!status?.eligibility.meaningfulTraining || !status.dataset} onClick={onStart}>품질 학습 시작</button><em>개발용 시험 자료는 이 숫자와 품질 학습에 포함되지 않습니다.</em></section><section className="training-evidence"><header><b>문제 이유 분포</b><span>{status?.dataset?.datasetId ?? '아직 만든 데이터 없음'}</span></header>{status?.reasonTags.map(([tag, count]) => <div key={tag}><span>{tag}</span><i style={{ width: `${Math.min(100, count * 18)}%` }}/><b>{count}</b></div>)}</section><section className="training-complete"><small>최근 품질 학습</small><b>{status?.latestRun?.trainingRunId ?? '없음'}</b><p>{status?.latestRun ? `${status.latestRun.datasetId} · ${status.latestRun.modelStatus}` : `${status?.runtime.baseModel ?? '모델 확인 중'} · 자동 실행/활성화 안 함`}</p><span>완료된 모델도 품질 평가와 사용자 활성화 전에는 사용되지 않습니다.</span></section></div><button className="module-back" onClick={onBack}>전체 프로젝트로 돌아가기</button></main></div>;
}

function ModelsModule({ projectName, registry, message, onBenchmark, onActivate, onRollback, onBack }: { projectName: string; registry: TrainedModels | null; message: string; onBenchmark: (modelId: string) => void; onActivate: (modelId: string) => void; onRollback: () => void; onBack: () => void }) {
  const statusName = (status: TrainedModels['models'][number]['benchmarkStatus']) => ({ installed: '설치됨', unbenchmarked: '검증 전', qualified: '검증 통과', rejected: '검증 탈락', disabled: '사용 중지' })[status];
  return <div className="product-shell"><header className="product-top"><button className="crumb" onClick={onBack}>‹ {projectName}</button><b>모델 관리</b><span>모든 프로젝트가 함께 사용하는 모델</span></header><main className="module-overview model-module"><header><h1>모델 관리</h1><p>학습 완료, 품질 검증, 실제 사용을 구분합니다. 검증 전 모델은 장표 검토에 쓰이지 않습니다.</p></header><div className="model-summary"><span><small>등록 모델</small><b>{registry?.models.length ?? '—'}</b></span><span><small>현재 AI 검토 모델</small><b>{registry?.routerVisualCriticModelId ?? '선택 가능한 모델 없음'}</b></span><button disabled={!registry?.rollbackStack.length} onClick={onRollback}>이전 모델로 되돌리기</button></div><section className="model-list">{registry?.models.map((model) => <article key={model.modelId} className={model.active ? 'is-active' : ''}><header><div><small>{model.version}</small><h2>{model.displayName}</h2><p>{model.baseModel}</p></div><strong>{statusName(model.benchmarkStatus)}</strong></header><dl><dt>학습 자료</dt><dd>{model.trainingDatasetId}</dd><dt>생성일</dt><dd>{new Date(model.createdAt).toLocaleString('ko-KR')}</dd><dt>평가 결과</dt><dd>{model.benchmark ? `문제 발견 ${(model.benchmark.findingRecall * 100).toFixed(0)}% · 준비 판정 ${(model.benchmark.readinessAccuracy * 100).toFixed(0)}%` : '아직 평가하지 않음'}</dd></dl><div className="model-actions"><button disabled={model.benchmarkStatus !== 'unbenchmarked'} onClick={() => onBenchmark(model.modelId)}>평가 시작</button><button disabled={model.benchmarkStatus !== 'qualified' || model.active} onClick={() => onActivate(model.modelId)}>{model.active ? '현재 사용 중' : '이 모델 사용'}</button></div></article>)}</section><p className="model-message">{message}</p><button className="module-back" onClick={onBack}>전체 프로젝트로 돌아가기</button></main></div>;
}

export function StudioWorkbench() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const requestedProjectId = params.get('workspaceId');
  const [screen, setScreen] = useState<'projects' | 'project' | 'workspace' | 'learning' | 'models' | 'references'>('projects');
  // 마우스 4번(뒤로)·5번 버튼(앞으로)으로 화면을 오간다. 뒤로는 열려 있는 겹침 화면을 먼저 닫는다.
  const screenPast = useRef<Array<typeof screen>>([]);
  const screenFuture = useRef<Array<typeof screen>>([]);
  const screenPrevious = useRef(screen);
  const screenJump = useRef(false);
  const homeBack = useRef<(() => boolean) | null>(null);
  const registerHomeBack = useCallback((handler: (() => boolean) | null) => { homeBack.current = handler; }, []);
  useEffect(() => { if (screenPrevious.current === screen) return; if (screenJump.current) screenJump.current = false; else { screenPast.current.push(screenPrevious.current); screenFuture.current = []; } screenPrevious.current = screen; }, [screen]);
  useEffect(() => {
    const swallow = (event: MouseEvent) => { if (event.button === 3 || event.button === 4) event.preventDefault(); };
    const navigate = (event: MouseEvent) => {
      if (event.button !== 3 && event.button !== 4) return;
      event.preventDefault();
      if (event.button === 3 && homeBack.current?.() === true) return;
      const from = event.button === 3 ? screenPast : screenFuture;
      const to = event.button === 3 ? screenFuture : screenPast;
      const next = from.current.pop();
      if (next === undefined) {
        // 도구 안에 더 갈 곳이 없으면 스튜디오 화면 기록으로 넘긴다(스튜디오 공통 계약).
        if (window.parent !== window) window.parent.postMessage({ channel: TOOL_NAVIGATION_CHANNEL, type: 'side-navigate', direction: event.button === 3 ? 'back' : 'forward' }, '*');
        return;
      }
      to.current.push(screenPrevious.current);
      screenJump.current = true;
      setScreen(next);
    };
    window.addEventListener('mousedown', swallow);
    window.addEventListener('auxclick', swallow);
    window.addEventListener('mouseup', navigate);
    return () => { window.removeEventListener('mousedown', swallow); window.removeEventListener('auxclick', swallow); window.removeEventListener('mouseup', navigate); };
  }, []);
  const [area, setArea] = useState<ProductArea>('기획서');
  const [mode, setMode] = useState<'document' | 'presentation'>('document');
  const [structure, setStructure] = useState<keyof typeof samples>('hierarchy');
  const [content, setContent] = useState<string>(samples.hierarchy);
  const [output, setOutput] = useState<DesignOutput | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState(0);
  const [criticRun, setCriticRun] = useState<CriticRun | null>(null);
  const [aiUsage, setAIUsage] = useState<AIUsage | null>(null);
  const [busy, setBusy] = useState<'generate' | 'critic' | 'save' | null>(null);
  const [provider, setProvider] = useState<'local' | 'openrouter'>('local');
  const [surface, setSurface] = useState<Surface>('none');
  const [message, setMessage] = useState('원고를 확인한 뒤 장표를 생성하세요.');
  const [serviceReady, setServiceReady] = useState<boolean | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus | null>(null);
  const [trainedModels, setTrainedModels] = useState<TrainedModels | null>(null);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<StudioProject | null>(null);
  const [projectQuery, setProjectQuery] = useState('');
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const enterProject = (project: StudioProject, updateLocation = true) => {
    const rememberedMode = rememberedProjectMode(project);
    setSelectedProject(project);
    setOutput(null);
    setSurface('none');
    if (rememberedMode) {
      setMode(rememberedMode);
      setArea(rememberedMode === 'document' ? '기획서' : '발표자료');
      setScreen('workspace');
    } else {
      setScreen('project');
    }
    if (updateLocation) {
      const nextParams = new URLSearchParams(location.search);
      nextParams.set('workspaceId', project.projectId);
      window.history.replaceState(null, '', `?${nextParams.toString()}`);
    }
  };
  useEffect(() => { void fetch(`${api}/api/designer/health`).then((res) => setServiceReady(res.ok)).catch(() => setServiceReady(false)); }, []);
  const refreshTrainingStatus = () => fetch(`${api}/api/designer/training/status`).then((response) => response.ok ? response.json() : null).then((value) => setTrainingStatus(value as TrainingStatus | null)).catch(() => setTrainingStatus(null));
  useEffect(() => { if (screen === 'learning') void refreshTrainingStatus(); }, [screen]);
  useEffect(() => { if (screen === 'models') void fetch(`${api}/api/designer/models`).then((response) => response.ok ? response.json() : null).then((value) => setTrainedModels(value as TrainedModels | null)).catch(() => setTrainedModels(null)); }, [screen]);
  useEffect(() => { void fetch(`${api}/api/designer/projects`).then((response) => response.ok ? response.json() : { projects: [] }).then((value: { projects: StudioProject[] }) => { setProjects(value.projects); if (requestedProjectId && selectedProject === null) { const match = value.projects.find((project) => project.projectId === requestedProjectId); if (match) enterProject(match, false); } }).catch(() => setProjects([])); }, [requestedProjectId, selectedProject]);
  const openProject = (project: StudioProject) => enterProject(project);
  const returnToProjects = () => { const nextParams = new URLSearchParams(location.search); nextParams.delete('workspaceId'); setScreen('projects'); window.history.replaceState(null, '', nextParams.size ? `?${nextParams.toString()}` : location.pathname); };
  useEffect(() => {
    const handleStudioNavigation = (event: MessageEvent) => {
      if (event.source !== window.parent || event.data?.channel !== TOOL_NAVIGATION_CHANNEL || event.data?.type !== 'navigate-back') return;
      const handled = screen !== 'projects';
      if (handled) returnToProjects();
      window.parent.postMessage({ channel: TOOL_NAVIGATION_CHANNEL, type: 'navigate-back:result', requestId: event.data.requestId, handled }, '*');
    };
    window.addEventListener('message', handleStudioNavigation);
    return () => window.removeEventListener('message', handleStudioNavigation);
  }, [screen]);
  const createProject = async () => {
    const name = newProjectName.trim(); if (name === '' || creatingProject) return;
    setCreatingProject(true);
    try {
      const response = await fetch(`${api}/api/designer/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const project = await response.json() as StudioProject & { error?: string };
      if (!response.ok) throw new Error(project.error ?? '프로젝트를 만들지 못했습니다.');
      setProjects((current) => [project, ...current]); setNewProjectOpen(false); setNewProjectName(''); openProject(project);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setCreatingProject(false); }
  };
  const deleteProject = async (projectId: string) => {
    // 서버가 꺼져 있거나 응답이 JSON이 아니면 여기서 예외가 난다.
    // 감싸지 않으면 삭제가 아무 표시 없이 사라져 사용자는 기능이 없는 줄 안다.
    let response: Response;
    try { response = await fetch(`${api}/api/designer/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' }); }
    catch { setMessage('PPT 디자이너 서버에 연결하지 못해 삭제하지 못했습니다. 스튜디오를 다시 시작해보세요.'); return; }
    const value = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { setMessage(value.error ?? '프로젝트를 삭제하지 못했습니다.'); return; }
    setProjects((current) => current.filter((project) => project.projectId !== projectId));
    try { localStorage.removeItem(projectModeKey(projectId)); } catch { /* The server deletion is already complete. */ }
  };
  const openHistory = async (item: StudioProject['history'][number]) => { const response = await fetch(`${api}/api/designer/jobs/${encodeURIComponent(item.artifactId)}/job.json`); const value = await response.json() as { output?: DesignOutput; error?: string }; if (!response.ok || !value.output) { setMessage(value.error ?? '이전 작업을 열지 못했습니다.'); return; } setOutput(value.output); setSelectedCandidate(0); setMode(selectedProject?.documents.find((document) => document.documentId === item.documentId)?.mode ?? 'document'); setScreen('workspace'); setMessage('저장된 작업을 열었습니다.'); };
  const activateModel = async (modelId: string) => { const response = await fetch(`${api}/api/designer/models/${encodeURIComponent(modelId)}/activate`, { method: 'POST' }); const value = await response.json() as TrainedModels & { error?: string }; if (response.ok) { setTrainedModels(value); setMessage('검증을 통과한 모델을 활성화했습니다.'); } else setMessage(value.error ?? '모델을 활성화하지 못했습니다.'); };
  const rollbackModel = async () => { const response = await fetch(`${api}/api/designer/models/rollback`, { method: 'POST' }); const value = await response.json() as TrainedModels & { error?: string }; if (response.ok) { setTrainedModels(value); setMessage('이전 모델로 되돌렸습니다.'); } else setMessage(value.error ?? '되돌릴 모델이 없습니다.'); };
  const benchmarkModel = async (modelId: string) => { const response = await fetch(`${api}/api/designer/models/${encodeURIComponent(modelId)}/benchmark`, { method: 'POST' }); const value = await response.json() as TrainedModels & { error?: string }; if (response.ok) { setTrainedModels(value); setMessage('모델 평가 결과를 저장했습니다.'); } else setMessage(value.error ?? '현재는 모델 평가를 실행할 수 없습니다.'); };
  const buildTrainingDataset = async () => { const response = await fetch(`${api}/api/designer/training/dataset/build`, { method: 'POST' }); const value = await response.json() as { datasetId?: string; error?: string }; setMessage(response.ok ? `${value.datasetId ?? '학습 자료'}를 만들었습니다.` : value.error ?? '학습 자료를 만들지 못했습니다.'); await refreshTrainingStatus(); };
  const startQualityTraining = async () => { if (!trainingStatus?.dataset) return; const response = await fetch(`${api}/api/designer/training/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'quality', datasetId: trainingStatus.dataset.datasetId }) }); const value = await response.json() as { trainingRunId?: string; error?: string }; setMessage(response.ok ? `${value.trainingRunId ?? '학습'} 실행을 시작했습니다.` : value.error ?? '품질 학습을 시작하지 못했습니다.'); await refreshTrainingStatus(); };

  const openArea = (next: ProductArea) => {
    const nextMode = next === '기획서' ? 'document' : 'presentation';
    setArea(next);
    setMode(nextMode);
    if (selectedProject) {
      try { localStorage.setItem(projectModeKey(selectedProject.projectId), nextMode); } catch { /* Project documents remain the fallback. */ }
    }
    setOutput(null);
    setSurface('none');
    setScreen('workspace');
  };
  const changeStructure = (next: keyof typeof samples) => { setStructure(next); setContent(samples[next]); setOutput(null); setSurface('source'); };
  const generate = async () => {
    setBusy('generate'); setCriticRun(null); setAIUsage(null); setMessage('내용을 보존하며 장표를 설계하고 있습니다.');
    try {
      if (!selectedProject) throw new Error('먼저 프로젝트를 선택하세요.');
      const response = await fetch(`${api}/api/designer/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schemaVersion: '0.1', projectId: selectedProject.projectId, documentId: `document-${Date.now()}`, mode, authoredContent: content, authoredStructure: structure, outputProfile: 'screen-16:9' }) });
      const value = await response.json() as DesignOutput & { error?: string };
      if (!response.ok) throw new Error(value.error ?? '장표를 만들지 못했습니다.');
      setOutput(value); setSelectedCandidate(0); setSurface('none'); setMessage('원문과 배치 검사를 통과했습니다.');
      void fetch(`${api}/api/designer/projects/${encodeURIComponent(selectedProject.projectId)}`).then((res) => res.json()).then((project) => setSelectedProject(project as StudioProject));
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(null); }
  };
  const critique = async () => {
    if (!output) return; setBusy('critic'); setMessage('실제 장표 화면을 AI가 검토하고 있습니다.');
    try {
      const response = await fetch(`${api}/api/designer/jobs/${encodeURIComponent(output.artifactId)}/critic`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider }) });
      const value = await response.json() as { output?: DesignOutput; run?: CriticRun; aiActivity?: CriticRun[]; aiUsage?: AIUsage; error?: string };
      if (!response.ok || !value.output) throw new Error(value.error ?? 'AI 검토를 완료하지 못했습니다.');
      setOutput(value.output); setCriticRun(value.aiActivity?.at(-1) ?? value.run ?? null); setAIUsage(value.aiUsage ?? null); setSurface('review'); setMessage('AI 검토가 완료되었습니다.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(null); }
  };
  const decide = async (decision: 'ready' | 'reject') => {
    if (!output) return; setBusy('save');
    try {
      const event = { schemaVersion: '0.1', eventId: `evaluation-${crypto.randomUUID()}`, artifactId: output.artifactId, png: { path: output.previewPngUrl, sha256: output.trace.pngSha256 }, authoredContentHash: output.trace.authoredContentHash, semanticShape: output.trace.semanticShape, selectedTeacherIds: output.trace.selectedTeacherIds, appliedGuidanceIds: output.trace.appliedGuidanceIds, critic: output.critic ? { provider: criticRun?.provider ?? provider, model: criticRun?.model ?? 'not-recorded', findings: output.critic.findings } : null, userDecision: decision, reasonTags: decision === 'ready' ? [] : ['aesthetics'], decidedAt: new Date().toISOString(), separation: { teacherQualityChanged: false, readyQualityRecorded: true, preferenceRecorded: false } };
      const response = await fetch(`${api}/api/designer/jobs/${encodeURIComponent(output.artifactId)}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error ?? '판단을 기록하지 못했습니다.');
      await appendEvaluationEvent(event); setMessage(decision === 'ready' ? '이 결과를 승인 기록에 남겼습니다.' : '이 결과를 거절 기록에 남겼습니다.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(null); }
  };
  const preferCandidate = async (decision: 'choose-A' | 'choose-B' | 'choose-C' | 'reject-all') => {
    if (!output) return; const index = decision === 'reject-all' ? -1 : ['choose-A', 'choose-B', 'choose-C'].indexOf(decision); const selected = index < 0 ? null : output.candidates[index];
    const event = { schemaVersion: '0.1', eventId: `preference-${crypto.randomUUID()}`, artifactId: output.artifactId, comparisonId: output.comparisonId, candidateIds: output.candidates.map((candidate) => candidate.candidateId), decision, selectedCandidateId: selected?.candidateId ?? null, selectedCandidateHash: selected?.pngSha256 ?? null, semanticShape: output.trace.semanticShape, mode, chosenPatternId: selected?.provenance.patternFragmentIds[0] ?? null, density: 'balanced', designSignature: selected ? { candidateId: selected.candidateId, referenceClusterIds: selected.provenance.referenceIds.length ? selected.provenance.referenceIds : output.trace.selectedTeacherIds, topologyFamily: selected.provenance.layoutFamily, readingPath: selected.provenance.readingPath, featureTags: selected.provenance.patternFragmentIds } : null, reasonTags: [], approved: selected !== null, projectId: output.projectId, domain: output.trace.domain, occurredAt: new Date().toISOString(), separation: { teacherQualityChanged: false, readyQualityChanged: false, criticFindingsChanged: false } };
    const response = await fetch(`${api}/api/designer/jobs/${encodeURIComponent(output.artifactId)}/preference`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) }); const value = await response.json() as { output?: DesignOutput; error?: string; patterns?: Array<{ strength: string }> }; if (!response.ok) { setMessage(value.error ?? '후보 선택을 저장하지 못했습니다.'); return; } if (value.output) setOutput(value.output); if (selected) setSelectedCandidate(index); setSurface('none'); setMessage(selected ? `${selected.label} 선택을 취향 근거로 저장했습니다. 제출 승인은 별도입니다.` : '모든 후보 거절을 기록했습니다.');
  };
  const candidates = output?.candidates ?? [];
  const history = (selectedProject?.history ?? []).map((item) => ({ artifactId: item.artifactId, at: item.updatedAt, preview: item.previewPngUrl }));
  const preview = candidates[selectedCandidate]?.previewPngUrl ?? output?.previewPngUrl;
  const exportOf = (kind: 'png' | 'pdf' | 'pptx') => output?.exports.find((item) => item.kind === kind)?.url;
  const presentationPages = [
    ...(output && !selectedProject?.history.some((item) => item.artifactId === output.artifactId) ? [{
      id: output.artifactId,
      title: '현재 장표',
      preview: preview ?? '',
      active: true,
      onOpen: () => undefined,
    }] : []),
    ...(selectedProject?.history ?? []).map((item) => ({
      id: item.artifactId,
      title: item.title,
      preview: item.previewPngUrl,
      active: item.artifactId === output?.artifactId,
      onOpen: () => void openHistory(item),
    })),
  ];

  if (screen === 'projects') {
    const needle = projectQuery.trim().toLocaleLowerCase('ko-KR');
    const visibleProjects = projects.filter((project) => needle === '' || project.name.toLocaleLowerCase('ko-KR').includes(needle));
    return <div className="studio-home-shell">
      <aside className="studio-home-nav">
        <div className="studio-home-brand"><b>PPT 디자이너</b></div>
        <div className="studio-nav-group"><span>프로젝트 관리</span><nav aria-label="프로젝트 관리"><button className="is-active" type="button"><b>전체 프로젝트</b></button></nav></div>
        <div className="studio-nav-group studio-ai-nav"><nav aria-label="AI 품질 관리"><button type="button" onClick={() => setScreen('references')}><HomeIcon kind="projects"/><b>레퍼런스 관리</b></button><button type="button" onClick={() => setScreen('learning')}><HomeIcon kind="learning"/><b>AI 학습</b></button><button type="button" onClick={() => setScreen('models')}><HomeIcon kind="models"/><b>모델 관리</b></button></nav></div>
      </aside>
      <main className="studio-home-main">
        <header className="studio-home-heading"><h1>전체 프로젝트</h1><div className="studio-home-actions"><input className="studio-home-search" aria-label="프로젝트 검색" placeholder="프로젝트 검색" value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)}/><button type="button" onClick={() => setNewProjectOpen(true)}><HomeIcon kind="plus"/>새 프로젝트</button></div></header>
        {visibleProjects.length > 0 ? <ProjectHomeLauncher projects={projects} visibleIds={new Set(visibleProjects.map((project) => project.projectId))} onOpen={openProject} onDelete={deleteProject} registerBack={registerHomeBack}/> : <section className="studio-project-grid" aria-label="전체 프로젝트"><div className="studio-project-empty"><HomeIcon kind="projects"/><b>{projectQuery ? '검색 결과가 없습니다.' : '첫 프로젝트를 만들어보세요.'}</b><span>{projectQuery ? '다른 프로젝트 이름으로 검색해보세요.' : '기획서 또는 발표 모드를 선택해 바로 시작할 수 있습니다.'}</span><button type="button" onClick={() => setNewProjectOpen(true)}>새 프로젝트</button></div></section>}
      </main>
      {newProjectOpen && <NewProjectDialog name={newProjectName} busy={creatingProject} onName={setNewProjectName} onClose={() => setNewProjectOpen(false)} onCreate={() => void createProject()}/>}
    </div>;
  }

  if (screen === 'project' && selectedProject) return <div className="product-shell"><main className="project-overview"><header><small>새 프로젝트</small><h1>{selectedProject.name}</h1><p>처음 사용할 작업 방식을 선택하세요. 다음부터는 바로 편집 화면으로 열립니다.</p></header><section className="project-mode-grid"><button type="button" onClick={() => openArea('기획서')}><i><HomeIcon kind="document"/></i><span><small>문서 중심</small><h2>기획서 모드</h2><p>규칙, 수치, 관계를 빠짐없이 담아 내가 쓸 기획 문서를 만듭니다.</p><b>기획서 만들기 →</b></span></button><button type="button" onClick={() => openArea('발표자료')}><i><HomeIcon kind="presentation"/></i><span><small>발표 중심</small><h2>발표 모드</h2><p>핵심 메시지가 먼저 보이도록 발표용 페이지를 만듭니다.</p><b>발표자료 만들기 →</b></span></button></section></main></div>;

  if (screen === 'learning') return <LearningModule projectName="전체 프로젝트" status={trainingStatus} onBuildDataset={() => void buildTrainingDataset()} onStart={() => void startQualityTraining()} onBack={returnToProjects}/>;
  if (screen === 'references') return <ReferenceLibrary onBack={returnToProjects}/>;
  if (screen === 'models') return <ModelsModule projectName="전체 프로젝트" registry={trainedModels} message={message} onBenchmark={(modelId) => void benchmarkModel(modelId)} onActivate={(modelId) => void activateModel(modelId)} onRollback={() => void rollbackModel()} onBack={returnToProjects}/>;

  return <div className="authoring-shell">
    <header className="authoring-top"><div><b>{selectedProject?.name ?? area}</b><span>{serviceReady === false ? '생성 서비스 연결 필요' : serviceReady ? `${area} · 준비됨` : '확인 중'}</span></div><nav><button onClick={() => setSurface(surface === 'source' ? 'none' : 'source')}>원고 편집</button><button disabled={!output} onClick={() => setSurface('compare')}>후보 비교</button><button disabled={!output} onClick={() => setSurface('review')}>검토</button><button onClick={() => setSurface('history')}>기록</button><button className="generate" disabled={busy !== null || !content.trim()} onClick={() => void generate()}>{busy === 'generate' ? '설계 중' : output ? '새 장표 만들기' : '장표 만들기'}</button></nav></header>
    <main className="authoring-workspace"><aside className="slide-navigator" aria-label="장표 목록"><header><b>장표</b><span>{presentationPages.length}장</span></header><div className="slide-navigator-list">{presentationPages.length ? presentationPages.map((slide, index) => <button type="button" key={slide.id} className={slide.active ? 'is-active' : ''} onClick={slide.onOpen} aria-current={slide.active ? 'page' : undefined}><span className="slide-number">{String(index + 1).padStart(2, '0')}</span>{slide.preview ? <img src={slide.preview} alt={`${slide.title} 미리보기`}/> : <span className="slide-empty-preview"/>}<b>{slide.title}</b></button>) : <button type="button" className="slide-navigator-empty" onClick={() => setSurface('source')}><span className="slide-empty-preview" aria-hidden="true">+</span><b>첫 장표 만들기</b><small>원고부터 작성하세요.</small></button>}</div></aside><section className="authoring-stage"><div className="canvas-meta"><span>{mode === 'document' ? '기획서용 · 상세 정보 우선' : '발표용 · 핵심 메시지 우선'}</span><b>{output?.validation.hardGatePassed ? '내용 검사 통과' : '16:9 페이지'}</b></div><div className="canvas-frame">{preview ? <img src={preview} alt="생성한 장표"/> : <div><b>아직 만든 장표가 없습니다.</b><span>원고 편집에서 내용을 정리한 뒤 장표 만들기를 누르세요.</span></div>}{output?.critic?.findings.filter((finding) => finding.region).map((finding) => <button key={finding.findingId} className={`finding-pin ${finding.severity}`} title={finding.problem} onClick={() => setSurface('review')}>!</button>)}</div><p>{message}</p></section></main>
    <footer className="authoring-dock"><nav>{(['png','pdf','pptx'] as const).map((kind) => exportOf(kind) ? <a key={kind} href={exportOf(kind)} download>{kind.toUpperCase()}</a> : <button key={kind} disabled>{kind.toUpperCase()}</button>)}<button onClick={() => setSurface('activity')}>AI 사용 내역</button></nav></footer>
    {surface !== 'none' && <aside className="context-surface"><header><b>{surface === 'source' ? '기획 원고' : surface === 'review' ? '화면 검토' : surface === 'activity' ? 'AI 사용 내역' : surface === 'history' ? '변경 기록' : '후보 비교'}</b><button onClick={() => setSurface('none')}>×</button></header>{surface === 'source' && <div className="source-editor"><label>정보 구조<select value={structure} onChange={(event) => changeStructure(event.target.value as keyof typeof samples)}><option value="hierarchy">역할 구조</option><option value="aligned-before-after-spec">전후 비교</option></select></label><textarea value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false}/><small>들여쓰기와 대응 관계를 보존합니다.</small></div>}{surface === 'compare' && <div className="compare-surface">{candidates.map((candidate, index) => <article key={candidate.candidateId}><button onClick={() => setSelectedCandidate(index)}><img src={candidate.previewPngUrl} alt=""/><b>{candidate.label}</b><small>{candidate.provenance.readingPath === 'before-after' ? '같은 기준으로 좌우 비교' : candidate.provenance.readingPath === 'hierarchical' ? '상위 역할에서 세부 기능으로' : '정보 흐름을 따라 읽기'}</small></button><button className="candidate-choose" onClick={() => void preferCandidate((`choose-${String.fromCharCode(65 + index)}`) as 'choose-A' | 'choose-B' | 'choose-C')}>이 안 선택</button></article>)}<button className="reject-all" onClick={() => void preferCandidate('reject-all')}>전부 마음에 안 듦</button></div>}{surface === 'review' && <div className="review-surface"><div className="review-actions"><select value={provider} onChange={(event) => setProvider(event.target.value as 'local' | 'openrouter')}><option value="local">내 컴퓨터</option><option value="openrouter">OpenRouter</option></select><button disabled={!output || busy !== null} onClick={() => void critique()}>화면 검토 시작</button></div>{output?.critic ? <><strong>{output.critic.submissionReadiness === 'ready' ? '바로 사용 가능' : output.critic.submissionReadiness === 'not-ready' ? '수정 필요' : '사람 검토 필요'}</strong><p>{output.critic.firstFixation.assessment}</p>{output.critic.findings.map((finding) => <article key={finding.findingId}><small>{finding.severity}</small><b>{finding.problem}</b><p>{finding.reason}</p><em>{finding.revisionDirection}</em></article>)}<div className="decision-row"><button onClick={() => void decide('reject')}>거절</button><button onClick={() => void decide('ready')}>승인</button></div></> : <p>실제 PNG를 보고 위계, 여백, 관계를 검토합니다. 결과가 없을 때는 공간을 차지하지 않습니다.</p>}</div>}{surface === 'activity' && <div className="activity-surface"><dl><dt>사용 모델</dt><dd>{criticRun?.model ?? '호출 없음'}</dd><dt>제공자</dt><dd>{criticRun?.provider ?? '—'}</dd><dt>실행 위치</dt><dd>{criticRun?.execution === 'local' ? '내 컴퓨터' : criticRun?.execution === 'remote' ? '원격' : '—'}</dd><dt>입력 토큰</dt><dd>{aiUsage?.totalInputTokens ?? criticRun?.inputTokens ?? 0}</dd><dt>출력 토큰</dt><dd>{aiUsage?.totalOutputTokens ?? criticRun?.outputTokens ?? 0}</dd><dt>추론 토큰</dt><dd>{aiUsage?.totalReasoningTokens ?? criticRun?.reasoningTokens ?? 0}</dd><dt>전체 토큰</dt><dd>{aiUsage?.totalTokens ?? criticRun?.totalTokens ?? 0}</dd><dt>비용</dt><dd>${(aiUsage?.totalEstimatedCostUsd ?? criticRun?.estimatedCostUsd ?? 0).toFixed(6)}</dd><dt>캐시</dt><dd>{(aiUsage?.cacheHitCount ?? (criticRun?.cacheHit ? 1 : 0)) > 0 ? '사용' : '미사용'}</dd><dt>소요 시간</dt><dd>{criticRun?.latencyMs === undefined ? '—' : `${criticRun.latencyMs}ms`}</dd></dl></div>}{surface === 'history' && <div className="history-surface">{history.length ? history.map((item) => <article key={item.artifactId}><img src={item.preview} alt=""/><div><b>{item.artifactId}</b><small>{new Date(item.at).toLocaleString('ko-KR')}</small></div></article>) : <p>아직 변경 기록이 없습니다.</p>}</div>}</aside>}
  </div>;
}
