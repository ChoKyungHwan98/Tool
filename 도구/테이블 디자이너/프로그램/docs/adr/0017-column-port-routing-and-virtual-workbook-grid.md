# ADR 0017: Column-Port Routing and Virtual Workbook Grid

- Status: Accepted
- Date: 2026-07-17

## Context

The schema map connected relations at table-level handles, so an FK line could not reliably communicate which source column referenced which target key. The workbook rendered only authored cells, leaving the remaining editor surface as a blank white canvas. Extending that canvas by creating real rows or columns would have polluted the normalized authoring document and runtime exports.

## Decision

- ELK layout input uses east/west ports derived from the rendered vertical position of each participating column.
- Single-column FKs connect their exact source and target ports. Composite FKs remain one relation and use the midpoint of their participating column group.
- Multiple single-column FKs may share a referenced key. Their target handles use stable relation-ID-ordered slots inside that key's rendered row so arrowheads remain distinguishable without entering a neighboring row. The preferred slot gap is 8px and the complete slot span is capped at 18px.
- ELK keeps fixed port sides, model-order port sorting, orthogonal routing, and crossing minimization.
- Rendered routes use the worker batch provider from `@tisoap/react-flow-smart-edge@4.13.0`. Dragging uses a lightweight preview; dropping recomputes obstacle-aware routes.
- Schema nodes publish the same measured width and height used by the card renderer. The smart-edge worker must receive these dimensions so its obstacle map matches the visible table rectangles.
- When source and target ports differ vertically by at most 12px across a gap of at least 64px, an obstacle-free centered orthogonal correction replaces a worker-generated endpoint hook. This keeps at least 24px of horizontal lead on each side.
- Route geometry is derived presentation state. Only table positions persist through typed `MoveTableLayoutCommand` and `MoveTablesLayoutCommand` operations.
- Pressing automatic layout is an explicit full-layout reset, so previously dragged tables are included rather than treated as permanently pinned.
- The resulting positions are stored by one `MoveTablesLayoutCommand`; one Undo restores the entire previous arrangement.
- Browser ELK execution uses an explicit native `Worker` factory. Automatic layout has an 8-second calculation limit, invalidates stale runs after project changes or unmount, and always terminates its worker through a guarded cleanup path.
- Fit View is part of the layout operation, but a non-settling animated fit may not hold the UI in `running`. It has a 1.6-second limit followed by an instant-fit fallback, after which the command returns to an idle state.
- The map permanently shows PK and FK only. Referenced-target state remains available for impact analysis, but the canvas does not draw a full-height target stripe that can merge visually with the arrow.
- Relation arrows always point from the FK column to the referenced PK or unique-key column. This is a reference direction, not a runtime data-flow direction.
- In `전체`, every valid relation keeps its stable relation color even when a table is selected; the selected table's direct relations rise to 2.6px and full opacity while the remaining relations stay visible at the normal 1.6px hierarchy.
- In `현재 테이블` and `연결 경로`, focused relations keep their stable colors at 2.6px and full opacity while unrelated valid relations remain as neutral gray context at 1.2px and 14% opacity. Hovering or pinning one relation raises it to 3.2px and reduces other valid relations to 10%; invalid relations remain red dashed lines.
- Stored and live orthogonal routes snap to each relation's exact target handle. Tiny terminal hooks are removed, two-point diagonal routes are normalized to orthogonal center bends, and bridge marks keep a 24px clearance from both endpoints. The last segment approaches the key horizontally and the closed arrow marker uses an 8px footprint.
- Hovering a relation shows its complete `Source.Column (FK) -> Target.Column (PK)` descriptor. Clicking or pressing Enter pins the descriptor; canvas click or Escape closes it. Only the participating FK and target-key rows receive a temporary background highlight.
- The workbook computes display-only rows and columns from `ResizeObserver` viewport metrics.
- Exactly one row after the stored data and one column after the authored schema are editable append targets. All farther cells are display-only but remain selectable.
- Cells, row numbers, column letters, and the corner selector participate in one Excel-style rectangular pointer selection model across authored, append, and display-only regions.
- Pointer selection never creates rows or columns. Only confirmed input into the append row or append column crosses the store boundary and executes a typed Command.
- Entering the append row executes `InsertRowsCommand` with initial cells. Naming the append column executes `AddColumnCommand` as a nullable string column.
- Display-only cells never become `DataRow`, schema columns, validation inputs, CSV fields, runtime output, or lineage.

## Consequences

- Relation direction and participating columns remain legible after automatic layout and table movement.
- Empty and small tables retain an Excel-like working surface without creating an infinite schema.
- Undo removes a newly appended row or column as one document command.
- The smart-edge worker and ELK worker increase the current JavaScript bundle footprint. Lazy loading remains a separate performance task.

## Verification

- `src/presentation/schemaLayout.test.ts` covers stable exact ports and composite midpoint ports.
- `src/presentation/components/SmartRelationEdge.test.ts` covers route deduplication, centered near-aligned routing, obstacle fallback, and bridge construction.
- `src/presentation/gridTypes.test.ts` covers viewport-derived display metrics.
- `src/presentation/gridTypes.test.ts` also covers pointer hit-testing for authored, append, and display-only cells and headers.
- `e2e/structure-grid-cleanup-audit.spec.ts` covers persistent UI cleanup, exact FK starts, obstacle avoidance, append row/column creation, and exact Undo.
- The same E2E suite verifies that the Game C `MonsterDrop.ItemId -> Item.ItemId` and `ShopItem.ItemId -> Item.ItemId` target handles remain inside the `ItemId` row, use stable `-4px/+4px` slots, and receive their rendered SVG endpoints within 8px.
- `e2e/auto-layout-regression.spec.ts` drags a table out of place, verifies full rearrangement, checks relation contrast and canvas containment, and verifies one-step Undo/Redo.
- `src/presentation/autoLayoutLifecycle.test.ts` covers layout/fit time limits and cleanup failures.
- `src/domain/gameDComplexProject.test.ts` validates the 25-table, 36-relation stress schema, while `e2e/complex-auto-layout.spec.ts` verifies state recovery, no card overlap, no unrelated-card route intersections, canvas containment, exact target-handle arrival for all 36 paths, and 36 worker-routed paths at 1280x720.
- `src/presentation/relationPresentation.test.ts` covers relation descriptors, visual-state styling, and canvas-bound popover placement.
- `e2e/relation-readability.spec.ts` covers direct/unrelated hierarchy, hover and pinned descriptors, keyboard interaction, exact FK-to-PK endpoints, row highlighting, command wording, and popover containment at 1280x720, 1440x900, and 1920x1080.
- `e2e/grid-drag-selection.spec.ts` covers drag selection from authored cells into display-only rows and columns and verifies that table row/column counts remain unchanged.
- Existing 10,000-row command and workbook operation tests remain the performance regression baseline.
