# DevSuite — Developer Tools from Hell

![Version](https://img.shields.io/badge/version-0.3.0-blue)
[![CodeQL](https://github.com/Prabhakar-cg/devsuite/actions/workflows/codeql.yml/badge.svg)](https://github.com/Prabhakar-cg/devsuite/actions/workflows/codeql.yml)
[![Tests](https://github.com/Prabhakar-cg/devsuite/actions/workflows/tests.yml/badge.svg)](https://github.com/Prabhakar-cg/devsuite/actions/workflows/tests.yml)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Prabhakar-cg/devsuite?utm_source=oss&utm_medium=github&utm_campaign=Prabhakar-cg%2Fdevsuite&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Prabhakar-cg_devsuite&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Prabhakar-cg_devsuite)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Prabhakar-cg_devsuite&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Prabhakar-cg_devsuite)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=Prabhakar-cg_devsuite&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=Prabhakar-cg_devsuite)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=Prabhakar-cg_devsuite&metric=bugs)](https://sonarcloud.io/summary/new_code?id=Prabhakar-cg_devsuite)
[![Known Vulnerabilities](https://snyk.io/test/github/Prabhakar-cg/devsuite/badge.svg?targetFile=requirements.txt)](https://snyk.io/test/github/Prabhakar-cg/devsuite)

A beautiful, locally-hosted developer tools suite powered by **FastAPI** and the **Monaco Editor**. 100% private — all file reading and data processing is done locally. No data ever leaves your machine.

> [!WARNING]
> **DevSuite is under active development.** Expect rough edges, breaking changes between versions, and features that are still taking shape. Feedback, bug reports, and ideas are very welcome — please [open an issue](https://github.com/Prabhakar-cg/devsuite/issues).

---

## Supported Tools

### 1. Diff Checker
- **Side-by-side & Inline** comparison modes via Monaco Editor.
- **Merge arrows** to copy individual hunks left→right or right→left.
- **Folder Diff** — compare entire directory trees with filter chips (All / Modified / Added / Removed).
- Export as `.patch` or copy unified diff to clipboard.

### 2. Data Format Linter
- **JSON / YAML / XML / TOON tab strip** — switch formats instantly, in-page, no reload; input text is preserved across switches, output resets.
- **JSON tab** — Validate, Format (2-space pretty-print), Minify, Sort Keys (recursive alphabetical).
- **YAML tab** — Validate, Format (2-space/120-column/double-quote re-dump). Supports Kubernetes, Docker Compose, GitHub Actions configs.
- **XML tab** — Validate (well-formedness only, via the browser's native parser), Format (2-space structural reindent), Minify — mixed content, CDATA, and comments always preserved untouched.
- **TOON tab** — Validate/Format against a first-party implementation of [Token-Oriented Object Notation](https://github.com/toon-format/spec), a compact indentation-based format with tabular arrays, designed to cut token count in LLM prompts.
- **Convert to any other format** — every tab has a "→ <format>" button for each of the other three, routed through a shared canonical value so JSON/YAML/XML/TOON all interconvert; named array fields survive an XML round trip via an `<item>`-wrapped element.
- Legacy routes `/json`, `/yaml`, `/xml` keep working (each opens the matching tab); the primary route is `/data-linter` (`?tab=toon` for TOON, which has no bare legacy route).

### 3. Regex Tester
- Real-time match highlighting inside the Monaco Editor.
- Group captures and named group display.
- `g`, `i`, `m`, `s` flag toggles.

### 4. Base64 Encoder / Decoder
- Encode/Decode strings with full UTF-8 support.
- URL-safe mode and JWT decoding panel (splits header, payload, signature).

### 5. Crypto Suite
- **Hash Generator** — MD5, SHA-1, SHA-256, SHA-512 in one shot.
- **AES Encrypt / Decrypt** — CBC, ECB, and CTR modes via CryptoJS (self-hosted).
- **RSA Key Pair** — generate 2048/4096-bit keypairs, encrypt, and decrypt in-browser.
- **HMAC Sign & Verify** — SHA-256 and SHA-512.
- Navigate all panels via tab buttons; all operations are fully offline.

### 6. Local API Tester
- **Local-first REST client** — a high-speed REST client for testing endpoints. No account, no cloud sync, no telemetry.
- **Request Engine** — GET, POST, PUT, DELETE, PATCH, custom headers, JSON / form / text / GraphQL bodies, OAuth2.
- **Collection Runner** — run a folder or the whole collection sequentially with per-request test results and a pass/fail summary; runtime variables persist across the run for request chaining.
- **Sandboxed scripting** — pre-request and test scripts execute in a dedicated Web Worker with no page, cookie, or network access (and `unsafe-eval` removed from the page CSP).
- **cURL in & out** — paste a curl command to import it; copy any request as cURL, fetch, or HTTPie.
- **Nested folders** — `/`-separated folder paths with auth inheritance down the tree; Postman imports keep their hierarchy.
- **Cookie jar** — session-scoped, in-memory; captures Set-Cookie from proxied responses and attaches matching cookies automatically.
- **Git-friendly export** — export the collection as a zip with one JSON file per request (folder tree mirrored), ready to commit; zip import round-trips.
- **Imports** — Postman v2.x collections & environments, OpenAPI 3.x / Swagger 2.x, DevSuite JSON/zip.
- **Local CORS Proxy** — built-in FastAPI proxy to bypass browser CORS restrictions (SSRF-guarded).
- **Persistent Collections** — saved in DevDB (`collections` store).

### 7. Secure Terminal & SFTP
- **Multi-tab SSH client** — open parallel sessions to different hosts, each in its own xterm.js tab.
- **Password & Private Key auth** — PEM key import supported.
- **Encrypted profiles** — session credentials stored in DevDB (`ssh_profiles` store), encrypted client-side with a Master Password.
- **SFTP Browser** (sub-tab) — browse, navigate, and inspect remote filesystems. Grid view with file type icons, sizes, up navigation, refresh, and disconnect.
- **WSL / Local Terminal** — auto-discovers WSL distributions; spawns local PTY shells directly.
- **Inline delete** — remove sessions from the sidebar with a single click (no modal needed).
- **Network Notice**: Session profiles are stored locally (in DevDB / `ssh_profiles`, encrypted client-side). However, SSH/SFTP actions and the local CORS proxy initiate **outbound network connections** — backend endpoints such as `/api/proxy`, `/api/ssh/terminal`, and `/api/sftp/*` transmit data off-machine to the target host. The strictly-offline guarantee applies only to tools that perform no network I/O.

### 8. Cron Visualizer
- **4 dialect support** — Unix/Linux, Quartz/Spring, AWS EventBridge, GitHub Actions.
- **Live expression parser** with per-field validation chips and plain-English human-readable description.
- **Visual Field Builder** — click-to-toggle grids for Minute, Hour, Month, Day-of-Week; synced with the text input.
- **Next 10 Run Times** — computed locally, no external libraries.
- **28-Day Activity Heatmap** — CSS grid calendar with teal intensity shading based on fire frequency.
- **Preset Library** — curated common expressions per dialect (Unix, Quartz, AWS, GitHub), click-to-load.
- **Export** — copy raw expression, YAML (K8s / GitHub Actions), or AWS EventBridge JSON.

### 9. Secret Vault
- **KeePass-style encrypted secret manager** — store tokens, passwords, SSH keys, and API credentials.
- **AES-256 client-side encryption** — all secrets are encrypted in-browser before being sent to the backend. The server never sees plaintext.
- **Master Password gate** — lock screen on every visit; password is never stored anywhere.
- **CRUD interface** — add, view, copy, edit, and delete entries with a single click.
- **Categories** — organize secrets by type (Token, Password, SSH Key, API Key, Note, Other).
- **Persistence** via DevDB (`vault` store) — survives server restarts.

### 10. DevDB Manager
- **Unified encrypted database inspector** — view all DevDB stores, sizes, and metadata.
- **Export / Import** — download or upload the full `.dsb` database file.
- **Auth-gated** — requires the same Master Password used by the Secret Vault.
- **Store viewer** — browse raw JSON content of any named store.

### 11. File Format Converter
- **Multi-format conversion engine** — convert between JSON, CSV, YAML, XML, TOON, TSV, XLSX, Markdown, HTML, DOCX, and PDF.
- **Fully-connected structured-data cluster** — JSON, CSV, TSV, YAML, XML, and TOON each convert to all five of the others, entirely client-side (uses the same first-party [TOON](https://github.com/toon-format/spec) codec as the Data Format Linter's TOON tab, shared via `static/toon.js`).
- **Server-side conversions** — XLSX ↔ CSV/JSON, PDF → TXT, DOCX → TXT, and document → PDF via WeasyPrint.
- **Drag-and-drop upload** — supports drag-and-drop or file picker.

### 12. Notes Workspace
- **Notepad++-style editor** — multi-tab Markdown editing via Monaco, with syntax highlighting and find & replace.
- **OneNote-style organization** — Notebook → Section → Page hierarchy with drag-to-reorder.
- **Obsidian-style wiki-links** — `[[Page Name]]` cross-references with autocomplete, create-on-link, and an automatic backlinks panel; renaming a page updates every link that pointed at it.
- **Tags & search** — inline `#tag` syntax with a tag browser, plus full-text search across every notebook.
- **AES-256-GCM client-side encryption** — same v2 scheme as Secret Vault; the server only ever stores an opaque encrypted blob (`notes` store).
- **Master Password gate** — same shared Master Password as Secret Vault; no unencrypted fallback.

---

## Premium UI
- Glassmorphic UI with dynamic gradients and ambient glow effects.
- Neumorphic buttons and customized scrollbars.
- **6 themes**: Terminal Noir, Midnight, Ocean, Solarized Dark, Clean Light, High Contrast.
- All tools share a consistent header, theme switcher, and toast notification system.

---

## Privacy & Security
- **Local-first** — most tools process data entirely in-browser or via the local FastAPI backend with no external network access. Tools that establish outbound connections (SSH/SFTP via `/api/ssh/terminal`, `/api/sftp/*`, and the proxy via `/api/proxy`) transmit data to the target host; session credentials are encrypted client-side before leaving the browser.
- **Unified encrypted storage** — all persistent data lives in `~/.devsuite/devdb.dsb`, a KeePass-style binary container (AES-256-GCM, PBKDF2 key derivation, 200k iterations).
- **Client-side encryption** — the vault and SSH profiles are encrypted in-browser before reaching the backend. The server never handles plaintext secrets.
- **DOM XSS hardened** — all dynamic content is inserted using `textContent` / `createElement` APIs; no untrusted strings ever reach `innerHTML`. The one controlled exception is the Notes Workspace Markdown preview, which assigns `DOMPurify.sanitize(marked.parse(...))` to `pane.innerHTML` — sanitized before insertion, never raw.
- **Self-hosted libraries** — `crypto-js` and `xterm.js` are served from `/static/` rather than an external CDN.
- **HTTP Security headers** — `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, and `Referrer-Policy` on every response.
- **HttpOnly session cookie** — the server-side session token is delivered as an `HttpOnly; SameSite=Strict` cookie (`ds_session`). JavaScript cannot read or exfiltrate it.
- **CSRF protection** — every mutating request (`POST/PUT/DELETE/PATCH`) must carry an `X-CSRF-Token` header matching the `ds_csrf` cookie, verified with a constant-time comparison.
- **BLAKE2b session-token hashing** — only the BLAKE2b-32 digest of each session token is kept in server memory; a process-memory snapshot does not yield usable tokens.
- **Auth endpoint rate limiting** — `/api/auth/challenge` and `/api/auth/session` accept at most 5 requests per minute per IP (HTTP 429 beyond that), preventing brute-force and timing attacks.
- **Audit log** — sensitive operations (vault unlock, vault access, SSH connect) are recorded in an append-only `~/.devsuite/audit.log`. Secret values are never logged.
- **SSRF-hardened CORS proxy** — `/api/proxy` resolves and validates every target (and every redirect hop) before connecting, blocking loopback, link-local/cloud-metadata, and reserved IPs, and restricting schemes to `http`/`https`.

> **Security scan coverage note:** Static analysis (SonarCloud, CodeQL, CodeRabbit & Snyk) excludes `static/libs/**` and all `*.min.js` / `*.min.css` files. These are third-party vendored bundles (Monaco Editor, xterm.js, crypto-js) and are not covered by automated security scanning. Keep them updated to their latest stable releases to manage upstream CVEs.

---

## Getting Started

### Prerequisites
- Python 3.10+

> [!NOTE]
> All HTML, CSS, and JS run directly in the browser with no compilation, bundler, or build step. Python is the only runtime requirement — Node.js and npm are **not** needed to run DevSuite.

### Quick Start

```bash
chmod +x start.sh
./start.sh
```

*(On a fresh Debian/Ubuntu system, `start.sh` will auto-detect and attempt to install `python3`, `python3-venv`, and dependencies as necessary.)*

Open **[http://localhost:8000](http://localhost:8000)** in your browser.

### Manual Setup

```bash
# 1. Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start the server
uvicorn main:app --port 8000 --reload
```

---

## Project Structure

```text
devsuite/
├── main.py                  # Thin orchestrator — app factory, middleware, router inclusion
├── deps.py                  # Shared singletons & helpers (DevDB, limiter, sessions, constants)
├── routes/                  # APIRouter modules: auth, convert, db, pages, proxy, ssh, storage
├── devdb.py                 # Unified Storage Engine — KeePass-style .dsb binary format (AES-256-GCM)
├── requirements.txt         # fastapi, uvicorn, asyncssh, cryptography, openpyxl, pypdf, etc.
├── start.sh                 # One-shot virtual environment setup & run script
├── start.ps1                # PowerShell equivalent for Windows
└── static/
    ├── home.html            # DevSuite dashboard / homepage
    ├── home.css             # Homepage-specific styles (hero, tool cards, roadmap)
    ├── style.css            # Global design system and component CSS (tokens, glassmorphism)
    ├── linter.css           # Shared two-pane layout for linter/tester/crypto tools
    ├── theme.js             # Theme manager (Dark, Light, HC, Frosted Glass)
    ├── components.js        # Shared UI utilities — DevSuite global: CSRF token helper, toast notifications, Monaco init helper
    ├── auth-guard.js        # 8-hour session auth guard for DevDB-backed tools
    ├── devdb-client.js      # Thin fetch wrapper around /api/db/* endpoints
    │
    ├── index.html           # Text & Folder Diff tool
    ├── app.js               # Diff tool JavaScript (Monaco, merge, folder tree)
    │
    ├── data-linter.html     # Data Format Linter (JSON/YAML/XML tab strip)
    ├── regex.html           # Regex Tester
    ├── base64.html          # Base64 Encoder / Decoder + JWT Inspector
    │
    ├── crypto.html          # Crypto Suite (Hash, AES, RSA, HMAC)
    ├── crypto-js.min.js     # Self-hosted CryptoJS v4.2.0
    │
    ├── api-tester.html      # Local API Tester
    ├── api-tester.js        # API Tester UI logic (collection tree, request tabs, history)
    ├── api-tester.css       # API Tester layout styles
    ├── api-client.js        # Vanilla-JS fetch wrapper used by API Tester
    │
    ├── ssh-manager.html     # Secure Terminal & SFTP (multi-tab SSH + SFTP sub-tab)
    ├── ssh-manager.js       # Terminal & SFTP logic (xterm.js, WebSocket, SFTP grid)
    ├── ssh-manager.css      # Secure Terminal layout, tab strip, SFTP grid styles
    ├── sftp-browser.html    # Standalone SFTP Browser page (/sftp route)
    ├── sftp-browser.js      # Standalone SFTP Browser logic
    ├── sftp-browser.css     # Standalone SFTP Browser styles
    ├── xterm.js             # Self-hosted xterm.js terminal emulator
    ├── xterm.css            # xterm.js styles
    ├── xterm-addon-fit.js   # xterm.js FitAddon (auto-resize)
    │
    ├── cron.html            # Cron Visualizer tool (/cron route)
    ├── cron.js              # Cron parser, describer, scheduler, heatmap, field builder
    ├── cron.css             # Cron Visualizer styles (dialect tabs, heatmap, presets)
    │
    ├── vault.html           # Secret Vault (KeePass-style encrypted secret manager)
    ├── vault.js             # Vault UI logic (lock screen, CRUD, categories, clipboard)
    ├── vault.css            # Vault styles
    │
    ├── db-manager.html      # DevDB Manager (database inspector + export/import)
    ├── db-manager.js        # DevDB Manager UI logic
    ├── db-manager.css       # DevDB Manager styles
    │
    ├── toon.js              # TOON codec (pure, node-testable) — shared by data-linter.html + file-converter.html
    └── file-converter.html  # File Format Converter (JSON, CSV, YAML, XML, TOON, XLSX, PDF, DOCX, etc.)
```

---

## License
MIT
