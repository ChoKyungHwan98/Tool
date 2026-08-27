# ADR 0016: Responsive Workbench Polishing

- Status: Accepted
- Date: 2026-07-16

## Context

The workbench accumulated multiple historical responsive layouts and a single CSS file of roughly 5,000 lines. At 1024px the fixed explorer and AI panel left too little room for the schema map and workbook. The AI provider switch remained in the conversation surface, the collapsed assistant state did not affect layout, and the relations designer pushed active commands below a 720px viewport.

## Decision

- The layout has three contracts: wide at 1600px and above, standard from 1280px to 1599px, and compact below 1280px.
- Wide uses a 248px explorer and a 420px default assistant. Standard uses 232px and 360px.
- Compact keeps 48px rails on both sides. Opening one panel overlays the center and closes the other overlay.
- Explicit `setExplorerCollapsed` and `setAssistantCollapsed` actions replace tests and flows that depended only on toggles.
- The AI provider and model controls live inside connection settings. The conversation starts with table, relation, and normalization review actions.
- The minimum visible schema metadata font size is 11px. Product surfaces use neutral backgrounds and borders instead of decorative gradients.
- Column commands are grouped as Edit, Sort/Filter, Structure, and Display, with internal menu scrolling.
- CSS is split into tokens and feature-oriented segments. Historical media queries are removed; the final responsive contract is defined in three media blocks.
- `DataGridView` delegates the value bar, virtual viewport/IME capture, and column menu to focused presentation components. Domain storage and Command contracts do not change.

## Consequences

- A 1024×720 workbench keeps at least 800px for the center while both rails are closed.
- The relations designer keeps PK, FK mapping, current relations, and active apply commands visible at compact width.
- Panel state is deterministic in unit and E2E tests.
- The existing build-size warning remains. Code splitting is a separate performance Gate.

## Verification

- `e2e/polish-audit.spec.ts` fixes the audit failures for compact rails, AI settings isolation, short-height design, grouped menus, and schema typography.
- `e2e/responsive.spec.ts` records structure, workbook, basic design, and relation design at 1024×720, 1280×720, 1440×900, and 1920×1080.
- The complete Vitest, Playwright, TypeScript, lint, frontend build, Rust check, and npm audit suites are required before completion.
