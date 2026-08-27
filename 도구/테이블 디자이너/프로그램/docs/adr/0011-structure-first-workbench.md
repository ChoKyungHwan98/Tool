# ADR 0011: Structure-First Workbench

## Status

Accepted and implemented

## Context

Game designers need to understand the complete PK/FK model before editing individual properties or rows. The previous shell mixed runtime output, property inspection, schema editing, and AI review across competing panels.

## Decision

- Open every project in the full structure map.
- Keep three center views: `schema`, `data`, and `design`.
- Reserve the right panel for AI conversation and linked findings.
- Move table and column settings into the center design view.
- Move runtime output into a reviewed export drawer.
- Use asynchronous ELK layout, semantic zoom, exact column handles, and Command-backed pinned positions.

## Consequences

- The structure map remains the primary orientation surface.
- A 360–640px AI panel reduces center width, so responsive overlap tests are mandatory.
- ELK and React Flow increase bundle size and must be lazy-loaded in a later optimization pass.
