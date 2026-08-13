# Phase 1 Data Model: XML Linter & Validator

No persistence. This tool has no DevDB store and no backend state — every entity below is
transient, in-memory JavaScript state scoped to the open browser tab and discarded on reload,
matching `003-json-linter` and `004-yaml-linter`.

## Entities

### Parsed Document *(planned `xml.html` inline script)*
| Field | Type | Notes |
|-------|------|-------|
| doc | `Document` | result of `DOMParser.parseFromString(text, "application/xml")` — either a well-formed document or one whose root is a `parsererror` element (see Validation Result) |

### Validation Result *(planned `parseXml()` return value)*
| Field | Type | Notes |
|-------|------|-------|
| `ok` | `boolean` | `true` when no `parsererror` element is present (R2) |
| `doc` | `Document` | present when `ok` — the Parsed Document |
| `message` | `string` | present when `!ok` — the browser's `parsererror` diagnostic text, shown verbatim in the error panel per FR-006 |

### UI State (not modeled as objects, but tracked as DOM/closure state)
- `lastOutput` — the most recent output text, used by Copy Output.
- Status pill state — one of `idle` / `valid` / `invalid`, driven entirely by the last
  Validation Result, matching the JSON/YAML linters' pattern.

## Error hierarchy

None — errors are the raw `parsererror` diagnostic text extracted from the DOM (R2); there is
no DevSuite-defined error type for this tool, matching the YAML linter's approach of
displaying the underlying parser's message as-is with no error-code scheme.

## No JSON envelope

This tool has no backend API surface beyond page serving (see
[contracts/http-api.md](contracts/http-api.md)), so there is no request/response envelope to
document — unlike DevDB-backed or proxy-backed tools.
