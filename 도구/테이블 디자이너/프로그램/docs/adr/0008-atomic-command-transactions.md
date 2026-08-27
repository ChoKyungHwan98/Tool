# ADR 0008: Atomic Command Transactions

## Status

Implemented

## Background

The prototype command engine applied typed schema commands and recorded schema command history. Row data was not yet part of those command transactions when this decision was accepted.

## Problem

Some future commands must change schema, rows, migrations, and audit records together. Partial application would leave the workbench in an invalid state.

## Decision

Model future command execution as atomic document transactions. A transaction receives one `WorkbenchDocument`, validates all effects, and returns one next `WorkbenchDocument` plus exact undo information.

## Rejected Alternatives

- Execute schema and row mutations as separate state updates.
- Let React components mutate row data directly.
- Recover from partial command failures with best-effort cleanup.

## Benefits

- Commands can be reviewed, applied, undone, and audited as one unit.
- Data migration steps can be validated before commit.
- Later Gate 2 command hardening has a clear boundary.

## Risks

- Command APIs will become more explicit and may need migration.
- Tests must cover rollback and failure atomicity.
- The initial Gate 1 work only establishes the document model, not the full transaction engine.

## Impact

Gate 2 implemented `DocumentTransaction`, `UpdateCellsCommand`, `InsertRowsCommand`, `DeleteRowsCommand`, and `ReplaceRowsCommand`. Store row actions now enter through this application boundary.
