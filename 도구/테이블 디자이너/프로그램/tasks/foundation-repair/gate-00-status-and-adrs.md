# Gate 00: Status and ADRs

## Goal

Correct project status, document the foundation repair decisions, and add audit regression tests before changing implementation.

## Current State

- Status documents now describe Phase 13 as prototype feature completion, not product completion.
- `docs/audit/EXTERNAL_AUDIT_REPORT.md`, `docs/audit/CODEX_REMEDIATION_PROMPT.md`, and a provided external `audit-regression.test.ts` are absent from the working tree.
- The attached Foundation Repair prompt is the active remediation source.

## Required Output

- README and STATUS wording corrected.
- ADRs for unified document, ID-keyed rows, atomic transactions, exact undo, and versioned persistence.
- Audit regression tests added and confirmed failing before Gate 1 implementation.

## Gate Status

Completed for the failing baseline.

## Failing Baseline

Command:

```text
npm run test:run -- src/application/audit-regression.test.ts
```

Result:

```text
1 test file failed
5 tests failed
```

Failures reproduced before implementation changes:

- Populated RenameColumn cannot read the value through `row.cells[ColumnId]`.
- CSV export after rename writes the new header but drops the old name-keyed value.
- Project serialization omits `rowsByTable`.
- Validator after rename treats the renamed required column as blank.
- Runtime export lineage still points to the column ID, but the exported value becomes `null`.
