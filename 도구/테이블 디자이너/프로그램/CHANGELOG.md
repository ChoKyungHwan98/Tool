# Changelog

## Unreleased - Empty Editor and Relation Readability Repair

- Added a safe zero-table editor state with first-table creation and CSV/Excel import actions instead of requiring a selected table during render.
- Aligned authored-width columns, the single append column, and display-only workbook columns on one visual grid without creating stored rows or columns.
- Added stable per-relation colors, relation-specific endpoints, and parallel orthogonal lanes so multiple FKs targeting one key no longer paint over the same corridor.
- Removed the redundant PK/FK help button next to automatic layout and kept relation meaning visible in the FK row target labels and arrow direction.
- Added direct browser QA evidence and expanded verification to 136 Vitest tests and 42 Playwright scenarios.

## Unreleased - Excel Coordinate Recovery and Game Table QA

- Changed workbook coordinates so row 1 is the schema row (`A1 = first column name`) and stored data begins at row 2 without changing `DataRow.cells[ColumnId]`.
- Made schema cells editable through direct typing, F2, double-click, and the value bar, with shared name validation and impact-aware `RenameColumnCommand` review.
- Added serializable `ApplyWorkbookRangeCommand` for atomic header rename, row insertion, cell updates, and one-step Undo.
- Removed the duplicate trailing add-column command and the empty top overflow menu; moved project JSON backup into the export drawer.
- Added direct-click QA, an isolated no-console-error command/menu E2E, and the Item/ItemType/MonsterDrop/Shop integration scenario.
- Expanded verification to 109 Vitest tests and 17 Playwright E2E/responsive tests.

## Unreleased - Excel Cell Editing Recovery and QA

- Replaced double-click-only cell editing with Excel-style direct typing, F2/double-click preserve editing, Enter/Tab navigation, Escape cancellation, and Korean IME composition handling.
- Added A/B/C column coordinates, fixed row coordinates, row/column/all selection, and a shared cell address/value bar without adding a formula engine.
- Kept all committed values on the existing `UpdateCellsCommand` and atomic `WorkbenchDocument` Undo/Redo path.
- Fixed stale selections crashing zero-row sheet changes and kept newly renamed virtual columns visible after schema updates.
- Expanded verification to 102 Vitest tests and 13 Playwright E2E/responsive tests, with dedicated QA evidence in `docs/excel-cell-editing-qa.md`.

## Unreleased - Game Table Editing UX Usability Repair

- Renamed the primary data surface to `테이블 편집` and separated global project commands from contextual column/row commands.
- Rebuilt the table explorer as a fixed-height compact list and removed the unexplained relation/enum footer.
- Added immediate sparse column creation, inline rename, drag/menu reordering, impact-aware deletion, and exact document Undo restoration.
- Added serialized `ReorderColumnCommand` and document reconciliation for deleted ColumnId cells without rebuilding rows during column addition.
- Split Table Design into `기본` and `키와 관계` workspaces while keeping the AI panel always visible and resizable.
- Increased automated coverage to 94 Vitest tests and 11 Playwright E2E/responsive tests.

## Unreleased - UX Redesign Gates 1-5

- Rebuilt the workbench around `전체 구조`, `테이블 편집`, and `테이블 설계`, with a searchable explorer and resizable AI-only right panel.
- Added asynchronous ELK schema layout, semantic zoom, precise PK/FK handles, relation focus/path tracing, pinned layout persistence, and responsive diagram QA.
- Added reviewed CSV bundle and Excel multi-sheet import with PK/FK candidate approval.
- Added atomic document row Commands, exact Undo/Redo snapshots, and a TanStack-virtualized Excel-like workbook.
- Added schema-linked AI findings, whitelisted AI Command drafts, strict free-model policy, session/OS credential adapters, Tauri CSP, and manual-only OpenRouter requests.
- Added validated CSV/JSON export preview with file name, content, and data lineage.
- Increased automated coverage at that gate to 89 unit/performance tests and 10 Playwright E2E/responsive tests.

## 0.1.0 - Phase 0 Foundation

- Initialized Tauri 2 + React + TypeScript app.
- Added core schema model with immutable IDs.
- Added validator, impact analysis, command engine, migration helper, runtime export helper, and Mock AI provider.
- Added workbench UI for schema, data, runtime export, inspector, problems, migration, AI, and history.
- Added docs, ADRs, JSON schemas, examples, unit tests, and Playwright config.

## 0.1.0 - Phase 13 Master Pass

- Completed Schema Core, Command Engine, Migration Engine, Validator, Import/Export, IDE UI, Change Review, Mock AI, OpenRouter development integration, evaluation, and packaging prep.
- Added Excel-style full schema visualization with PK/FK/REF badges and column-level relation lines.
- Added editable data grid, CSV import/export, runtime CSV/JSON export, lineage, and row-level diagnostics.
- Added guarded OpenRouter free-model-only path with schema-only prompts, key masking, request cache, retry budget, cancellation, and Tauri credential-store commands.
- Added 18-case local model evaluation suite and packaging/user-guide docs.
