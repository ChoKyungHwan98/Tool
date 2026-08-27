# OpenRouter Integration

OpenRouter integration is deferred until after Schema Core, Command Engine, Migration, Validator, and Mock AI are stable.

## MVP Policy

- BYOK only.
- Store API keys in the OS credential store through the Tauri backend.
- Never place API keys in Git, `.env`, logs, or frontend bundles.
- Free models only by default.
- Paid fallback is off and cannot happen automatically.
- Schema-only transmission is the default.
- Row data transmission requires explicit user approval.

## Phase 0

No OpenRouter API calls are made. The app uses `MockAiProvider`.

## Phase 10 Completion

OpenRouter development integration is now present behind strict guards:

- API keys are entered only into a session password field.
- API keys are not written to source files, docs, `.env`, logs, or test fixtures.
- The UI masks any entered key before display.
- The model catalog is fetched from OpenRouter and filtered to free models only.
- Paid fallback is blocked in code.
- Row-data transmission is blocked in code.
- Schema-only prompts include table, column, relation, and export metadata but not loaded sample row values.
- Structured output is requested for guarded OpenRouter schema review.

Official references:

- OpenRouter model API: https://openrouter.ai/docs/api/api-reference/models/get-models
- OpenRouter chat completion API: https://openrouter.ai/docs/api-reference/chat-completion
- OpenRouter structured outputs: https://openrouter.ai/docs/features/structured-outputs
- OpenRouter free models router: https://openrouter.ai/docs/guides/routing/routers/free-router
- OpenRouter free variant: https://openrouter.ai/docs/guides/routing/model-variants/free

Deferred:

- OS credential store persistence through the Tauri backend.
- Manual model evaluation reports.
- Production-grade request cache and retry budget.
- User-approved row sample transmission modes.

## Phase 11 Completion

- Tauri backend exposes API key save/status/delete commands.
- Rust backend uses the OS credential store through `keyring`.
- Browser preview falls back gracefully when Tauri credential commands are unavailable.
- OpenRouter request manager adds local request caching, bounded retry, and manual cancellation.
- Paid fallback and row-data transmission remain blocked.

Deferred:

- Backend-only OpenRouter request proxy so the frontend never receives a stored key.
- Packaged-app credential QA across Windows accounts.
