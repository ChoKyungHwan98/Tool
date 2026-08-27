# Presentation component layout

- `workbook/`: Excel-like table authoring surface. `DataGridView` coordinates commands and state, while the cell editor, paste dialog, virtual grid, menus, and pure view-model calculations live in focused modules.
- `designer/`: table metadata, column, primary-key, and foreign-key editing surface.
- `dashboard/`: project-library and sample-project surfaces.
- Root files: application shell and cross-feature overlays only.

`DataGridView.tsx`, `TableDesignerView.tsx`, and `TableContextMenu.tsx` at the root are compatibility entry points. New code should import the feature folder or its `index.ts` directly. This foldering changes presentation ownership only; schema objects still change exclusively through typed workbench commands.
