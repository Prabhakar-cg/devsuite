# Contract: HTTP API — Regex Tester

## Page route

| Method | Route | Response | Description |
|---|---|---|---|
| `GET` | `/regex` | `text/html` | Serves `static/regex.html` via `_serve_html()` (cache-busted asset URLs, favicon injection — SPEC.md §3.3). Defined in `routes/pages.py:49-52`. |

## No other backend endpoints

This tool has **no** API endpoints beyond the page route. All pattern compilation and matching
runs entirely client-side using the browser's native `RegExp`. There is no request/response
envelope, no DevDB store, and no server-side handling of the user's pattern or test string.

## Compatibility rules

N/A — no versioned contract exists to break.
