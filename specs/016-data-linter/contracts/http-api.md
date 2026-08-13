# Contract: HTTP API — Data Format Linter

## Page routes

| Method | Route | Response | Description |
|---|---|---|---|
| `GET` | `/data-linter` | `text/html` | Primary route. Serves `static/data-linter.html`; defaults to the JSON tab, or the tab named by `?tab=json\|yaml\|xml\|toon` when present and recognized (falls back to JSON otherwise). TOON is reachable only via this query param — it has no bare legacy-style route since it postdates any bookmarkable history. |
| `GET` | `/json` | `text/html` | Legacy route, kept for backward compatibility (spec.md FR-007). Serves the **same** `static/data-linter.html`, defaulting to the JSON tab. Not a redirect — a direct 200. |
| `GET` | `/yaml` | `text/html` | Legacy route. Same file, defaulting to the YAML tab. Not a redirect. |
| `GET` | `/xml` | `text/html` | Legacy route (this route existed only within this session, from `015-xml-linter`, and is being repointed here rather than shipped standalone). Same file, defaulting to the XML tab. Not a redirect. |

All four are implemented as one Python function with four stacked `@router.get(...)`
decorators (research.md R3), all calling `_serve_html("data-linter.html")` — cache-busted
asset URLs and favicon injection (SPEC.md §3.3) apply identically regardless of which route
was hit, since `_serve_html()` has no per-route templating hook.

## No other backend endpoints

This tool has **no** API endpoints beyond the four page routes above. All parsing, formatting,
minifying, sorting, and converting logic runs entirely client-side in `data-linter.html`'s
inline script using `JSON.parse`/`stringify` (JSON tab), the already-vendored `js-yaml`
library (YAML tab), the browser's native `DOMParser`/`XMLSerializer` (XML tab), and a
first-party TOON encoder/decoder implemented inline in this file (TOON tab, FR-011 — not a
vendored library, since no npm/CDN TOON implementation is pulled in) — no `fetch`/
`XMLHttpRequest` call anywhere. Cross-format conversion (FR-010) composes these same four
parsers/serializers through an in-memory canonical value (research.md R6); it is still purely
client-side, no new network path. There is no request/response envelope, no DevDB store, and
no server-side handling of any format's content — the backend never sees what the user types.

## Compatibility rules

The three legacy routes (`/json`, `/yaml`, `/xml`) are a compatibility contract in themselves:
this spec commits to keeping them resolving to a working tool (SC-003) for as long as
`016-data-linter` (or whatever supersedes it) ships. Removing any of the three would be a
breaking change requiring its own spec update and an explicit justification, per CLAUDE.md
rule 3 (no undocumented behavior removal).

Any future backend endpoint for this tool (e.g. a server-side schema-validation mode, should
one ever be proposed as a separate spec) would be a net-new addition requiring its own
`specs/SPEC.md §5` entry and this file's update in the same commit.
