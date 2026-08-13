# Implementation Plan: Secure Terminal & SFTP

**Branch**: `009-secure-terminal-sftp` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-secure-terminal-sftp/spec.md`

**Note**: Retroactive plan — the feature already shipped. This document records the as-built
architecture rather than proposing one, per the same convention as
`specs/001-devsuite-baseline/spec.md`.

## Summary

A browser-based SSH terminal + SFTP file browser, backed by `asyncssh`. Terminal I/O and live
dashboard metrics run over origin-checked, session-gated WebSockets
(`/api/ssh/terminal`, `/api/ssh/dashboard`, `/api/local/terminal`); SFTP list/download/upload run
as ordinary REST endpoints. Every new host is verified via a `ssh-keyscan` + `ssh-keygen`
fingerprint-approval flow before any credential is sent, backed by the standard
`~/.ssh/known_hosts` file. Server profiles are encrypted client-side with the DevSuite Master
Password (CryptoJS AES) and stored as an opaque blob in the DevDB `ssh_profiles` store — the
backend never decrypts them. A local-PTY path (Linux/macOS, optional WSL distro selection)
reuses the same terminal WebSocket plumbing without any SSH handshake.

## Technical Context

**Language/Version**: Python 3.10+ (FastAPI/Uvicorn backend, per SPEC.md §3.1); vanilla ES
JavaScript frontend (no build step)

**Primary Dependencies**: `asyncssh` (SSH/SFTP client), `xterm.js` + `xterm-addon-fit` (self-hosted
terminal rendering), `CryptoJS` (self-hosted, client-side profile encryption)

**Storage**: DevDB named store `ssh_profiles` (opaque ciphertext blob; SPEC.md §6.4) — no other
persistence

**Testing**: `tests/python/test_ws_auth.py` (WebSocket session-gate behavior only, via the
dashboard endpoint as the cheapest gate-only test target). No automated coverage today for the
SSH connect/host-key/SFTP transfer logic itself or for `static/ssh-manager.js` /
`static/sftp-browser.js` — those paths are validated manually (see quickstart.md).

**Target Platform**: Server: any OS running the DevSuite backend. Local-terminal PTY fork is
Linux/macOS only (`_PTY_AVAILABLE`); WSL distro discovery is the Windows-side equivalent.

**Project Type**: Web tool — FastAPI route module (`routes/ssh.py`) + static HTML/JS/CSS pages,
following DevSuite's single-backend/vanilla-frontend architecture (SPEC.md §3.1).

**Performance Goals**: Dashboard metrics poll at a fixed ~2 s interval; SFTP downloads stream in
64 KB chunks rather than buffering; no other stated performance targets.

**Constraints**: Not offline (SPEC.md §4.8 Network notice — SSH/SFTP transmits to the target
host by design). WebSocket endpoints must pass origin + session gates (SEC-14) before any
connection logic runs. Backend must never decrypt `ssh_profiles` blobs (constitution Art. IV).

**Scale/Scope**: One route module, five REST/WS-adjacent concerns (terminal, dashboard, SFTP
list/download/upload, WSL discovery), two HTML entry points (`/ssh`, `/sftp`) sharing one DevDB
store.

## Constitution Check

*GATE: evaluated retroactively against `.specify/memory/constitution.md` — **PASS**, verified
against current source; no violations found.*

**Core principles (I–VII):**

| Principle | Compliance |
|---|---|
| I Spec first | This retroactive spec now documents the shipped behavior; SPEC.md §4.8/§5.1/§5.8/§6.4/§7.8 already covered it pre-conversion. PASS |
| II Verify against source | This spec was written by reading `routes/ssh.py`, `routes/pages.py`, `static/ssh-manager.js`, `static/sftp-browser.js` directly, not by paraphrasing SPEC.md. No discrepancies found between SPEC.md and code for this tool. PASS |
| III No undocumented behavior | All routes (`/ssh`, `/sftp`, `/api/ssh/*`, `/api/sftp/*`, `/api/local/terminal`, `/api/wsl/discover`) are documented in SPEC.md §5.1/§5.8 and this spec's contracts/http-api.md. PASS |
| IV Security tests for auth/session paths | `tests/python/test_ws_auth.py` covers the SEC-14 gate (pre-setup open, post-setup session-required, valid-session accepted) for all three WS endpoints via the shared `_ws_require_session` helper. Host-key verification and SFTP transfer logic have no automated tests — flagged as a coverage gap, not a violation (no security-critical-path rule in CLAUDE.md names host-key verification explicitly, but see Complexity Tracking note below). PARTIAL |
| V Version bump protocol | N/A to this retroactive documentation change — no code/version change. N/A |

**Spec & security baseline**:
- [x] `specs/SPEC.md` already documents this tool's routes/stores/security rules (§4.8, §5.1,
      §5.8, §6.4, §7.8) — this per-tool spec adds detail, it does not introduce anything
      undocumented.
- [x] No new outbound network paths — SSH/SFTP to a user-specified host is the tool's documented
      purpose (§4.8 Network notice), not a new path.
- [x] Vanilla HTML/CSS/JS frontend; `asyncssh` backend; persistence is DevDB-only
      (`ssh_profiles`) — no SQLite/Postgres/Redis.
- [x] Backend never decrypts `ssh_profiles` blobs (verified in `routes/storage.py` pass-through
      behavior referenced by SPEC.md §5.4); Master Password never transmitted or stored server-side.
- [x] No `innerHTML` with untrusted data verified by spot-checking `static/ssh-manager.js` /
      `static/sftp-browser.js` render helpers (`escHtml`, `document.createElement` patterns).
- [x] WebSocket session gate (SEC-14) has tests (`tests/python/test_ws_auth.py`).
- [x] No release/version change involved in this documentation-only conversion.
- [ ] Static-analysis gates (SonarCloud/CodeQL/CodeRabbit/Snyk) — not re-run as part of this
      documentation task; SPEC.md §10.4 already lists `ssh-manager.js:947` as an open S3776
      complexity finding, unrelated to this spec's scope.

**New-tool / UI cross-cutting checklist**: N/A — this is a retroactive spec for an existing tool,
not a new tool being added; the checklist's items (tool-count sync, UMD load order, sandbox CSP,
SEC-14 carve-out, iconography, third-party JS) were satisfied when the tool originally shipped.
The SEC-14 carve-out item is explicitly re-verified above since it's this tool's direct
responsibility.

## Project Structure

### Documentation (this feature)

```text
specs/009-secure-terminal-sftp/
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── http-api.md      # WS + REST contract, incl. SEC-14 gate and host-key flow
└── tasks.md
```

### Source Code (repository root)

```text
routes/
└── ssh.py                       # WS: /api/ssh/terminal, /api/ssh/dashboard, /api/local/terminal
                                  # REST: /api/sftp/{list,download,upload}, /api/wsl/discover
                                  # known_hosts helpers, host-key approval, WS auth gate (_ws_require_session)
routes/pages.py                  # GET /ssh, GET /sftp (page routes only)
routes/storage.py                # GET/POST /api/ssh/profiles (opaque ssh_profiles blob pass-through)

static/
├── ssh-manager.html / .js / .css   # Terminal + SFTP sub-tab UI, profile CRUD, dashboard charts
├── sftp-browser.html / .js / .css  # Standalone /sftp deep link, same profile store + endpoints
└── xterm.js / xterm.css / xterm-addon-fit.js   # vendored terminal rendering (cited, not modified)
```

**Structure Decision**: Follows DevSuite's existing single-backend-module-per-concern layout —
one `routes/ssh.py` file owns all SSH/SFTP/WSL/dashboard server logic; two static page bundles
share the same DevDB-backed profile store and REST/WS surface rather than duplicating it.

## Complexity Tracking

No constitutional violations requiring justification. One coverage gap is noted for visibility,
not blocking: host-key verification (`_ensure_host_key` and its approval callbacks) and SFTP
transfer logic have no automated tests today, only the WS session gate does
(`tests/python/test_ws_auth.py`). Given this path handles trust-on-first-use host verification —
a security-relevant flow — closing that gap is a reasonable candidate for a future
`/speckit-converge` pass, but is out of scope for this documentation-only conversion.
