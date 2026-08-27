# ADR 0002: Data Grid Selection

## Status

Accepted

## Decision

Use TanStack Table as the initial data-grid foundation.

The active implementation keeps TanStack Table for column, sort, and filter state and TanStack Virtual for row and column windows. Excel-style interaction is owned by the presentation layer through an explicit `GridEditSession`:

- direct text and IME input replaces the active value;
- F2 and double-click preserve the current value for editing;
- Enter and Tab commit and navigate, while Escape cancels;
- row, column, and all-cell selections remain UI state;
- committed values pass through `UpdateCellsCommand` instead of mutating rows in React.

The grid shows Excel coordinates and a cell value bar, but does not implement formulas, macros, or unbounded phantom schema columns.

## Comparison

| Option | License | Strengths | Risks |
| --- | --- | --- | --- |
| TanStack Table | MIT | Headless, free commercial use, strong TypeScript, customizable validation cells | Requires building editing, virtualization, and copy/paste UI |
| AG Grid Community | MIT | Mature grid features, large-row performance, keyboard support | Some advanced features are enterprise-only and product boundaries must be watched |
| Custom grid | Internal | Maximum control | High implementation risk for editing, accessibility, and performance |

## Consequences

TanStack Table keeps licensing simple and avoids locking domain logic to grid internals. The custom editing bridge is covered by keyboard, IME, Undo/Redo, empty-sheet, responsive, and performance regression tests; it remains a product-owned interaction surface rather than a domain dependency.
