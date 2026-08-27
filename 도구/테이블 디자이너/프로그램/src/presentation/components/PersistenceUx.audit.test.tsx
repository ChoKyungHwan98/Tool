import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkbenchStore } from '../state/workbenchStore'
import { Dashboard } from './Dashboard'
import { SchemaCanvas } from './SchemaCanvas'
import { TopBar } from './TopBar'

describe('Gate 0 저장·대시보드 UI 감사', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('고정된 로컬 보관 문구 대신 실제 저장 상태를 표시한다', () => {
    render(<TopBar />)
    expect(screen.queryByText('로컬 보관')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/변경됨|저장 중|저장됨|저장 실패|복구됨/)
  })

  it('대시보드에서 사용자 프로젝트와 예제 프로젝트를 분리한다', async () => {
    useWorkbenchStore.setState({ appView: 'dashboard', projects: [], currentProjectId: null })
    render(<Dashboard />)
    expect(screen.getByRole('heading', { name: '내 프로젝트' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '예제' }))
    expect(screen.getByRole('heading', { name: '예제 프로젝트' })).toBeInTheDocument()
  })

  it('구조도 요약에서 종속성 용어를 노출하지 않는다', () => {
    render(<SchemaCanvas />)
    expect(screen.queryByText(/종속성/)).not.toBeInTheDocument()
  })
})
