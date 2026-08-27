# ADR 0009: Exact Undo Strategy

## Status

Implemented with exact document snapshots

## Background

Existing schema commands can reconstruct some prior state from serialized command fields. That is not enough for commands that affect rows, migrations, or audit metadata.

## Problem

Inverse commands are often guesses. A rename can be inverted, but migrations, deletes, and generated row edits need exact prior state or transaction deltas to avoid data loss.

## Decision

Undo must use exact prior document snapshots or exact transaction deltas. Redo must reapply the recorded transaction without creating duplicate audit events.

## Rejected Alternatives

- Infer undo from command type and current state.
- Re-run command validation and hope the inverse still applies.
- Append a new audit event for every redo replay.

## Benefits

- Undo/redo remains deterministic after schema and row changes.
- Audit history reflects user actions without duplicate replay noise.
- Migration recovery can rely on recorded deltas.

## Risks

- Snapshot or delta storage increases memory use.
- Command execution must clearly separate new application from replay.
- Existing command history will need compatibility handling.

## Impact

Gate 2 records exact before/after `WorkbenchDocument` snapshots for schema and row transactions. Undo restores `before`; redo restores `after` without re-running the command or duplicating audit events. Snapshot memory growth remains a known optimization target.
