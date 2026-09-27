---
description: "Task list for WebSocket Tester (feature 020)"
---

# Tasks: WebSocket Tester

**Input**: Design documents from `/specs/020-websocket-tester/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md (no contracts/ — client-only WS)

**Tests**: JS unit tests for the pure `ws-utils.js` (DX-10) AND Python CSP/route tests are included —
the CSP change is security-relevant and MUST land with tests (constitution Art. VI / SPEC §10.2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (connect/lifecycle), US2 (send/receive), US3 (subprotocols/recent)

---

## Phase 1: Setup

- [ ] T001 Create `static/ws-utils.js` skeleton — pure, DOM-free dual-export module (footer like
  `static/roadmap-utils.js`) with stubs: `normalizeWsUrl`, `parseProtocols`, `formatIncoming`,
  `capLog`, `upsertRecent`, `clearRecentKey`.
- [ ] T002 [P] Create `static/ws-tester.css` with tool-scoped styles on existing design tokens
  (`linter.css`/`style.css`); no emoji (SPEC §9.8/§9.9).

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: The CSP override is what makes any WebSocket connection possible; the page route
serves the tool. Both block all user stories.

- [ ] T003 In `main.py` `add_security_headers`, add `_WS_TESTER_PATH = "/ws-tester"` and
  `_WS_TESTER_CSP` (= `_DOCUMENT_CSP` but `connect-src 'self' ws: wss:`), and branch the header on
  `request.url.path == _WS_TESTER_PATH`. Only `connect-src` widens — no `script-src`/`unsafe-eval`
  change (research R1).
- [ ] T004 Register the route in `routes/pages.py`: `@router.get("/ws-tester")` →
  `_serve_html("ws-tester.html")`.
- [ ] T005 Implement `ws-utils.js` pure functions per `data-model.md`: `normalizeWsUrl` (blank / non
  ws-wss rejection, FR-002), `parseProtocols` (comma-split/trim/dedupe), `formatIncoming` (JSON
  pretty-print else raw text, FR-009), `capLog` (FIFO trim to max, FR-011), `upsertRecent`
  (front-insert, dedupe by url, cap, FR-014).

**Checkpoint**: page reachable with a WS-permitting CSP; pure helpers ready.

---

## Phase 3: User Story 1 — Connect & lifecycle (Priority: P1) 🎯 MVP

**Goal**: Connect to a ws/wss endpoint and observe connecting → open/error/closed.

**Independent Test**: Connect to a reachable echo endpoint → status Open + logged open event.

### Implementation

- [ ] T006 [US1] Build `static/ws-tester.html` — header/nav/theme (model on API Tester header),
  a `not-strictly-offline` label (FR-020), URL input + subprotocol input, Connect/Disconnect buttons,
  a status indicator, a message log container, and a `toast-container`. Load order: `require.min.js`
  → `components.js` → `ws-utils.js` → `ws-tester.js`; no inline `<script>`.
- [ ] T007 [US1] In `static/ws-tester.js`, implement connect: validate via `normalizeWsUrl`, close any
  existing socket first (FR-006), `new WebSocket(url, protocols)`, set `binaryType='arraybuffer'`,
  wire `onopen`/`onerror`/`onclose` to status + timestamped lifecycle log entries (FR-003/004/005),
  show negotiated `ws.protocol` on open (FR-013).
- [ ] T008 [US1] Implement disconnect (`ws.close()`) and the status-indicator component
  (connecting/open/closing/closed/error).

**Checkpoint**: US1 fully usable.

---

## Phase 4: User Story 2 — Send & receive (Priority: P1)

**Goal**: Send text/JSON and see sent + received messages in one bounded, time-ordered log.

**Independent Test**: Echo endpoint — send text, see sent + received echo entries.

### Implementation

- [ ] T009 [US2] Implement send in `ws-tester.js`: refuse unless `readyState===OPEN` with a message
  (FR-007); on send, add a direction-tagged "sent" log entry (FR-008); JSON-mode toggle validates +
  pretty-displays, surfaces invalid JSON (FR-009).
- [ ] T010 [US2] Implement `onmessage` rendering: text/JSON via `formatIncoming` (FR-009); binary via
  `ArrayBuffer` → `binary (N bytes)` + hex/UTF-8 preview (FR-010); every entry via `createElement`
  +`textContent` (FR-018).
- [ ] T011 [US2] Implement the bounded log: in-memory array + `capLog`, DOM append + oldest-node
  removal over `LOG_CAP`, auto-scroll-to-newest unless scrolled up (FR-011, SC-004); Clear-log button
  (FR-012).

**Checkpoint**: US1 + US2 = a working WebSocket tester.

---

## Phase 5: User Story 3 — Subprotocols & recent endpoints (Priority: P2)

**Goal**: Offer subprotocols; remember and restore recent endpoints.

**Independent Test**: Connect with a subprotocol, reload, restore from Recent.

### Implementation

- [ ] T012 [US3] Wire subprotocol input through `parseProtocols` into the `WebSocket` constructor and
  display the negotiated subprotocol (FR-013) — mostly covered by T007; this task confirms multi-
  protocol input handling.
- [ ] T013 [US3] Implement recent-endpoints persistence in `ws-tester.js`: on successful connect,
  `upsertRecent` into `localStorage['devsuite-ws-recent']`; render a Recent list that restores
  URL/subprotocols on click; Clear-recent button removes the key (FR-014).

**Checkpoint**: all three stories independently functional.

---

## Phase 6: Tests

- [ ] T014 [P] Write `tests/javascript/test_ws_utils.js`: `normalizeWsUrl` accepts ws/wss + rejects
  blank/`http`/`javascript` (SC-003); `parseProtocols` split/trim/dedupe; `formatIncoming` JSON vs
  text (FR-009); `capLog` trims to max preserving newest (FR-011/SC-004); `upsertRecent`
  front-insert/dedupe/cap (FR-014). Register the file in `tests/javascript/run.js`.
- [ ] T015 Extend `tests/python/test_csp.py`: assert `GET /ws-tester` returns 200 and its CSP
  `connect-src` includes `ws:` and `wss:`; assert `GET /` still has `connect-src 'self'` and no
  `ws:`; assert `/ws-tester` CSP still has **no `unsafe-eval`** (SC-006, Art. VI).

---

## Phase 7: Integration & Release (Cross-Cutting)

- [ ] T016 Add the WebSocket Tester card to `static/tools.html` (category `network`, stroke-SVG icon,
  a "not strictly offline" note in the description) and bump counts: `All 14→15`, `Network 1→2` in
  both `.filter-count` and the `.qa-chip`, plus the `.qa-stat` "14 tools"→"15 tools" and the
  `<title>`/meta description.
- [ ] T017 Update `static/home.html` tool count references (14→15).
- [ ] T018 Bump version together (Art. VII): `APP_VERSION` in `deps.py`, README badge + a README tool
  section entry, new `CHANGELOG.md` heading, and `specs/SPEC.md` §1.3; add the tool row + tool-count
  + document the `/ws-tester` scoped-CSP rule in the SPEC security section.
- [ ] T019 Run `pytest tests/python/` and `node tests/javascript/run.js`; run `quickstart.md`
  verification (including the `curl -I` CSP checks) against a live server. Fix anything red.

---

## Dependencies & Execution Order

- **Setup (P1)** → **Foundational (P2: CSP + route + pure helpers, blocks all)** → **US1 (P3)** →
  US2 (P4) → US3 (P5) → **Tests (P6)** → **Release (P7)**.
- T007–T011 all edit `ws-tester.js` — serialize those edits (not `[P]`).
- Release (P7) is last so the version bump + tool-count sync + CSP-rule doc land with the finished,
  tested tool (Spec-First, Art. I & VII).

## Implementation Strategy

MVP = Phases 1–4 (connect + send/receive with a bounded log). US3 (subprotocols/recent) layers on
top. The CSP override (T003) is the single most important early task — without it nothing connects —
and its test (T015) is mandatory because it touches the security header layer.
