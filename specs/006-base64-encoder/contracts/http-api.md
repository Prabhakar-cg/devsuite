# Contract: HTTP API — Base64 Encoder / Decoder

This tool has exactly one backend endpoint: the page route. All encode/decode/JWT logic runs
client-side in `static/base64.html`; nothing else talks to the server.

## Page route

| Method | Route | Handler | Response |
|---|---|---|---|
| `GET` | `/base64` | `routes/pages.py:55-58` `read_base64_tool()` | `_serve_html("base64.html")` — HTML with cache-busted asset URLs (SPEC §3.3) |

No query parameters, no request body, no auth required (SPEC §8 — "No auth required" for this
tool). Standard security headers apply to the response (SPEC §5.10); no CSP exception is needed
here since this tool uses no `eval`/inline-script mechanism requiring one.

## No other endpoints

There is no `/api/base64/*` route, no DevDB store, and no WebSocket. Every stated behavior in
[spec.md](../spec.md) (encode, decode, URL-safe mode, JWT inspect, file/clipboard I/O) executes
entirely inside the browser with zero additional network calls — consistent with SPEC §1.1's
offline-first mission.
