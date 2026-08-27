# ADR 0019: Permissive Excel Authoring and Large-Sheet Navigation

- Status: Accepted
- Date: 2026-07-28

## Context

The workbook is a game-data authoring surface, not a database administration
form. Blocking every invalid value made rapid drafting slower than Excel and
forced designers to repair schema constraints before they could finish a data
pass. The display-only grid also stopped at the initial viewport and its very
tall CSS background could lose vertical column lines on wide screens.

## Decision

- The workbook exposes 100,000 virtual data rows. Rows outside the viewport are
  not mounted and become stored `DataRow` objects only after committed input.
- Wide-screen ghost-column boundaries are individual guide elements rather than
  one multi-million-pixel background raster.
- The immediate blank schema cell and later visible blank columns share one
  visual and selection contract. Typing in a later blank cell creates only the
  intervening nullable string columns needed to reach it, using typed
  `AddColumnCommand` operations and without leaving Table Edit. Existing
  columns, IDs, PKs, and FKs are not rewritten.
- Data-type, required-value, Enum, Boolean, rule, and single-column FK failures
  are authoring warnings. The value is committed through the existing typed row
  transaction and the validator marks the problem.
- Schema names, column creation, document width, and reviewed schema changes
  remain structural boundaries and may still reject invalid operations.
- Enum, Boolean, and single-column FK values use editable suggestion lists.
- AutoFill supports four directions, edge scrolling, generated endpoint
  feedback, series projection, source-pattern copy, and overflow row creation
  through `ApplyWorkbookRangeCommand`.
- Paste Special remains data-only and supports transpose and skip-blanks. It
  does not introduce Excel formatting, formulas, links, or embedded objects.
- `Ctrl+A` first selects the used range and then the displayed sheet. `Ctrl+G`
  and the visible Go To action navigate to addresses up to the virtual-row
  limit.
- Active sort, filter, hidden-column, and frozen-column state stays visible and
  reversible from the workbook toolbar.

## Consequences

- Designers can draft incomplete data and use validation or AI review to locate
  problems afterward.
- Invalid authoring data can exist temporarily, so validation remains required
  before runtime export.
- The normalized schema, immutable IDs, Command boundary, Undo/Redo, CSV, and
  runtime export contracts do not change.
- Formula evaluation, formatting, charts, pivot tables, macros, and printing
  remain outside product scope.

## Verification

- Unit tests cover series and copy-mode directional fill.
- TypeScript, lint, all Vitest suites, and the production build pass.
- Direct 1920x1080 browser QA verifies continuous D-N grid guides, address
  navigation to `A100000`, two-stage `Ctrl+A`, Paste Special options, permissive
  numeric warning behavior, copy-mode fill, exact Undo restoration, and zero
  browser console errors.
- Follow-up browser QA compares computed fill, border, color, and stacking for
  the immediate and later blank headers, then verifies direct F1 typing,
  commit, and restoration. Unit coverage verifies row/column expansion counts.
