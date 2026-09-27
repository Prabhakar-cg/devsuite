# Research — WebSocket Tester (020)

Phase 0 decisions.

## R1 — CSP `connect-src` is the one hard blocker (and how to scope the fix)

**Finding**: The default document CSP in `main.py` (`_DOCUMENT_CSP`) ends with `connect-src 'self';`.
WebSocket handshakes are governed by `connect-src` (falling back to `default-src`), so with
`connect-src 'self'` the browser refuses any `ws://`/`wss://` connection to a non-same-origin host —
"Refused to connect to 'wss://…' because it violates the Content Security Policy directive:
connect-src 'self'". There is no `ws:`/`wss:`/wildcard token today.

**Decision**: Add a **scoped per-page CSP** for the `/ws-tester` document, exactly mirroring the
existing sandbox-worker branch in `add_security_headers`. Define a `_WS_TESTER_PATH = "/ws-tester"`
and a `_WS_TESTER_CSP` identical to `_DOCUMENT_CSP` except `connect-src 'self' ws: wss:;`. The
middleware picks it when `request.url.path == _WS_TESTER_PATH`. Critically, this **only** widens
`connect-src` — `script-src` stays `'self' 'unsafe-inline' blob:` with **no `unsafe-eval`**, so the
constitution's no-`unsafe-eval`-on-documents rule (Art. V, SEC-6) is preserved. Every other page,
including `/`, keeps `connect-src 'self'`.

**Why not a global widening**: Loosening `connect-src` for all pages would let any page open sockets
to anywhere — an unnecessary XSS-exfiltration surface. Scoping to the one page that needs it keeps
the blast radius minimal. This is security-relevant, so it lands with `tests/python/test_csp.py`
assertions (Art. VI): `/ws-tester` includes `ws:`/`wss:`, `/` does not.

## R2 — Native WebSocket API (RFC 6455), no library

- Construct: `new WebSocket(url, protocols?)` where `protocols` is a string or string[]. Connecting
  begins immediately; there is no separate `.connect()`.
- Events: `onopen`, `onmessage` (`event.data` is a `string` for text frames, or a `Blob`/`ArrayBuffer`
  for binary — controlled by `ws.binaryType`), `onerror` (opaque by design — no detail exposed to JS
  for security), `onclose` (`event.code`, `event.reason`, `event.wasClean`).
- `readyState`: `CONNECTING(0) / OPEN(1) / CLOSING(2) / CLOSED(3)`.
- `ws.protocol` after open = the negotiated subprotocol (empty string if none) → FR-013.
- Send: `ws.send(data)` only when `readyState === OPEN`; otherwise it throws `InvalidStateError`.
  The tool guards on `readyState` and refuses with a message rather than throwing (FR-007).
- Close: `ws.close(code?, reason?)`. Default 1000 (normal). The tool calls `ws.close()` on Disconnect
  and on starting a new connection (FR-006).

**Single-connection rule (FR-006)**: keep one module-level `ws` reference; before opening a new one,
if the existing socket is `CONNECTING`/`OPEN`, close it and null the reference first.

**Error opacity**: `onerror` gives no reason (spec-mandated). The tool logs a generic "connection
error" event and relies on the subsequent `onclose` code/reason for detail — and notes that the
browser console may carry the CSP/mixed-content specifics (edge cases).

## R3 — Binary frames (FR-010)

Set `ws.binaryType = 'arraybuffer'` so binary arrives as `ArrayBuffer` (synchronous, unlike `Blob`).
Render a binary entry as `binary (N bytes)` plus a best-effort preview: a short hex dump of the first
~32 bytes and, if the bytes decode as valid UTF-8, the decoded text. Never render `[object Blob]` or
drop the frame.

## R4 — Log bounding (FR-011, SC-004)

The log is an in-memory array capped at a constant (e.g. 500 entries) with FIFO trimming, and the DOM
list mirrors it — appending a node and removing the oldest node once over the cap, rather than
re-rendering the whole list per message. This keeps 1000 rapid messages responsive. Auto-scroll to
newest unless the user has scrolled up (so reading history isn't disrupted).

## R5 — JSON detection & pretty-print (FR-009)

For text frames, attempt `JSON.parse`; on success, display `JSON.stringify(parsed, null, 2)` in a
monospace block and tag the entry `json`; on failure, display the raw text tagged `text`. For
outbound messages the user can toggle a "JSON" mode that validates before send and pretty-displays
the sent entry; invalid JSON in JSON mode is surfaced (not silently sent malformed) per FR-009.

## R6 — Persistence: localStorage recent endpoints (FR-014)

Recent endpoints (`{url, protocols, lastUsedAt}`) are stored in `localStorage` under a single key
(e.g. `devsuite-ws-recent`), capped to the most recent N (e.g. 15), most-recent-first — mirroring the
API Tester's `devsuite-api-history` pattern. No message bodies are stored. This keeps the tool
ungated (no DevDB store, no `_ALLOWED_STORES` change, no session). "Clear" removes the key.

## R7 — Module shape & testability (extends DX-10)

**Decision**: `static/ws-utils.js` is a pure, DOM-free, browser/Node dual-export module (same footer
as `roadmap-utils.js`/`curl-codegen.js`) exposing: `normalizeWsUrl(raw)` → `{ok, url}|{ok:false,
error}` (scheme/blank validation, FR-002); `parseProtocols(raw)` → string[] (comma-split, trimmed,
deduped); `formatIncoming(data)` → `{type, body}` for text/JSON (binary handled in the controller
since it needs `ArrayBuffer`); `capLog(entries, max)` → trimmed array (FR-011); and recent-endpoint
list helpers `upsertRecent(list, entry, max)` / `clearRecent()`. `tests/javascript/test_ws_utils.js`
covers these under the zero-dependency runner. The DOM controller `ws-tester.js` owns the live
`WebSocket`, event wiring, and rendering (not unit-tested, thin glue).

## R8 — No backend in the data path

The browser connects directly to the target WS endpoint; DevSuite's server is not a proxy for the
socket. The only server touch-points are the static page route (`GET /ws-tester`) and the scoped CSP
header (R1). So `contracts/` is intentionally empty. This is deliberately different from the CORS
proxy (which *is* a backend hop for `fetch`) — WebSocket needs no proxy because browsers don't apply
CORS to it.
