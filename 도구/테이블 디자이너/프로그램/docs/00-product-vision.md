# Product Vision

Game Schema Workbench is a desktop IDE for game data design. It helps designers turn gameplay requirements into normalized authoring schemas and reproducible runtime exports.

## Core Thesis

- The schema graph is the source of truth.
- CSV files are generated outputs, not the primary model.
- Every schema edit is a Command.
- Commands must validate, describe impact, execute, and undo.
- AI is an advisor. It cannot mutate project state.

## Primary User

The primary user is a game system or content designer who understands tables, IDs, CSV, resources, and localization, but may not be a database specialist.

## Success Criteria

- Designers can see table relationships before editing.
- Designers can understand why a structure is risky in practical game-data language.
- Runtime exports can be regenerated from normalized authoring tables.
- Destructive or risky changes stop at review.
