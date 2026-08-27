# Testing Strategy

## Unit

- Schema model helpers.
- Commands and undo/redo.
- Validator rules.
- Migration plan generation.
- Export transformation.
- AI output parsing.

## Integration

- Project save/load.
- CSV import/export.
- Change Review application.
- AI proposal validation.

## E2E

- Open workbench.
- Select table.
- Rename column.
- Undo/Redo.
- View runtime export.
- Open Problems and History panels.

Phase 0 includes Vitest tests and a Playwright smoke test.

## Phase 12 Evaluation

- The local AI/model evaluation suite contains 18 cases.
- Automated evaluation uses `MockAiProvider` only.
- Live OpenRouter evaluation is manual and must use free models only.
- Row data is not transmitted during evaluation.
- Reports are stored under `evals/reports/`.
