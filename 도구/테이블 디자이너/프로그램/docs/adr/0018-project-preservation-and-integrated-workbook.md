# ADR 0018: Project Preservation and Integrated Workbook

- Status: Accepted
- Date: 2026-07-17

## Context

The workbench previously described every project as `로컬 보관`, but the label did not prove that a revision had reached durable storage. Browser projects were coupled to synchronous `localStorage`, normal document Commands did not consistently trigger persistence, and the dashboard mixed user projects with samples. Export also lacked one review-friendly Excel workbook containing schema descriptions, a diagram, and table data.

## Decision

- Project persistence is an asynchronous application boundary named `ProjectRepository`; React components and the Zustand store do not access a storage API directly.
- Browser development stores projects in IndexedDB transactions. Valid legacy `localStorage` documents are copied on first access and the original is retained until migration success is independently confirmed.
- Tauri stores each project under the application data directory with a current `.gsw`, manifest checksum, recovery directory, and trash directory.
- Native writes use a temporary file, `sync_all`, parse and checksum verification, and rename-based replacement. A linked external `.gsw` is checked for an unexpected checksum before it is overwritten.
- Project changes mark the document dirty immediately. A 600ms idle window serializes the document in a worker and queues saves in order. Explicit save, dashboard return, and application close flush the queue.
- The visible state is `변경됨`, `저장 중`, `저장됨 · HH:MM`, `저장 실패`, or `복구됨`. `저장됨` is emitted only after persistence and checksum verification succeed.
- Recovery points are created at explicit checkpoints, at most every five minutes for ordinary work, and before reviewed destructive changes. Retention is 30 points and 30 days. Deleted projects remain in trash for 30 days.
- The app library remains the safety copy when a project is linked to an external `.gsw`. A checksum conflict is never overwritten silently; the user chooses reload or copy-save.
- Table and column descriptions change through typed Commands so immutable IDs and relations remain stable.
- The default export is a deterministic integrated workbook: description/specification, deterministic ELK diagram image, then one data sheet per project table. Workbook generation is lazy and worker-backed.
- Integrated data sheets reserve row 1 for 칼럼명, row 2 for 자료형, and row 3 onward for stored records. The first two rows are frozen, and every populated row uses a compact 15pt height with centered content. AutoFilter is deliberately omitted because a filter beginning above the 자료형 row would treat schema metadata as user data.
- The documentation and diagram worksheet tabs use the product navy and teal respectively; data sheets remain visually neutral apart from existing PK/FK header semantics.
- Functional-dependency data remains part of validation, but the product language is `정규화 규칙` and it appears only in advanced validation. It is not a permanent schema-summary counter.

## Consequences

- A storage label now describes an actual repository location, while the project header reports the verified revision state.
- Browser and native storage implementations can be tested independently through the same contract.
- External file conflict detection is optimistic checksum concurrency, not an operating-system file lock. A later packaging Gate must still exercise process termination, disk-full behavior, permissions, and recovery on installed binaries.
- Recovery and trash consume bounded local disk space but do not transmit project data to a cloud service.
- Excel generation and diagram rendering increase lazy chunk size without blocking ordinary editor startup.

## Verification

- `src/infrastructure/indexedDbProjectRepository.test.ts` covers verified save/load, legacy migration, corruption recovery, retention, trash, and restore.
- `src/presentation/state/workbenchStore.autosave.test.ts` covers dirty state, debounced autosave, sequential persistence, retry, and checkpoint behavior.
- `src/application/workbookExport.test.ts` reopens generated workbooks and checks sheet order, descriptions, deterministic layout, styles, types, and stable names.
- Playwright persistence and responsive audits cover the dashboard, real save-state wording, project menus, workbench header, and export surface.
- Rust compilation verifies the Tauri command boundary. Installed-package crash and disk-failure QA remains explicitly pending.
- Rust storage tests verify Windows-compatible atomic replacement, invalid-write preservation, bounded recovery retention, and path-safe project storage keys.
- A Tauri debug package build produces both MSI and NSIS bundles; installed-process failure injection remains a separate verification boundary.
