# Changelog

All notable changes to this project will be documented in this file.

## [5.0.0] - 2026-03-21
### Added
- **Crypto Suite** (`/crypto`) — Four-tab cryptographic toolkit:
  - Hash Generator (MD5, SHA-1, SHA-256, SHA-512) with copy buttons per hash.
  - AES Encrypt/Decrypt with CBC, ECB, and CTR mode selection.
  - RSA Key Pair generation (2048/4096-bit) with in-browser encrypt/decrypt.
  - HMAC Sign & Verify (SHA-256, SHA-512) with a visual OK/INVALID banner.
  - Base64 / JWT decode tab (splits header, payload, signature).
- **Link & QR Studio** (`/url-shortener`) — Renamed and extended URL Shortener:
  - Local URL shortener that generates short `/r/<id>` links served by the local DevSuite instance.
  - QR Code and Code128 Barcode generated for every shortened link using the short URL.
  - PNG download button for both the QR Code and the Barcode.
  - Recent links panel backed by `localStorage`.
- **`url_db.json`** — Persistent URL shortener database; survives server restarts.
- **`test_local_server.py`** — Basic HTTP smoke test with proper error handling, replacing the old `test_puppeteer.py`.

### Changed
- **Link & QR Studio** barcode payload changed from truncated `original_url` to `short_url` for reliable Code128 encoding.
- **`requirements.txt`** — Updated `fastapi` and `uvicorn` to valid, available PyPI versions (`>=0.100.0`, `>=0.25.0`).
- **`style.css`** — Removed ~80 lines of duplicated `.tool-identity`/`.tool-icon`/`.tool-name`/`.tool-version` rules (already provided by `linter.css`). Added semantic CSS classes for folder diff layout elements extracted from `index.html`.
- **`index.html`** — Folder diff elements now use semantic CSS classes instead of inline `style=` attributes.
- **`theme.js`** — `applyThemeDOM` now also writes to `document.body.style.background` and `document.body.style.color` so external CSS selectors and scripts can read the current theme.
- Home dashboard card renamed from "URL Shortener" to "Link & QR Studio".

### Security
- **DOM XSS hardening** — Replaced all `innerHTML` assignments that used untrusted data (folder names, file names, regex match values, toast messages, error text) with safe DOM construction via `createElement` + `textContent` / `createTextNode` across `app.js`, `crypto.html`, `regex.html`, and `url-shortener.html`.
- **Self-hosted libraries** — `crypto-js.min.js` (v4.2.0) and `bwip-js-min.js` (v3.4.1) are now served from `/static/` instead of external CDNs, eliminating supply-chain risk.
- **HTTP Security Headers** — Added `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, and `Referrer-Policy` middleware in `main.py`.
- **URL validation** — `POST /api/shorten` now rejects empty or whitespace-only input and validates scheme + host via `urllib.parse` before storing.
- **Collision-safe `short_id`** — Generator now retries up to 10 times to guarantee a unique ID, preventing silent overwrites.
- **`crypto.html` HTML structure** — Corrected misplaced `</head>` / `<body>` element order; `toast-container` now lives strictly inside a properly opened `<body>`.
- **`app.js` null safety** — Added guard for `folderToggleInlineBtn` before attaching event listener. Removed dead empty `if` block.
- **Duplicate event listener removed** — Eliminated duplicate `themeSelect` change listener in `app.js` (handled by `theme.js`).
- **`.gitignore`** — Added entries for `url_db.json`, test cache, build artifacts, and coverage reports.

### Removed
- `test_puppeteer.py` — Replaced by `test_local_server.py` (correct name, proper error handling, no unused imports).
- External CDN dependencies for `crypto-js` and `bwip-js` (now self-hosted).

## [4.0.0] - 2026-03-11

### Added
- **DevSuite Homepage** — New central portal (`home.html`) featuring a glassmorphic dashboard of all available developer tools.
- **JSON Linter & Formatter** (`/json`) — Monaco-powered JSON validation, formatting, minification, and key sorting.
- **YAML Linter & Validator** (`/yaml`) — YAML parsing and formatting powered by `js-yaml`, with one-click conversion to JSON.
- **Regex Tester** (`/regex`) — Real-time regex match highlighting inside Monaco, group capture display, and interactive flag toggles.
- **Base64 Coder** (`/base64`) — Encode/decode strings and files, URL-safe mode, and a visual JWT decoding panel.
- **Shared Linter Layout** (`linter.css`) — A unified split-pane layout and styling system for all non-diff tools.

### Changed
- App routing updated in `main.py`: Root `/` now serves the DevSuite homepage. The Diff Checker moved to `/diff`.
- Diff Checker UI updated to include a "← DevSuite" navigation back-link.
- `app.js` updated to parse URL parameters, enabling deep-linking to the Folder Diff tab (`/diff?tab=folder`).


## [3.0.0] - 2026-03-10
### Added
- **Premium UI redesign** — glassmorphic header with gradient top rim, electric indigo/blue accent system, and JetBrains Mono for code panels.
- **Live Diff Stats Bar** — color-coded chips showing additions (+), removals (−), and hunk count after every comparison.
- **Multi-type Toast Notifications** — slide-in toasts for success ✅, error ❌, warning ⚠️, and info ℹ️ with auto-dismiss.
- **Keyboard shortcuts** — `Ctrl/Cmd + Enter` to compare; `Escape` to return to edit mode.
- **Paste from Clipboard** — 📋 Paste button per panel using `navigator.clipboard.readText()`.
- **Copy Panel Content** — icon button copies the textarea content to the clipboard.
- **Line Count Badges** — live line count in each panel header, updated on every keystroke.
- **Export Patch** — download the diff as a `.patch` file or copy unified diff text to clipboard.
- **Folder Diff filter chips** — filter the changed-file sidebar by All / Modified / Added / Removed.
- **Segmented Merge Buttons** — "→ Copy to File 2" and "Copy to File 1 ←" grouped as a styled button pair.
- `static/test_merge.html` — unit-test harness for merge logic and live Monaco merge verification.

### Changed
- Input panels relabeled from **Original / Modified** to **File 1 / File 2** for clarity.
- `style.css` — full design-system rewrite; removed Tailwind CDN dependency, replaced with semantic CSS variables and component classes.
- `index.html` — full HTML restructure using new CSS component classes.
- `app.js` — bumped to v3.0; all new features integrated on top of existing Monaco/diff architecture.

### Fixed
- **Merge hunk overlap bug** — `handleMergeClick` now correctly handles all three Monaco diff change types:
  - *Pure insertion* (`mEnd=0`): insert AFTER `mStart` (end-of-line position) with `'\n' + srcText`, not before it.
  - *Pure deletion* (`oEnd=0`): range extended to include trailing newline, preventing ghost blank lines.
  - *Modification*: unchanged — replace the target range with the source text.

## [Unreleased] → now [3.0.0]
### Added (original release)
- Initial release of Diff checker from Hell.
- Web-based UI with dark mode and glassmorphism styling.
- Monaco Editor integration for high-quality syntax highlighting and diff comparisons.
- Support for multiple languages, including Auto-Detect using `highlight.js`.
- Specialized support for DevOps formats (Ansible, Jenkinsfile, Terraform).
- Easy-to-use FastAPI backend for serving the application.
- `start.sh` script to automate installation and running the server locally.
