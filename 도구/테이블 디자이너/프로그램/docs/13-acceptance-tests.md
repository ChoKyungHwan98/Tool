# Acceptance Tests

## Phase 0 Checklist

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run test:run` passes.
- `npm run e2e` passes or records a browser-install blocker.
- The app opens to Schema Workspace.
- Crowd-system sample tables and relations are visible.
- Problems panel shows no blocking sample issue.
- Runtime export produces `CrowdReactionRuntime.csv`.
- Rename Column preserves FK relation IDs.

## Manual Smoke

1. Start `npm run dev`.
2. Open `http://127.0.0.1:5173`.
3. Select `Animation`.
4. Rename `AnimationId`.
5. Confirm relation arrows remain.
6. Undo.
