# Contract: HTTP API — Cron Visualizer

As-built contract, verified against `routes/pages.py`.

## Page route

| Method | Route | Serves |
|---|---|---|
| `GET` | `/cron` | `cron.html` (loads `cron.js` + `cron.css`) |

## Backend API

None. Per SPEC.md §4.9 ("All computation is client-side — no backend required") and FR-010, this
tool makes no requests beyond the initial page load — no REST endpoints, no WebSocket, no DevDB
store. All parsing, description generation, field-builder sync, next-run search, heatmap
rendering, and export (YAML/JSON/raw-copy) happen in `static/cron.js` in the browser.

## Compatibility rules

None applicable — there is no API surface to version. Adding a backend endpoint to this tool in
the future would be a meaningful architectural change (breaking FR-010) and should update this
contract and SPEC.md §4.9 in the same commit per CLAUDE.md rule 3.
