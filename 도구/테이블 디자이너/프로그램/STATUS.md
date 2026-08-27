# Status

## Current Phase

Phase 13 is a historical prototype milestone, not product completion.

Foundation Repair Gates 0, 1, and 2 are complete. Row data is stored by immutable ColumnId inside a versioned WorkbenchDocument, and row edits now run as atomic document transactions with exact before/after Undo/Redo snapshots.

The approved UX redesign Gates 1 through 5, the Game Table Editing UX Usability Repair Gate, the Excel Cell Editing Recovery Gate, the Excel Coordinate Recovery / Game Table QA Gate, the Table Deletion / Excel Game Data Editing Gate, the Usability / Visibility Polishing Gate, and the Project Preservation / Dashboard / Integrated Excel Gate are implemented to their documented boundaries. Projects open into the full PK/FK structure map, table editing uses a virtual Excel-like workbook where A1 is the first column name and A2 is the first data value, table properties live in the dedicated Table Design view, the right side is AI-only, and verified revisions are saved through a repository with recovery checkpoints.

`PRODUCT_DIRECTION.md` now defines the permanent product direction: a professional game table workbench inspired by GraphLoop's visual graph workflow, with project-based entry, Excel-like CSV editing, high-performance large-data handling, schema diagrams, validator support, runtime exports, and AI proposals that pass through safe Command review.

## Completed

- Empty workspace audited.
- Vite React TypeScript project scaffolded.
- Tauri 2 project initialized under `src-tauri`.
- Recommended source boundaries created.
- Crowd-system sample schema added.
- Initial Command engine implemented for `RenameColumn`, `ChangeNullable`, and `AddColumn`.
- Validator implemented for missing keys, FK integrity, enum integrity, duplicate names, export collisions, repeated columns, and partial-key dependency warnings.
- Runtime export pipeline implemented with CSV formula-injection guard.
- Migration plan helper added for required-column additions.
- Mock AI provider contract added; no network AI calls are used.
- IDE-style UI shell implemented.
- Vitest and Playwright configuration added.
- Product docs, ADRs, schemas, design notes, and examples added.
- Figma MCP account check succeeded for Brian Cho.
- Figma design file created and populated with Phase 0 wireframes for Schema Workspace, Change Review, and Migration Wizard: https://www.figma.com/design/iE1m0ORKg58sddU7cWoY70
- Playwright screenshot captured at `design/screenshots/schema-workspace.png`.
- Schema Workspace visualization polished toward an Excel-style full structure map.
- Table nodes now show compact colored headers, alternating column rows, PK/FK/REF badges, column-level relation handles, colored FK arrows, and a reference legend.
- Phase 1 screenshot captured at `design/screenshots/schema-workspace-phase1.png`.
- Phase 2 Schema Core completed with schema factories, Zod project parsing, and stricter immutable-ID/constraint validation.
- Phase 3 Command Engine expanded with table, column, PK, FK, constraint, and functional-dependency commands.
- JSON project serialization/deserialization helper added with Zod validation.
- Phase 3 Command Engine completed for the master-list MVP commands, including split/merge, lookup extraction, junction tables, surrogate keys, backfill, and export view commands.
- Phase 4 Migration Engine completed with rollback-aware plans for required columns, type changes, table split/merge, and backfill.
- Phase 5 Validator completed with row-level required/type/rule checks, duplicate key checks, loaded FK orphan checks, FK cycle warnings, and FD conflict diagnostics.
- Phase 6 Import/Export completed with CSV import, table CSV export, runtime CSV/JSON output, FK-path flattening, and lineage.
- Phase 7 IDE UI completed with editable Data Grid cells, row creation, cell-level issue markers, Problems navigation, and project JSON download.
- Phase 8 Advanced UX completed with staged Change Review, impact/validation review, approval-aware apply, and a wizard-style Migration panel.
- Phase 9 Mock AI completed with local review output, structured proposal display, and Change Review staging for a safe export suggestion.
- Phase 10 OpenRouter development integration completed with session-only key entry, masked display, free-model catalog filtering, schema-only prompt construction, paid fallback blocking, and row-data blocking.
- Top menu labels are now actionable buttons for File, Edit, View, Schema, Data, Validate, AI, and Export.
- Phase 11 OpenRouter app integration completed with Tauri credential-store commands, frontend credential adapter, request cache, bounded retry, and manual cancellation.
- Phase 12 Model Evaluation completed with an 18-case local evaluation suite and report under `evals/reports`.
- Phase 13 Packaging Prep completed with local Tauri packaging scripts, user guide, release notes, known limitations, and security notes.
- Tauri release exe built at `src-tauri/target/release/game-schema-workbench.exe`.
- Release manifest added at `release/phase-13-release-manifest.md`.
- Final QA checklist added at `docs/final-qa-checklist.md`.
- Command, schema, persistence, migration, validator, import, export, document transaction, OpenRouter policy, AI draft compiler, UI, game-table scenarios, and performance coverage now includes 161 Vitest tests, 50 Playwright E2E/responsive tests, and 3 Rust storage tests.
- Main workbench UI, review panels, migration/AI surfaces, and validation problem messages localized to Korean.
- Historical UX Reset Alternative A was superseded by UX Gates 1–5. Its typed table layout and FK-handle work was retained; the active views are now `전체 구조 | 테이블 편집 | 테이블 설계`.
- `MoveTableLayoutCommand` added so ReactFlow table drag persists through the Command Engine and Undo/Redo without mutating schema objects in React components.
- The bottom action drawer now starts closed and contains only Problems and Change Review. Migration remains an internal safety engine and appears only as a contextual Data Conversion Plan for a pending schema change; command history moved beside Undo/Redo in the top toolbar.
- Performance Gate initial patch: Data Grid now renders only the visible row window, cell typing stays local until commit, sidebar table counts no longer run full validation on every render, and bottom-panel validation/migration/credential work is gated to the active panel.
- Data Grid row-add freeze fixed: the grid now uses a direct lightweight table renderer instead of rebuilding a TanStack row model for basic cell editing, and Playwright covers row addition plus keyboard input without console/page errors.
- Project Workspace Gate refactor: the root screen now always uses the Chrome-reference `내 프로젝트` hub layout, including the empty-project state, instead of switching to a separate marketing-style hero when local storage has no projects.
- UX Gate 1: workbench views are now `전체 구조 | 테이블 편집 | 테이블 설계`; runtime output moved to the export drawer; the searchable explorer can collapse and the always-visible AI panel remains resizable from 360–640px; the old Inspector was removed.
- UX Gate 2: React Flow uses asynchronous ELK layout, semantic zoom, exact column handles, pinned layout persistence through `MoveTableLayoutCommand`, relation focus/path tracing, minimap, search, and invalid-relation styling.
- UX Gate 3: table and column settings use typed Commands; CSV bundles and Excel multi-sheet workbooks run through a reviewed import preview with type/PK/FK candidates; FK candidates require explicit approval.
- UX Gate 4 / Foundation Gate 2: `DocumentTransaction`, `UpdateCellsCommand`, `InsertRowsCommand`, `DeleteRowsCommand`, and `ReplaceRowsCommand` provide atomic row edits and exact Undo/Redo. TanStack Virtual drives row/column virtualization and TanStack Table owns sorting/column state.
- UX Gate 5: the AI-only right panel supports local Mock review and manual OpenRouter requests, schema-linked findings, free-model-only policy enforcement, browser session-memory credentials, Tauri OS credential storage, and safe `create_table` / `add_export_column` draft compilation into typed Commands before approval.
- Export preview now shows output view, CSV/JSON format, file name, blocking validation, generated content, and per-column lineage before download.
- Responsive structure-map, workbook, and table-design screenshots and overlap assertions cover 1024×720, 1280×720, 1440×900, and 1920×1080.
- Game Table Editing UX Usability Repair Gate: the explorer uses fixed compact rows with table/column/row counts, technical relation/enum counters were removed, global and contextual tools were separated, and user-facing terminology now uses table/column-row equivalents as `테이블·열·행`.
- Table editing now exposes immediate sparse column creation, inline rename, drag/menu reordering, and impact-aware deletion. `ReorderColumnCommand` preserves ColumnId-based cells and relations, while deleted column cells are reconciled atomically inside `WorkbenchDocument` and exact snapshots restore them on Undo.
- Table Design is split into `기본 | 키와 관계`, replacing the dense three-card layout with a focused column list/detail workspace and a separate PK/FK workspace.
- Excel Cell Editing Recovery Gate: a selected cell accepts immediate replacement typing, including Korean composition events; F2/double-click preserve the current value; Enter/Tab commit and move; Escape cancels; and all commits continue through `UpdateCellsCommand` with exact document Undo/Redo.
- The table grid now uses A/B/C coordinates with a fixed schema row: A1 is the first column name with PK/FK badges and A2 is the first stored data value. Row 1 is never persisted as a `DataRow`; row/column/all selection operates on a `WorkbookCoordinate` that distinguishes schema and data cells. The redundant address/value bar was removed so editing happens directly in the selected grid cell.
- `ApplyWorkbookRangeCommand` atomically composes header renames, required row insertion, and cell updates. Invalid or over-wide blocks are rejected before mutation, risky header changes wait for Change Review, and one Undo restores the complete before snapshot.
- Table editing exposes exactly one primary `열 추가` command. The trailing grid command and empty spacing were removed; the top overflow menu was removed; `프로젝트 백업(.json)` now lives in the export drawer.
- Direct browser QA found and fixed two additional state defects: Undo after row insertion could leave a stale out-of-range A4 selection, and returning from `키와 관계 설정` could lose an off-screen selected column. Both now have regression coverage.
- The Item / ItemType / MonsterDrop / Shop integration scenario validates three PK/FK relationships, row data, runtime CSV output, and lineage without calling OpenRouter.
- Table Deletion / Excel Game Data Editing Gate: explorer rows and workbook sheet tabs now expose pointer and keyboard context menus. Every table deletion stages `DeleteTableCommand` in Change Review with affected table, column, row, relation, and export-view counts; cancel is non-mutating and exact Undo restores IDs, order, rows, relations, layout, and view state.
- Workbench document format version 2 persists `TableWorkbookViewState` by immutable table and column IDs. Widths, hidden/frozen columns, typed filters, and additive sort survive persistence but remain excluded from CSV, runtime output, and lineage.
- Excel-like operations now include typed column filters, multi-sort indicators, `Ctrl+F`/`Ctrl+H`, atomic replace, data-only cut/paste, bounded autofill, row and positioned-column insertion, hide/restore, left-column freeze, Boolean/Enum editors, FK candidates, and pre-commit value validation.
- Earlier Chrome direct-click QA verified sort, find/replace, reviewed table deletion and cancel with 0 console errors. A second direct-click pass verified the action-only bottom drawer, contextual data-conversion plan, cancel-to-close behavior, and toolbar history popover. Evidence is recorded in `docs/action-drawer-qa.md` and under `docs/qa/`; the current automated totals are listed below.
- Usability / Visibility Polishing Gate: compact workspaces now use 48px explorer and AI rails with one overlay at a time, standard and wide widths follow the 232/360 and 248/420 contracts, AI provider controls live inside settings, and schema metadata uses an 11px minimum. The monolithic CSS was split into token and feature segments, eleven historical responsive blocks were replaced by three final contracts, and the virtual viewport/IME capture and column menu were extracted from `DataGridView`.
- Polishing verification passes 130 Vitest and 35 Playwright tests across four desktop sizes. The user Chrome extension could list tabs but timed out while reclaiming the local tab during the Game C sample pass; in-app Chromium and Playwright verification succeeded, and the direct-Chrome retry remains a manual environment gap.
- Game C PK/FK visual sample: the project hub now opens a persistent six-table game-data example with five FK relations, two composite PK junction tables, valid sample rows, and a deliberate non-A1 composite PK case. Visual evidence and the remaining FK-editor usability gaps are recorded in `docs/game-c-pk-fk-visual-qa.md`.
- Structure Diagram / Excel Grid Cleanup Gate: the schema map now keeps only PK/FK semantics visible, lays out exact column ports through ELK, routes worker-batched smart step edges around cards, and derives bridge marks without persisting line geometry. The workbook fills its viewport with display-only grid lines while exactly one append row and one append column create typed, undoable document Commands. Verification is recorded in `docs/structure-grid-cleanup-qa.md` and ADR 0017.
- Auto-layout recovery: explicit automatic layout now repositions every table, including tables moved earlier in the session, as one typed `MoveTablesLayoutCommand`. Connected components use tighter spacing, all relations retain readable contrast, Fit View finishes before the command reports completion, and one Undo/Redo restores the complete layout before/after snapshot.
- Empty-workbook and relation-readability repair: a zero-table project now opens a dedicated table-editor start state instead of throwing from `requireTable`; the virtual grid separates authored column guides from display-only 120px columns; and relation-specific colors, endpoints, and parallel lanes keep multiple FKs to one target distinguishable. The redundant PK/FK `?` control was removed. Direct in-app-browser QA covered empty-project entry, first-table creation, the aligned grid, Game C automatic layout, and five visible relation routes.
- Relation/workbook input cleanup: near-aligned FK routes now place their small orthogonal height correction between cards only when that candidate avoids unrelated nodes, preserving a stable horizontal arrow lead. Full-height referenced-target stripes were removed so the relation-colored endpoint and arrow remain the only target indicator. The address/value bar and its separate edit-session branch were removed; A1 and data values continue to edit directly in the grid with the existing typed Commands and exact Undo/Redo.
- Exact target-column alignment: every single-column FK terminates at a stable target handle inside its referenced column row. Relations sharing one referenced key use relation-ID-ordered slots with an 8px preferred gap and an 18px maximum span, preventing merged arrowheads without entering adjacent rows. Game C and all 36 Game D routes compare SVG endpoints against their exact target handles.
- Complex auto-layout verification: the project hub now includes `게임 D (대규모 자동 배치 검증)`, a 25-table, 36-FK structure with seven composite-PK junction tables and deliberately tangled initial positions. Automatic layout uses a native ELK browser worker, an 8-second calculation limit, a 1.6-second Fit View limit with instant fallback, stale-run invalidation, and safe worker cleanup, so `배치 중` cannot remain indefinitely. React Flow nodes also publish their measured card dimensions to the smart-edge worker; the 1280x720 stress scenario finishes with zero card overlaps, zero unrelated-card route intersections, 36 worker routes, and no new console or page errors. Evidence is stored at `design/screenshots/game-d-auto-layout-1280x720.png`.
- FK-to-PK relation readability: arrows retain the reference direction from FK columns to referenced keys. Selecting a table keeps only its direct relations in stable relation colors while unrelated valid relations recede to neutral gray at 14%; hovering or pinning one relation emphasizes it at 3.2px, dims other valid paths to 10%, and highlights only the participating FK/PK rows. Hover, click, Enter, Escape, and canvas-dismiss interactions expose the complete relation path in a canvas-bound popover. Game C and all 36 Game D endpoints land on their relation-specific target handles. Evidence is stored at `design/screenshots/relation-readability-1440x900.png` and documented in `docs/relation-readability-qa.md`.
- Project preservation: browser projects now use transactional IndexedDB; Tauri projects use app-data `current.gsw`, checksum verification, bounded recovery points, and a 30-day trash. A 600ms worker-backed autosave queue follows Commands, document transactions, Undo, and Redo, while explicit save creates a checkpoint. The header reports verified `변경됨 | 저장 중 | 저장됨 | 저장 실패 | 복구됨` state instead of the fixed `로컬 보관` label.
- Native file safety: linked `.gsw` files use optimistic checksum conflict detection and keep the app library as a safety copy. Native storage keys reject path-like project IDs. Rust tests found and fixed two Windows-specific atomic-write handle issues that would otherwise have caused `Access denied` during rename or post-write sync.
- Project navigation no longer allows a late save from project A to replace the current ID or save state of project B. Dashboard return and trash removal are optimistic in the UI while repository work remains ordered and recoverable.
- Dashboard and terminology: user projects are a dense recent-work list with search and management commands, samples are separated, project rows report real location/recovery metadata, schema summaries show only tables and relations, and functional dependencies appear only as advanced `정규화 규칙` validation.
- Integrated Excel export is the default export surface. It generates a description/specification sheet, a deterministic ELK diagram image, then one typed/frozen sheet per table in a lazy worker. Table and column descriptions are edited through typed Commands.
- The integrated Excel documentation sheet now uses the fixed `1. 테이블 설명 및 규격` template. Its first section lists each table description once, and its second section exposes only `테이블명 | 칼럼명 | 자료형 | 설명`; PK/FK and validation details remain in the schema, diagram, and validators instead of being repeated in the document table. Fixed colors, typography, widths, row heights, grid visibility, print width, and footer settings are covered by workbook reopening tests and an Excel-rendered visual QA pass.
- Every integrated Excel table sheet now uses the deterministic contract `1행 칼럼명 | 2행 자료형 | 3행부터 데이터`. The first two rows stay frozen, every populated row uses a compact 15pt height with horizontal and vertical center alignment, the 자료형 row uses a neutral specification style, and AutoFilter is intentionally omitted so the metadata row cannot be sorted as user data. The documentation and diagram worksheet tabs use the shared navy/teal product palette.
- The current automated baseline is 44 Vitest files and 190 tests. TypeScript, lint, and the frontend production build pass; the existing large-chunk warnings remain.
- Final verification for this Gate passes 161 Vitest, 50 Playwright, 3 Rust tests, TypeScript, lint, frontend build, `cargo check`, and a Tauri debug package build. MSI and NSIS bundles were produced under `src-tauri/target/debug/bundle/`. Installed-process crash, disk-full, and permission-denial injection remain Packaging QA and are not claimed complete.

- Schema relation and workbook selection polish: `전체` 모드는 선택된 테이블과 무관하게 모든 유효 관계의 고유 색상을 유지하고 직접 관계만 더 굵게 표시합니다. `현재 테이블`과 `연결 경로` 모드는 관련 경로를 색상으로 강조하면서 나머지 관계를 회색 문맥으로 남깁니다. 자동 배치 경로는 대상 열에 수평으로 진입하며 화살촉은 11px로 축소했고, 전체 맞춤 여백은 16%로 늘렸습니다.
- Excel형 가상 격자 선택: 실제 데이터 다음의 빈 표시 행과 열도 클릭하거나 드래그해 직사각형 범위로 선택할 수 있습니다. 행 번호, 열 문자, 좌측 상단 모서리 선택을 지원하며, 선택만으로는 `DataRow`나 스키마 열을 생성하지 않습니다. 실제 입력 확정 시에만 기존 typed Command가 문서를 변경합니다.
- This Gate passes 44 Vitest files / 193 tests, 51 Playwright tests, TypeScript, lint, production build, and `cargo check`. Direct in-app browser QA verified all/current-table relation modes, stored ELK routes, 11px markers, empty-grid drag selection without document growth, and zero browser console errors. Evidence is recorded in `docs/qa/schema-relation-and-grid-selection-qa.md`.
- Shared-target relation polish: relation arrow markers use an 8px footprint. `MonsterDrop.ItemId` and `ShopItem.ItemId` terminate at stable `-4px/+4px` slots inside the same `Item.ItemId` row, while larger fan-ins remain bounded to an 18px row-internal span. Endpoint bridge marks keep 24px clear and two-point diagonal ELK routes are normalized to orthogonal bends. Verification passes 44 Vitest files / 196 tests, 52 Playwright tests, TypeScript, lint, production build, and `cargo check`; direct in-app Chromium QA reported zero console errors.
- Excel column-resize polish: live column sizing now invalidates TanStack Virtual's horizontal measurement cache, so column letters, schema row 1, data cells, append cells, and the empty-grid guides move as one aligned column. Dragging shows a full-height Excel-green guide, double-click fits up to 1,000 sampled values without opening A1 editing, and the grid uses Excel-style green active/range selection while preserving PK/FK badges and the non-`DataRow` schema-row contract. Verification passes 51 Vitest files / 282 tests, the focused Playwright resize regression, TypeScript, lint, and direct in-app geometry comparison.
- Excel keyboard compatibility: committed workbook changes now use `Ctrl+Z` for exact document Undo and `Ctrl+Y` / `Ctrl+Shift+Z` for Redo, while visible text inputs retain their native editing history. The workbook also supports Excel-style used-range navigation, page movement, row/column selection, `Ctrl+D` / `Ctrl+R` fill, and `Ctrl+PageUp` / `Ctrl+PageDown` sheet switching in addition to the existing save, find/replace, clipboard, edit, clear, and movement shortcuts. Pointer-down focus capture now makes a single click followed immediately by typing enter replacement mode without a focus race. The supported product-scope mapping is documented in `docs/excel-keyboard-shortcuts.md`.

## Foundation Repair

- Gate 0 complete: status correction, ADRs, foundation repair backlog, and audit regression tests were added. The initial audit baseline failed 5/5 tests before implementation.
- Gate 1 complete: versioned `WorkbenchDocument`, `DataRow.cells[ColumnId]`, CSV import/export, validator, runtime export, persistence roundtrip, and legacy migration safety are implemented and covered by tests.
- Gate 2 complete: atomic document transactions and exact document snapshot Undo/Redo cover cell, range, row insert/delete/duplicate, and bulk replacement operations.
- External audit source files under `docs/audit/` are absent from the working tree; the attached Foundation Repair prompt was used to reproduce the required audit failures.

## Blocked Or Requires User Approval

- Further Figma refinement of existing important files requires user approval. The current generated file is a new Phase 0 file.
- Installed Tauri failure-injection QA remains for abrupt process termination, disk-full, permission-denial, antivirus lock, external-file contention, and OS credential storage.
- Real OpenRouter requests were intentionally not executed. Provider behavior is covered with mocked fetch responses.
- Paid model fallback is prohibited unless the user explicitly approves it later.
- Public deployment and remote Git push require approval.

## Next Work

1. Packaging Failure-Injection Gate: exercise the built MSI/NSIS installation under abrupt termination, disk-full, denied permission, file contention, credential-store, and offline conditions.
2. Performance Hardening Gate: finish 100,000-row storage profiling, move remaining full validation/import work to incremental pipelines, and reduce startup bundle size.
3. AI Command Coverage Gate: expand the strict command-draft whitelist beyond table creation and export-column addition without accepting arbitrary serialized commands.
4. Packaging QA Gate: test OS credential storage, CSP, installer behavior, crash recovery, and offline operation in a packaged build.
5. Bundle Optimization Gate: lazy-load ELK, workbook parsing, AI settings, and export code; current main JavaScript and ELK worker chunks exceed the 500k warning threshold.

## Presentation Foldering - 2026-08-27

- Workbook-specific components now live under `src/presentation/components/workbook/`; table metadata and PK/FK editing live under `src/presentation/components/designer/`.
- The workbook coordinator now delegates cell editing, Paste Special, debouncing, and pure address/clipboard/view-model calculations to focused modules instead of defining them inside the 2,000-line interaction surface.
- Compatibility entry points preserve existing shell imports, so this refactor does not change `.gsw`, command, ID, Undo/Redo, persistence, or export contracts.
- TypeScript, oxlint, the hosted production build, and all 57 Vitest files / 327 tests pass after the move and first extraction pass.

## Portable Folder and Project Library - 2026-08-27

- The tool root now contains only `테이블 디자이너.exe`, `프로그램/`, and `프로젝트/`; source and generated development files no longer obscure authored data.
- Canonical `.gsw` files are grouped under the shared `프로젝트/` directory by game. Current portfolio data includes two Astrae Oratio CASE_001 documents and the Trickcal Fatima table project.
- Native open/save dialogs resolve the `프로젝트/` directory beside the portable executable first and fall back to the user's Documents folder only when that location is not writable.
- Verification passes TypeScript, oxlint, 57 Vitest files / 327 tests, 4 Rust tests, the standalone Tauri release build, the integrated Studio release build, and headless embedded-tool/workspace QA. The copied standalone executable was hash-verified before 4.6 GiB of regenerable Rust build output was reclaimed.

## Structure Diagram and Virtual Grid Contract - 2026-07-17

- The structure map permanently shows PK and FK only. Referenced-target state remains internal and appears only as a selected-relation highlight.
- Single-column FK lines start and end at exact column ports. Composite FKs remain one relation centered on their participating column groups.
- Relation paths are computed presentation state; only table positions are persisted through typed Commands.
- Each relation keeps a stable visual color and a relation-specific source/target handle. Shared worker routes are separated into parallel lanes before rendering.
- The workbook viewport is visually gridded beyond authored data without creating stored rows or schema columns.
- The immediate next row and column remain lazy append inputs. Visible farther virtual cells are also selectable; typing into one materializes only the required intervening rows or columns through typed Commands.
- Append row and append column operations are each removable by one exact Undo.
- Virtual cells never affect validation, CSV, runtime output, or lineage.

This contract is implemented and verified by `docs/structure-grid-cleanup-qa.md` and ADR 0017.

## Safety and Schema Integrity Hardening - 2026-07-28

- Future `WorkbenchDocument` formats are rejected instead of silently normalized.
- CSV intake strips UTF-8 BOMs, detects comma/tab/semicolon delimiters, and preserves unsafe-to-number `int64` values as strings.
- FK design starts with an explicit target-table and source-column mapping. The relation list shows `source.table.column -> target.table.column` and exposes a reviewed delete action.
- Focused persistence, command, relation-store, and CSV regression tests pass.

## Workbook Blank-Canvas Editing - 2026-07-28

- Row deletion, duplication, and explicit row-add controls are no longer part of the primary Excel-like editor surface; clipboard paste and direct blank-cell entry are the intended authoring path.
- Visible ghost rows now expose editable cell hit areas. Typing into a ghost row materializes rows through typed `AddRow` Commands, while entirely empty rows are ignored by row validation until a value is entered.
- The vertical scrollbar rail is visually hidden while wheel, trackpad, keyboard, and horizontal scrolling remain available.
- The blank canvas is virtualized to 100,000 editable data rows, so wheel/trackpad scrolling is no longer limited to the initially visible viewport. Only the rows near the viewport are mounted.
- Dragging the fill handle downward now shows an Excel-like destination outline and generated end-value label, auto-scrolls near the viewport edge, and materializes overflow rows in one undoable `ApplyWorkbookRangeCommand`.
- Wide-screen virtual columns use individual full-height guides, preventing the browser from dropping I-and-later grid lines when the 100,000-row canvas is rendered.
- The first blank schema cell (for example B1 in a one-column table) now has the same fill, border, letter tone, selection, and accessibility contract as every later blank column. Typing in any visible blank column creates only the columns needed to reach that cell and keeps the user in Table Edit; A1 and existing PK/FK metadata are unchanged.
- AutoFill now previews all four directions, scrolls at horizontal and vertical edges, and offers visible Series/Copy modes. Copy mode repeats the selected source pattern; Series mode projects numeric patterns.
- Enum, Boolean, and single-column FK editors provide editable suggestions. Invalid authored values are stored with validator warnings instead of blocking the designer, while schema operations remain guarded.
- Data-only Paste Special supports transpose and skip-blanks through `Ctrl+Alt+V` or the toolbar. `Ctrl+A` uses Excel's used-range/whole-sheet sequence, and `Ctrl+G` or the visible Go To action reaches addresses through `A100000`.
- Direct 1920x1080 browser QA verified continuous D-N guides, `A100000` navigation, both `Ctrl+A` stages, Paste Special controls, permissive numeric warnings, Copy-mode fill, exact Undo restoration, and zero console errors. Follow-up browser QA verified identical styling for the immediate and later blank headers plus direct F1 typing, commit, and restoration. Verification passes 52 Vitest files / 290 tests, TypeScript, lint, and the production build.
