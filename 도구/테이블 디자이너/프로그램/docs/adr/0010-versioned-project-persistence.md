# ADR 0010: Versioned Project Persistence

## Background

Prototype persistence serializes the schema project JSON. It does not yet store row data, migration state, or document audit metadata.

## Problem

Without a format version and migration path, old project files cannot be opened safely and current row data can disappear on save/reopen.

## Decision

Persist `WorkbenchDocument` with `formatVersion`, `revision`, `schema`, `rowsByTable`, `migrationState`, and `auditLog`. Legacy name-keyed files are opened through explicit migration that reports ambiguous or unknown mappings instead of silently choosing a column.

## Rejected Alternatives

- Continue saving only `SchemaProject`.
- Auto-convert ambiguous legacy rows by first matching column name.
- Mutate legacy source files during migration.

## Benefits

- Save/reopen can be tested with a full document roundtrip.
- Future format changes have a controlled migration boundary.
- Ambiguous legacy data can be quarantined for user recovery.

## Risks

- Old files need compatibility code.
- Persistence errors must expose actionable mapping issues.
- Review bundles must clearly identify the active format.

## Impact

Gate 1 must add document serialization/deserialization and legacy migration tests before project files can be considered safe.
