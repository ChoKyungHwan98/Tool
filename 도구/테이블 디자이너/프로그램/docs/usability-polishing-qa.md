# Usability and Visibility Polishing QA

- Date: 2026-07-16
- Scope: responsive shell, typography, navigation, AI panel, schema map, workbook, table design, import/export overlays
- Real OpenRouter requests: not executed

## Gate 0 Audit

The audit was added before implementation. Four of five initial Playwright checks failed for the expected reasons: compact panels consumed the center, the provider switch was outside settings, the FK apply action was below the short viewport, and schema metadata was below the 11px floor. The existing menu already scrolled inside the viewport, so that check was corrected to the actual missing behavior: command grouping. The UX documentation audit also failed because it described standalone Migration and History drawer tabs.

## Implemented

- Added deterministic explorer and assistant collapsed setters.
- Added 48px compact rails and mutually exclusive overlay panels below 1280px.
- Kept standard and wide panel widths at the approved 232/360 and 248/420 contracts.
- Moved AI provider selection into connection settings and replaced the empty explanation card with three review starters.
- Grouped the column menu and bounded its internal scroll area.
- Kept PK, FK mapping, current connections, and sticky apply actions visible at 1024×720.
- Split the original monolithic CSS into tokens and feature segments, then consolidated historical responsive rules into three final media blocks.
- Raised remaining 8–10.5px declarations to the 11px metadata floor, removed negative letter spacing, and removed the dashboard decoration gradient.
- Extracted `VirtualWorkbookGrid` and `WorkbookColumnMenu` from `DataGridView` without changing row storage, IDs, Commands, or Undo/Redo. The temporary `SpreadsheetValueBar` extraction was later removed after direct-input usability review.
- Updated the UX spec to the current `문제 | 변경 검토` drawer contract.

## Responsive Evidence

Playwright records the following views in `design/screenshots/` for every supported size:

- `polish-structure-{width}x{height}.png`
- `polish-data-{width}x{height}.png`
- `polish-design-basic-{width}x{height}.png`
- `polish-design-relations-{width}x{height}.png`

Verified sizes are 1024×720, 1280×720, 1440×900, and 1920×1080. Layout assertions cover body overflow, panel overlap, center width, grid viewport height, fixed header alignment, and in-viewport relation actions.

## Direct Interaction

Playwright Chromium directly clicked and verified workbook editing, column-menu commands, AI Mock review, Change Review, table deletion, import preview, export preview, Undo/Redo, and responsive panel controls while collecting console and page errors.

The user Chrome extension returned the open-tab list, but claiming the local app tab timed out twice. Per browser-control policy no alternate browser was presented as Chrome. This is an environment-level manual QA gap, not a hidden pass.

## Results

- TypeScript: pass
- Lint: pass
- Vitest: 128 passed
- Playwright Chromium: 34 passed after retrying one Windows PNG file-lock error
- Frontend build: pass with the existing chunk-size warning
- Rust `cargo check`: pass
- `npm audit --audit-level=high`: 0 vulnerabilities

## Remaining Risk

- The main JavaScript and ELK worker chunks still exceed the 500k warning threshold.
- Packaged Tauri credential storage and installer behavior still need native manual QA.
- User Chrome direct-click confirmation should be rerun when the extension can claim the local tab.
