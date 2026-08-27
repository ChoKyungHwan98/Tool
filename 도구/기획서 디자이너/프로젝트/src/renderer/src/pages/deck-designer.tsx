import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  ChevronRight,
  Database,
  FilePenLine,
  FileText,
  History,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Palette,
  Presentation,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import type { DeckIrDocument, DeckIrIntegrityIssue, DeckIrSlide } from '@shared/deck-ir'
import type { LayoutCandidate } from '@shared/design-engine'
import { ipc } from '@renderer/lib/ipc'
import { Button } from '@renderer/components/ui/Button'
import { Input, Textarea } from '@renderer/components/ui/Input'
import { ScrollArea } from '@renderer/components/ui/ScrollArea'
import { cn } from '@renderer/lib/utils'
import { useToastStore } from '@renderer/store/toastStore'

type WorkspaceTab = 'outline' | 'direction' | 'layout' | 'audit'

const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof FilePenLine }> = [
  { id: 'outline', label: '목차와 주장', icon: FilePenLine },
  { id: 'direction', label: '디자인 방향', icon: Palette },
  { id: 'layout', label: '장별 레이아웃', icon: LayoutGrid },
  { id: 'audit', label: '근거와 검증', icon: ShieldCheck }
]

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

function SlideEditor({
  slide,
  busy,
  onSave
}: {
  slide: DeckIrSlide
  busy: boolean
  onSave: (headline: string, body: string[]) => Promise<void>
}): React.JSX.Element {
  const [headline, setHeadline] = useState(slide.headline.text)
  const [body, setBody] = useState(slide.body.map((item) => item.text).join('\n'))

  useEffect(() => {
    setHeadline(slide.headline.text)
    setBody(slide.body.map((item) => item.text).join('\n'))
  }, [slide])

  return (
    <article className="rounded-2xl border border-[#d8d0c1] bg-white/85 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#26352c] text-xs font-semibold text-white">
            {slide.order}
          </span>
          <span className="rounded-full bg-[#eef0e8] px-2.5 py-1 text-[11px] text-[#52604f]">
            {slide.logicalStructure}
          </span>
          <span className="text-[11px] text-[#8a8f84]">{slide.role}</span>
        </div>
        <span className="text-[11px] text-[#8a8f84]">
          근거 {new Set(slide.headline.sourceItemIds).size}개
        </span>
      </div>
      <Input
        value={headline}
        onChange={(event) => setHeadline(event.target.value)}
        className="h-11 border-[#d8d0c1] bg-[#fbfaf6] text-[15px] font-semibold"
        aria-label={`${slide.order}번 슬라이드 주장`}
      />
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className="mt-3 min-h-24 border-[#d8d0c1] bg-[#fbfaf6] text-sm leading-6"
        placeholder="보조 문장을 한 줄에 하나씩 입력"
        aria-label={`${slide.order}번 슬라이드 본문`}
      />
      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="text-[11px] leading-5 text-[#7e8479]">
          직접 고친 문장은 새 사용자 근거로 기록되어 수치 추적이 유지됩니다.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !headline.trim()}
          onClick={() =>
            void onSave(
              headline,
              body
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
            )
          }
        >
          <Save className="mr-1.5 h-3.5 w-3.5" /> 저장
        </Button>
      </div>
    </article>
  )
}

const candidateLabel = (candidate: LayoutCandidate): string =>
  `${candidate.visualForm} · ${candidate.anchorZone} · ${candidate.density}`

function LayoutMiniature({
  candidate,
  selected
}: {
  candidate: LayoutCandidate
  selected: boolean
}): React.JSX.Element {
  const ink = selected ? '#263c3a' : '#46505a'
  const accent = selected ? '#d85f43' : '#9aa2a8'
  const surface = selected ? '#f3eee6' : '#efefec'
  const line = selected ? '#b8c7c3' : '#cdd1d2'
  const family = candidate.family
  const isSplit = [
    'asymmetric-split',
    'shared-criteria',
    'mirrored-evidence',
    'before-after-hinge'
  ].includes(family)
  const isPath = ['progression-track', 'staged-path', 'causal-chain'].includes(family)
  const isMap = ['system-map', 'modular-matrix', 'state-machine'].includes(family)
  const isMetric = ['metric-stage', 'chart-argument'].includes(family)
  const isTimeline = ['judgement-timeline', 'annotated-artifact'].includes(family)
  const isTradeoff = ['tradeoff-field', 'spectrum-balance'].includes(family)
  const isStatement = ['statement-field', 'editorial-axis'].includes(family)

  return (
    <div
      className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-lg border"
      style={{ backgroundColor: surface, borderColor: line }}
      aria-hidden="true"
    >
      <span
        className="absolute left-[7%] top-[9%] h-[4%] w-[22%] rounded-full"
        style={{ backgroundColor: accent }}
      />
      {isSplit ? (
        <>
          <span
            className="absolute bottom-[12%] left-[7%] top-[22%] w-[40%] rounded-md"
            style={{ backgroundColor: ink }}
          />
          <span
            className="absolute bottom-[12%] right-[7%] top-[22%] w-[36%] rounded-md border-2"
            style={{ borderColor: accent }}
          />
          <span
            className="absolute left-1/2 top-[24%] h-[58%] w-px -translate-x-1/2"
            style={{ backgroundColor: line }}
          />
        </>
      ) : isPath ? (
        <>
          <span
            className="absolute left-[12%] right-[12%] top-[56%] h-[3%] rounded-full"
            style={{ backgroundColor: line }}
          />
          {[18, 40, 62, 84].map((left, index) => (
            <span
              key={left}
              className="absolute top-[45%] h-[22%] w-[10%] -translate-x-1/2 rounded-full border-[3px]"
              style={{
                left: `${left}%`,
                backgroundColor: index === 2 ? accent : surface,
                borderColor: index === 2 ? accent : ink
              }}
            />
          ))}
        </>
      ) : isMap ? (
        <>
          <span
            className="absolute left-1/2 top-1/2 h-[28%] w-[20%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ backgroundColor: accent }}
          />
          {[
            ['15%', '30%'],
            ['67%', '27%'],
            ['17%', '68%'],
            ['69%', '67%']
          ].map(([left, top]) => (
            <span
              key={`${left}-${top}`}
              className="absolute h-[16%] w-[18%] rounded-md"
              style={{ left, top, backgroundColor: ink }}
            />
          ))}
        </>
      ) : isMetric ? (
        <>
          <span
            className="absolute bottom-[15%] left-[8%] top-[25%] w-[38%] rounded-md"
            style={{ backgroundColor: ink }}
          />
          {[30, 46, 62, 78].map((left, index) => (
            <span
              key={left}
              className="absolute bottom-[16%] w-[7%] rounded-t-sm"
              style={{
                left: `${left + 20}%`,
                height: `${18 + index * 11}%`,
                backgroundColor: index === 3 ? accent : line
              }}
            />
          ))}
        </>
      ) : isTimeline ? (
        <>
          <span
            className="absolute bottom-[20%] left-[8%] right-[8%] h-[3%] rounded-full"
            style={{ backgroundColor: ink }}
          />
          {[18, 38, 58, 78].map((left, index) => (
            <span
              key={left}
              className="absolute bottom-[16%] w-[3%] rounded-full"
              style={{
                left: `${left}%`,
                height: `${25 + (index % 2) * 22}%`,
                backgroundColor: index === 2 ? accent : line
              }}
            />
          ))}
        </>
      ) : isTradeoff ? (
        <>
          <span
            className="absolute bottom-[14%] left-1/2 top-[25%] w-px"
            style={{ backgroundColor: line }}
          />
          <span
            className="absolute left-[12%] right-[12%] top-[58%] h-px"
            style={{ backgroundColor: line }}
          />
          <span
            className="absolute left-[62%] top-[34%] h-[18%] w-[12%] rounded-full"
            style={{ backgroundColor: accent }}
          />
          <span
            className="absolute left-[31%] top-[65%] h-[13%] w-[9%] rounded-full"
            style={{ backgroundColor: ink }}
          />
        </>
      ) : isStatement ? (
        <>
          <span
            className="absolute left-[12%] right-[18%] top-[36%] h-[13%] rounded-md"
            style={{ backgroundColor: ink }}
          />
          <span
            className="absolute left-[12%] right-[38%] top-[56%] h-[7%] rounded-full"
            style={{ backgroundColor: accent }}
          />
        </>
      ) : (
        <>
          <span
            className="absolute bottom-[12%] left-[7%] top-[24%] w-[55%] rounded-md"
            style={{ backgroundColor: ink }}
          />
          <span
            className="absolute bottom-[12%] right-[7%] top-[38%] w-[24%] rounded-md"
            style={{ backgroundColor: accent }}
          />
        </>
      )}
    </div>
  )
}

export function DeckDesignerPage(): React.JSX.Element {
  const { id: sessionId } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const toast = useToastStore()
  const [title, setTitle] = useState('')
  const [rawBrief, setRawBrief] = useState('')
  const [document, setDocument] = useState<DeckIrDocument | null>(null)
  const [briefDraft, setBriefDraft] = useState('')
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('outline')
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(sessionId))
  const [issues, setIssues] = useState<DeckIrIntegrityIssue[]>([])
  const [revisions, setRevisions] = useState<
    Array<{
      revision: number
      actor: 'user' | 'ai' | 'system'
      reason: string
      checksum: string
      createdAt: number
    }>
  >([])

  const refreshAuxiliary = async (next: DeckIrDocument): Promise<void> => {
    const [validation, history] = await Promise.all([
      ipc.validateDeckIr(next),
      ipc.listDeckIrRevisions(next.sessionId)
    ])
    setIssues(validation.issues)
    setRevisions(history)
  }

  const acceptDocument = async (next: DeckIrDocument): Promise<void> => {
    setDocument(next)
    setBriefDraft(next.brief.rawText)
    await refreshAuxiliary(next)
  }

  useEffect(() => {
    if (!sessionId) return
    let active = true
    setLoading(true)
    void ipc
      .getDeckIr(sessionId)
      .then(async (next) => {
        if (!active) return
        if (!next) throw new Error('이 세션에는 기획서 작업공간이 없습니다.')
        await acceptDocument(next)
      })
      .catch((error) => {
        if (active)
          toast.error('작업공간을 불러오지 못했습니다.', { description: errorMessage(error) })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // acceptDocument intentionally depends only on the route identity here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const run = async (label: string, task: () => Promise<DeckIrDocument>): Promise<void> => {
    if (busy) return
    setBusy(label)
    try {
      const next = await task()
      await acceptDocument(next)
      toast.success(`${label} 완료`)
    } catch (error) {
      toast.error(`${label} 실패`, { description: errorMessage(error), duration: 8000 })
    } finally {
      setBusy(null)
    }
  }

  const runExport = async (kind: 'pptx' | 'docx'): Promise<void> => {
    if (busy || !document) return
    const label = kind === 'pptx' ? 'PPTX 내보내기' : 'Word 내보내기'
    setBusy(label)
    try {
      const result =
        kind === 'pptx'
          ? await ipc.exportDeckIrPptx(document.sessionId)
          : await ipc.exportDeckIrDocx(document.sessionId)
      if (!result.cancelled && result.success) {
        toast.success(`${label} 완료`, {
          description: `${result.pageCount || document.slides.length}장 · 검증 보고서도 함께 저장했습니다.`
        })
      }
    } catch (error) {
      toast.error(`${label} 실패`, { description: errorMessage(error), duration: 8000 })
    } finally {
      setBusy(null)
    }
  }

  const createWorkspace = async (): Promise<void> => {
    if (!title.trim() || !rawBrief.trim()) {
      toast.warning('제목과 자유 입력 원고를 모두 적어주세요.')
      return
    }
    setBusy('작업공간 생성')
    try {
      const next = await ipc.createDeckIrWorkspace({ title: title.trim(), rawBrief })
      navigate(`/designer/${next.sessionId}`, { replace: true })
    } catch (error) {
      toast.error('작업공간 생성 실패', { description: errorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  const selectedDirection = useMemo(() => {
    const plan = document?.designPlan
    return plan?.directions.find((item) => item.id === plan.selectedDirectionId) || null
  }, [document])

  if (!sessionId) {
    return (
      <div className="h-full min-h-0 overflow-auto bg-[#f4f1ea] px-8 py-10 text-[#17202a]">
        <main className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-[#d8d2c8] bg-white shadow-[0_24px_70px_rgba(23,32,42,0.10)] lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
          <section className="p-8 lg:p-10">
            <div className="mb-8">
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-[#d85f43]">
                <FilePenLine className="h-3.5 w-3.5" /> 기획서 설계 작업공간
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.045em] text-[#17202a] sm:text-4xl">
                머릿속 논리를 그대로 시작점으로 씁니다.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[#687078]">
                회사·프로젝트·직무를 정해진 칸에 맞추지 않습니다. 목적, 주장, 실측값, 참고 문구를
                편한 순서로 적으면 내용의 관계를 읽고 목차와 시각 문법을 따로 설계합니다.
              </p>
            </div>

            <label className="text-xs font-semibold text-[#505a62]">작업 제목</label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 h-12 border-[#d3cec5] bg-[#fbfaf7] text-base focus-visible:ring-[#d85f43]/25"
              placeholder="예: 전투 기획 포트폴리오"
            />
            <label className="mt-6 block text-xs font-semibold text-[#505a62]">
              자유 입력 원고
            </label>
            <Textarea
              value={rawBrief}
              onChange={(event) => setRawBrief(event.target.value)}
              className="mt-2 min-h-[300px] resize-y border-[#d3cec5] bg-[#fbfaf7] p-4 text-[15px] leading-7 focus-visible:ring-[#d85f43]/25"
              placeholder="왜 이 문서를 만드는지, 무엇을 보여주고 싶은지, 이미 가진 수치와 사례는 무엇인지 자유롭게 적으세요. 모르는 값은 비워도 됩니다."
            />
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-lg text-xs leading-5 text-[#7a8187]">
                기본 AI는 로그인된 Codex 구독을 사용합니다. OpenRouter는 직접 선택한 경우에만 비용
                한도 안에서 호출합니다.
              </p>
              <Button
                className="shrink-0 bg-[#d85f43] text-white hover:bg-[#c95137]"
                disabled={Boolean(busy)}
                onClick={() => void createWorkspace()}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                논리 지도 만들기 <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </section>

          <aside className="relative overflow-hidden bg-[#17202a] p-8 text-white lg:p-10">
            <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full border border-white/8" />
            <div className="absolute -right-6 -top-10 h-36 w-36 rounded-full border border-[#d85f43]/35" />
            <div className="relative">
              <p className="text-[11px] font-semibold tracking-[0.13em] text-[#e77b62]">
                한 원고에서 달라지는 것
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em]">
                템플릿을 고르는 대신,
                <br />이 문서의 규칙을 만듭니다.
              </h2>
              <div className="mt-8 space-y-3">
                {[
                  {
                    icon: Database,
                    title: '근거와 주장을 분리',
                    body: '수치와 문장을 원문까지 역추적합니다.'
                  },
                  {
                    icon: Palette,
                    title: '맥락에서 시각 문법 도출',
                    body: '주제에 따라 색, 모티프, 증거 표현을 새로 정합니다.'
                  },
                  {
                    icon: LayoutGrid,
                    title: '장마다 레이아웃 후보 비교',
                    body: '논리 구조와 앞뒤 장의 리듬을 함께 계산합니다.'
                  },
                  {
                    icon: ShieldCheck,
                    title: '편집 가능한 결과와 검증',
                    body: 'PPTX·Word와 누락 데이터 보고서를 함께 남깁니다.'
                  }
                ].map((item) => (
                  <div key={item.title} className="flex gap-3 rounded-xl bg-white/6 p-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/9">
                      <item.icon className="h-4 w-4 text-[#e77b62]" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{item.title}</div>
                      <div className="mt-1 text-[11px] leading-5 text-white/52">{item.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </main>
      </div>
    )
  }

  if (loading || !document) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f4f0e7] text-sm text-[#677064]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 작업공간을 불러오는 중
      </div>
    )
  }

  const aiInventoryCount = document.inventory.filter((item) => !item.userConfirmed).length
  const errorCount = issues.filter((issue) => issue.severity === 'error').length

  return (
    <div className="flex h-full min-h-0 bg-[#f3efe6] text-[#232c26]">
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-[#d8d0c1] bg-[#ebe5d9]">
        <div className="border-b border-[#d8d0c1] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-[#737b71]">DECK IR</p>
              <h1 className="mt-1 line-clamp-2 text-lg font-semibold">{document.title}</h1>
            </div>
            <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] text-[#687166]">
              r{document.revision}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/60 px-2 py-2">
              <div className="text-base font-semibold">{document.inventory.length}</div>
              <div className="text-[10px] text-[#757d72]">근거</div>
            </div>
            <div className="rounded-xl bg-white/60 px-2 py-2">
              <div className="text-base font-semibold">{document.slides.length}</div>
              <div className="text-[10px] text-[#757d72]">슬라이드</div>
            </div>
            <div className="rounded-xl bg-white/60 px-2 py-2">
              <div className={cn('text-base font-semibold', errorCount ? 'text-[#b14f45]' : '')}>
                {errorCount}
              </div>
              <div className="text-[10px] text-[#757d72]">오류</div>
            </div>
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-5">
            <label className="text-xs font-semibold text-[#505b50]">자유 입력 원고</label>
            <Textarea
              value={briefDraft}
              onChange={(event) => setBriefDraft(event.target.value)}
              className="mt-2 min-h-[300px] resize-y border-[#d0c6b5] bg-[#fffdf8] text-sm leading-6"
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full"
              disabled={Boolean(busy) || briefDraft.trim() === document.brief.rawText.trim()}
              onClick={() =>
                void run('원고 저장', () =>
                  ipc.updateDeckIrBrief({ sessionId: document.sessionId, rawBrief: briefDraft })
                )
              }
            >
              <Save className="mr-2 h-3.5 w-3.5" /> 원고 변경 기록
            </Button>

            <div className="my-5 h-px bg-[#d7cebf]" />
            <p className="text-xs font-semibold text-[#505b50]">진행 단계</p>
            <div className="mt-3 space-y-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                disabled={Boolean(busy)}
                onClick={() =>
                  void run('근거 추출', () =>
                    ipc.runDeckIrStage({
                      sessionId: document.sessionId,
                      stage: 'extract-inventory'
                    })
                  )
                }
              >
                <Database className="mr-2 h-3.5 w-3.5" /> 근거 추출
                {aiInventoryCount > 0 ? (
                  <span className="ml-auto text-[10px] text-[#6e786b]">AI {aiInventoryCount}</span>
                ) : null}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                disabled={Boolean(busy) || document.inventory.length === 0}
                onClick={() =>
                  void run('목차 제안', async () => {
                    const next = await ipc.runDeckIrStage({
                      sessionId: document.sessionId,
                      stage: 'propose-outline'
                    })
                    setActiveTab('outline')
                    return next
                  })
                }
              >
                <Sparkles className="mr-2 h-3.5 w-3.5" /> 논리 목차 제안
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                disabled={Boolean(busy) || document.slides.length === 0}
                onClick={() =>
                  void run('디자인 방향 제안', async () => {
                    const next = await ipc.runDeckIrStage({
                      sessionId: document.sessionId,
                      stage: 'propose-directions'
                    })
                    setActiveTab('direction')
                    return next
                  })
                }
              >
                <Palette className="mr-2 h-3.5 w-3.5" /> 디자인 방향 2–3안
              </Button>
            </div>
            <div className="my-5 h-px bg-[#d7cebf]" />
            <p className="text-xs font-semibold text-[#505b50]">내보내기</p>
            <p className="mt-1 text-[11px] leading-5 text-[#747c72]">
              선택한 디자인과 레이아웃을 그대로 사용하며 API를 호출하지 않습니다.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={Boolean(busy) || document.slides.length === 0 || errorCount > 0}
                onClick={() => void runExport('pptx')}
              >
                <Presentation className="mr-1.5 h-3.5 w-3.5" /> PPTX
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={Boolean(busy) || document.slides.length === 0 || errorCount > 0}
                onClick={() => void runExport('docx')}
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" /> Word
              </Button>
            </div>
            {errorCount > 0 ? (
              <p className="mt-2 text-[11px] leading-5 text-[#9a4d45]">
                무결성 오류를 해결하면 내보낼 수 있습니다.
              </p>
            ) : null}
            {busy ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#26352c] px-3 py-2.5 text-xs text-white">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {busy} 중
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#d8d0c1] bg-[#fffdf8]/90 px-6">
          <nav className="flex items-center gap-1 rounded-xl bg-[#eee9df] p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-white text-[#273229] shadow-sm'
                    : 'text-[#70786e] hover:text-[#37423a]'
                )}
              >
                <tab.icon className="h-3.5 w-3.5" /> {tab.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-xs text-[#6f786d]">
            {selectedDirection ? (
              <span className="rounded-full border border-[#d6cebf] bg-white px-3 py-1.5">
                {selectedDirection.name}
              </span>
            ) : (
              <span>디자인 방향 미선택</span>
            )}
          </div>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto w-full max-w-6xl p-6">
            {activeTab === 'outline' ? (
              <section>
                <div className="mb-5 flex items-end justify-between gap-6">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-[-0.03em]">
                      목차가 아니라 논증 흐름
                    </h2>
                    <p className="mt-2 text-sm text-[#71786f]">
                      각 장의 헤드라인이 그 장에서 증명할 문장입니다. 직접 수정해도 근거 이력은
                      남습니다.
                    </p>
                  </div>
                </div>
                {document.slides.length > 0 ? (
                  <div className="space-y-3">
                    {document.slides.map((slide) => (
                      <SlideEditor
                        key={slide.id}
                        slide={slide}
                        busy={Boolean(busy)}
                        onSave={(headline, body) =>
                          run(`슬라이드 ${slide.order} 저장`, () =>
                            ipc.updateDeckIrSlide({
                              sessionId: document.sessionId,
                              slideId: slide.id,
                              headline,
                              body
                            })
                          )
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#cfc5b3] bg-white/50 p-12 text-center text-sm text-[#777e75]">
                    왼쪽에서 근거를 추출한 뒤 ‘논리 목차 제안’을 실행하세요.
                  </div>
                )}
              </section>
            ) : null}

            {activeTab === 'direction' ? (
              <section>
                <h2 className="text-2xl font-semibold tracking-[-0.03em]">
                  원고에서 나온 디자인 방향
                </h2>
                <p className="mt-2 text-sm text-[#71786f]">
                  업종 프리셋이 아니라 이 문서의 어조, 증거 형태, 논리 전환에서 만든 대안입니다.
                </p>
                <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {(document.designPlan?.directions.length || 0) > 0 ? (
                    document.designPlan!.directions.map((direction) => {
                      const selected = direction.id === document.designPlan?.selectedDirectionId
                      return (
                        <article
                          key={direction.id}
                          className={cn(
                            'overflow-hidden rounded-2xl border bg-white shadow-sm',
                            selected
                              ? 'border-[#4e674e] ring-2 ring-[#799477]/25'
                              : 'border-[#d8d0c1]'
                          )}
                        >
                          <div
                            className="h-24 p-4"
                            style={{
                              backgroundColor: direction.palette.canvas,
                              color: direction.palette.ink
                            }}
                          >
                            <div className="flex h-full items-end justify-between gap-4">
                              <span className="text-xl font-semibold">{direction.name}</span>
                              <span
                                className="h-8 w-8 rounded-full border-4"
                                style={{
                                  backgroundColor: direction.palette.accent,
                                  borderColor: direction.palette.surface
                                }}
                              />
                            </div>
                          </div>
                          <div className="p-4">
                            <p className="min-h-16 text-sm leading-6 text-[#596159]">
                              {direction.rationale}
                            </p>
                            <dl className="mt-4 space-y-3 text-xs">
                              <div>
                                <dt className="text-[#8a9087]">반복 모티프</dt>
                                <dd className="mt-1 font-medium">{direction.motif.name}</dd>
                              </div>
                              <div>
                                <dt className="text-[#8a9087]">증거 표현</dt>
                                <dd className="mt-1 leading-5">{direction.evidenceTreatment}</dd>
                              </div>
                              <div>
                                <dt className="text-[#8a9087]">히어로 후보</dt>
                                <dd className="mt-1">{direction.heroSlideIds.length}장</dd>
                              </div>
                            </dl>
                            <Button
                              size="sm"
                              className="mt-5 w-full"
                              variant={selected ? 'outline' : 'default'}
                              disabled={Boolean(busy) || selected}
                              onClick={() =>
                                void run('디자인 방향 선택', async () => {
                                  const next = await ipc.runDeckIrStage({
                                    sessionId: document.sessionId,
                                    stage: 'select-direction',
                                    directionId: direction.id
                                  })
                                  setActiveTab('layout')
                                  return next
                                })
                              }
                            >
                              {selected ? <Check className="mr-2 h-3.5 w-3.5" /> : null}
                              {selected ? '선택됨' : '이 방향으로 스토리보드 생성'}
                            </Button>
                          </div>
                        </article>
                      )
                    })
                  ) : (
                    <div className="col-span-full rounded-2xl border border-dashed border-[#cfc5b3] p-12 text-center text-sm text-[#777e75]">
                      목차를 확정한 뒤 왼쪽에서 ‘디자인 방향 2–3안’을 실행하세요.
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === 'layout' ? (
              <section>
                <h2 className="text-2xl font-semibold tracking-[-0.03em]">
                  장마다 다른 이유가 있는 레이아웃
                </h2>
                <p className="mt-2 text-sm text-[#71786f]">
                  후보는 무작위가 아니라 논리 구조, 실제 증거 형태, 앞뒤 장의 지문을 함께
                  계산합니다.
                </p>
                <div className="mt-6 space-y-4">
                  {(document.designPlan?.storyboard.length || 0) > 0 ? (
                    document.designPlan!.storyboard.map((decision) => {
                      const slide = document.slides.find((item) => item.id === decision.slideId)
                      const chosen = decision.candidates.find(
                        (candidate) => candidate.id === decision.selectedCandidateId
                      )
                      return (
                        <article
                          key={decision.slideId}
                          className="rounded-2xl border border-[#d8d0c1] bg-white p-5 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-6">
                            <div>
                              <div className="flex items-center gap-2 text-xs text-[#747c72]">
                                <span className="font-semibold text-[#3d493f]">
                                  {slide?.order}장
                                </span>
                                <ChevronRight className="h-3 w-3" /> {slide?.logicalStructure}
                              </div>
                              <h3 className="mt-2 text-lg font-semibold">{slide?.headline.text}</h3>
                              {chosen ? (
                                <p className="mt-2 text-xs text-[#6e766d]">
                                  선택: {candidateLabel(chosen)} {chosen.hero ? '· HERO' : ''}
                                </p>
                              ) : null}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={Boolean(busy)}
                              onClick={() =>
                                void run(`슬라이드 ${slide?.order || ''} 후보 재계산`, () =>
                                  ipc.regenerateDeckIrSlideLayout({
                                    sessionId: document.sessionId,
                                    slideId: decision.slideId
                                  })
                                )
                              }
                            >
                              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> 이 장만 재계산
                            </Button>
                          </div>
                          <div className="mt-4 grid gap-2 md:grid-cols-2">
                            {decision.candidates.map((candidate) => {
                              const selected = candidate.id === decision.selectedCandidateId
                              return (
                                <button
                                  key={candidate.id}
                                  type="button"
                                  disabled={Boolean(busy)}
                                  onClick={() =>
                                    void run(`슬라이드 ${slide?.order || ''} 레이아웃 선택`, () =>
                                      ipc.selectDeckIrLayout({
                                        sessionId: document.sessionId,
                                        slideId: decision.slideId,
                                        candidateId: candidate.id
                                      })
                                    )
                                  }
                                  className={cn(
                                    'rounded-xl border p-3 text-left transition-colors',
                                    selected
                                      ? 'border-[#59705b] bg-[#edf2e9]'
                                      : 'border-[#ddd6c9] bg-[#fbfaf6] hover:border-[#a9b39f]'
                                  )}
                                >
                                  <LayoutMiniature candidate={candidate} selected={selected} />
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-semibold">
                                      {candidate.visualForm}
                                    </span>
                                    {selected ? <Check className="h-4 w-4 text-[#4f684f]" /> : null}
                                  </div>
                                  <p className="mt-1.5 text-[11px] leading-5 text-[#737a71]">
                                    {candidate.dominantArtifact} · {candidate.readingPath} ·{' '}
                                    {candidate.anchorZone}
                                  </p>
                                  <p className="mt-2 border-t border-black/6 pt-2 text-[11px] leading-5 text-[#555f60]">
                                    {candidate.fitnessReasons[0] || candidate.composition}
                                  </p>
                                </button>
                              )
                            })}
                          </div>
                        </article>
                      )
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#cfc5b3] p-12 text-center text-sm text-[#777e75]">
                      디자인 방향 하나를 선택하면 슬라이드별 후보와 덱 리듬을 계산합니다.
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === 'audit' ? (
              <section className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-2xl border border-[#d8d0c1] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                      <ShieldCheck className="h-5 w-5" /> 무결성 검사
                    </h2>
                    <span className="text-xs text-[#737b72]">{issues.length}건</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {issues.length > 0 ? (
                      issues.map((issue, index) => (
                        <div
                          key={`${issue.code}-${issue.path}-${index}`}
                          className={cn(
                            'rounded-xl border px-3 py-2.5 text-xs',
                            issue.severity === 'error'
                              ? 'border-[#e3b7af] bg-[#fff3f0] text-[#8d4038]'
                              : 'border-[#e6d5a6] bg-[#fff9e9] text-[#7b6529]'
                          )}
                        >
                          <div className="font-semibold">{issue.code}</div>
                          <div className="mt-1 leading-5">{issue.message}</div>
                          <div className="mt-1 text-[10px] opacity-70">{issue.path}</div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl bg-[#edf3ea] p-4 text-sm text-[#456048]">
                        오류와 경고가 없습니다. 모든 수치와 선택을 역추적할 수 있습니다.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-[#d8d0c1] bg-white p-5 shadow-sm">
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                      <Database className="h-5 w-5" /> 근거와 빈칸
                    </h2>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl bg-[#f4f1ea] p-3">
                        <div className="text-xl font-semibold">{document.inventory.length}</div>
                        <div className="text-[11px] text-[#7b8279]">인벤토리</div>
                      </div>
                      <div className="rounded-xl bg-[#f4f1ea] p-3">
                        <div className="text-xl font-semibold">
                          {document.dataRequirements.length}
                        </div>
                        <div className="text-[11px] text-[#7b8279]">DATA REQUIRED</div>
                      </div>
                      <div className="rounded-xl bg-[#f4f1ea] p-3">
                        <div className="text-xl font-semibold">{document.imageSlots.length}</div>
                        <div className="text-[11px] text-[#7b8279]">이미지 슬롯</div>
                      </div>
                    </div>
                    {document.imageSlots.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {document.imageSlots.map((slot) => (
                          <div
                            key={slot.id}
                            className="flex gap-2 rounded-lg bg-[#faf8f3] p-2.5 text-xs"
                          >
                            <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{slot.description}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-[#d8d0c1] bg-white p-5 shadow-sm">
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                      <History className="h-5 w-5" /> 변경 이력
                    </h2>
                    <div className="mt-4 max-h-64 space-y-2 overflow-auto">
                      {revisions.map((revision) => (
                        <div
                          key={revision.revision}
                          className="flex items-center justify-between gap-4 rounded-lg border border-[#e2ddd3] px-3 py-2 text-xs"
                        >
                          <div>
                            <span className="font-semibold">r{revision.revision}</span>
                            <span className="ml-2 text-[#6f776e]">{revision.reason}</span>
                          </div>
                          <span className="rounded-full bg-[#f0ede6] px-2 py-1 text-[10px]">
                            {revision.actor}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </ScrollArea>
      </main>
    </div>
  )
}
