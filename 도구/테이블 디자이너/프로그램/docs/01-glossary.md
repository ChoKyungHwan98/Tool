# Glossary

| Term | Meaning |
| --- | --- |
| Authoring Schema | Normalized source model edited by designers. |
| Runtime Export | CSV or JSON generated for the game runtime. |
| Command | Typed schema change with validation, impact preview, execution, and undo. |
| TableId | Immutable internal table ID. Names can change without breaking references. |
| ColumnId | Immutable internal column ID. CSV headers are not stable identifiers. |
| hard_fk | Required foreign key relation to another table. |
| soft_ref | Reference that may not be enforced at runtime. |
| Functional Dependency | Rule that one set of columns determines another set of columns. |
| Migration | Safe plan for changing schema when existing rows already exist. |
| Change Review | Human approval surface before applying AI proposals or destructive commands. |
