# Contract: HTTP API — XML Linter

## Page route

| Method | Route | Response | Description |
|---|---|---|---|
| `GET` | `/xml` | `text/html` | Serves `static/xml.html` via `_serve_html()` (cache-busted asset URLs, favicon injection — SPEC.md §3.3). Planned addition to `routes/pages.py`, mirroring the `/json` and `/yaml` route blocks. |

## No other backend endpoints

This tool has **no** API endpoints beyond the page route. All parsing, formatting, and
minifying logic runs entirely client-side in `xml.html`'s inline script using the browser's
native `DOMParser`/`XMLSerializer` — no vendored library, no `fetch`/`XMLHttpRequest` call.
There is no request/response envelope, no DevDB store, and no server-side handling of XML
content — the backend never sees the user's XML.

## Compatibility rules

N/A — no versioned contract exists to break. Any future backend endpoint for this tool (e.g.
a server-side XSD/DTD schema-validation mode, should that ever become a separate spec) would
be a net-new addition requiring its own `specs/SPEC.md §5` entry and this file's update in the
same commit (CLAUDE.md rule 3). XML↔JSON conversion is explicitly out of scope here and
belongs to `specs/013-file-converter`'s existing `/api/convert` contract, not this file.
