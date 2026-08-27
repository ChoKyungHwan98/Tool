# 검증 리포트 2026-07-22

대상: `docs/superpowers/plans/2026-07-22-export-simplify-and-finish.md` Phase 0~5 실행 결과.
브랜치 `feature/grid-drag-extras`, 커밋 `26bbe23`(Phase 1) → `c8a7dbb`(Phase 2) → `d35f355`(Phase 3) → `4157a3c`(Phase 4).

## 요약

| 검사 | Phase 0 (before) | 최종 (after) |
|---|---|---|
| typecheck | 통과 | 통과 |
| lint (oxlint) | 통과, 경고 0 | 통과, 경고 0 |
| unit (vitest) | 51개 파일 · 286개 테스트 통과 | 51개 파일 · 282개 테스트 통과 |
| e2e (playwright) | 미실행 (계획대로 Phase 5로 유예) | 51 / 56 통과 |

unit 테스트가 286→282로 줄어든 것은 손실이 아니라 의도된 변경이다 — Phase 2에서 `createExportView` 스토어 액션을 제거하면서 그 액션만 테스트하던 4개 테스트(`런타임 출력 뷰 생성` describe 블록)를 함께 제거했다.

## 이번 변경으로 의도적으로 수정한 테스트

| 파일 | 내용 | 이유 |
|---|---|---|
| `src/presentation/components/Dashboard.test.tsx` | 샘플/게임 C/게임 D 클릭 앞에 `예제` 레일 클릭 추가 (3개 테스트) | Phase 1에서 예제 프로젝트가 별도 레일 섹션 뒤로 이동 |
| `src/presentation/components/PersistenceUx.audit.test.tsx` | `내 프로젝트`/`예제 프로젝트` 헤딩이 동시에 안 보이므로, `예제` 섹션으로 이동한 뒤 확인하도록 변경 | 동상 |
| `src/presentation/state/workbenchStore.relationsAndExport.test.ts` → `workbenchStore.relations.test.ts`로 rename | `런타임 출력 뷰 생성` describe 블록(4개 테스트) 삭제, `관계 삭제` 블록만 유지 | `createExportView` 액션이 Phase 2에서 제거됨 |
| `e2e/app.spec.ts` | 페이지 최상단 헤딩 검증을 `프로젝트`→`내 프로젝트`로 변경 | Phase 1에서 대시보드 상단 `<h1>프로젝트</h1>`가 사라지고 섹션 헤딩(`내 프로젝트` 등)이 h1으로 승격됨 — 실제 접근성 회귀를 이 과정에서 발견해 h2→h1 승격으로 고쳤다 |
| `e2e/app.spec.ts`의 `previews export format...` 테스트 | `런타임 출력` 탭 클릭 + CSV/JSON 미리보기 검증을 통합 Excel·프로젝트 백업 두 카드 검증으로 전면 재작성 | Phase 2에서 런타임 출력 탭 UI 제거 |
| `e2e/workbook-qa.spec.ts` | 내보내기 서랍에서 `프로젝트 백업` 탭 클릭 제거 | Phase 2에서 탭 네비게이션 제거 |
| e2e 13개 파일, 31곳 (`app.spec.ts`, `auto-layout-regression.spec.ts`, `complex-auto-layout.spec.ts`, `excel-core-audit.spec.ts`, `game-c-schema-example.spec.ts`, `grid-drag-selection.spec.ts`, `polish-audit.spec.ts`, `relation-readability.spec.ts`, `responsive.spec.ts`, `structure-grid-cleanup-audit.spec.ts`, `table-keyboard-editing.spec.ts`, `visual-usability-regression.spec.ts`, `workbook-qa.spec.ts`) | `샘플 열기`/`게임 C PK/FK 예제`/`게임 D 자동 배치 검증` 버튼 클릭 앞에 `예제` 레일 클릭 삽입 | Phase 1의 레일 개편 때문에 전부 깨질 상황이었음. Phase 5까지 미루지 않고 발견 즉시(Phase 2 도중) 수정하고 실행 확인함 |

## 계획 대비 실행 중 판단을 바꾼 지점

Phase 2 계획서는 `src/application/exportRuntime.ts`와 `exportRuntime.test.ts`를 삭제하라고 적었지만, 실제 실행 중 **삭제하지 않기로 판단을 바꿨다.** `exportRuntimeView` 함수는 UI 전용 코드가 아니라 컬럼 rename 후에도 ColumnId 기반 계보(lineage)가 정확히 유지되는지 검증하는 도메인 회귀 테스트(`audit-regression.test.ts`의 테스트 D, `gameTableScenario.test.ts`)의 핵심 검증 수단이었다. 삭제하면 계획 자신의 D2 가드레일("ExportView 도메인 유지")을 스스로 어기는 셈이라, UI 컴포넌트(`RuntimeExportView.tsx`)만 지우고 계산 로직·테스트는 그대로 뒀다. 상세 근거는 계획 문서의 Phase 2-B 절과 `docs/08-export-pipeline.md`에 기록했다.

## 원래부터 실패 중이던 것 (이 작업과 무관)

e2e 56개 중 5개가 실패하며, 전부 이번에 손대지 않은 파일(AI 어시스턴트 패널, 데이터 그리드, 구조도 캔버스 — 세션 시작 전부터 이미 수정 중이던 별도 작업)에서 비롯된다. 격리 실행으로 재현을 확인했다.

| 테스트 | 실패 원인 | 관련 파일 |
|---|---|---|
| `app.spec.ts` › `reviews the schema in the right AI panel...` | `Mock 제안:` 텍스트가 안 뜸 | `AiAssistantPanel.tsx`, `aiChat.ts`, `aiTools.ts` (미커밋 WIP) |
| `polish-audit.spec.ts` › `AI provider choice is available only inside connection settings` | `AI 실행 방식` 라벨을 못 찾음 | 동상 |
| `table-keyboard-editing.spec.ts` › `commits append row and append column edits...` | append-column 셀 클릭이 30초 타임아웃 | `DataGridView.tsx` (이번 세션에서 미수정) |
| `table-keyboard-editing.spec.ts` › `clears data cells with Delete or Backspace...` | 동상 | 동상 |
| `table-keyboard-editing.spec.ts` › `stages selected schema table deletion...` | `.schema-node` 필터가 2개 엘리먼트에 매치 (strict mode violation) | `SchemaCanvas.tsx` (미커밋 WIP) |

## 발견했지만 고치지 않은 문제

| 위치 | 내용 | 심각도 | 왜 미뤘나 |
|---|---|---|---|
| `table-keyboard-editing.spec.ts` 외 2곳 | 그리드 append-column 플로우가 실제로 동작하지 않을 가능성 (e2e가 일관되게 30초 타임아웃) | 중 — 실제 버그일 수 있음 | `DataGridView.tsx`는 이번 작업 범위(대시보드·내보내기) 밖이며 다른 세션이 이미 수정 중 |
| `SchemaCanvas.tsx` 관계 삭제 테스트 | `CrowdReactionRule` 필터가 `CrowdReactionRuleAction`까지 함께 매치 (locator 부정확일 수도, 실제 중복 렌더일 수도) | 낮음 — 테스트 locator 문제일 가능성이 더 높음 | 동상, 미커밋 WIP 파일 |

## 미사용 후보 (제거하지 않음)

- **의존성**: `package.json`의 `fflate` — Phase 2에서 제거한 CSV 묶음(zip) 내보내기에서만 쓰였고, 현재 `src/` 어디에서도 import되지 않는다.
- **export 함수**: `src/application/csvImportExport.ts`의 `csvFileName` — CSV 묶음 내보내기 제거 후 호출부가 없다. `serializeTableRowsToCsv`는 계속 쓰이므로 파일 자체는 유지.
- **CSS 클래스**: `.project-grid`, `.project-tile`, `.project-card` (`workbook-base.css`/`polish.css`) — 대시보드 JSX 어디에서도 안 쓰인다. 다만 이 세 클래스는 Phase 1~3이 원인이 아니라 그 이전부터 죽어 있던 코드로 보여, 계획의 "Phase 1~3에서 생긴 잔해만 정리" 범위 밖이라 손대지 않았다.

## 대형 파일 현황 (다음 작업 후보)

| 파일 | 크기 | 비고 |
|---|---|---|
| `src/domain/commands.ts` | 113KB | 이번 작업에서 미변경 |
| `src/presentation/components/DataGridView.tsx` | 106KB | 이번 작업에서 미변경. 위 e2e 실패 3건과 같은 파일 |
| `src/presentation/state/workbenchStore.ts` | 62KB | 이번 작업에서 `createExportView` 제거·휴지통 액션 2개 추가로 순감소 |

## 수동 확인 시나리오 (브라우저 실제 클릭·IndexedDB 검증)

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | 새 프로젝트 생성 → 테이블 추가 → 행 입력(`RowA`) → 저장 → 대시보드 복귀 → 다시 열기 | OK — 값이 그대로 유지됨 |
| 2 | `CSV·Excel로 시작`으로 CSV 가져오기 (ItemId/Name/Price 2행) | OK — Import Preview에서 헤더·타입 추론 정확, 적용 후 7번째 테이블로 정상 추가, 콘솔 에러 0 |
| 3 | 예제 3개(관중 시스템/게임 C/게임 D) 각각 열기 | OK — 11/6/25개 테이블 각각 정확히 렌더, 콘솔 에러 0 |
| 4 | 내보내기 → 통합 Excel 다운로드 | OK — "13개 시트 · revision 0" 완료 메시지, 콘솔 에러 0 |
| 5 | 내보내기 → `.gsw` 백업 다운로드 → Blob 내용 직접 파싱 | OK — schema(11테이블)·exportViews(1개)·rowsByTable(2개 테이블) 모두 포함 확인 |
| 6 | 위 `.gsw`(exportViews 포함)를 `프로젝트 열기`로 재업로드 | **OK — 콘솔 에러 없이 11테이블·8관계로 정상 로드. D2("ExportView 도메인 유지") 가드레일이 실제로 지켜지는지 확인하는 가장 중요한 시나리오였다** |
| 7 | 대시보드: 프로젝트 즐겨찾기 → 즐겨찾기 섹션 필터링 → 휴지통 이동 → 휴지통에서 확인 → 복원 | OK (Phase 1에서 검증) |
| 8 | 레일 반응형 1280 / 1000 / 700px | OK (Phase 1에서 검증) — 1280 전체 레일, 1000 아이콘만(56px, `title` 폴백으로 접근성 이름 유지 확인), 700 모바일 오버레이 |
| 9 | 실행 취소 / 다시 실행 / 변경 이력 | OK — 행 추가→실행취소(3행→2행)→다시실행(2행→3행)→변경 이력 패널에 "1개 행 추가" 정확히 기록 |

## 결론

계획한 5단계(대시보드 레일 개편 / 런타임 출력·CSV 묶음 제거 / 내보내기 서랍 폴리싱 / 죽은 코드 정리 / 검증)를 모두 마쳤다. typecheck·lint·unit 테스트는 전부 통과하고, e2e는 이 작업과 무관한 5건을 제외하고 전부 통과한다. 수동 시나리오 9개도 전부 통과했으며, 특히 ExportView 도메인 모델의 `.gsw` 저장 포맷 호환성(D2)을 실제 파일 왕복으로 확인했다.
