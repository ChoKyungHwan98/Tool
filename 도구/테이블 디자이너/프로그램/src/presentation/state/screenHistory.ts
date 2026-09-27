import type { DashboardSection } from '../components/dashboard/railItems'
import type { EntityId } from '../../domain/schema'
import { useWorkbenchStore, type AppView, type MainView } from './workbenchStore'

/**
 * 마우스 사이드 버튼(4번 뒤로, 5번 앞으로)과 스튜디오 상단 뒤로가기가 쓰는 화면 기록.
 * 화면 = 홈 목록 / 프로젝트 + 보기(전체 구조·테이블 편집·테이블 설계).
 * 더 갈 곳이 없으면 false를 돌려주고, 호출한 쪽이 스튜디오에 넘긴다.
 */
interface Screen {
  readonly appView: AppView
  readonly dashboardSection: DashboardSection
  readonly mainView: MainView
  readonly projectId: EntityId | null
}

const TOOL_NAVIGATION_CHANNEL = 'game-design-studio:tool-navigation'

const past: Screen[] = []
const future: Screen[] = []
let current: Screen | null = null
let jumping = false

function screenOf(state: ReturnType<typeof useWorkbenchStore.getState>): Screen {
  return {
    appView: state.appView,
    dashboardSection: state.dashboardSection,
    mainView: state.mainView,
    projectId: state.currentProjectId,
  }
}

const keyOf = (screen: Screen) => screen.appView === 'dashboard'
  ? `dashboard:${screen.dashboardSection}`
  : `workbench:${screen.projectId}:${screen.mainView}`

function record() {
  const next = screenOf(useWorkbenchStore.getState())
  if (current && keyOf(current) === keyOf(next)) return
  if (current && !jumping) {
    past.push(current)
    future.length = 0
  }
  current = next
}

async function apply(target: Screen) {
  const store = useWorkbenchStore.getState()
  if (target.appView === 'dashboard') {
    if (store.appView !== 'dashboard') await store.returnToDashboard()
    useWorkbenchStore.getState().setDashboardSection(target.dashboardSection)
    return
  }
  if (!target.projectId) return
  if (store.appView !== 'workbench' || store.currentProjectId !== target.projectId) {
    await store.openProjectById(target.projectId)
  }
  useWorkbenchStore.getState().setMainView(target.mainView)
}

/** 한 칸 이동한다. 이동할 기록이 없으면 false. */
export async function stepScreen(direction: 'back' | 'forward'): Promise<boolean> {
  const from = direction === 'back' ? past : future
  const to = direction === 'back' ? future : past
  const target = from.pop()
  if (!target || !current) return false
  to.push(current)
  jumping = true
  try {
    await apply(target)
  } finally {
    jumping = false
    current = screenOf(useWorkbenchStore.getState())
  }
  return true
}

function isStudioHosted() {
  return new URLSearchParams(window.location.search).get('host') === 'studio' && window.parent !== window
}

/**
 * 한 번만 설치한다.
 * - 사이드 버튼: 도구 안 기록으로 이동하고, 끝이면 스튜디오에 넘긴다.
 * - 스튜디오 상단 뒤로가기: 'navigate-back' 요청에 도구 안에서 처리했는지 답한다.
 */
export function installScreenHistory(): () => void {
  current = screenOf(useWorkbenchStore.getState())
  const unsubscribe = useWorkbenchStore.subscribe(record)

  const swallow = (event: MouseEvent) => {
    if (event.button === 3 || event.button === 4) event.preventDefault()
  }
  const onMouseUp = (event: MouseEvent) => {
    if (event.button !== 3 && event.button !== 4) return
    event.preventDefault()
    const direction = event.button === 3 ? 'back' : 'forward'
    void stepScreen(direction).then((handled) => {
      if (!handled && isStudioHosted()) {
        window.parent.postMessage({ channel: TOOL_NAVIGATION_CHANNEL, type: 'side-navigate', direction }, '*')
      }
    })
  }
  const onMessage = (event: MessageEvent) => {
    if (event.source !== window.parent) return
    if (event.data?.channel !== TOOL_NAVIGATION_CHANNEL || event.data?.type !== 'navigate-back') return
    void stepScreen('back').then((handled) => {
      window.parent.postMessage({
        channel: TOOL_NAVIGATION_CHANNEL,
        type: 'navigate-back:result',
        requestId: event.data.requestId,
        handled,
      }, '*')
    })
  }

  window.addEventListener('mousedown', swallow)
  window.addEventListener('auxclick', swallow)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('message', onMessage)
  return () => {
    unsubscribe()
    window.removeEventListener('mousedown', swallow)
    window.removeEventListener('auxclick', swallow)
    window.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('message', onMessage)
  }
}
