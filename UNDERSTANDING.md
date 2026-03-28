# DevSuite Component & Architecture Reference

> **For AI Assistants:** This is the token-dense master reference for `DevSuite` (v5.1+). Rely on this file over prior context. Never hallucinate outside libraries. Read this fully before starting work.

## 1. System Tenets & Boundaries
- **Strict Privacy**: 100% locally-hosted. No cloud telemetry, no analytics, no external services for core functionality.
- **Tech Stack**:
  - *Backend*: Python 3.10+, FastAPI, Uvicorn (on `localhost:8000`). No ORM/DB (uses local JSON files only, e.g. `url_db.json`).
  - *Frontend*: Vanilla HTML/CSS/JS. **NO frameworks** (React/Vue/Svelte) and **NO build tools** (Webpack/Vite).
  - *Styles*: Vanilla CSS with CSS Custom Properties (variables). **NO Tailwind**, NO CSS-in-JS.
- **Security**: 
  - `innerHTML` is **strictly forbidden** when handling untrusted data. Use `document.createElement()` and `elem.textContent`.
  - Content Security Policy (CSP) and HTTP Security Headers are rigidly enforced in `main.py` middleware.
- **Dependency Sourcing**: Third-party JS libraries (e.g., `crypto-js.min.js`, `bwip-js-min.js`) must be self-hosted in `/static/`. (Exceptions: Google Fonts and Monaco Editor via RequireJS).

## 2. Directory Layout
- **Root (`/home/prabha/90scoder/devsuite/`)**:
  - `main.py`: The single backend application file containing all endpoints, proxy routes, and static file mounting logic.
  - `start.sh`: Scaffolds the `.venv`, installs `requirements.txt`, and boots Uvicorn.
  - `url_db.json` & `~/.devsuite/collections.json`: Local persistence files.
  - Test files: `test_main.py`, `test_new_features.py`, `test_regression.py`, `test_local_server.py`.
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

## 5. Salient Modules
- **API Tester (`api-tester.html` / `api-client.js`)**: A local-first REST client capable of bypassing CORS. The UI dispatches requests to `POST /api/proxy` in `main.py`, which securely relays them to external targets using `httpx` and streams the unmodified response back to the client. Request history syncs locally via `/api/collections`. 
- **Diff Editor (`app.js`)**: Powers both Text & Folder diffs. Manages Monaco instances and implements direct right/left hunk merging.
