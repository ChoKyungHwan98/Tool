# FK to PK Relation Readability QA

- Date: 2026-07-17
- Scope: FK-to-PK direction, selected-table relation hierarchy, relation descriptor interaction, target-row accuracy
- Real OpenRouter requests: not executed

## Gate 0 Audit

The audit was added before implementation. Game C initially reproduced two expected failures: unrelated relations remained at 72% opacity, and a relation line did not expose its complete FK and PK paths. The coordinate audit already passed, confirming that the rendered path started at the FK handle and ended at the PK handle before visual polishing began.

## Visual Contract

- Arrow direction is `FK -> PK/unique key`. It answers "which key does this FK reference?" and does not represent runtime data flow.
- A selected table's direct valid relations retain their stable relation colors, 2.6px width, and full opacity.
- Unrelated valid relations use neutral gray, 1.2px width, and 14% opacity.
- A hovered or pinned relation uses 3.2px width and full opacity; other valid relations fall to 10%.
- Invalid relations remain red dashed lines regardless of selection.
- Only the active relation's participating FK and target-key rows receive a light temporary background.
- The relation descriptor reads `Source.Column (FK) -> Target.Column (PK)` followed by `대상 키를 참조합니다.` Composite relations list their grouped columns.

## Interaction QA

- Hover shows a transient descriptor at the actual SVG path midpoint.
- Click pins the descriptor even after the pointer leaves the line.
- Escape and a blank-canvas click close the pinned descriptor.
- Focusing an edge and pressing Enter pins the same descriptor.
- The descriptor is clamped inside the React Flow canvas at 1280x720, 1440x900, and 1920x1080.
- Scope commands are `전체 | 현재 테이블 | 연결 경로`, with longer explanations in tooltips.

Direct in-app-browser QA opened Game C, clicked the visible Item-to-ItemType route, and confirmed that the pinned descriptor appeared without a console error. The automated hover test moves to an actual point on the orthogonal SVG path rather than the empty center of its bounding box.

## Layout and Endpoint Regression

- Game C's `Item.ItemTypeId (FK) -> ItemType.ItemTypeId (PK)` source and target handles remain aligned with the rendered route.
- Game D automatic layout finishes with 25 nodes, 36 worker-routed relations, zero card overlaps, zero unrelated-card route intersections, and no nodes outside the canvas.
- All 36 Game D path endpoints remain within 1px of their referenced target-row centers.
- The visual hierarchy does not alter domain relations, persisted layout positions, Command data, or worker-generated route geometry.

Evidence: `design/screenshots/relation-readability-1440x900.png` and `design/screenshots/game-d-auto-layout-1280x720.png`.

## Final Automated Results

- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm run test:run`: 148/148 pass across 35 files
- `npm run e2e`: 50/50 Chromium scenarios pass
- `npm run build`: pass; existing chunks-over-500k warning remains
- `cargo check`: pass
- `npm audit --audit-level=high`: 0 vulnerabilities
- `cargo audit`: unavailable because `cargo-audit` is not installed

No real OpenRouter call, paid model call, or private row-data transmission occurred during this Gate.
