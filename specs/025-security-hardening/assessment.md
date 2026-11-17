# Independent Assessment — DevSuite (2026-11-17)

Scope: backend (`main.py`, `deps.py`, `devdb.py`, `routes/*`), frontend DOM-sink review, dependency scan, and a live-browser smoke test of all 22 page routes plus end-to-end flows (master-password setup/unlock, vault save, DevDB unlock, SFTP gate, proxy SSRF probes, uploads/conversion). Method: code review + `pip-audit` + `bandit` + headless Chromium with axe (see features 023/024 for the accessibility pass).

## Security

| ID | Severity | Finding | Status |
|---|---|---|---|
| SEC-15 | High | No `Host` validation → DNS-rebinding makes a hostile page same-origin (CORS + CSRF cookie both bypassed) | **Fixed** |
| SEC-16 | High | WS origin check trusted the attacker-controlled `Host`; no Origin check on mutating HTTP | **Fixed** |
| SEC-17 | High | `/api/sftp/*` and `/api/wsl/discover` not session-gated after setup | **Fixed** |
| SEC-18 | Medium | Proxy SSRF: resolve/connect race, IPv4-mapped IPv6, `0.0.0.0`/`::`, env proxies | **Fixed** (connect-time peer check) |
| SEC-19 | Medium | Missing `frame-ancestors`/`base-uri`/`object-src`/`form-action`, Permissions-Policy, COOP/CORP; cacheable API responses | **Fixed** |
| SEC-20 | Medium | docx/xlsx archive bombs | **Fixed** |
| SEC-21 | Low | Unbounded session table, no failed-auth audit, unthrottled `/api/auth/setup` | **Fixed** |
| SEC-22 | Medium | Master-password KDF 310k (guidance ≥ 600k) + unauthenticated challenge → offline guessing | **Open** — needs vault re-encryption migration + crypto harness (BACKLOG) |
| SEC-11 | Low | CSP `unsafe-inline` | Open (known; needs inline scripts moved first) |

Clean results: `pip-audit -r requirements.txt` → no known vulnerabilities; `bandit` → 0 issues; frontend DOM sinks safe (constants/ints or DOMPurify-sanitised markdown).

Verified in a real browser after the changes: setup → session → vault save (200s); DevDB unlock; roadmap/upload/convert POSTs succeed with real `Origin`; proxy to `127.0.0.1`, `0.0.0.0`, `::ffff:127.0.0.1` → 403; SFTP without session → 401.

## Functional defects found by running the product (not by static review)

| # | Defect | Impact | Fix |
|---|---|---|---|
| F-1 | `_serve_html()` injected the palette/a11y scripts before the **first** `</body>`; `file-converter.html` has one inside a JS template literal, so the injected tags landed inside the string and the page script died with `Unexpected end of input` | **File Converter fully dead** (since 0.11.0) | Insert before the final `</body>`; regression tests parse every page's inline scripts after injection |
| F-2 | DevDB Manager's unlock implemented only the legacy v1 challenge; all vaults created by current versions are v2 → "Incorrect master password" forever; it also called `DevSuite.csrfToken` without loading `components.js` | **DevDB Manager unusable on fresh installs** | New `master-verify.js` (v1+v2) + `components.js` include; 9 JS tests incl. a real WebCrypto v2 vector |
| F-3 | `ssh-manager.html` loaded `/static/libs/chart.js`, which was never vendored (404) and `updateDashboardGauges` bails without `Chart` | **SSH live dashboard (CPU/RAM/swap/uptime/disks) never rendered** | In-house dependency-free `mini-chart.js` (Chart.js-compatible subset, 9 JS tests); no new third-party library |
| F-4 | `Permissions-Policy` listed `bluetooth`, which Chrome flags as unrecognised | Console warning on every page | Removed |
| F-5 | Focus ring (023) spilled outside text fields and the DevDB lock form collapsed its gap (`display:block` over flex) | Misaligned unlock card | Fixed earlier this session |

Guards added so these cannot recur: every inline script must parse after injection; every `<script src>` must exist; `db-manager.html` must load its dependencies in order; the v1-only unlock path may not return.

## Usability observations

- Unlock UX is coherent (8 h session, same master password across Vault/DevDB/SSH). Wrong-password and rate-limit messages are specific. DevDB now reports 429 as "Too many attempts".
- The command palette (Ctrl+K), skip link, consistent themes, and 6-theme contrast now make keyboard-only use viable (features 022–024).
- Pre-unlock pages log a `401` console line (expected: the tool probes for session state before showing the lock card). Harmless but noisy; left as is.
- Spec hygiene: `specs/014-id-generator` and `specs/019-id-generator` describe the same feature (019 is the later one) — 014 is now marked superseded.

## Features: added / removed

- **Added**: SSH dashboard charts (restored via `mini-chart.js`), DevDB unlock for v2 vaults, `DEVSUITE_ALLOWED_HOSTS` for deliberate non-loopback binding, `pip-audit` in CI (SEC-1).
- **Removed**: the dead `chart.js` reference (nothing user-visible was lost — it never loaded). No tools were removed: all 15 shipped tools are functional after the fixes above.
- **Deliberately not added**: new tools. The one spec'd-but-unbuilt tool (`021-secret-scanner`) is a sizeable standalone feature and should go through `/speckit-plan` → `/speckit-implement` on its own; shipping runtime defects (F-1…F-3) first was the higher-value use of this pass.

## Recommended next steps

1. SEC-22: raise the KDF cost with a versioned migration (v3 challenge, lazy re-encrypt on next unlock) and a cross-implementation test harness.
2. SEC-11: move the remaining inline scripts out, then switch the CSP to nonces.
3. Build `021-secret-scanner` (Principle II-compliant, client-side).
4. Add a browser smoke test (the script used here) to CI so runtime breakage like F-1…F-3 is caught automatically.
