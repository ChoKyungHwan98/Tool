# Game Schema Workbench Review Report

Generated: 2026-06-27

> Archived snapshot: this report and `review-bundle.zip` predate the Foundation Gate 2 and UX redesign Gates 1–5 implementation. Use `STATUS.md`, `PRODUCT_DIRECTION.md`, and ADRs 0011–0012 for the current state. Regenerate the review bundle before external submission.

This report was prepared for external code review. It summarizes the current implementation state from the repository contents and the verification commands executed during bundle preparation. No real OpenRouter request was executed.

## Current Phase

- **Implemented through Phase 13**: `STATUS.md` states "Phase 13 complete - All planned master phases through packaging prep are implemented."
- **Post-Phase polish implemented**: Korean UI/localization pass for visible workbench labels, validation problem messages, and sample descriptions.
- **Important distinction**: Phase 13 packaging prep is implemented and the latest `npm run tauri:build` completed successfully during this review-bundle preparation, but generated binaries are intentionally excluded from `review-bundle.zip`.

## Phase Implementation Map

| Phase | Status | Main implementation files |
| --- | --- | --- |
| Phase 0 scaffold/product baseline | Implemented | `package.json`, `vite.config.ts`, `src/App.tsx`, `src/App.css`, `src-tauri/tauri.conf.json`, `docs/`, `schemas/`, `tasks/phase-0.md` |
| Phase 1 schema visualization polish | Implemented | `src/presentation/components/SchemaCanvas.tsx`, `src/App.css`, `design/screenshots/schema-workspace-phase1.png` |
| Phase 2 Schema Core | Implemented | `src/domain/schema.ts`, `src/domain/schemaFactories.ts`, `src/domain/schemaValidation.ts`, `src/domain/projectQueries.ts`, `src/domain/sampleProject.ts`, `schemas/project.schema.json` |
| Phase 3 Command Engine | Implemented | `src/domain/commands.ts`, `src/domain/impact.ts`, `src/domain/commands.test.ts`, `schemas/command.schema.json`, `src/infrastructure/projectPersistence.ts` |
| Phase 4 Migration Engine | Partial implementation | `src/application/migration.ts`, `src/application/migration.test.ts`, `schemas/migration.schema.json`; plans and rollback metadata exist, but row mutation execution is not persisted |
| Phase 5 Validator | Implemented | `src/domain/validator.ts`, `src/domain/validator.test.ts`, `docs/07-validator-rules.md` |
| Phase 6 Import/Export | Implemented with known scope limits | `src/application/csvImportExport.ts`, `src/application/exportRuntime.ts`, related tests; advanced runtime filters/sorts/computed columns remain future work |
| Phase 7 IDE UI | Implemented | `src/presentation/components/*`, `src/presentation/state/workbenchStore.ts`, `src/App.css` |
| Phase 8 Advanced UX | Partial implementation | `BottomPanel.tsx`, staged Change Review, impact review, migration panel; full side-by-side schema diff is not implemented |
| Phase 9 Mock AI | Implemented | `src/application/mockAiProvider.ts`, `BottomPanel.tsx`, `schemas/ai-proposal.schema.json` |
| Phase 10 OpenRouter development integration | Partial implementation | `src/application/openRouterProvider.ts`, UI controls in `BottomPanel.tsx`; guarded schema-only requests exist, but no live request was executed for this report |
| Phase 11 OpenRouter app integration | Partial implementation | `src-tauri/src/lib.rs`, `src/infrastructure/openRouterCredentials.ts`, `src/application/openRouterRequestManager.ts`; backend credential commands exist, but production packaged-app credential QA remains open |
| Phase 12 Model Evaluation | Implemented locally | `src/application/modelEvaluation.ts`, `src/application/modelEvaluation.test.ts`, `evals/`; Mock provider only |
| Phase 13 Packaging Prep | Implemented | `docs/packaging-and-release.md`, `docs/final-qa-checklist.md`, `release/phase-13-release-manifest.md` (excluded from ZIP), `src-tauri/` config |

## Completion Classification

### Implemented

- React/Vite/Tauri workbench shell.
- Normalized authoring schema model with stable table/column/relation/export IDs.
- Schema parsing/validation with Zod.
- Typed Command engine with validation, impact descriptions, preview, execute, undo, serialization.
- In-memory Undo/Redo stacks.
- Validator for schema and loaded row data.
- CSV import/export for tables.
- Runtime CSV/JSON export with lineage and FK-path flattening.
- Mock AI provider and proposal display.
- Guarded OpenRouter provider code with free-model filtering, paid fallback blocking, schema-only prompt construction, request caching, retry, and cancellation.
- Tauri OS credential-store commands for OpenRouter key save/status/delete.
- Local model evaluation suite with 18 default cases.
- Korean UI localization for visible workbench surfaces and validation messages.
- Packaging build path; latest Tauri build produced EXE/MSI/NSIS artifacts under `src-tauri/target/`.

### Partial Implementation

- Migration engine: creates rollback-aware plans, but does not execute/persist row mutations.
- OpenRouter: provider and UI exist, but live model calls were not exercised for this report; backend-only request proxy is still deferred.
- AI proposal application: safe suggestions are staged as Commands, but parsing arbitrary AI operations into every Command type is deferred.
- Data Grid: basic editing/import/export exists; spreadsheet keyboard navigation, sorting, filtering, virtualization, and bulk paste are deferred.
- Change Review: staged apply exists; side-by-side schema diff is deferred.
- Tauri security: credential commands exist, but CSP is currently `null` in `src-tauri/tauri.conf.json` and should be hardened before distribution.
- Figma: MCP file was created as a structural wireframe; code remains the implementation source.

### Documented Only Or Deferred

- Signed installer release process.
- Public deployment and remote push flow.
- Full row-data migration executor.
- User-approved private row sample transmission to AI.
- Full Figma component synchronization and refinement.
- Backend-only OpenRouter proxy so stored keys never reach frontend code.

## Architecture Summary

- `src/domain`: pure TypeScript domain model, schema factories, validation, commands, impact descriptions, sample schema.
- `src/application`: orchestration utilities for migration planning, CSV import/export, runtime export, AI provider contracts, OpenRouter provider/request manager, model evaluation.
- `src/infrastructure`: persistence and Tauri credential adapter.
- `src/presentation`: React components and Zustand UI/application state.
- `src-tauri`: Tauri 2 Rust shell and OS credential-store commands.

ADR coverage:

- `docs/adr/0001-application-stack.md`: Tauri 2, React, TypeScript, Vite, Rust backend, Vitest, Playwright.
- `docs/adr/0002-data-grid-selection.md`: TanStack Table.
- `docs/adr/0003-command-first-schema-edits.md`: all schema edits must go through typed Commands.
- `docs/adr/0004-ai-provider-policy.md`: Mock AI for automated tests; no accidental paid AI calls.
- `docs/adr/0005-figma-access-policy.md`: Figma is useful but not a code blocker.

## Schema Core Status

- Implemented in `src/domain/schema.ts`, `schemaFactories.ts`, `schemaValidation.ts`, `projectQueries.ts`.
- Stable IDs are used for tables, columns, relations, enums, dependencies, export views, and commands.
- Zod validation checks project shape, duplicate IDs, table/column parent consistency, relation mapping, constraints, and export view references.
- JSON persistence uses `src/infrastructure/projectPersistence.ts`.

## Command Engine Status

- Implemented in `src/domain/commands.ts`.
- Includes commands for renaming, nullable changes, adding/deleting columns/tables, changing column types, PK/FK changes, constraints, functional dependencies, split/merge, lookup extraction, junction table creation, surrogate keys, backfill defaults, and export view create/modify.
- React components queue Commands through `src/presentation/state/workbenchStore.ts`; they do not directly mutate schema objects.
- Destructive commands require approval via serialized command approval.

## Undo/Redo Implementation

- Implemented in `src/presentation/state/workbenchStore.ts`.
- Uses in-memory `undoStack` and `redoStack` of serialized Commands.
- `materializeCommandForUndo` captures prior state where required.
- `undo()` calls `command.undo(project)`.
- `redo()` calls `command.execute(project)`.
- Undo/Redo state is not persisted across app restarts.

## Migration And Rollback

- Implemented as planning logic in `src/application/migration.ts`.
- Plans include step IDs, descriptions, reversible flags, rollback step IDs, risks, rollback strategy, and approval requirements.
- Implemented plan types include required-column addition, column type change, table split, table merge, and backfill.
- `migrationCanRollback()` reports whether all plan steps are reversible.
- Not implemented: durable row mutation execution, persistent rollback execution, or batch migration runner.

## Validator Rules

Implemented in `src/domain/validator.ts`:

- Duplicate table, column, relation, enum, and export view IDs.
- Duplicate table and column names.
- Column tableId mismatch.
- Missing primary key.
- Primary key references missing columns.
- Primary key allows blanks.
- Unique/check constraints reference missing columns.
- Missing enum references.
- Impossible column range rules.
- Repeated column pattern warnings.
- Missing relation tables or columns.
- Composite relation source/target width mismatch.
- FK/source-target data type mismatch.
- Hard FK cycle warnings.
- Missing functional dependency table/columns.
- Possible partial-key dependency.
- Possible transitive dependency.
- Export view missing source column.
- Export header collisions.
- Row contains unknown column.
- Required value is blank.
- Cell value wrong type.
- Validation rule failures.
- Blank primary-key row values.
- Duplicate primary keys.
- Duplicate unique constraints.
- Required relation/FK blank values.
- Loaded FK orphan checks.
- Functional dependency row-data conflicts.

## CSV Import/Export

- Implemented in `src/application/csvImportExport.ts`.
- CSV parser supports quoted cells, escaped quotes, CRLF/LF rows.
- Import maps CSV headers to schema columns, normalizes scalar values, and runs row validation.
- Export writes schema-ordered headers and escapes formula-leading values (`=`, `+`, `-`, `@`) by prefixing a quote.
- Known limitation: no advanced CSV dialect configuration UI.

## Runtime Export And Lineage

- Implemented in `src/application/exportRuntime.ts`.
- Supports runtime CSV and JSON rendering from `ExportView`.
- Uses authoring schema IDs, not display names, for source references.
- Includes lineage records showing header, source table/column, and relation path.
- Supports FK-reachable source flattening.
- Known limitation: filtering, sorting, computed columns, one-to-many expansion, and more complex transform rules are future work.

## OpenRouter Integration

- Implemented files: `src/application/openRouterProvider.ts`, `src/application/openRouterRequestManager.ts`, `src/infrastructure/openRouterCredentials.ts`, `src-tauri/src/lib.rs`, UI in `BottomPanel.tsx`.
- No OpenRouter API request was run for this report.
- Current default model selection:
  - UI starts with no selected model.
  - After catalog fetch, `selectedFreeModelId` becomes the existing selection or the first free model in the filtered catalog.
  - Provider fallback also chooses `settings.modelId` if it is in the free catalog, otherwise the first free model.
- Free model enforcement:
  - `isFreeOpenRouterModel()` checks all known pricing fields are zero, or accepts `:free` suffix only when pricing is absent.
  - `assertOpenRouterPolicy()` rejects non-free models when `freeModelsOnly` is true.
- Paid fallback prevention:
  - `defaultOpenRouterSettings.allowPaidFallback` is false.
  - `assertOpenRouterPolicy()` throws if `allowPaidFallback` is true.
- Row-data protection:
  - `defaultOpenRouterSettings.sendRowData` is false.
  - `assertOpenRouterPolicy()` throws if row data transmission is enabled.
  - `buildSchemaOnlyPrompt()` includes schema metadata only and excludes loaded sample row values.
- API key storage:
  - Browser/session entry is kept in React state and masked for display.
  - Tauri backend stores keys in the OS credential store through the Rust `keyring` crate.
  - `.env.example` contains only `OPENROUTER_API_KEY=` and no value.

## AI Proposal Validation And Application

- `MockAiProvider` returns structured `SchemaProposal` objects locally.
- OpenRouter responses are parsed into `SchemaProposal` via `parseSchemaProposal()`.
- Validation findings are derived from local `validateProject(project)`.
- Proposals do not directly mutate the schema.
- The current UI can stage a safe runtime export suggestion by creating a `ModifyExportViewCommand`.
- All staged changes pass through Change Review and Command validation before applying.

## Tauri Security Settings

- Config: `src-tauri/tauri.conf.json`.
- Capabilities: `src-tauri/capabilities/default.json` with `core:default`.
- Custom commands: `save_openrouter_api_key`, `get_openrouter_credential_status`, `delete_openrouter_api_key`.
- Credential service/account constants are in `src-tauri/src/lib.rs`.
- Debug logging plugin is enabled only under `debug_assertions`.
- Security concern: `app.security.csp` is currently `null`; review should prioritize CSP hardening before distribution.

## Figma Integration Status

- Figma MCP access was previously connected and a new design file was created.
- Current Figma work is documented in `design/figma-integration.md`.
- Existing important Figma file refinement requires user approval.
- Code-first UI and screenshots are the current source of truth.

## Tests And Counts

- Vitest unit/integration tests: 11 files, 51 tests.
- Playwright E2E tests: 1 file, 1 smoke test.
- Local model evaluation tests: 1 file, 3 tests, covering the evaluation harness. The default evaluation suite defines 18 cases.

## Verification Commands Run

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run test -- --run` | Pass: 11 files, 51 tests |
| `npm run test:run` | Pass: 11 files, 51 tests |
| `npm run test:e2e` | Failed: missing npm script |
| `npm run e2e` | Pass: 1 Playwright test |
| `npm run build` | Pass: frontend production build completed |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Pass |
| `npm run tauri:build` | Pass: EXE, MSI, and NSIS setup generated under `src-tauri/target/` |
| `npm audit --audit-level=moderate` | Pass: 0 vulnerabilities |
| `cargo audit --version` | Failed: `cargo audit` is not installed |
| `npm run eval:local` | Pass: 1 file, 3 tests |

## Build Results

- Frontend build succeeded and wrote files under `dist/`.
- Tauri build succeeded and wrote executable/installer artifacts under `src-tauri/target/`.
- Both `dist/` and `src-tauri/target/` are excluded from `review-bundle.zip`.

## Known Errors And Gaps

- `npm run test:e2e` is not defined. The actual defined E2E script is `npm run e2e`.
- `cargo audit` is not installed in this environment.
- `STATUS.md` still records an earlier WiX/MSI bundling blockage, but the latest `npm run tauri:build` during this report succeeded.
- Backend-only OpenRouter proxy is deferred.
- Packaged-app credential QA is still needed.
- Migration row mutation/rollback executor is not implemented.
- Spreadsheet-grade data grid navigation/filter/sort/bulk paste is deferred.
- Full AI operation parsing into every Command type is deferred.
- CSP is not hardened.

## Technical Debt

- UI state, row data, undo/redo stacks, and pending changes are in-memory only.
- Validator issue titles are localized; internal tests now depend on localized titles.
- Command engine is broad and could benefit from smaller modules as it grows.
- OpenRouter provider currently constructs requests in frontend-accessible code when using a session key; backend-only proxy is recommended.
- Figma wireframes are not yet synchronized as a reusable design system.

## Security Notes

- No real API key was found during pre-bundle scans.
- Secret scan matches are limited to variable names, test dummy strings, `Bearer` header construction, keyring API method names, and documentation policy text.
- `.env.example` contains only the variable name `OPENROUTER_API_KEY=`.
- Generated ZIP excludes `.env`, `node_modules/`, `dist/`, `release/`, `src-tauri/target/`, reports, coverage, caches, and VCS data.
- Actual OS credential-store data is not part of the project tree and is not included.

## Reviewer Priority Files

1. `src/domain/schema.ts`
2. `src/domain/schemaValidation.ts`
3. `src/domain/commands.ts`
4. `src/domain/validator.ts`
5. `src/application/migration.ts`
6. `src/application/csvImportExport.ts`
7. `src/application/exportRuntime.ts`
8. `src/application/openRouterProvider.ts`
9. `src/application/openRouterRequestManager.ts`
10. `src/presentation/state/workbenchStore.ts`
11. `src/presentation/components/SchemaCanvas.tsx`
12. `src/presentation/components/BottomPanel.tsx`
13. `src-tauri/src/lib.rs`
14. `src-tauri/tauri.conf.json`
15. `docs/11-security-and-privacy.md`
16. `docs/packaging-and-release.md`
17. `e2e/app.spec.ts`
18. `package.json`
