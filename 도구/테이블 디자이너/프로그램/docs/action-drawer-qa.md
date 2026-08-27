# Action Drawer Simplification QA

- Date: 2026-07-16
- Scope: bottom drawer, contextual migration guidance, toolbar command history
- External AI calls: none

## Product Checks

| Scenario | Result |
| --- | --- |
| Workbench opens with the bottom drawer closed | Pass |
| Validation opens a drawer with only Problems and Change Review | Pass |
| Standalone Migration and History tabs are absent | Pass |
| A reviewed column type change shows a contextual Data Conversion Plan | Pass |
| Canceling the review closes the drawer without mutation | Pass |
| Applying a reviewed change closes the drawer | Pass |
| Adding a normal data row does not open the drawer | Pass |
| Toolbar history shows the row-add label and summary | Pass |
| Drawer height remains bounded on short and tall viewports | Pass |

## Direct Chrome QA

The sample project at `http://127.0.0.1:5173/` was opened and operated directly.

1. Validation exposed exactly Problems and Change Review.
2. Changing `CrowdReactionRule.RuleId` from `string` to `int32` staged Change Review and displayed a collapsed Data Conversion Plan.
3. Cancel preserved the original type and removed the drawer from the layout.
4. Adding one row in Table Editing left the drawer closed.
5. The top-toolbar History popover displayed `행 추가` and `1개 행 추가`.
6. The structure map, workbook grid, explorer, and AI panel remained usable throughout the scenario.

## Automated Results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run test:run` | Pass: 28 files, 126 tests |
| `npm run e2e` | Pass: 28 Chromium tests |
| `npm run build` | Pass with known chunk-size warnings |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Pass |
| `npm audit --omit=dev --audit-level=high` | Pass: 0 vulnerabilities |

The repository does not define a `test:e2e` script; its canonical Playwright command is `npm run e2e`.

## Remaining Risk

- The production build still reports the known main-bundle and ELK worker chunk-size warnings.
- Detailed conversion steps are generated for the currently supported migration command types. New risky command types must add a matching plan before exposing conversion guidance.
- Packaged Tauri UI behavior remains part of the Packaging QA Gate.
