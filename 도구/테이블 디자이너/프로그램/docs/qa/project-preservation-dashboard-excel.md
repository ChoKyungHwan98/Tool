# Project Preservation, Dashboard, and Excel QA

Date: 2026-07-17

## Scope

This QA pass covers the project repository contract, autosave state, recovery/trash behavior, the recent-project dashboard, responsive workbench headers, and the integrated Excel export. It does not perform an OpenRouter request and does not send private row data anywhere.

## Automated Scenarios

- IndexedDB save, verified reload, checksum mismatch recovery, 30-point retention, 30-day retention, trash, and restore.
- Legacy `localStorage` migration without deleting the source before successful validation.
- Typed Command, document transaction, Undo, Redo, reviewed destructive apply, and import changes entering dirty/autosave flow.
- 600ms debounce, ordered save queue, explicit checkpoint, retry after failure, and recovered state.
- Table and column description Commands preserving IDs and relations.
- Integrated workbook reopening with `1. 테이블 설명 및 규격`, `2. 테이블 구조도`, stable table-sheet order, worksheet tab colors, PK/FK data-sheet header colors, two frozen metadata rows, row values, primitive types, and valid 31-character sheet names.
- Deterministic schema input producing the same ELK layout and workbook manifest on repeated export.

## Direct Browser QA

- The dashboard was inspected at 1024x720 and 1440x900. Recent projects and examples are separate; create, open, and CSV/Excel start commands remain visible; no decorative hero or nested card layout is used.
- The workbench was inspected at 1024x720, 1280x720, and 1920x1080. Compact mode keeps project name and verified save state in a two-row header while the explorer and AI panel collapse to rails.
- The integrated Excel action completed in the export drawer and reported its sheet/revision manifest without a console error.
- Browser console warnings and errors collected during the dashboard/workbench/export pass: 0.

## Storage Interpretation

- `브라우저 앱 보관함 (IndexedDB)` means the project is stored in this browser profile on this device.
- A Tauri project location is the application data directory or a user-linked `.gsw` file. The application library remains a recovery copy.
- `저장됨` means the repository completed a write and checksum re-read. It does not mean cloud synchronization; no cloud repository is implemented.

## Remaining Native QA

- Kill an installed Tauri process during temporary-file write and confirm the previous `current.gsw` opens.
- Exercise disk-full, denied-permission, antivirus-lock, and removable-drive disconnect cases on packaged Windows builds.
- Confirm external-file conflict choices with two independent processes.
- Confirm recovery and trash pruning against the actual application-data directory over time.

These items are packaging QA, not claims of completed runtime verification.

## Verification Results

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test:run`: 39 files, 161 tests passed.
- `npm run e2e`: 50 Chromium tests passed.
- `npm run build`: passed. The existing large-chunk warnings remain for the main bundle, workbook worker, and ELK worker.
- `cargo test`: 3 storage tests passed, including Windows atomic replacement and recovery retention.
- `cargo check`: passed.
- `npm run tauri:build -- --debug`: passed and produced both MSI and NSIS bundles.
- `npm audit --omit=dev --audit-level=high`: no high-severity failure; two moderate `uuid` advisories arrive through ExcelJS. The offered force fix is a breaking ExcelJS downgrade and was not applied.

The native storage test initially reproduced `Access denied` on Windows. The writer now closes the temporary file before rename and reopens the replaced file with write access for the final `sync_all`. This regression is fixed and covered.

## Documentation Template Follow-up — 2026-07-20

- The first worksheet is a fixed documentation template rather than a repeated eight-column technical table.
- `테이블 설명` contains one row per table with `테이블명 | 설명`.
- `테이블 규격` contains `테이블명 | 칼럼명 | 자료형 | 설명`, grouped visually by table.
- Key, reference target, required state, and default-value columns were removed from the documentation surface only. The underlying schema, relation diagram, validation, and typed data sheets retain those contracts.
- The template fixes the title and section hierarchy, Malgun Gothic typography, restrained navy/teal palette, column widths, wrapped row heights, hidden gridlines, landscape print width, margins, and footer.
- The application exported the Game C workbook successfully. Excel reopened it and exported the documentation sheet to a two-page PDF without clipped labels, broken merges, or horizontal overflow.
- Table data sheets use row 1 for 칼럼명, row 2 for 자료형, and row 3 onward for stored records. Populated rows use a compact 15pt height and center alignment on both axes. AutoFilter is omitted because Excel would otherwise treat the 자료형 metadata row as sortable data.
- The documentation tab uses the title navy and the diagram tab uses the product teal, preserving the workbook hierarchy without adding decorative colors to data sheets.
- A fresh Game C export was downloaded from the running application and reopened. `ItemType` preserved `ItemTypeId | Name`, `string | string`, then `weapon | 무기` and `consumable | 소모품`; its first two rows were frozen, no AutoFilter was present, and an Excel PDF render showed no clipping or contrast defect. Browser console warnings and errors were zero.
- Follow-up verification passed TypeScript, lint, 44 Vitest files / 190 tests, and the production build. Existing large-chunk warnings remain unchanged.
- The full 50-scenario Playwright suite also passed after the data-sheet contract change.
