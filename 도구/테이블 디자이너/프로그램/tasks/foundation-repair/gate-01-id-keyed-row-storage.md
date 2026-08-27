# Gate 01: ID-Keyed Row Storage

## Goal

Introduce versioned `WorkbenchDocument` and store all row values by immutable `ColumnId`.

## Required Work

- Define `DataRow { rowId, cells }` and `WorkbenchDocument`.
- Update CSV import/export, validator, runtime export, persistence, and UI cell access to use `row.cells[column.columnId]`.
- Add safe legacy migration from name-keyed rows.
- Keep RenameColumn limited to schema display metadata.

## Required Tests

- Populated rename preserves values.
- CSV export after rename preserves values under the new header.
- Validation after rename produces equivalent results.
- Runtime export after rename preserves values and lineage.
- Save/reopen roundtrips rows and schema.
- Undo/redo does not duplicate audit events.
- Legacy migration succeeds when unambiguous.
- Ambiguous legacy migration is blocked with mapping issues.

## Gate Status

Complete.

## Implemented

- `WorkbenchDocument` with `formatVersion`, `revision`, `schema`, `rowsByTable`, `migrationState`, and `auditLog`.
- `DataRow { rowId, cells }` with cells keyed by immutable ColumnId.
- CSV import maps headers to ColumnId and blocks duplicate, unknown, or ambiguous mappings.
- CSV export reads `row.cells[column.columnId]` and writes current `column.name` headers.
- Validator reads row data by ColumnId.
- Runtime export reads row data by ColumnId and keeps lineage by source IDs.
- Project save uses full document serialization.
- Legacy name-keyed rows migrate when unambiguous and block when ambiguous.

## Verification

```text
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run e2e
cargo test
cargo check
npm audit --audit-level=moderate
```

All listed checks passed during Gate 1 verification.
