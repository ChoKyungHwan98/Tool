# Command Model

Every schema change is represented as a typed Command.

## Minimum Interface

```ts
interface SchemaCommand {
  validate(project): CommandValidation;
  describe(project): string;
  describeImpact(project): ImpactReport;
  preview(project): SchemaProject;
  execute(project): SchemaProject;
  undo(project): SchemaProject;
  serialize(): SerializedCommand;
}
```

## Implemented in Phase 0

- `RenameColumn`
- `ChangeNullable`
- `AddColumn`

## Implemented After Phase 2

- `CreateTable`
- `DeleteTable`
- `RenameTable`
- `DeleteColumn`
- `ChangeColumnType`
- `ChangePrimaryKey`
- `AddForeignKey`
- `DeleteForeignKey`
- `AddUniqueConstraint`
- `AddCheckConstraint`
- `AddFunctionalDependency`
- `SplitTable`
- `MergeTable`
- `ExtractLookupTable`
- `CreateJunctionTable`
- `AddSurrogateKey`
- `BackfillColumn`
- `CreateExportView`
- `ModifyExportView`

## Rules

- Commands must validate before execution.
- Blocking validator issues prevent execution.
- Undo uses command-level inverse data, not arbitrary UI mutation.
- Destructive Commands require approval metadata before execution.
- Split, merge, lookup extraction, junction creation, surrogate key, and export-view edits are represented as Commands before any UI workflow can apply them.
