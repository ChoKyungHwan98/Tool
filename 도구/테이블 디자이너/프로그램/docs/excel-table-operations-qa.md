# Excel Table Operations QA

Date: 2026-07-16

## Scope

This QA covers reviewed table deletion, persisted workbook view state, typed column filters, additive multi-sort, find/replace, cut/paste, autofill, row and column insertion, column hide/freeze, typed cell editors, validation, Undo/Redo, performance, and responsive interaction. It does not cover formulas, cell formatting, comments, charts, pivot tables, macros, printing, or a real OpenRouter request.

## Gate Results

### Gate 0: Audit Baseline

The audit tests were added before implementation and failed for the expected missing behavior: no table context deletion, no connected delete workflow, no typed column filters or additive sort, and no find/replace or autofill controls. The final audit suite now passes without permissive `.first()` selectors.

### Gate 1: Reviewed Table Deletion

- Explorer rows and workbook sheet tabs open `TableContextMenu` on right-click, `Shift+F10`, and the keyboard context-menu key.
- `WorkbenchState.deleteTable(tableId)` always stages `DeleteTableCommand` in Change Review.
- The review lists affected table, column, row, relation, and export-view counts.
- Cancel leaves the document untouched. Apply and exact Undo/Redo preserve table order, IDs, rows, relations, layout, and workbook view state.
- Selection moves to the next table, then the previous table. Deleting the final table returns to the empty structure view.

### Gate 2: Workbook View State

- Document format version 2 persists widths, hidden columns, frozen columns, multi-sort, and typed filters by `TableId` and `ColumnId`.
- Version-1 documents migrate with empty view state.
- View state is excluded from CSV, runtime JSON/CSV, and lineage.
- Grid toolbar, sheet tabs, find bar, filter popover, hidden-column manager, and context menus are separated presentation components while virtual rows remain controlled by the grid.

### Gate 3: Excel-Like Operations

- Column menus provide typed filters, additive ascending/descending sort, left/right insertion, hide, freeze-through-column, reorder, and reviewed deletion.
- Row-number menus provide insertion above/below, duplicate, and delete.
- `Ctrl+F` and `Ctrl+H` search both the fixed schema row and stored data cells.
- `ReplaceWorkbookMatchesCommand` applies data replacements atomically and sends risky header replacements to Change Review.
- Data-cell cut/paste clears the source and writes the target in one command. Autofill copies one value, extends numeric and ISO-date series, or repeats text patterns without creating rows.

### Gate 4: Validation and Usability

- Boolean and Enum columns use selection editors.
- Single-column hard FK cells expose referenced key candidates; composite FK behavior remains validation-based.
- Required, integer, float, Boolean, date, Enum, FK, and existing rule violations are rejected before document mutation.
- The schema row remains fixed. The last visible column cannot be hidden, hidden columns can be restored, and a contiguous left column group can be frozen or cleared.
- Menus close on outside click, Escape, view changes, and when their virtualized target leaves the rendered grid.

## Automated Results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run test:run` | Pass: 28 files, 124 tests |
| `npm run e2e` | Pass: 27 Chromium tests |
| `npm run build` | Pass with known chunk-size warnings |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Pass |
| `npm audit --omit=dev --audit-level=high` | Pass: 0 vulnerabilities |

The pure 10,000-row filter, find, and autofill regression tests remain within the 100ms automated budget. Existing sparse 10,000-row and 100,000-row document-command performance tests also pass.

## Direct Chrome QA

The running app at `http://127.0.0.1:5173/` was opened in a fresh Chrome tab and the sample project was operated directly.

- The table editor opened with `A1` as the PK column name and stored data beginning at row 2.
- The RuleId column menu opened, ascending sort applied, and the toolbar reported `1개 정렬 적용` without a freeze.
- `Ctrl+H` opened the find/replace panel with A1 selected.
- Explorer right-click exposed `테이블 삭제`.
- Delete review reported 1 table, 7 columns, 2 rows, 1 relation, and 0 export views for CrowdZone.
- Cancel preserved CrowdZone and all 11 sample tables.
- Chrome console errors after the scenario: 0.

Screenshots:

- `docs/qa/table-editor-chrome-qa.png`
- `docs/qa/table-delete-review-chrome-qa.png`

## Playwright Scenarios

`e2e/excel-core-audit.spec.ts` verifies explorer and sheet-tab deletion, review/apply/Undo, filter and additive sort menus, find/replace, row and column insertion, hide/restore/freeze, invalid numeric rejection, cut/paste with Undo, and numeric autofill. The full E2E suite also covers workbook coordinates, responsive layouts, import preview, schema diagrams, AI mock review, and console/page-error collection.

## Remaining Risk

- The production build still warns about the approximately 1.59 MB ELK worker and 1.82 MB main JavaScript chunk before gzip.
- Browser and command-level performance tests pass, but packaged Windows profiling with a real 100,000-row game project remains a separate Performance Hardening Gate.
- Native IME candidate-window behavior, OS credential storage, installer recovery, and offline packaged operation still require physical packaged-app QA.
- Replace-all validates schema-name impact and all direct cell entry paths validate data types. A future hardening pass should add a single application-layer validator shared by every bulk data transformation.
- No OpenRouter request, paid model call, or external data transmission was performed.
