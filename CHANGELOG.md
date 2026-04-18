# Changelog

All notable changes to this project will be documented in this file.
Versions follow [Semantic Versioning](https://semver.org/). This log was reset at **v0.1.0** to establish a clean baseline reflecting the current full feature set.

---

## [Unreleased]

---

## [0.1.2] — 2026-04-18

Code quality and security hardening pass — no behaviour changes. All changes address SonarQube static-analysis rule violations to reduce cognitive complexity, close security-tool findings, improve code clarity, and align with modern JS/Python idioms.

### Internal / Code Quality

#### `main.py`
- **Cognitive complexity (S3776)**: Extracted `_dashboard_ws_approve_host`, `_ssh_dashboard_connect`, `_parse_distro_from_config`, `_exec_pty_child`, and `_run_local_pty_loop` helpers from `ssh_dashboard` and `local_terminal` WebSocket handlers to bring each function within the complexity budget.
- **OpenAPI response codes**: Added `responses={...}` annotations to all API endpoints that were missing documented error codes (401, 400, 404, 413, 500).
- **`_ws_wait_for_host_key_response`**: Extracted the host-key approval polling loop from the inline closure into a named top-level coroutine.

#### `devdb.py`
- **Cognitive complexity (S3776)**: Extracted `_decrypt_body`, `_verify_plain_body`, and `_load_db_obj` as private helpers from `_parse`; each helper has a single responsibility and a clear docstring.

#### `static/app.js`
- **Module-level hoisting (S7721)**: Hoisted `countLines`, `isBinaryFile`, `formatFileDate`, `formatSize`, `getLanguageFromPath`, `allFileStatuses`, `collectFilePaths`, and `propagateFolderStatuses` out of `DOMContentLoaded` to module scope.
- **Merge-arrow helpers**: Extracted `_mergeToRightPureDeletion`, `_mergeToRightPureInsertion`, `_mergeToLeftPureDeletion`, `_mergeToLeftPureInsertion`, and `handleMergeClick` from the inline merge-click handler to reduce cognitive complexity.
- Removed unused local variable assignments (`statsBar`, `fileTreeEl`, `changedFilesCount`, `activeFilePath`).

#### `static/api-client.js` / `api-client.ts`
- Extracted `_bodyToString`, `_decodeProxyResponse`, `_buildProxyOptions`, and `_parseResponse` helpers from `execute`; the main `execute` method is now a thin coordinator.
- `String.fromCharCode` → `String.fromCodePoint`; `charCodeAt` → `codePointAt` (S2302 / safer Unicode handling).

#### `static/api-tester.js`
- Extracted `buildRequestConfig` and `renderResponse` from the `btnSend` click handler.
- Extracted `resolveMonacoTheme` helper to eliminate duplicated theme-resolution logic.
- `window.*` → `globalThis.*`; `btn.getAttribute('data-target')` → `btn.dataset.target`.

#### `static/cron.js`
- Extracted `_parseSpecialTokens`, `_parseResolvedToken`, `_parseWeekdayW`, and `_parseSingleNumber` from the monolithic `_parseToken` method.
- `parseInt` → `Number.parseInt`; `isNaN` → `Number.isNaN`; `replace(regex, …)` → `replaceAll(string, …)` throughout.

#### `static/ssh-manager.js`
- `window.location` → `globalThis.location`; `parseInt` → `Number.parseInt`; `keys[keys.length - 1]` → `keys.at(-1)`; null-safe `ws?.readyState` checks.
- Inline comment cleaned up for `sftpConn` / `dashConn` state variables.

#### `static/regex.html`
- Extracted `buildGroupChip` helper; hoisted `buildRegex` to module scope.
- `window.MonacoEnvironment` → `globalThis.MonacoEnvironment`.
- Removed unused `matchEmpty` variable reference.
- Fixed group-chip text colour for light themes (`#6ee7b7` → `#059669` for WCAG contrast compliance).

#### `static/base64.html`
- `window.MonacoEnvironment` → `globalThis.MonacoEnvironment`.
- `String.fromCharCode` → `String.fromCodePoint`; `charCodeAt` → `codePointAt`.
- `replace(regex, …)` → `replaceAll(string, …)` for URL-safe Base64 substitutions.
- Removed unused `outputEditor` variable.

#### `start.sh`
- Extracted repeated string literals (`'python'`, `'unknown'`, `'Windows'`) into `readonly` constants (S1192).
- `[ … ]` → `[[ … ]]` for all conditionals; `[ -eq ]` → `[[ -eq ]]`.
- Added `>&2` redirect on the error message in `run_as_root`.

#### `static/json.html` / `static/yaml.html` (D-5 a11y progress)
- Added `aria-label` to `<header>`, back-link `<a>`, and every toolbar `<button>`.
- `aria-hidden="true"` on all decorative SVG icons and separator `<div>`s.
- `role="toolbar"` + `aria-label` on action toolbars.
- `role="status"` + `aria-live="polite"` + `aria-atomic="true"` on status pills.
- `aria-live="polite"` / `aria-atomic="true"` on live character and line-count badges.
- `role="alert"` + `aria-live="assertive"` on error panels.
- `role="textbox"` + `aria-label` + `aria-multiline="true"` on Monaco editor host divs.
- `role="region"` + `aria-label` + `aria-live="polite"` on output editor containers.
- `id="input-editor-label"` anchor added to JSON input pane header for future `aria-labelledby` wiring.

#### `static/base64.html` (D-5 a11y progress)
- Added `aria-label` to `<header>` and back-link `<a>`; `aria-hidden="true"` on decorative SVG icons.
- `aria-live="polite"` + `aria-atomic="true"` on the char-count badge.

#### `static/regex.html` (D-5 a11y progress)
- Flag toggle buttons now sync `aria-pressed="true"/"false"` on every click, enabling screen readers to announce the pressed state correctly.

---

---

## [0.1.1] — 2026-04-15

Bugfix release. No new features; all changes address correctness, accessibility, and code-quality issues identified after the v0.1.0 baseline.

### Bug Fixes

#### Secret Vault (`vault.js`)
- **New-vault setup regression** — after `POST /api/auth/setup` succeeds, a server session is now acquired immediately and the initial vault-salt save (which previously failed because no session existed yet) is retried. Without this fix a newly created vault could not persist its salt on first save.

#### Diff Checker (`app.js`)
- **Monaco theme not applied on load** — replaced direct `themeSelect.value` access with a `getMonacoTheme()` helper that falls back to `localStorage['devsuite-theme']` when `themeSelect` is `null`, preventing the editor from rendering in the wrong theme during initialisation.
- **Patch generation silent no-op** — patch loop conditions (`&& oE > 0` / `&& mE > 0`) were inside the loop body, making loop iterations with no lines silently skip. Moved to `if`-guards around each loop.
- **Folder tree sort non-deterministic** — file-path sort now uses `localeCompare()` for consistent locale-aware ordering across platforms.

#### Folder Diff (`index.html`)
- **Folder input blocked inside hidden parent** — browsers silently block `input.click()` when the input lives inside a `display:none` ancestor. Both folder `<input type="file">` elements are now hoisted outside the collapsible setup wrapper.
- **Accessibility** — folder-picker trigger elements converted from `<button onclick="input.click()">` to `<label for="...">`, enabling native browser association and keyboard activation without JavaScript.

#### SFTP Browser / SSH Manager (`sftp-browser.js`, `ssh-manager.js`)
- **Group name sort non-deterministic** — SSH session group names now sort with `localeCompare()` for consistent Unicode-aware ordering.

#### `start.sh`
- **Unsupported package manager silent fall-through** — the `case` statement now has a `*)` wildcard that prints a clear error message and exits with code `1` instead of silently continuing.

### Internal / Code Quality

- **`main.py`** — imports reorganised alphabetically; shared string constants extracted (`_ALLOWED_ORIGINS`, `_ERR_ORIGIN_REQUIRED`, `_ERR_ORIGIN_NOT_ALLOWED`, `_ERR_SFTP_FAILED`, etc.); `# pylint: disable` annotations added to complex route handlers; unused `application` parameter in lifespan renamed to `_application`; PTY module globals renamed `_pty_available` (snake_case) for consistency.
- **`devdb.py`** — `BaseException` catch block annotated with `# NOSONAR` to suppress false-positive static-analysis warning; clarifying comment added.
- **SonarQube** — `sonar-project.properties` added to project root for SonarQube/SonarCloud analysis.
- **Tests** — test files reorganised under `tests/python/` and `tests/javascript/`; JavaScript test suite now includes a `FormData` no-op stub for the devdb-client tests.

---

## [0.1.0] — 2026-04-12

This is the **baseline release** — a comprehensive snapshot of all features, tools, and infrastructure present in DevSuite at this version. Future releases will document incremental changes against this baseline.

### Tools

#### Diff Checker (`/diff`)
- Side-by-side and Inline comparison modes via Monaco Editor.
- Merge arrows to copy individual hunks left→right or right→left.
- Keyboard shortcut `Ctrl/Cmd+Enter` to compare; `Escape` to reset.
- Paste from Clipboard button per panel; Copy Panel Content button.
- Live Diff Stats Bar with additions, removals, and hunk count.
- Export diff as `.patch` file or copy unified diff to clipboard.
- Line count badges per panel, updated on every keystroke.
- **Folder Diff** tab — compare entire directory trees; filter chips (All / Modified / Added / Removed); file upload support; deep-link via `/diff?tab=folder-diff`.

#### JSON Linter & Formatter (`/json`)
- Real-time JSON validation with exact line/column error pointers.
- Pretty-print, minify, and sort keys alphabetically.
- Monaco Editor integration with syntax highlighting.

#### YAML Linter & Validator (`/yaml`)
- YAML parsing and validation powered by `js-yaml` (CDN).
- Format clean YAML or convert directly to JSON with one click.
- Useful for Kubernetes, Docker Compose, and GitHub Actions configs.

#### Regex Tester (`/regex`)
- Real-time match highlighting inside Monaco Editor.
- Group capture and named group display panel.
- `g`, `i`, `m`, `s` flag toggles.

#### Base64 Encoder / Decoder (`/base64`)
- Encode/decode strings with full UTF-8 support.
- URL-safe mode.
- JWT decoding panel — splits header, payload, and signature; pretty-prints JSON.

#### Crypto Suite (`/crypto`)
- **Hash Generator** — MD5, SHA-1, SHA-256, SHA-512 with per-hash copy buttons.
- **AES Encrypt/Decrypt** — CBC, ECB, CTR mode selection via CryptoJS (self-hosted).
- **RSA Key Pair** — generate 2048/4096-bit keypairs; in-browser encrypt/decrypt.
- **HMAC Sign & Verify** — SHA-256 and SHA-512 with a visual OK/INVALID banner.
- All operations fully offline via self-hosted `crypto-js.min.js` (v4.2.0).

#### Link & QR Studio (`/url-shortener`)
- Local URL shortener generating short `/r/<id>` redirect links.
- QR Code and Code128 Barcode generated for every shortened link (using the original URL).
- PNG download for both QR Code and Barcode.
- Recent links panel backed by `localStorage`.
- Short link IDs are collision-safe (up to 10 retries for uniqueness).
- Persistence via DevDB (`url_db` store); survives server restarts.

#### Local API Tester (`/api-tester`)
- Full REST client — GET, POST, PUT, DELETE, PATCH, custom headers and body.
- Request Collections with folder organization.
- Local CORS proxy (`/api/proxy`) to bypass browser CORS restrictions.
- Persistent collections saved in DevDB (`collections` store).
- 8-hour session auth via `auth-guard.js`.

#### Secure Terminal & SFTP (`/ssh`)
- Multi-tab SSH client — parallel sessions to different hosts, each in its own xterm.js tab.
- Password and Private Key (PEM) authentication.
- Session profiles stored in DevDB (`ssh_profiles` store); encrypted client-side with a Master Password.
- Tree-style sidebar with collapsible group folders and quick-search/filter.
- Inline Delete icon on sidebar items — no modal required.
- Terminal resize events propagated to the remote PTY.
- **SFTP Browser** sub-tab — browse, navigate, and inspect remote filesystems; grid view with type icons, sizes, up/back navigation, refresh, and disconnect.
- **WSL / Local Terminal** — auto-discovers installed WSL distributions; spawns local PTY shells.
- **Standalone SFTP Browser** (`/sftp`) — direct deep-link to the SFTP Browser without opening the terminal.

#### Cron Visualizer (`/cron`)
- 4 dialect support: Unix/Linux (5-field), Quartz/Spring (6–7-field, with `?`, `L`, `W`, `#`), AWS EventBridge (6-field with year), GitHub Actions (with inline YAML context).
- Live expression parser with per-field tokenization, colour-coded field chips, and a ✓/✗ status pill.
- Human-readable description (e.g., *"Every 15 minutes, between 9:00 AM and 5:00 PM, Monday through Friday"*).
- Visual Field Builder — click-to-toggle grids for Minute (0–59), Hour (0–23), Month, Day-of-Week; bidirectionally synced with the text input.
- Next 10 Run Times panel — brute-force minute-iteration scheduler; shows locale date, time, and relative countdown.
- 28-Day Activity Heatmap — CSS grid calendar with teal intensity shading; hover tooltip per day.
- Preset Library — curated common expressions per dialect (Unix, Quartz, AWS, GitHub), click-to-load.
- Export — copy raw expression, GitHub Actions / Kubernetes CronJob YAML, or AWS EventBridge JSON.

#### Secret Vault (`/vault`)
- KeePass-style encrypted secret manager for tokens, passwords, SSH keys, and API credentials.
- AES-256 client-side encryption via CryptoJS — the server never sees plaintext.
- Lock screen on every visit; Master Password is never stored anywhere.
- CRUD interface — add, view (reveal/hide), copy to clipboard, edit, and delete entries.
- Categories: Token, Password, SSH Key, API Key, Note, Other.
- Persistence via DevDB (`vault` store).

#### DevDB Manager (`/db-manager`)
- Unified encrypted database inspector for all DevDB stores.
- Shows store names, approximate sizes, and database metadata (created, modified timestamps).
- Export / Import — download or upload the full `.dsb` database file.
- Store viewer — browse raw JSON content of any named store.
- Auth-gated with always-ask Master Password lock screen.

#### File Format Converter (`/file-converter`)
- Multi-format conversion engine supporting: JSON, CSV, YAML, XML, TSV, XLSX, Markdown, HTML, DOCX, and PDF.
- **Client-side** (in-browser): JSON ↔ YAML, JSON ↔ CSV, JSON → XML, YAML → JSON, Markdown → HTML.
- **Server-side** (Python): XLSX ↔ CSV/JSON, PDF → TXT, DOCX → TXT, DOCX/HTML/Markdown → PDF (via WeasyPrint).
- Drag-and-drop upload zone or file picker.
- Output displayed inline with a download button.

---

### Backend & Infrastructure

#### FastAPI Application (`main.py`)
- Single-file backend serving all routes, WebSocket terminals, SFTP API, DevDB REST API, and CORS proxy.
- HTTP Security Middleware on every response: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Content-Security-Policy`, `Referrer-Policy`.
- Lifespan event (`@asynccontextmanager`) opens DevDB, runs legacy migration, and seeds the URL cache on startup.
- Routes: `/`, `/diff`, `/json`, `/yaml`, `/regex`, `/base64`, `/crypto`, `/url-shortener`, `/api-tester`, `/ssh`, `/sftp`, `/cron`, `/vault`, `/db-manager`, `/file-converter`.
- Static assets served from `/static/` via `StaticFiles`.
- File upload endpoint (`POST /upload`) — validates binary content, enforces 50MB limit.
- CORS proxy (`POST /api/proxy`) — forwards requests to an explicit allowlist of remote hosts.
- URL shortener API (`POST /api/shorten`, `GET /r/{short_id}`) — backed by DevDB.
- Collections API (`GET/POST /api/collections`) — backward-compatible shim for API Tester.
- Vault API (`GET/POST /api/vault`) — opaque blob pass-through; server never decrypts.
- SSH Profiles API (`GET/POST /api/ssh/profiles`) — opaque blob pass-through.
- DevDB REST API (`GET/POST /api/db/store/{name}`, `GET /api/db/meta`, `GET /api/db/export`, `POST /api/db/import`).
- Auth endpoints (`GET /api/auth/status`, `GET /api/auth/challenge`, `POST /api/auth/setup`, `POST /api/auth/update-challenge`).
- WebSocket SSH terminal (`/api/ssh/terminal`) — asyncssh-based with PTY resize support.
- WebSocket local terminal (`/api/local/terminal`) — spawns PTY shells for WSL distros and local bash.
- SFTP REST API (`POST /api/sftp/list`, `POST /api/sftp/download`, `POST /api/sftp/upload`).
- WSL discovery (`GET /api/wsl/discover`).
- File conversion endpoint (`POST /api/convert`) — delegates to openpyxl, pypdf, python-docx, mammoth, weasyprint.

#### DevDB Storage Engine (`devdb.py`)
- KeePass-style binary container (`.dsb`) for all DevSuite persistent data.
- **Header**: 64-byte fixed layout — magic (`DSDB`), version, flags, KDF, iterations, salt (256-bit), nonce (96-bit).
- **Plain mode**: BLAKE2b-256 checksum prepended to JSON payload.
- **Encrypted mode**: AES-256-GCM with PBKDF2-HMAC-SHA256 (200k iterations, 256-bit salt).
- Thread-safe via `threading.Lock`; atomic writes via temp-file + `os.replace`.
- Public API: `open()`, `save()`, `get_store()`, `set_store()`, `delete_store()`, `list_stores()`, `store_sizes()`, `meta()`, `export_bytes()`, `from_bytes()`, `change_password()`.
- **Legacy migration**: `migrate_legacy()` automatically imports old `vault.json`, `collections.json`, `ssh_profiles.json`, and `url_db.json` into DevDB on first startup.

#### Shared Frontend Modules
- `theme.js` — global theme manager (Dark, Light, High Contrast, Frosted Glass); fires `devsuite-theme-changed` custom event.
- `components.js` — `DevSuite.toast(msg, type, ms)` notification utility; `DevSuite.initMonaco(callback)` loader helper.
- `auth-guard.js` — 8-hour session authentication for DevDB-backed tools; caches verified Master Password in `sessionStorage`; shows a re-authentication modal on expiry.
- `devdb-client.js` — thin fetch wrapper around `/api/db/*`; provides `DevDB.getStore()`, `DevDB.setStore()`, `DevDB.getMeta()`.

---

### UI / Design System
- Glassmorphic UI with `backdrop-filter: blur`, dynamic gradients, and ambient glow effects.
- Neumorphic buttons and form elements (`--neu-raise`, `--neu-press` CSS variables).
- 4 themes: Midnight Dark (`vs-dark`), Clean Light (`vs`), High Contrast (`hc-black`), Frosted Glass (`ios-glass`).
- JetBrains Mono for code panels; Inter for UI text.
- Consistent tool header pattern across all 13 tools (back-link, icon, name, theme switcher).
- Shared toast notification system.

---

### Security Posture
- DOM XSS hardened — all dynamic content via `document.createElement()` + `textContent`; no untrusted `innerHTML`.
- Self-hosted libraries — `crypto-js.min.js` (v4.2.0), `bwip-js-min.js` (v3.4.1) served from `/static/`.
- HTTP Security Headers on all responses.
- URL validation — shortener backend validates scheme + host before storage.
- Client-side encryption — vault and SSH profiles encrypted in-browser; backend is an opaque store.
- Collision-safe short IDs — generator retries up to 10 times.
- 8-hour session tokens — Master Password cached in `sessionStorage`, not `localStorage`.
