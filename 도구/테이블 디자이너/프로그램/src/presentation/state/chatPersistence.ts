import { loadChatHistory, saveChatHistory } from '../../infrastructure/chatHistoryStore'
import { useWorkbenchStore } from './workbenchStore'

const SAVE_DELAY_MS = 300

/**
 * 프로젝트를 열면 그 프로젝트의 AI 대화 목록을 불러오고, 대화가 바뀌면 잠시 뒤 저장한다.
 * 불러오기에 실패한 프로젝트는 저장도 하지 않는다. 빈 목록으로 기존 기록을 덮어쓰지 않기 위해서다.
 */
export function installChatPersistence(): () => void {
  let loadingFor: string | null = null
  let saveTimer: number | undefined

  const load = (projectId: string) => {
    loadingFor = projectId
    loadChatHistory(projectId)
      .then((history) => {
        if (useWorkbenchStore.getState().currentProjectId !== projectId) return
        const active = history.conversations.find((item) => item.id === history.activeConversationId)
          ?? [...history.conversations].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
          ?? null
        useWorkbenchStore.setState({
          aiConversations: history.conversations,
          activeConversationId: active?.id ?? null,
          aiMessages: active?.messages ?? [],
          aiChatLoadedFor: projectId,
        })
      })
      .catch(() => {
        if (useWorkbenchStore.getState().currentProjectId !== projectId) return
        useWorkbenchStore.setState({ aiConversations: [], activeConversationId: null, aiChatLoadedFor: `failed:${projectId}` })
      })
      .finally(() => { if (loadingFor === projectId) loadingFor = null })
  }

  const check = (
    state: ReturnType<typeof useWorkbenchStore.getState>,
    previous?: ReturnType<typeof useWorkbenchStore.getState>,
  ) => {
    const projectId = state.currentProjectId
    if (!projectId) return
    if (state.aiChatLoadedFor !== projectId && state.aiChatLoadedFor !== `failed:${projectId}`) {
      if (loadingFor !== projectId) load(projectId)
      return
    }
    if (state.aiChatLoadedFor !== projectId || !previous) return
    if (state.aiConversations === previous.aiConversations && state.activeConversationId === previous.activeConversationId) return
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      const latest = useWorkbenchStore.getState()
      if (latest.aiChatLoadedFor !== projectId) return
      void saveChatHistory(projectId, {
        version: 1,
        activeConversationId: latest.activeConversationId,
        conversations: latest.aiConversations,
      })
    }, SAVE_DELAY_MS)
  }

  check(useWorkbenchStore.getState())
  const unsubscribe = useWorkbenchStore.subscribe(check)
  return () => {
    unsubscribe()
    window.clearTimeout(saveTimer)
  }
}
