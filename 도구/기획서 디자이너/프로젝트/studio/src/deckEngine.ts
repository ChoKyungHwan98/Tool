import { createEmptyDeckIr, extractNumericTokens, validateDeckIrIntegrity } from '@shared/deck-ir'
import type { DeckIrDocument, DeckIrImageSlot, DeckIrSlide } from '@shared/deck-ir'
import { planDeckStoryboard } from '@shared/design-engine'
import type { DesignDirection } from '@shared/design-engine'

export type DeckStudioRevision = {
  revision: number
  reason: string
  createdAt: number
}

export type DeckStudioWorkspace = {
  document: DeckIrDocument
  revisions: DeckStudioRevision[]
}

export type DeckStudioLibrary = {
  schemaVersion: 1
  workspaces: DeckStudioWorkspace[]
}

export type SlideVisualOverride = {
  fontScale: number
  density: 'spacious' | 'balanced' | 'dense'
}

export type ImageSlotDraft = Omit<DeckIrImageSlot, 'id' | 'slideId'>

export type AiOutlineProposal = {
  summary: string
  slides: Array<{
    headline: string
    body: string[]
    logicalStructure: DeckIrSlide['logicalStructure']
    sourceItemIds: string[]
  }>
}

export type StudioArtifactSnapshot = {
  catalogId: string
  toolId: string
  artifactId: string
  kind: string
  title: string
  revision?: string | number
  fingerprint?: string
  publishedAt?: string
  summary?: string
  data?: unknown
  attachedAt: number
  slideIds: string[]
  sourceId: string
  inventoryId: string
}

const id = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`

export const segmentBrief = (rawBrief: string): string[] =>
  rawBrief
    .split(/\n+|(?<=[.!?。！？])\s+/u)
    .map((item) => item.replace(/^[-*•]\s*/u, '').trim())
    .filter((item) => item.length >= 2)
    .slice(0, 18)

export const inferLogicalStructure = (text: string): DeckIrSlide['logicalStructure'] => {
  if (/비교|반면|대비|차이|전작|기존.+신규|A\s*(?:vs|대)\s*B/iu.test(text)) return 'comparison'
  if (/순서|단계|과정|먼저|이후|다음|흐름/iu.test(text)) return 'sequence'
  if (/원인|결과|때문|따라서|영향|문제.+해결/iu.test(text)) return 'cause-effect'
  if (/구성|모듈|요소|전체|부분|체계/iu.test(text)) return 'part-whole'
  if (extractNumericTokens(text).length > 0) return 'number-focus'
  if (/상태|전환|판정|프레임|쿨타임|메커니즘|FSM|HFSM|BT/iu.test(text)) return 'mechanism'
  if (/장단점|트레이드오프|균형|비용|선택지/iu.test(text)) return 'tradeoff'
  return text.length <= 34 ? 'declaration' : 'custom'
}

const bodyLines = (text: string): string[] => {
  const parts = text
    .split(/\s*[;·]\s*|\s+-\s+/u)
    .map((item) => item.trim())
    .filter(Boolean)
  return parts.length > 1 ? parts.slice(0, 5) : []
}

const contextSignals = (rawBrief: string): DeckIrDocument['brief']['contextSignals'] => {
  const signals: DeckIrDocument['brief']['contextSignals'] = []
  if (extractNumericTokens(rawBrief).length > 0) {
    signals.push({ id: id('signal'), label: '증거 성격', value: '수치와 실측이 포함된 문서', origin: 'inferred', confirmed: false })
  }
  if (/전투|보스|스킬|프레임|판정|FSM|HFSM|BT/iu.test(rawBrief)) {
    signals.push({ id: id('signal'), label: '도메인', value: '전투·시스템 설계', origin: 'inferred', confirmed: false })
  }
  if (/캐릭터|스토리|세계관|감정|서사/iu.test(rawBrief)) {
    signals.push({ id: id('signal'), label: '도메인', value: '콘텐츠·서사 설계', origin: 'inferred', confirmed: false })
  }
  if (signals.length === 0) {
    signals.push({ id: id('signal'), label: '문서 성격', value: '논리 중심 기획 문서', origin: 'inferred', confirmed: false })
  }
  return signals
}

const directions = (document: DeckIrDocument): DesignDirection[] => {
  const sourceSignalIds = document.brief.contextSignals.map((signal) => signal.id)
  const heroSlideIds = document.slides.filter((slide) => slide.role === 'cover').map((slide) => slide.id)
  const signalText = document.brief.contextSignals.map((signal) => signal.value).join(' · ')
  return [
    {
      id: id('direction'),
      name: '전술 기록',
      rationale: `${signalText}의 판단 과정을 짙은 기록면과 선명한 판정색으로 보여줍니다.`,
      toneWords: ['정밀한', '전술적인', '검증 가능한'],
      palette: { canvas: '#171A1D', surface: '#24292E', ink: '#F4F6F7', muted: '#8D979F', accent: '#42BCE8' },
      typography: { titleCharacter: '짧고 단단한 제목', bodyCharacter: '기술 문서형 본문', emphasisRule: '수치와 판정만 청록색으로 강조' },
      motif: { name: '판정 좌표', description: '측정점과 연결선을 반복합니다.', usageRule: '주장의 증거 위치에만 사용' },
      navigation: '좌측 진행 눈금으로 논증 위치를 표시',
      evidenceTreatment: '실측 수치와 상태 전이를 도판 중심으로 배치',
      shapeLanguage: '각진 패널과 가는 좌표선',
      sourceSignalIds,
      heroSlideIds
    },
    {
      id: id('direction'),
      name: '편집 보고서',
      rationale: `${signalText}를 읽는 순서가 먼저 보이도록 넓은 여백과 비대칭 편집축을 사용합니다.`,
      toneWords: ['명료한', '편집적인', '차분한'],
      palette: { canvas: '#F2F0EA', surface: '#FFFFFF', ink: '#22272B', muted: '#747C82', accent: '#D76B4A' },
      typography: { titleCharacter: '문장형 헤드라인', bodyCharacter: '보고서형 본문', emphasisRule: '결론 한 곳에만 적갈색 사용' },
      motif: { name: '편집 축', description: '번호와 문장을 잇는 세로축입니다.', usageRule: '장 전환과 핵심 결론에만 반복' },
      navigation: '상단 장 번호와 여백 리듬으로 흐름 표시',
      evidenceTreatment: '표·비교·인용을 동일 기준선에 정렬',
      shapeLanguage: '넓은 여백과 얇은 구획선',
      sourceSignalIds,
      heroSlideIds
    },
    {
      id: id('direction'),
      name: '시스템 청사진',
      rationale: `${signalText}의 요소와 관계를 구조도로 읽히게 만들고 연결 관계를 전면에 둡니다.`,
      toneWords: ['구조적인', '기술적인', '연결된'],
      palette: { canvas: '#1C2025', surface: '#2A3036', ink: '#EEF2F4', muted: '#98A2AA', accent: '#A987E8' },
      typography: { titleCharacter: '구조를 설명하는 제목', bodyCharacter: '짧은 주석형 본문', emphasisRule: '현재 다루는 노드만 보라색으로 강조' },
      motif: { name: '연결 노드', description: '상태와 자료를 잇는 작은 노드입니다.', usageRule: '실제 관계가 있는 항목에만 사용' },
      navigation: '논증 지도가 장마다 한 단계씩 확장',
      evidenceTreatment: '상태도·모듈 지도·주석 화면을 우선 사용',
      shapeLanguage: '노드, 포트, 연결선',
      sourceSignalIds,
      heroSlideIds
    }
  ]
}

export const createOfflineWorkspace = (title: string, rawBrief: string): DeckStudioWorkspace => {
  const now = Date.now()
  const base = createEmptyDeckIr({ sessionId: id('deck'), title, rawBrief, now })
  const source = base.sources[0]!
  const segments = segmentBrief(rawBrief)
  const inventory = segments.map((text, index) => ({
    id: id('inventory'),
    sourceId: source.id,
    originalText: text,
    type: (extractNumericTokens(text).length > 0 ? 'number' : 'claim') as 'number' | 'claim',
    locator: { lineStart: index + 1, lineEnd: index + 1 },
    verbatimNumbers: extractNumericTokens(text),
    tags: [],
    userConfirmed: true
  }))
  const cover: DeckIrSlide = {
    id: id('slide'),
    order: 1,
    role: 'cover',
    logicalStructure: 'declaration',
    headline: { id: id('text'), text: title, sourceItemIds: [], claimIds: [], transform: 'user-authored' },
    body: [],
    claimIds: [],
    dataRequirementIds: [],
    imageSlotIds: [],
    notes: ''
  }
  const contentSlides = inventory.slice(0, 12).map<DeckIrSlide>((item, index) => ({
    id: id('slide'),
    order: index + 2,
    role: 'content',
    logicalStructure: inferLogicalStructure(item.originalText),
    ...(inferLogicalStructure(item.originalText) === 'custom' ? { customStructure: '사용자 원문의 논리 구조' } : {}),
    headline: { id: id('text'), text: item.originalText, sourceItemIds: [item.id], claimIds: [], transform: 'verbatim' },
    body: bodyLines(item.originalText).map((text) => ({ id: id('text'), text, sourceItemIds: [item.id], claimIds: [], transform: 'verbatim' as const })),
    claimIds: [],
    dataRequirementIds: [],
    imageSlotIds: [],
    notes: ''
  }))
  const draft: DeckIrDocument = {
    ...base,
    inventory,
    slides: [cover, ...contentSlides],
    brief: { rawText: rawBrief, contextSignals: contextSignals(rawBrief) },
    revision: 1,
    updatedAt: now
  }
  const document: DeckIrDocument = {
    ...draft,
    designPlan: { directions: directions(draft), selectedDirectionId: null, storyboard: [], generatedAt: now }
  }
  return { document, revisions: [{ revision: 1, reason: '원고에서 로컬 초안 생성', createdAt: now }] }
}

const touch = (workspace: DeckStudioWorkspace, document: DeckIrDocument, reason: string): DeckStudioWorkspace => {
  const now = Date.now()
  const next = { ...document, revision: workspace.document.revision + 1, updatedAt: now }
  return {
    document: next,
    revisions: [...workspace.revisions.slice(-29), { revision: next.revision, reason, createdAt: now }]
  }
}

export const updateSlideContent = (workspace: DeckStudioWorkspace, slideId: string, headline: string, body: string[]): DeckStudioWorkspace => {
  const sourceId = id('source')
  const inventoryId = id('inventory')
  const originalText = [headline, ...body].join('\n')
  const document = workspace.document
  return touch(workspace, {
    ...document,
    sources: [...document.sources, { id: sourceId, kind: 'user-input', name: '슬라이드 직접 수정', rawText: originalText, createdAt: Date.now() }],
    inventory: [...document.inventory, { id: inventoryId, sourceId, originalText, type: 'reference', locator: { note: '사용자가 슬라이드 편집기에서 직접 수정' }, verbatimNumbers: extractNumericTokens(originalText), tags: [], userConfirmed: true }],
    slides: document.slides.map((slide) => slide.id === slideId ? {
      ...slide,
      headline: { ...slide.headline, text: headline, sourceItemIds: [inventoryId], claimIds: [], transform: 'user-authored' },
      body: body.map((text) => ({ id: id('text'), text, sourceItemIds: [inventoryId], claimIds: [], transform: 'user-authored' as const }))
    } : slide)
  }, '슬라이드 내용 직접 수정')
}

export const selectDesignDirection = (workspace: DeckStudioWorkspace, directionId: string): DeckStudioWorkspace => {
  const plan = workspace.document.designPlan
  const direction = plan?.directions.find((item) => item.id === directionId)
  if (!plan || !direction) return workspace
  return touch(workspace, {
    ...workspace.document,
    designPlan: { ...plan, selectedDirectionId: directionId, storyboard: planDeckStoryboard(workspace.document, direction) }
  }, `디자인 방향 선택: ${direction.name}`)
}

export const selectLayoutCandidate = (workspace: DeckStudioWorkspace, slideId: string, candidateId: string): DeckStudioWorkspace => {
  const plan = workspace.document.designPlan
  if (!plan) return workspace
  return touch(workspace, {
    ...workspace.document,
    designPlan: {
      ...plan,
      storyboard: plan.storyboard.map((item) => item.slideId === slideId && item.candidates.some((candidate) => candidate.id === candidateId)
        ? { ...item, selectedCandidateId: candidateId, selectionReason: '사용자가 후보를 직접 선택했습니다.' }
        : item)
    }
  }, `레이아웃 선택: ${slideId}`)
}

const visualOverrides = (document: DeckIrDocument): Record<string, SlideVisualOverride> => {
  const value = document.extensions.studioVisualOverrides
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, SlideVisualOverride>
}

export const getSlideVisualOverride = (
  document: DeckIrDocument,
  slideId: string
): SlideVisualOverride => visualOverrides(document)[slideId] || { fontScale: 1, density: 'balanced' }

export const updateSlideVisual = (
  workspace: DeckStudioWorkspace,
  slideId: string,
  override: SlideVisualOverride
): DeckStudioWorkspace => touch(workspace, {
  ...workspace.document,
  extensions: {
    ...workspace.document.extensions,
    studioVisualOverrides: {
      ...visualOverrides(workspace.document),
      [slideId]: {
        fontScale: Math.max(0.8, Math.min(1.25, override.fontScale)),
        density: override.density
      }
    }
  }
}, `슬라이드 시각 밀도 조정: ${slideId}`)

export const upsertImageSlot = (
  workspace: DeckStudioWorkspace,
  slideId: string,
  draft: ImageSlotDraft
): DeckStudioWorkspace => {
  const currentSlide = workspace.document.slides.find((slide) => slide.id === slideId)
  if (!currentSlide) return workspace
  const currentSlot = workspace.document.imageSlots.find((slot) => slot.slideId === slideId)
  const slot: DeckIrImageSlot = { ...draft, id: currentSlot?.id || id('image'), slideId }
  return touch(workspace, {
    ...workspace.document,
    imageSlots: currentSlot
      ? workspace.document.imageSlots.map((item) => item.id === currentSlot.id ? slot : item)
      : [...workspace.document.imageSlots, slot],
    slides: workspace.document.slides.map((slide) => slide.id === slideId
      ? { ...slide, imageSlotIds: [slot.id] }
      : slide)
  }, `이미지 슬롯 ${currentSlot ? '수정' : '추가'}: ${slideId}`)
}

export const removeImageSlot = (
  workspace: DeckStudioWorkspace,
  slideId: string
): DeckStudioWorkspace => {
  const slotIds = new Set(workspace.document.imageSlots.filter((slot) => slot.slideId === slideId).map((slot) => slot.id))
  if (slotIds.size === 0) return workspace
  return touch(workspace, {
    ...workspace.document,
    imageSlots: workspace.document.imageSlots.filter((slot) => !slotIds.has(slot.id)),
    slides: workspace.document.slides.map((slide) => slide.id === slideId
      ? { ...slide, imageSlotIds: slide.imageSlotIds.filter((slotId) => !slotIds.has(slotId)) }
      : slide)
  }, `이미지 슬롯 삭제: ${slideId}`)
}

export const validateAiOutlineProposal = (
  workspace: DeckStudioWorkspace,
  proposal: AiOutlineProposal
): string[] => {
  const issues: string[] = []
  const inventory = new Map(workspace.document.inventory.map((item) => [item.id, item]))
  if (!proposal.summary.trim()) issues.push('제안 요약이 비어 있습니다.')
  if (!Array.isArray(proposal.slides) || proposal.slides.length === 0) issues.push('제안 슬라이드가 없습니다.')
  proposal.slides.forEach((slide, index) => {
    if (!slide.headline?.trim()) issues.push(`${index + 1}번째 슬라이드의 주장이 비어 있습니다.`)
    if (!Array.isArray(slide.sourceItemIds) || slide.sourceItemIds.length === 0) issues.push(`${index + 1}번째 슬라이드에 근거 ID가 없습니다.`)
    const sources = (slide.sourceItemIds || []).map((sourceId) => inventory.get(sourceId)).filter(Boolean)
    if (sources.length !== (slide.sourceItemIds || []).length) issues.push(`${index + 1}번째 슬라이드에 존재하지 않는 근거 ID가 있습니다.`)
    const supportedNumbers = new Set(sources.flatMap((source) => source?.verbatimNumbers || []))
    const proposedNumbers = extractNumericTokens([slide.headline, ...(slide.body || [])].join(' '))
    proposedNumbers.forEach((number) => {
      if (!supportedNumbers.has(number)) issues.push(`${index + 1}번째 슬라이드의 수치 ${number}은 연결된 원문에 없습니다.`)
    })
  })
  return issues
}

export const applyAiOutlineProposal = (
  workspace: DeckStudioWorkspace,
  proposal: AiOutlineProposal
): DeckStudioWorkspace => {
  const issues = validateAiOutlineProposal(workspace, proposal)
  if (issues.length > 0) throw new Error(issues[0])
  const cover = workspace.document.slides.find((slide) => slide.role === 'cover') || workspace.document.slides[0]
  const slides: DeckIrSlide[] = [
    { ...cover, order: 1, headline: { ...cover.headline, text: workspace.document.title } },
    ...proposal.slides.map((slide, index) => ({
      id: id('slide'), order: index + 2, role: 'content' as const,
      logicalStructure: slide.logicalStructure,
      ...(slide.logicalStructure === 'custom' ? { customStructure: 'AI 제안 후 사용자 승인 구조' } : {}),
      headline: { id: id('text'), text: slide.headline.trim(), sourceItemIds: slide.sourceItemIds, claimIds: [], transform: 'compressed' as const },
      body: slide.body.map((text) => ({ id: id('text'), text: text.trim(), sourceItemIds: slide.sourceItemIds, claimIds: [], transform: 'compressed' as const })).filter((item) => item.text),
      claimIds: [], dataRequirementIds: [], imageSlotIds: [], notes: `AI 구조 제안 승인 · ${proposal.summary}`
    }))
  ]
  return touch(workspace, {
    ...workspace.document,
    slides,
    imageSlots: [],
    designPlan: workspace.document.designPlan
      ? { ...workspace.document.designPlan, selectedDirectionId: null, storyboard: [], generatedAt: Date.now() }
      : undefined,
    extensions: {
      ...workspace.document.extensions,
      lastAiProposal: { acceptedAt: Date.now(), summary: proposal.summary }
    }
  }, '사용자가 AI 목차 제안을 검토 후 적용')
}

export const getAttachedArtifacts = (document: DeckIrDocument): StudioArtifactSnapshot[] => {
  const value = document.extensions.studioArtifacts
  return Array.isArray(value) ? value as StudioArtifactSnapshot[] : []
}

export type CatalogArtifact = Omit<StudioArtifactSnapshot, 'attachedAt' | 'slideIds' | 'sourceId' | 'inventoryId'>

const artifactSummary = (artifact: CatalogArtifact): string =>
  `${artifact.title}${artifact.summary ? ` · ${artifact.summary}` : ''}`

export const attachStudioArtifact = (
  workspace: DeckStudioWorkspace,
  artifact: CatalogArtifact
): DeckStudioWorkspace => {
  const attached = getAttachedArtifacts(workspace.document)
  const existing = attached.find((item) => item.catalogId === artifact.catalogId)
  if (existing) return workspace
  const sourceId = id('source')
  const inventoryId = id('inventory')
  const snapshot: StudioArtifactSnapshot = { ...artifact, attachedAt: Date.now(), slideIds: [], sourceId, inventoryId }
  return touch(workspace, {
    ...workspace.document,
    sources: [...workspace.document.sources, {
      id: sourceId, kind: 'reference-deck', name: `${artifact.toolId} · ${artifact.title}`,
      rawText: artifactSummary(artifact), createdAt: Date.now()
    }],
    inventory: [...workspace.document.inventory, {
      id: inventoryId, sourceId, originalText: artifactSummary(artifact),
      type: artifact.kind === 'data-table' ? 'table' : 'reference', locator: { note: artifact.catalogId },
      verbatimNumbers: extractNumericTokens(artifactSummary(artifact)), tags: [artifact.kind, artifact.toolId], userConfirmed: true
    }],
    extensions: { ...workspace.document.extensions, studioArtifacts: [...attached, snapshot] }
  }, `도구 자료 참조: ${artifact.title}`)
}

export const refreshStudioArtifact = (
  workspace: DeckStudioWorkspace,
  artifact: CatalogArtifact
): DeckStudioWorkspace => {
  const attached = getAttachedArtifacts(workspace.document)
  const current = attached.find((item) => item.catalogId === artifact.catalogId)
  if (!current) return attachStudioArtifact(workspace, artifact)
  const updated: StudioArtifactSnapshot = { ...current, ...artifact, attachedAt: Date.now() }
  return touch(workspace, {
    ...workspace.document,
    sources: workspace.document.sources.map((source) => source.id === current.sourceId
      ? { ...source, name: `${artifact.toolId} · ${artifact.title}`, rawText: artifactSummary(artifact) }
      : source),
    inventory: workspace.document.inventory.map((item) => item.id === current.inventoryId
      ? { ...item, originalText: artifactSummary(artifact), verbatimNumbers: extractNumericTokens(artifactSummary(artifact)) }
      : item),
    extensions: { ...workspace.document.extensions, studioArtifacts: attached.map((item) => item.catalogId === artifact.catalogId ? updated : item) }
  }, `도구 자료 최신화: ${artifact.title}`)
}

export const detachStudioArtifact = (
  workspace: DeckStudioWorkspace,
  catalogId: string
): DeckStudioWorkspace => {
  const attached = getAttachedArtifacts(workspace.document)
  const target = attached.find((item) => item.catalogId === catalogId)
  if (!target || target.slideIds.length > 0) return workspace
  return touch(workspace, {
    ...workspace.document,
    sources: workspace.document.sources.filter((source) => source.id !== target.sourceId),
    inventory: workspace.document.inventory.filter((item) => item.id !== target.inventoryId),
    extensions: { ...workspace.document.extensions, studioArtifacts: attached.filter((item) => item.catalogId !== catalogId) }
  }, `도구 자료 참조 해제: ${target.title}`)
}

export const insertStudioArtifactSlide = (
  workspace: DeckStudioWorkspace,
  catalogId: string
): DeckStudioWorkspace => {
  const attached = getAttachedArtifacts(workspace.document)
  const artifact = attached.find((item) => item.catalogId === catalogId)
  if (!artifact) return workspace
  const data = artifact.data && typeof artifact.data === 'object' ? artifact.data as Record<string, unknown> : {}
  const slideId = id('slide')
  const body = artifact.kind === 'data-table'
    ? ((data.columns as Array<Record<string, unknown>> | undefined) || []).slice(0, 8).map((column) => String(column.displayName || column.name || '열'))
    : ((data.graphs as Array<Record<string, unknown>> | undefined) || []).slice(0, 8).map((graph) => String(graph.name || '그래프'))
  const slide: DeckIrSlide = {
    id: slideId, order: workspace.document.slides.length + 1, role: 'content',
    logicalStructure: artifact.kind === 'data-table' ? 'part-whole' : 'mechanism',
    headline: { id: id('text'), text: artifact.title, sourceItemIds: [artifact.inventoryId], claimIds: [], transform: 'verbatim' },
    body: body.map((text) => ({ id: id('text'), text, sourceItemIds: [artifact.inventoryId], claimIds: [], transform: 'verbatim' as const })),
    claimIds: [], dataRequirementIds: [], imageSlotIds: [], notes: `연결 자료 · ${artifact.catalogId}`
  }
  return touch(workspace, {
    ...workspace.document,
    slides: [...workspace.document.slides, slide],
    extensions: {
      ...workspace.document.extensions,
      studioArtifacts: attached.map((item) => item.catalogId === catalogId
        ? { ...item, slideIds: [...item.slideIds, slideId] }
        : item)
    },
    designPlan: workspace.document.designPlan
      ? { ...workspace.document.designPlan, selectedDirectionId: null, storyboard: [], generatedAt: Date.now() }
      : undefined
  }, `도구 자료를 벡터 슬라이드로 삽입: ${artifact.title}`)
}

export const validateWorkspace = (workspace: DeckStudioWorkspace) => validateDeckIrIntegrity(workspace.document)

const storageKey = (workspaceId: string): string => `game-design-studio:deck-library:v1:${workspaceId}`

export const loadLibrary = (workspaceId: string): DeckStudioLibrary => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(workspaceId)) || '') as DeckStudioLibrary
    if (parsed.schemaVersion === 1 && Array.isArray(parsed.workspaces)) return parsed
  } catch {
    // 손상된 저장본은 빈 라이브러리로 복구하고 새 저장 시 교체한다.
  }
  return { schemaVersion: 1, workspaces: [] }
}

export const saveLibrary = (workspaceId: string, library: DeckStudioLibrary): void => {
  localStorage.setItem(storageKey(workspaceId), JSON.stringify(library))
}

const safeName = (value: string): string => value.replace(/[\\/:*?"<>|]/g, '_').trim() || '기획서'

const download = (name: string, bytes: BlobPart, type: string): void => {
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

export const exportWorkspacePptx = async (document: DeckIrDocument): Promise<void> => {
  const { runOutputPreflight } = await import('./preflight')
  const preflight = await runOutputPreflight(document)
  const errors = preflight.issues.filter((issue) => issue.severity === 'error')
  if (errors.length > 0) throw new Error(`PPTX 출고 전 검사 실패: ${errors[0]?.message}`)
  const [{ buildDeckIrPptxDocument }, { generatePptx }] = await Promise.all([
    import('@deck-main/pptx'),
    import('@arcsin1/html2pptx')
  ])
  const { pptx, report } = buildDeckIrPptxDocument(document)
  const bytes = generatePptx(pptx)
  download(`${safeName(document.title)}.pptx`, new Uint8Array(bytes).buffer, 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
  download(`${safeName(document.title)}.pptx.report.json`, JSON.stringify(report, null, 2), 'application/json')
}

export const exportWorkspaceDocx = async (document: DeckIrDocument): Promise<void> => {
  const { runOutputPreflight } = await import('./preflight')
  const preflight = await runOutputPreflight(document)
  const errors = preflight.issues.filter((issue) => issue.severity === 'error')
  if (errors.length > 0) throw new Error(`Word 출고 전 검사 실패: ${errors[0]?.message}`)
  const { buildDeckIrDocxBytes } = await import('@deck-main/docx')
  const { bytes, report } = buildDeckIrDocxBytes(document)
  download(`${safeName(document.title)}.docx`, new Uint8Array(bytes).buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  download(`${safeName(document.title)}.docx.report.json`, JSON.stringify(report, null, 2), 'application/json')
}
