# Contract: HTTP API — YAML Linter

## Page route

| Method | Route | Response | Description |
|---|---|---|---|
| `GET` | `/yaml` | `text/html` | Serves `static/yaml.html` via `_serve_html()` (cache-busted asset URLs, favicon injection — SPEC.md §3.3). Defined in `routes/pages.py:43-46`. |

## No other backend endpoints

This tool has **no** API endpoints beyond the page route. All parsing, formatting, and conversion
logic runs entirely client-side in `yaml.html`'s inline script using the self-hosted `js-yaml`
library. There is no request/response envelope, no DevDB store, and no server-side validation of
YAML content — the backend never sees the user's YAML.

## Compatibility rules

N/A — no versioned contract exists to break. Any future backend endpoint for this tool (e.g. a
server-side YAML linter for large-file or schema-validation use cases) would be a net-new addition
requiring its own SPEC.md §5 entry and this file's update in the same commit (CLAUDE.md rule 3).
