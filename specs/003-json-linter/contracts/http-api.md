# Contract: HTTP API — JSON Linter & Formatter

## `GET /json`

Serves `static/json.html` via `_serve_html()` (cache-busted CSS/JS URLs, favicon
injection — SPEC.md §3.3). No query parameters, no auth (SPEC.md §8).

## No other backend endpoints

Every capability described in spec.md (validate, format, minify, sort keys, convert to
YAML, clear, paste, copy) runs entirely client-side in the inline `<script>` in
`static/json.html`. There is no request/response contract beyond the page GET above.

**Compatibility rule**: if a future change adds a backend endpoint for this tool (e.g.
server-side large-file formatting), it must be documented here and in SPEC.md §5 in the
same commit (constitution Art. I).
