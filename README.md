# DevSuite — Developer Tools from Hell
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Prabhakar-cg/devsuite?utm_source=oss&utm_medium=github&utm_campaign=Prabhakar-cg%2Fdevsuite&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

A beautiful, locally-hosted developer tools suite powered by **FastAPI** and the **Monaco Editor**. 100% private — all file reading and data processing is done locally. No data ever leaves your machine.

---

## 🛠️ Supported Tools

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
- **Local URL Shortener** — generates short `/r/<id>` links served from the local DevSuite instance. Short links persist across server restarts via `url_db.json`.
- **QR Code & Code128 Barcode** — generated on every shortened link using the local short URL.
- PNG download for both codes.
- Recent links panel backed by `localStorage`.

### 8. API Tester
- **Local-first REST client** — A high-speed REST client for testing endpoints.
- **Request Engine** — Supports GET, POST, PUT, DELETE, PATCH, Custom Headers, and Body.
- **Local CORS Proxy** — Built-in FastAPI proxy to bypass browser CORS restrictions.
- **Persistent Collections** — Saved in `~/.devsuite/collections.json`.

---

## 🎨 Premium UI
- Glassmorphic UI with dynamic gradients and ambient glow effects.
- Neumorphic buttons and customized scrollbars.
- **4 themes**: Midnight Dark, Clean Light, High Contrast, Frosted Glass.
- All tools share a consistent header, theme switcher, and toast notification system.

---

## 🔒 Privacy & Security
- **Strictly offline** — no network requests for tool functionality. All processing runs in-browser or via the local FastAPI backend.
- **DOM XSS hardened** — all dynamic content is inserted using `textContent` / `createElement` APIs; no untrusted strings ever reach `innerHTML`.
- **Self-hosted libraries** — `crypto-js` and `bwip-js` are served from `/static/` rather than an external CDN.
- **HTTP Security headers** — `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, and `Referrer-Policy` on every response.
- **URL validation** — the shortener backend validates scheme and host before storing any link.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js & npm (Required to compile `.ts` files to `.js`)
- TypeScript (`npm install -g typescript`)

> [!NOTE] 
> Custom CSS and JS files run directly in the browser without any prior compilation or additional software required!
> However, modifying `.ts` files (like `api-client.ts`) requires compiling to `.js` via the TypeScript Compiler (`tsc`).

### Quick Start

```bash
chmod +x start.sh
./start.sh
```

*(On a fresh Debian/Ubuntu system, `start.sh` will auto-detect and attempt to install `python3`, `python3-venv`, `nodejs`, `npm`, and `typescript` as necessary.)*

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

## 📁 Project Structure

```
devsuite/
├── main.py                  # FastAPI app — routes, URL shortener API, file upload
├── requirements.txt         # fastapi, uvicorn, python-multipart
├── url_db.json              # Persisted URL shortener database (auto-generated)
├── start.sh                 # One-shot virtual environment setup & run script
├── test_local_server.py     # Basic smoke test for the local server
└── static/
    ├── home.html            # DevSuite dashboard / homepage
    ├── style.css            # Global design system and component CSS
    ├── theme.js             # Theme manager (Dark, Light, HC, Frosted Glass)
    ├── index.html           # Text & Folder Diff tool (layout)
    ├── app.js               # Diff tool JavaScript (Monaco, merge, folder tree)
    ├── json.html            # JSON Linter & Formatter
    ├── yaml.html            # YAML Linter & Validator
    ├── regex.html           # Regex Tester
    ├── base64.html          # Base64 Encoder / Decoder
    ├── crypto.html          # Crypto Suite (Hash, AES, RSA, HMAC)
    ├── url-shortener.html   # Link & QR Studio
    ├── api-tester.html      # Local API Tester module
    ├── api-client.js        # Core Fetch-wrapper and typescript-like client for the API Tester
    ├── linter.css           # Shared layout for linter/tester/crypto tools
    ├── crypto-js.min.js     # Self-hosted CryptoJS v4.2.0
    └── bwip-js-min.js       # Self-hosted bwip-js v3.4.1 (barcode rendering)
```

---

## 📄 License
MIT
