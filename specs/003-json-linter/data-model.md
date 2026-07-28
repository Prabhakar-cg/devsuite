# Phase 1 Data Model: JSON Linter & Formatter

No persistence layer. All state is in-memory JS state inside `static/json.html`'s inline
script — nothing survives a page reload, and no DevDB store is used.

## Entities

### Input Document *(writable Monaco model)*
| Field | Type | Notes |
|-------|------|-------|
| `value` | `string` | raw text the user typed/pasted; only source of truth for input |

### Output Document *(read-only Monaco model, `outputModel`)*
| Field | Type | Notes |
|-------|------|-------|
| `value` | `string` | last-produced transform result |
| `language` | `"json" \| "yaml"` | switched by `monaco.editor.setModelLanguage()` depending on which action produced it |
| `label` | `string` | UI label shown above the pane ("Formatted (2-space indent)", "Minified", "Sorted Keys", "YAML (Converted)", "Validated — Preview") |

### Validation State
| Field | Type | Notes |
|-------|------|-------|
| `status` | `"idle" \| "valid" \| "invalid"` | drives the status pill's class + text |
| `errorMessage` | `string \| null` | the caught `SyntaxError`'s message, shown verbatim |
| `errorHint` | `string \| null` | a short static hint string, varies per action ("Fix the error above and re-validate", etc.) |

## Notes

- No enumerations beyond the tri-state validation status above.
- No error hierarchy — `parseJson()` returns a `{ok, data}` or `{ok, error}` result object
  rather than throwing across module boundaries; callers branch on `.ok`.
- No JSON envelope — there is no backend response shape for this tool's core logic (only
  the page itself is served by the backend).
