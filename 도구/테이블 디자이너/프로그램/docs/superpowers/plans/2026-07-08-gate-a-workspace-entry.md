# Gate A-1: 워크스페이스 진입 흐름 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 앱을 실행하면 대시보드가 먼저 뜨고, 카드를 눌러 샘플/새 프로젝트를 열면 워크벤치로 들어가고, 워크벤치에서 대시보드로 돌아갈 수 있게 한다.

**Architecture:** `workbenchStore`에 `appView: 'dashboard' | 'workbench'` 상태를 추가하고 App 레벨에서 라우팅한다. 워크벤치 컴포넌트(TopBar 등)는 `document`가 항상 유효하다고 가정하므로, 대시보드 모드에서는 아예 마운트하지 않아 null 가드가 필요 없다. 프로젝트를 열 때 document를 교체하고 appView를 workbench로 바꾼다.

**Tech Stack:** React 19, Zustand 5, TypeScript, Vitest + @testing-library/react, lucide-react 아이콘.

**범위 밖(후속 계획):** Tauri 파일 저장/열기 + `recent.json`(계획 A-2). store 3분리 + 증분 검증으로 렉 뿌리 제거(계획 A-3).

---

### Task 1: 빈 프로젝트 팩토리

`새 프로젝트`가 만들 최소 프로젝트. 테이블이 0개면 `requireTable(project, selectedTableId)`가 throw하므로(TopBar.tsx:41, DataGridView.tsx:83) 스타터 테이블 1개를 포함한다. 캔버스에 보이도록 layout 노드도 넣는다.

**Files:**
- Create: `src/domain/emptyProject.ts`
- Test: `src/domain/emptyProject.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/domain/emptyProject.test.ts
import { describe, expect, it } from 'vitest'
import { createEmptyProject } from './emptyProject'

describe('createEmptyProject', () => {
  it('스타터 테이블 1개와 그 id 컬럼을 PK로 가진 프로젝트를 만든다', () => {
    const project = createEmptyProject('My Game')

    expect(project.name).toBe('My Game')
    expect(project.tables).toHaveLength(1)

    const table = project.tables[0]!
    expect(table.columns).toHaveLength(1)
    expect(table.primaryKey.columnIds).toEqual([table.columns[0]!.columnId])
    expect(project.layout.nodes).toHaveLength(1)
    expect(project.layout.nodes[0]!.entityId).toBe(table.tableId)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/domain/emptyProject.test.ts`
Expected: FAIL — `createEmptyProject` 없음.

- [ ] **Step 3: 최소 구현**

```ts
// src/domain/emptyProject.ts
import { makeId } from './ids'
import type { SchemaProject } from './schema'
import { createTable } from './schemaFactories'

export function createEmptyProject(name: string): SchemaProject {
  const starterTableId = makeId('table')
  const idColumnId = makeId('column')
  const starterTable = createTable({
    tableId: starterTableId,
    name: 'NewTable',
    columns: [{ columnId: idColumnId, name: 'NewTableId', dataType: { kind: 'string' }, nullable: false }],
    primaryKeyColumnIds: [idColumnId],
  })

  return {
    projectId: makeId('project'),
    name,
    schemaVersion: '0.1.0',
    tables: [starterTable],
    enums: [],
    relations: [],
    functionalDependencies: [],
    exportViews: [],
    layout: { nodes: [{ entityId: starterTableId, x: 80, y: 80 }] },
    commandHistory: [],
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/domain/emptyProject.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/domain/emptyProject.ts src/domain/emptyProject.test.ts
git commit -m "feat: add empty project factory for new-project flow"
```

---

### Task 2: 스토어에 appView + 진입 액션 추가

**Files:**
- Modify: `src/presentation/state/workbenchStore.ts`
- Test: `src/presentation/state/workbenchStore.navigation.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/presentation/state/workbenchStore.navigation.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkbenchStore } from './workbenchStore'

describe('워크스페이스 진입 네비게이션', () => {
  beforeEach(() => {
    useWorkbenchStore.setState({ appView: 'dashboard' })
  })

  it('샘플 프로젝트를 워크벤치로 연다', () => {
    useWorkbenchStore.getState().openSampleProject()

    const state = useWorkbenchStore.getState()
    expect(state.appView).toBe('workbench')
    expect(state.document.schema.tables.length).toBeGreaterThan(0)
    expect(state.undoStack).toHaveLength(0)
  })

  it('스타터 테이블을 가진 새 프로젝트를 열고, 대시보드로 돌아온다', () => {
    useWorkbenchStore.getState().openNewProject('테스트')

    let state = useWorkbenchStore.getState()
    expect(state.appView).toBe('workbench')
    expect(state.document.schema.name).toBe('테스트')
    expect(state.document.schema.tables).toHaveLength(1)
    expect(state.selectedTableId).toBe(state.document.schema.tables[0]!.tableId)

    useWorkbenchStore.getState().returnToDashboard()
    state = useWorkbenchStore.getState()
    expect(state.appView).toBe('dashboard')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/presentation/state/workbenchStore.navigation.test.ts`
Expected: FAIL — `appView` / `openSampleProject` 없음.

- [ ] **Step 3: 구현 — 타입/초기값 추가**

`src/presentation/state/workbenchStore.ts` 상단 타입 영역(`export type BottomPanel = ...` 다음 줄)에 추가:

```ts
export type AppView = 'dashboard' | 'workbench'
```

`interface WorkbenchState`의 `readonly bottomPanel: BottomPanel` 아래에 추가:

```ts
  readonly appView: AppView
```

같은 인터페이스의 액션 목록(`setBottomPanel(panel: BottomPanel): void` 아래)에 추가:

```ts
  openSampleProject(): void
  openNewProject(name?: string): void
  returnToDashboard(): void
```

- [ ] **Step 4: 구현 — 초기 상태와 액션**

`createEmptyProject` import를 파일 상단 import 블록에 추가:

```ts
import { createEmptyProject } from '../../domain/emptyProject'
```

`create<WorkbenchState>(...)`의 초기 상태에서 `bottomPanel: 'closed',` 아래에 추가:

```ts
  appView: 'dashboard',
```

`setBottomPanel: (panel) => set({ bottomPanel: panel }),` 아래에 액션 3개 추가:

```ts
  openSampleProject: () =>
    set({
      document: createWorkbenchDocument(crowdProject, crowdSampleRows),
      importIssues: [],
      selectedTableId: sampleIds.rule,
      selectedColumnId: null,
      mainView: 'schema',
      bottomPanel: 'closed',
      undoStack: [],
      redoStack: [],
      pendingCommand: null,
      aiProposal: null,
      aiStatus: 'idle',
      aiError: null,
      appView: 'workbench',
    }),
  openNewProject: (name) => {
    const project = createEmptyProject(name?.trim() || '새 프로젝트')
    const starterTable = project.tables[0]!

    set({
      document: createWorkbenchDocument(project, { [starterTable.tableId]: [] }),
      importIssues: [],
      selectedTableId: starterTable.tableId,
      selectedColumnId: null,
      mainView: 'schema',
      bottomPanel: 'closed',
      undoStack: [],
      redoStack: [],
      pendingCommand: null,
      aiProposal: null,
      aiStatus: 'idle',
      aiError: null,
      appView: 'workbench',
    })
  },
  returnToDashboard: () => set({ appView: 'dashboard' }),
```

- [ ] **Step 5: 테스트 통과 + 타입체크**

Run: `npx vitest run src/presentation/state/workbenchStore.navigation.test.ts`
Expected: PASS.
Run: `npm run typecheck`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/presentation/state/workbenchStore.ts src/presentation/state/workbenchStore.navigation.test.ts
git commit -m "feat: add dashboard/workbench appView navigation to store"
```

---

### Task 3: 대시보드 컴포넌트

**Files:**
- Create: `src/presentation/components/Dashboard.tsx`
- Test: `src/presentation/components/Dashboard.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/presentation/components/Dashboard.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkbenchStore } from '../state/workbenchStore'
import { Dashboard } from './Dashboard'

describe('Dashboard', () => {
  beforeEach(() => {
    useWorkbenchStore.setState({ appView: 'dashboard' })
  })

  it('샘플 카드를 누르면 샘플 프로젝트를 워크벤치로 연다', async () => {
    render(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: /샘플 프로젝트 열기/ }))
    expect(useWorkbenchStore.getState().appView).toBe('workbench')
  })

  it('새 프로젝트 카드를 누르면 스타터 테이블 1개짜리 프로젝트를 연다', async () => {
    render(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: /새 프로젝트/ }))
    const state = useWorkbenchStore.getState()
    expect(state.appView).toBe('workbench')
    expect(state.document.schema.tables).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/presentation/components/Dashboard.test.tsx`
Expected: FAIL — `Dashboard` 없음.

- [ ] **Step 3: 구현**

```tsx
// src/presentation/components/Dashboard.tsx
import { FilePlus2, FolderOpen, Sparkles } from 'lucide-react'
import { useWorkbenchStore } from '../state/workbenchStore'

export function Dashboard() {
  const openSampleProject = useWorkbenchStore((state) => state.openSampleProject)
  const openNewProject = useWorkbenchStore((state) => state.openNewProject)

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Game Schema Workbench</h1>
        <p>게임 테이블을 설계하고, 관계를 눈으로 보고, 검증해서 내보내는 작업대</p>
      </header>
      <section className="dashboard-actions" aria-label="시작하기">
        <button className="project-card new" type="button" onClick={() => openNewProject('새 프로젝트')}>
          <FilePlus2 aria-hidden="true" size={28} />
          <span className="card-title">새 프로젝트</span>
          <span className="card-sub">빈 프로젝트로 시작</span>
        </button>
        <button className="project-card sample" type="button" onClick={openSampleProject}>
          <Sparkles aria-hidden="true" size={28} />
          <span className="card-title">샘플 프로젝트 열기</span>
          <span className="card-sub">군중 시스템 예제로 둘러보기</span>
        </button>
        <div className="project-card disabled" aria-disabled="true">
          <FolderOpen aria-hidden="true" size={28} />
          <span className="card-title">프로젝트 열기</span>
          <span className="card-sub">파일에서 불러오기 (준비 중)</span>
        </div>
      </section>
      <section className="dashboard-recent" aria-label="최근 프로젝트">
        <h2>최근 프로젝트</h2>
        <p className="empty-recent">아직 최근 프로젝트가 없어요. 새로 만들거나 샘플을 열어보세요.</p>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/presentation/components/Dashboard.test.tsx`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/presentation/components/Dashboard.tsx src/presentation/components/Dashboard.test.tsx
git commit -m "feat: add dashboard entry screen"
```

---

### Task 4: App 라우팅 + 워크벤치의 대시보드 복귀 버튼

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/presentation/components/TopBar.tsx`

- [ ] **Step 1: App.tsx를 appView로 분기**

`src/App.tsx` 전체를 아래로 교체:

```tsx
import '@xyflow/react/dist/style.css'
import './App.css'
import { BottomPanel } from './presentation/components/BottomPanel'
import { Dashboard } from './presentation/components/Dashboard'
import { DataGridView } from './presentation/components/DataGridView'
import { Inspector } from './presentation/components/Inspector'
import { ProjectExplorer } from './presentation/components/ProjectExplorer'
import { RuntimeExportView } from './presentation/components/RuntimeExportView'
import { SchemaCanvas } from './presentation/components/SchemaCanvas'
import { TopBar } from './presentation/components/TopBar'
import { useWorkbenchStore } from './presentation/state/workbenchStore'

function App() {
  const appView = useWorkbenchStore((state) => state.appView)
  const mainView = useWorkbenchStore((state) => state.mainView)
  const bottomPanel = useWorkbenchStore((state) => state.bottomPanel)

  if (appView === 'dashboard') {
    return (
      <div className="app-shell">
        <Dashboard />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <TopBar />
      <div className={bottomPanel === 'closed' ? 'workspace-grid panel-closed' : 'workspace-grid'}>
        <ProjectExplorer />
        <main className="main-pane">
          {mainView === 'schema' && <SchemaCanvas />}
          {mainView === 'data' && <DataGridView />}
          {mainView === 'runtime' && <RuntimeExportView />}
        </main>
        <Inspector />
        {bottomPanel !== 'closed' && <BottomPanel />}
      </div>
    </div>
  )
}

export default App
```

- [ ] **Step 2: TopBar에 대시보드 복귀 버튼 추가**

`src/presentation/components/TopBar.tsx`의 lucide import에 `LayoutDashboard` 추가(첫 import 블록):

```ts
import {
  Bot,
  Database,
  Download,
  FileJson,
  GitCompareArrows,
  LayoutDashboard,
  Redo2,
  Rows3,
  ShieldCheck,
  Table2,
  Undo2,
  Upload,
} from 'lucide-react'
```

`const redo = useWorkbenchStore((state) => state.redo)` 아래에 추가:

```ts
  const returnToDashboard = useWorkbenchStore((state) => state.returnToDashboard)
```

`<div className="menu-strip" ...>` 바로 위(`<header className="top-bar">` 다음)에 홈 버튼 추가:

```tsx
      <button className="icon-button" type="button" title="대시보드로" onClick={returnToDashboard}>
        <LayoutDashboard aria-hidden="true" size={17} />
      </button>
```

- [ ] **Step 3: 타입체크 + 전체 테스트**

Run: `npm run typecheck`
Expected: 에러 없음.
Run: `npm run test:run`
Expected: 기존 62개 + 신규 테스트 모두 PASS.

- [ ] **Step 4: 커밋**

```bash
git add src/App.tsx src/presentation/components/TopBar.tsx
git commit -m "feat: route between dashboard and workbench"
```

---

### Task 5: 대시보드 스타일 + 수동 확인

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: 대시보드 CSS 추가**

`src/App.css` 맨 끝에 추가:

```css
.dashboard {
  height: 100%;
  overflow-y: auto;
  padding: 48px 40px 64px;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.dashboard-header h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 700;
}

.dashboard-header p {
  margin: 0;
  color: var(--muted, #8a8f98);
  font-size: 15px;
}

.dashboard-actions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.project-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 22px 20px;
  border: 1px solid var(--border, #2a2d34);
  border-radius: 12px;
  background: var(--panel, #1b1d22);
  cursor: pointer;
  text-align: left;
  transition: border-color 120ms ease, transform 120ms ease;
}

.project-card:hover:not(.disabled) {
  border-color: var(--accent, #4c8bf5);
  transform: translateY(-2px);
}

.project-card .card-title {
  font-size: 16px;
  font-weight: 600;
  margin-top: 4px;
}

.project-card .card-sub {
  font-size: 13px;
  color: var(--muted, #8a8f98);
}

.project-card.disabled {
  cursor: default;
  opacity: 0.5;
}

.dashboard-recent h2 {
  margin: 0 0 12px;
  font-size: 18px;
}

.empty-recent {
  margin: 0;
  color: var(--muted, #8a8f98);
  font-size: 14px;
}
```

- [ ] **Step 2: 수동 확인**

Run: `npm run dev`
브라우저에서 `http://127.0.0.1:5173/` 열고 확인:
1. 대시보드가 먼저 뜬다(워크벤치 아님).
2. `샘플 프로젝트 열기` → 워크벤치 진입, 구조도에 테이블 보임.
3. 좌상단 대시보드 버튼 → 대시보드 복귀.
4. `새 프로젝트` → 워크벤치 진입, `NewTable` 하나 보임, 이름이 상단에 `새 프로젝트`.
5. 대시보드로 복귀 후 다시 샘플 열기 정상.

Expected: 5개 모두 정상. 렉/에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/App.css
git commit -m "style: add dashboard layout"
```

---

## Self-Review 결과

- **스펙 커버리지:** SPEC §3.1(대시보드), §2 흐름의 "실행→대시보드→프로젝트→워크벤치" 첫 조각 커버. 파일 열기/저장(§3.1 데이터 소스)·최근목록·store 3분리(§4)는 후속 계획으로 명시 분리.
- **플레이스홀더:** 없음. 모든 스텝에 실제 코드.
- **타입 일관성:** `appView`/`AppView`, `openSampleProject`/`openNewProject`/`returnToDashboard`가 store·컴포넌트·테스트에서 동일 이름. `createEmptyProject(name)`는 Task 1 정의와 Task 2 호출이 일치. `project.tables[0]!` 접근은 Task 1이 항상 테이블 1개를 보장하므로 안전.
- **크래시 회귀 방지:** 새 프로젝트가 테이블 0개면 `requireTable`가 throw → Task 1에서 스타터 테이블 1개로 예방.

## 후속 계획

- **A-2:** Tauri 파일 다이얼로그로 `.gsw` 저장/열기 + 앱 데이터 폴더 `recent.json` + 대시보드 최근 카드.
- **A-3:** `workbenchStore` schema/rows/ui 3분리 + 증분 검증(worker) → 셀 편집이 캔버스를 리렌더하지 않게(렉 뿌리 제거, SPEC §4).
