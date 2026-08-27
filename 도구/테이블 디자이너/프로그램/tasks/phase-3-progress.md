# Phase 3 Progress

Implemented command types:

- [x] `CreateTable`
- [x] `DeleteTable`
- [x] `RenameTable`
- [x] `AddColumn`
- [x] `DeleteColumn`
- [x] `RenameColumn`
- [x] `ChangeColumnType`
- [x] `ChangeNullable`
- [x] `ChangePrimaryKey`
- [x] `AddForeignKey`
- [x] `DeleteForeignKey`
- [x] `AddUniqueConstraint`
- [x] `AddCheckConstraint`
- [x] `AddFunctionalDependency`

Remaining command types from the master list:

- [x] `SplitTable`
- [x] `MergeTable`
- [x] `ExtractLookupTable`
- [x] `CreateJunctionTable`
- [x] `AddSurrogateKey`
- [x] `BackfillColumn`
- [x] `CreateExportView`
- [x] `ModifyExportView`

Notes:

- Destructive commands now require approval metadata before execution.
- Undo metadata is materialized per command, not by blind project snapshot replacement.
- UI-specific approval screens are still future work, but the domain commands already enforce approval metadata.
