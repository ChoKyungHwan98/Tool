import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Clock3,
  FilePenLine,
  FolderOpen,
  Layers3,
  Loader2,
  Plus,
  ShieldCheck
} from 'lucide-react'
import { ipc } from '@renderer/lib/ipc'
import { Button } from '@renderer/components/ui/Button'
import { useToastStore } from '@renderer/store/toastStore'

type WorkspaceSummary = Awaited<ReturnType<typeof ipc.listDeckIrWorkspaces>>[number]

const formatUpdatedAt = (value: number): string =>
  new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))

export function DeckDesignerLibraryPage(): React.JSX.Element {
  const navigate = useNavigate()
  const toast = useToastStore()
  const [items, setItems] = useState<WorkspaceSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void ipc
      .listDeckIrWorkspaces()
      .then((result) => {
        if (active) setItems(result)
      })
      .catch((error) => {
        if (!active) return
        toast.error('기획서 목록을 불러오지 못했습니다.', {
          description: error instanceof Error ? error.message : String(error)
        })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [toast])

  return (
    <div className="h-full overflow-auto bg-[#f4f1ea] px-8 py-10 text-[#17202a]">
      <main className="mx-auto w-full max-w-6xl">
        <header className="flex items-end justify-between gap-8 border-b border-[#d8d2c8] pb-7">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#d85f43]">
              <FolderOpen className="h-4 w-4" /> 기획서 보관함
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">
              논리와 디자인 결정을 이어서 작업합니다.
            </h1>
            <p className="mt-3 text-sm text-[#687078]">
              원고, 근거, 목차, 디자인 방향과 슬라이드별 레이아웃 선택이 한 작업공간에 남습니다.
            </p>
          </div>
          <Button onClick={() => navigate('/designer')}>
            <Plus className="mr-2 h-4 w-4" /> 새 기획서
          </Button>
        </header>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center text-sm text-[#6f777e]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 작업공간을 불러오는 중
          </div>
        ) : items.length === 0 ? (
          <section className="mt-8 flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-[#c9c1b5] bg-white/65 text-center">
            <FilePenLine className="h-9 w-9 text-[#d85f43]" />
            <h2 className="mt-5 text-xl font-semibold">아직 저장된 기획서가 없습니다.</h2>
            <p className="mt-2 text-sm text-[#727980]">
              자유 원고 하나로 첫 작업공간을 만들어 보세요.
            </p>
            <Button className="mt-6" onClick={() => navigate('/designer')}>
              첫 기획서 시작
            </Button>
          </section>
        ) : (
          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            {items.map((item) => (
              <button
                key={item.sessionId}
                type="button"
                onClick={() => navigate(`/designer/${item.sessionId}`)}
                className="group rounded-2xl border border-[#d8d2c8] bg-white p-5 text-left shadow-[0_10px_30px_rgba(23,32,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-[#d85f43]/55 hover:shadow-[0_16px_36px_rgba(23,32,42,0.10)]"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-[#798087]">
                      <span>REVISION {item.revision}</span>
                      {item.selectedDirectionName ? (
                        <span className="truncate rounded-full bg-[#edf0ef] px-2 py-1 text-[#446463]">
                          {item.selectedDirectionName}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 line-clamp-2 text-xl font-semibold tracking-[-0.025em]">
                      {item.title}
                    </h2>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[#a7adb1] transition-transform group-hover:translate-x-1 group-hover:text-[#d85f43]" />
                </div>
                <div className="mt-6 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-[#f4f1ea] px-3 py-2.5">
                    <Layers3 className="h-3.5 w-3.5 text-[#4d7471]" />
                    <div className="mt-2 text-lg font-semibold">{item.slideCount}</div>
                    <div className="text-[10px] text-[#7a8187]">슬라이드</div>
                  </div>
                  <div className="rounded-xl bg-[#f4f1ea] px-3 py-2.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#4d7471]" />
                    <div className="mt-2 text-lg font-semibold">{item.inventoryCount}</div>
                    <div className="text-[10px] text-[#7a8187]">근거</div>
                  </div>
                  <div className="rounded-xl bg-[#f4f1ea] px-3 py-2.5">
                    <FilePenLine className="h-3.5 w-3.5 text-[#d85f43]" />
                    <div className="mt-2 text-lg font-semibold">{item.dataRequirementCount}</div>
                    <div className="text-[10px] text-[#7a8187]">채울 데이터</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[11px] text-[#858b90]">
                  <Clock3 className="h-3.5 w-3.5" /> {formatUpdatedAt(item.updatedAt)}
                </div>
              </button>
            ))}
          </section>
        )}
      </main>
    </div>
  )
}
