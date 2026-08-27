# Excel-Compatible Keyboard Shortcuts

The table editor supports the Excel keyboard conventions that map to the approved
Game Schema Workbench feature set. Formula editing, formatting, comments, charts,
pivot tables, macros, and printing remain outside the product contract.

## Project history and persistence

| Shortcut | Action |
| --- | --- |
| `Ctrl+Z` | Undo the latest committed document command or transaction |
| `Ctrl+Y`, `Ctrl+Shift+Z` | Redo |
| `Ctrl+S` | Save and create a recovery checkpoint |

Undo and redo do not intercept native text editing inside a visible input,
textarea, select, or contenteditable control. Once a cell edit is committed,
the same shortcuts operate on the exact document snapshot.

## Workbook editing

| Shortcut | Action |
| --- | --- |
| `Ctrl+A` | First press selects the used range; a second press selects the displayed workbook grid |
| `Ctrl+C`, `Ctrl+X`, `Ctrl+V` | Copy, data-only cut, and paste |
| `Ctrl+Alt+V` | Open data-only Paste Special with Transpose and Skip Blanks |
| `Ctrl+F`, `Ctrl+H` | Find and replace |
| `Ctrl+G` | Go to an Excel address such as `A100000` |
| `F2` | Edit the active cell while preserving its value |
| `Delete`, `Backspace` | Clear selected data cells |
| `Escape` | Cancel the cut marker or dismiss the current grid error |
| `Enter`, `Shift+Enter` | Move down or up |
| `Tab`, `Shift+Tab` | Move right or left |
| Arrow keys | Move one cell |
| `Shift` + Arrow keys | Extend the selection |
| `Home`, `End` | Move to the first or last authored column in the row |
| `Ctrl+Home`, `Ctrl+End` | Move to A1 or the last used data cell |
| `Ctrl` + Arrow keys | Move to the corresponding used-range edge |
| `PageUp`, `PageDown` | Move by one visible page |
| `Ctrl+Space` | Select the active column |
| `Shift+Space` | Select the active row |
| `Ctrl+D` | Fill the selected range down from its top row |
| `Ctrl+R` | Fill the selected range right from its left column |
| `Ctrl+PageUp`, `Ctrl+PageDown` | Move to the previous or next table sheet |

Schema row 1 remains protected. A1 is a column name, PK/FK badges remain schema
metadata, and shortcuts never turn row 1 into a `DataRow`.

The fill handle supports all four directions. The toolbar switches between
series projection and source-pattern copy; holding `Ctrl` while dragging
temporarily requests copy mode. Enum, Boolean, and single-column FK values are
offered as suggestions rather than hard locks. Invalid data is committed and
marked by validation so designers can continue authoring, while structural
schema changes still use typed Commands and review.
