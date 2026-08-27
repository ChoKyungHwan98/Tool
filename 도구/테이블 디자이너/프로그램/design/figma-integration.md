# Figma Integration

## Target Screens

- `SchemaWorkspace`
- `ChangeReviewDialog`
- `MigrationWizard`

## Component Names

- `ProjectExplorer`
- `SchemaCanvas`
- `TableNode`
- `ColumnRow`
- `ColumnInspector`
- `ProblemsPanel`
- `ChangeReviewDialog`
- `MigrationWizard`
- `AiReviewPanel`
- `RuntimeExportView`

## Current Status

Figma MCP access is connected. A new design file was created for Phase 0:

https://www.figma.com/design/iE1m0ORKg58sddU7cWoY70

Created frames:

- `SchemaWorkspace`
- `ChangeReviewDialog`
- `MigrationWizard`

The current Figma work is a structural wireframe. The code-first UI remains the implementation source until screenshots and component details are synced in a later pass.

## Phase 1 Code Reference

The implemented Schema Workspace now uses an Excel-style full structure map:

- Compact table cards.
- Colored table headers.
- PK/FK/REF badges.
- Column-level relation arrows.
- Reference legend.

Reference screenshot:

`design/screenshots/schema-workspace-phase1.png`
