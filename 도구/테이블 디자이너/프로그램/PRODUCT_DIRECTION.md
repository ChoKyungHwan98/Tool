# Game Schema Workbench Product Direction

이 문서는 Game Schema Workbench의 장기 방향을 고정하기 위한 제품 지침서다. 기능을 추가하거나 UI를 바꾸기 전에 이 문서를 읽고, 작업 후에도 결과가 이 방향에서 벗어나지 않았는지 확인한다.

## North Star

Game Schema Workbench는 게임 기획자가 테이블 데이터를 설계, 검토, 편집, 출력할 수 있는 프로급 데스크톱 워크벤치다.

목표는 단순 CSV 뷰어가 아니다. 기획자가 프로젝트를 열면 테이블 구조, PK/FK 관계, CSV 데이터, 런타임 출력, AI 검토를 한 흐름 안에서 다룰 수 있어야 한다.

## Product Standard

- 판매 가능한 수준의 안정성, 반응성, 가독성, 완성도를 기준으로 판단한다.
- UI는 개발자 데모가 아니라 실무 도구여야 한다.
- 새 기능보다 기본 워크플로우의 신뢰성이 우선이다.
- 느리거나 멈추는 경험은 제품 결함으로 본다.
- 사용자는 데이터베이스 전문가가 아니라 게임 시스템/콘텐츠 기획자라고 가정한다.

## Core Workflow

1. 앱을 실행한다.
2. 프로젝트 목록 또는 최근 프로젝트 화면을 본다.
3. 새 프로젝트를 만들거나 기존 프로젝트, CSV 묶음, Excel 워크북을 연다.
4. 프로젝트를 열면 전체 테이블 구조도가 먼저 보인다.
5. 구조도에서 테이블, 컬럼, PK, FK, 참조 관계를 한눈에 확인한다.
6. 필요한 테이블을 선택해 Excel과 유사한 방식으로 CSV 데이터를 편집한다.
7. 검증 패널에서 구조 문제, 타입 문제, FK 누락, 반복 컬럼, 런타임 출력 위험을 확인한다.
8. AI에게 스키마 검토나 구조 제안을 요청한다.
9. AI 제안은 바로 적용되지 않고 Command로 변환되어 검증, 영향 분석, 사용자 승인 후 적용된다.
10. 검증된 authoring schema에서 CSV/JSON 런타임 출력을 재생성한다.

## GraphLoop Inspiration

GraphLoop에서 가져올 핵심은 다음이다.

- 복잡한 데이터와 관계를 시각적으로 이해하게 만드는 그래프 중심 경험
- 캔버스에서 전체 구조를 빠르게 파악하는 감각
- 노드와 연결을 직접 조작하는 상호작용
- 프로젝트 단위의 작업 공간
- 빠른 반응성과 매끄러운 조작감

단, Game Schema Workbench는 GraphLoop의 복제가 아니다. 이 제품의 중심은 게임 테이블 설계, CSV 편집, PK/FK 관계, 검증, 런타임 출력이다.

## Excel-Like CSV Editing Standard

CSV 편집 경험은 Microsoft Excel에 가까워야 한다. 최소 기준은 다음이다.

- 열 문자 아래의 고정 스키마 1행과 데이터 행 번호
- `A1 = 첫 번째 열 이름`, `A2 = 첫 번째 데이터 값`인 Excel/CSV 좌표 계약
- 셀 선택, 방향키 이동, Enter/Tab 이동
- 복사, 붙여넣기, 다중 셀 붙여넣기. A1부터 붙이면 1행은 헤더로 해석한다.
- 행 추가, 삭제, 복제
- 정렬, 필터, 검색
- 컬럼 폭 조절과 타입 표시
- 변경된 셀/행 표시
- 셀 단위 검증 오류 표시
- Undo/Redo가 데이터 편집에도 적용
- 대용량 CSV에서도 스크롤과 입력이 끊기지 않는 가상화

Excel과 완전히 같은 수식 엔진을 목표로 하지 않는다. 수식 지원은 별도 제품 범위로 승인된 뒤 진행한다.

## Schema Diagram Standard

구조도는 전체를 한 번에 이해할 수 있어야 한다.

- 테이블 카드에는 이름, 태그, 컬럼, 타입, PK/FK/REF 상태가 명확히 보여야 한다.
- FK 선은 어떤 컬럼에서 어떤 컬럼으로 이어지는지 추적 가능해야 한다.
- 큰 프로젝트에서도 fit view, zoom, pan, search, minimap, relation focus가 필요하다.
- 관계선은 보기 좋아야 하지만 장식보다 판독성이 우선이다.
- 자동 레이아웃과 수동 레이아웃을 모두 지원해야 한다.
- 사용자 배치는 저장되고 재오픈 후 유지되어야 한다.

## AI Product Contract

AI는 조언자이며 프로젝트를 직접 변경하지 않는다.

- 기본 요청은 schema-only다.
- 행 데이터, 비공개 게임 데이터, 로컬 파일 내용은 명시 승인 없이 전송하지 않는다.
- 무료 모델만 사용한다. 유료 fallback은 명시 승인 없이는 금지한다.
- AI 출력은 구조화된 Proposal이어야 한다.
- Proposal은 Command로 변환되어야 한다.
- Command는 검증, 영향 분석, 사용자 승인을 거친 뒤 적용된다.
- 적용 전에는 항상 되돌릴 수 있어야 한다.

## Performance Contract

프로급 도구로 보기 위한 성능 기준은 다음이다.

- 입력 중 UI가 멈추면 안 된다.
- 대용량 CSV import/export, 검증, AI prompt 구성, 자동 레이아웃은 UI 스레드를 막지 않아야 한다.
- 큰 테이블 편집에는 가상 스크롤을 사용한다.
- 셀 입력마다 전체 문서를 비싼 방식으로 재계산하지 않는다.
- 검증은 debounce, incremental validation, worker 분리를 우선 검토한다.
- 캔버스는 큰 스키마에서도 pan/zoom이 부드러워야 한다.
- 성능 문제는 기능 미완성보다 낮은 우선순위가 아니다.

초기 목표 예산:

- 일반 편집 입력 응답: 100ms 이내 체감
- 스크롤/팬/줌: 눈에 띄는 끊김 없음
- 10k 행 단일 테이블: 기본 편집 가능
- 100k 행 이상: 전체 로딩보다 가상화, 지연 처리, 단계적 검증이 우선

## Architecture Guardrails

- persisted project unit은 `WorkbenchDocument`다.
- 행 데이터는 `ColumnId` 기준으로 저장한다.
- 테이블/컬럼 이름 변경은 ID를 바꾸면 안 된다.
- React 컴포넌트에서 schema 객체를 직접 수정하지 않는다.
- schema 변경은 typed Command를 통해 수행한다.
- 데이터 행 편집과 헤더·데이터 복합 붙여넣기는 document transaction 기반 Undo 모델을 사용한다.
- 런타임 출력은 normalized authoring schema에서 재현 가능해야 한다.

## Current Reality Check

Phase 13은 제품 완성이 아니다. 현재 상태는 프로토타입 기능 묶음과 일부 Foundation Repair가 완료된 상태다.

구현됨:

- 프로젝트 목록과 프로젝트 진입 후 전체 구조도 우선 흐름
- semantic zoom, 검색, 자동 배치, PK/FK/REF 컬럼 연결, 관계 추적, 배치 저장
- 별도 테이블 설계 화면과 typed Command 기반 schema 편집
- CSV 묶음과 Excel 다중 시트의 검토형 가져오기
- 가상화된 Excel형 CSV 편집, 범위 붙여넣기, 행 작업, 데이터 Undo/Redo
- validator, CSV/JSON runtime export, 검증 미리보기, 데이터 리니지
- 오른쪽 AI 대화, 스키마 ID 연결 결과, 제한된 typed Command 초안 변환
- 수동 OpenRouter schema-only 요청, 무료 모델 강제, 브라우저 세션/Tauri OS 자격 증명 저장

아직 제품 수준이 아님:

- 패키지 환경에서 강제 종료, 디스크 부족, 권한 거부, 외부 파일 충돌을 포함한 네이티브 저장 실기 QA
- 100k 행 전체 처리와 대형 스키마에서의 판매 제품 수준 성능 검증
- AI Proposal의 전체 Command 종류 변환; 현재는 테이블 생성과 출력 컬럼 추가만 허용
- 패키지 환경의 OS 자격 증명과 설치·복구 QA
- 메인 번들 및 ELK 워커 코드 분할

## Gate Direction

앞으로는 Phase 번호를 무작정 늘리지 않는다. 제품 목표에 맞춘 Gate로 진행한다.

1. 완료 - Product Contract / Project Workspace / Excel·CSV Intake / Schema Diagram / Excel-Like Data Grid의 현재 승인 범위.
2. 완료 - Foundation Gate 2 atomic document transaction과 exact Undo/Redo.
3. 부분 완료 - AI Command Proposal Gate. 두 종류의 안전한 초안만 변환하며 전체 Command 지원은 남아 있다.
4. 진행 예정 - Performance Hardening Gate. worker 분리와 실제 대형 프로젝트 프로파일링이 필요하다.
5. 부분 완료 - Native Project Files Gate. 앱 보관함, `.gsw`, 자동 저장, 복구본과 휴지통은 구현되었고 설치 패키지의 장애 주입 QA는 남아 있다.

## Workbook Editing Contract - 2026-07-16

The approved Excel-like editing scope is now explicit:

- Table deletion is available only from the explorer and sheet tabs. Every deletion, including an empty table, requires Change Review before apply.
- Workbook row 1 is the schema row. A1 is the first column name and stored records begin at A2.
- Column filters are type-aware and combine with AND. Sort supports an ordered multi-column list.
- Find and replace searches schema headers and data; risky header replacements pass through typed Command review.
- Cut/paste, AutoFill, and direct typing in visible blank cells may materialize the required rows or columns inside the finite 100,000-row virtual sheet through typed Commands or document transactions. Blank cells never enter the document until input begins or is committed, and existing column IDs remain stable.
- Column widths, hide/freeze state, filters, and sorting are persisted authoring view state keyed by immutable IDs and never enter runtime exports.
- Boolean, Enum, and single-column FK inputs use editable candidate lists. Invalid required, numeric, date, Enum, FK, or rule values are committed with validator warnings so drafting can continue; structural schema operations remain guarded.
- Formula evaluation, formatting, comments, charts, pivot tables, macros, and printing remain outside the approved scope.

This Gate is implemented and verified by `docs/excel-table-operations-qa.md` and ADR 0014. Packaged 100,000-row profiling and shared validation for every future bulk transform remain Performance Hardening work, not completed product claims.

## Action Drawer Contract - 2026-07-16

- The bottom drawer is an action surface, not permanent navigation. It contains only Problems and Change Review and is closed by default.
- Migration remains required application logic for risky schema changes, but it is not exposed as a standalone user mode.
- A migration plan is shown as `Data Conversion Plan` only when the pending change can affect existing rows, such as a type or required-value change.
- Command history is a compact toolbar popover beside Undo/Redo. Normal edits never open the bottom drawer just to show history.
- Canceling or applying a reviewed change closes the drawer. Validation problems and pending reviews may open it when user action is required.
- AI review remains in the dedicated right panel and does not add another bottom-drawer tab.

This contract is implemented and verified by `docs/action-drawer-qa.md` and ADR 0015.

## Usability Polishing Contract - 2026-07-16

- Wide, standard, and compact are the only responsive layout contracts.
- Compact keeps 48px explorer and AI rails; one overlay panel may be open at a time without shrinking the center.
- AI provider and model selection stay inside connection settings. The default surface is conversation and review actions.
- Metadata never renders below 11px before canvas zoom, and decorative dashboard gradients are not used.
- `전체 구조`, `테이블 편집`, and `테이블 설계` retain the same selected table across explorer rows, sheet tabs, and center views.
- Column menus are grouped by task. PK, FK mapping, current connections, and the active apply action remain reachable at 1024×720.
- Import and export overlays scroll only their body while headers and commit actions remain stable.

This contract is implemented and verified by `docs/usability-polishing-qa.md` and ADR 0016.

## Structure Diagram and Virtual Grid Contract - 2026-07-17

- The permanent diagram vocabulary is PK, FK, and relation direction. Referenced-target state is contextual rather than another permanent badge.
- Automatic layout and rendered routing use exact participating column ports and avoid table-card obstacles.
- Relation paths are derived UI state; only user table positions are persisted.
- Explicit automatic layout is a full reset of table positions, including manually moved tables. It is applied as one typed Command and one Undo restores the previous arrangement.
- Automatic layout does not hide unrelated lines in the `모든 관계` view and completes Fit View before reporting success.
- The workbook fills unused viewport space with a visual grid while preserving a finite normalized schema.
- Exactly one next row and one next column may create real document content. All farther cells are display-only.
- Display-only cells never enter row counts, validation, CSV, runtime export, or lineage.

This contract is implemented and verified by `docs/structure-grid-cleanup-qa.md` and ADR 0017.

## Project Preservation and Integrated Workbook Contract - 2026-07-17

- A project header reports only verified repository state; `로컬 보관` is not a substitute for persistence status.
- Browser development uses IndexedDB transactions. Tauri uses application-data `.gsw` files with checksum verification, recovery points, and a 30-day trash.
- Every typed Command, document transaction, Undo, and Redo enters the same dirty and sequential autosave pipeline.
- External `.gsw` files are linked by checksum and never overwritten after an unexpected external change.
- The user-facing schema summary is table and relation count. Functional dependencies remain an advanced validator concept named `정규화 규칙`.
- The default integrated Excel export contains descriptions and column specifications, a deterministic schema diagram, and one filtered/frozen data sheet per table.
- Project data and recovery points remain on the device. No cloud synchronization is implied.

This contract is implemented by ADR 0018 and verified to the documented boundary in `docs/qa/project-preservation-dashboard-excel.md`. Installed-package failure injection remains Packaging QA.

## Required Work Ritual

작업 전:

1. `STATUS.md`를 읽는다.
2. 이 `PRODUCT_DIRECTION.md`를 읽는다.
3. 관련 ADR을 확인한다.
4. 이번 작업이 어떤 Gate에 속하는지 밝힌다.
5. 구현 완료, 부분 구현, 문서만 존재를 섞어 말하지 않는다.

작업 후:

1. 타입체크, 린트, 테스트를 가능한 범위에서 실행한다.
2. 성능이나 UX 리스크가 생겼는지 확인한다.
3. 제품 방향과 어긋난 임시 UI가 생기지 않았는지 확인한다.
4. `STATUS.md`가 사실과 다르면 갱신한다.
