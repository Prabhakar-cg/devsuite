# DevSuite — Project Understanding & Development Standards

> **For AI Assistants and Developers**: This file is the single source of truth for understanding the DevSuite project. Read this before asking questions or starting any work. It is a living document — the developer may append new standards in the `## Developer Standards & Notes` section at the bottom.

---

## 1. What Is DevSuite?

**DevSuite** is a **private, locally-hosted developer toolkit** built and maintained by a solo developer. It was originally called `DiffChecker.io` and was rebranded to DevSuite in v4.0.0.

- **Philosophy**: Zero data leaves the user's machine. No accounts, no tracking, no external APIs (for core logic). All heavy lifting is done client-side in the browser via JavaScript.
- **Hosting**: Runs locally via FastAPI on `http://localhost:8000`
- **Current Version**: `5.0.0` (as of 2026-03-21)
- **Repository Path**: `/home/prabha/90scoder/devsuite/`
- **Git Branching**: `main` is the stable branch; `develop` is used for active feature work.

---

## 2. Tech Stack

### Backend
| Layer | Technology | Notes |
|---|---|---|
| Language | Python 3.x | Virtual env at `.venv/` |
| Framework | FastAPI (`>=0.100.0`) | Defined in `main.py` |
| Server | Uvicorn (`>=0.25.0`) | Started via `start.sh` or `uvicorn main:app --port 8000` |
| File Upload | `python-multipart (~=0.0.22)` | For `/upload` endpoint |
| URL DB | `url_db.json` | JSON file, persisted on disk |

### Frontend
| Layer | Technology | Notes |
|---|---|---|
| Language | Vanilla HTML + CSS + JavaScript | No frameworks or build tools |
| Code Editor | Monaco Editor (via RequireJS CDN) | Powers diff, JSON, regex, YAML tools |
| Language Detection | Highlight.js (CDN) | Auto-detects file language for Monaco |
| YAML Parsing | js-yaml (CDN) | Used in `yaml.html` |
| Crypto | crypto-js v4.2.0 (`/static/crypto-js.min.js`) | Self-hosted, no CDN |
| Barcode/QR | bwip-js v3.4.1 (`/static/bwip-js-min.js`) | Self-hosted, no CDN |
| Typography | Google Fonts: `Inter` (UI) + `JetBrains Mono` (code) | Loaded via CDN |

### Security
- HTTP Security Headers middleware in `main.py` (CSP, HSTS, X-Frame-Options, etc.)
- All JS DOM updates use `createElement`/`textContent` — NO unsafe `innerHTML` with untrusted data.
- Sensitive JS libraries are self-hosted in `/static/` to avoid supply-chain risk.

---

## 3. Project File Structure

```
devsuite/
├── main.py                  # FastAPI backend — all routes, middleware, URL shortener API
├── requirements.txt         # Python dependencies (fastapi, uvicorn, python-multipart)
├── start.sh                 # One-shot script: creates venv, installs deps, starts server
├── url_db.json              # Persistent key-value store for URL shortener
├── CHANGELOG.md             # Semantic version changelog (all changes documented here)
├── README.md                # Project overview and setup instructions
├── UNDERSTANDING.md         # ← THIS FILE — project reference for AI/devs
├── .gitignore               # Source-code only; url_db.json, venv, __pycache__ excluded
│
├── static/                  # All frontend assets (served at /static/)
│   ├── home.html            # Landing page / tool dashboard
│   ├── index.html           # Text Diff + Folder Diff tool (shared page, driven by app.js)
│   ├── json.html            # JSON Linter & Formatter
│   ├── yaml.html            # YAML Linter & Validator
│   ├── regex.html           # Regex Tester
│   ├── base64.html          # Base64 Encoder/Decoder + JWT decoder
│   ├── crypto.html          # Crypto Suite (Hash, AES, RSA, HMAC)
│   ├── url-shortener.html   # Link & QR Studio (URL shortener + QR/Barcode)
│   │
│   ├── style.css            # Main CSS design system (diff tool + global)
│   ├── linter.css           # Shared layout/styles for all linter/tool pages
│   ├── home.css             # Styles specific to the homepage dashboard
│   ├── theme.js             # Global theme manager (loaded in ALL pages)
│   └── app.js               # Main JS logic for Text Diff + Folder Diff tool
│
├── test_main.py             # Core backend unit tests (pytest)
├── test_new_features.py     # New feature tests
├── test_regression.py       # Regression test suite
├── test_local_server.py     # HTTP smoke tests (requires server running)
└── test_browser.js          # Browser-side JS test harness
```

---

## 4. Tool Inventory & Routes

Every tool is a standalone HTML page served by a FastAPI `GET` route.

| Tool | Route | HTML File | Description |
|---|---|---|---|
| **Homepage** | `/` | `home.html` | Central dashboard showing all tools |
| **Text Diff** | `/diff` | `index.html` | Side-by-side Monaco diff viewer with merge arrows |
| **Folder Diff** | `/diff?tab=folder-diff` | `index.html` | Tree comparison of two directories |
| **JSON Linter** | `/json` | `json.html` | Validate, format, minify, sort JSON |
| **YAML Linter** | `/yaml` | `yaml.html` | Validate, format YAML, convert YAML→JSON |
| **Regex Tester** | `/regex` | `regex.html` | Live Monaco regex match + group display |
| **Base64 Coder** | `/base64` | `base64.html` | Encode/decode text & files + JWT decoder |
| **Crypto Suite** | `/crypto` | `crypto.html` | Hash, AES, RSA, HMAC tabs |
| **Link & QR Studio** | `/url-shortener` | `url-shortener.html` | Local URL shortener + QR/Barcode generator |

### Backend API Endpoints
| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/shorten` | Create a short URL; returns `{short_id, short_url, original_url}` |
| `GET` | `/r/{short_id}` | Redirect to original URL (302) |
| `POST` | `/upload` | Upload a text file for diff; validates text-only, max 50MB |

---

## 5. Design System

### CSS Files
- **`style.css`** — Full design system for the diff tool. Contains CSS custom properties (variables), component classes, glassmorphism/neumorphism effects. Do NOT use Tailwind.
- **`linter.css`** — Shared two-pane layout for all tool pages (JSON, YAML, Regex, Base64, Crypto). Tool pages import this.
- **`home.css`** — Grid layout and card styles for the homepage only.

### CSS Custom Properties (CSS Variables)
All colors, spacing, and effects are defined as CSS variables. Key variables:
```css
--bg-void, --bg-main, --bg-surface, --bg-panel, --bg-raised, --bg-neu
--glass-bg, --glass-border, --glass-shine, --glass-blur
--text-primary, --text-secondary, --text-muted
--accent-1 (indigo #6366f1), --accent-2 (electric blue)
--border, --border-accent
--neu-raise, --neu-press, --neu-flat   /* neumorphic shadows */
--transition, --radius-xs, --radius-sm, etc.
--font-sans: 'Inter', --font-mono: 'JetBrains Mono'
```

### Themes
Themes are managed by `theme.js` (loaded in the `<head>` of every page before any content).

| Theme ID | Name Shown | Style |
|---|---|---|
| `vs-dark` | Midnight Dark | Default dark glassmorphic theme |
| `vs` | Clean Light | Light/white theme (`data-theme="vs"`) |
| `hc-black` | High Contrast | Black background (`data-theme="high-contrast"`) |
| `ios-glass` | Frosted Glass | Light blue glass effect (`data-theme="ios-glass"`) |

**Theme persistence**: Saved in `localStorage` under key `devsuite-theme`.

**Monaco Editor theme mapping**:
- `ios-glass` → Monaco `vs-dark`
- `hc-black` → Monaco `hc-black`
- `vs` → Monaco `vs`
- `vs-dark` → Monaco `vs-dark`

**Custom event**: When theme changes, `window.dispatchEvent(new CustomEvent('devsuite-theme-changed', { detail: { theme } }))` is fired so other tools can react.

**Global theme selector**: Any `<select class="global-theme-select">` or `<select id="theme-select">` is automatically wired up by `theme.js`.

### Visual Design Principles
- **Glassmorphism**: `backdrop-filter: blur()` + semi-transparent backgrounds on cards, headers, panels.
- **Neumorphism**: Soft shadow system using `--neu-raise`, `--neu-press`, `--neu-flat` for depth.
- **Accent colors per tool** (used on cards and tool headers):
  - Text Diff → Indigo (`#6366f1`)
  - Folder Diff → Violet (`#7c3aed`)
  - JSON Linter → Emerald (`#059669`)
  - YAML Linter → Amber (`#d97706`)
  - Regex Tester → Rose (`#be185d`)
  - Crypto Suite → Purple (`#7c3aed` → `#a855f7` gradient)
  - Link & QR Studio → Sky Blue (`#0284c7` → `#38bdf8` gradient)

---

## 6. Header Pattern (Per Tool Page)

Every tool page (non-homepage) follows a consistent header pattern:

```html
<header class="app-header">
  <!-- Left: Back link + Tool Identity -->
  <div style="display:flex; align-items:center; gap:0.75rem;">
    <a href="/" class="back-link">← DevSuite</a>
    <div class="tool-identity" id="tool-identity">
      <div class="tool-icon tool-icon-{COLOR}" id="tool-header-icon">
        <!-- SVG icon -->
      </div>
      <span class="tool-name" id="tool-header-name">
        Tool <span class="tool-accent">Name</span>
      </span>
      <span class="tool-version" id="tool-header-version">V5.0</span>
    </div>
  </div>
  <!-- Right: Controls (theme select, etc.) -->
  <div class="header-controls"> ... </div>
</header>
```

CSS classes: `.tool-identity`, `.tool-icon`, `.tool-icon-{indigo|violet|emerald|amber|rose}`, `.tool-name`, `.tool-accent`, `.tool-version` — all defined in `linter.css`.

---

## 7. app.js — Diff Tool Logic

`app.js` is the largest file (~61 KB) and drives the entire diff tool. Key responsibilities:

- **Monaco Editor initialization** via RequireJS (`require.config` + `require(['vs/editor/editor.main']...)`)
- **Text Diff**: Creates a Monaco `DiffEditor`; reads from `#original-input` and `#modified-input` textareas.
- **Language auto-detection**: Uses `highlight.js` to guess file language, then sets Monaco's language model.
- **Merge arrows**: `handleMergeClick()` — handles three Monaco diff change types:
  - Pure insertion (`mEnd === 0`) → insert after `mStart`
  - Pure deletion (`oEnd === 0`) → delete range including trailing newline
  - Modification → replace target range with source text
- **Folder Diff**: Reads directories via `<input webkitdirectory>`, builds a file tree, compares file-by-file.
- **Export**: Downloads `.patch` file or copies unified diff to clipboard.
- **Keyboard shortcuts**: `Ctrl/Cmd + Enter` = Compare; `Escape` = Back to edit mode.
- **Toast notifications**: `showToast(message, type)` — types: `success`, `error`, `warning`, `info`. Auto-dismisses.
- **Tab switching**: URL param `?tab=folder-diff` activates the Folder Diff pane on load.

---

## 8. Running the Project

```bash
# Option 1: use start.sh (auto-creates venv, installs deps, starts server)
cd /home/prabha/90scoder/devsuite
bash start.sh

# Option 2: manual (if venv already set up)
source .venv/bin/activate
uvicorn main:app --port 8000 --reload

# Access at:
http://localhost:8000
```

### Running Tests
```bash
source .venv/bin/activate
pytest test_main.py          # core backend tests
pytest test_regression.py   # regression tests
pytest test_new_features.py # new feature tests
python test_local_server.py # smoke tests (server must be running)
```

---

## 9. Versioning & Release Standards

- **Semantic Versioning** (`MAJOR.MINOR.PATCH`):
  - Major: New tool added or breaking redesign
  - Minor: Significant feature added to existing tool
  - Patch: Bug fix, security fix, or small improvement
- **Version tags**: `git tag v5.0.0` on `main` branch after each release.
- **CHANGELOG.md**: Updated with every release. Format: `## [X.Y.Z] - YYYY-MM-DD` with `### Added`, `### Changed`, `### Fixed`, `### Removed`, `### Security` sections.
- **CSS/JS cache busting**: Done via `?v=NN` query string on `<link>` and `<script>` tags in HTML (e.g. `style.css?v=57`). Increment `NN` when the file changes.
- **App version in `main.py`**: `app = FastAPI(version="X.Y.Z")` — keep in sync with latest CHANGELOG version.

---

## 10. Adding a New Tool — Checklist

When adding a new tool to DevSuite, follow these steps:

1. **Create `static/<toolname>.html`**
   - Include `linter.css` (for layout) and `theme.js` (in `<head>`, before body)
   - Follow the [Header Pattern](#6-header-pattern-per-tool-page) exactly
   - Use `class="tool-icon-{COLOR}"` matching the tool's accent color
   - All DOM writes: use `textContent` / `createElement`, never `innerHTML` with untrusted data

2. **Add a FastAPI route in `main.py`**
   ```python
   @app.get("/<toolname>", response_class=HTMLResponse, summary="Serve <ToolName> tool")
   def read_<toolname>_tool():
       """Serve the <ToolName> tool."""
       html_path = os.path.join(static_dir, "<toolname>.html")
       try:
           with open(html_path, "r", encoding="utf-8") as f:
               return f.read()
       except FileNotFoundError:
           raise HTTPException(status_code=404, detail="<toolname>.html not found.") from None
   ```

3. **Add a card to `home.html`** inside `#active-tools`:
   - Use `class="tool-card active-tool"`
   - Set `--card-glow` and `--card-border-hover` CSS variables matching the tool color
   - Follow the existing card structure: `card-header` → `card-icon-wrap` → `badge` → `card-title` → `card-desc` → `card-footer` with `tag-chip`s

4. **Self-host any third-party JS libraries** in `/static/` — do not add new CDN-only dependencies for core logic.

5. **Update `CHANGELOG.md`** with the new tool under the next version `### Added` section.

6. **Update `main.py` `version`** string if this is a major/minor release.

7. **Write tests** for any new backend endpoints in `test_new_features.py`.

---

## 11. Developer Standards & Notes

> **This section is the law.** Every AI assistant and contributor must follow all rules below before writing a single line of code.

---

### 🔒 Security — Absolute Rules

- **No data ever leaves the system.** All processing must happen client-side (in the browser via JS) or on the local FastAPI server. No external API calls, analytics, telemetry, or tracking of any kind — ever.
- **Self-host all third-party JS libraries.** Download them to `/static/`. Do NOT rely on external CDNs for any core logic. (Exception: Google Fonts and Monaco Editor loader via RequireJS CDN are acceptable UI-only dependencies.)
- **No `innerHTML` with untrusted data.** All DOM writes must use `createElement` + `textContent` / `createTextNode`. Never concatenate user input into HTML strings.
- **Validate all backend inputs.** Every FastAPI endpoint must validate inputs fully before processing — reject empty, malformed, or oversized payloads with appropriate HTTP error codes.
- **HTTP Security Headers are mandatory.** The CSP, HSTS, X-Frame-Options, X-Content-Type-Options, and X-XSS-Protection headers in `main.py` middleware must never be removed or weakened.
- **No `alert()`, `confirm()`, or `console.log()` in production code.** Use the `showToast()` system for all user-facing feedback.

---

### 🧑‍💻 Coding Standards

- **Highest code quality always.** Write clean, readable, self-documenting code. Every function must have a clear, single responsibility.
- **Python**: Follow PEP 8. All FastAPI route functions must have a docstring. Use type hints on all function signatures.
- **JavaScript**: Use `const` and `let` (never `var`). Use modern ES6+ syntax. Avoid global variable pollution — scope logic inside functions or IIFE patterns.
- **CSS**: Vanilla CSS only — no Tailwind, no CSS-in-JS. All colors, spacing, and effects must use CSS custom properties (variables). No hardcoded hex values in component CSS — reference variables from the design system.
- **No inline styles in HTML** — except the intentional `--card-glow` / `--card-border-hover` CSS variable overrides on tool cards in `home.html`. Use semantic CSS classes instead.
- **Consistent header**: Every tool page must follow the standard `app-header` pattern exactly (back link + tool identity + theme selector). See [Section 6](#6-header-pattern-per-tool-page).
- **Cache busting**: When modifying `style.css` or `app.js`, increment the `?v=NN` version query string in all referencing HTML files (e.g. `index.html`).

---

### 📦 Dependency & Package Hygiene

- **Check for package updates before every development session.** Run the following before starting work:
  ```bash
  source .venv/bin/activate
  pip list --outdated
  pip install --upgrade fastapi uvicorn python-multipart
  pip freeze > /tmp/new_reqs.txt   # compare against requirements.txt
  ```
- **Use the latest stable versions** of all dependencies. Update `requirements.txt` whenever a package is upgraded.
- **Use version specifiers** — prefer `>=X.Y.Z` for flexibility (not pinned `==`) unless a specific version is required for compatibility.
- **Test after every upgrade.** Run the full test suite (`pytest test_main.py test_regression.py`) after updating any package before committing.
- **Self-hosted JS libraries** must also be kept up to date. Check the releases of `crypto-js` and `bwip-js` with each major development session.

---

### 📄 README Maintenance

- **`README.md` must always reflect the current state of DevSuite.** After any release:
  - Update the version number prominently at the top.
  - Update the list of available tools (name, route, one-line description).
  - Update setup/run instructions if anything changed.
  - Update any screenshots or feature highlights if major UI changes were made.
- The README is the first thing a new user reads — it must be accurate, concise, and professional.

---

### 📋 CHANGELOG Maintenance

- **Every change goes in `CHANGELOG.md`.** No exceptions.
- Follow the format strictly:
  ```markdown
  ## [X.Y.Z] - YYYY-MM-DD
  ### Added
  ### Changed
  ### Fixed
  ### Removed
  ### Security
  ```
- **Only include sections that have entries** — omit empty sections.
- The CHANGELOG must accurately reflect everything currently in DevSuite. If a feature exists in the app but is not in the CHANGELOG, add it retroactively to the correct version entry.
- **Bump the version in both `CHANGELOG.md` and `main.py`** (`FastAPI(version="X.Y.Z")`) together, in the same commit.
