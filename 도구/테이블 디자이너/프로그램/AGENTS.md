# Agent Notes

This repository follows the master instruction for Game Schema Workbench.

## Non-Negotiable Rules

- Do not mutate schema objects directly from React components.
- Use typed Commands for schema changes.
- Preserve table and column IDs across renames.
- Do not call paid AI models or paid services without explicit user approval.
- Do not commit real API keys, production data, private row data, logs containing secrets, or OAuth tokens.
- Keep runtime exports reproducible from the normalized authoring schema.

## Working Order

1. Read `STATUS.md`.
2. Read `PRODUCT_DIRECTION.md` and identify which product Gate the work belongs to.
3. Check ADRs in `docs/adr/`.
4. Make focused changes in the correct boundary.
5. Run `npm run typecheck`, `npm run lint`, and `npm run test:run`.
6. Update `STATUS.md` and docs when the product contract changes.

## Boundary Guide

- `src/domain`: pure TypeScript, no React, no Tauri, no browser APIs except guarded ID generation.
- `src/application`: orchestration services, export pipelines, migration plans, AI provider contracts.
- `src/infrastructure`: file system, credentials, OpenRouter, persistence, Tauri adapters.
- `src/presentation`: React components and UI-only state.
