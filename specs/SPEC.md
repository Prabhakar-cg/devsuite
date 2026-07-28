# DevSuite — Master Specification

> **Version:** 0.3.0  
> **Status:** Living document — updated with each release.  
> **Purpose:** Detailed system reference within the spec-kit tree. All features, behaviors, APIs, and constraints are defined here. Implementation must match this spec; divergences require a spec update first.  
> **Spec-kit layout:** non-negotiable principles live in `.specify/memory/constitution.md`; `specs/001-devsuite-baseline/spec.md` is the historical requirements-level baseline of the pre-split system. Each of the 12 shipped tools now has its own `specs/NNN-tool-slug/` folder (`002-diff-checker` … `013-file-converter`) — full spec/plan/tasks/research/data-model/quickstart/contracts/checklists per tool, same structure `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` produces for any new feature. This document stays the master reference for what's *cross-cutting* — backend API surface, storage engine, security model, design system, versioning — and folds in durable contracts when a tool spec ships. Code and tests cite this file as `SPEC.md §<section>` — keep the § numbering stable. The next new feature spec starts at `014-`.

---

## 1. Product Definition

### 1.1 Mission

DevSuite is a **locally-hosted, offline-first developer tools suite**. No cloud telemetry, no external data transmission for core features, no tracking. Every design decision must reinforce: *it lives on your machine*.

### 1.2 Tagline

> "The toolkit that stays on your machine."

### 1.3 Current Version

`0.3.0` — bumped simultaneously in `deps.py` (`APP_VERSION`), `README.md` (version badge), `CHANGELOG.md` (version heading), and this section (`specs/SPEC.md` §1.3). See §12.1.

---

## 2. System Constraints (Non-Negotiable)

These are hard rules. No implementation may violate them.

| Constraint | Rule |
|---|---|
| **No innerHTML with untrusted data** | All dynamic content via `document.createElement()` + `textContent`. `innerHTML` is forbidden for any untrusted string. |
| **No CDN fonts** | Fonts are self-hosted in `/static/libs/fonts/`. Never import from `fonts.googleapis.com`. |
| **No frameworks** | Vanilla HTML/CSS/JS only. No React, Vue, Svelte, Tailwind, or build tools. |
| **No external DB** | All persistence via DevDB (`.dsb` binary). No SQLite, PostgreSQL, Redis, etc. |
| **Self-hosted JS libs** | All third-party JS (crypto-js, xterm.js, RequireJS, Monaco Editor, and everything in `/static/libs/`) is served from `/static/`. No runtime CDN dependencies. |
| **Client-side encryption only** | Vault and SSH profile blobs are encrypted in-browser. The backend is an opaque store — it never decrypts these. |
| **CSP enforced** | HTTP security headers on every response. `unsafe-inline` is a known debt item (SEC-11) — do not add more inline scripts. `unsafe-eval` is **absent from the document CSP** (closed as SEC-6 in v0.3.0): API Tester scripting runs inside a dedicated Web Worker (`static/script-sandbox-worker.js`) whose response carries its own scoped CSP permitting eval in that worker only (§4.7.1, §5.10). Do not reintroduce `unsafe-eval` on document responses. |

---

## 3. Architecture

### 3.1 Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10+, FastAPI, Uvicorn (`localhost:8000`) |
| Frontend | Vanilla HTML / CSS / JS |
| Storage | DevDB — KeePass-style `.dsb` binary at `~/.devsuite/devdb.dsb` |
| SSH/SFTP | `asyncssh` |
| Terminal | xterm.js (self-hosted) |
| Code Editor | Monaco Editor (self-hosted via RequireJS, loaded from `/static/libs/vs`) |
| Crypto (client) | CryptoJS v4.2.0 (self-hosted) |
| Fonts | Inter + JetBrains Mono (self-hosted woff2) |

### 3.2 Directory Layout

```
devsuite/
├── main.py              # Thin orchestrator: app factory, middleware, router inclusion
├── deps.py              # Shared singletons & helpers (DevDB, limiter, sessions, constants)
├── routes/
│   ├── __init__.py
│   ├── auth.py          # /api/auth/*, /api/vault/migrate
│   ├── convert.py       # /api/convert (format conversion)
│   ├── db.py            # /api/db/* (DevDB REST API)
│   ├── pages.py         # HTML page routes, /upload
│   ├── proxy.py         # /api/proxy (CORS bypass)
│   ├── ssh.py           # SSH terminal, SFTP, WSL discovery, dashboard WebSocket
│   └── storage.py       # /api/vault, /api/collections, /api/ssh/profiles
├── devdb.py             # Storage engine: .dsb binary (AES-256-GCM)
├── requirements.txt
├── pytest.ini
├── start.sh / start.ps1
├── sonar-project.properties
├── scripts/
│   ├── check_updates.py  # Compares installed Python + vendored JS versions against latest
│   └── versions.json     # Cached version metadata for vendored JS libs
└── static/
    ├── favicon.svg
    ├── style.css         # Global design tokens, glassmorphism
    ├── linter.css        # Two-pane layout for linter/tester/crypto tools
    ├── toast.css         # Toast notification styles
    ├── theme.js          # Theme manager (6 themes)
    ├── components.js     # DevSuite global: csrfToken helper, toast utility, Monaco init helper
    ├── auth-guard.js     # 8-hour session auth for DevDB tools
    ├── devdb-client.js   # Fetch wrapper around /api/db/*
    ├── home.html / home.css
    ├── tools.html        # Tools hub / dashboard (12 tool cards)
    ├── index.html / app.js            # Diff tool
    ├── json.html / yaml.html / regex.html / base64.html / crypto.html
    ├── api-tester.html / api-tester.js / api-tester.css / api-client.js
    ├── script-sandbox-worker.js   # API Tester scripting sandbox (dedicated Worker, scoped CSP)
    ├── curl-codegen.js            # cURL parse + cURL/fetch/HTTPie generation (pure, node-testable)
    ├── cookie-jar.js              # Cookie parse/match/serialize logic (pure, node-testable)
    ├── collection-utils.js        # Folder path rename/move/reorder logic (pure, node-testable)
    ├── ssh-manager.html / ssh-manager.js / ssh-manager.css
    ├── sftp-browser.html / sftp-browser.js / sftp-browser.css
    ├── xterm.js / xterm.css / xterm-addon-fit.js
    ├── cron.html / cron.js / cron.css
    ├── vault.html / vault.js / vault.css
    ├── db-manager.html / db-manager.js / db-manager.css
    ├── file-converter.html
    └── libs/
        ├── fonts.css / fonts/   # Self-hosted Inter + JetBrains Mono (woff2)
        ├── vs/                  # Monaco Editor (self-hosted, loaded via RequireJS)
        ├── highlight.min.js
        ├── marked.min.js
        ├── papaparse.min.js
        ├── js-yaml.min.js
        ├── jszip.min.js         # Used by Folder Diff for zip download
        └── require.min.js
```

> **Note:** A Python backend test suite lives in `tests/python/` (run with `pytest`). Coverage currently focuses on the security-critical paths in §10.2. A JavaScript unit suite for the pure modules (`curl-codegen.js`, `cookie-jar.js`, `collection-utils.js`) lives in `tests/javascript/` (run with `node tests/javascript/run.js`, zero dependencies). Browser/e2e coverage remains a v1.0.0 milestone.

### 3.3 HTML Serving Behavior

All HTML pages are served through `_serve_html(filename)` in `main.py`, which:
1. Reads the HTML file from `static/`.
2. Auto-injects the `<link rel="icon" href="/static/favicon.svg">` tag into `<head>` if not already present.
3. Rewrites every `/static/*.css` and `/static/*.js` URL to append `?v=<8-char MD5 of file content>` for cache busting.

### 3.4 Module-to-File Map

| Module | HTML | JS / CSS | Backend | DevDB Store |
|---|---|---|---|---|
| Home/Dashboard | `home.html` | `home.css` | `main.py` (`/`) | — |
| Diff | `index.html` | `app.js`, `linter.css` | `/upload` | — |
| JSON Linter | `json.html` | `app.js`, `linter.css` | `/json` | — |
| YAML Linter | `yaml.html` | `app.js`, `linter.css` | `/yaml` | — |
| Regex Tester | `regex.html` | `linter.css` | `/regex` | — |
| Base64 / JWT | `base64.html` | `linter.css` | `/base64` | — |
| Crypto Suite | `crypto.html` | `linter.css`, `crypto-js.min.js` | `/crypto` | — |
| API Tester | `api-tester.html` | `api-client.js`, `api-tester.js`, `api-tester.css`, `script-sandbox-worker.js`, `curl-codegen.js`, `cookie-jar.js`, `collection-utils.js`, `libs/jszip.min.js` | `/api/proxy`, `/api/collections` | `collections` |
| SSH Terminal | `ssh-manager.html` | `ssh-manager.js`, `ssh-manager.css`, `xterm.js` | `/api/ssh/*` WS, `/api/local/terminal` WS | `ssh_profiles` |
| SFTP Browser | `sftp-browser.html` | `sftp-browser.js`, `sftp-browser.css` | `/api/sftp/*` | `ssh_profiles` |
| Cron Visualizer | `cron.html` | `cron.js`, `cron.css` | `/cron` | — |
| Secret Vault | `vault.html` | `vault.js`, `vault.css`, `crypto-js.min.js`, `components.js` (defines `DevSuite.csrfToken`) | `/api/vault`, `/api/auth/*` | `vault` |
| DevDB Manager | `db-manager.html` | `db-manager.js`, `db-manager.css` | `/api/db/*` | — |
| File Converter | `file-converter.html` | inline JS + self-hosted `js-yaml`, `papaparse`, `marked` (`/static/libs/`) | `/api/convert` | — |

---

## 4. Tools — Index

Each tool's behavioral spec, requirements, plan, task history, research decisions, data model,
quickstart, and API contracts now live in their own spec-kit folder under `specs/`, following the
same `spec.md` → `plan.md` → `tasks.md` structure `/speckit-specify` produces for any new feature.
This section is an index only — **do not add tool behavior prose here**; put it in the linked
spec and, if it's a durable cross-cutting contract (route, store, security rule), also fold it
into §5–§12 below.

| # | Tool | Route(s) | Spec |
|---|---|---|---|
| 4.1 | Diff Checker | `/diff` | [specs/002-diff-checker/spec.md](002-diff-checker/spec.md) |
| 4.2 | JSON Linter & Formatter | `/json` | [specs/003-json-linter/spec.md](003-json-linter/spec.md) |
| 4.3 | YAML Linter & Validator | `/yaml` | [specs/004-yaml-linter/spec.md](004-yaml-linter/spec.md) |
| 4.4 | Regex Tester | `/regex` | [specs/005-regex-tester/spec.md](005-regex-tester/spec.md) |
| 4.5 | Base64 Encoder / Decoder | `/base64` | [specs/006-base64-encoder/spec.md](006-base64-encoder/spec.md) |
| 4.6 | Crypto Suite | `/crypto` | [specs/007-crypto-suite/spec.md](007-crypto-suite/spec.md) |
| 4.7 | Local API Tester | `/api-tester` | [specs/008-api-tester/spec.md](008-api-tester/spec.md) |
| 4.8 | Secure Terminal & SFTP | `/ssh`, `/sftp` | [specs/009-secure-terminal-sftp/spec.md](009-secure-terminal-sftp/spec.md) |
| 4.9 | Cron Visualizer | `/cron` | [specs/010-cron-visualizer/spec.md](010-cron-visualizer/spec.md) |
| 4.10 | Secret Vault | `/vault` | [specs/011-secret-vault/spec.md](011-secret-vault/spec.md) |
| 4.11 | DevDB Manager | `/db-manager` | [specs/012-db-manager/spec.md](012-db-manager/spec.md) |
| 4.12 | File Format Converter | `/file-converter` | [specs/013-file-converter/spec.md](013-file-converter/spec.md) |

---

## 5. Backend API Specification

### 5.1 Page Routes (HTML responses)

| Route | Tool |
|---|---|
| `GET /` | Homepage (`home.html`) |
| `GET /tools` | Tools Hub — 12 tool cards (`tools.html`) |
| `GET /diff` | Diff Checker |
| `GET /json` | JSON Linter |
| `GET /yaml` | YAML Linter |
| `GET /regex` | Regex Tester |
| `GET /base64` | Base64 / JWT |
| `GET /crypto` | Crypto Suite |
| `GET /api-tester` | Local API Tester |
| `GET /ssh` | Secure Terminal & SFTP |
| `GET /sftp` | Standalone SFTP Browser |
| `GET /cron` | Cron Visualizer |
| `GET /vault` | Secret Vault |
| `GET /db-manager` | DevDB Manager |
| `GET /file-converter` | File Format Converter |

### 5.2 Auth Endpoints

| Method | Route | Rate Limit | Description |
|---|---|---|---|
| `GET` | `/api/auth/status` | — | Check if master password is configured (`is_setup`, `vault_has_data`) |
| `GET` | `/api/auth/challenge` | 5 req/min/IP | Return `salt`, `verify_blob`, `challenge_version` (+ `verify_iv` v1 / `verify_nonce` v2) |
| `POST` | `/api/auth/setup` | — | Initial Master Password setup (v2: stores `salt`, `verify_blob`, `verify_nonce`, `challenge_version=2`) |
| `POST` | `/api/auth/session` | 5 req/min/IP | Verify key and issue session; sets `ds_session` + `ds_csrf` cookies |
| `POST` | `/api/auth/update-challenge` | — | Replace verification challenge after password change; revokes all active sessions |
| `POST` | `/api/auth/logout` | — | Invalidate current session; clears `ds_session` + `ds_csrf` cookies |
| `GET` | `/api/vault/migrate` | — | Read vault blob without auth (only available before first `auth/setup`; returns 409 after) |

**Session cookie:** `ds_session` — `HttpOnly; SameSite=Strict; max_age=28800` (8 hours). `Secure` flag set when `DEVSUITE_HTTPS=1`.  
**CSRF cookie:** `ds_csrf` — non-HttpOnly, same TTL; required as `X-CSRF-Token` header on all mutating requests. `Secure` flag set when `DEVSUITE_HTTPS=1`.  
**Token storage:** Only the BLAKE2b-32 hex digest of each `token_urlsafe(32)` session token is kept in server memory.  
**CSRF exempt paths:** `/api/auth/session` and `/api/auth/setup` (bootstrap endpoints that predate any session).

### 5.3 DevDB REST API

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/db/store/{name}` | Read a named store |
| `POST` | `/api/db/store/{name}` | Write a named store |
| `GET` | `/api/db/meta` | Database metadata |
| `GET` | `/api/db/export` | Download full `.dsb` file |
| `POST` | `/api/db/import` | Upload and replace `.dsb` file |

### 5.4 Vault & SSH Profile APIs (opaque pass-through)

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/vault` | Read vault blob (ciphertext) |
| `POST` | `/api/vault` | Write vault blob (ciphertext) |
| `GET` | `/api/ssh/profiles` | Read SSH profiles blob (ciphertext) |
| `POST` | `/api/ssh/profiles` | Write SSH profiles blob (ciphertext) |

**Invariant:** Backend never decrypts these blobs. Encryption/decryption happens in-browser only.

### 5.5 Collections API (API Tester)

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/collections` | List saved request collections |
| `POST` | `/api/collections` | Save a collection |

### 5.7 File Operations

| Method | Route | Limit | Description |
|---|---|---|---|
| `POST` | `/upload` | 50 MB | Text file upload for diffing (binary files rejected) |
| `POST` | `/api/convert` | **20 MB** | Format conversion (delegates to openpyxl, pypdf, python-docx, mammoth, weasyprint) |

### 5.8 SSH / Terminal WebSocket APIs

| Route | Protocol | Description |
|---|---|---|
| `/api/ssh/terminal` | WebSocket | asyncssh interactive SSH terminal with PTY resize |
| `/api/ssh/dashboard` | WebSocket | Real-time SSH server metrics (CPU, RAM, disk, uptime) polled every 2 s |
| `/api/local/terminal` | WebSocket | Local PTY shell — Linux/macOS only; WSL distro or `$SHELL`. Not available on Windows. |
| `POST /api/sftp/list` | REST | List remote directory (JSON body) |
| `POST /api/sftp/download` | REST | Stream download of a remote file |
| `POST /api/sftp/upload` | REST | Upload a file via multipart form (host, username, remote_path, file, port, password, private_key, approved_fingerprint fields) |
| `GET /api/wsl/discover` | REST | Discover installed WSL distributions via `wsl.exe -l -q` |

**WebSocket auth gate (SEC-14):** All three WebSocket endpoints (`/api/ssh/terminal`, `/api/ssh/dashboard`, `/api/local/terminal`) enforce, in order: (1) `_ws_check_origin` — exact `http(s)://<host>` origin match; (2) `_ws_require_session` — when a master password is configured, a valid `ds_session` cookie is required (the cookie is sent automatically on same-origin WS upgrades); the socket is closed with code `1008` before `accept()` otherwise. Before first-time master-password setup the auth system is dormant, so connections are allowed — this preserves the no-password local-terminal flow.

**Host key handling:** For unknown hosts, the server fetches the key via `ssh-keyscan`, computes its SHA-256 fingerprint, and sends a `host_key_approval` WebSocket message to the browser. The browser must reply with `{type: "host_key_response", approve: true}` within 60 seconds.

### 5.9 CORS Proxy

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/proxy` | Forward request to any HTTP/HTTPS host |

**Security:** The proxy is **not** allowlist-based — it accepts any host reachable from the DevSuite server, including LAN/private-range addresses (e.g. `10.x.x.x`, `192.168.x.x`). DevSuite is a loopback-only local tool; testing LAN APIs through the proxy is a first-class use case. SSRF protection still blocks requests that resolve to loopback (`127.x.x.x`), link-local (`169.254.x.x` — cloud metadata), multicast, or IANA-reserved IP addresses (HTTP 403). Only `http` and `https` schemes are allowed. The URL is reconstructed from validated components before dispatch to prevent taint-flow from raw user input. **Redirects are followed only after re-validating each hop's resolved IP and scheme, so a remote host cannot 3xx into a loopback or cloud-metadata address.** Responses are capped at 10 MB. Timeout: 15 s.

**Response shape:** `{proxy_response: true, status, headers, set_cookie, body, truncated?}`. `headers` is a plain dict (duplicate header names collapse); `set_cookie` is a **list** carrying every `Set-Cookie` header verbatim so the client-side cookie jar (§4.7.5) sees all of them.

### 5.10 HTTP Security Headers (every response)

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 0
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: (see main.py — unsafe-inline is known debt, tracked as SEC-11)
Strict-Transport-Security: (when served over HTTPS)
```

**CSP split (SEC-6, v0.3.0):** document responses carry `script-src` **without** `unsafe-eval`. The single exception is `/static/script-sandbox-worker.js`, whose response carries its own locked-down policy — `default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'` — so user-authored API Tester scripts can be evaluated inside that worker and nowhere else, with no DOM, cookie, or network reach.

---

## 6. Storage — DevDB Specification

### 6.1 File

`~/.devsuite/devdb.dsb` — single file for all persistence.

### 6.2 Binary Format

**Header:** 64 bytes, fixed layout. Struct format: `!4sHH8sI32s12s` (big-endian).

| Field | Type | Size | Value |
|---|---|---|---|
| Magic | `4s` | 4 bytes | `b"DSDB"` |
| Version | `H` | 2 bytes | `1` |
| Flags | `H` | 2 bytes | `0` (plain) or `1` (`FLAG_ENCRYPTED`) |
| KDF | `8s` | 8 bytes | `b"pbkdf2\x00\x00"` (encrypted) or `b"\x00"*8` (plain) |
| Iterations | `I` | 4 bytes | `200000` (encrypted) or `0` (plain) |
| Salt | `32s` | 32 bytes | 256-bit random (encrypted) or zero (plain) |
| Nonce | `12s` | 12 bytes | 96-bit random (encrypted) or zero (plain) |

**Plain mode payload:** `[32-byte BLAKE2b-256 checksum] + [JSON bytes]`.  
**Encrypted mode payload:** AES-256-GCM output = `ciphertext ‖ 16-byte GCM auth tag` (PBKDF2-HMAC-SHA256, 200k iterations, 256-bit salt, 96-bit nonce, all random per-write).

### 6.3 Python API (`devdb.py`)

```python
open()                                          # read + decrypt from disk
save()                                          # encrypt + atomic write to disk
get_store(name: str) -> dict                    # shallow copy; returns {} if absent
set_store(name: str, data: dict)                # deep-copies data; updates modified timestamp
delete_store(name: str) -> bool                 # returns True if store existed
list_stores() -> list[str]
store_sizes() -> dict[str, dict]                # {name: {"bytes": int, "count": int|None}}
meta() -> dict                                  # created/modified timestamps, app, version
is_encrypted() -> bool                          # True if password is set
file_size() -> int                              # on-disk size in bytes; 0 if absent
export_bytes() -> bytes                         # serialize to .dsb bytes without disk I/O
from_bytes(raw: bytes, password=None) -> DevDB  # classmethod; parse without disk I/O
change_password(new_password: str | None)       # set, change, or remove (None) server-side password
migrate_legacy(db, db_dir)                      # staticmethod; one-time import of legacy JSON files
```

**Thread safety:** `threading.Lock`. Atomic writes via temp file + `os.replace` + `os.fsync`.

### 6.4 Named Stores

Access via the DevDB REST API is restricted to these store names (`_ALLOWED_STORES`):

| Store | Owner | Content |
|---|---|---|
| `vault` | Secret Vault | AES-256 ciphertext blob (never decrypted server-side) |
| `ssh_profiles` | SSH Terminal / SFTP | AES-256 ciphertext blob (never decrypted server-side) |
| `collections` | API Tester | JSON request collections |
| `app_prefs` | Auth system | `master_setup_done`, `master_salt`, `master_verify_blob`, `challenge_version`; `master_verify_iv` (v1) or `master_verify_nonce` (v2) |

### 6.5 JS Client (`devdb-client.js`)

```javascript
DevDB.getStore(name)     // GET /api/db/store/{name}
DevDB.setStore(name, data) // POST /api/db/store/{name}
DevDB.getMeta()           // GET /api/db/meta
```

---

## 7. Security Model

### 7.1 Authentication Flow

1. On first visit to `/vault`: user creates a Master Password → browser derives **Kenc** + **Kauth** (see §7.5) → `POST /api/auth/setup` stores the PBKDF2 salt and an AES-GCM verify_blob encrypted with **Kauth**.
2. On subsequent visits: user enters password → browser re-derives Kenc/Kauth → `GET /api/auth/challenge` + `POST /api/auth/session` verifies **Kauth** → server sets `ds_session` HttpOnly cookie.
3. `auth-guard.js` holds the verified password **in-memory only** for the page's lifetime. Vault and DB Manager always-ask (no cross-page cache). Navigating to a new tool re-prompts (this is intentional — the master password is never written to `sessionStorage` or `localStorage`).

### 7.2 Session Token Lifecycle

- Token generated with `secrets.token_urlsafe(32)`.
- Only the BLAKE2b-32 hex digest is stored server-side (`_sessions: dict[str, float]`, maps hash → unix expiry).
- Session delivered as `ds_session` cookie: `HttpOnly; SameSite=Strict; max_age=28800`. `Secure` added when `DEVSUITE_HTTPS=1`.
- JavaScript cannot read or exfiltrate the session token.
- `POST /api/auth/update-challenge` calls `_sessions.clear()` — all active sessions revoked on password change.
- `POST /api/auth/logout` removes only the calling session's hash entry.

### 7.3 CSRF Protection

- Server issues `ds_csrf` cookie (non-HttpOnly, same TTL) alongside `ds_session`.
- All `POST / PUT / DELETE / PATCH` requests must include `X-CSRF-Token` header matching `ds_csrf`.
- Comparison uses `secrets.compare_digest` (constant-time).
- Exempt: `/api/auth/session` and `/api/auth/setup` (bootstrap endpoints that predate any session).

### 7.4 Rate Limiting

- `/api/auth/challenge` and `/api/auth/session`: 5 req/60s per IP via `slowapi`.
- Returns HTTP 429 on excess.

### 7.5 Client-Side Encryption

- Vault blobs are encrypted in-browser using **WebCrypto AES-256-GCM** (authenticated). SSH profile blobs use CryptoJS AES-256 (separate key scheme, see SSH Manager).
- The server stores and returns opaque ciphertext blobs. It **never** decrypts them.
- Master Password is never transmitted or stored.
- **Domain-separated keys (v2 scheme, `challenge_version: 2`):**
  - `root = PBKDF2-HMAC-SHA256(password, salt, 310 000 iter) → 512 bits`
  - `Kenc  = root[0:32]` — vault encryption key, **never leaves the browser**
  - `Kauth = root[32:64]` — server authentication key, sent as `key_hex` to `/api/auth/session`
  - Even if the server is compromised and logs `key_hex`, it cannot decrypt the vault (Kenc ≠ Kauth).
- **Backward compatibility:** v1 vaults (challenge_version absent or 1) use CryptoJS PBKDF2-SHA1/50k single-key scheme; on first unlock they are automatically migrated to v2 (re-encrypted as AES-GCM, new challenge registered with Kauth).

### 7.6 Audit Log

- Location: `~/.devsuite/audit.log`
- Format: **JSON Lines** — one `json.dumps` record per line, e.g. `{"ts":"2026-05-09T12:00:00Z","event":"AUTH_SESSION","ip":"127.0.0.1"}`
- Append-only. `ts` is `strftime("%Y-%m-%dT%H:%M:%SZ", gmtime())`.
- Events:
  - `AUTH_SESSION` — fields: `ip`. On successful session unlock.
  - `AUTH_LOGOUT` — fields: `ip`. On explicit logout.
  - `VAULT_ACCESS` — fields: `ip`. On every `GET /api/vault` call.
  - `SSH_CONNECT` — fields: `host`, `port`, `user`. On WebSocket SSH terminal connect.
- Secret values are **never** written to the log.

### 7.7 DOM XSS Hardening

- All dynamic content uses `document.createElement()` + `textContent`.
- `innerHTML` assignment with untrusted data is forbidden.

### 7.8 Open Security Debt

| ID | Issue | Priority |
|---|---|---|
| SEC-11 | CSP nonces to replace `unsafe-inline`. (`unsafe-eval` was removed from document responses in v0.3.0 — SEC-6 — by sandboxing API Tester scripting in a Web Worker with its own scoped CSP; only `unsafe-inline` remains.) | P2 |
| ~~SEC-14~~ | ~~WebSocket endpoints not session-gated.~~ **✅ Resolved (v0.2.4):** `_ws_require_session` enforces a valid `ds_session` cookie on all three WS endpoints once a master password is configured (see §5.8). | — |
| SEC-12 | Localhost HTTPS (self-signed cert on first run) | P3 |
| SEC-13 | Argon2id KDF to replace PBKDF2 | P3 |
| SEC-3 | Explicit CORS allowlist (`localhost`, `127.0.0.1`) | XS |
| ~~SEC-5~~ | ~~SRI hashes for CDN-loaded scripts~~ — **obsolete**: all scripts are self-hosted under `/static/`; there are no CDN-loaded scripts to hash. | — |
| SONAR | `main.py:1322,1327` — `secure=True` on cookies (S2092) | Minor |

---

## 8. Authentication & Session — Frontend Contract

| Tool | Auth model |
|---|---|
| Diff, JSON, YAML, Regex, Base64, Crypto, Cron, File Converter | No auth required |
| API Tester | 8-hour session cache (`auth-guard.js`) |
| SSH Terminal / SFTP | 8-hour session cache (`auth-guard.js`) |
| Secret Vault | Always-ask lock screen on every visit |
| DevDB Manager | Always-ask lock screen on every visit |

All tools that use DevDB must load `auth-guard.js` before tool-specific scripts.

---

## 9. Design System

### 9.1 Dual Design Vocabulary

| Context | System | Background | Primary Font |
|---|---|---|---|
| Homepage, Tools Hub | Terminal Noir (dark) | `#05050a` | JetBrains Mono headlines + Inter body |
| Individual tool pages | Apple Tool UI (light) | `#ffffff / #f5f5f7` | Inter UI + JetBrains Mono code |

### 9.2 Typography

| Role | Font | Weight | Notes |
|---|---|---|---|
| Display / headlines | JetBrains Mono | 700 | `letter-spacing: -0.03em` |
| UI body | Inter | 400–600 | All non-code UI text |
| Code / terminal output | JetBrains Mono | 400 | Never swap |
| Eyebrow labels | JetBrains Mono | 500 | Uppercase, `letter-spacing: 0.12em` |

CSS variables: `--font-mono` / `--font-body`. Loaded via `@import '/static/libs/fonts.css'` only.

### 9.3 Color Tokens

**Terminal Noir (dark):** `--void: #05050a` · `--electric: #3b82f6` · `--lime: #4ade80` · `--amber: #f59e0b` · `--violet: #8b5cf6`

**Apple Tool UI (light):** `--bg: #ffffff` · `--bg-secondary: #f5f5f7` · `--blue: #0071e3` · `--green: #28cd41` · `--red: #ff3b30`

**Semantic color roles (never reassign):**
- `--lime` / `--green`: success, terminal output
- `--amber`: vault, warning
- `--electric` / `--blue`: primary action
- `--violet`: secondary accent

### 9.4 Radii

| Token | Value | Use |
|---|---|---|
| `--radius-xl` | 16px | Modals, lock cards |
| `--radius` | 14px | Standard light cards |
| `--radius-sm` | 10–12px | Small cards |
| `--radius-xs` | 7–8px | Inputs, small buttons |
| `--radius-pill` | 980px | CTA buttons, badges, chips |

### 9.5 Motion

- Standard transition: `all 0.2s cubic-bezier(0.4, 0, 0.2, 1)` — no slower, no faster.
- Hover lift (dark cards): `translateY(-2px)`.
- Press/active: `scale(0.97–0.98)`.
- Cursor blink: `step-end` only (authentic terminal behavior).
- Animate for orientation, not decoration.

### 9.6 Runtime Themes (6)

| Theme | `--electric` | `--void` |
|---|---|---|
| Noir (default) | `#3b82f6` | `#05050a` |
| Midnight | `#8b5cf6` | `#07071a` |
| Ocean | `#38bdf8` | `#040d1a` |
| Solarized | `#268bd2` | `#002b36` |
| Light | `#2563eb` | `#f3f4f8` |
| Hi-Contrast | `#60a5fa` | `#000000` |

Themes driven by `theme.js`. Custom event `devsuite-theme-changed` fires on toggle.

### 9.7 Tool Icon Gradients

| Tool | Gradient |
|---|---|
| Text Diff | `linear-gradient(135deg,#6366f1,#3b82f6)` |
| JSON Linter | `linear-gradient(135deg,#0c4a6e,#0ea5e9)` |
| YAML Linter | `linear-gradient(135deg,#065f46,#059669)` |
| Regex Tester | `linear-gradient(135deg,#5b21b6,#7c3aed)` |
| Base64 | `linear-gradient(135deg,#1e40af,#3b82f6)` |
| File Converter | `linear-gradient(135deg,#0f766e,#14b8a6)` |
| Crypto Suite | `linear-gradient(135deg,#b45309,#f59e0b)` |
| Secret Vault | `linear-gradient(135deg,#78350f,#b45309)` |
| DevDB Manager | `linear-gradient(135deg,#312e81,#4f46e5)` |
| API Tester | `linear-gradient(135deg,#7c3aed,#a855f7)` |
| SSH Terminal | `linear-gradient(135deg,#0c4a6e,#0369a1)` |
| Cron Visualizer | `linear-gradient(135deg,#92400e,#d97706)` |

### 9.8 Iconography

- All icons: stroke-based SVG, `stroke-width: 1.8–2.5`, `stroke-linecap: round`, `stroke-linejoin: round`.
- Size: 16–20px inside 24×24 viewBox.
- Color: `currentColor` or explicit accent.
- Inside tool icon containers: always white, 20px.
- No icon fonts, no PNG icons, no emoji as icons.
- Source: Lucide Icons or Heroicons (outline).

### 9.9 Content & Copy Rules

- Tone: direct, technical, developer-to-developer. No exclamation marks.
- Privacy-first language: "Nothing leaves your machine", "Zero cloud", "100% local".
- Sentence case for UI labels (`Add secret`), not title case.
- ALL CAPS for eyebrow/category labels.
- Title Case for tool names (`Secret Vault`).
- Monospace for paths, versions, code snippets.
- No emoji in UI chrome.
- Error messages must answer: **What** happened + **Why** + **How to fix it**.

### 9.10 Anti-Patterns (Forbidden)

- Generic purple-on-white or rainbow gradients.
- Decorative icons or emoji in UI chrome.
- Random border-radius mixing (radii are semantic).
- Centered-everything layouts on tool pages.
- Animation without a communicative purpose.
- Additional font families (Inter + JetBrains Mono is fixed).
- Reassigning semantic color tokens.

---

## 10. Quality & Testing

### 10.1 Test Suites

> **Status:** The Python backend suite exists in `tests/python/` (`pytest`) and covers the §10.2 security-critical paths. A zero-dependency JavaScript unit suite exists in `tests/javascript/` for the pure modules (`curl-codegen.js`, `cookie-jar.js`, `collection-utils.js`); browser/e2e coverage (Playwright) is still a v1.0.0 deliverable.

| Suite | Location | Command |
|---|---|---|
| Python backend | `tests/python/` | `pytest tests/python/` |
| JavaScript (pure modules) | `tests/javascript/` | `node tests/javascript/run.js` |

### 10.2 Required Coverage (Security-Critical Paths)

These paths must have automated tests. Adding or changing any of them requires a corresponding test update:

- PBKDF2 key derivation: deterministic with same password + salt.
- AES-GCM roundtrip: `decrypt(encrypt(plaintext, key), key) == plaintext`.
- CSRF middleware: mutating requests without `X-CSRF-Token` → HTTP 403.
- Rate limiting: 6th auth request within 60s → HTTP 429.
- SSRF proxy block: loopback/link-local/reserved addresses → HTTP 403; LAN ranges allowed.
- Session token hashing: raw token not present in `_sessions` dict.
- WebSocket session gate: when a master password is configured, a session-less WS connect is closed (1008); a valid `ds_session` is accepted; connects before setup are allowed.
- CSP split: document/page responses contain no `unsafe-eval`; the `/static/script-sandbox-worker.js` response carries the scoped worker CSP (`unsafe-eval` present, `connect-src 'none'`).
- Proxy `Set-Cookie` passthrough: duplicate `Set-Cookie` headers are preserved in the `set_cookie` list of the proxy response.

### 10.3 Static Analysis

| Tool | Scope |
|---|---|
| SonarCloud | Python + JS (excludes `static/libs/**`, `tests/**`) |
| CodeQL | Python + JavaScript (`github/codeql-action@v3`) |
| CodeRabbit | PR reviews |
| Snyk | Dependency CVE scanning |

**Quality Gate target:** Security Rating A · 0 unreviewed hotspots · 0 new violations.

### 10.4 Open SonarCloud Findings (2026-04-25)

**Gate-failing:**
- S2092 (`main.py:1322, 1327`): cookies missing `secure=True` → Security Rating B.
- Hotspots S3330, S5042 (×2): unreviewed.
- 8 new violations since 2026-04-19.

**Active criticals:**
- ~~`db-manager.js:188` S2703: implicit global `_serverToken` (BLOCKER)~~ — **resolved**, no longer present in code.
- `vault.js:236` S3776: cognitive complexity 21 (CRITICAL).
- `cron.js:528`, `ssh-manager.js:947`, `file-converter.html:1102`: S3776 complexity.
- `ssh-manager.js:353`, `regex.html:398`: S2004 functions nested >4 levels.

---

## 11. Dependency Inventory

### 11.1 Python (`requirements.txt`)

| Package | Constraint | Notes |
|---|---|---|
| fastapi | `>=0.136.0` | Core framework |
| uvicorn[standard] | `>=0.44.0` | ASGI server |
| python-multipart | `~=0.0.26` | File upload |
| asyncssh | `>=2.22.0` | SSH/SFTP |
| cryptography | `>=46.0.7` | Security-critical — patch immediately on CVE |
| websockets | `>=16.0` | WebSocket |
| wsproto | `>=1.3.2` | WebSocket protocol |
| openpyxl | `>=3.1.5` | XLSX |
| pypdf | `>=6.10.2` | PDF |
| python-docx | `>=1.2.0` | DOCX |
| mammoth | `>=1.12.0` | DOCX → HTML |
| weasyprint | `>=68.1` | HTML → PDF |
| markdown | `>=3.10.2` | Markdown parsing |
| slowapi | `>=0.1.9` | Rate limiting — security-sensitive, patch promptly |

### 11.2 Vendored JavaScript (`static/`)

| File | Library |
|---|---|
| `xterm.js` | xterm.js |
| `xterm.css` | xterm.js styles |
| `xterm-addon-fit.js` | xterm-addon-fit |
| `crypto-js.min.js` | CryptoJS |

### 11.3 Vendored JavaScript (`static/libs/`)

| File | Library | Pending |
|---|---|---|
| `highlight.min.js` | highlight.js | — |
| `marked.min.js` | marked | — |
| `papaparse.min.js` | PapaParse | — |
| `js-yaml.min.js` | js-yaml | 4.1.1 available |
| `jszip.min.js` | JSZip | — |
| `require.min.js` | RequireJS | 2.3.8 available |
| `vs/` | Monaco Editor | 0.55.1 available (current: 0.45.0) |

**Upgrade cadence:** Security patches immediately · Patch versions monthly · Minor versions quarterly · Major versions per-release.

---

## 12. Versioning & Release Protocol

### 12.1 Version Bump Rule

On every release, bump the version string in exactly these four places simultaneously:

1. `deps.py` — `APP_VERSION` constant (imported by `main.py` for the FastAPI `version=` parameter and used as the cache-busting fallback).
2. `README.md` — version badge.
3. `CHANGELOG.md` — new version heading.
4. `specs/SPEC.md` — §1.3 current-version string.

### 12.2 Cache Busting

Cache busting is **automatic**. `_serve_html()` in `main.py` rewrites every `/static/*.css` and `/static/*.js` URL at serve-time, appending `?v=<8-char MD5>` derived from the file's current content. Fallback: `APP_VERSION`. Manual version bumps in HTML templates are not required and will be overwritten.

### 12.3 Changelog Format & Flow

Follows Semantic Versioning. Each release section includes, in this order: Security · Frontend · Features · Bug Fixes · Internal/Code Quality · Documentation · Dependencies (omit any that are empty).

**Flow — every change is logged the same way:**

1. **Land under `## [Unreleased]`.** In the same commit as the code/spec change, add an entry to the `## [Unreleased]` section at the top of `CHANGELOG.md`, under the appropriate category heading above. Never commit a behavior, bug-fix, or documentation change without a matching `[Unreleased]` entry.
2. **Entry shape.** `#### <Short title> (`<file(s) touched>`)` followed by bullet(s) describing the *why* and the *fix*, and — for security/behavioral paths — the regression test added (per constitution rule 4).
3. **On release, promote.** Rename `## [Unreleased]` to `## [X.Y.Z] — <date> (<theme>)`, add a fresh empty `## [Unreleased]` above it, and perform the §12.1 four-place version bump in the same commit.

---

## 13. Planned Roadmap

> **Strategic focus (decided 2026-06-10):** the API Tester is DevSuite's flagship — the one tool where the offline-first mission meets a proven market wedge (Bruno/Postman). Releases prioritize making it a daily driver before adding new commodity tools.

### v0.3.0 — API Tester: Daily Driver ✅ (this release)

- Script sandbox: pre-request/test scripts run in a dedicated Web Worker; `unsafe-eval` removed from the document CSP (closes SEC-6; SEC-7 partially — scripting isolated, with a 10 s timeout so scripts can't freeze the UI).
- Collection runner: run a folder or the whole collection sequentially; per-request test results, pass/fail summary, stop button; runtime vars persist across the run for request chaining.
- cURL import ("paste cURL") + code generation (copy as cURL / fetch / HTTPie).
- Nested folders: `/`-separated folder paths; Postman import preserves hierarchy; folder auth inherits down the path.
- Cookie jar: session-scoped, in-memory; captures `Set-Cookie` from proxied responses, auto-attaches matching cookies; Cookies manager modal.
- Git-friendly export: collection as zip, one JSON file per request, folder tree mirrored (JSZip); zip import round-trips.
- Sidebar management: rename/duplicate/move/delete requests, rename/delete folders (path cascade), drag-to-reorder and drag-into-folder (§4.7.4).
- JS unit test suite bootstrap (`tests/javascript/run.js`, node, zero dependencies).

### v0.3.x — API Tester follow-ups (Bruno gap-closure, in priority order)

1. ~~Sidebar request management~~ ✅ shipped in v0.3.0 (§4.7.4): rename/duplicate/move/delete requests, rename/delete folders, drag-to-reorder and drag-into-folder.
2. **"Honest proxy" slice** — per-request options: skip TLS verification (self-signed local APIs), timeout, redirect follow toggle; **multipart file upload** (proxy currently urlencodes form data only); **binary-safe responses** (base64 proxy mode, download-response button, image preview — today non-UTF-8 bodies are mangled by `errors="replace"`).
3. **OAuth2 authorization-code + PKCE** — the missing grant for real-world providers (Auth0/Keycloak/Azure AD); needs a popup/redirect-capture flow.
4. **CLI runner** — `python -m devsuite run <collection.zip> --env <name> --report junit.xml`; reuses runner semantics, makes the git-friendly zip a CI interchange format (Bruno's `bru run` equivalent).
5. **Declarative assertions** — no-code assert rows (field / operator / value) compiled onto the existing sandbox `expect` engine.
6. **Variable scopes** — collection- and folder-level variables (and folder-level cascading scripts), extending the folder-auth inheritance pattern.
7. Masked environment secrets (`secret` flag per variable; masked in UI), later backed by the Secret Vault (cross-tool synergy — local equivalent of Postman's paid secret masking).
8. **WebSocket tester** — browsers don't enforce CORS on WS, so this is mostly frontend; no proxy needed. (gRPC explicitly out of scope.)
9. Cheap parity wins: Insomnia import · more code-gen targets (Python `requests`, axios, Go) · markdown docs field per request · collection-level default auth.
10. Decide `connect-src` policy: keep `'self'` (all cross-origin traffic via proxy — current behavior) vs. relax to `http: https:` to enable the direct-first path in §4.7. Document the chosen trade-off.
11. Response niceties: saved example responses, large-response handling.
12. HTTP Mock Server (FEAT-5) — pairs with the runner; Postman's mocks are cloud-only, a local mock server is on-brand.

> **Deliberate non-goals vs Bruno:** live file-based collections (conflicts with the DevDB-only constraint in §2 — the zip export + CLI runner cover the git/CI workflow instead) and gRPC (effort/value off-balance for a local suite).

### v0.4.0 — UX Foundation

- Persistent back-to-tools nav header on all tool pages.
- Empty state screens for all tools (CSS `::before` placeholder).
- Keyboard shortcut overlay (`Ctrl+/`) across all tools.
- Search / filter bar on tools page.
- Drag-and-drop file upload standardized via shared `dropzone.js`.
- Recent + Pinned tools section on tools page.
- Actionable error messages (what / why / how to fix).

### v0.5.0 — Power User

- Global command palette (`Ctrl+K`) with fuzzy search across all tools.
- Loading / progress states for slow operations (file converter, SSH connect).
- In-tool input history (last 5 inputs, auto-save to `localStorage`).
- JWT Debugger: full decode + verify (HS256/RS256).
- Cron Visualizer: real-time next-run countdown.
- Vault clipboard auto-clear (30-second countdown).

### v1.0.0 — Production Ready

- Docker + `docker-compose.yml`.
- Playwright e2e tests (all tools).
- `CONTRIBUTING.md` with step-by-step new-tool guide.
- `static/_template.html` starter.
- `.env.example` documenting all env vars.
- Integration tests for all crypto and auth paths.
- Version badge in every tool page footer.

### Backlog (unscheduled)

- Color Studio: gradient generator, contrast checker, palette exporter.
- ID Generator: UUID, ULID, CUID bulk generation.
- Markdown Lab: Monaco → rendered HTML preview.
- HTTP Mock Server: define local mock endpoints.
- Folder Diff streaming zip (fflate + File System Access API).
- Dockerfile + docker-compose.
- PyPI packaging (`pip install devsuite`).
- GitHub Release automation.
- Homebrew formula.
- Tauri native app wrapper (evaluation).
- Argon2id KDF migration (SEC-13).
- Localhost HTTPS / self-signed cert (SEC-12).
- SSH tab color coding and drag-to-reorder.
- 3-Way merge diff view.
- Regex multi-input test suite tab.
- Undo/redo for bulk JSON/YAML editor operations.

---

## 14. Developer Workflow

### 14.1 Adding a New Tool

1. Run `/speckit-specify` to create `specs/NNN-tool-slug/` (next number after the highest existing
   one — see §4's index), then `/speckit-plan` → `/speckit-tasks` before implementing.
2. Create `static/mytool.html` — import `style.css`, `theme.js`, `auth-guard.js` (if DevDB-backed).
3. Create `static/mytool.js` and `static/mytool.css` if needed.
4. Add route in `main.py`: `@app.get("/mytool", response_class=HTMLResponse)`.
5. Add a `tool-card` entry in `static/tools.html` with `data-category` attribute.
6. Add the new tool to the section 3.4 module-to-file map and the §4 index in this spec.
7. Add tests in `tests/python/` and/or `tests/javascript/`.
8. Update version, `README.md`, and `CHANGELOG.md`.
9. Fold durable contracts (routes, stores, security rules) from the new tool's spec back into
   this document (§1 rule) in the same commit that ships the feature.

### 14.2 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DEVSUITE_DEV` | `0` | Set to `1` to enable `/docs` (Swagger UI) and `/redoc` |
| `DEVSUITE_HTTPS` | `0` | Set to `1` to add `Secure` flag to `ds_session` and `ds_csrf` cookies (use when serving over HTTPS) |
| `DEVDB_PASSWORD` | _(empty)_ | Server-side DevDB encryption password (leave blank to disable) |
| `PORT` | `8000` | Port Uvicorn listens on — honoured by `__main__` (`python main.py`) and by `start.sh`/`start.ps1`. |
| `HOST` | `127.0.0.1` | Bind host — honoured by `__main__` and by `start.sh`/`start.ps1`. `--reload` is only enabled when `DEVSUITE_DEV=1` (in `__main__` and both start scripts). |

### 14.3 Upgrade Process Summary

1. Run `scripts/check_updates.py` → identify outdated packages.
2. Review changelogs for breaking changes.
3. `pip install -r requirements.txt --upgrade` + `pip check`.
4. `pip-audit` — must be clean.
5. Replace vendored JS files manually for JS lib upgrades.
6. Run full test suite + manual golden-path checklist.
7. Commit: `"chore: upgrade third-party libraries — <month> <year>"`.
8. Update Known Version columns in `UPGRADE_PLAN.md`.

---

*This spec reflects DevSuite v0.3.0. Update before implementing any new feature or changing existing behavior.*