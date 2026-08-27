# ADR 0012: AI Command Draft Boundary

## Status

Accepted and implemented for the initial whitelist

## Context

AI output is untrusted text. Applying serialized commands supplied by a remote model would bypass local IDs, validation, pricing policy, and user approval.

## Decision

- Send schema metadata only; never include row data in the default prompt.
- Accept only `create_table` and `add_export_column` structured drafts in the initial whitelist.
- Normalize remote drafts, reject unknown kinds and unknown IDs, and generate command/entity IDs locally.
- Compile accepted drafts into typed Commands, then use existing impact analysis, validation, and explicit Change Review approval.
- Permit only catalog-confirmed free OpenRouter models and reject paid, unknown, or paid-fallback selections.
- Store browser keys in module session memory and packaged-app keys in the OS credential store.

## Consequences

- AI cannot directly mutate the WorkbenchDocument.
- New AI-edit capabilities require an explicit draft type, local compiler, and tests.
- Actual OpenRouter traffic remains manual and is excluded from automated tests.
