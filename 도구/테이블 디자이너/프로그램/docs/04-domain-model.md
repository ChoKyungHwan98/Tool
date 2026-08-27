# Domain Model

## Workbench Document

`WorkbenchDocument` is the persisted project unit. It contains `formatVersion`, `revision`, `schema`, `rowsByTable`, `migrationState`, and `auditLog`.

Rows are stored as `DataRow { rowId, cells }`, and `cells` is keyed by immutable `columnId`.

## Schema Project

`SchemaProject` contains tables, enums, relations, functional dependencies, export views, layout, and command history.

## Table

Tables have immutable `tableId`, display names, columns, primary keys, unique constraints, check constraints, tags, and authoring/runtime flags.

## Column

Columns have immutable `columnId`, data type, nullability, default value, validation rules, semantic type, and deprecation state.

## Relations

Relations connect source and target column IDs. Names are display-only and never used as stable links.

## Export Views

Export views select source columns by ID and define runtime headers. Runtime headers can change independently of authoring column names.

## Phase 2 Completion

Implemented schema-core support now includes:

- Factory helpers for columns, tables, enums, relations, unique constraints, and check constraints.
- Zod-based persisted project validation.
- Internal duplicate ID detection for tables, columns, relations, enums, and export views.
- Parent/child tableId consistency checks for columns.
- Primary-key required-value enforcement.
- Check constraint source-column validation.
- Range validation sanity checks.
- Relation source/target type compatibility warnings.

Schema Core remains independent from React, Tauri, and grid libraries.
