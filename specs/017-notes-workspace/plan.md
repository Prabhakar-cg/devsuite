# Implementation Plan: Notes Workspace

**Branch**: `017-notes-workspace` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-notes-workspace/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

A new DevSuite tool at `/notes`: a Notepad++-style multi-tab Markdown editor
(Monaco, already vendored) organized OneNote-style as Notebook → Section →
Page, with Obsidian-style `[[wiki-links]]`, an automatic backlinks panel,
inline `#tags`, and workspace-wide full-text search. Content is encrypted
client-side exactly like Secret Vault (WebCrypto PBKDF2-SHA256/310k +
AES-256-GCM), gated behind the shared DevSuite master password via the
existing `auth-guard.js` component, and persisted as one blob in a new
`notes` DevDB store — no new backend concepts, no external database, no new
outbound network path. The only genuinely new dependency is DOMPurify,
required to safely render user-authored Markdown to HTML without opening a
stored-XSS hole (see `research.md` item 5).

## Technical Context

**Language/Version**: Python 3.10+ (backend, matches existing `routes/*.py`); vanilla ES2021+ JavaScript, no build step (frontend, matches every existing tool)

**Primary Dependencies**: FastAPI (existing); Monaco Editor + RequireJS (existing, `static/libs/vs/`, `static/libs/require.min.js`); `marked` v18.0.9 (existing, `static/libs/marked.min.js`); **DOMPurify (new — see research.md item 5)**; CryptoJS is *not* used (Vault's v2 scheme uses WebCrypto `crypto.subtle` directly, no library)

**Storage**: DevDB (`devdb.py`) — one new store, `"notes"`, holding a single AES-256-GCM-encrypted JSON blob (see `data-model.md`). No SQLite/Postgres/Redis/external DB.

**Testing**: `pytest tests/python/` for the new `GET/POST /api/notes` endpoints and the `_ALLOWED_STORES` addition (mirroring existing `test_vault_api.py`-style coverage); `node tests/javascript/run.js` for any pure-function client logic that's extracted testably (wiki-link parsing, tag extraction, title-uniqueness validation) — these are prime candidates for the JS unit suite since they're pure string→data transforms, following the pattern already set by `static/curl-codegen.js`/`static/cookie-jar.js`/`static/collection-utils.js`.

**Target Platform**: Self-hosted local web app, same as every other DevSuite tool — modern evergreen browsers (WebCrypto + Monaco's baseline requirement already sets the floor).

**Project Type**: Single-project web application (existing DevSuite monolith — FastAPI backend + vanilla JS frontend under `static/`). No frontend/backend split beyond what already exists.

**Performance Goals**: Tab switch <150ms (SC-002); wiki-link autocomplete <200ms up to 500 pages (SC-003); full-text search <1s up to 500 pages (SC-005) — all achievable with synchronous in-memory operations over a decrypted tree of this size (research.md item 6), no async/indexed search infrastructure needed.

**Constraints**: Offline-first, no CDN assets (Constitution Art. II); no `innerHTML` with unsanitized content (Art. V — directly shapes the DOMPurify decision); master password never persisted (Art. IV); vanilla stack, no frameworks/build tools (Art. III).

**Scale/Scope**: Single-user local workspace; up to ~500 pages / one notes tree per installation (per Success Criteria) — not a multi-tenant or multi-workspace design (see spec.md Assumptions).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Core principles (I–VII):**

- **I. Spec First** — PASS. `spec.md` exists and precedes this plan; on
  completion this feature's durable contracts (new `/api/notes` routes, new
  `notes` DevDB store, new dependency) fold back into `SPEC.md` §4 (tool
  index), §5 (API), §6 (storage), §11 (dependencies) in the same commit
  series that ships the feature, per Constitution Art. I.
- **II. Local-Only, Offline-First** — PASS. Zero new outbound network
  paths; Notes talks only to DevSuite's own backend, same-origin, same as
  every other DevDB-backed tool.
- **III. Vanilla Stack, Single Store** — PASS. No frameworks, no build
  tools, no new database — one new DevDB store (`notes`), reusing already-
  vendored Monaco. DOMPurify is the one new *vendored static asset*, not a
  new persistence mechanism or framework; see Complexity Tracking below for
  why it's justified rather than a violation.
- **IV. Client-Side Encryption Boundary (NON-NEGOTIABLE)** — PASS.
  `research.md` items 1–2 mirror Vault's v2 scheme exactly; backend only
  ever stores/returns opaque ciphertext (`contracts/notes-api.md`); master
  password held in memory only, never `localStorage`/`sessionStorage`
  (reusing `auth-guard.js`'s existing, already-compliant handling).
- **V. DOM and CSP Hardening** — PASS, contingent on the DOMPurify addition
  actually shipping (research.md item 5) — this is the one place this
  feature has genuine, non-trivial exposure (rendering user-authored
  Markdown as HTML) if that item is skipped. No `innerHTML` with untrusted
  data anywhere else (tree/tab/tag/search UI all use `createElement`/
  `textContent`, same convention as every DevSuite tool rebuilt this
  session). No document-CSP changes; Notes has no scripting/eval feature,
  so the `unsafe-eval` scoped exception is irrelevant here.
- **VI. Security Paths Require Tests** — PASS/N/A. Notes does not touch
  auth, CSRF, sessions, rate limiting, PBKDF2/AES-GCM *implementation*, the
  WebSocket gate, or the CORS proxy — it *reuses* all of those unchanged.
  The one security-relevant net-new surface (Markdown→HTML sanitization) is
  not in SPEC §10.2's enumerated list, but a test asserting DOMPurify
  actually strips a script-injection payload belongs in
  `tests/javascript/` regardless, added as a task.
- **VII. Versioning Discipline** — Addressed at ship time, not plan time:
  `APP_VERSION` bump / README badge / CHANGELOG / `SPEC.md §1.3` land
  together in the release commit, per existing protocol — captured as a
  `/speckit-tasks` item, not evaluated here.

**Spec & security baseline**:
- [ ] `specs/SPEC.md` updated in the same commit as the shipped feature —
      deferred to implementation (tracked, not yet done at plan time).
- [x] No new outbound network paths; no CDN assets — DOMPurify and every
      other asset self-hosted under `/static/libs/`.
- [x] Vanilla HTML/CSS/JS, no frameworks/build tools; all persistence via
      DevDB.
- [x] Backend never decrypts the `notes` blob; master password never
      transmitted/stored (only `Kauth`, an opaque derived key, ever reaches
      the server, via the existing `/api/auth/session` contract — unchanged
      by this feature).
- [x] No `innerHTML` with untrusted data — contingent on DOMPurify shipping
      for the one place raw-HTML rendering is unavoidable (Markdown
      preview); everywhere else uses `createElement`/`textContent`.
- [x] N/A — no auth/CSRF/session/rate-limiting/PBKDF2/AES-GCM/WebSocket/
      CORS-proxy *changes* (all reused as-is).
- [ ] Release path (`APP_VERSION`, README, CHANGELOG, `SPEC.md §1.3`) —
      deferred to the ship-time task, per Art. VII above.
- [ ] Static-analysis gates green — evaluated post-implementation (SonarCloud/
      CodeQL/CodeRabbit/Snyk), not at plan time.

**New-tool / UI cross-cutting checklist**:
- [ ] Tool count sync (12 → 13) across `routes/pages.py`, `static/tools.html`
      (including its DOM-recomputed filter counts), `static/home.html`,
      `README.md`, `SPEC.md` — tracked as explicit tasks (research.md item 8).
- [ ] DOMPurify (new UMD bundle) loads **before** `require.min.js` in
      `notes.html`, alongside `marked.min.js` — tracked as an explicit task,
      with a corresponding new assertion in `tests/python/test_asset_order.py`
      (research.md item 5).
- [x] N/A — Notes has no scripting/eval feature; does not touch the
      script-sandbox worker or its scoped CSP.
- [x] N/A — does not touch `routes/ssh.py`.
- [ ] Icons are stroke-based inline SVG, no emoji — design commitment,
      verified in `/speckit-implement` against the same standard just
      applied to `static/ssh-manager.html` in this codebase.
- [ ] DOMPurify addition updates `SPEC.md §11` **and** `UPGRADE_PLAN.md` —
      tracked as an explicit task (research.md item 5, Complexity Tracking
      below).

## Project Structure

### Documentation (this feature)

```text
specs/017-notes-workspace/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── notes-api.md     # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Single-project structure (Option 1 from the template) — matches how every
existing DevSuite tool is laid out; no frontend/backend split beyond the
existing FastAPI-serves-static-HTML/JS pattern.

```text
routes/
└── storage.py              # ADD: GET/POST /api/notes (mirrors get_vault/save_vault)

deps.py                      # EDIT: _ALLOWED_STORES gains "notes"

static/
├── notes.html               # NEW: page shell — tree sidebar, tab strip, editor pane,
│                             #      backlinks panel, tag browser, search palette
├── notes.css                # NEW: component styles, theme-token based (no hardcoded hex,
│                             #      per the lesson from the ssh-manager.html rework this
│                             #      session)
├── notes.js                 # NEW: unlock flow (auth-guard.js), Kenc derive/encrypt/decrypt
│                             #      (mirrors vault.js's v2 functions), tree CRUD, Monaco
│                             #      wiring, wiki-link/tag/backlink indexing, debounced
│                             #      autosave, search
└── libs/
    └── dompurify.min.js      # NEW vendored dependency (research.md item 5)

specs/SPEC.md                 # EDIT (at ship time): §4 tool index, §5 API, §6 storage, §11 deps
UPGRADE_PLAN.md                # EDIT (at ship time): DOMPurify inventory row
README.md                      # EDIT (at ship time): tool count
static/tools.html              # EDIT: new tool card + filter counts
static/home.html               # EDIT: tool count

tests/python/
├── test_notes_api.py         # NEW: GET/POST /api/notes auth + persistence (mirrors
│                              #      existing vault API test file's structure)
└── test_asset_order.py       # EDIT: extend UMD-before-RequireJS assertion to /notes

tests/javascript/
└── notes-links.test.js       # NEW (naming indicative — actual file per run.js's existing
                               #      convention): pure-function tests for wiki-link
                               #      parsing/resolution, tag extraction, title-uniqueness
                               #      validation
```

**Structure Decision**: Extends the existing single-project DevSuite layout
with one new route (in the existing `routes/storage.py`, not a new router
file — it's three more lines of the same pattern, not a new concern) and one
new self-contained `static/notes.{html,css,js}` tool, exactly mirroring how
every prior tool (most recently `static/ssh-manager.*`) is structured.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New vendored dependency: DOMPurify (Constitution "Additional Constraints": new third-party JS requires `SPEC.md §11` + `UPGRADE_PLAN.md` updates — a process requirement, not a principle violation, but flagged here for visibility) | Markdown preview must render user-authored content as HTML (headings, lists, links, code blocks); `marked` v18 ships no sanitizer, and unsanitized `innerHTML` of arbitrary Markdown-derived HTML is a stored-XSS hole re-executed every time a page is reopened (research.md item 5) | Regex-based manual sanitization — rejected as incomplete/bypassable, a known-bad pattern; disabling raw-HTML passthrough in `marked` alone — rejected as insufficient (leaves link-based and parser-edge-case vectors open); `textContent`-only rendering — rejected, defeats the purpose of a rendered Markdown preview which every one of the three inspiring apps (Notepad++ excluded, but OneNote and Obsidian both) provides |
