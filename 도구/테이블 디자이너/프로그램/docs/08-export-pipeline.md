# Export Pipeline

Runtime exports are generated from authoring schema and source rows.

## Requirements

- Export columns reference source table and column IDs.
- Runtime headers are output labels only.
- Export lineage maps every header back to its source.
- CSV formula injection is guarded by prefixing formula-like values.

## Phase 0

`exportRuntimeView` generates rows for the selected export view from sample data. Join, filter, sort, enum transform, and flattening rules are future work.

## Phase 6 Completion

- CSV parsing handles quoted cells, escaped quotes, and CRLF/LF rows.
- Table CSV import maps headers to schema columns, normalizes primitive values, and feeds imported rows through the deterministic row validator.
- Table CSV export writes schema-ordered columns and applies formula-injection guards.
- Runtime export can flatten columns from FK-reachable source tables.
- Runtime export exposes CSV and JSON text output.
- Runtime export lineage now records the source table, source column, and relation path for every exported header.

Deferred:

- Filter, sort, computed columns, and one-to-many multi-row export.
- Source file line-number mapping for CSV import diagnostics.

## 2026-07-22 — 런타임 출력 미리보기 UI 제거

`RuntimeExportView`(CSV/JSON 미리보기 화면)와 내보내기 서랍의 CSV 묶음·런타임 출력 탭을 제거했다. 사용자에게는 통합 Excel과 프로젝트 백업(.gsw) 두 가지만 노출한다.

`exportRuntimeView`/`toCsv`/`toJson`(`src/application/exportRuntime.ts`)은 삭제하지 않고 유지한다 — UI 전용 코드가 아니라 컬럼 rename 후에도 ColumnId 기반 계보(lineage)가 정확히 추적되는지 검증하는 도메인 회귀 테스트(`audit-regression.test.ts`, `gameTableScenario.test.ts`)의 핵심 검증 수단이기 때문이다. `ExportView` 스키마 타입과 `CreateExportViewCommand`/`ModifyExportViewCommand`도 `.gsw` 저장 포맷 호환을 위해 그대로 둔다. 사용자가 화면에서 새 출력 뷰를 만드는 경로(`createExportView` 스토어 액션)만 제거했다.
