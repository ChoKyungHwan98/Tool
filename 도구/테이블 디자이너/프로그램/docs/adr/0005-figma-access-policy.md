# ADR 0005: Figma Access Policy

## Status

Accepted

## Decision

Attempt Figma MCP discovery, but do not modify existing important Figma files without user approval. If account access is blocked, continue with code-first UI and record the limitation in `STATUS.md`.

## Context

The master instruction asks for Figma work, but OAuth and file permissions may require user action.

## Consequences

- Figma is not a blocker for Phase 0 code implementation.
- Generated UI can be captured or recreated in Figma later.
- All Figma limitations must be visible in status reporting.
