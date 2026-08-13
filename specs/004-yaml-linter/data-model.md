# Phase 1 Data Model: YAML Linter & Validator

No persistence. This tool has no DevDB store (SPEC.md §6.4 does not list one for `/yaml`) and no
backend state — every entity below is transient, in-memory JavaScript state scoped to the open
browser tab and discarded on reload.

## Entities

### Parsed Document *(`yaml.html` inline script)*
| Field | Type | Notes |
|-------|------|-------|
| value | `object \| array \| scalar` | result of `jsyaml.loadAll`; array only when the input has multiple `---`-separated documents |

### Validation Result *(`parseYaml()` return value)*
| Field | Type | Notes |
|-------|------|-------|
| `ok` | `boolean` | true if parsing succeeded |
| `data` | `unknown` | present when `ok` — the Parsed Document |
| `error` | `Error` | present when `!ok` — the raw `js-yaml` `YAMLException`, whose `.message` is shown verbatim in the error panel |

### UI State (not modeled as objects, but tracked as DOM/closure state)
- `lastOutput` / `lastOutputLang` — the most recent output text and its Monaco language
  (`yaml` or `json`), used by Copy Output and to avoid redundant `setModelLanguage` calls.
- Status pill state — one of `idle` / `valid` / `invalid`, driven entirely by the last
  Validation Result.

## Error hierarchy

None — errors are the raw `js-yaml` `YAMLException` object; there is no DevSuite-defined error
type for this tool. `.message` is displayed as-is; no error code/classification scheme exists.

## No JSON envelope

This tool has no backend API surface (see [contracts/http-api.md](contracts/http-api.md)), so
there is no request/response envelope to document — unlike DevDB-backed or proxy-backed tools.
