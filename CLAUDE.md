# DevSuite — Claude Code Instructions

## Spec-Driven Development (Spec Kit)

This project uses GitHub Spec Kit. **The spec-kit tree is the single source of truth:**

- `.specify/memory/constitution.md` — non-negotiable principles. Read first; every plan and implementation must comply.
- `specs/SPEC.md` — the master specification for everything *cross-cutting*: backend API surface, storage engine, security model, design system, versioning. §4 is now just an index — tool behavior lives in each tool's own folder (below). Code and tests cite it as `SPEC.md §<section>` — keep its § numbering stable.
- **Every tool has its own numbered spec folder** (`specs/NNN-tool-slug/`), same layout as any spec-kit feature — `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`, `checklists/`:
  `002-diff-checker` · `003-json-linter` · `004-yaml-linter` · `005-regex-tester` · `006-base64-encoder` · `007-crypto-suite` · `008-api-tester` · `009-secure-terminal-sftp` · `010-cron-visualizer` · `011-secret-vault` · `012-db-manager` · `013-file-converter` · `014-id-generator` · `015-xml-linter` · `016-data-linter` · `017-notes-workspace`.
  `specs/001-devsuite-baseline/spec.md` is the historical whole-system baseline predating this split — kept for record, superseded by the per-tool specs above for tool-specific detail.
- **New features get the next number after the highest existing one** (currently `017-`): `/speckit-specify` creates `specs/NNN-name/`, then `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. When a feature ships, fold its durable cross-cutting contracts back into `specs/SPEC.md` (§5–§12, and add a row to the §4 index) in the same commit. A fix or extension to an *existing* tool updates that tool's own `specs/NNN-tool-slug/` folder, not a new one.
- If implementation stalls or drifts from the spec, `/speckit-converge` audits the codebase against the feature's spec/plan/tasks and appends the remaining unbuilt work to `tasks.md` so `/speckit-implement` can finish it.
- Every plan must fill in the Constitution Check gates in `plan-template.md` — including the spec/security baseline and the new-tool cross-cutting checklist — before Phase 0 research.

Rules (full text in the constitution):

1. **Spec first.** Behavior/API/UI changes update the spec before implementation code.
2. **Verify against source.** When spec and code disagree, flag the discrepancy explicitly — never silently pick one.
3. **No undocumented behavior.** Every route, endpoint, store, env var, auth contract, and security rule must be in `specs/SPEC.md`, added in the same commit.
4. **Security paths require tests** (auth, CSRF, sessions, rate limiting, PBKDF2, AES-GCM, CORS proxy) — in `tests/python/` or `tests/javascript/`.
5. **Version bump protocol.** Bump `APP_VERSION` in `deps.py`, the `README.md` badge, the `CHANGELOG.md` heading, and `specs/SPEC.md` §1.3 simultaneously.

## Key Files

| File | Role |
|---|---|
| `specs/SPEC.md` | Master specification (cross-cutting) — read first |
| `specs/NNN-tool-slug/` | Per-tool spec/plan/tasks — read for that tool's behavior/history |
| `main.py` | Backend orchestrator (app factory, middleware, routers) |
| `deps.py` | Shared singletons, `APP_VERSION` |
| `devdb.py` | Storage engine — KeePass-style `.dsb` binary |
| `static/style.css` | Global design tokens — all CSS vars live here |
| `static/theme.js` | Theme manager — 6 themes, fires `devsuite-theme-changed` |
| `static/auth-guard.js` | 8-hour session auth for DevDB-backed tools |
| `static/devdb-client.js` | JS wrapper around `/api/db/*` |

## What NOT to Do

- Do not read `static/libs/**` or any `*.min.js` file — they are vendored bundles and will exhaust context.
- Do not run the server or browser tests without being asked.
- Do not commit directly — propose the commit message and wait for approval.
- Do not add third-party JS libraries without updating `specs/SPEC.md §11` and `UPGRADE_PLAN.md`.

## Running Tests

- Backend suite: `pytest tests/python/` (41 tests, all should pass). Covers the SPEC §10.2 security-critical paths.
- JS unit suite: `node tests/javascript/run.js` (zero dependencies). Covers the pure modules `static/curl-codegen.js`, `static/cookie-jar.js`, and `static/collection-utils.js`. Browser/e2e tests are still a v1.0.0 deliverable.
- CI runs the suite via `.github/workflows/tests.yml` (push/PR, Python 3.10 + 3.12). Still run it locally before claiming a change is verified.
- DevSuite ships **12 tools**. The source of truth for the tool list is `routes/pages.py` (routes) + `static/tools.html` (cards) — not prose in README. Keep README/SPEC/`tools.html`/`home.html` counts in sync when adding or removing a tool.

## Gotchas (as of 2026-06-10, v0.3.0)

- **CSP split (SEC-6):** document responses carry **no `unsafe-eval`**. API Tester scripting runs in `static/script-sandbox-worker.js`, whose response gets its own scoped CSP (`script-src 'self' 'unsafe-eval'; connect-src 'none'`) via a path check in `main.py`'s security-headers middleware. Don't add `unsafe-eval` back to the document policy, and don't rename the worker file without updating `_SANDBOX_WORKER_PATH` and `tests/python/test_csp.py`.
- **Cookie jar is in-memory only** (SPEC §4.7.5) — never persist it to DevDB or `localStorage`; that's a deliberate security boundary, not an oversight.
- **UMD bundles must load BEFORE `require.min.js`** (`jszip.min.js`, `crypto-js.min.js`). When `define.amd` exists, a UMD bundle registers as an anonymous AMD module instead of setting its global, and RequireJS then throws "Mismatched anonymous define()" on the page's next `require()` call — which kills the whole tool script (every button dead). Guarded by `tests/python/test_asset_order.py`.
- **WebSocket auth (SEC-14):** the SSH/dashboard/local-terminal sockets are gated by `_ws_require_session` only *once a master password is configured*. Before setup they're open (no-password local-terminal flow). Keep that carve-out if you touch `routes/ssh.py`.
- **No emoji in UI chrome** (SPEC §9.8/§9.9) — use stroke-based inline SVG. `auth-guard.js` and the DevDB Manager (`db-manager.html` + `db-manager.js`) were converted in v0.2.4. Don't add new emoji; copy the existing inline-SVG pattern.
- **`tools.html` filter counts** are recomputed from the DOM at runtime (`updateFilterCounts()`); the static HTML values are just the pre-JS paint — keep both correct.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/017-notes-workspace/plan.md
<!-- SPECKIT END -->
