# Game Schema Workbench

## Local folder layout

The portable tool folder keeps executable, source, and authored data separate:

- `테이블 디자이너.exe`: portable application entry point.
- `프로그램/`: source, tests, documentation, and regenerable build assets.
- `프로젝트/`: all user-authored `.gsw` files in one flat, canonical library (no game-specific subfolders).

The standalone desktop app and the embedded Game Design Studio tool both read and write this same sibling `프로젝트/` directory. Internal Tauri/IndexedDB repositories are recovery caches only; the flat `.gsw` files are the canonical data.

Game Schema Workbench is a desktop data schema IDE for game designers. The schema graph is the source of truth; CSV and runtime files are generated artifacts.

## Current Status

- Phase 13 is a historical prototype milestone, not product completion.
- Foundation Repair Gates 0–2 and the approved UX redesign Gates 1–5 are implemented.
- Row data is stored by immutable column ID inside a versioned WorkbenchDocument and edited through atomic document transactions with exact Undo/Redo snapshots.
- Tauri 2 + React + TypeScript + Vite scaffold is in place.
- Domain boundaries are split into `domain`, `application`, `infrastructure`, `presentation`, and `shared`.
- A crowd-system sample schema demonstrates tables, composite keys, FK relations, functional dependencies, runtime export views, validation, and command history.
- CSV bundles and Excel multi-sheet workbooks use a reviewed import preview. The virtual workbook supports range paste, row operations, sorting, search, resizing, sheet tabs, and data Undo/Redo.
- Runtime CSV/JSON export, FK-path flattening, validation gating, and per-column lineage are available in the export preview drawer.
- The right AI panel connects local Mock review to schema IDs and converts only whitelisted structure drafts into typed Commands for approval.
- OpenRouter integration is manual, schema-only, free-model-only, and refuses paid or unknown model selections instead of silently falling back.
- Tauri credential-store commands, local evaluation reports, user guide, and packaging notes are available.

## Commands

```powershell
npm install
npm run dev
npm run typecheck
npm run lint
npm run test:run
npm run e2e
npm run eval:local
npm run tauri dev
npm run tauri:build
```

## Product Rules

- Tables and columns use immutable internal IDs.
- Relations reference IDs, not names.
- UI components do not mutate schema state directly.
- Every schema change must be represented as a typed Command.
- AI can suggest changes, but cannot apply them.
- API keys must not be committed, logged, or bundled.
- Row data must be stored by immutable column ID, not display name.
- OpenRouter may receive schema metadata only; row data is blocked by contract and tests.

## Repository Layout

```text
src/domain          Pure schema model, commands, validation, impact analysis
src/application     Export, migration, and AI provider contracts
src/infrastructure  Persistence and platform adapters
src/presentation    React UI and local view state
docs/               Product, architecture, and testing docs
design/             Tokens, component inventory, Figma notes
schemas/            JSON schemas for persisted contracts
examples/           Crowd-system sample data
evals/              AI evaluation fixtures and reports
```
