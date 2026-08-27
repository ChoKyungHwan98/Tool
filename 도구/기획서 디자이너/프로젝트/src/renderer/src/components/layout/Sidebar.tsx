import { useEffect, useState } from 'react'
import { cn } from '@renderer/lib/utils'
import {
  FolderOpen,
  Settings,
  Plus,
  SwatchBook,
  Type,
  LayoutTemplate,
  ChartNoAxesCombined,
  FileCode2,
  FilePenLine,
  Presentation
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { ipc } from '@renderer/lib/ipc'

export function Sidebar(): React.JSX.Element {
  const location = useLocation()
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    let disposed = false
    void ipc
      .getAppVersion()
      .then((result) => {
        if (!disposed) {
          setAppVersion(String(result?.version || ''))
        }
      })
      .catch(() => {
        if (!disposed) setAppVersion('')
      })
    return () => {
      disposed = true
    }
  }, [])

  const navSections = [
    {
      label: '기획',
      items: [
        { path: '/designer', icon: FilePenLine, label: '새 기획서', exact: true },
        { path: '/designer/workspaces', icon: FolderOpen, label: '기획서 보관함' }
      ]
    },
    {
      label: '슬라이드 도구',
      items: [
        { path: '/studio', icon: Presentation, label: '슬라이드 작업실' },
        { path: '/sessions', icon: FolderOpen, label: '슬라이드 보관함' },
        { path: '/templates', icon: LayoutTemplate, label: '템플릿' },
        { path: '/styles', icon: SwatchBook, label: '스타일' },
        { path: '/fonts', icon: Type, label: '글꼴' },
        { path: '/edit-html', icon: FileCode2, label: '웹 편집기' }
      ]
    },
    {
      label: '환경',
      items: [
        { path: '/token-usage', icon: ChartNoAxesCombined, label: 'AI 사용량' },
        { path: '/settings', icon: Settings, label: '설정' }
      ]
    }
  ]

  return (
    <aside className="flex h-full w-full flex-col bg-[#17202a] text-white">
      <div className="px-5 pb-5 pt-4">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-[#f5f1e9] shadow-[0_8px_24px_rgba(0,0,0,0.24)]">
            <span className="absolute left-2.5 top-2.5 h-1.5 w-5 rounded-full bg-[#17202a]" />
            <span className="absolute left-2.5 top-[18px] h-1.5 w-3.5 rounded-full bg-[#d85f43]" />
            <span className="absolute left-2.5 top-[26px] h-1.5 w-5 rounded-full bg-[#4d7471]" />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold leading-none tracking-[-0.03em]">
              기획서 디자이너
            </h1>
            <p className="mt-1.5 text-[10px] font-medium tracking-[0.08em] text-white/45">
              LOGIC TO LAYOUT
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {navSections.map((section) => (
          <div key={section.label}>
            <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.14em] text-white/35">
              {section.label}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = item.exact
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors',
                      isActive
                        ? 'bg-[#f5f1e9] font-semibold text-[#17202a]'
                        : 'text-white/62 hover:bg-white/8 hover:text-white'
                    )}
                  >
                    <item.icon
                      className={cn('h-4 w-4', isActive ? 'text-[#d85f43]' : 'text-white/50')}
                    />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/8 px-4 py-4">
        <Link
          to="/designer"
          className="flex items-center justify-between gap-2 rounded-xl bg-[#d85f43] px-3 py-2.5 text-[12px] font-semibold text-white shadow-[0_10px_24px_rgba(216,95,67,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#e16c51]"
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <Plus className="h-3.5 w-3.5 shrink-0" />새 기획서 시작
          </span>
          {appVersion ? (
            <span className="shrink-0 text-[10px] font-normal text-white/70">v{appVersion}</span>
          ) : null}
        </Link>
      </div>
    </aside>
  )
}
