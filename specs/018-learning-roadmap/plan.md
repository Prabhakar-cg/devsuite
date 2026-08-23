# Implementation Plan: Learning Roadmap

**Branch**: `018-learning-roadmap` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-learning-roadmap/spec.md`

## Summary

A new DevSuite tool at `/roadmap`: a generic, multi-roadmap learning-plan tracker (id/title/
description + ordered steps, each with markdown notes, a checklist, course links, and document
links). Lives in the **unauthenticated** tool tier (no master-password gate) alongside
Diff/Data-Linter/Regex/Cron, backed by one new DevDB store (`roadmaps`) holding full roadmap
records. Completion percentages are always computed on read (`compute_completion()`), never
stored, so checklist state and displayed % can never drift. Ships pre-seeded with one roadmap
("AI/MLOps & Agentic AI Infrastructure", 6 steps) via a one-off seed script, becoming the
suite's 13th tool.

**Prerequisite fix (cross-cutting, discovered during planning)**: the global CSRF middleware in
`main.py` currently only issues the `ds_csrf` cookie via `/api/auth/session` (the master-password
unlock flow). This means every unauthenticated-tier tool with a mutating endpoint —
`/api/convert` (File Converter), `/upload` (Diff), `/api/proxy` (API Tester) — is **currently
unreachable** (confirmed via `TestClient`: all three return `403 CSRF validation failed` for a
visitor who has never set a master password). Learning Roadmap's mutating routes
(POST/PUT/PATCH/DELETE `/api/roadmaps/...`) would hit the same wall. Per user decision, this plan
fixes the gap at its root: the CSRF cookie is minted for **every** visitor on first contact with
the app (not only after master-password unlock), which is a standard, non-weakening
double-submit-cookie pattern (the defense comes from `SameSite=strict` + cookie==header equality,
not from who issued the cookie). This incidentally un-breaks the three pre-existing endpoints and
is covered by new tests per Constitution Art. VI. This fix ships as part of M2 (first milestone
that needs a working mutating route) and is called out separately in the commit/PR description
since its benefit extends beyond this feature.

## Technical Context

**Language/Version**: Python 3.10+ (backend, matches existing `routes/*.py`); vanilla ES2021+ JavaScript, no build step (frontend, matches every existing tool)

**Primary Dependencies**: FastAPI (existing); Monaco Editor + RequireJS (existing, `static/libs/vs/`, `static/libs/require.min.js`, via `DevSuite.initMonaco()` in `static/components.js`) for step notes — same pattern Notes Workspace (017) uses. No new third-party dependency.

**Storage**: DevDB (`devdb.py`) — one new store, `"roadmaps"`, holding a dict keyed by roadmap id → full roadmap record (see `data-model.md`). No SQLite/Postgres/Redis/external DB. Unlike Vault/Notes, this store is **plaintext JSON** (not client-side-encrypted) since roadmap content is explicitly non-sensitive (locked design decision) and the tool has no master-password gate to derive an encryption key from.

**Testing**: `pytest tests/python/` for the new `/api/roadmaps*` routes, `compute_completion()`, and the CSRF-cookie-issuance fix (mirrors `tests/python/test_csrf.py` conventions); `node tests/javascript/run.js` — not applicable unless a pure-function module (e.g. `compute_completion`-equivalent client-side helper) is extracted; current plan keeps completion computation server-side only, so no new JS unit-test target is anticipated.

**Target Platform**: Self-hosted local web app, same as every other DevSuite tool.

**Project Type**: Single-project web application (existing DevSuite monolith — FastAPI backend + vanilla JS frontend under `static/`). No frontend/backend split beyond what already exists.

**Performance Goals**: Checklist toggle → visible % update in <500ms (SC-002, trivially met by direct DOM update + fire-and-confirm PATCH over localhost); roadmap list/detail load is a single small JSON store read, no perceptible latency at expected scale.

**Constraints**: Offline-first, no CDN assets (Constitution Art. II); no `innerHTML` with unsanitized content (Art. V) — matters here because step titles/descriptions/notes/link titles are user-authored text rendered via `createElement`/`textContent`, and markdown notes rendering (if rendered as HTML at all — see research.md item 3) must not reopen the stored-XSS class Notes Workspace's DOMPurify dependency exists to close; vanilla stack, no frameworks/build tools (Art. III); unauthenticated tier means **no** encryption-at-rest for this store (explicit tradeoff, matches the "not sensitive" design decision — documented in Constitution Check below, not a violation of Art. IV since Art. IV's scope is Vault/SSH blobs specifically).

**Scale/Scope**: Single-user local workspace; a handful of roadmaps, each with single-digit-to-low-tens of steps — no pagination/virtualization needed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Core principles (I–VII):**

- **I. Spec First** — PASS. `spec.md` precedes this plan; on completion, `/api/roadmaps*` routes,
  the `roadmaps` DevDB store, the CSRF-cookie-issuance change, and the new `/roadmap` page route
  fold back into `SPEC.md` §4 (tool index), §5 (API), §6 (storage), §7 (security model — CSRF
  section update) in the same commit series, per Art. I.
- **II. Local-Only, Offline-First** — PASS. Zero new outbound network paths. Course-link/document
  URLs are user-entered strings rendered as `<a>` hrefs (not fetched or proxied by the backend) —
  same treatment as any other stored URL field in the suite (e.g. Vault entries).
- **III. Vanilla Stack, Single Store** — PASS. No frameworks, no build tools, one new DevDB store
  (`roadmaps`), reusing already-vendored Monaco. No new third-party JS.
- **IV. Client-Side Encryption Boundary** — N/A for this store specifically (by design — roadmap
  content is explicitly non-sensitive and outside the master-password gate), and PASS in that this
  feature does not touch Vault/SSH-profile encryption, the master password handling, or the API
  Tester cookie jar at all.
- **V. DOM and CSP Hardening** — PASS. All dynamic rendering via `createElement`/`textContent`;
  step markdown notes render as **plain text in a Monaco editor**, not as sanitized HTML (research.md
  item 3) — sidesteps the DOMPurify/XSS surface entirely rather than reopening it. No new inline
  scripts, no CSP changes, no `unsafe-eval`.
- **VI. Security Paths Require Tests** — PASS, and *expanded*: the CSRF-cookie-issuance change is
  exactly the kind of change Art. VI requires tests for; `tests/python/test_csrf.py` gets new cases
  (cookie is set on a bare GET with no prior session; double-submit check still rejects
  mismatched/missing pairs) alongside new `tests/python/test_roadmap_api.py` coverage for every
  route.
- **VII. Versioning Discipline** — PASS. `APP_VERSION` bump (deps.py, README badge, CHANGELOG,
  SPEC §1.3) happens once, at the end of M6 when the feature actually ships end-to-end — not
  per-milestone.

**Spec & security baseline**:
- [x] `specs/SPEC.md` updated in the same commit as the shipped behavior (planned for M6, or M2 if
      the CSRF-cookie fix is judged to warrant its own immediate SPEC note — see tasks.md).
- [x] No new outbound network paths; no CDN assets.
- [x] Vanilla HTML/CSS/JS, no frameworks/build tools; persistence via DevDB only.
- [x] N/A — no Vault/SSH-blob/cookie-jar code touched.
- [x] No `innerHTML` with untrusted data; no document CSP changes; no new inline `<script>`.
- [x] CSRF-cookie-issuance change lands with tests (Art. VI, see above). No other
      auth/session/rate-limiting/PBKDF2/AES-GCM/WebSocket-gate/CORS-proxy code is touched.
- [x] Version bump deferred to M6 ship point, then done atomically across all four locations.
- [x] Static-analysis gates: no new patterns introduced that would trip SonarCloud/CodeQL (plain
      `createElement`/`textContent` DOM writes, parameterized DevDB store access, no `eval`/`exec`).

**New-tool / UI cross-cutting checklist**:
- [x] Tool count (12 → 13) updated together in `routes/pages.py`, `static/tools.html`,
      `static/home.html`, README, SPEC at M6; `tools.html`'s static filter-count spans updated to
      match what `updateFilterCounts()` will recompute at runtime.
- [x] No UMD bundle involved — Monaco/RequireJS load order is unchanged (roadmap.html follows the
      exact same `<script>` ordering Notes Workspace already uses and already passes
      `test_asset_order.py`).
- [x] No scripting/eval feature added — `script-sandbox-worker.js`/its scoped CSP is untouched.
- [x] `routes/ssh.py` is not touched by this feature.
- [x] Icons are stroke-based inline SVG (matches every existing `tool-card` in `tools.html`); no
      emoji. Design tokens sourced from `static/style.css`; theming via existing `static/theme.js`
      (no new tokens per the locked "reuse existing card/glassmorphic tokens" decision).
- [x] No new third-party JS — N/A for SPEC §11 / `UPGRADE_PLAN.md`.

No violations — Complexity Tracking table is empty (see below).

## Project Structure

### Documentation (this feature)

```text
specs/018-learning-roadmap/
├── plan.md              # This file
├── research.md           # Phase 0 output
├── data-model.md          # Phase 1 output
├── quickstart.md          # Phase 1 output
├── contracts/
│   └── roadmap-api.md    # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root)

Single-project web application — existing DevSuite monolith. New/changed paths:

```text
devsuite/
├── deps.py                        # + "roadmaps" added to _ALLOWED_STORES
├── main.py                        # CSRF-cookie-issuance fix (mint ds_csrf for every visitor)
├── roadmap_utils.py                # NEW — compute_completion(roadmap) -> dict, pure, no I/O
├── routes/
│   ├── pages.py                    # + GET /roadmap -> _serve_html("roadmap.html")
│   └── roadmap.py                  # NEW — /api/roadmaps* CRUD + PATCH routes
├── scripts/
│   └── seed_roadmap.py             # NEW — one-off seed for ai-mlops-roadmap
├── static/
│   ├── roadmap.html                # NEW — list view + detail view (?id= routing)
│   ├── roadmap.js                  # NEW — fetch/render/optimistic-toggle/Monaco init
│   ├── roadmap.css                 # NEW — reuses style.css tokens, no new tokens
│   ├── tools.html                  # + 13th tool-card, filter-count updates
│   └── home.html                   # + Learning Roadmap tile
├── tests/python/
│   ├── test_roadmap_api.py         # NEW — route + CSRF + 404/duplicate-id coverage
│   ├── test_roadmap_utils.py       # NEW — compute_completion unit tests (0/0 cases etc.)
│   └── test_csrf.py                # + cases for the cookie-issuance-for-everyone fix
├── specs/SPEC.md                   # + §4 tool row, §5 API section, §6 storage section
├── README.md, CHANGELOG.md, deps.py (APP_VERSION)   # version bump, at M6 ship point only
```

**Structure Decision**: Follows the exact per-tool convention already established by
Notes Workspace (017) and every other tool: one route module, one static
`toolname.html/js/css` trio, page route in `routes/pages.py`, DevDB store added to
`_ALLOWED_STORES`, pytest coverage in `tests/python/`. No new architectural pattern is
introduced; the one non-tool-local change (`main.py` CSRF-cookie fix) is a small, isolated
middleware edit gated by its own tests.

## Complexity Tracking

*No violations — table intentionally empty.*
