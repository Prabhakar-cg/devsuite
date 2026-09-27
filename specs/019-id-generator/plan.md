# Implementation Plan: ID Generator

**Branch**: `019-id-generator` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-id-generator/spec.md`

## Summary

Ship DevSuite's 14th tool, an **ID Generator**, at `/id-generator`. It bulk-generates
identifiers of five types — UUID v4, UUID v7, ULID, CUID2, NanoID — entirely client-side,
with per-type entropy inspection and timestamp decoding for the time-based types. All
randomness comes from `crypto.getRandomValues`; there is no backend endpoint, no store, and
no master-password gate (same unauthenticated tier as Diff / Data Format Linter / Regex /
Cron). Generation logic lives in a **pure, dual-export JS module** (`static/id-gen.js`) so it
can be unit-tested under Node with the existing zero-dependency runner, mirroring the
`curl-codegen.js` / `cookie-jar.js` pattern.

## Technical Context

**Language/Version**: Python 3.10+ (FastAPI) for the single page route; vanilla ES2020 JS for the tool.

**Primary Dependencies**: FastAPI (existing). Browser Web Crypto (`crypto.getRandomValues`) and the async Clipboard API. **No new third-party JS libraries.**

**Storage**: None. Generated identifiers are in-memory only and never persisted (FR-014).

**Testing**: `pytest tests/python/` for the route/asset wiring; `node tests/javascript/run.js` for the pure `id-gen.js` module (format conformance, distinctness, entropy facts, timestamp decode).

**Target Platform**: Modern browser over loopback (secure context) — the suite's standard target.

**Project Type**: Web application (FastAPI backend serving static vanilla-JS tools).

**Performance Goals**: Generate a 1000-identifier batch and render it without freezing the tab (SC-001, FR-011 cap).

**Constraints**: Offline-first, no network, no CDN, no build step, no `innerHTML` with generated content, no new inline `<script>`.

**Scale/Scope**: One page (`id-generator.html`), one pure module (`id-gen.js`), one stylesheet (`id-generator.css`), one page route, tool-listing + homepage wiring, one JS test file. No backend logic, no schema, no migration.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Core principles (I–VII):**
- **I. Spec First** — `spec.md` authored before any code; `specs/SPEC.md` §1.3 (version), the tool inventory, and the tool-count references are updated in the same commit as the implementation. PASS.
- **II. Local-Only, Offline-First** — no network calls, no CDN, no new runtime asset fetched remotely; all JS self-hosted under `/static/`. Randomness is local (`crypto.getRandomValues`). PASS.
- **III. Vanilla Stack, Single Store** — vanilla HTML/CSS/JS, no framework, no build tool. No persistence at all, so no store is touched (DevDB untouched). PASS.
- **IV. Client-Side Encryption Boundary** — N/A; the tool handles no secrets, no vault/SSH blobs, no master password.
- **V. DOM and CSP Hardening** — generated identifiers inserted via `createElement` + `textContent`, never `innerHTML`. No inline `<script>` (all JS external). No `unsafe-eval`; document CSP unchanged. PASS.
- **VI. Security Paths Require Tests** — N/A to auth/CSRF/session/crypto-primitive paths; none are touched. (JS unit tests are still added for the generator per DX-10, though not mandated by Art. VI.)
- **VII. Versioning Discipline** — `deps.py APP_VERSION`, README badge, `CHANGELOG.md` heading, and `specs/SPEC.md` §1.3 bumped together; cache busting stays automatic via `_serve_html()`. PASS.

**Spec & security baseline:**
- [x] `specs/SPEC.md` updated in the same commit — new tool row + tool-count + §1.3 version.
- [x] No new outbound network paths; no CDN assets.
- [x] Vanilla HTML/CSS/JS, no frameworks/build tools; no new database.
- [x] Backend never decrypts blobs / master password untouched — N/A, no secrets handled.
- [x] No `innerHTML` with untrusted data; no `unsafe-eval`; no new inline `<script>`.
- [x] Auth/CSRF/session/crypto paths untouched — no such change in this feature.
- [x] Release path bumps `deps.py` + README + CHANGELOG + SPEC §1.3 together; cache busting automatic.
- [x] Static-analysis gates (SonarCloud/CodeQL/CodeRabbit/Snyk) stay green — pure client logic, no new backend surface.

**New-tool / UI cross-cutting checklist:**
- [x] Tool count synced across `routes/pages.py`, `static/tools.html`, `static/home.html`, README, SPEC; `tools.html` static filter counts (`All`, `Dev`) bumped to match the DOM `updateFilterCounts()` recomputes. ID Generator is category **dev**, so `All 13→14` and `Dev 5→6`.
- [x] No UMD bundle added — no `require.min.js` ordering concern. (`id-gen.js` is a plain module loaded with `<script defer>`.)
- [x] No scripting/eval feature — sandbox worker and its scoped CSP untouched.
- [x] `routes/ssh.py` untouched — WebSocket carve-out unaffected.
- [x] Icons are stroke-based inline SVG; no emoji in UI chrome. Design tokens from existing CSS; themes via `theme.js`.
- [x] No new third-party JS → no SPEC §11 / `UPGRADE_PLAN.md` dependency entry required.

**Result: PASS — no violations, Complexity Tracking not required.**

## Project Structure

### Documentation (this feature)

```text
specs/019-id-generator/
├── plan.md              # This file
├── research.md          # Phase 0 — algorithm/format decisions
├── data-model.md        # Phase 1 — in-memory entities & type facts table
├── quickstart.md        # Phase 1 — how to run/verify the tool
├── contracts/           # N/A — no HTTP API (client-only tool); intentionally empty
└── tasks.md             # Phase 2 — /speckit-tasks output
```

### Source Code (repository root)

```text
static/
├── id-generator.html    # Tool page (uses shared header/theme/nav pattern like base64.html)
├── id-gen.js            # PURE dual-export module: generators + entropy facts + decoders
├── id-generator.js      # Thin DOM controller: wires form → id-gen.js → render + copy
└── id-generator.css     # Tool-scoped styling using existing design tokens

routes/
└── pages.py             # + GET /id-generator → _serve_html("id-generator.html")

static/tools.html        # + tool card (data-category="dev"); filter counts All/Dev bumped
static/home.html         # + tool reference / count sync
specs/SPEC.md            # + tool row, tool count, §1.3 version bump
deps.py                  # APP_VERSION bump
README.md                # version badge + tool count
CHANGELOG.md             # new version heading

tests/javascript/
├── run.js               # existing runner — register the new test file
└── test-id-gen.js       # NEW: format conformance, distinctness, entropy, timestamp decode
```

**Structure Decision**: Mirrors the established per-tool layout (see `base64.html`,
`cron.html`, `roadmap.*`). The single novel decision is splitting generation into a **pure
`id-gen.js`** (no DOM, dual `module.exports` / global export) from a thin `id-generator.js`
DOM controller, so the algorithmic core is Node-testable via the existing zero-dependency
runner — extending the DX-10 pure-module test pattern.

## Complexity Tracking

> No Constitution Check violations. Section intentionally empty.
