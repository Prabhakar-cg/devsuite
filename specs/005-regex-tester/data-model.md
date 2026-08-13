# Phase 1 Data Model: Regex Tester

No persistence. No DevDB store (SPEC.md §6.4 does not list one for `/regex`); every entity below
is transient, in-memory JavaScript state scoped to the open browser tab.

## Entities

### Match *(`runMatch()`, `regex.html`)*
| Field | Type | Notes |
|-------|------|-------|
| `index` | `number` | 0-based character offset of the match start in the test string |
| `value` | `string` | the full matched substring (`m[0]`) |
| `groups` | `string[]` | numbered capture groups, `undefined` entries preserved for non-participating groups |
| `namedGroups` | `object` | `m.groups` if the pattern has named groups, else `{}` — **captured but never rendered** (spec.md Assumptions) |

### Flag Set *(`activeFlags`, a `Set<string>`)*
Subset of `{g, i, m, s}`; joined via `[...activeFlags].join('')` into the flags string passed to
`new RegExp(pattern, flags)`. `g` is active by default; the others start inactive.

### Decoration *(Monaco `IModelDeltaDecoration`, ephemeral)*
Derived 1:1 from `matches` on every `runMatch()` call — `{ range, options: { inlineClassName:
'regex-match-highlight' } }`. Replaced wholesale via `editor.deltaDecorations(decorations, newDecos)`
each run; never diffed incrementally.

## Error hierarchy

None — a compile failure is the raw `Error` thrown by `new RegExp(pattern, flags)`; only its
`.message` is surfaced (`r.error`), with no DevSuite-defined error type or code.

## No JSON envelope

This tool has no backend API surface (see [contracts/http-api.md](contracts/http-api.md)) — there
is no request/response envelope to document.
