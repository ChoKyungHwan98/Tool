# Migration Engine

The migration engine plans schema changes when existing rows already exist.

## Required Column Strategy

1. Add the new column as nullable.
2. Backfill existing rows by fixed value, formula, import mapping, or manual entry.
3. Validate that no blanks remain.
4. Apply Not Null.

## Rollback Rule

Each intermediate step must be reversible. A failed backfill cannot leave the project in a partially committed final state.

## Phase 0

`planRequiredColumnMigration` creates a documented plan. Row mutation and rollback execution are future work.

## Phase 4 Completion

The migration engine now creates rollback-aware plans for:

- Required column addition.
- Column type changes through a shadow-column conversion.
- Table splits.
- Table merges.
- Column backfills.

Each plan contains affected table IDs, affected column IDs, ordered reversible steps, risks, a rollback strategy, and whether approval is required.

`previewBackfillRows` provides a local row-preview helper for fixed-default backfills. Full persisted row mutation remains future work and should be implemented after the editable data grid and project save/load adapters are in place.

## Phase 8 UI Binding

The bottom Migration panel now acts as the first Migration Wizard surface:

- Shows candidate plans for the selected column.
- Displays approval requirements.
- Lists ordered reversible steps.
- Shows rollback strategy and rollback capability.
- Keeps destructive execution out of automatic flows.

Deferred:

- Executing migration steps against persisted row sets.
- Manual backfill queue UI.
- Diff view between pre-migration and post-migration row snapshots.
