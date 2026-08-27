# ADR 0007: ID-Keyed Row Storage

## Background

Columns already have immutable IDs, while row values in the prototype can be keyed by display names such as `RuleId`.

## Problem

Display names are editable labels. If row values are keyed by names, renaming a populated column can hide or lose values in validators, CSV export, runtime export, and saved project files.

## Decision

Store each row as `{ rowId, cells }`, where `cells` is keyed by immutable `ColumnId`. Column names remain presentation labels and CSV headers only.

## Rejected Alternatives

- Rename row object keys when a column is renamed.
- Maintain both name-keyed and ID-keyed values.
- Treat column names as stable technical identifiers.

## Benefits

- RenameColumn changes only schema display metadata.
- Existing cell values survive renames without string replacement.
- Relations, constraints, functional dependencies, and lineage stay ID-based.

## Risks

- CSV import needs explicit header-to-column mapping and ambiguity handling.
- Legacy name-keyed rows need migration and recovery paths.
- Existing tests and UI cell accessors must be updated.

## Impact

Gate 1 must remove production reads such as `row[column.name]` and `row.cells[column.name]` from validation and export paths.
