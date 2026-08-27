# Gate 02: Atomic Command Engine

## Goal

Move command execution to atomic document transactions after Gate 1 passes.

## Scope

- Transaction apply/reject boundary.
- Exact undo/redo deltas or snapshots.
- Document-level audit event semantics.
- No Gate 2 work begins before Gate 1 is complete.
