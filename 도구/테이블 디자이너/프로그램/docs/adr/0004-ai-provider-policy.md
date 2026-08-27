# ADR 0004: AI Provider Policy

## Status

Accepted

## Decision

Use `MockAiProvider` in automated tests and Phase 0 UI. Defer OpenRouter until core schema, command, migration, validator, and review flows are stable.

## Context

AI calls may involve private schema data, user approval, API keys, OAuth, model pricing, and structured output failures.

## Consequences

- CI and local tests do not call external AI APIs.
- Paid fallback cannot happen accidentally.
- Provider contracts can be tested without credentials.
- OpenRouter work can focus on secure BYOK and free-model filtering later.
