# ADR 0013: Excel Workbook Coordinate Model

- Status: Accepted
- Date: 2026-07-16

## Context

The table editor previously rendered schema names in a separate header and labeled the first stored record as A1. That differed from the approved Excel/CSV workflow, made PK names impossible to edit as cells, and allowed duplicate column-add commands to hide behind permissive E2E selectors.

## Decision

- Workbook row 1 is a presentation-only schema row. A1 is the first column name, B1 is the second column name, and stored records begin at row 2.
- The schema row is not persisted as a `DataRow`; row storage remains `DataRow.cells[ColumnId]`.
- `WorkbookCoordinate` distinguishes schema and data positions while retaining Excel-style addresses.
- Schema-cell edits use `RenameColumnCommand`, including impact review for FK or export references. Column IDs remain stable.
- A1 range paste uses `ApplyWorkbookRangeCommand` to validate and apply header renames, row insertion, and cell updates as one document transaction.
- A block wider than the existing table is rejected. Paste never creates implicit columns.
- Row 1 cannot be deleted or duplicated. The column letter selects the schema cell and all data cells in that column.
- Coordinates remain an internal selection and clipboard contract. The editor does not expose a separate address/value bar; A1 headers and A2+ data values are edited directly in their grid cells.

## Consequences

- Excel and CSV coordinates are consistent across empty and populated tables.
- Header and data paste can be undone in one step without changing row storage format.
- Search, sorting, and filtering continue to operate only on stored data rows.
- Presentation code must translate virtual data index `n` to workbook row index `n + 1`.
- Direct typing, F2, double-click, Enter/Tab movement, IME composition, and paste share one grid edit session instead of separate cell and value-bar modes.
