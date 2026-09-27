# Implementation Plan: WebSocket Tester

**Branch**: `020-websocket-tester` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-websocket-tester/spec.md`

## Summary

Ship DevSuite's 15th tool, a **WebSocket Tester**, at `/ws-tester`. The browser opens `ws://`/`wss://`
connections directly via the native `WebSocket` API (browsers don't apply CORS to WebSocket, so no
backend proxy is needed), sends text/JSON messages, and shows a single time-ordered, direction-tagged,
bounded log of sent/received messages and lifecycle events. Recent endpoints (URL + subprotocols)
persist in `localStorage` — no DevDB store, no master-password gate (ungated tier, like Cron/Regex).

The **one** server-side change is a scoped per-page CSP override: the default document CSP is
`connect-src 'self'`, which blocks arbitrary WebSocket handshakes, so the `/ws-tester` page response
must carry a CSP whose `connect-src` also allows `ws:` and `wss:`. Every other page keeps the strict
default. This is a security-relevant change and lands with a test (constitution Art. VI / SPEC §10.2).

Pure connection-independent logic (URL validation, message/log formatting, recent-endpoint list
management) lives in a **pure, dual-export module** (`static/ws-utils.js`) so it is unit-tested under
the existing Node runner, extending the DX-10 pure-module pattern. The live `WebSocket` wiring lives
in a thin DOM controller (`static/ws-tester.js`).

## Technical Context

**Language/Version**: Python 3.10+ (FastAPI) for the page route + the scoped CSP branch; vanilla ES2020 JS for the tool.

**Primary Dependencies**: FastAPI (existing). Browser native `WebSocket` API. **No new third-party JS libraries.**

**Storage**: `localStorage` for recent endpoints only (URL + subprotocols). No DevDB store, no server persistence, no message-body persistence (FR-014, Assumptions).

**Testing**: `pytest tests/python/` — a new CSP test asserting `/ws-tester` `connect-src` includes `ws:`/`wss:` while `/` stays `connect-src 'self'`, plus a route-200 test. `node tests/javascript/run.js` — unit tests for the pure `ws-utils.js` (URL validation, JSON pretty-print, log-cap trimming, recent-endpoint upsert/clear).

**Target Platform**: Modern browser over loopback. Outbound WS is user-initiated (not-strictly-offline, labeled per FR-020).

**Project Type**: Web application (FastAPI backend serving static vanilla-JS tools).

**Performance Goals**: Absorb 1000 rapidly-arriving messages without freezing the tab; the on-screen log is bounded/trimmed (FR-011, SC-004).

**Constraints**: Offline-first except the user-initiated WS connection; no CDN; no build step; no `innerHTML` with connection-derived content; no new inline `<script>`; no emoji in UI chrome.

**Scale/Scope**: One page (`ws-tester.html`), one pure module (`ws-utils.js`), one DOM controller (`ws-tester.js`), one stylesheet (`ws-tester.css`), one page route, one scoped CSP branch in `main.py`, tool-listing + homepage wiring, one JS test file, CSP + route Python tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Core principles (I–VII):**
- **I. Spec First** — `spec.md` authored before code; `specs/SPEC.md` (version §1.3, tool inventory, tool count) updated in the same commit as the implementation. PASS.
- **II. Local-Only, Offline-First** — the WebSocket connection is **user-initiated outbound network I/O**, the same sanctioned category as SSH/SFTP and the CORS proxy; it is labeled not-strictly-offline in the UI (FR-020). No CDN, no telemetry, all JS self-hosted. PASS (with the mandated labeling).
- **III. Vanilla Stack, Single Store** — vanilla HTML/CSS/JS, no framework/build tool. Only client-side `localStorage` for recent endpoints; DevDB untouched (no new store). PASS.
- **IV. Client-Side Encryption Boundary** — N/A; no secrets, no vault/SSH blobs, no master password.
- **V. DOM and CSP Hardening** — message bodies and events inserted via `createElement` + `textContent`, never `innerHTML`. No inline `<script>`. **No `unsafe-eval`** — the CSP override only widens `connect-src`, never touches `script-src`. Document CSP for every other page is unchanged. PASS.
- **VI. Security Paths Require Tests** — the change to CSP is security-relevant; it lands with `tests/python/test_csp.py` assertions (the `/ws-tester` connect-src widening, and confirmation other pages are unaffected). PASS.
- **VII. Versioning Discipline** — `deps.py APP_VERSION`, README badge, `CHANGELOG.md` heading, and `specs/SPEC.md` §1.3 bumped together; cache busting stays automatic via `_serve_html()`. PASS.

**Spec & security baseline:**
- [x] `specs/SPEC.md` updated in the same commit — new tool row, tool count, §1.3, and the CSP-override rule documented in the security section.
- [x] **New outbound network path**: the user-initiated WS connection. It is the *browser's* connection (no backend proxy), analogous to the sanctioned SSH/SFTP + proxy paths, and is UI-labeled not-strictly-offline (FR-020). No CDN assets.
- [x] Vanilla HTML/CSS/JS, no frameworks/build tools; no new database.
- [x] Master password untouched — N/A (ungated tier).
- [x] No `innerHTML` with untrusted data; **no `unsafe-eval`** added (only `connect-src` widened for one page); no new inline `<script>`.
- [x] CSP change lands **with tests** (`tests/python/test_csp.py`), per Art. VI / SPEC §10.2.
- [x] Release path bumps `deps.py` + README + CHANGELOG + SPEC §1.3 together; cache busting automatic.
- [x] Static-analysis gates stay green — small, well-scoped Python branch + client logic.

**New-tool / UI cross-cutting checklist:**
- [x] Tool count synced across `routes/pages.py`, `static/tools.html`, `static/home.html`, README, SPEC. WebSocket Tester is category **network** (joins SSH/SFTP), so `All 14→15` and `Network 1→2` in both `.filter-count` and the `.qa-chip`, plus the `.qa-stat`/title/meta "14 tools → 15 tools".
- [x] No UMD bundle added. The page loads `require.min.js` + `components.js` (for Monaco-based editors + `DevSuite.toast`); `ws-utils.js` and `ws-tester.js` are plain `<script>`s after them. UMD-before-require rule respected (crypto-js/jszip not needed here).
- [x] No scripting/eval feature — the sandbox worker and its scoped CSP are untouched; this feature's CSP branch only widens `connect-src` for one page.
- [x] `routes/ssh.py` untouched — WebSocket carve-out there is unaffected (this tool's WS is browser→remote, not through the DevSuite server).
- [x] Icons are stroke-based inline SVG; no emoji. Design tokens from existing CSS; themes via `theme.js`.
- [x] No new third-party JS → no SPEC §11 / `UPGRADE_PLAN.md` dependency entry required.

**Result: PASS — no violations, Complexity Tracking not required.** (The CSP widening is justified and minimal; see research R1.)

## Project Structure

### Documentation (this feature)

```text
specs/020-websocket-tester/
├── plan.md              # This file
├── research.md          # Phase 0 — CSP feasibility, WebSocket API, binary handling, module split
├── data-model.md        # Phase 1 — in-memory entities (Connection, Log Entry, Recent Endpoint)
├── quickstart.md        # Phase 1 — how to run/verify
├── contracts/           # N/A — no HTTP API in the data path (client-only WS); intentionally empty
└── tasks.md             # Phase 2 — /speckit-tasks output
```

### Source Code (repository root)

```text
static/
├── ws-tester.html       # Tool page (header/theme/toast pattern; loads require.min.js + components.js + ws-utils.js + ws-tester.js)
├── ws-utils.js          # PURE dual-export module: URL validation, message/JSON formatting, log cap, recent-endpoint list
├── ws-tester.js         # DOM controller: native WebSocket wiring, connect/disconnect/send, log rendering, localStorage
└── ws-tester.css        # Tool-scoped styling using existing design tokens

main.py
└── add_security_headers # + scoped CSP branch: /ws-tester document CSP has connect-src including ws: wss:

routes/
└── pages.py             # + GET /ws-tester → _serve_html("ws-tester.html")

static/tools.html        # + tool card (data-category="network"); All 14→15, Network 1→2, "15 tools"
static/home.html         # + tool count sync (14→15)
specs/SPEC.md            # + tool row, tool count, §1.3 version bump, CSP-override rule note
deps.py                  # APP_VERSION bump
README.md                # version badge + tool section
CHANGELOG.md             # new version heading

tests/python/
└── test_csp.py          # + /ws-tester connect-src includes ws:/wss:; other pages unchanged; route 200

tests/javascript/
├── run.js               # register the new test file
└── test_ws_utils.js     # NEW: URL validation, JSON pretty-print, log-cap trim, recent-endpoint upsert/clear
```

**Structure Decision**: Mirrors the established per-tool layout. Two deliberate decisions: (1) split
connection-independent logic into a **pure `ws-utils.js`** so it is Node-testable (DX-10 pattern);
(2) the CSP relaxation is a **scoped per-page branch** in the existing `add_security_headers`
middleware (exactly like the sandbox-worker branch), never a global loosening — so only `/ws-tester`
can open WebSockets and every other page keeps `connect-src 'self'`.

## Complexity Tracking

> No Constitution Check violations. Section intentionally empty. The CSP widening is the minimal
> change required for the browser to open the connection at all (research R1) and is scoped to a
> single page path.
