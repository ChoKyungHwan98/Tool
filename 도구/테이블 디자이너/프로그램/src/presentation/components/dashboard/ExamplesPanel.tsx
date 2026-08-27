import { BookOpen, Network, Sparkles, Swords, Workflow } from 'lucide-react'

export function ExamplesPanel({ onOpenSample, onOpenGameC, onOpenGameD, onOpenAstraeContent, onOpenAstraeCombat }: {
  readonly onOpenSample: () => void
  readonly onOpenGameC: () => void
  readonly onOpenGameD: () => void
  readonly onOpenAstraeContent: () => void
  readonly onOpenAstraeCombat: () => void
}) {
  return (
    <section className="project-panel" aria-labelledby="example-projects-title">
      <div className="dashboard-section-heading">
        <div><h1 id="example-projects-title">예제 프로젝트</h1><span>기능을 확인한 뒤 내 프로젝트로 저장할 수 있습니다.</span></div>
      </div>
      <div className="example-project-list">
        <button type="button" aria-label="샘플 열기" onClick={onOpenSample}><Sparkles size={17} /><span><strong>관중 시스템</strong><small>복합 관계 예제</small></span></button>
        <button type="button" aria-label="게임 C PK/FK 예제" onClick={onOpenGameC}><Network size={17} /><span><strong>게임 C PK/FK 예제</strong><small>게임 아이템과 상점 관계</small></span></button>
        <button type="button" aria-label="게임 D 자동 배치 검증" onClick={onOpenGameD}><Workflow size={17} /><span><strong>게임 D 자동 배치 검증</strong><small>25개 테이블 대규모 구조</small></span></button>
        <button type="button" aria-label="아스트라 CASE 콘텐츠 데이터" onClick={onOpenAstraeContent}><BookOpen size={17} /><span><strong>아스트라 CASE 콘텐츠 데이터</strong><small>사건 → 시나리오 → 전투 → 결말</small></span></button>
        <button type="button" aria-label="아스트라 전투 캐릭터 데이터" onClick={onOpenAstraeCombat}><Swords size={17} /><span><strong>아스트라 전투·캐릭터 데이터</strong><small>전투 규칙·공통 BREAK·마법사·행동</small></span></button>
      </div>
    </section>
  )
}
