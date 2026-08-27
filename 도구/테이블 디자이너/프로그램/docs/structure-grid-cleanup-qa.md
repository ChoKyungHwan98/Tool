# Structure Diagram and Excel Grid QA

- Date: 2026-07-17
- Scope: schema-map information density, exact relation routing, virtual workbook canvas, append row/column transactions
- Real OpenRouter requests: not executed

## Gate 0 Audit

Audit coverage was added before implementation for the three visible defects: persistent `REF`/`TABLE`/legend clutter, table-level relation routing, and the blank workbook canvas. The new tests failed for the expected missing behavior before implementation. The previous 130 Vitest and 35 Playwright checks remained the regression baseline.

## Gate 1: Interface Cleanup

- Removed persistent `REF` badges, `TABLE` tags, the permanent legend, zoom-status copy, and zero-value workbook prompts.
- Kept PK/FK badges and target labels in the table rows. The redundant standalone PK/FK help button was removed after direct usability review.
- Renamed relation scope to `전체 | 현재 테이블 | 연결 경로` and moved the longer explanations into button tooltips.
- Limited the minimap to schemas with at least ten tables.
- Kept only `열 추가 | 행 추가` permanently visible. Row duplicate/delete appear only for selected stored rows.

## Gate 2: Exact Relation Routing

- Added actual east/west ELK ports at participating column Y positions with fixed-side and model-order constraints.
- Added worker-batched `SmartStepEdge` routing around current node rectangles.
- Added lightweight drag previews, post-drop recomputation, and bridge marks for remaining line crossings.
- Kept composite FKs as one relation while highlighting the full source/target column mapping on selection.
- No line path is persisted; individual and full table positions are stored only through typed layout Commands.
- Automatic layout now clears the temporary drag-pinning behavior and recomputes every table position.
- The full result is applied by one typed `MoveTablesLayoutCommand`, so one Undo/Redo restores the complete previous/next arrangement.
- Connected-component and node spacing were tightened. A selected table's direct relations remain fully opaque while unrelated valid relations use neutral gray at 14%; hovering or pinning one relation lowers the other valid relations to 10%. Fit View completes before the button reports `배치 완료`.
- Each relation now has a stable tracing color and its own endpoint handle. When the worker returns a shared vertical corridor, later relations receive an orthogonal parallel-lane offset instead of being painted on top of the first route.
- A follow-up cleanup moves shallow vertical corrections to the center of the inter-card gap when the candidate remains obstacle-free. The target arrow retains a horizontal lead, and the old full-height referenced-target stripe no longer appears beside it.
- Target handles no longer fan out vertically when several FKs reference the same key. All arrows now finish at the referenced row center; route separation remains outside the table card. This prevents dense Item references from visually landing on `ItemTypeId`, `RarityId`, or neighboring rows instead of `ItemId`.
- The layout lifecycle now uses a native browser worker, an 8-second ELK timeout, stale-run invalidation, guarded worker termination, and a 1.6-second animated Fit View timeout with an instant fallback. These bounds prevent the toolbar from remaining in `배치 중` when a worker or fit animation does not settle.
- React Flow nodes now expose their rendered dimensions as measured dimensions to the smart-edge worker. Before this repair, the worker treated large table cards as near-point obstacles and six Game D routes crossed unrelated cards; the corrected obstacle map removes all six intersections.

Game C direct QA at 1280x720 confirmed six nodes, five worker routes, zero persistent REF badges, zero TABLE tags, no minimap below ten tables, and no route intersection with an unrelated card after automatic layout. The 11-table crowd sample was also rearranged inside the canvas with all eight relations visible; evidence is stored at `design/screenshots/auto-layout-crowd-1280x720.png`.

Game D expands the stress case to 25 tables and 36 FK relations, including seven composite-PK junction tables and multiple Item, Currency, Region, Quest, and NPC hubs. Its saved initial positions intentionally overlap. The final automatic layout contains all 25 cards inside the canvas with zero card overlaps, 36 worker-routed paths, zero unrelated-card path intersections, and a toolbar state that returns from `배치 중` within the 12-second E2E limit. Evidence is stored at `design/screenshots/game-d-auto-layout-1280x720.png`.

The target-column regression first reproduced a 2.44px Game C target offset and a 5.56px maximum Game D target offset at the fitted viewport scale. After removing the accumulated per-relation target displacement, both the target handles and actual SVG path endpoints align with their referenced row centers within 1px. Evidence is stored at `design/screenshots/game-c-target-column-alignment-1280x720.png`.

## Gate 3: Excel-Like Virtual Canvas

- Added viewport metrics and display row/column contracts driven by `ResizeObserver`.
- Filled the unused editor surface with light row, column, and cell grid lines.
- Kept one editable append row and one editable append column; farther cells are display-only.
- Append-row input runs one `InsertRowsCommand` with initial cells.
- Append-column naming runs one nullable-string `AddColumnCommand`.
- Virtual cells remain absent from stored row counts, schema counts, validation, CSV, runtime output, and lineage.

Direct QA confirmed A1 schema headers, A2 stored data, the next row/column append targets, and a bounded DOM while the remainder of the 1280x720 surface stayed visually gridded.

The separate address/value bar was removed after usability review. Direct typing, F2, double-click, IME, Enter/Tab movement, paste, and Undo/Redo remain grid-native; the recovered 36px is now part of the workbook viewport.

A zero-table project now enters a dedicated editor start state without calling `requireTable`. The grid background was split into row guides, authored-width column guides, and 120px display-only columns so mixed authored widths no longer produce false vertical lines.

## Automated Results

- TypeScript: pass
- Lint: pass
- Vitest: 148 passed across 35 files
- Playwright Chromium: 50/50 scenarios pass in the final full-suite run.
- Frontend build: pass, with the existing chunks-over-500k warning
- Rust `cargo check`: pass
- `npm audit --audit-level=high`: 0 vulnerabilities
- `npm audit --omit=dev`: 0 vulnerabilities
- `cargo audit`: unavailable because `cargo-audit` is not installed

Responsive Playwright coverage remains active at 1024x720, 1280x720, 1440x900, and 1920x1080. Existing pure performance tests cover sparse column creation, one-cell editing, range paste, filtering, finding, and autofill on 10,000 rows.

## Direct Browser QA

The in-app Chromium session directly created a zero-table project, entered table editing, created its first table, inspected the aligned virtual grid, opened Game C, ran automatic layout, and inspected all five route paths. The two Item-targeting FK routes use separate x corridors after layout. The final Game C pass measured six nodes, five relation paths, zero referenced-target stripes, and zero value bars. The near-aligned ItemType route moved its shallow correction to the center of the inter-card gap and retained about 47.5px of horizontal lead at both ends.

The final workbook pass opened `Item.ItemTypeId` through direct double-click editing, preserved the existing header value, cancelled without mutation, and confirmed that the removed value bar did not return. F2, keyboard movement, paste, IME, and Undo/Redo remain covered by the passing Playwright suite. No new runtime error was produced during this pass; the retained browser log entries were older Vite hot-reload messages from the file-removal edit itself.

The in-app browser also opened Game D and ran automatic layout directly. It reported 25 visible nodes, 36 worker routes, zero node overlaps, and zero nodes outside the canvas. The browser log count and latest timestamp were unchanged across this run, while the isolated Playwright scenario independently captured no console errors or page errors and performed the stricter path-versus-card intersection check.

Evidence: `design/screenshots/empty-project-table-editor-1280x720.png`, `design/screenshots/empty-workbook-aligned-grid-1280x720.png`, and `design/screenshots/game-c-auto-layout-readable-1280x720.png`.

The Chrome extension listed the local `127.0.0.1:5173` tab but timed out twice while claiming it. This remains a transparent environment-level direct-Chrome gap; it is not counted as a Chrome manual pass.

## Remaining Risk

- The dedicated visual stress sample currently covers 25 tables and 36 relations. A 50-table production hardware profile remains Performance Hardening work.
- The 10,000-row regression tests cover computation and bounded rendering contracts; 100,000-row progressive workbook rendering remains Performance Hardening work.
- ELK and the smart-edge worker contribute to the existing bundle-size warning and should be lazy-loaded in the Bundle Optimization Gate.
