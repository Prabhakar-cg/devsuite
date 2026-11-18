# DevSuite — Claude Code Instructions

## Spec-Driven Development (Spec Kit)

This project uses GitHub Spec Kit. **The spec-kit tree is the single source of truth:**

- `.specify/memory/constitution.md` — non-negotiable principles. Read first; every plan and implementation must comply.
- `specs/SPEC.md` — the master specification for everything *cross-cutting*: backend API surface, storage engine, security model, design system, versioning. §4 is now just an index — tool behavior lives in each tool's own folder (below). Code and tests cite it as `SPEC.md §<section>` — keep its § numbering stable.
- **Every tool has its own numbered spec folder** (`specs/NNN-tool-slug/`), same layout as any spec-kit feature — `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`, `checklists/`:
  `002-diff-checker` · `003-json-linter` · `004-yaml-linter` · `005-regex-tester` · `006-base64-encoder` · `007-crypto-suite` · `008-api-tester` · `009-secure-terminal-sftp` · `010-cron-visualizer` · `011-secret-vault` · `012-db-manager` · `013-file-converter` · `014-id-generator` · `015-xml-linter` · `016-data-linter` · `017-notes-workspace` · `018-learning-roadmap`.
  `specs/001-devsuite-baseline/spec.md` is the historical whole-system baseline predating this split — kept for record, superseded by the per-tool specs above for tool-specific detail.
- **New features get the next number after the highest existing one** (currently `018-`): `/speckit-specify` creates `specs/NNN-name/`, then `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. When a feature ships, fold its durable cross-cutting contracts back into `specs/SPEC.md` (§5–§12, and add a row to the §4 index) in the same commit. A fix or extension to an *existing* tool updates that tool's own `specs/NNN-tool-slug/` folder, not a new one.
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
- CI runs the suite via `.github/workflows/tests.yml` (push/PR, Python 3.11 + 3.12). Still run it locally before claiming a change is verified.
- DevSuite ships **16 tools**. The source of truth for the tool list is `routes/pages.py` (routes) + `static/tools.html` (cards) — not prose in README. Keep README/SPEC/`tools.html`/`home.html` counts in sync when adding or removing a tool.

## Gotchas (as of 2026-06-10, v0.3.0)

- **CSP split (SEC-6):** document responses carry **no `unsafe-eval`**. API Tester scripting runs in `static/script-sandbox-worker.js`, whose response gets its own scoped CSP (`script-src 'self' 'unsafe-eval'; connect-src 'none'`) via a path check in `main.py`'s security-headers middleware. Don't add `unsafe-eval` back to the document policy, and don't rename the worker file without updating `_SANDBOX_WORKER_PATH` and `tests/python/test_csp.py`.
- **Cookie jar is in-memory only** (SPEC §4.7.5) — never persist it to DevDB or `localStorage`; that's a deliberate security boundary, not an oversight.
- **UMD bundles must load BEFORE `require.min.js`** (`jszip.min.js`, `crypto-js.min.js`). When `define.amd` exists, a UMD bundle registers as an anonymous AMD module instead of setting its global, and RequireJS then throws "Mismatched anonymous define()" on the page's next `require()` call — which kills the whole tool script (every button dead). Guarded by `tests/python/test_asset_order.py`.
- **WebSocket auth (SEC-14):** the SSH/dashboard/local-terminal sockets are gated by `_ws_require_session` only *once a master password is configured*. Before setup they're open (no-password local-terminal flow). Keep that carve-out if you touch `routes/ssh.py`.
- **No emoji in UI chrome** (SPEC §9.8/§9.9) — use stroke-based inline SVG. `auth-guard.js` and the DevDB Manager (`db-manager.html` + `db-manager.js`) were converted in v0.2.4. Don't add new emoji; copy the existing inline-SVG pattern.
- **Accessibility foundation (023, SPEC §9.12):** `a11y.css`, `a11y.js` and a skip link are injected into every page by `_serve_html()` — never link them from a `.html`. Every page needs exactly one `<main>`/`role="main"`; text colors must use the text-safe tokens (`--text-muted`, `--*-text`); UI font-size floor is 12px (`var(--text-xs)`); use `DevSuite.toast`/`DevSuite.a11y.announce` for status messages. `tests/python/test_a11y.py` enforces this, including a computed contrast matrix over all 6 themes (`tests/python/a11y_tokens.py`).
- **Theme layer (024, SPEC §9.13):** `static/theme-layer.css` is injected on every page and assigns the canonical tokens (`--bg`, `--text`, `--border`, `--on-accent`, `--*-text`, …) per theme via `html[data-theme]`, which beats each tool stylesheet's local `:root` palette. Change theme colours there, not in per-page copies. Injection checks in `_serve_html()` match full asset paths — don't write an asset filename in a page comment expecting it to be harmless. When verifying visually, scan with reduced motion (entrance animations skew axe) and restart the server after Python edits.
- **Network boundary (025, SPEC §7.9):** every request's `Host` must be allowlisted (`localhost`/`127.0.0.1`/`::1` + `DEVSUITE_ALLOWED_HOSTS`) and mutating requests with a foreign `Origin` get 403 — tests that use TestClient rely on `DEVSUITE_ALLOWED_HOSTS=testserver` set in `tests/python/conftest.py`. SFTP/WSL endpoints use `require_session_if_configured`. The proxy validates the *connected* peer address (`routes/proxy.py::_GuardedHTTP*Connection`) — don't replace its opener with a plain `urlopen`.
- **Script injection (`_serve_html`)** inserts before the *final* `</body>` (a page may contain `</body>` inside a JS string — File Converter does). Never use `html.replace('</body>', …, 1)`. `tests/python/test_a11y.py` parses every page's inline scripts after injection.
- **No Chart.js:** the SSH dashboard uses `static/mini-chart.js`; don't re-add a `chart.js` script tag (it was never vendored and 404s).
- **Bento showcase (026, SPEC §9.14):** the tile grid on Home/Tools is generated art (`static/bento-art.js`) tinted from theme tokens (`bento.css`) — add tiles via data + the same markup in both pages; keep tile hrefs in `command-palette-data.js`; no hex colours or images in it.
- **Tool-page bento skin (028, SPEC §9.15):** tool-page tiles use `--tk-radius` (16px, same as the Home bento; `!important`, so change the token, not per-tile radii) and buttons/badges are pills; pages opt in with `<body data-tool="…">`; `toolskin.css` (injected) may only change gap/padding/margin/background/border/radius/outline on tiles — never layout properties (test-enforced). Use generated `<svg class="tk-art" data-art="…">` for empty states, never emoji. Rate limit: `/api/auth/challenge` is 5/min/IP, so browser tests that unlock many times must pace (or restart the server).
- **Vendored JS + lint (v0.18.0):** keep `package.json`, `scripts/versions.json`, `UPGRADE_PLAN.md` and SPEC §11 in sync when you update anything under `static/libs`, and run `npm audit` (see CI `vendored-js-audit`). `ruff check .` must stay clean (`ruff.toml`). The Docker image runs as non-root with `HOME=/data`; the compose file publishes on loopback only — don't change that.
- **Icons & scanner (v0.19.0):** no emoji in the UI — use `static/icons.js` (`DevSuiteIcons.element()` in JS, `markup()` for static HTML); a test enforces it. The Secret Scanner engine (`secret-scanner.js`) must stay pure (no DOM/network/storage — test-enforced). Adding a tool means updating the count in tools.html, home.html, the palette data/test, SPEC §4, README and the constitution.
- **`tools.html` filter counts** are recomputed from the DOM at runtime (`updateFilterCounts()`); the static HTML values are just the pre-JS paint — keep both correct.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/018-learning-roadmap/plan.md
<!-- SPECKIT END -->
