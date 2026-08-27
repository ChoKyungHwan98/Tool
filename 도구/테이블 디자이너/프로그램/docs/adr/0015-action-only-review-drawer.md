# ADR 0015: Action-Only Review Drawer

- Status: Accepted
- Date: 2026-07-16

## Context

The workbench bottom panel exposed Problems, Change Review, Migration, and History as equal tabs. This made internal implementation concepts look like primary game-design workflows, reduced the workbook viewport, and reopened a large panel after ordinary edits. In particular, a standalone Migration tab generated candidate plans without a pending schema change, so users could not tell why the feature existed.

## Decision

- The bottom drawer contains only Problems and Change Review and is closed by default.
- Validation may open Problems, and a risky typed Command or document transaction may open Change Review.
- Applying or canceling a pending review closes the drawer.
- The migration engine remains in the application layer. It is not a primary navigation surface.
- A relevant migration is presented inside Change Review as a collapsed Data Conversion Plan tied to the pending command.
- Type changes, required-value changes, split/merge operations, and backfills may produce conversion plans. Unrelated selections do not.
- Command history moves to a compact top-toolbar popover beside Undo/Redo and no longer opens the bottom drawer.
- AI conversations and review remain in the dedicated right panel.

## Consequences

- The workbook and structure map retain more vertical space during normal work.
- Users see migration details only when those details answer an immediate approval question.
- Migration remains testable, reversible application logic without being presented as unexplained product navigation.
- History remains accessible without competing with Problems and Change Review.
- Future bottom-drawer tabs require a new product-contract decision rather than being added as implementation shortcuts.

## Verification

- Store tests verify that canceling or applying a pending review closes the drawer.
- Migration tests verify the required-column conversion plan and rollback metadata.
- Playwright verifies the two-tab drawer, contextual conversion plan, closed state after cancel, normal row editing without drawer reopening, and toolbar history content.
- Direct Chrome QA verifies the same flow in the running application.
