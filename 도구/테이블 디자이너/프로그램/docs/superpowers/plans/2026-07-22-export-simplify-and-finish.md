# 대시보드 전면 개편 · 내보내기 축소 · 검증 리포트

작성 2026-07-22 · 브랜치 `feature/grid-drag-extras` · 실행자: Sonnet

---

## 0. 이 문서를 읽는 법

- **Phase는 순서대로.** 각 Phase 끝의 "완료 조건"을 통과하지 못하면 다음으로 넘어가지 않는다.
- **Phase마다 커밋 1개.** 커밋 메시지는 각 Phase에 적어 두었다.
- `[결정됨]` 표시가 붙은 것은 사용자가 이미 고른 것이다. **뒤집지 않는다.**
- 계획에 없는 개선이 눈에 띄면 **하지 말고 Phase 5 리포트에 적는다.**
- 막히면 추측해서 밀어붙이지 말고, 그 지점을 리포트에 적고 다음 Phase로 넘어간다.

---

## 1. 배경과 확정된 결정

### 1-1. 대시보드

현재 대시보드는 `헤더 + 최근 프로젝트 목록 + 예제 프로젝트`가 세로로 쌓인 단일 컬럼이다.
프로젝트가 늘어나면 무너지고, `휴지통`·`즐겨찾기`·`설정` 같은 것들이 갈 자리가 없다.
목록 자체의 밀도는 이미 개선했지만(1-4 참고), **레이아웃 골격이 그대로**라 한계가 있다.

### 1-2. 내보내기

내보내기 서랍에 탭이 4개(`통합 Excel` / `CSV 묶음` / `런타임 출력` / `프로젝트 백업`) 있다.
`런타임 출력` 탭은 CSV 원문 미리보기와 데이터 리니지를 보여준다 — **"결과물이 어떻게 만들어지는가"를 보여주는 화면**이다.
사용자 판단: 그 과정은 중요하지 않다. 결과물만 있으면 된다.

### 1-3. `[결정됨]` 5가지

| # | 결정 | 내용 |
|---|---|---|
| D1 | 대시보드는 **A안(사이드바 레일)** 으로 전면 개편 | 좌측 고정 레일 + 우측 밀도 목록. 레일에 `전체 / 최근 / 즐겨찾기 / 휴지통 / 예제` |
| D2 | 레일은 **앱 셸**로 설계한다 | 사용자의 장기 목표가 "여러 도구를 합친 내 전용 툴"이다. 레일 항목을 JSX에 하드코딩하지 말고 **배열 설정으로 선언**해, 나중에 항목 하나 추가로 새 모듈이 붙게 만든다 |
| D3 | 내보내기는 **2개**만 | `통합 Excel`(전달용) + `프로젝트 백업 .gsw`(작업 이어받기용). `런타임 출력`과 `CSV 묶음`은 UI에서 제거 |
| D4 | `ExportView` **도메인은 유지** | UI·`exportRuntime`·스토어 액션만 걷어낸다. `.gsw` 저장 포맷과 `schemas/project.schema.json`이 `exportViews`를 포함하므로, 지우면 기존 저장 파일이 안 열릴 위험이 있다 |
| D5 | 순서는 **대시보드 먼저** | 제일 큰 덩어리를 먼저 끝낸다 |

### 1-4. 이미 끝난 것 (다시 하지 말 것)

2026-07-22 앞선 세션에서 [Dashboard.tsx](../../../src/presentation/components/Dashboard.tsx) / [polish.css](../../../src/presentation/styles/polish.css)에 반영 완료:

행 높이 42px · 컬럼 헤더 행 · 숫자 우측정렬 `tabular-nums` · 위치 칩 축약 · 상대 날짜(`오늘 01:55`) · 정렬 3종(최근/이름/규모) · `/` 검색 단축키 · 25개 페이지네이션 + `더 보기` · 행 메뉴 바깥클릭·Esc 닫기.

**이 목록 컴포넌트는 개편에서 재사용한다. 다시 만들지 않는다.** Phase 1에서 하는 일은 이 목록을 **레일 옆 오른쪽 패널로 옮기고**, 그 주변 골격을 새로 짜는 것이다.

### 1-5. 절대 금지 (가드레일)

1. `src/domain/commands.ts`, `schema.ts`, `validator.ts`, `impact.ts`의 **ExportView 관련 코드를 지우지 않는다.** (D4)
2. `src/domain/commands.ts`(116KB), `src/presentation/components/DataGridView.tsx`(109KB), `src/presentation/state/workbenchStore.ts`(63KB)를 **분할하지 않는다.** 이번 범위 밖이다.
3. 작업 트리에 아직 커밋되지 않은 다음 파일들은 **다른 작업의 진행물이다. 지우거나 되돌리지 않는다**:
   `src/application/aiSpend.ts(.test.ts)`, `src/application/rowGeneration.ts(.test.ts)`,
   그리고 수정 중인 `aiChat.ts`, `aiTools.ts`, `openRouterProvider.ts`, `AiAssistantPanel.tsx`, `SchemaCanvas.tsx`, `SmartRelationEdge.tsx`, `schemaCanvasEdges.ts`.
   → 이 계획이 건드릴 파일은 각 Phase에 명시된 것뿐이다.
4. **실패한 테스트를 테스트 쪽을 고쳐서 통과시키지 않는다.** 단, 이 계획이 의도적으로 바꾼 UI 때문에 깨진 테스트는 예외이며, 그 경우 Phase 5 리포트에 "의도된 변경으로 수정한 테스트" 목록을 남긴다.
5. `Dashboard`라는 **export 이름과 파일 경로를 유지한다.** `Dashboard.test.tsx`와 `PersistenceUx.audit.test.tsx`가 `render(<Dashboard />)`로 직접 렌더한다.

---

## Phase 0 — 기준선 확보

```bash
npm run typecheck
npm run lint
npm run test:run
```

- 결과(성공/실패 수, 실패 테스트 이름)를 메모한다. Phase 5 리포트의 "before" 칸에 들어간다.
- **이미 실패 중인 테스트가 있다면 고치지 말고 기록만 한다.** 이 계획 때문에 깨진 게 아니라는 증거다.
- e2e는 Phase 5에서 한 번만 돌린다.

**완료 조건**: 세 명령의 결과를 기록했다. **커밋 없음.**

---

## Phase 1 — 대시보드 전면 개편 (A안)

> 이 Phase가 이번 작업의 절반이다. 1-A → 1-F 순서로 진행하고, **각 소단계마다 `npm run test:run`이 통과하는 상태를 유지한다.**

### 목표 레이아웃

```
┌──────────────┬─────────────────────────────────────────┐
│ 게임 스키마    │  전체 프로젝트                30개        │
│ 워크벤치       │  [검색 /]        [최근순|이름순|규모순]   │
│              ├─────────────────────────────────────────┤
│ ▸ 전체 30     │  이름          테이블  관계   행   수정   │
│   최근        │  전투 밸런스      12    8   1.2k  오늘  ⋯│
│   즐겨찾기 3   │  아이템 마스터     7    3    840  어제  ⋯│
│   휴지통       │  …                                      │
│ ───────────  │                                         │
│   예제        │                                         │
│              │                                         │
│ [+ 새 프로젝트]│                                         │
└──────────────┴─────────────────────────────────────────┘
```

- 레일 폭 200px 고정, 배경 `--surface-1` 계열로 우측 패널과 한 단계 구분
- 레일 하단에 주 동작(`새 프로젝트`) 고정. 부 동작(`프로젝트 열기`, `CSV·Excel로 시작`)은 우측 패널 헤더 또는 레일 하단 보조 버튼
- 우측 패널은 **자기 영역만 스크롤**한다. 레일은 스크롤되지 않는다

### 1-A. 디렉터리와 껍데기

새로 만든다:

```
src/presentation/components/dashboard/
  DashboardShell.tsx      레일 + 우측 패널 그리드, 섹션 상태 소유
  DashboardRail.tsx       레일. 항목을 배열에서 렌더 (D2)
  ProjectListPanel.tsx    기존 목록 (검색·정렬·페이지네이션·행 메뉴)
  TrashPanel.tsx          휴지통
  ExamplesPanel.tsx       예제 프로젝트
  dialogs/NewProjectDialog.tsx
  dialogs/RenameProjectDialog.tsx
  dialogs/RecoveryPointsDialog.tsx
  dialogs/ConfirmDeleteDialog.tsx
```

`src/presentation/components/Dashboard.tsx`는 **`DashboardShell`을 렌더하는 얇은 래퍼로 남긴다** (가드레일 5).

### 1-B. 레일을 선언형으로 (D2 — 중요)

레일 항목을 JSX에 직접 쓰지 말고, `DashboardRail.tsx` 상단에 이렇게 선언한다:

```ts
type DashboardSection = 'all' | 'recent' | 'favorites' | 'trash' | 'examples'

interface RailItem {
  readonly id: DashboardSection
  readonly label: string
  readonly icon: LucideIcon
  readonly badge?: (context: RailBadgeContext) => number | undefined
  readonly group: 'library' | 'resource'
}

const RAIL_ITEMS: readonly RailItem[] = [ ... ]
```

- `group`이 다르면 사이에 구분선을 넣는다
- 나중에 새 모듈을 붙일 때 **이 배열에 한 줄 추가하고 패널 컴포넌트 하나만 쓰면 되도록** 한다
- 섹션 → 패널 매핑도 `Record<DashboardSection, ReactNode>` 같은 형태로 한 군데 모은다. `switch` 문을 여러 곳에 흩지 않는다
- **설정 항목은 이번에 넣지 않는다.** 지금 앱에 전역 설정 화면이 없다(설정은 AI 패널 안에만 있다). 자리를 미리 만들어 두고 비워 두면 그게 미완성으로 보인다

### 1-C. 각 섹션의 내용

| 섹션 | 내용 |
|---|---|
| 전체 | 전체 프로젝트. 정렬 3종 + 검색 + 25개 페이지네이션 (기존 목록 그대로) |
| 최근 | 최근 수정 10개만. 정렬 컨트롤 없음 |
| 즐겨찾기 | 별표한 것만. 비어 있으면 "행 메뉴에서 별표를 눌러 추가하세요" 안내 |
| 휴지통 | 삭제한 프로젝트 + `복원` 버튼. 30일 후 자동 삭제라는 안내 |
| 예제 | 지금의 예제 3장. 카드 형태 유지 (여기서는 카드가 맞다) |

**즐겨찾기 데이터**: `ProjectSummary`([projectRepository.ts:19-30](../../../src/application/projectRepository.ts))에 `favorite` 필드가 없다.
→ **저장소를 건드리지 말고 `localStorage`에 프로젝트 id 배열로 저장한다.** 키: `gsw.dashboard.favorites`.
IndexedDB 스키마 변경은 마이그레이션이 필요해서 이번 범위 밖이다.

**휴지통 데이터**: 저장소 계층에는 이미 다 있다 —
`projectRepository.ts:63-65`의 `moveToTrash` / `listTrash` / `restoreFromTrash`, 구현은 `indexedDbProjectRepository.ts:135-158`.
빠진 것은 **스토어 액션뿐**이다(`workbenchStore.ts:782`가 `moveToTrash`만 호출한다).
→ `workbenchStore`에 `trashedProjects` 상태와 `loadTrash()` / `restoreProjectFromTrash(projectId)`를 추가한다.

### 1-D. 상호작용

1. **키보드 내비게이션** — 목록에서 ↑/↓ 행 이동, Enter로 열기, `/`로 검색 점프(이미 있음). 레일은 Tab으로 진입 후 ↑/↓
2. **`window.confirm` 제거** — 삭제 확인이 브라우저 기본 다이얼로그다([Dashboard.tsx](../../../src/presentation/components/Dashboard.tsx) `deleteProjectFromLibrary` 호출부). `ConfirmDeleteDialog`로 교체
3. **행 메뉴에 `즐겨찾기` 추가** — 기존 메뉴(열기/이름 변경/복제/백업 저장/복구 기록/휴지통) 맨 위에
4. **빈 상태** — 섹션마다 다르게. `전체`가 비면 실제 행동 버튼(새 프로젝트 / CSV로 시작)을 넣는다. 검색 결과 없음은 "'xxx'와 일치하는 프로젝트 없음 + 검색 지우기"로 분리

### 1-E. 반응형

| 폭 | 동작 |
|---|---|
| ≥ 1100px | 레일 200px 전체 표시 |
| 768–1100px | 레일 아이콘만 (56px). 라벨은 `title` |
| < 768px | 레일 숨김 + 상단 햄버거로 오버레이 |

우측 목록의 컬럼 축소 규칙은 이미 있다(`polish.css` 미디어쿼리에서 관계·행 컬럼 숨김). 그대로 쓴다.

### 1-F. 스타일 정리

- 대시보드 CSS를 `polish.css`에서 **`src/presentation/styles/segments/dashboard.css`로 분리**한다. 지금 `polish.css`가 잡동사니 통이다
- 분리 후 `polish.css`에 남은 대시보드 규칙이 없는지 확인
- 스타일 진입 파일에 새 세그먼트를 등록하는 것을 잊지 말 것 (`segments/`를 어떻게 묶는지 먼저 확인)

**완료 조건**
```bash
npm run typecheck && npm run lint && npm run test:run   # 전부 통과
```
- 프로젝트 **0개 / 3개 / 30개** 세 상태에서 각각 확인 (30개는 IndexedDB에 시드해서 만든다)
- 다섯 섹션이 모두 동작하고, 휴지통에서 **복원이 실제로 된다**
- `Dashboard.tsx` 3KB 이하 (래퍼만 남음)
- 콘솔 에러 0건

**커밋**: `feat: 대시보드를 사이드바 레일 앱 셸로 재구성`

---

## Phase 2 — 런타임 출력 · CSV 묶음 제거

### 2-A. `ExportDrawer.tsx` 재작성

현재 구조([ExportDrawer.tsx:10-125](../../../src/presentation/components/ExportDrawer.tsx)):
- `type ExportTab` (10행) — 삭제
- `const [tab, setTab] = useState<ExportTab>('excel')` (16행) — 삭제
- `<nav className="export-tabs">` (78-83행) — 삭제
- `{tab === 'csv' && ...}` (108-113행) — 삭제
- `{tab === 'runtime' && <RuntimeExportView />}` (114행) — 삭제
- `excel`과 `backup` 블록 — 조건을 벗겨 **항상 렌더되는 두 섹션**으로

정리할 import: `RuntimeExportView`, `csvFileName`/`serializeTableRowsToCsv`, lucide `Archive`.
`downloadCsvBundle` 함수(41-56행) 전체 삭제.
`status`/`message` 상태는 Excel이 계속 쓰므로 남긴다.

### 2-B. 파일 삭제

- `src/presentation/components/RuntimeExportView.tsx` — **삭제함**

**[실행 중 계획 변경]** `src/application/exportRuntime.ts`와 `exportRuntime.test.ts`는 **삭제하지 않았다.**
이유: `exportRuntimeView`는 UI 전용 함수가 아니라 컬럼 rename 후에도 ColumnId 기반 계보(lineage)가 정확히 유지되는지 검증하는 **도메인 회귀 테스트의 핵심 검증 수단**이다 — `audit-regression.test.ts`의 테스트 D(`exports runtime values from ColumnId lineage after RenameColumn`)와 `gameTableScenario.test.ts`가 이 함수로 그 정합성을 확인한다. 삭제하면 D2("ExportView 도메인 유지")를 스스로 어기고 UI와 무관한 정당한 회귀 커버리지를 잃는다. 따라서 **UI 컴포넌트만 제거하고 계산 로직·테스트는 유지**하는 것으로 판단을 바꿨다.

**삭제 전**: `grep -rn "exportRuntime\|RuntimeExportView" src/ e2e/` 로 남은 참조를 먼저 정리한다.

### 2-C. 스토어 액션 제거

`src/presentation/state/workbenchStore.ts`:
- 인터페이스 `createExportView(...)` 선언(213행 부근) 제거
- 구현 `createExportView: (input) => {...}`(1173-1204행 부근) 제거
- 미사용이 된 `CreateExportViewCommand` import(45행) 제거
  → **`src/domain/commands.ts`의 클래스 자체는 남긴다.** 역직렬화 switch(3010행)와 `aiProposalCommands.ts`가 쓴다 (D4)
- 951행 부근의 `exportViews.some(...)`는 **컬럼 삭제 영향도 계산**이다. 남긴다

### 2-D. 테스트 정리

- `src/presentation/state/workbenchStore.relationsAndExport.test.ts` (미커밋 파일):
  `describe('런타임 출력 뷰 생성', ...)` 블록(46-108행)만 삭제. **`describe('관계 삭제', ...)`는 유지.**
  블록이 하나만 남으므로 `workbenchStore.relations.test.ts`로 rename
- `e2e/app.spec.ts:366-375`: `'런타임 출력'` 탭 클릭 테스트 — 삭제하거나 통합 Excel 카드 확인으로 교체
- `audit-regression.test.ts`, `gameTableScenario.test.ts`가 `exportRuntime`을 import하면 해당 단언만 제거

### 2-E. `csvImportExport` 확인

```bash
grep -rn "serializeTableRowsToCsv\|csvFileName" src/ e2e/
```
- 다른 사용처가 있으면 `csvImportExport.ts`는 그대로 둔다
- **CSV 가져오기는 대시보드가 계속 쓴다. 절대 지우지 말 것**
- `fflate` 의존성이 이 파일에서만 쓰였다면 `package.json`에서 **지우지 말고** Phase 5 리포트에 "미사용 후보"로만 적는다

### 2-F. 문서

`docs/08-export-pipeline.md` — 런타임 출력 절 삭제 + "2026-07-22: 런타임 출력·CSV 묶음 UI 제거, 도메인 모델은 호환 목적으로 유지" 한 줄

**완료 조건**
```bash
npm run typecheck && npm run lint && npm run test:run
grep -rn "exportRuntime\|RuntimeExportView\|런타임 출력" src/ e2e/   # 결과 없음
```

**커밋**: `refactor: 런타임 출력·CSV 묶음 내보내기 UI 제거`

---

## Phase 3 — 내보내기 서랍 폴리싱

내보낼 게 둘뿐인데 서랍은 탭 4개 시절 크기 그대로다. 지금 **내용이 위 40%만 차고 아래가 텅 빈** 상태다.

### 진단

1. 폭 과다 — `shell.css:1060-1064` `width: min(920px, 78vw); min-width: 620px`
2. `.export-tabs` CSS(`polish.css:816-822`)가 죽는다
3. `.workbook-sheet-plan`의 제목 ↔ 설명이 좌우로 300px 넘게 벌어져 시선 이동이 크다
4. 검증 배너와 버튼 사이가 멀어 관계가 안 보인다

### 작업

- **폭**: `shell.css:1060-1064` → `width: min(560px, 92vw); min-width: 400px`. `polish.css:394-397` 미디어쿼리도 맞춘다
- **죽은 CSS 제거**: `polish.css`의 `.export-tabs` 규칙, `assistant-export.css`의 `.export-preview-layout`(402행 부근), `.lineage-panel`, `.lineage-row`, `.csv-preview`, `.export-view-builder`, `.export-builder-*`, `.export-control-bar`, `.export-file-field`, `.export-format-switch`, `.export-workspace`
  → 삭제 전 `grep -rn "클래스명" src/`로 확인. **`.export-validation`과 `.export-format-summary`는 남는 화면이 쓰므로 유지**
- **레이아웃**: 카드 2장 세로 스택. `통합 Excel`이 위(주), `프로젝트 백업`이 아래(보조)
- **시트 목록**: `.workbook-sheet-plan`을 좌우 벌림 대신 `제목 / 설명` 2줄 스택 또는 최대폭 제한
- **검증 배너**: 통합 Excel 카드 **안**, 버튼 바로 위로
- **버그 수정 (중요)**: [ExportDrawer.tsx:102](../../../src/presentation/components/ExportDrawer.tsx)의 Excel 버튼이 `disabled={status === 'working'}`만 본다. **`blockingIssues`를 안 본다.** 배너는 "오류 N개"라고 띄우면서 버튼은 눌린다. 삭제된 런타임 탭은 이걸 제대로 봤는데 Excel만 빠졌다. `disabled={status === 'working' || blockingIssues.length > 0}`로 고친다
- **키보드**: Esc로 서랍이 닫히는지 확인. 안 되면 추가

**완료 조건**
- `npm run typecheck && npm run lint && npm run test:run` 통과
- 1280×720에서 서랍의 세로 빈 여백이 화면 절반을 넘지 않는다
- 검증 오류가 있는 프로젝트에서 `통합 Excel 내보내기` 버튼이 비활성이다

**커밋**: `polish: 내보내기 서랍을 두 카드 단일 화면으로 재구성`

---

## Phase 4 — 죽은 코드 정리

Phase 1~3에서 생긴 잔해만 치운다. **새 리팩토링을 시작하지 않는다.**

1. 미사용 CSS — `assistant-export.css`와 `polish.css`를 훑고 각 클래스를 `grep -rn`으로 확인
2. 미사용 import / export — `npm run lint` 범위
3. `sampleProject.ts` / `gameCSampleProject.ts` / `gameDComplexProject.ts`의 `exportViews` 초기값 — **그대로 둔다** (D4). 판단은 리포트에만
4. `package.json` 미사용 의존성 — **제거하지 말고 목록만** 리포트에

**완료 조건**: `npm run typecheck && npm run lint && npm run test:run` 통과
**커밋**: `chore: 개편으로 남은 미사용 스타일·import 정리`

---

## Phase 5 — 자동 검증 리포트

```bash
npm run typecheck
npm run lint
npm run test:run
npm run e2e          # 실패해도 중단하지 말고 전체 결과 수집
```

e2e에 dev 서버가 필요하고 5173이 이미 점유돼 있으면 그 서버를 그대로 쓴다.

### 리포트: `docs/qa/2026-07-22-verification.md`

```markdown
# 검증 리포트 2026-07-22

## 요약
| 검사 | Phase 0 (before) | 최종 (after) |
|---|---|---|
| typecheck | | |
| lint | | |
| unit (vitest) | 통과 N / 전체 M | |
| e2e (playwright) | 미실행 | 통과 N / 전체 M |

## 이번 변경으로 의도적으로 수정한 테스트
- 파일:테스트명 — 왜 바뀌었는지

## 원래부터 실패 중이던 것 (이 작업과 무관)

## 발견했지만 고치지 않은 문제
| 위치 | 내용 | 심각도 | 왜 미뤘나 |
|---|---|---|---|

## 미사용 후보 (제거하지 않음)
- 의존성 / export 함수 / CSS 클래스

## 대형 파일 현황 (다음 작업 후보)
| 파일 | 크기 | 분할 제안 |
|---|---|---|
| src/domain/commands.ts | 116KB | |
| src/presentation/components/DataGridView.tsx | 109KB | |
| src/presentation/state/workbenchStore.ts | 63KB | |
```

### 수동 확인 시나리오 (브라우저에서 직접, 결과를 리포트에)

1. 새 프로젝트 생성 → 테이블 추가 → 행 입력 → 저장 → 대시보드 복귀 → 다시 열기. **데이터가 그대로인가**
2. `CSV·Excel로 시작`으로 CSV 가져오기. **Phase 2에서 가져오기를 안 건드렸는지 검증하는 항목**
3. 예제 3개(관중 시스템 / 게임 C / 게임 D) 각각 열기 → 전체 구조 렌더 → 콘솔 에러 0
4. 내보내기 → 통합 Excel 다운로드 → 파일이 열리고 시트가 다 있는가
5. 내보내기 → `.gsw` 백업 → 대시보드에서 그 파일 다시 열기. **왕복이 되는가 (D4 검증의 핵심)**
6. **`exportViews`에 항목이 든 기존 `.gsw`** 를 열기. 오류 없이 열리는가 — D4가 지켜졌는지 확인. 그런 파일이 없으면 만들어서 시험
7. 대시보드: 프로젝트 복제 → 이름 변경 → 즐겨찾기 → 휴지통 이동 → **휴지통에서 복원**
8. 대시보드: 레일 5개 섹션 전환, 1280 / 1000 / 700px 세 폭에서 확인
9. 실행 취소 / 다시 실행 / 변경 이력

**완료 조건**: 리포트가 존재하고 위 9개 시나리오 결과가 전부 채워져 있다.
**커밋**: `docs: 2026-07-22 검증 리포트`

---

## 요약

| Phase | 내용 | 위험도 |
|---|---|---|
| 0 | 기준선 측정 | 없음 |
| 1 | **대시보드 사이드바 레일 개편** | 높음 (분량이 크다. 소단계마다 그린 유지) |
| 2 | 런타임 출력·CSV 묶음 제거 | 중 (참조 누락 주의) |
| 3 | 내보내기 서랍 폴리싱 | 낮음 |
| 4 | 죽은 코드 정리 | 낮음 |
| 5 | 검증 리포트 | 없음 |
