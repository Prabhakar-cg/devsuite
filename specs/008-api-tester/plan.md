# Implementation Plan: Local API Tester

**Branch**: `008-api-tester` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-api-tester/spec.md`

**Note**: This is a retroactive plan for an already-shipped feature (DevSuite v0.3.0's flagship
tool, SPEC.md §13). It documents the as-built architecture rather than proposing one.

## Summary

The Local API Tester is a vanilla-JS REST client (`static/api-tester.html/js/css`,
`static/api-client.js`) backed by three small FastAPI surfaces: a CORS-bypass proxy
(`routes/proxy.py` `/api/proxy`), a DevDB-backed collections store (`routes/storage.py`
`/api/collections`), and no dedicated backend logic for environments/history/scripting (those are
entirely client-side or Web-Worker-side). Four pure, dependency-free JS modules carry the
unit-testable logic: `curl-codegen.js` (curl parse + snippet generation), `cookie-jar.js` (RFC
6265-ish cookie matching), `collection-utils.js` (folder path rename/move/delete), and
`script-sandbox-worker.js` (signed script execution via `new Function()`, isolated inside the
worker's scoped CSP — fixed 2026-07-28, see spec.md). Everything else (folder tree rendering, drag-and-drop, import parsers for
Postman/OpenAPI, the collection runner, OAuth2 token fetch) lives directly in `api-tester.js`
(2300 lines).

## Technical Context

**Language/Version**: Vanilla JS (ES2022+, no transpilation) client; Python 3.10+ / FastAPI backend

**Primary Dependencies**: Monaco Editor (self-hosted, RequireJS) for JSON/GraphQL editors; JSZip
(self-hosted) for zip export/import; no other third-party JS. Backend: FastAPI, `urllib` (stdlib)
for the proxy — deliberately not `requests`/`httpx` to keep the SSRF-guarding redirect handler
(`_SSRFSafeRedirectHandler`) simple and dependency-free.

**Storage**: DevDB `collections` store (`{items: [...], folderAuths: {...}}`) for requests/folders;
`localStorage` for environments (`devsuite-api-environments`, `devsuite-api-active-env`) and
history (`devsuite-api-history`, capped at 50); cookie jar is a plain in-memory array with no
persistence path anywhere.

**Testing**: `tests/javascript/run.js` (Node, zero deps) covers `curl-codegen.js`, `cookie-jar.js`,
and `collection-utils.js` (three pure modules — `collection-utils.js` coverage exists in source
though CLAUDE.md's "Running Tests" section only names the first two; flagged as a doc gap, not
fixed here since CLAUDE.md is out of this fork's scope). No JS test exercises `api-tester.js`
itself (DOM-heavy, no browser test harness yet per SPEC.md §10.1) or `script-sandbox-worker.js`.
`tests/python/` has no dedicated `routes/proxy.py` or `routes/storage.py` collections test beyond
`test_proxy_ssrf.py` (SSRF block behavior) and `test_proxy_cookies.py` (Set-Cookie passthrough).

**Target Platform**: Any modern browser (Chromium/Firefox/Safari with Web Worker + `fetch` +
`<dialog>` support) talking to the local DevSuite backend on `localhost:8000`.

**Project Type**: Web application (single FastAPI backend + static frontend, per DevSuite's overall
architecture — no separate frontend/backend project split).

**Performance Goals**: None formally specified; proxy responses capped at 10 MB and 15 s timeout
(`routes/proxy.py`); script sandbox capped at 10 s (`SCRIPT_TIMEOUT_MS`).

**Constraints**: Document CSP has no `unsafe-eval` (SEC-6) — script execution only happens inside
the worker's separately scoped CSP response. Cookie jar must never gain a persistence path
(explicit security boundary, CLAUDE.md gotcha). `/api/collections` must stay auth-gated
server-side, not just client-side.

**Scale/Scope**: Single-page tool; collections of "hundreds" of requests are the practical ceiling
implied by the flat-array + derived-tree rendering approach (no virtualization in
`renderCollections`).

## Constitution Check

*GATE: evaluated retroactively against the shipped implementation — no violations found, one open
item (SEC-6-adjacent) already tracked in SPEC.md §7.8. A script-sandbox execution gap found during
the initial pass was fixed the same day (2026-07-28) — see the updated item below.*

**Core principles (I–VII):**

| Principle | Compliance |
|---|---|
| I. Spec first | Violated in spirit prior to this fork: OAuth2, GraphQL, and History shipped without a matching SPEC.md §4.7 update (see spec.md's "Undocumented capabilities" section). This retroactive spec now documents them; folding back into `specs/SPEC.md` itself is a follow-up outside this fork's scope. |
| II. Verify against source | This plan and spec.md were written by reading `routes/proxy.py`, `routes/storage.py`, `api-tester.js`, `api-client.js`, `script-sandbox-worker.js`, `curl-codegen.js`, `cookie-jar.js`, `collection-utils.js` directly — the sandbox-execution discrepancy was caught this way. PASS. |
| III. No undocumented behavior | Partially failing pre-existing (see above); this spec closes the gap for `specs/008-api-tester/` but SPEC.md §4.7 itself is not edited by this fork. |
| IV. Security paths require tests | CSRF/auth on `/api/collections` (`require_unlocked`) and SSRF on `/api/proxy` (`_check_ip_not_private`, redirect re-validation) ARE tested (`tests/python/test_proxy_ssrf.py`, `test_proxy_cookies.py`, and the general auth suite). The cookie jar's in-memory-only property and the script sandbox's CSP isolation are **not** covered by a dedicated JS/Python test — flagged as a coverage gap. (2026-07-28: the sandbox's execution path was fixed the same day; a regression test asserting "a validly-signed script actually executes and its results reach the Console" is still missing — recommended follow-up.) |
| V. Version bump protocol | N/A — no version bump in this documentation-only fork. |

**Spec & security baseline:**
- [x] `specs/SPEC.md` is updated in the same commit as behavior/API/UI changes — N/A here (no
      code change); the OAuth2/GraphQL/History documentation gap in SPEC.md itself predates this
      fork and is not closed by it (documentation-only scope).
- [x] No new outbound network paths beyond the user-initiated CORS proxy — confirmed; OAuth2 token
      fetch reuses the same proxy fallback pattern as regular requests, not a new path.
- [x] Vanilla HTML/CSS/JS, no frameworks; persistence via DevDB (`collections` store) — confirmed.
      Environments/History use `localStorage`, which is browser storage, not a competing database —
      consistent with the constraint's intent (no SQLite/Postgres/Redis).
- [x] Backend never decrypts vault/SSH blobs — N/A to this tool; API Tester cookie jar stays
      in-memory only — **confirmed by source inspection**, no persistence call site exists.
- [x] No `innerHTML` with untrusted data — `api-tester.js` builds all dynamic DOM via
      `createElement`/`textContent` (sidebar rows, cookie rows, console entries); confirmed by
      reading the relevant render functions.
- [x] Document responses never carry `unsafe-eval`; script sandbox response does, scoped —
      confirmed in `script-sandbox-worker.js` header comment and cross-referenced with
      `tests/python/test_csp.py`; this remains true after the 2026-07-28 execution-path fix, which
      only restored `new Function()` execution inside the already-scoped worker response.
- [x] Changes to auth/CSRF/sessions/CORS proxy land with tests — `/api/collections` and
      `/api/proxy` both have security-path tests (see Technical Context testing notes above).
- [x] **Item resolved 2026-07-28**: the script-sandbox execution stub found during the initial
      retroactive-spec pass was fixed the same day — the worker now generates a per-instance
      random token, the main thread HMAC-signs each script under it, and the worker executes
      signed scripts via `new Function()`. No automated test yet asserts "a valid signed script
      actually runs and its mutations apply" — recommended follow-up, not blocking.

**New-tool / UI cross-cutting checklist:**
- [x] Tool count / `tools.html` — unaffected, no tool added/removed.
- [x] UMD bundle load order — API Tester loads `jszip.min.js` before `require.min.js` per
      `static/api-tester.html`'s script order (module-to-file map, SPEC §3.4); not re-verified line
      by line in this fork but no changes were made to loading order.
- [x] Scripting/eval routes through `script-sandbox-worker.js`'s scoped CSP — confirmed true after
      the 2026-07-28 fix, which restored real execution inside that same scoped-CSP boundary.
- [x] `routes/ssh.py` WebSocket carve-out — N/A, not touched by this tool.
- [x] Icons are stroke-based inline SVG — confirmed in `_makeSvg`/`_makeKebabSvg` helpers, no emoji.
- [x] New third-party JS — none added; JSZip and Monaco are pre-existing SPEC §11 entries.

## Project Structure

### Documentation (this feature)

```text
specs/008-api-tester/
├── plan.md                    # This file
├── spec.md                    # Retroactive spec (incl. discrepancy notices)
├── research.md                # Architectural decisions, as-built
├── data-model.md              # Collection/environment/cookie/runtime-var shapes
├── quickstart.md              # Manual validation steps + actual test coverage
├── contracts/
│   ├── http-api.md            # /api/proxy, /api/collections
│   └── frontend-modules.md    # curl-codegen.js, cookie-jar.js, collection-utils.js contracts
└── tasks.md                   # Retroactive "what was built" task list
```

### Source Code (repository root)

```text
routes/
├── proxy.py              # POST /api/proxy — SSRF-guarded CORS bypass
└── storage.py             # GET/POST /api/collections (also vault, ssh_profiles — shared file)

static/
├── api-tester.html        # Page shell, all modal/panel markup
├── api-tester.js          # ~2300 lines: state, rendering, runner, import/export, OAuth2
├── api-tester.css         # Tool-specific styles
├── api-client.js          # ApiClient — fetch wrapper, smart CORS routing, proxy decode
├── script-sandbox-worker.js  # Web Worker — HMAC signature check + new Function() script exec
├── curl-codegen.js        # Pure: curl parse, cURL/fetch/HTTPie snippet generation
├── cookie-jar.js          # Pure: Set-Cookie parse, domain/path match, header serialization
└── collection-utils.js    # Pure: folder path normalize/rename/delete/move

tests/javascript/
├── test_curl_codegen.js
├── test_cookie_jar.js
└── test_collection_utils.js

tests/python/
├── test_proxy_ssrf.py     # SSRF IP-class blocking + redirect re-validation
└── test_proxy_cookies.py  # Set-Cookie passthrough (list, not collapsed dict)
```

**Structure Decision**: No structural changes — this plan documents the existing single-project
layout (DevSuite has no `frontend/`/`backend/` split; `static/` + `routes/` + root-level
`devdb.py`/`deps.py` is the whole project). The four pure JS modules are the only part of this
tool's client code that follows a "library" discipline (no DOM access, `module.exports` +
`globalThis` dual export for Node-testability); everything else lives directly in the monolithic
`api-tester.js` page controller, consistent with DevSuite's "vanilla JS, no build step" constraint
(Art. III / SPEC §2).

## Complexity Tracking

*No constitutional violations requiring justification. The script-sandbox execution stub found
during the initial retroactive-spec pass was a functional regression, not a constitutional
complexity trade-off, and was fixed 2026-07-28 (see spec.md).*
