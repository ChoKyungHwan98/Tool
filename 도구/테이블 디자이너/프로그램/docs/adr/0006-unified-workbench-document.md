# ADR 0006: Unified WorkbenchDocument

## Background

The prototype kept the schema project and loaded row data as separate application state. That was sufficient for UI exploration, but it does not provide a single durable unit for save, migration, undo, validation, export, or audit.

## Problem

When schema and rows are persisted or transformed independently, save/reopen can drop rows and command flows can only reason about part of the user's project. This makes data safety impossible to verify.

## Decision

Introduce a versioned `WorkbenchDocument` as the project unit. It contains `formatVersion`, `revision`, `schema`, `rowsByTable`, `migrationState`, and `auditLog`. UI-only state remains outside the document.

## Rejected Alternatives

- Keep `SchemaProject` as the only persisted model and save rows separately.
- Store rows only in presentation state.
- Add ad hoc row payloads to individual commands without a document boundary.

## Benefits

- Save/reopen, migration, validation, and export operate on the same object.
- Future transactions can capture schema and row effects atomically.
- Reviewers can inspect one durable model for project safety.

## Risks

- Existing UI selectors and persistence code must be updated.
- Legacy files require explicit migration logic.
- Tests must distinguish document state from temporary UI state.

## Impact

Gate 1 changes must route persistence and application services through the document model before later command-engine work begins.
