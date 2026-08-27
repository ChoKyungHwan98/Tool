import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { compileAiToolCalls } from './application/aiTools'
import { useWorkbenchStore } from './presentation/state/workbenchStore'
import { publishTableArtifacts } from './infrastructure/studioArtifact'

if (import.meta.env.DEV) {
  // 개발 중 콘솔에서 상태를 확인하고 AI 제안 흐름을 시험하기 위한 훅.
  // DEV 가드 덕분에 프로덕션 번들에는 포함되지 않는다.
  Object.assign(globalThis, { __gsw: { store: useWorkbenchStore, compileAiToolCalls } })
}

if (new URLSearchParams(window.location.search).get('host') === 'studio') {
  let publishTimer = window.setTimeout(() => publishTableArtifacts(useWorkbenchStore.getState().document), 700)
  useWorkbenchStore.subscribe((state) => {
    window.clearTimeout(publishTimer)
    publishTimer = window.setTimeout(() => publishTableArtifacts(state.document), 700)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
