# Product Requirements

## Required Capabilities

- Create and inspect tables, columns, keys, relations, enums, dependencies, and export views.
- Validate schema structure before applying Commands.
- Explain impact on relations, runtime headers, existing rows, and export views.
- Undo and redo schema Commands.
- Generate runtime CSV from normalized source tables.
- Show an action-only `Problems | Change Review` drawer, toolbar History, and a dedicated AI conversation panel.
- Keep AI proposals structured and non-mutating.

## Out of Scope for Phase 0

- Real OpenRouter API requests.
- Paid model fallback.
- Production packaging and public deployment.
- Destructive migrations against user data.
- Direct modification of existing Figma files.

## Acceptance

Phase 0 is accepted when the app opens, the sample schema is visible, validation runs locally, command tests pass, and runtime CSV can be generated from the sample export view.
