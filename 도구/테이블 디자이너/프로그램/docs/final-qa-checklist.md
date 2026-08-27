# Final QA Checklist

## Automated

- [x] TypeScript typecheck.
- [x] Lint.
- [x] Unit tests.
- [x] Production frontend build.
- [x] Playwright smoke test.
- [x] Rust `cargo check`.
- [x] Local AI evaluation smoke.

## Security

- [x] No real OpenRouter key in files.
- [x] OpenRouter key UI masks entered key.
- [x] Tauri credential commands avoid logging secrets.
- [x] Paid fallback blocked.
- [x] Row-data transmission blocked.
- [x] CSV formula injection guard remains in export paths.

## Product

- [x] Schema map shows full table overview with PK/FK/REF badges.
- [x] Data Grid supports direct typing, Korean IME composition, F2/double-click editing, row/column selection, range paste, Undo/Redo, and CSV import/export.
- [x] Runtime View supports CSV/JSON output and lineage.
- [x] Problems panel combines schema and row diagnostics.
- [x] Change Review gates schema edits.
- [x] Risky changes show rollback-aware data-conversion plans inside Change Review.
- [x] Mock AI review is local-only and non-mutating.
- [x] OpenRouter path is free-model-only and schema-only.

## Packaging

- [x] Release exe built.
- [ ] MSI installer bundled. Blocked by WiX download resolution.
- [ ] Signed installer. Requires approval and certificate setup.
- [ ] Remote repository push. Requires approval.
