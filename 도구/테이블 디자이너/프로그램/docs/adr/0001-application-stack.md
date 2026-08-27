# ADR 0001: Application Stack

## Status

Accepted

## Decision

Use Tauri 2, React, TypeScript, Vite, Rust backend, Vitest, and Playwright.

## Context

The product is a desktop IDE for game data design. It needs a rich UI, local file access, future OS credential storage, and no mandatory hosted backend.

## Consequences

- React and TypeScript support complex workbench UI with strong contracts.
- Tauri keeps the desktop shell light and gives a Rust backend for credentials and file operations.
- Domain logic remains TypeScript in Phase 0 for fast iteration and unit testing.
- Rust code is reserved for platform adapters and security-sensitive operations.
