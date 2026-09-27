import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronsRight,
  KeyRound,
  MessagesSquare,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Square,
  SquarePen,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  buildChatRequestMessages,
  buildChatSystemPrompt,
  requestChatCompletion,
  type AiChatMessage,
} from '../../application/aiChat'
import { AI_SCHEMA_TOOLS, compileAiToolCalls } from '../../application/aiTools'
import {
  actualRequestCostUsd,
  checkSpendLimit,
  DEFAULT_MONTHLY_LIMIT_USD,
  estimateRequestCostUsd,
  formatUsd,
  readSpend,
  recordSpend,
} from '../../application/aiSpend'
import {
  defaultOpenRouterSettings,
  fetchOpenRouterCatalog,
  isFreeOpenRouterModel,
  maskApiKey,
  pricePerMillionTokens,
  supportsToolCalls,
  type OpenRouterModel,
} from '../../application/openRouterProvider'
import { OpenRouterRequestManager } from '../../application/openRouterRequestManager'
import {
  deleteOpenRouterApiKey,
  getOpenRouterCredentialStatus,
  loadOpenRouterApiKey,
  saveOpenRouterApiKey,
  type OpenRouterCredentialStatus,
} from '../../infrastructure/openRouterCredentials'
import { useWorkbenchStore } from '../state/workbenchStore'
import { isStudioHosted } from '../../infrastructure/studioSharedProjectRepository'
import { defaultOpenRouterFetch, studioDeleteKey, studioKeyConfigured, studioSaveKey } from '../../infrastructure/studioOpenRouter'

/** 왼쪽 = 무료 모델만, 오른쪽 = 유료 허용. 유료는 월 상한이 강제된다. */
type AiTier = 'free' | 'paid'
type OpenRouterStatus = 'idle' | 'checking' | 'ready' | 'running' | 'error'

export function AiAssistantPanel() {
  const project = useWorkbenchStore((state) => state.document.schema)
  const assistantWidth = useWorkbenchStore((state) => state.assistantWidth)
  const assistantCollapsed = useWorkbenchStore((state) => state.assistantCollapsed)
  const setAssistantWidth = useWorkbenchStore((state) => state.setAssistantWidth)
  const setAssistantCollapsed = useWorkbenchStore((state) => state.setAssistantCollapsed)
  const setExplorerCollapsed = useWorkbenchStore((state) => state.setExplorerCollapsed)
  const stageAiCommandSuggestion = useWorkbenchStore((state) => state.stageAiCommandSuggestion)
  const selectTable = useWorkbenchStore((state) => state.selectTable)
  const setMainView = useWorkbenchStore((state) => state.setMainView)
  const setBottomPanel = useWorkbenchStore((state) => state.setBottomPanel)
  const aiProposal = useWorkbenchStore((state) => state.aiProposal)
  const aiStatus = useWorkbenchStore((state) => state.aiStatus)
  const aiError = useWorkbenchStore((state) => state.aiError)
  const aiMessages = useWorkbenchStore((state) => state.aiMessages)
  const appendAiMessage = useWorkbenchStore((state) => state.appendAiMessage)
  const aiConversations = useWorkbenchStore((state) => state.aiConversations)
  const activeConversationId = useWorkbenchStore((state) => state.activeConversationId)
  const startNewConversation = useWorkbenchStore((state) => state.startNewConversation)
  const openConversation = useWorkbenchStore((state) => state.openConversation)
  const deleteConversation = useWorkbenchStore((state) => state.deleteConversation)
  const addAiTokenUsage = useWorkbenchStore((state) => state.addAiTokenUsage)
  const [historyOpen, setHistoryOpen] = useState(false)
  const aiPendingBatch = useWorkbenchStore((state) => state.aiPendingBatch)
  const stageAiToolBatch = useWorkbenchStore((state) => state.stageAiToolBatch)
  const applyAiPendingBatch = useWorkbenchStore((state) => state.applyAiPendingBatch)
  const discardAiPendingBatch = useWorkbenchStore((state) => state.discardAiPendingBatch)
  const [prompt, setPrompt] = useState('')
  const [tier, setTier] = useState<AiTier>(() => readModelChoice().tier)
  const [spentUsd, setSpentUsd] = useState(() => readSpend().usd)
  const [shareSampleRows, setShareSampleRows] = useState(false)
  const selectedTableId = useWorkbenchStore((state) => state.selectedTableId)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [freeModels, setFreeModels] = useState<readonly OpenRouterModel[]>([])
  const [selectedModelId, setSelectedModelId] = useState(() => readModelChoice().modelId)
  // 스튜디오 안에서는 키를 스튜디오가 보관한다. 도구는 "저장돼 있다"는 사실만 안다.
  const studioHosted = isStudioHosted()
  const openRouterFetch = useRef(defaultOpenRouterFetch()).current
  const [studioKeyReady, setStudioKeyReady] = useState(false)
  const hasKey = studioHosted ? studioKeyReady : apiKey.trim().length > 0
  const [openRouterStatus, setOpenRouterStatus] = useState<OpenRouterStatus>('idle')
  const [openRouterError, setOpenRouterError] = useState<string | null>(null)
  const [credentialStatus, setCredentialStatus] = useState<OpenRouterCredentialStatus | null>(null)
  const [requestNote, setRequestNote] = useState<string | null>(null)
  const requestManager = useRef(new OpenRouterRequestManager(1))

  useEffect(() => {
    // 보관해 둔 키가 있으면 다시 켰을 때도 자동으로 되살리고, 모델 목록까지 불러온다.
    void (async () => {
      if (studioHosted) {
        const configured = await studioKeyConfigured().catch(() => false)
        setStudioKeyReady(configured)
        setCredentialStatus({ available: true, stored: configured, message: configured ? '스튜디오에 저장된 키를 사용합니다. 모든 도구가 같은 키를 씁니다.' : '키를 보관하면 스튜디오에 저장되어 다시 켜도 남습니다.' })
        if (configured) void loadModels()
        return
      }
      const status = await getOpenRouterCredentialStatus()
      setCredentialStatus(status)

      if (!status.stored) return

      const loaded = await loadOpenRouterApiKey()
      if (loaded.apiKey) {
        setApiKey(loaded.apiKey)
        void loadModels(tier, loaded.apiKey)
      }
    })()
    // 처음 한 번만 실행한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 고른 요금제와 모델을 기억해 다시 켰을 때 다시 고르지 않게 한다.
  useEffect(() => { writeModelChoice({ tier, modelId: selectedModelId }) }, [tier, selectedModelId])

  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const startX = event.clientX
    const startWidth = assistantWidth
    const move = (pointerEvent: PointerEvent) => setAssistantWidth(startWidth + startX - pointerEvent.clientX)
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  const loadModels = async (nextTier: AiTier = tier, keyOverride?: string) => {
    setOpenRouterStatus('checking')
    setOpenRouterError(null)
    try {
      const catalog = await fetchOpenRouterCatalog({ apiKey: (keyOverride ?? apiKey).trim() || undefined, fetchImpl: openRouterFetch })
      // 도구 호출을 못 하는 모델을 고르면 테이블 생성이 조용히 실패하므로 아예 목록에서 뺀다.
      const candidates = (nextTier === 'free' ? catalog.freeModels : catalog.models).filter(supportsToolCalls)
      const models = [...candidates].sort((left, right) => {
        const leftPrice = pricePerMillionTokens(left)?.prompt ?? 0
        const rightPrice = pricePerMillionTokens(right)?.prompt ?? 0
        return leftPrice === rightPrice ? left.id.localeCompare(right.id) : leftPrice - rightPrice
      })

      setFreeModels(models)
      setSelectedModelId((current) => models.some((model) => model.id === current) ? current : models[0]?.id ?? '')
      setOpenRouterStatus('ready')
      setRequestNote(`${nextTier === 'free' ? '무료' : '유료 포함'} 모델 중 도구 호출이 가능한 ${models.length}개를 확인했습니다.`)
    } catch (error) {
      setOpenRouterStatus('error')
      setOpenRouterError(error instanceof Error ? error.message : '모델 목록을 확인하지 못했습니다.')
    }
  }

  const switchTier = (nextTier: AiTier) => {
    setTier(nextTier)
    setSelectedModelId('')
    setFreeModels([])
    setRequestNote(null)
    setOpenRouterError(null)
    // 키가 있으면 바뀐 요금제의 모델 목록을 바로 불러온다.
    if (hasKey) void loadModels(nextTier)
  }

  const selectedModel = freeModels.find((model) => model.id === selectedModelId)

  // 유료 모델일 때만 보내기 전에 대략 얼마인지 미리 보여준다.
  const pendingCostUsd = selectedModel && !isFreeOpenRouterModel(selectedModel) && prompt.trim()
    ? estimateRequestCostUsd({
      model: selectedModel,
      promptText: buildChatSystemPrompt(project, { focusTableId: selectedTableId }) + prompt,
    })
    : null

  /**
   * 모델 한 턴을 실행한다.
   * showUserMessage=false 면 지시문을 화면 말풍선으로 남기지 않는다(승인 후 자동 이어하기에 쓴다).
   */
  const runModelTurn = async (userContent: string, options: { readonly showUserMessage: boolean }) => {
    if (!hasKey || !selectedModelId) {
      setSettingsOpen(true)
      setOpenRouterError('API 키를 입력하고 모델 목록을 불러와 모델을 선택하세요.')
      if (options.showUserMessage) appendAiMessage('user', userContent)
      appendAiMessage('assistant', 'OpenRouter 연결이 아직 안 됐어요. 설정에서 API 키를 넣고 모델을 선택해 주세요.')
      setPrompt('')
      return
    }

    // 직전에 추가된 말풍선까지 반영되도록 스토어에서 바로 읽는다.
    const thread: readonly AiChatMessage[] = [
      ...useWorkbenchStore.getState().aiMessages.map((message) => ({ role: message.role, content: message.content })),
      { role: 'user' as const, content: userContent },
    ]
    const question = userContent
    // 승인 직후 자동으로 이어갈 때는 방금 적용된 스키마를 봐야 한다.
    // 렌더 시점에 잡힌 project를 쓰면 낡은 스키마를 보내 이미 만든 테이블을 또 만들려 한다.
    const currentSchema = useWorkbenchStore.getState().document.schema
    const systemPrompt = buildChatSystemPrompt(currentSchema, {
      focusTableId: useWorkbenchStore.getState().selectedTableId,
      // 켰을 때만 보내고, 그때도 앞 20행까지만 나간다(상한은 buildChatSystemPrompt가 강제).
      rowsByTable: shareSampleRows ? useWorkbenchStore.getState().document.rowsByTable : undefined,
      // ID 최소·최대만 계산해 보낸다. 새 표의 ID 구간이 기존 표와 겹치지 않게 하려는 것.
      idRangeRows: useWorkbenchStore.getState().document.rowsByTable,
    })
    const requestMessages = buildChatRequestMessages(systemPrompt, thread)

    // 유료 모델이면 보내기 전에 월 상한을 확인한다.
    let estimatedUsd = 0
    if (selectedModel && !isFreeOpenRouterModel(selectedModel)) {
      estimatedUsd = estimateRequestCostUsd({
        model: selectedModel,
        promptText: requestMessages.map((message) => message.content).join('\n'),
      })

      const check = checkSpendLimit({ estimatedUsd })

      if (!check.allowed) {
        setSettingsOpen(true)
        setOpenRouterError(check.reason ?? '월 지출 상한에 도달했습니다.')
        if (options.showUserMessage) appendAiMessage('user', question)
        appendAiMessage('assistant', `${check.reason} 무료 모델로 바꾸거나 다음 달까지 기다려 주세요.`)
        setPrompt('')
        return
      }
    }

    if (options.showUserMessage) {
      appendAiMessage('user', question)
      setPrompt('')
    }

    setRequestNote(null)

    setOpenRouterStatus('running')
    setOpenRouterError(null)
    useWorkbenchStore.setState({ aiStatus: 'running', aiError: null })

    try {
      const turn = await requestChatCompletion({
        messages: requestMessages,
        settings: {
          ...defaultOpenRouterSettings,
          apiKey: apiKey.trim(),
          modelId: selectedModelId,
          freeModelsOnly: tier === 'free',
          sendRowData: shareSampleRows,
          // 대화는 자유 형식이라 구조화 출력을 강제하지 않는다.
          requireStructuredOutput: false,
        },
        tools: AI_SCHEMA_TOOLS,
        fetchImpl: openRouterFetch,
      })

      // 무료·유료 모두 실제 사용 토큰을 대화에 누적하고 보여준다.
      if (turn.usage) {
        addAiTokenUsage(turn.usage.promptTokens, turn.usage.completionTokens)
        setRequestNote(`이번 요청 입력 ${turn.usage.promptTokens.toLocaleString()} · 출력 ${turn.usage.completionTokens.toLocaleString()} 토큰`)
      }

      // 실제 사용량이 오면 그걸로 기록하고, 없을 때만 추정치로 대신한다.
      if (selectedModel && !isFreeOpenRouterModel(selectedModel)) {
        const chargedUsd = turn.usage
          ? actualRequestCostUsd({ model: selectedModel, usage: turn.usage })
          : estimatedUsd

        if (chargedUsd > 0) {
          const next = recordSpend(chargedUsd)
          setSpentUsd(next.usd)
          setRequestNote(`이번 요청 ${formatUsd(chargedUsd)}${turn.usage ? ' (실제 사용량)' : ' (추정)'} · 이번 달 누적 ${formatUsd(next.usd)}`)
        }
      }

      if (turn.content) {
        appendAiMessage('assistant', turn.content)
      }

      if (turn.toolCalls.length > 0) {
        // 컴파일도 최신 문서 기준으로 한다(자동 이어하기에서 방금 만든 테이블을 인식해야 한다).
        const latest = useWorkbenchStore.getState().document
        const plan = compileAiToolCalls(latest.schema, turn.toolCalls, latest.rowsByTable)

        if (!turn.content) {
          appendAiMessage('assistant', '아래 변경을 제안합니다. 확인 후 승인해 주세요.')
        }

        stageAiToolBatch(plan)
      }

      useWorkbenchStore.setState({ aiStatus: 'ready', aiError: null })
      setOpenRouterStatus('ready')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OpenRouter 대화에 실패했습니다.'
      useWorkbenchStore.setState({ aiStatus: 'error', aiError: message })
      setOpenRouterStatus('error')
      setOpenRouterError(message)
    }
  }

  const sendChat = async () => {
    const question = prompt.trim()
    if (!question) return
    await runModelTurn(question, { showUserMessage: true })
  }

  /**
   * 무료 모델은 "한 답변에서 도구를 여러 개 부르라"는 지시를 자주 무시하고 한 개만 부른다.
   * 그래서 승인 직후 앱이 대신 "남은 작업 있냐"고 한 번 더 물어 이어서 처리한다.
   */
  const approveAndContinue = async () => {
    const applied = aiPendingBatch
    applyAiPendingBatch()

    if (!applied || !hasKey || !selectedModelId) return

    // 무엇이 이미 끝났는지 구체적으로 알려주지 않으면 모델이 같은 도구를 또 부른다.
    const createdTables = applied.rowPlans.length === 0 && applied.steps.length > 0
    const continueInstruction = [
      `방금 다음 변경을 적용했습니다: ${applied.steps.join(' / ') || applied.summary}.`,
      '이미 만든 테이블이나 컬럼은 절대 다시 만들지 마세요.',
      createdTables
        ? '처음 요청에 행을 채우는 작업이 있었다면, 이제 그 테이블이 존재하므로 insert_rows 도구로 행을 채우세요.'
        : '처음 요청 중 아직 하지 않은 작업만 이어서 처리하세요.',
      '남은 작업이 없으면 도구를 부르지 말고 한 문장으로 완료했다고만 답하세요.',
    ].join(' ')

    await new Promise((resolve) => setTimeout(resolve, 150))
    await runModelTurn(continueInstruction, { showUserMessage: false })
  }

  const runReview = async (overridePrompt?: string) => {
    const nextPrompt = (overridePrompt ?? prompt).trim()
    if (!nextPrompt) return

    if (!hasKey || !selectedModelId) {
      setSettingsOpen(true)
      setOpenRouterError('API 키를 입력하고 모델 목록을 불러와 모델을 선택하세요.')
      return
    }

    setOpenRouterStatus('running')
    setOpenRouterError(null)
    setRequestNote(null)
    useWorkbenchStore.setState({ aiStatus: 'running', aiError: null })

    try {
      const result = await requestManager.current.runSchemaReview({
        project,
        prompt: nextPrompt,
        settings: { ...defaultOpenRouterSettings, apiKey: apiKey.trim(), modelId: selectedModelId },
      }, openRouterFetch)
      useWorkbenchStore.setState({ aiProposal: result.proposal, aiStatus: 'ready', aiError: null })
      setOpenRouterStatus('ready')
      setRequestNote(result.cached ? '동일한 스키마 요청의 세션 캐시 결과입니다.' : '행 데이터를 제외한 스키마 검토를 완료했습니다.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OpenRouter 스키마 검토에 실패했습니다.'
      useWorkbenchStore.setState({ aiStatus: 'error', aiError: message })
      setOpenRouterStatus('error')
      setOpenRouterError(message)
    }
  }

  const saveKey = async () => {
    if (studioHosted) {
      const configured = await studioSaveKey(apiKey.trim())
      setStudioKeyReady(configured)
      setApiKey('')
      setCredentialStatus({ available: true, stored: configured, message: '스튜디오에 저장했습니다. 다시 켜도 남고, 모든 도구가 같은 키를 씁니다.' })
      if (configured) void loadModels()
      return
    }
    setCredentialStatus(await saveOpenRouterApiKey(apiKey))
  }
  const loadKey = async () => {
    if (studioHosted) {
      const configured = await studioKeyConfigured()
      setStudioKeyReady(configured)
      setCredentialStatus({ available: true, stored: configured, message: configured ? '스튜디오에 저장된 키를 사용합니다.' : '스튜디오에 저장된 키가 없습니다.' })
      if (configured) void loadModels()
      return
    }
    const result = await loadOpenRouterApiKey()
    setCredentialStatus(result)
    if (result.apiKey) setApiKey(result.apiKey)
  }
  const forgetKey = async () => {
    if (studioHosted) {
      await studioDeleteKey()
      setStudioKeyReady(false)
      setApiKey('')
      setCredentialStatus({ available: true, stored: false, message: '스튜디오에서 키를 지웠습니다.' })
      return
    }
    setCredentialStatus(await deleteOpenRouterApiKey())
    setApiKey('')
  }
  const cancelRequest = () => {
    requestManager.current.cancelActiveRequest()
    setOpenRouterStatus('idle')
    useWorkbenchStore.setState({ aiStatus: 'idle', aiError: null })
    setRequestNote('요청을 취소했습니다.')
  }

  const openAssistant = () => {
    if (window.matchMedia('(max-width: 1279px)').matches) setExplorerCollapsed(true)
    setAssistantCollapsed(false)
  }

  if (assistantCollapsed) {
    return (
      <aside className="assistant-panel collapsed" aria-label="AI 도우미">
        <button className="assistant-expand" type="button" aria-label="AI 패널 열기" title="AI 패널 열기" onClick={openAssistant}>
          <Bot aria-hidden="true" size={18} />
          <span>AI</span>
        </button>
      </aside>
    )
  }

  return (
    <aside className="assistant-panel" aria-label="AI 도우미">
      <div className="assistant-resizer" role="separator" aria-label="AI 패널 너비 조절" onPointerDown={beginResize} />
      <div className="assistant-panel-body" role="region" aria-label="AI 대화 패널">
      <header className="assistant-header">
        <div className="assistant-title">
          <span className="assistant-mark"><Bot aria-hidden="true" size={17} /></span>
          <div><strong>AI 작업 도우미</strong><span>{project.tables.length}개 테이블의 스키마 문맥</span></div>
        </div>
        <div className="assistant-header-actions">
          <button className="icon-button subtle" type="button" title="새 대화" aria-label="새 대화" disabled={aiMessages.length === 0 && !aiProposal} onClick={() => { startNewConversation(); setHistoryOpen(false) }}><SquarePen aria-hidden="true" size={16} /></button>
          <button className={historyOpen ? 'icon-button subtle active' : 'icon-button subtle'} type="button" title="지난 대화" aria-label="지난 대화" aria-expanded={historyOpen} onClick={() => { setHistoryOpen((open) => !open); setSettingsOpen(false) }}><MessagesSquare aria-hidden="true" size={16} /></button>
          <button className={settingsOpen ? 'icon-button subtle active' : 'icon-button subtle'} type="button" title="AI 연결 설정" onClick={() => { setSettingsOpen((open) => !open); setHistoryOpen(false) }}><Settings2 aria-hidden="true" size={16} /></button>
          <button className="icon-button subtle" type="button" title="AI 패널 접기" aria-label="AI 패널 접기" onClick={() => setAssistantCollapsed(true)}><ChevronsRight aria-hidden="true" size={16} /></button>
        </div>
      </header>

      {settingsOpen && (
        <section className="ai-settings" aria-label="OpenRouter 설정">
          <div className="ai-settings-heading"><div><strong>OpenRouter 연결</strong><span>{studioHosted ? '키는 스튜디오가 보관합니다. 프로젝트 파일에는 저장되지 않습니다.' : '키는 프로젝트 파일에 저장되지 않습니다.'}</span></div><button type="button" title="설정 닫기" onClick={() => setSettingsOpen(false)}><X aria-hidden="true" size={15} /></button></div>
          <div className="ai-mode-switch" aria-label="모델 요금제">
            <button className={tier === 'free' ? 'active' : ''} type="button" onClick={() => switchTier('free')}>무료</button>
            <button className={tier === 'paid' ? 'active' : ''} type="button" onClick={() => switchTier('paid')}>유료</button>
          </div>
          {tier === 'paid' && (
            <div className="ai-spend-note">
              <strong>이번 달 예상 사용액 {formatUsd(spentUsd)} / 상한 ${DEFAULT_MONTHLY_LIMIT_USD}</strong>
              <span>상한을 넘으면 요청이 자동으로 막힙니다. 무료 모델은 사용액에 잡히지 않아요.</span>
            </div>
          )}
          <label><span>API 키</span><input aria-label="OpenRouter API 키" type="password" autoComplete="off" placeholder={studioHosted && studioKeyReady ? '저장된 키 사용 중 · 바꾸려면 새 키 입력' : 'sk-or-...'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} /></label>
          {apiKey && <small>현재 입력: {maskApiKey(apiKey)}</small>}
          <div className="ai-key-actions">
            <button type="button" disabled={!apiKey.trim()} onClick={() => void saveKey()}><KeyRound aria-hidden="true" size={13} />보관</button>
            <button type="button" onClick={() => void loadKey()}><RefreshCw aria-hidden="true" size={13} />불러오기</button>
            <button type="button" onClick={() => void forgetKey()}><Trash2 aria-hidden="true" size={13} />삭제</button>
          </div>
          <button className="wide-action" type="button" disabled={openRouterStatus === 'checking'} onClick={() => void loadModels()}>
            <RefreshCw aria-hidden="true" size={14} />{openRouterStatus === 'checking' ? '모델 확인 중' : '모델 목록 불러오기'}
          </button>
          <label>
            <span>기본 모델</span>
            <select
              aria-label="OpenRouter 모델"
              value={selectedModelId}
              disabled={freeModels.length === 0}
              onChange={(event) => setSelectedModelId(event.target.value)}
            >
              <option value="">모델 목록을 먼저 불러오세요</option>
              {freeModels.map((model) => {
                const price = pricePerMillionTokens(model)
                const label = isFreeOpenRouterModel(model)
                  ? '무료'
                  : price ? `$${price.prompt.toFixed(2)}/1M` : '가격 미상'

                return <option key={model.id} value={model.id}>{`${model.name ?? model.id} · ${label}`}</option>
              })}
            </select>
          </label>
          <small>도구 호출이 가능한 모델만 표시됩니다.</small>
          <label className="ai-toggle-row">
            <input type="checkbox" checked={shareSampleRows} onChange={(event) => setShareSampleRows(event.target.checked)} />
            <span>
              <strong>기존 데이터 앞 20행 보여주기</strong>
              <small>선택한 테이블의 앞 20행만. 전체는 보내지 않습니다.</small>
            </span>
          </label>
          {credentialStatus && <small>{credentialStatus.message}</small>}
          {openRouterError && <small className="ai-setting-error">{openRouterError}</small>}
        </section>
      )}

      {historyOpen && (
        <section className="ai-history" aria-label="지난 대화">
          <div className="ai-settings-heading"><div><strong>지난 대화</strong><span>이 프로젝트에서 나눈 대화입니다. 표 파일과 따로 저장됩니다.</span></div><button type="button" title="닫기" onClick={() => setHistoryOpen(false)}><X aria-hidden="true" size={15} /></button></div>
          {aiConversations.length === 0 ? (
            <p className="ai-history-empty">아직 저장된 대화가 없습니다.</p>
          ) : (
            <ul>
              {[...aiConversations].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).map((conversation) => (
                <li key={conversation.id} className={conversation.id === activeConversationId ? 'active' : undefined}>
                  <button type="button" className="ai-history-open" onClick={() => { openConversation(conversation.id); setHistoryOpen(false) }}>
                    <strong>{conversation.title}</strong>
                    <small>
                      {new Date(conversation.updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' · '}{conversation.messages.length}개 메시지
                      {conversation.tokens.input + conversation.tokens.output > 0 && ` · ${(conversation.tokens.input + conversation.tokens.output).toLocaleString()} 토큰`}
                    </small>
                  </button>
                  <button type="button" className="ai-history-delete" title="대화 삭제" aria-label={`${conversation.title} 삭제`} onClick={() => deleteConversation(conversation.id)}><Trash2 aria-hidden="true" size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="assistant-thread">
        {/* 설정을 여는 동안에는 시작 카드를 숨긴다. 둘 다 '시작하기' 안내라 자리를 다툰다. */}
        {!settingsOpen && aiMessages.length === 0 && !aiProposal && aiStatus !== 'running' && (
          <div className="assistant-quick-start">
            <strong><Sparkles aria-hidden="true" size={15} />무엇이든 물어보세요</strong>
            <p className="assistant-quick-hint">테이블 구조를 함께 상의할 수 있어요. 아래 버튼으로 스키마 검토를 바로 실행할 수도 있습니다.</p>
            <button type="button" onClick={() => void runReview('현재 선택한 테이블의 키, 열 구성, 데이터 규칙을 검토해 주세요.')}>현재 테이블 검토</button>
            <button type="button" onClick={() => void runReview('전체 테이블의 PK/FK 연결과 누락된 관계를 검토해 주세요.')}>전체 관계 검토</button>
            <button type="button" onClick={() => void runReview('전체 스키마의 정규화 수준과 중복 데이터 위험을 점검해 주세요.')}>정규화 점검</button>
          </div>
        )}
        {aiMessages.map((message) => (
          <div className={message.role === 'user' ? 'assistant-message chat user' : 'assistant-message chat assistant'} key={message.id}>
            {message.content}
          </div>
        ))}
        {aiStatus === 'running' && <div className="assistant-message assistant"><span className="typing-dot" />생각하고 있어요…</div>}
        {aiPendingBatch && (
          <div className="assistant-message assistant ai-batch-card">
            <strong className="ai-batch-title"><Sparkles aria-hidden="true" size={14} />이렇게 진행할까요?</strong>
            <span className="ai-batch-summary">{aiPendingBatch.summary}</span>
            {aiPendingBatch.steps.length > 0 && (
              <ol className="ai-batch-steps">
                {aiPendingBatch.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            )}
            {aiPendingBatch.rowPlans.map((rowPlan) => (
              <div className="ai-row-preview" key={rowPlan.tableName}>
                <span className="ai-row-preview-head">
                  {rowPlan.tableName} · {rowPlan.totalCount.toLocaleString()}행 중 앞 {rowPlan.previewRows.length}행 미리보기
                </span>
                <div className="ai-row-preview-scroll">
                  <table>
                    <thead>
                      <tr>{rowPlan.previewColumns.map((column) => <th key={column}>{column}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rowPlan.previewRows.map((row, rowIndex) => (
                        <tr key={`${rowPlan.tableName}-${rowIndex}`}>
                          {row.map((cell, cellIndex) => <td key={`${rowPlan.previewColumns[cellIndex] ?? cellIndex}`}>{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {aiPendingBatch.issues.length > 0 && (
              <div className="ai-batch-issues">
                {aiPendingBatch.issues.map((issue) => (
                  <span key={issue}><AlertTriangle aria-hidden="true" size={12} />{issue}</span>
                ))}
              </div>
            )}
            <div className="ai-batch-actions">
              <button
                className="ai-batch-approve"
                type="button"
                disabled={aiPendingBatch.commands.length === 0}
                title={aiPendingBatch.commands.length === 0 ? '적용할 수 있는 변경이 없습니다.' : '변경을 적용합니다. 되돌리기 한 번으로 취소할 수 있어요.'}
                onClick={() => void approveAndContinue()}
              >
                <CheckCircle2 aria-hidden="true" size={14} />승인하고 적용
              </button>
              <button className="ai-batch-discard" type="button" onClick={discardAiPendingBatch}>취소</button>
            </div>
            <small className="ai-batch-note">적용해도 되돌리기(Undo) 한 번이면 전부 원래대로 돌아갑니다.</small>
          </div>
        )}
        {aiProposal && (
          <div className="assistant-message assistant proposal-message">
            <strong>{aiProposal.summary}</strong>
            <span>신뢰도 {Math.round(aiProposal.confidence * 100)}% · 테이블 {aiProposal.tableIds.length} · 열 {aiProposal.columnIds.length} · 관계 {aiProposal.relationIds.length}</span>
            {aiProposal.findings.slice(0, 6).map((finding) => (
              <button className={`ai-finding ${finding.severity}`} type="button" key={finding.issueId} onClick={() => {
                const tableId = finding.tableIds[0]
                if (tableId) { selectTable(tableId); setMainView('schema') }
              }}>
                <AlertTriangle aria-hidden="true" size={13} /><span><strong>{finding.title}</strong><small>{finding.message}</small></span>
              </button>
            ))}
            {aiProposal.proposedOperations.map((operation) => <p className="ai-operation" key={operation}>{operation}</p>)}
            <span>검토 가능한 Command 초안 {aiProposal.commandDrafts.length}개</span>
            <div className="proposal-actions">
              <button type="button" onClick={() => setBottomPanel('problems')}>문제 목록</button>
              <button type="button" disabled={aiProposal.commandDrafts.length === 0} title={aiProposal.commandDrafts.length === 0 ? '변환 가능한 구조화 Command 초안이 없습니다.' : 'Command로 변환해 변경 검토 열기'} onClick={stageAiCommandSuggestion}>제안을 Command로 검토</button>
            </div>
          </div>
        )}
        {aiError && <div className="assistant-message error">{aiError}</div>}
        {requestNote && <div className="assistant-request-note"><CheckCircle2 aria-hidden="true" size={13} />{requestNote}</div>}
      </div>

      <div className="assistant-composer">
        <textarea id="ai-message-input" aria-label="AI에게 요청" placeholder="테이블 구조를 물어보거나 원하는 작업을 말해보세요" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendChat() }
        }} />
        <div className="assistant-composer-actions">
          {pendingCostUsd !== null && (
            <span className="ai-cost-preview" title="보내기 전 예상 비용입니다. 실제 청구는 응답이 알려주는 실제 사용량으로 기록됩니다.">
              이번 요청 약 {formatUsd(pendingCostUsd)}
            </span>
          )}
          <button className="text-action" type="button" onClick={() => void runReview('전체 스키마의 PK/FK, 정규화, 런타임 출력 위험을 검토해 주세요.')}>전체 구조 검토</button>
          {openRouterStatus === 'running' ? (
            <button className="send-button cancel" type="button" title="AI 요청 취소" onClick={cancelRequest}><Square aria-hidden="true" size={14} /></button>
          ) : (
            <button className="send-button" type="button" title="AI에게 보내기" disabled={!prompt.trim() || aiStatus === 'running'} onClick={() => void sendChat()}><Send aria-hidden="true" size={16} /></button>
          )}
        </div>
      </div>
      </div>
    </aside>
  )
}

const MODEL_CHOICE_KEY = 'gsw-ai-model-choice'

function readModelChoice(): { tier: AiTier; modelId: string } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(MODEL_CHOICE_KEY) ?? '{}') as { tier?: string; modelId?: string }
    return { tier: raw.tier === 'paid' ? 'paid' : 'free', modelId: typeof raw.modelId === 'string' ? raw.modelId : '' }
  } catch {
    return { tier: 'free', modelId: '' }
  }
}

function writeModelChoice(choice: { tier: AiTier; modelId: string }) {
  try {
    window.localStorage.setItem(MODEL_CHOICE_KEY, JSON.stringify(choice))
  } catch {
    // 저장 공간을 못 쓰면 다음에 다시 고르면 된다.
  }
}
