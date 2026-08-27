# UX Reset Gate Proposal

> Historical approval artifact. Superseded by the implemented UX redesign Gates 1–5 and ADR 0011. Statements below describe the pre-redesign UI and are not current behavior.

## Scope

Foundation Repair Gate 0 and Gate 1 are preserved. This proposal does not change the main React UI, domain model, `WorkbenchDocument`, ColumnId-keyed row storage, persistence format, validator, or runtime export code.

The current work is an approval artifact only: audit notes, two UX directions, local proposal images, and a Figma proposal page.

## Current UI Audit

Observed from the running app and source:

- The Schema view is closer to a generated ERD viewer than a table-design tool.
- `SchemaCanvas` sets `nodesDraggable={false}`, so tables cannot be freely moved.
- Table and column names are not editable inside the table node.
- FK handles exist visually, but drag-to-connect relation creation is not implemented.
- Common authoring actions such as New Table, Add Column from the canvas, duplicate, delete, and reorder are not top-level workflows.
- Data editing exists, but spreadsheet workflows are thin: no multi-cell paste, row duplicate/delete, sorting, filtering, or keyboard-first movement.
- CSV import/export exists in Data view, but it is not presented as a primary workflow from Structure view.
- Project JSON save is exposed as a primary File action even though normal users mainly need CSV and runtime outputs.
- Bottom panels are always structurally present and consume attention even when there are no problems or pending changes.
- Korean UI text is currently corrupted in several visible labels, which makes the app harder to evaluate as a Korean tool.

## Menu Behavior Audit

- File: currently saves WorkbenchDocument JSON directly.
- Edit: currently maps to Undo only; copy, paste, duplicate, delete, search are not real menu items.
- View, Schema, Data, Export: mostly mode switches, not full menus.
- Validate: opens Problems panel.
- AI: opens AI panel.
- Toolbar Save works.
- Toolbar Search has no click handler.
- Toolbar Mock AI icon has no click handler.

Recommendation: remove non-functional menu labels until implemented, and move JSON into Advanced.

## Task-Time Estimate

- Create a table from scratch: currently not directly possible from the UI.
- Modify an existing column: possible through Inspector, but not discoverable from the table node.
- Create FK by drag: not available.
- Edit data: possible after switching Data mode, but not spreadsheet-complete.
- Import CSV: available inside Data mode, but not guided and not exposed as a primary entry point.
- Export selected table CSV: available inside Data mode.
- Export runtime CSV: available in Runtime mode.

## Proposal Images

Local proposal images are generated under:

- `design/ux-reset/screenshots/structure-a.png`
- `design/ux-reset/screenshots/structure-b.png`
- `design/ux-reset/screenshots/data-a.png`
- `design/ux-reset/screenshots/data-b.png`
- `design/ux-reset/screenshots/csv-a.png`
- `design/ux-reset/screenshots/csv-b.png`

Static prototype source:

- `design/ux-reset/proposal.html`

Current app audit screenshot:

- `design/ux-reset/screenshots/current-schema-workspace.png`

Figma proposal page:

- `https://www.figma.com/design/iE1m0ORKg58sddU7cWoY70`
- Page name: `UX Reset Gate Proposal`
- Figma frame count: 6

## Alternative A

### 특징

- Three primary modes: Structure Design, Data Edit, Runtime Export.
- Always-visible action ribbon: New Table, CSV Import, Undo, Redo, Validate, AI Review, CSV Export.
- Three-pane Structure screen: Project Explorer, ERD canvas, Inspector.
- Table nodes support inline editing and a permanent `+ Column` row.
- Bottom panel stays collapsed unless problems, changes, or review content exists.
- Data Edit is an Excel-like single-table grid optimized for density and keyboard work.
- CSV Import uses a four-step wizard: file/target, header mapping, preview, apply.

### 장점

- Lowest learning cost for game designers.
- Clear first-use path: create table, add columns, enter data, export CSV.
- Keeps Inspector for advanced properties without making it the main editing path.
- Better fit for current architecture because it can be implemented incrementally.
- Makes CSV a primary workflow while keeping JSON in Advanced.

### 단점

- Less immersive for very large ERDs than a full canvas-first interface.
- Requires careful canvas/table-node interaction design to avoid crowding.
- Spreadsheet completeness still requires dedicated grid work.

## Alternative B

### 특징

- Canvas-first layout with a floating command dock.
- Inspector becomes a contextual rail.
- Data Edit can split schema context and row grid side by side.
- CSV Import can be a full import workspace for large imports and schema inference.

### 장점

- Stronger for large schema navigation and visual modeling.
- Good for advanced users who already understand ERD workflows.
- Full import workspace can handle complex CSV decisions cleanly.

### 단점

- More complex first-use experience.
- Lower row density in split data mode.
- Larger implementation cost and higher interaction risk.
- Floating controls can hide core actions from beginners.

## Recommended Direction

Choose Alternative A as the next implementation target.

Reasons:

- It best matches the stated product model: Excel speed, ERD structure awareness, and IDE safety.
- It exposes the real primary workflows directly: New Table, CSV Import, Data Edit, Runtime CSV Export.
- It can preserve the Foundation Repair model without adding risky state shortcuts.
- It allows incremental delivery: first action ribbon and canvas movement, then inline table editing, then data-grid upgrades, then CSV wizard.

Borrow from Alternative B later:

- Minimap and relation focus for large schemas.
- Full CSV Import Workspace only after the simple wizard proves insufficient.

## Implementation Gate After Approval

Do not start implementation until the user approves a direction.

Suggested implementation order after approval:

1. Replace menu strip with real working actions and mode tabs.
2. Enable table dragging and persist layout positions through commands.
3. Add canvas-level New Table and inline table/column editing through typed commands.
4. Add FK drag preview and command-backed relation creation.
5. Upgrade Data Edit grid workflows.
6. Add CSV Import wizard.
7. Add E2E scenarios for table creation, FK creation, CSV import, and rename data safety.

## Verification Required After Future Implementation

- Existing Foundation Repair tests must continue to pass.
- New E2E scenarios must cover first table creation, FK creation, CSV import, and rename safety.
- No UI component may mutate schema directly.
- Row data must remain ColumnId-keyed.
