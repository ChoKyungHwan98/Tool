import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  Database,
  FileCheck2,
  FilePlus2,
  FileText,
  ImagePlus,
  KeyRound,
  LayoutGrid,
  Link2,
  ListTree,
  MonitorPlay,
  Palette,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlink,
  WandSparkles
} from 'lucide-react'
import type { DeckIrSlide } from '@shared/deck-ir'
import type { LayoutCandidate } from '@shared/design-engine'
import {
  createOfflineWorkspace,
  applyAiOutlineProposal,
  attachStudioArtifact,
  detachStudioArtifact,
  exportWorkspaceDocx,
  exportWorkspacePptx,
  getSlideVisualOverride,
  getAttachedArtifacts,
  insertStudioArtifactSlide,
  loadLibrary,
  saveLibrary,
  removeImageSlot,
  refreshStudioArtifact,
  selectDesignDirection,
  selectLayoutCandidate,
  updateSlideContent,
  updateSlideVisual,
  upsertImageSlot,
  validateAiOutlineProposal,
  type AiOutlineProposal,
  type CatalogArtifact,
  validateWorkspace,
  type DeckStudioLibrary,
  type DeckStudioWorkspace
} from './deckEngine'
import {
  deleteOpenRouterKey,
  getOpenRouterStatus,
  isStudioHosted,
  isStudioWorkspace,
  loadOpenRouterModels,
  listStudioArtifacts,
  loadStudioLibrary,
  requestOpenRouterOutline,
  saveOpenRouterKey,
  saveStudioLibrary,
  type AiBudget,
  type OpenRouterModel,
  type PublishedArtifact
} from './studioBridge'
import { runOutputPreflight, type OutputPreflightReport } from './preflight'

type View = 'outline' | 'direction' | 'layout' | 'preview' | 'connections' | 'assistant' | 'audit'

const workspaceId = new URLSearchParams(location.search).get('workspaceId') || 'standalone'

export function App(): React.JSX.Element {
  const [library, setLibrary] = useState<DeckStudioLibrary>(() => loadLibrary(workspaceId))
  const [activeId, setActiveId] = useState<string>()
  const [storageNotice, setStorageNotice] = useState('로컬 저장 준비 중')
  const [storageReady, setStorageReady] = useState(!isStudioWorkspace())
  const [conflict, setConflict] = useState<{ actualRevision: number; data: unknown }>()
  const nativeRevision = useRef(0)
  const lastSaved = useRef('')
  const active = library.workspaces.find((item) => item.document.sessionId === activeId)

  useEffect(() => {
    if (!isStudioWorkspace()) {
      lastSaved.current = JSON.stringify(library)
      setStorageNotice('이 브라우저에 저장됨')
      return
    }
    let alive = true
    void loadStudioLibrary().then(async (response) => {
      if (!alive) return
      if (response.found && isDeckLibrary(response.data)) {
        nativeRevision.current = response.revision
        lastSaved.current = JSON.stringify(response.data)
        setLibrary(response.data)
        setStorageNotice(`작업공간에 저장됨 · r${response.revision} · 복구본 ${response.backupCount}개`)
      } else {
        const local = loadLibrary(workspaceId)
        setLibrary(local)
        lastSaved.current = JSON.stringify(local)
        if (local.workspaces.length > 0) {
          const saved = await saveStudioLibrary(local, 0)
          if (saved.type === 'artifact:saved') {
            nativeRevision.current = saved.revision
            setStorageNotice('기존 로컬 작업을 작업공간으로 이전했습니다.')
          }
        } else {
          setStorageNotice('작업공간에 새 기획서 저장소를 준비했습니다.')
        }
      }
      setStorageReady(true)
    }).catch((error) => {
      if (!alive) return
      setStorageNotice(error instanceof Error ? error.message : String(error))
      setStorageReady(true)
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!storageReady) return
    const serialized = JSON.stringify(library)
    if (serialized === lastSaved.current) return
    if (!isStudioWorkspace()) {
      saveLibrary(workspaceId, library)
      lastSaved.current = serialized
      setStorageNotice('이 브라우저에 저장됨')
      return
    }
    setStorageNotice('작업공간에 저장 중…')
    const timer = window.setTimeout(() => {
      void saveStudioLibrary(library, nativeRevision.current).then((response) => {
        if (response.type === 'artifact:conflict') {
          setConflict({ actualRevision: response.actualRevision, data: response.data })
          setStorageNotice('다른 화면의 최신 작업과 충돌했습니다.')
          return
        }
        nativeRevision.current = response.revision
        lastSaved.current = serialized
        setStorageNotice(`작업공간에 저장됨 · r${response.revision} · 복구본 ${response.backupCount}개`)
      }).catch((error) => setStorageNotice(error instanceof Error ? error.message : String(error)))
    }, 450)
    return () => window.clearTimeout(timer)
  }, [library, storageReady])

  const loadConflictVersion = () => {
    if (!conflict || !isDeckLibrary(conflict.data)) return
    nativeRevision.current = conflict.actualRevision
    lastSaved.current = JSON.stringify(conflict.data)
    setLibrary(conflict.data)
    setConflict(undefined)
    setStorageNotice(`최신 작업공간 버전 r${conflict.actualRevision}을 불러왔습니다.`)
  }

  const overwriteConflict = () => {
    if (!conflict) return
    setStorageNotice('내 작업으로 충돌을 해결하는 중…')
    void saveStudioLibrary(library, conflict.actualRevision, true).then((response) => {
      if (response.type !== 'artifact:saved') return
      nativeRevision.current = response.revision
      lastSaved.current = JSON.stringify(library)
      setConflict(undefined)
      setStorageNotice(`내 작업으로 저장했습니다 · r${response.revision}`)
    })
  }

  const create = (title: string, brief: string) => {
    const workspace = createOfflineWorkspace(title, brief)
    setLibrary((current) => ({ ...current, workspaces: [workspace, ...current.workspaces] }))
    setActiveId(workspace.document.sessionId)
  }

  const update = (workspace: DeckStudioWorkspace) => {
    setLibrary((current) => ({
      ...current,
      workspaces: current.workspaces.map((item) => item.document.sessionId === workspace.document.sessionId ? workspace : item)
    }))
  }

  if (!storageReady) return <div className="deck-app deck-loading"><ShieldCheck size={26} /><strong>작업공간 기획서를 복원하고 있습니다.</strong></div>
  return <>
    {active
      ? <DeckWorkbench workspace={active} storageNotice={storageNotice} onChange={update} onBack={() => setActiveId(undefined)} />
      : <DeckLibrary library={library} storageNotice={storageNotice} onOpen={setActiveId} onCreate={create} />}
    {conflict && <StorageConflict onReload={loadConflictVersion} onOverwrite={overwriteConflict} />}
  </>
}

function DeckLibrary({ library, storageNotice, onOpen, onCreate }: {
  library: DeckStudioLibrary
  storageNotice: string
  onOpen: (id: string) => void
  onCreate: (title: string, brief: string) => void
}) {
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const canCreate = title.trim().length > 0 && brief.trim().length > 0
  return (
    <div className="deck-app deck-library">
      <header className="deck-library-header">
        <div>
          <span className="eyebrow">기획서 디자이너</span>
          <h1>논리부터 레이아웃까지 한 흐름으로 설계합니다.</h1>
          <p>회사나 직무를 고르는 정형 입력 대신, 사용자가 적은 원고와 증거에서 문서 구조를 시작합니다.</p>
        </div>
        <div className="local-badge"><ShieldCheck size={15} /> {storageNotice}</div>
      </header>
      <main className="deck-library-grid">
        <section className="recent-decks">
          <div className="section-heading"><div><span>최근 작업</span><strong>{library.workspaces.length}개</strong></div></div>
          {library.workspaces.length ? library.workspaces.map((item) => {
            const direction = item.document.designPlan?.directions.find((candidate) => candidate.id === item.document.designPlan?.selectedDirectionId)
            return (
              <button className="deck-row" key={item.document.sessionId} onClick={() => onOpen(item.document.sessionId)}>
                <span className="deck-row-icon"><FileText size={20} /></span>
                <span><strong>{item.document.title}</strong><small>{item.document.slides.length}장 · 근거 {item.document.inventory.length}개 · {direction?.name || '디자인 방향 미선택'}</small></span>
                <em>r{item.document.revision}</em><ChevronRight size={17} />
              </button>
            )
          }) : <div className="empty-library"><FilePlus2 size={30} /><strong>아직 기획서가 없습니다.</strong><span>오른쪽에서 자유 원고로 첫 작업을 시작하세요.</span></div>}
        </section>
        <section className="create-deck-panel">
          <div className="create-symbol"><Sparkles size={19} /></div>
          <span className="eyebrow">새 기획서</span>
          <h2>머릿속 논리를 먼저 적어주세요.</h2>
          <label><span>기획서 제목</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 회피 손해를 줄이는 전투 시스템 제안" /></label>
          <label><span>자유 원고</span><textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder={'목차를 먼저 만들 필요가 없습니다.\n주장, 실측값, 사례, 비교하고 싶은 내용을 그대로 적으세요.'} /></label>
          <div className="create-note"><FileCheck2 size={15} /><span>원문에 없는 수치는 생성하지 않고, 문장마다 근거를 연결합니다.</span></div>
          <button className="primary-action" disabled={!canCreate} onClick={() => onCreate(title.trim(), brief.trim())}><Plus size={16} /> 로컬 초안 만들기</button>
        </section>
      </main>
    </div>
  )
}

function DeckWorkbench({ workspace, storageNotice, onChange, onBack }: {
  workspace: DeckStudioWorkspace
  storageNotice: string
  onChange: (workspace: DeckStudioWorkspace) => void
  onBack: () => void
}) {
  const [view, setView] = useState<View>('outline')
  const [selectedSlideId, setSelectedSlideId] = useState(workspace.document.slides[0]?.id)
  const [exporting, setExporting] = useState<string>()
  const [notice, setNotice] = useState('')
  const issues = useMemo(() => validateWorkspace(workspace), [workspace])
  const selectedSlide = workspace.document.slides.find((slide) => slide.id === selectedSlideId) || workspace.document.slides[0]
  const change = (next: DeckStudioWorkspace) => {
    onChange(next)
    setNotice('변경사항 저장됨')
  }

  const runExport = async (kind: 'pptx' | 'docx') => {
    if (exporting || issues.some((issue) => issue.severity === 'error')) return
    setExporting(kind)
    setNotice(`${kind.toUpperCase()} 생성 중`)
    try {
      if (kind === 'pptx') await exportWorkspacePptx(workspace.document)
      else await exportWorkspaceDocx(workspace.document)
      setNotice(`${kind.toUpperCase()}와 검증 보고서를 저장했습니다.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setExporting(undefined)
    }
  }

  return (
    <div className="deck-app deck-workbench">
      <header className="deck-toolbar">
        <button className="icon-button" onClick={onBack} aria-label="기획서 목록"><ArrowLeft size={17} /></button>
        <div className="document-title"><strong>{workspace.document.title}</strong><span>DeckIR r{workspace.document.revision}</span></div>
        <div className="toolbar-spacer" />
        <span className="save-state"><span />{notice || storageNotice}</span>
        <button className="export-button" disabled={Boolean(exporting)} onClick={() => void runExport('pptx')}><Download size={14} /> PPTX</button>
        <button className="export-button" disabled={Boolean(exporting)} onClick={() => void runExport('docx')}><Download size={14} /> Word</button>
      </header>
      <div className="deck-workbench-body">
        <aside className="deck-sidebar">
          <nav className="mode-nav">
            <ModeButton active={view === 'outline'} icon={<ListTree size={15} />} label="목차와 주장" onClick={() => setView('outline')} />
            <ModeButton active={view === 'direction'} icon={<Palette size={15} />} label="디자인 방향" onClick={() => setView('direction')} />
            <ModeButton active={view === 'layout'} icon={<LayoutGrid size={15} />} label="장별 레이아웃" onClick={() => setView('layout')} />
            <ModeButton active={view === 'preview'} icon={<MonitorPlay size={15} />} label="슬라이드 편집" onClick={() => setView('preview')} />
            <ModeButton active={view === 'connections'} icon={<Link2 size={15} />} label="도구 자료" onClick={() => setView('connections')} />
            <ModeButton active={view === 'assistant'} icon={<WandSparkles size={15} />} label="선택형 AI" onClick={() => setView('assistant')} />
            <ModeButton active={view === 'audit'} icon={<ShieldCheck size={15} />} label="근거와 검증" badge={issues.length} onClick={() => setView('audit')} />
          </nav>
          <div className="slide-list-heading"><strong>슬라이드</strong><span>{workspace.document.slides.length}</span></div>
          <div className="slide-list">
            {workspace.document.slides.map((slide) => (
              <button className={selectedSlide?.id === slide.id ? 'active' : ''} key={slide.id} onClick={() => setSelectedSlideId(slide.id)}>
                <span>{String(slide.order).padStart(2, '0')}</span><div><strong>{slide.headline.text}</strong><small>{structureLabel(slide.logicalStructure)}</small></div>
              </button>
            ))}
          </div>
        </aside>
        <main className="deck-main">
          {view === 'outline' && <OutlineView workspace={workspace} onChange={change} />}
          {view === 'direction' && <DirectionView workspace={workspace} onChange={(directionId) => { change(selectDesignDirection(workspace, directionId)); setView('layout') }} />}
          {view === 'layout' && <LayoutView workspace={workspace} selectedSlide={selectedSlide} onSelectSlide={setSelectedSlideId} onChange={(slideId, candidateId) => change(selectLayoutCandidate(workspace, slideId, candidateId))} />}
          {view === 'preview' && selectedSlide && <PreviewView workspace={workspace} slide={selectedSlide} onChange={change} />}
          {view === 'connections' && <ConnectionsView workspace={workspace} onChange={change} />}
          {view === 'assistant' && <AiAssistantView workspace={workspace} onChange={change} />}
          {view === 'audit' && <AuditView workspace={workspace} />}
        </main>
      </div>
    </div>
  )
}

function StorageConflict({ onReload, onOverwrite }: { onReload: () => void; onOverwrite: () => void }) {
  return <div className="storage-conflict" role="alertdialog" aria-label="저장 충돌">
    <div><strong>작업공간 저장 충돌</strong><span>다른 화면에서 이 기획서를 더 최근에 저장했습니다. 어느 버전을 남길지 선택하세요.</span></div>
    <button onClick={onReload}>최신본 불러오기</button>
    <button className="danger" onClick={onOverwrite}>내 작업으로 덮어쓰기</button>
  </div>
}

const isDeckLibrary = (value: unknown): value is DeckStudioLibrary => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DeckStudioLibrary>
  return candidate.schemaVersion === 1 && Array.isArray(candidate.workspaces)
}

function ModeButton({ active, icon, label, badge, onClick }: { active: boolean; icon: ReactNode; label: string; badge?: number; onClick: () => void }) {
  return <button className={active ? 'active' : ''} onClick={onClick}>{icon}<span>{label}</span>{badge !== undefined && <b>{badge}</b>}</button>
}

function OutlineView({ workspace, onChange }: { workspace: DeckStudioWorkspace; onChange: (workspace: DeckStudioWorkspace) => void }) {
  return <section className="view-section"><ViewHeader kicker="논리 흐름" title="목차가 아니라 슬라이드별 주장" description="각 헤드라인은 그 장에서 증명할 문장입니다. 직접 고친 내용은 새 사용자 근거로 기록됩니다." />
    <div className="outline-list">{workspace.document.slides.map((slide) => <SlideEditor key={slide.id} slide={slide} onSave={(headline, body) => onChange(updateSlideContent(workspace, slide.id, headline, body))} />)}</div>
  </section>
}

function SlideEditor({ slide, onSave }: { slide: DeckIrSlide; onSave: (headline: string, body: string[]) => void }) {
  const [headline, setHeadline] = useState(slide.headline.text)
  const [body, setBody] = useState(slide.body.map((item) => item.text).join('\n'))
  useEffect(() => { setHeadline(slide.headline.text); setBody(slide.body.map((item) => item.text).join('\n')) }, [slide.id, slide.headline.text])
  return <article className="slide-editor"><header><span>{String(slide.order).padStart(2, '0')}</span><strong>{structureLabel(slide.logicalStructure)}</strong><em>근거 {slide.headline.sourceItemIds.length}</em></header>
    <input value={headline} onChange={(event) => setHeadline(event.target.value)} aria-label={`${slide.order}번 슬라이드 주장`} />
    <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="보조 문장을 한 줄에 하나씩 입력" />
    <footer><small>원문에 없던 수치는 무결성 검사에서 차단됩니다.</small><button onClick={() => onSave(headline.trim(), body.split('\n').map((item) => item.trim()).filter(Boolean))}><Save size={13} /> 저장</button></footer>
  </article>
}

function DirectionView({ workspace, onChange }: { workspace: DeckStudioWorkspace; onChange: (directionId: string) => void }) {
  const plan = workspace.document.designPlan
  return <section className="view-section"><ViewHeader kicker="아트 디렉션" title="내용에서 갈라진 세 가지 표현 방향" description="지원 회사나 직무 프리셋이 아니라 현재 원고의 증거 형태와 논리 구조를 기준으로 제안합니다." />
    <div className="direction-grid">{plan?.directions.map((direction) => {
      const selected = direction.id === plan.selectedDirectionId
      return <article className={`direction-card ${selected ? 'selected' : ''}`} key={direction.id}>
        <div className="palette-preview" style={{ background: direction.palette.canvas, color: direction.palette.ink }}><span style={{ background: direction.palette.accent }} /><strong>{direction.name}</strong><small>{direction.motif.name}</small></div>
        <div className="direction-copy"><p>{direction.rationale}</p><dl><div><dt>근거 표현</dt><dd>{direction.evidenceTreatment}</dd></div><div><dt>형태 언어</dt><dd>{direction.shapeLanguage}</dd></div></dl><button disabled={selected} onClick={() => onChange(direction.id)}>{selected ? <><Check size={14} /> 선택됨</> : '이 방향으로 레이아웃 계산'}</button></div>
      </article>
    })}</div>
  </section>
}

function LayoutView({ workspace, selectedSlide, onSelectSlide, onChange }: { workspace: DeckStudioWorkspace; selectedSlide?: DeckIrSlide; onSelectSlide: (id: string) => void; onChange: (slideId: string, candidateId: string) => void }) {
  const plan = workspace.document.designPlan
  if (!plan?.selectedDirectionId) return <EmptyStage icon={<Palette size={25} />} title="디자인 방향을 먼저 선택하세요." description="방향을 선택하면 각 장의 논리와 밀도에 맞는 후보를 계산합니다." />
  const decision = plan.storyboard.find((item) => item.slideId === selectedSlide?.id) || plan.storyboard[0]
  const slide = workspace.document.slides.find((item) => item.id === decision?.slideId)
  return <section className="view-section layout-view"><ViewHeader kicker="레이아웃 엔진" title="장마다 다른 이유가 있는 레이아웃" description="무작위 템플릿이 아니라 논리 구조, 정보 밀도, 앞뒤 장의 반복을 함께 계산합니다." />
    <div className="layout-slide-strip">{workspace.document.slides.map((item) => <button className={slide?.id === item.id ? 'active' : ''} key={item.id} onClick={() => onSelectSlide(item.id)}>{item.order}</button>)}</div>
    {decision && slide ? <><div className="selected-slide-title"><span>{slide.order}장</span><strong>{slide.headline.text}</strong></div><div className="candidate-grid">{decision.candidates.map((candidate) => <LayoutCard key={candidate.id} candidate={candidate} selected={candidate.id === decision.selectedCandidateId} onClick={() => onChange(slide.id, candidate.id)} />)}</div></> : <EmptyStage icon={<LayoutGrid size={25} />} title="계산된 후보가 없습니다." description="다른 디자인 방향을 선택해 다시 계산할 수 있습니다." />}
  </section>
}

function LayoutCard({ candidate, selected, onClick }: { candidate: LayoutCandidate; selected: boolean; onClick: () => void }) {
  return <button className={`layout-card ${selected ? 'selected' : ''}`} onClick={onClick}><LayoutMiniature candidate={candidate} /><div><strong>{candidate.visualForm}</strong>{selected && <Check size={15} />}</div><p>{candidate.dominantArtifact} · {candidate.readingPath} · {candidate.density}</p><small>{candidate.fitnessReasons[0]}</small></button>
}

function LayoutMiniature({ candidate }: { candidate: LayoutCandidate }) {
  const boxes = candidate.family.includes('split') || candidate.family.includes('criteria') ? 2 : candidate.family.includes('matrix') || candidate.family.includes('system') ? 4 : 3
  return <div className={`layout-mini family-${candidate.family}`}><span className="mini-title" />{Array.from({ length: boxes }, (_, index) => <i key={index} />)}{candidate.hero && <b>HERO</b>}</div>
}

function PreviewView({ workspace, slide, onChange }: {
  workspace: DeckStudioWorkspace
  slide: DeckIrSlide
  onChange: (workspace: DeckStudioWorkspace) => void
}) {
  const visual = getSlideVisualOverride(workspace.document, slide.id)
  const [fontScale, setFontScale] = useState(visual.fontScale)
  const [density, setDensity] = useState(visual.density)
  const slot = workspace.document.imageSlots.find((item) => item.slideId === slide.id)
  const [slotDraft, setSlotDraft] = useState(() => ({
    description: slot?.description || '',
    composition: slot?.composition || '',
    aspectRatio: slot?.aspectRatio || '16:9',
    minWidth: slot?.minWidth || 1920,
    minHeight: slot?.minHeight || 1080,
    annotations: slot?.annotations.join('\n') || ''
  }))
  useEffect(() => {
    const nextVisual = getSlideVisualOverride(workspace.document, slide.id)
    const nextSlot = workspace.document.imageSlots.find((item) => item.slideId === slide.id)
    setFontScale(nextVisual.fontScale)
    setDensity(nextVisual.density)
    setSlotDraft({
      description: nextSlot?.description || '', composition: nextSlot?.composition || '',
      aspectRatio: nextSlot?.aspectRatio || '16:9', minWidth: nextSlot?.minWidth || 1920,
      minHeight: nextSlot?.minHeight || 1080, annotations: nextSlot?.annotations.join('\n') || ''
    })
  }, [slide.id])
  const direction = workspace.document.designPlan?.directions.find((item) => item.id === workspace.document.designPlan?.selectedDirectionId)
  const decision = workspace.document.designPlan?.storyboard.find((item) => item.slideId === slide.id)
  const candidate = decision?.candidates.find((item) => item.id === decision.selectedCandidateId)
  const colors = direction?.palette || { canvas: '#1c2025', surface: '#2a3036', ink: '#eef2f4', muted: '#98a2aa', accent: '#4cc2ef' }
  const canSaveSlot = slotDraft.description.trim() && slotDraft.composition.trim()

  return <section className="preview-workspace">
    <div className="preview-canvas-area">
      <ViewHeader kicker="16:9 실제 화면" title={`${slide.order}장 · ${candidate?.visualForm || structureLabel(slide.logicalStructure)}`} description="선택한 아트 디렉션과 레이아웃을 실제 슬라이드 비율로 확인합니다. 이 화면의 글자 크기와 이미지 슬롯은 PPTX에도 반영됩니다." />
      <div className="slide-preview-wrap">
        <article
          className={`slide-preview preview-family-${candidate?.family || 'asymmetric-split'} density-${density} ${slot ? 'has-image-slot' : ''}`}
          style={{
            '--preview-canvas': colors.canvas, '--preview-surface': colors.surface,
            '--preview-ink': colors.ink, '--preview-muted': colors.muted,
            '--preview-accent': colors.accent, '--preview-font-scale': fontScale
          } as React.CSSProperties}
        >
          <header><i /><span>{workspace.document.title}</span><em>{String(slide.order).padStart(2, '0')}</em></header>
          <h3>{slide.headline.text}</h3>
          <div className="preview-content">
            <div className="preview-body-items">
              {(slide.body.length ? slide.body : [{ text: '보조 문장을 입력하면 이 영역에 표시됩니다.' }]).map((item, index) => <div key={index}><b>{String(index + 1).padStart(2, '0')}</b><span>{item.text}</span></div>)}
            </div>
            {slot && <div className="preview-image-slot"><ImagePlus size={22} /><strong>[IMAGE]</strong><span>{slot.description}</span><small>{slot.aspectRatio} · 최소 {slot.minWidth}×{slot.minHeight}</small>{slot.annotations.map((item) => <em key={item}>{item}</em>)}</div>}
          </div>
          <footer><span>{direction?.motif.name || '편집 가능한 벡터 슬라이드'}</span><b>{candidate?.fingerprint || 'custom'}</b></footer>
        </article>
      </div>
    </div>
    <aside className="preview-inspector">
      <header><span>선택 슬라이드</span><strong>시각 속성</strong></header>
      <section><h4>타이포그래피와 밀도</h4><label><span>제목 크기 <b>{Math.round(fontScale * 100)}%</b></span><input type="range" min="0.8" max="1.25" step="0.05" value={fontScale} onChange={(event) => setFontScale(Number(event.target.value))} /></label><label><span>정보 밀도</span><select value={density} onChange={(event) => setDensity(event.target.value as typeof density)}><option value="spacious">여유롭게</option><option value="balanced">균형</option><option value="dense">촘촘하게</option></select></label><button onClick={() => onChange(updateSlideVisual(workspace, slide.id, { fontScale, density }))}><Save size={13} /> 시각 속성 적용</button></section>
      <section><h4>이미지 슬롯</h4><p>나중에 이미지만 교체해도 주석은 벡터 도형으로 남습니다.</p><label><span>필요한 이미지</span><textarea value={slotDraft.description} onChange={(event) => setSlotDraft({ ...slotDraft, description: event.target.value })} placeholder="무엇을 찍은 이미지인지" /></label><label><span>구도와 순간</span><textarea value={slotDraft.composition} onChange={(event) => setSlotDraft({ ...slotDraft, composition: event.target.value })} placeholder="피사체, 구도, 필요한 순간" /></label><div className="slot-size-row"><label><span>비율</span><input value={slotDraft.aspectRatio} onChange={(event) => setSlotDraft({ ...slotDraft, aspectRatio: event.target.value })} /></label><label><span>최소 너비</span><input type="number" value={slotDraft.minWidth} onChange={(event) => setSlotDraft({ ...slotDraft, minWidth: Number(event.target.value) })} /></label><label><span>최소 높이</span><input type="number" value={slotDraft.minHeight} onChange={(event) => setSlotDraft({ ...slotDraft, minHeight: Number(event.target.value) })} /></label></div><label><span>주석 · 한 줄에 하나</span><textarea value={slotDraft.annotations} onChange={(event) => setSlotDraft({ ...slotDraft, annotations: event.target.value })} placeholder="판정 시작 프레임" /></label><div className="slot-actions"><button disabled={!canSaveSlot} onClick={() => onChange(upsertImageSlot(workspace, slide.id, { ...slotDraft, description: slotDraft.description.trim(), composition: slotDraft.composition.trim(), aspectRatio: slotDraft.aspectRatio.trim() || '16:9', minWidth: Math.max(1, slotDraft.minWidth), minHeight: Math.max(1, slotDraft.minHeight), annotations: slotDraft.annotations.split('\n').map((item) => item.trim()).filter(Boolean) }))}><ImagePlus size={13} /> {slot ? '슬롯 수정' : '슬롯 추가'}</button>{slot && <button className="remove-slot" onClick={() => onChange(removeImageSlot(workspace, slide.id))}><Trash2 size={13} /> 삭제</button>}</div></section>
    </aside>
  </section>
}

const modelPrice = (model: OpenRouterModel | undefined, kind: 'prompt' | 'completion' | 'request'): number => {
  const value = Number(model?.pricing[kind] || 0)
  return Number.isFinite(value) && value >= 0 ? value : 0
}

const estimateTokens = (text: string): number => Math.max(1, Math.ceil([...text].length / 3.2))

function AiAssistantView({ workspace, onChange }: {
  workspace: DeckStudioWorkspace
  onChange: (workspace: DeckStudioWorkspace) => void
}) {
  const [monthlyLimit, setMonthlyLimit] = useState(10)
  const [perRequestLimit, setPerRequestLimit] = useState(0.5)
  const [configured, setConfigured] = useState(false)
  const [key, setKey] = useState('')
  const [budget, setBudget] = useState<AiBudget>()
  const [models, setModels] = useState<OpenRouterModel[]>([])
  const [modelId, setModelId] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('AI는 사용자가 요청하고 승인할 때만 문서에 반영됩니다.')
  const [proposal, setProposal] = useState<AiOutlineProposal>()
  const [charged, setCharged] = useState<number>()
  const model = models.find((item) => item.id === modelId)
  const inventoryPayload = JSON.stringify(workspace.document.inventory.map((item) => ({ id: item.id, text: item.originalText, numbers: item.verbatimNumbers })))
  const systemPrompt = '당신은 한국어 게임 기획서 편집자다. 주어진 원문 인벤토리 안의 주장과 수치만 사용한다. 반드시 JSON 객체만 반환한다. 형식: {"summary":"한 문장","slides":[{"headline":"주장 문장","body":["근거 문장"],"logicalStructure":"comparison|sequence|cause-effect|part-whole|number-focus|declaration|mechanism|tradeoff|custom","sourceItemIds":["실제 인벤토리 ID"]}]}. 원문에 없는 수치나 고유명사를 만들지 말고 각 슬라이드에 실제 근거 ID를 하나 이상 연결한다.'
  const userPrompt = `문서 제목: ${workspace.document.title}\n원문: ${workspace.document.brief.rawText}\n인벤토리: ${inventoryPayload}\n중복을 줄이고 단서·분석·제안·검증의 흐름으로 5~12장의 콘텐츠 슬라이드를 제안해라. 표지 슬라이드는 만들지 마라.`
  const promptTokens = estimateTokens(systemPrompt + userPrompt)
  const maxTokens = 1800
  const estimatedCost = modelPrice(model, 'request') + promptTokens * modelPrice(model, 'prompt') + maxTokens * modelPrice(model, 'completion')
  const proposalIssues = proposal ? validateAiOutlineProposal(workspace, proposal) : []

  const refreshStatus = () => {
    if (!isStudioHosted()) { setMessage('AI 연결은 게임기획 스튜디오 안에서만 사용할 수 있습니다.'); return }
    setBusy('status')
    void getOpenRouterStatus(monthlyLimit).then((response) => {
      setConfigured(response.configured)
      setBudget(response.budget)
      if (response.configured) {
        setMessage('키가 Windows 자격 증명 관리자에 안전하게 저장되어 있습니다.')
        return loadOpenRouterModels(monthlyLimit)
      }
      return undefined
    }).then((response) => {
      if (!response) return
      const available = response.models.filter((item) => item.id && item.pricing)
      setModels(available)
      setBudget(response.budget)
      setModelId((current) => current || available[0]?.id || '')
    }).catch((error) => setMessage(error instanceof Error ? error.message : String(error))).finally(() => setBusy(''))
  }
  useEffect(refreshStatus, [])

  const saveKey = () => {
    if (!key.trim()) return
    setBusy('key')
    void saveOpenRouterKey(key.trim(), monthlyLimit).then((response) => {
      setKey('')
      setConfigured(response.configured)
      setBudget(response.budget)
      setMessage('API 키를 Windows 자격 증명 관리자에 저장했습니다.')
      return loadOpenRouterModels(monthlyLimit)
    }).then((response) => {
      const available = response.models.filter((item) => item.id && item.pricing)
      setModels(available)
      setModelId(available[0]?.id || '')
    }).catch((error) => setMessage(error instanceof Error ? error.message : String(error))).finally(() => setBusy(''))
  }

  const deleteKey = () => {
    setBusy('key')
    void deleteOpenRouterKey(monthlyLimit).then((response) => {
      setConfigured(response.configured)
      setModels([])
      setModelId('')
      setMessage('저장된 API 키를 삭제했습니다.')
    }).catch((error) => setMessage(error instanceof Error ? error.message : String(error))).finally(() => setBusy(''))
  }

  const requestProposal = () => {
    if (!modelId || estimatedCost > perRequestLimit || !configured) return
    setBusy('request')
    setProposal(undefined)
    setMessage('OpenRouter에 목차 제안을 요청하고 있습니다…')
    void requestOpenRouterOutline({
      model: modelId, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      maxTokens, estimatedCost, perRequestLimit, monthlyLimit
    }).then((response) => {
      const raw = response.result as { choices?: Array<{ message?: { content?: string } }> }
      const content = raw.choices?.[0]?.message?.content?.trim() || ''
      const jsonText = content.replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '')
      const parsed = JSON.parse(jsonText) as AiOutlineProposal
      if (!parsed || !Array.isArray(parsed.slides)) throw new Error('AI 응답의 목차 형식이 올바르지 않습니다.')
      setProposal(parsed)
      setBudget(response.budget)
      setCharged(response.charged)
      setMessage('제안이 도착했습니다. 근거와 수치를 확인한 뒤 적용하세요.')
    }).catch((error) => setMessage(error instanceof Error ? error.message : String(error))).finally(() => setBusy(''))
  }

  return <section className="view-section ai-assistant-view"><ViewHeader kicker="선택형 보조 기능" title="AI는 초안을 제안하고, 적용은 사용자가 결정합니다." description="기본 작성·편집·출력은 API 없이 동작합니다. OpenRouter는 목차 재구성이 필요할 때만 켜며, 원문에 없는 수치는 적용 단계에서 다시 차단합니다." />
    <div className="ai-status-bar"><div className={configured ? 'configured' : ''}><KeyRound size={15} /><span><strong>{configured ? 'OpenRouter 연결됨' : 'API 키 없음'}</strong><small>{message}</small></span></div><div><strong>${(budget?.spent || 0).toFixed(4)} / ${monthlyLimit.toFixed(2)}</strong><small>{budget?.month || '이번 달'} 사용량</small></div></div>
    <div className="ai-settings-grid"><section><h3>연결과 비용 제한</h3><label><span>OpenRouter API 키</span><div className="ai-key-row"><input type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} placeholder={configured ? 'Windows에 저장됨' : 'sk-or-v1-…'} /><button disabled={!key.trim() || Boolean(busy)} onClick={saveKey}>저장</button></div></label>{configured && <button className="ai-delete-key" disabled={Boolean(busy)} onClick={deleteKey}>저장된 키 삭제</button>}<div className="ai-limit-row"><label><span>월 한도 · USD</span><input type="number" min="0" max="100" step="1" value={monthlyLimit} onChange={(event) => setMonthlyLimit(Math.max(0, Number(event.target.value)))} /></label><label><span>요청당 한도</span><input type="number" min="0" max={monthlyLimit} step="0.05" value={perRequestLimit} onChange={(event) => setPerRequestLimit(Math.max(0, Number(event.target.value)))} /></label></div><p>앱은 요청 전에 예상 비용을 네이티브 계층에서 차단하고 실제 비용을 기록합니다. 결제 상한을 완전히 고정하려면 OpenRouter 키에도 동일한 한도를 설정하세요.</p></section>
      <section><h3>모델과 예상 비용</h3><label><span>OpenRouter 모델</span><select disabled={!configured || Boolean(busy)} value={modelId} onChange={(event) => setModelId(event.target.value)}><option value="">모델 선택</option>{models.map((item) => <option value={item.id} key={item.id}>{item.name || item.id}</option>)}</select></label><dl><div><dt>입력 추정</dt><dd>{promptTokens.toLocaleString()} tokens</dd></div><div><dt>최대 출력</dt><dd>{maxTokens.toLocaleString()} tokens</dd></div><div><dt>요청 전 예상</dt><dd>${estimatedCost.toFixed(4)}</dd></div>{charged !== undefined && <div><dt>최근 실제/기록 비용</dt><dd>${charged.toFixed(4)}</dd></div>}</dl><button className="ai-request" disabled={!configured || !modelId || Boolean(busy) || estimatedCost > perRequestLimit || estimatedCost + (budget?.spent || 0) > monthlyLimit} onClick={requestProposal}><WandSparkles size={14} /> {busy === 'request' ? '제안 생성 중…' : '목차 제안 받기'}</button>{estimatedCost > perRequestLimit && <p className="ai-warning">예상 비용이 요청당 한도를 초과합니다.</p>}</section></div>
    <section className="ai-proposal"><header><div><span>검토 대기</span><h3>AI 목차 제안</h3></div>{proposal && <strong>{proposal.slides.length}장</strong>}</header>{proposal ? <><p className="ai-proposal-summary">{proposal.summary}</p><div className="ai-proposal-slides">{proposal.slides.map((slide, index) => <article key={index}><span>{String(index + 2).padStart(2, '0')}</span><div><strong>{slide.headline}</strong><small>{structureLabel(slide.logicalStructure)} · 근거 {slide.sourceItemIds.join(', ')}</small>{slide.body.map((item) => <p key={item}>{item}</p>)}</div></article>)}</div>{proposalIssues.length > 0 && <div className="ai-proposal-errors">{proposalIssues.map((issue) => <span key={issue}>{issue}</span>)}</div>}<footer><span>적용하면 현재 목차는 변경 이력에 남고 디자인 방향은 다시 계산합니다.</span><button disabled={proposalIssues.length > 0} onClick={() => { onChange(applyAiOutlineProposal(workspace, proposal)); setProposal(undefined); setMessage('검토한 목차 제안을 적용했습니다.') }}><Check size={14} /> 검토 후 적용</button></footer></> : <div className="ai-proposal-empty"><Sparkles size={22} /><strong>아직 요청한 제안이 없습니다.</strong><span>모델과 예상 비용을 확인한 뒤 필요할 때만 요청하세요.</span></div>}</section>
  </section>
}

function ConnectionsView({ workspace, onChange }: {
  workspace: DeckStudioWorkspace
  onChange: (workspace: DeckStudioWorkspace) => void
}) {
  const [catalog, setCatalog] = useState<CatalogArtifact[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('테이블과 패턴 도구에서 작업한 자료를 명시적으로 참조할 수 있습니다.')
  const attached = getAttachedArtifacts(workspace.document)
  const refresh = () => {
    if (!isStudioWorkspace()) {
      setMessage('도구 자료 연결은 게임기획 스튜디오 작업공간에서 사용할 수 있습니다.')
      return
    }
    setLoading(true)
    void listStudioArtifacts().then((records) => {
      const usable = records.filter((item) => item.toolId !== 'deck-designer' && item.catalogId && item.toolId) as Array<PublishedArtifact & { catalogId: string; toolId: string }>
      setCatalog(usable as CatalogArtifact[])
      setMessage(usable.length > 0 ? '현재 작업공간에서 게시된 최신 자료입니다.' : '아직 게시된 자료가 없습니다. 테이블 또는 패턴 도구를 한 번 열어 주세요.')
    }).catch((error) => setMessage(error instanceof Error ? error.message : String(error))).finally(() => setLoading(false))
  }
  useEffect(refresh, [])
  return <section className="view-section connections-view"><ViewHeader kicker="명시적 참조" title="필요한 도구 자료만 기획서에 연결합니다." description="도구를 열었다고 자동 연결하지 않습니다. 테이블이나 패턴 자료를 선택해 참조하고, 원하는 장에서만 편집 가능한 벡터 슬라이드로 삽입합니다." />
    <div className="connections-toolbar"><span>{message}</span><button disabled={loading} onClick={refresh}><RefreshCw size={13} /> {loading ? '확인 중…' : '자료 새로고침'}</button></div>
    <div className="connections-columns"><section><header><div><span>작업공간 자료</span><strong>{catalog.length}</strong></div></header>{catalog.length ? catalog.map((artifact) => {
      const current = attached.find((item) => item.catalogId === artifact.catalogId)
      const stale = current && current.fingerprint !== artifact.fingerprint
      return <article className="artifact-row" key={artifact.catalogId}><span className={`artifact-icon ${artifact.kind === 'data-table' ? 'table' : 'pattern'}`}>{artifact.kind === 'data-table' ? <Database size={17} /> : <Link2 size={17} />}</span><div><strong>{artifact.title}</strong><small>{artifact.toolId === 'table-designer' ? '테이블 디자이너' : '패턴 디자이너'} · {artifact.summary || artifact.kind}</small><em>{stale ? '연결 후 변경됨' : current ? '참조 중' : '연결 안 됨'}</em></div>{!current ? <button onClick={() => onChange(attachStudioArtifact(workspace, artifact))}>참조</button> : stale ? <button onClick={() => onChange(refreshStudioArtifact(workspace, artifact))}>최신화</button> : <Check size={15} />}</article>
    }) : <div className="artifact-empty"><Link2 size={21} /><strong>게시된 자료가 없습니다.</strong><span>같은 작업공간의 테이블 또는 패턴 도구를 열면 자료 목록이 갱신됩니다.</span></div>}</section>
      <section><header><div><span>기획서 참조</span><strong>{attached.length}</strong></div></header>{attached.length ? attached.map((artifact) => {
        const latest = catalog.find((item) => item.catalogId === artifact.catalogId)
        const stale = latest && latest.fingerprint !== artifact.fingerprint
        return <article className="attached-artifact" key={artifact.catalogId}><div><span>{artifact.kind === 'data-table' ? <Database size={15} /> : <Link2 size={15} />}</span><div><strong>{artifact.title}</strong><small>{artifact.slideIds.length}개 슬라이드에서 사용 · {stale ? '최신화 필요' : '최신'}</small></div></div><div className="attached-actions">{stale && latest && <button onClick={() => onChange(refreshStudioArtifact(workspace, latest))}><RefreshCw size={12} /> 최신화</button>}<button onClick={() => onChange(insertStudioArtifactSlide(workspace, artifact.catalogId))}><Plus size={12} /> 벡터 슬라이드 삽입</button><button className="detach" disabled={artifact.slideIds.length > 0} title={artifact.slideIds.length > 0 ? '사용 중인 슬라이드를 먼저 삭제해야 합니다.' : '참조 해제'} onClick={() => onChange(detachStudioArtifact(workspace, artifact.catalogId))}><Unlink size={12} /></button></div></article>
      }) : <div className="artifact-empty"><Database size={21} /><strong>참조한 자료가 없습니다.</strong><span>왼쪽 목록에서 필요한 자료만 선택하세요.</span></div>}</section></div>
  </section>
}

function AuditView({ workspace }: { workspace: DeckStudioWorkspace }) {
  const issues = validateWorkspace(workspace)
  const errors = issues.filter((item) => item.severity === 'error')
  const [outputReport, setOutputReport] = useState<OutputPreflightReport>()
  const [checking, setChecking] = useState(false)
  const checkOutput = () => {
    setChecking(true)
    void runOutputPreflight(workspace.document).then(setOutputReport).finally(() => setChecking(false))
  }
  useEffect(() => { checkOutput() }, [workspace.document.revision])
  return <section className="view-section"><ViewHeader kicker="무결성" title="모든 문장은 원문으로 돌아갈 수 있어야 합니다." description="수치 추적, 레이아웃 반복, 누락된 자료와 이미지 슬롯을 내보내기 전에 확인합니다." />
    <div className="audit-summary"><div><strong>{workspace.document.inventory.length}</strong><span>근거 항목</span></div><div><strong>{outputReport?.slideCount ?? workspace.document.slides.length}</strong><span>출력 슬라이드</span></div><div><strong>{errors.length + (outputReport?.issues.filter((item) => item.severity === 'error').length || 0)}</strong><span>차단 오류</span></div><div><strong>{outputReport?.liveTextCount ?? '—'}</strong><span>라이브 텍스트</span></div></div>
    <div className="output-preflight"><div><strong>Office 출고 전 검사</strong><span>{checking ? 'PPTX·DOCX 구조를 검사 중입니다.' : outputReport ? `PPTX ${Math.round(outputReport.pptxBytes / 1024)}KB · DOCX ${Math.round(outputReport.docxBytes / 1024)}KB` : '아직 검사하지 않았습니다.'}</span></div><button disabled={checking} onClick={checkOutput}><ShieldCheck size={13} /> 다시 검사</button></div>
    <div className="audit-grid"><section><h3>검사 결과</h3>{[...issues, ...(outputReport?.issues || []).map((item) => ({ ...item, path: item.slideOrder ? `slides.${item.slideOrder}` : item.format }))].length ? [...issues, ...(outputReport?.issues || []).map((item) => ({ ...item, path: item.slideOrder ? `slides.${item.slideOrder}` : item.format }))].map((issue, index) => <div className={`issue ${issue.severity}`} key={`${issue.code}-${index}`}><strong>{issue.code}</strong><span>{issue.message}</span><small>{issue.path}</small></div>) : <div className="audit-pass"><ShieldCheck size={21} /><strong>무결성과 Office 구조 검사를 통과했습니다.</strong><span>편집 가능한 PPTX와 Word를 내보낼 수 있습니다.</span></div>}</section><section><h3>원문 인벤토리</h3>{workspace.document.inventory.map((item) => <div className="inventory-row" key={item.id}><span>{item.type}</span><p>{item.originalText}</p>{item.verbatimNumbers.length > 0 && <b>{item.verbatimNumbers.join(', ')}</b>}</div>)}</section></div>
  </section>
}

function ViewHeader({ kicker, title, description }: { kicker: string; title: string; description: string }) {
  return <header className="view-header"><span>{kicker}</span><h2>{title}</h2><p>{description}</p></header>
}

function EmptyStage({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className="empty-stage">{icon}<strong>{title}</strong><span>{description}</span></div>
}

const structureLabel = (value: DeckIrSlide['logicalStructure']): string => ({
  comparison: '비교', sequence: '과정', 'cause-effect': '인과', 'part-whole': '구조', 'number-focus': '수치', declaration: '선언', mechanism: '메커니즘', tradeoff: '트레이드오프', custom: '맞춤'
})[value]
