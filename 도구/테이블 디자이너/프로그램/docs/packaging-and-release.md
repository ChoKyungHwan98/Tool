# Packaging and Release

## Phase 13 Local Build Commands

```powershell
npm install
npm run typecheck
npm run lint
npm run test:run
npm run e2e
npm run build
npm run tauri:build
```

## Release Contents

- Tauri desktop shell.
- Crowd-system sample schema.
- Editable schema map, data grid, runtime export view, inspector, problems, history, AI Review, Change Review, and Migration panel.
- CSV import/export and runtime CSV/JSON export.
- Local Mock AI and guarded OpenRouter development integration.
- Release manifest: `release/phase-13-release-manifest.md`.
- Final QA checklist: `docs/final-qa-checklist.md`.
- Production frontend build is manually chunked so the previous large bundle warning is resolved.

## Known Limitations

- OpenRouter credential persistence is implemented in the Tauri backend, but production request orchestration still needs more manual QA inside the packaged app.
- Migration plans are displayed but row mutation execution is not persisted yet.
- Data Grid keyboard navigation, sorting, filtering, and bulk paste are deferred.
- Full AI operation parsing into every Command type is deferred.
- Figma file refinement needs user approval before touching existing important files.
- The Phase 13 release exe built successfully at `src-tauri/target/release/game-schema-workbench.exe`.
- MSI bundling requires WiX. The first bundle attempt failed because the WiX download host could not be resolved.

## Security Notes

- Do not bundle API keys.
- Do not commit API keys.
- Keep paid fallback disabled.
- Keep row-data transmission disabled unless a separate approval flow is added.
- Public deployment and remote push require user approval.
