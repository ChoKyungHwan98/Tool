# ADR 0003: Command-First Schema Edits

## Status

Accepted

## Decision

Represent every schema edit as a typed Command with validation, impact description, preview, execute, undo, and serialization.

## Context

Game schema refactors can break FK relations, runtime exports, and existing data. UI-level mutation would make impact review and undo unreliable.

## Consequences

- React components call commands instead of changing schema objects directly.
- Commands can be reviewed, serialized, undone, and tested.
- AI proposals must become commands before they can affect project state.
