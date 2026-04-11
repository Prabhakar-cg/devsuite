# DevSuite — Developer Tools from Hell
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Prabhakar-cg/devsuite?utm_source=oss&utm_medium=github&utm_campaign=Prabhakar-cg%2Fdevsuite&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

A beautiful, locally-hosted developer tools suite powered by **FastAPI** and the **Monaco Editor**. 100% private — all file reading and data processing is done locally. No data ever leaves your machine.

---

## Supported Tools

### 1. Diff Checker
- **Side-by-side & Inline** comparison modes via Monaco Editor.
- **Merge arrows** to copy individual hunks left→right or right→left.
- **Folder Diff** — compare entire directory trees with filter chips (All / Modified / Added / Removed).
- Export as `.patch` or copy unified diff to clipboard.

### 2. JSON Linter & Formatter
- Validate JSON with real-time exact line/column error pointers.
- Pretty-print, minify, and sort keys alphabetically.

### 3. YAML Linter & Validator
- Parse and validate YAML configs (Kubernetes, Docker Compose, Actions).
- Format clean YAML or convert directly to JSON.

### 4. Regex Tester
- Real-time match highlighting inside the Monaco Editor.
- Group captures and named group display.
- `g`, `i`, `m`, `s` flag toggles.

### 5. Base64 Encoder / Decoder
- Encode/Decode strings with full UTF-8 support.
- URL-safe mode and JWT decoding panel (splits header, payload, signature).

### 6. Crypto Suite
- **Hash Generator** — MD5, SHA-1, SHA-256, SHA-512 in one shot.
- **AES Encrypt / Decrypt** — CBC, ECB, and CTR modes via CryptoJS (self-hosted).
- **RSA Key Pair** — generate 2048/4096-bit keypairs, encrypt, and decrypt in-browser.
- **HMAC Sign & Verify** — SHA-256 and SHA-512.
- Navigate all panels via tab buttons; all operations are fully offline.

### 7. Link & QR Studio
- **Local URL Shortener** — generates short `/r/<id>` links served from the local DevSuite instance. Short links persist across server restarts via DevDB.
- **QR Code & Code128 Barcode** — generated on every shortened link using the original URL.
- PNG download for both codes.
- Recent links panel backed by `localStorage`.

### 8. Local API Tester
- **Local-first REST client** — a high-speed REST client for testing endpoints.
- **Request Engine** — supports GET, POST, PUT, DELETE, PATCH, custom headers, and body.
- **Local CORS Proxy** — built-in FastAPI proxy to bypass browser CORS restrictions.
- **Persistent Collections** — saved in DevDB (`collections` store).

### 9. Secure Terminal & SFTP
- **Multi-tab SSH client** — open parallel sessions to different hosts, each in its own xterm.js tab.
- **Password & Private Key auth** — PEM key import supported.
- **Encrypted profiles** — session credentials stored in DevDB (`ssh_profiles` store), encrypted client-side with a Master Password.
- **SFTP Browser** (sub-tab) — browse, navigate, and inspect remote filesystems. Grid view with file type icons, sizes, up navigation, refresh, and disconnect.
- **WSL / Local Terminal** — auto-discovers WSL distributions; spawns local PTY shells directly.
- **Inline delete** — remove sessions from the sidebar with a single click (no modal needed).
- **Network Notice**: Session profiles are stored locally, but SSH/SFTP connections establish outbound network traffic to remote hosts. The privacy guarantee applies to offline tools only.

### 10. Cron Visualizer
- **4 dialect support** — Unix/Linux, Quartz/Spring, AWS EventBridge, GitHub Actions.
- **Live expression parser** with per-field validation chips and plain-English human-readable description.
- **Visual Field Builder** — click-to-toggle grids for Minute, Hour, Month, Day-of-Week; synced with the text input.
- **Next 10 Run Times** — computed locally, no external libraries.
- **28-Day Activity Heatmap** — CSS grid calendar with teal intensity shading based on fire frequency.
- **Preset Library** — curated common expressions per dialect (Unix, Quartz, AWS, GitHub), click-to-load.
- **Export** — copy raw expression, YAML (K8s / GitHub Actions), or AWS EventBridge JSON.

### 11. Secret Vault
- **KeePass-style encrypted secret manager** — store tokens, passwords, SSH keys, and API credentials.
- **AES-256 client-side encryption** — all secrets are encrypted in-browser before being sent to the backend. The server never sees plaintext.
- **Master Password gate** — lock screen on every visit; password is never stored anywhere.
- **CRUD interface** — add, view, copy, edit, and delete entries with a single click.
- **Categories** — organize secrets by type (Token, Password, SSH Key, API Key, Note, Other).
- **Persistence** via DevDB (`vault` store) — survives server restarts.

### 12. DevDB Manager
- **Unified encrypted database inspector** — view all DevDB stores, sizes, and metadata.
- **Export / Import** — download or upload the full `.dsb` database file.
- **Auth-gated** — requires the same Master Password used by the Secret Vault.
- **Store viewer** — browse raw JSON content of any named store.

### 13. File Format Converter
- **Multi-format conversion engine** — convert between JSON, CSV, YAML, XML, TSV, XLSX, Markdown, HTML, DOCX, and PDF.
- **Client-side conversions** — JSON ↔ YAML, JSON ↔ CSV, Markdown → HTML done entirely in-browser.
- **Server-side conversions** — XLSX ↔ CSV/JSON, PDF → TXT, DOCX → TXT, and document → PDF via WeasyPrint.
- **Drag-and-drop upload** — supports drag-and-drop or file picker.

---

## Premium UI
- Glassmorphic UI with dynamic gradients and ambient glow effects.
- Neumorphic buttons and customized scrollbars.
- **4 themes**: Midnight Dark, Clean Light, High Contrast, Frosted Glass.
- All tools share a consistent header, theme switcher, and toast notification system.

---

## Privacy & Security
- **Strictly offline** — no network requests for tool functionality. All processing runs in-browser or via the local FastAPI backend.
- **Unified encrypted storage** — all persistent data lives in `~/.devsuite/devdb.dsb`, a KeePass-style binary container (AES-256-GCM, PBKDF2 key derivation, 200k iterations).
- **Client-side encryption** — the vault and SSH profiles are encrypted in-browser before reaching the backend. The server never handles plaintext secrets.
- **DOM XSS hardened** — all dynamic content is inserted using `textContent` / `createElement` APIs; no untrusted strings ever reach `innerHTML`.
- **Self-hosted libraries** — `crypto-js` and `bwip-js` are served from `/static/` rather than an external CDN.
- **HTTP Security headers** — `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, and `Referrer-Policy` on every response.
- **URL validation** — the shortener backend validates scheme and host before storing any link.
- **8-hour session tokens** — tools using DevDB (API Tester, SSH Manager) cache the master password in `sessionStorage` for 8 hours via `auth-guard.js`.

---

## Getting Started

### Prerequisites
- Python 3.10+

> [!NOTE]
> Custom CSS and JS files run directly in the browser without compilation or additional software.
> If you modify `api-client.ts` (the TypeScript source), you will need Node.js and TypeScript (`npm install -g typescript`) to recompile it to `api-client.js`.

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

```
devsuite/
├── main.py                  # FastAPI app — all routes, WebSocket SSH, SFTP, proxy, DevDB API
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
    ├── components.js        # Shared UI utilities — toast notifications, Monaco init helper
    ├── auth-guard.js        # 8-hour session auth guard for DevDB-backed tools
    ├── devdb-client.js      # Thin fetch wrapper around /api/db/* endpoints
    │
    ├── index.html           # Text & Folder Diff tool
    ├── app.js               # Diff tool JavaScript (Monaco, merge, folder tree)
    │
    ├── json.html            # JSON Linter & Formatter
    ├── yaml.html            # YAML Linter & Validator
    ├── regex.html           # Regex Tester
    ├── base64.html          # Base64 Encoder / Decoder + JWT Inspector
    │
    ├── crypto.html          # Crypto Suite (Hash, AES, RSA, HMAC)
    ├── crypto-js.min.js     # Self-hosted CryptoJS v4.2.0
    │
    ├── url-shortener.html   # Link & QR Studio
    ├── bwip-js-min.js       # Self-hosted bwip-js v3.4.1 (barcode rendering)
    │
    ├── api-tester.html      # Local API Tester
    ├── api-tester.js        # API Tester UI logic (collection tree, request tabs, history)
    ├── api-tester.css       # API Tester layout styles
    ├── api-client.ts        # TypeScript source for the fetch wrapper
    ├── api-client.js        # Compiled JS fetch wrapper used by API Tester
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
    └── file-converter.html  # File Format Converter (JSON, CSV, YAML, XLSX, PDF, DOCX, etc.)
```

---

## License
MIT
