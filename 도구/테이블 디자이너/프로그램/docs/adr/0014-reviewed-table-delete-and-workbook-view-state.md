# ADR 0014: Reviewed Table Deletion and Workbook View State

- Status: Accepted
- Date: 2026-07-16

## Context

Game designers need to remove obsolete tables and keep Excel-like editing preferences without weakening the immutable-ID document model. A table deletion can remove rows, columns, PK/FK relations, diagram layout, and runtime output references, so it must not behave like an immediate cosmetic action. Sorting, filters, widths, hidden columns, and frozen columns are editor preferences and must not change CSV or runtime output.

## Decision

- The explorer and workbook sheet tabs expose the same table context menu through pointer and keyboard access.
- Every table deletion, including an empty table, stages the existing typed `DeleteTableCommand` in Change Review.
- Change Review reports affected table, column, row, relation, and export-view counts before approval.
- Approval removes schema, rows, relations, diagram layout, and workbook view state in one document transaction. Exact snapshot Undo restores IDs, order, rows, relations, layout, and view state.
- `WorkbenchDocument` format version 2 adds `TableWorkbookViewState`, keyed by immutable `TableId` and `ColumnId`.
- Workbook view state stores column widths, hidden columns, frozen columns, multi-sort order, and typed column filters.
- Workbook view state is authoring metadata. CSV export, runtime JSON/CSV, validation lineage, and game data do not include it.
- `AddColumnCommand` accepts an optional `targetIndex`. Missing indices retain the historical append behavior.
- Find/replace that touches schema headers uses `ReplaceWorkbookMatchesCommand` and the same impact-review boundary as other schema changes.

## Consequences

- Destructive table removal is explicit, auditable, cancelable, and exactly undoable.
- Editing preferences survive project persistence without contaminating runtime content.
- Column reorder, hide, freeze, sort, and filter operations continue to reference stable IDs instead of names.
- Old version-1 project documents load with empty workbook view state and migrate to version 2.
- Formula evaluation, formatting, comments, charts, pivot tables, macros, and printing remain outside this Gate.
