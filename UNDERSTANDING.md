# DevSuite Component & Architecture Reference

> **For AI Assistants:** This is the token-dense master reference for `DevSuite` (v0.1.1+). Rely on this file over prior context. Never hallucinate outside libraries. Read this fully before starting work.

## 1. System Tenets & Boundaries
- **Strict Privacy**: 100% locally-hosted. No cloud telemetry, no analytics, no external services for core functionality.
- **Tech Stack**:
  - *Backend*: Python 3.10+, FastAPI, Uvicorn (on `localhost:8000`). **Unified Encrypted Storage**: Uses `DevDB` (`.dsb`) binary format (AES-256-GCM) at `~/.devsuite/devdb.dsb`. No external DB.
  - *Frontend*: Vanilla HTML/CSS/JS. **NO frameworks** (React/Vue/Svelte) and **NO build tools** (Webpack/Vite).
  - *Styles*: Vanilla CSS with CSS Custom Properties (variables). **NO Tailwind**, NO CSS-in-JS.
- **Security**:
  - `innerHTML` is **strictly forbidden** when handling untrusted data. Use `document.createElement()` and `elem.textContent`.
  - Content Security Policy (CSP) and HTTP Security Headers are rigidly enforced in `main.py` middleware.
  - Client-side encryption (vault, SSH profiles) uses CryptoJS AES-256 in-browser. The backend **never** decrypts these blobs.
- **Dependency Sourcing**: Third-party JS libraries (e.g., `crypto-js.min.js`, `bwip-js-min.js`) must be self-hosted in `/static/`. (Exceptions: Google Fonts and Monaco Editor via RequireJS CDN.)

## 2. Directory Layout
- **Root (`${WORKSPACE}/devsuite/`)**:
  - `main.py`: The single backend application file — all HTTP routes, WebSocket SSH/local terminal, SFTP API, DevDB REST API, CORS proxy, and static file mounting.
  - `devdb.py`: **Unified Storage Engine**. Manages `.dsb` binary files with AES-256-GCM encryption, PBKDF2 key derivation (200k iterations), BLAKE2b integrity for plaintext mode, and atomic writes. Thread-safe via `threading.Lock`.
  - `start.sh` / `start.ps1`: Scaffold `.venv`, install `requirements.txt`, and boot Uvicorn.
  - `~/.devsuite/devdb.dsb`: The single unified database file. Stores: `url_db`, `collections`, `ssh_profiles`, `vault`.
  - `sonar-project.properties`: SonarQube / SonarCloud analysis configuration.
  - Test files live under `tests/python/` (`test_main.py`, `test_devdb.py`, `test_sftp.py`, `test_regression.py`, `test_new_features.py`, etc.) and `tests/javascript/` (`test_devdb_client.js`, `test_cron_logic.js`, etc.).

- **Frontend (`/static/`)**:
  - *Core*: One HTML file per tool (`index.html` [Diff], `json.html`, `api-tester.html`, etc.).
  - *Shared CSS*: `style.css` (global design tokens, glassmorphism), `linter.css` (two-pane layout for linters/crypto/tester).
  - *Shared JS*: `theme.js` (Light/Dark/High Contrast/Frosted Glass themes), `components.js` (toast utility, Monaco init helper), `auth-guard.js` (8-hour session auth for DevDB tools), `devdb-client.js` (fetch wrapper around `/api/db/*`).

## 3. UI/UX Paradigm
- **Aesthetic**: Glassmorphism (`backdrop-filter: blur`) combined with Neumorphism (soft drop-shadows via `--neu-raise`, `--neu-press`).
- **Tool Header Pattern**: Every tool page has an `<header class="app-header">` with a left-aligned `<a href="/" class="back-link">`, a tool icon mapped to a specific accent color class (e.g., `.tool-icon-indigo`), and a right-aligned theme selector.
- **Global Themes**: Driven by `theme.js`. Available themes: `vs-dark` (Terminal Noir, default), `midnight` (deep purple), `ocean` (deep blue), `solarized` (Solarized Dark), `vs` (Clean Light), `hc-black` (High Contrast). Custom event `devsuite-theme-changed` fires on toggle.
- **Notifications**: Triggered universally via `showToast(msg, type)` (inline per-tool) or `DevSuite.toast(msg, type)` (from `components.js`).

## 4. Authentication & Session Model
- **Master Password**: Set up once via the Secret Vault (`/vault`) lock screen. On first visit, the user creates a password; on subsequent visits, they enter it to unlock.
- **Password Verification**: Stored as a PBKDF2-derived challenge blob via `/api/auth/setup`. Verified on unlock via `/api/auth/challenge` + `/api/auth/status`.
- **Session Caching**: `auth-guard.js` caches the verified password in `sessionStorage` for 8 hours (key: `devsuite_session_pwd`). Tools using DevDB (API Tester, SSH Manager) auto-prompt if the session has expired.
- **Vault & DB Manager**: Always-ask flows — they do not use the 8-hour session cache; they require the password on every visit.
- **Server never decrypts**: The `vault` and `ssh_profiles` stores contain client-side AES-256 ciphertext blobs. The backend only reads/writes these as opaque JSON; decryption happens in-browser.

## 5. DevDB Storage Engine
- **File**: `~/.devsuite/devdb.dsb` — KeePass-style binary container.
- **Format**: 64-byte fixed header (`magic=DSDB`, version, flags, KDF, iterations, salt, nonce) + payload block (BLAKE2b checksum + JSON in plain mode; AES-GCM ciphertext in encrypted mode).
- **Python API** (`devdb.py`): `open()`, `save()`, `get_store(name)`, `set_store(name, data)`, `delete_store(name)`, `list_stores()`, `store_sizes()`, `export_bytes()`, `from_bytes()`, `migrate_legacy()`.
- **REST API** (`main.py`): `GET/POST /api/db/store/{name}`, `GET /api/db/meta`, `GET /api/db/export`, `POST /api/db/import`.
- **JS Client**: `devdb-client.js` — `DevDB.getStore(name)`, `DevDB.setStore(name, data)`, `DevDB.getMeta()`.
- **Legacy Migration**: On startup, `DevDB.migrate_legacy()` auto-imports `vault.json`, `collections.json`, `ssh_profiles.json`, and `url_db.json` into DevDB stores (renaming originals to `*.json.bak`).

## 6. Workflows & Updates
- **Releases**: Require bumping the semantic version in three places concurrently: `main.py` (FastAPI `version="..."`), `README.md`, and `CHANGELOG.md`.
- **Cache Busting**: Updates to CSS or JS necessitate bumping the URL query parameter (e.g., `href="style.css?v=58"`) in HTML templates.
- **Tests**: Always execute backend tests (`pytest tests/python/`) before final validation. JavaScript tests live in `tests/javascript/`.

## 7. Feature Map & Token-Saving Guide

> **AI Instruction (CRITICAL for Context Limits):** AVOID reading all files when modifying a feature. Most components are modular. Use this map to request *only* the specific files needed for your task. Use `grep_search` to find functions instead of reading entire 1000+ line scripts. NEVER read files ending in `.min.js` (like `bwip-js-min.js` or `crypto-js.min.js`) — they destroy the token context window.

| Module / Feature | Main Frontend | JS Logic & Styling | Backend / Persistence |
| :--- | :--- | :--- | :--- |
| **Home/Dashboard** | `static/home.html` | `static/home.css` | `main.py` (`/`) |
| **Secret Vault** | `static/vault.html` | `static/vault.js`, `static/vault.css`, `crypto-js.min.js` | `main.py` (`/api/vault`, `/api/auth/*`), **DevDB** (`vault`) |
| **DevDB Manager** | `static/db-manager.html` | `static/db-manager.js`, `static/db-manager.css` | `main.py` (`/api/db/*`), `devdb.py` |
| **API Tester** | `static/api-tester.html` | `static/api-client.js`, `static/api-tester.js`, `static/api-tester.css` | `main.py` (`/api/proxy`, `/api/collections`), **DevDB** (`collections`) |
| **Diff Editor** | `static/index.html` | `static/app.js`, `static/linter.css` | `main.py` (`/upload`) |
| **JSON Linter** | `static/json.html` | `static/app.js`, `static/linter.css` | `main.py` (`/json`) |
| **YAML Linter** | `static/yaml.html` | `static/app.js`, `static/linter.css` | `main.py` (`/yaml`) |
| **Regex Tester** | `static/regex.html` | `static/app.js`, `static/linter.css` | `main.py` (`/regex`) |
| **Base64 / JWT** | `static/base64.html` | `static/linter.css` | `main.py` (`/base64`) |
| **Crypto Suite** | `static/crypto.html` | `static/linter.css`, `crypto-js.min.js` | `main.py` (`/crypto`) |
| **URL Shortener** | `static/url-shortener.html` | `bwip-js-min.js` | `main.py` (`/api/shorten`, `/r/{id}`), **DevDB** (`url_db`) |
| **Secure Terminal** | `static/ssh-manager.html` | `static/ssh-manager.js`, `static/ssh-manager.css`, `xterm.js`, `auth-guard.js` | `main.py` (`/api/ssh/*` WS, `/api/local/terminal` WS), **DevDB** (`ssh_profiles`) |
| **SFTP Browser** | `static/sftp-browser.html` | `static/sftp-browser.js`, `static/sftp-browser.css` | `main.py` (`/api/sftp/*`), **DevDB** (`ssh_profiles`) |
| **Cron Visualizer** | `static/cron.html` | `static/cron.js`, `static/cron.css` | `main.py` (`/cron`) |
| **File Converter** | `static/file-converter.html` | inline JS + CDN (js-yaml, papaparse, marked) | `main.py` (`/api/convert`) |
| **Global Theme** | N/A | `static/theme.js`, `static/style.css` | None |
| **Shared UI** | N/A | `static/components.js`, `static/auth-guard.js`, `static/devdb-client.js` | None |

### Developer & AI Best Practices
1. **Targeted Updates**: If changing the API proxy behavior, only check `main.py` and `api-client.js`. Skip UI code unless strictly necessary.
2. **Global Variables**: Most generic design elements (colors, borders, drop shadows) are managed centrally as CSS variables (`:root`) in `static/style.css`.
3. **Monaco Dependency**: Generic Monaco Editor functionality is tightly coupled with `static/app.js`. When working with Diff or Linter tools, focus analysis there.
4. **Auth Flow**: When modifying tools that persist to DevDB, always ensure `auth-guard.js` is loaded before the tool script. Vault and DB Manager use their own always-ask lock screens.
5. **DevDB Stores**: All stores are arbitrary JSON dicts. Vault and SSH profiles contain *already-encrypted* ciphertext — never attempt to parse them server-side.
