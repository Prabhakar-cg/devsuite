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
