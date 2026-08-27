# User Guide

## Start

Open the app, choose a project, and enter the full structure map. The center workspace switches between `전체 구조`, `테이블 편집`, and `테이블 설계`. The left explorer changes tables; the right side is reserved for AI review.

## Full Structure

- Cards show PK, FK, referenced-key badges, column types, and exact column-level relation lines.
- Search locates a table; fit, minimap, relation focus, path tracing, and asynchronous auto-layout help inspect larger models.
- Dragging a table pins its position through a typed layout Command.
- Double-clicking a table opens it in Table Design.

## Table Design

- Edit table information, columns, PKs, FKs, unique constraints, types, required values, and defaults in the center workspace.
- Risky changes open Change Review with impact and validation before they apply.
- Table and column IDs stay stable across renames.

## CSV Editing

- Use the virtual workbook for cell editing, range selection, multi-cell paste, keyboard movement, row add/delete/duplicate, sorting, search, and column resizing.
- Sheet tabs switch tables. CSV import/export actions apply to the active sheet.
- Row changes run as atomic document transactions and participate in Undo/Redo.
- Invalid cells are highlighted and listed in Problems.

## Import

- Import CSV bundles or multi-sheet `.xlsx` workbooks from the top action or an empty project.
- Review table names, header rows, types, PK candidates, and FK candidates before applying.
- FK inference is never auto-approved.

## AI

- Local Mock review works without network traffic.
- OpenRouter requests occur only after pressing Send or Full Structure Review.
- Only free catalog models are selectable; paid models, unknown selections, and paid fallback are rejected.
- Schema metadata is sent without row data. Browser keys remain in session memory; packaged Tauri uses the OS credential store.
- Only whitelisted structured drafts compile into typed Commands, and every Command passes Change Review before application.

## Export

- Open Export to choose an output view and CSV or JSON format.
- Review the file name, blocking validation, generated content, and data lineage before downloading.
- Exports with blocking or error validation issues cannot be downloaded.

## Risky changes

Risky schema changes open `변경 검토`. When existing rows require conversion, the review shows an internal data-conversion plan with reversible steps and rollback notes. Migration is not a standalone user mode.
