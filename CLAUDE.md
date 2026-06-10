# DevSuite — Claude Code Instructions

## Spec-Driven Development

**SPEC.md is the single source of truth for this project.**

Before writing any code, read `SPEC.md` fully. Every feature, behavior, API contract, constraint, and design rule is defined there.

### Rules

1. **Spec first.** If a task requires changing behavior, API shape, UI, or adding a feature — update `SPEC.md` before writing implementation code. Do not implement anything that contradicts the spec without first getting approval to update it.

2. **Verify against source.** When the spec and the code disagree, flag the discrepancy explicitly. Do not silently pick one — ask which is correct, then update the other.

3. **No undocumented behavior.** Every route, endpoint, store, environment variable, auth contract, and security rule must be in `SPEC.md`. If you add something new, add it to the spec in the same commit.

4. **Non-negotiable constraints** (from `SPEC.md §2`):
   - No `innerHTML` with untrusted data — use `createElement` + `textContent`.
   - No CDN fonts — always `@import '/static/libs/fonts.css'`.
   - No frameworks — vanilla HTML/CSS/JS only.
   - No external DB — all persistence via DevDB (`.dsb`).
   - Client-side encryption only — backend never decrypts vault or ssh_profiles blobs.
   - Do not add inline `<script>` tags — tracked as SEC-11 debt, do not worsen it.

5. **Security paths require tests.** Any change to auth, CSRF, session tokens, rate limiting, PBKDF2, AES-GCM, or the CORS proxy must have a corresponding test in `tests/python/` or `tests/javascript/`.

6. **Version bump protocol.** On every release, bump `APP_VERSION` in `main.py`, the badge in `README.md`, and the heading in `CHANGELOG.md` — all three, simultaneously. Then update the version in `SPEC.md §1.3`.

## Key Files

| File | Role |
|---|---|
| `SPEC.md` | Single source of truth — read first |
| `main.py` | Entire backend (routes, WebSocket, auth, proxy, DevDB REST API) |
| `devdb.py` | Storage engine — KeePass-style `.dsb` binary |
| `static/style.css` | Global design tokens — all CSS vars live here |
| `static/theme.js` | Theme manager — 6 themes, fires `devsuite-theme-changed` |
| `static/auth-guard.js` | 8-hour session auth for DevDB-backed tools |
| `static/devdb-client.js` | JS wrapper around `/api/db/*` |

## What NOT to Do

- Do not read `static/libs/**` or any `*.min.js` file — they are vendored bundles and will exhaust context.
- Do not run the server or browser tests without being asked.
- Do not commit directly — propose the commit message and wait for approval.
- Do not add third-party JS libraries without updating `SPEC.md §11` and `UPGRADE_PLAN.md`.

## Running Tests

- Backend suite: `pytest tests/python/` (31 tests, all should pass). Covers the SPEC §10.2 security-critical paths. **There is no JS test suite yet** (v1.0.0 deliverable).
- CI runs the suite via `.github/workflows/tests.yml` (push/PR, Python 3.10 + 3.12). Still run it locally before claiming a change is verified.
- DevSuite ships **12 tools**. The source of truth for the tool list is `routes/pages.py` (routes) + `static/tools.html` (cards) — not prose in README. Keep README/SPEC/`tools.html`/`home.html` counts in sync when adding or removing a tool.

## Gotchas (as of 2026-06-10, v0.2.4)

- **`unsafe-eval`** in the CSP is a hard dependency of the API Tester scripting feature (`new Function()`) — don't try to "harden" it away without removing that feature.
- **WebSocket auth (SEC-14):** the SSH/dashboard/local-terminal sockets are gated by `_ws_require_session` only *once a master password is configured*. Before setup they're open (no-password local-terminal flow). Keep that carve-out if you touch `routes/ssh.py`.
- **No emoji in UI chrome** (SPEC §9.8/§9.9) — use stroke-based inline SVG. `auth-guard.js` and the DevDB Manager (`db-manager.html` + `db-manager.js`) were converted in v0.2.4. Don't add new emoji; copy the existing inline-SVG pattern.
- **`tools.html` filter counts** are recomputed from the DOM at runtime (`updateFilterCounts()`); the static HTML values are just the pre-JS paint — keep both correct.
