# DevSuite Component & Architecture Reference

> **For AI Assistants:** This is the token-dense master reference for `DevSuite` (v2.2.0+). Rely on this file over prior context. Never hallucinate outside libraries. Read this fully before starting work.

## 1. System Tenets & Boundaries
- **Strict Privacy**: 100% locally-hosted. No cloud telemetry, no analytics, no external services for core functionality.
- **Tech Stack**:
  - *Backend*: Python 3.10+, FastAPI, Uvicorn (on `localhost:8000`). **Unified Encrypted Storage**: Uses `DevDB` (`.dsb`) binary format (AES-256-GCM) at `~/.devsuite/devdb.dsb`. No external DB.
  - *Frontend*: Vanilla HTML/CSS/JS. **NO frameworks** (React/Vue/Svelte) and **NO build tools** (Webpack/Vite).
  - *Styles*: Vanilla CSS with CSS Custom Properties (variables). **NO Tailwind**, NO CSS-in-JS.
- **Security**: 
  - `innerHTML` is **strictly forbidden** when handling untrusted data. Use `document.createElement()` and `elem.textContent`.
  - Content Security Policy (CSP) and HTTP Security Headers are rigidly enforced in `main.py` middleware.
- **Dependency Sourcing**: Third-party JS libraries (e.g., `crypto-js.min.js`, `bwip-js-min.js`) must be self-hosted in `/static/`. (Exceptions: Google Fonts and Monaco Editor via RequireJS).

## 2. Directory Layout
- **Root (`/home/prabha/90scoder/devsuite/`)**:
  - `main.py`: The single backend application file containing all endpoints, proxy routes, and static file mounting logic.
  - `devdb.py`: **Unified Storage Engine**. Manages `.dsb` files, AES-256-GCM encryption, and atomic writes.
  - `start.sh`: Scaffolds the `.venv`, installs `requirements.txt`, and boots Uvicorn.
  - `~/.devsuite/devdb.dsb`: The primary unified database file.
  - Test files: `test_devdb.py`, `test_main.py`, `test_new_features.py`.
- **Frontend (`/static/`)**: 
  - *Core*: One HTML file per tool (`index.html` [Diff], `json.html`, `api-tester.html`, etc.).
  - *Shared CSS*: `style.css` (design tokens, glassmorphism logic), `linter.css` (two-pane layout).
  - *Shared JS*: `theme.js` (manages Light/Dark/High Contrast modes), `app.js` (Diff Logic).

## 3. UI/UX Paradigm
- **Aesthetic**: Glassmorphism (`backdrop-filter: blur`) combined with Neumorphism (soft drop-shadows via `--neu-raise`, `--neu-press`).
- **Tool Header Pattern**: Every tool page has an `<header class="app-header">` with a left-aligned `<a href="/" class="back-link">`, a tool icon mapped to a specific accent color class (e.g., `.tool-icon-indigo`), and a right-aligned theme selector.
- **Global Themes**: Driven by `theme.js`. Valid themes are `vs-dark`, `vs` (Light), `hc-black` (High Contrast), and `ios-glass`. Custom event `devsuite-theme-changed` fires on toggle.
- **Notifications**: Triggered universally via `showToast(msg, type)` mechanism.

## 4. Workflows & Updates
- **Releases**: Require bumping the semantic version in three places concurrently: `main.py` (FastAPI `version="..."`), `README.md`, and `CHANGELOG.md`.
- **Busting Cache**: Updates to CSS or JS necessitate bumping the URL query parameter (e.g., `href="style.css?v=58"`) in HTML templates.
- **Tests**: Always execute backend tests (`pytest test_main.py test_new_features.py`) before final validation.

## 5. Feature Map & Token-Saving Guide

> **AI Instruction (CRITICAL for Context Limits):** AVOID reading all files when modifying a feature. Most components are modular. Use this map to request *only* the specific files needed for your task. Start with `grep_search` to find functions instead of reading entire 1000+ line scripts. NEVER read files ending in `.min.js` (like `bwip-js-min.js` or `crypto-js.min.js`) as they destroy the token context window.

| Module / Feature | Main Frontend | JS Logic & Styling | Backend / Persistence |
| :--- | :--- | :--- | :--- |
| **Home/Dashboard** | `static/home.html` | `static/home.css` | `main.py` (`/`) |
| **DevDB Manager** | `static/db-manager.html` | `static/db-manager.js`, `static/db-manager.css` | `main.py` (`/api/db/*`), `devdb.py` |
| **Secret Vault** | `static/vault.html` | `static/vault.js`, `crypto-js.min.js` | `main.py` (`/api/vault`), **DevDB** (`vault`) |
| **API Tester** | `static/api-tester.html` | `static/api-client.js`, `static/api-tester.js` | `main.py` (`/api/proxy`), **DevDB** (`collections`) |
| **Diff Editor** | `static/index.html` | `static/app.js`, `static/linter.css` | `main.py` (`/upload`) |
| **JSON Linter** | `static/json.html` | `static/app.js`, `static/linter.css` | `main.py` (`/json`) |
| **YAML Linter** | `static/yaml.html` | `static/app.js`, `static/linter.css` | `main.py` (`/yaml`) |
| **URL Shortener** | `static/url-shortener.html` | *`bwip-js-min.js`* | `main.py` (`/api/shorten`), **DevDB** (`url_db`) |
| **Secure Terminal** | `static/ssh-manager.html`, `static/sftp-browser.html` | `static/ssh-manager.js`, `static/sftp-browser.js`, *`xterm.js`* | `main.py` (`/api/ssh/*`), **DevDB** (`ssh_profiles`) |
| **Cron Visualizer** | `static/cron.html` | `static/cron.js`, `static/cron.css` | `main.py` (`/cron`) |
| **Global Theme** | N/A | `static/theme.js`, `static/style.css` | None |

### Developer & AI Best Practices
1. **Targeted Updates**: If changing the API proxy behavior, only check `main.py` and `api-client.js`. Skip UI code unless strictly necessary.
2. **Global Variables**: Most generic design elements (like colors, borders, drop shadows) are managed centrally as CSS variables (`:root`) in `static/style.css`.
3. **Monaco Dependency**: The generic Monaco Editor functionality is tightly coupled with `static/app.js`. When working with the Diff or Linter tools, focus your analysis there.