# Excel Cell Editing Recovery QA

Date: 2026-07-16

## Scope

This QA covers the Excel-style table grid, workbook coordinates, PK/FK header editing, keyboard and Korean IME entry, the address/value bar, row/column selection, atomic range paste, sheet changes, virtualization, document Undo/Redo, responsive layout, and build safety. It does not perform a real OpenRouter request.

## Baseline Failure

Gate 0 added three independent audit tests before UI changes. All three failed against the previous implementation:

- A1 contained the first data value `goal_home_high` instead of the PK name `RuleId`.
- The table editor exposed two exact `열 추가` buttons.
- Typing into A1 changed row data instead of the PK column name.

## Automated Results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run test:run` | Pass: 28 files, 124 tests |
| `npm run e2e` | Pass: 27 Chromium tests |
| `npm run build` | Pass |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Pass |
| `npm audit --omit=dev --audit-level=high` | Pass: 0 vulnerabilities |

The 10,000-row command tests keep single-cell updates, workbook-cell paste, and sparse column creation under the 100ms automated budget. The 100,000-row replacement transaction remains under its 1,500ms budget.

## Interaction Coverage

- A1 contains the first column name and PK/FK badge; A2 contains the first stored data value.
- Single click selects; direct Latin, numeric, Unicode, and Korean composition input replaces the selected schema or data value.
- F2 and double-click open preserve editing; Escape cancels without a document command.
- Enter, Shift+Enter, Tab, and Shift+Tab commit and move within bounds.
- The value bar reads and edits the same draft as the active schema or data cell.
- A/B/C headers, row numbers, and the corner select columns, rows, and all cells. Schema row 1 never enables duplicate or delete-row commands.
- A1 range paste treats its first row as headers. Header renames, appended rows, and cell updates are one reviewed and undoable transaction.
- Empty, duplicate, and unsupported header names are rejected. FK/export-sensitive renames remain unchanged until Change Review approval.
- A wider-than-table block is rejected instead of creating hidden columns.
- Empty tables retain schema headers and accept a newly inserted row.
- Changing to a zero-row sheet clears the stale active cell without a render error.
- Renaming a newly added virtualized column keeps it in view, including after returning from `키와 관계 설정`.
- The table editor exposes exactly one primary `열 추가` command and no top overflow menu.
- The export drawer contains `프로젝트 백업(.json)` alongside runtime export preview and lineage.

## Direct Click QA

The running app at `http://127.0.0.1:5173/` was inspected and operated directly. The QA verified A1/A2 contents, one add-column button, A1 F2/Cancel, row-1 delete/duplicate blocking, row insertion at row 4, Undo cleanup, new-column immediate naming, export drawer navigation, and the absence of the old overflow menu. The subsequent table-operations Gate is documented in `docs/excel-table-operations-qa.md`.

Direct QA found two state defects that were fixed during this Gate:

- Undo after inserting the last row removed the row but left the address bar at an invalid A4 selection.
- Returning from column relation settings did not restore an off-screen selected column.

`e2e/workbook-qa.spec.ts` repeats the command/menu path in an isolated browser context and asserts no console errors or `pageerror` events.

## Game Table Scenario

`src/application/gameTableScenario.test.ts` builds Item, ItemType, MonsterDrop, and Shop tables with three hard FK relations. It enters representative game data, runs row/schema validation, exports Item runtime CSV, verifies related-table lineage, and checks that workbook paste preserves immutable column IDs.

## Responsive Evidence

Playwright checks and captures the table editor with the AI panel open at 1280x720, 1440x900, and 1920x1080. It asserts no body overflow, no main/assistant overlap, a fixed 58px two-tier header, a visible value bar, and rows positioned below the header.

Screenshots are stored as `design/screenshots/workbench-data-<width>x<height>.png`. The isolated menu/export QA capture is `design/screenshots/workbook-interaction-qa-1440x900.png`.

## Remaining Risk

- The production build succeeds but still reports the known chunks over 500kB: the ELK worker is about 1.59MB and the main chunk is about 1.82MB before gzip.
- Korean composition lifecycle is covered by Chromium events, but the packaged Windows application's native IME candidate-window behavior still requires physical keyboard QA.
- Packaged credential-store and installer QA remain separate Gates. No OpenRouter network request or paid model call was made.
