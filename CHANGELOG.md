# Changelog

All notable changes to this project will be documented in this file.

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
