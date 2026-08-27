# Security and Privacy

## Secrets

- Do not commit API keys.
- Do not log API keys.
- Do not bundle API keys into frontend code.
- `.env.example` may list variable names only.
- OpenRouter API keys entered during development stay in memory for the current browser/app session.
- Displayed keys must be masked.
- Tests must use mock keys only.

## Data Transmission

Default AI request scope is schema-only. Row data, private project files, NDA content, and local source files must not be transmitted without explicit approval.

The Phase 10 OpenRouter path sends schema metadata only. Loaded sample row values are deliberately excluded from prompts.

## CSV Safety

Generated CSV escapes values that begin with formula characters (`=`, `+`, `-`, `@`).

## Files

Future persistence adapters must guard against path traversal and corrupted project files.
