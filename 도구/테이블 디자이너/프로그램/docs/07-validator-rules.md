# Validator Rules

## Severity

- `info`: useful note.
- `warning`: risky but allowed.
- `error`: invalid output or likely user mistake.
- `blocking`: command execution must stop.

## Implemented Schema Rules

- Duplicate table names.
- Duplicate column names.
- Duplicate internal table, column, relation, enum, and export-view IDs.
- Column `tableId` mismatch with its parent table.
- Missing primary key.
- Primary key references missing columns.
- Primary-key columns that allow blanks.
- Unique constraint references missing columns.
- Check constraint references missing columns.
- Impossible column range rules.
- FK table or column missing.
- Composite FK width mismatch.
- FK source/target type mismatch.
- Hard FK cycle warning.
- Enum reference missing.
- Export source missing.
- Export header collision.
- Repeated column pattern warning.
- Partial-key dependency warning for composite keys.
- Transitive dependency warning for non-key determinants.

## Implemented Row Rules

- Required cell blank.
- Cell value incompatible with the column type.
- Column validation-rule failure: `not_null`, `min`, `max`, `range`, `regex`, `one_of`.
- Unknown row field not present in the schema.
- Blank primary-key values.
- Duplicate primary keys.
- Duplicate unique constraints.
- Required FK value blank.
- Orphan FK when both source and target table rows are loaded.
- Functional dependency conflicts in loaded row data.

AI findings can never override blocking validator results.
