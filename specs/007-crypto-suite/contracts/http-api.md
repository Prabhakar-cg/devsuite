# Contract: HTTP API — Crypto Suite

This tool has exactly one backend endpoint: the page route. Every hash/AES/RSA/HMAC/Base64/JWT
operation across all six tabs runs client-side in `static/crypto.html`; nothing else talks to
the server.

## Page route

| Method | Route | Handler | Response |
|---|---|---|---|
| `GET` | `/crypto` | `routes/pages.py:61-64` `read_crypto_tool()` | `_serve_html("crypto.html")` — HTML with cache-busted asset URLs (SPEC §3.3) |

No query parameters, no request body, no auth required (SPEC §8 — "No auth required" for this
tool). Standard security headers apply (SPEC §5.10); no CSP exception is needed — this tool uses
no `eval`/inline-script mechanism requiring the sandboxed-worker carve-out that API Tester needs
(§5.10, §4.7.1).

## No other endpoints

There is no `/api/crypto/*` route, no DevDB store, and no WebSocket. All six tabs' behaviors —
hashing, AES, RSA keygen/encrypt/decrypt, HMAC sign/verify, Base64, JWT decode/verify — execute
entirely inside the browser via `crypto.subtle` (native WebCrypto) and the vendored
`crypto-js.min.js`, with zero additional network calls, consistent with SPEC §1.1's offline-first
mission and the page's own "100% In-Browser" badge.
