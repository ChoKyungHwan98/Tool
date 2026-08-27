# Schema Relation and Virtual Grid Selection QA

- Date: 2026-07-20
- Scope: schema relation hierarchy, automatic-layout endpoints, arrow marker sizing, Excel-style virtual-grid selection
- Browser baseline: Chromium at `http://127.0.0.1:5173/`

## Product Contract

- `전체` keeps every valid relation in its stable color. Selecting a table strengthens only its direct relations and does not hide or gray the remaining project structure.
- `현재 테이블` and `연결 경로` preserve the complete context but dim unrelated valid relations to neutral gray.
- FK arrows terminate at stable relation-specific slots inside the exact target-key row through a horizontal final segment. Shared targets remain visually separate, and the marker footprint is 8px.
- Authored, append, and display-only cells can participate in one rectangular pointer selection.
- Selecting empty display cells never persists rows or schema columns. Confirmed input continues to use typed Commands.

## Automated Verification

- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm run test:run`: passed, 44 files / 196 tests
- `npm run e2e`: passed, 52 tests
- `npm run build`: passed
- `cargo check`: passed

The production build still reports the existing large-chunk and ineffective dynamic-import warnings for the workbook/ELK bundles. No new build error was introduced.

## Direct Browser QA

1. Opened Game C and inspected all five relations.
2. In `전체`, verified one selected-table relation group as active and the remaining valid relations as normally colored, with no dimmed relations.
3. In `현재 테이블`, verified three direct relations as active and two unrelated relations as neutral gray context.
4. Ran automatic layout and verified five stored ELK routes, horizontal target approaches, 8px markers, and no table outside the canvas.
5. Verified that `MonsterDrop.ItemId` and `ShopItem.ItemId` arrive at stable `-4px/+4px` target slots inside the same `Item.ItemId` row, with no merged arrowhead.
6. Opened the ItemType workbook and dragged from the append row into display-only rows and columns.
7. Verified the resulting rectangular selection while the document remained `2열 · 2행`.
8. Collected browser errors after the scenarios: none.

## Result

The relation modes support both whole-project color scanning and focused gray-context reading. Relations that share one referenced key retain separate target slots without changing their FK target. The workbook allows Excel-like selection across its visible empty surface without turning that surface into persisted game data.

No OpenRouter request or paid service was used during QA.
