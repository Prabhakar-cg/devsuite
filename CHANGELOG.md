# Changelog

All notable changes to this project will be documented in this file.
Versions follow [Semantic Versioning](https://semver.org/). This log was reset at **v0.1.0** to establish a clean baseline reflecting the current full feature set.

---

## [0.1.0] — 2026-04-11

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
