# DevSuite — Senior Design Architect Review & Improvement Recommendations

**Reviewed:** v0.1.3  
**Date:** 2026-04-22  
**Scope:** Features, Usability, Developer Friendliness, Security, UI/UX

---

## Executive Summary

DevSuite is a well-architected, security-conscious developer toolkit. The AES-256-GCM encrypted vault, offline-first philosophy, and Terminal Noir aesthetic are genuine differentiators. This document is not a criticism — it is a prioritized roadmap for taking a 9/10 product to a 10/10 release.

Improvements are grouped into five categories and ranked **P1 (blocking)**, **P2 (high-value)**, or **P3 (polish)**.

---

## 1. Security

### [P1] Hash Session Tokens Server-Side

**Current state:** `_sessions[token] = expiry` stores the raw 32-byte token as the dictionary key. If an attacker dumps process memory or a heap profiler captures a snapshot, every active session is exposed.

**Fix:** Store the BLAKE2b hash of the token; compare hashes on each request.

```python
import hashlib

def _store_session(token: str, expiry: float):
    token_hash = hashlib.blake2b(token.encode(), digest_size=32).hexdigest()
    _sessions[token_hash] = expiry

def _verify_session(token: str) -> bool:
    token_hash = hashlib.blake2b(token.encode(), digest_size=32).hexdigest()
    expiry = _sessions.get(token_hash)
    return expiry is not None and time.time() < expiry
```

---

### [P1] Rate-Limit Auth Endpoints

**Current state:** `/api/auth/challenge` and `/api/auth/session` have no request rate limiting. An automated script can hammer these endpoints and correlate timing to infer password length.

**Fix:** Add `slowapi` (1-line integration with FastAPI) limiting to 5 attempts / 60 seconds per IP.

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/auth/session")
@limiter.limit("5/minute")
async def auth_session(request: Request, ...):
    ...
```

Add `slowapi` to `requirements.txt`.

---

### [P2] Replace `unsafe-inline` with CSP Nonces

**Current state:** The Content-Security-Policy includes `'unsafe-inline'` for `script-src` and `style-src`. This is required for Monaco Editor inline styles, but it opens the door to reflected XSS if any output is ever unsafely concatenated into HTML.

**Fix:** FastAPI generates a fresh nonce per response; inject it into all `<script>` and `<style>` tags at serve time.

```python
import secrets

def _serve_html_with_nonce(filename: str):
    nonce = secrets.token_hex(16)
    content = open(f"static/{filename}").read()
    content = content.replace("<script", f'<script nonce="{nonce}"')
    content = content.replace("<style", f'<style nonce="{nonce}"')
    headers = {
        "Content-Security-Policy": f"script-src 'self' 'nonce-{nonce}' blob:; ..."
    }
    return HTMLResponse(content=content, headers=headers)
```

Long-term: move inline scripts to external `.js` files (already done for most tools — a few remain inline in tool HTML files).

---

### [P2] Use `HttpOnly` + `SameSite=Strict` Cookie for Session Token

**Current state:** The session token lives in `sessionStorage`. JavaScript can read it. A DOM-based XSS on any tool page can steal it.

**Fix:** Set the token as an `HttpOnly; SameSite=Strict` cookie from the server. The browser sends it automatically on every same-origin request; JavaScript cannot read it.

```python
response.set_cookie(
    key="ds_session",
    value=token,
    httponly=True,
    samesite="strict",
    max_age=8 * 3600,
    secure=False,  # flip to True if served over HTTPS
)
```

The frontend no longer needs to manage the token manually — auth-guard.js simplifies considerably.

---

### [P2] CSRF Protection for State-Mutating Endpoints

**Current state:** No CSRF tokens on POST/PUT/DELETE endpoints. While `SameSite=Strict` cookies largely prevent cross-site form submission, explicit CSRF tokens are defense-in-depth, especially for the vault and SSH profile endpoints.

**Fix:** Generate a CSRF token alongside the session cookie; require it as a header (`X-CSRF-Token`) on all mutating requests. FastAPI middleware approach:

```python
@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        csrf_header = request.headers.get("X-CSRF-Token")
        expected = request.cookies.get("ds_csrf")
        if not csrf_header or not expected or csrf_header != expected:
            return JSONResponse({"error": "CSRF validation failed"}, 403)
    return await call_next(request)
```

---

### [P2] Add Audit Logging for Sensitive Operations

**Current state:** No record of who accessed the vault, which secrets were viewed, or which SSH sessions were initiated.

**Fix:** Append-only structured log file (`~/.devsuite/audit.log`) with log rotation.

```
2026-04-22T14:33:12Z VAULT_UNLOCK  ip=127.0.0.1
2026-04-22T14:33:45Z SECRET_VIEW   id=uuid-xxx type=ssh_key
2026-04-22T14:35:01Z SSH_CONNECT   host=dev.example.com user=ubuntu
```

This is especially useful for compliance and incident response. Keep it human-readable (JSON Lines or plain text). Do **not** log secret values.

---

### [P3] Localhost HTTPS (Self-Signed Cert on First Run)

**Current state:** DevSuite runs on `http://` by default. Session tokens and vault keys transit in plaintext over the loopback, which can be sniffed by other processes on the same host with packet capture privileges.

**Fix:** On first `python main.py`, auto-generate a self-signed cert using `trustme` (or `cryptography`) and write it to `~/.devsuite/cert.pem`. Subsequent runs use it automatically.

```python
import trustme

ca = trustme.CA()
server_cert = ca.issue_cert("localhost", "127.0.0.1")
server_cert.private_key_pem.write_to_path("~/.devsuite/key.pem")
server_cert.cert_chain_pems[0].write_to_path("~/.devsuite/cert.pem")
```

Run uvicorn with `ssl_keyfile` / `ssl_certfile`. Print a clear one-time message: _"Generated self-signed cert. Visit https://localhost:8000 — accept the certificate in your browser once."_

---

### [P3] Upgrade Password KDF to Argon2id

**Current state:** PBKDF2-HMAC-SHA256 with 200,000 iterations is solid but aging. Argon2id is the winner of the Password Hashing Competition (2015) and is memory-hard — a GPU cluster attacking a dumped `.dsb` file has a much harder time.

**Fix:** Add `argon2-cffi` to requirements. Migrate on next major version (v0.2.0). Keep PBKDF2 support for reading old `.dsb` files (version field in the header already supports this).

---

## 2. UI / UX

### [P1] Persistent "Back to Tools" Navigation in Tool Pages

**Current state:** Each tool page (`/diff`, `/json`, `/ssh`, etc.) is a standalone HTML page. Once a user navigates to a tool, there is no visible affordance to return to `/tools`. They must use the browser back button — breaking muscle memory for keyboard-centric developers.

**Fix:** Add a minimal persistent header strip to every tool page (via `style.css` or a shared `header.html` include).

```
┌──────────────────────────────────────────────────────┐
│  ← Tools    DevSuite    [Theme ▾]    [v0.1.3]        │
└──────────────────────────────────────────────────────┘
```

- `←` is an anchor to `/tools` (not a JS back, which fails on direct deep-link)
- Theme picker mirrors the one on home/tools pages (same `theme.js` — already available)
- Sticky with `position: sticky; top: 0; z-index: 100;`

---

### [P1] Empty State Screens for All Tools

**Current state:** Several tools (JSON Linter, YAML Linter, Regex Tester) display a blank editing area on first load with no guidance. A developer landing on the tool for the first time sees nothing actionable.

**Fix:** Each tool's primary input area should display a placeholder state when empty.

**Pattern to apply:**

```
┌─────────────────────────────────────────┐
│                                         │
│   📋  Paste JSON here                   │
│                                         │
│   or  Drop a file  ·  Ctrl+V to paste  │
│                                         │
└─────────────────────────────────────────┘
```

Implementation: CSS `::before` pseudo-element on a wrapper div that hides when the textarea/editor has content. Zero JS required.

---

### [P1] Keyboard Shortcut Overlay (Ctrl+/)

**Current state:** Keyboard shortcuts exist (e.g., `Ctrl+Enter` to compare in Text Diff) but are only discoverable by reading the UI or docs. Power users must guess or stumble upon them.

**Fix:** Press `Ctrl+/` on any tool page to show a modal shortcut cheat-sheet.

```
┌────────────────────── Keyboard Shortcuts ─────────────────────┐
│                                                                │
│  GLOBAL                          THIS TOOL (Text Diff)         │
│  Ctrl+/    Open this dialog      Ctrl+Enter  Run comparison    │
│  Ctrl+,    Open Settings         ←→          Merge left/right  │
│  Escape    Close modal           Ctrl+S      Download .patch   │
│                                  Ctrl+L      Toggle line nums  │
│                                                                │
│                                              [ Close ]         │
└────────────────────────────────────────────────────────────────┘
```

Each tool's HTML declares its own shortcuts in a `data-shortcuts` JSON attribute on the `<body>`. A shared `shortcuts.js` reads it and renders the modal. This scales to all 13 tools without duplication.

---

### [P2] Global Command Palette (Ctrl+K)

**Current state:** Navigating between tools requires going back to `/tools` and clicking a card. There is no direct jump.

**Fix:** A VS Code–style command palette available on every page.

```
Ctrl+K
┌──────────────────────────────────────────────────┐
│ > _                                              │
├──────────────────────────────────────────────────┤
│  🔎 Text Diff                       /diff        │
│  🔎 Folder Diff                     /folder-diff │
│  🔎 JSON Linter                     /json        │
│  🔑 Secret Vault                    /vault       │
│  🖥  SSH Terminal                   /ssh         │
│  ...                                             │
└──────────────────────────────────────────────────┘
```

- Fuzzy search over tool names and categories
- Arrow-key navigation + Enter to navigate
- Shared `palette.js` + `palette.css` (shared across all pages)
- Remembers the 5 most-recently used tools (localStorage `ds-recent-tools`)

---

### [P2] Recent & Pinned Tools on Tools Page

**Current state:** The tools grid always shows all 13 tools in a fixed order. A developer who uses SSH Terminal and API Tester daily must visually scan the entire grid every time.

**Fix:** Add two sections above the main grid.

```
📌 PINNED                          (editable, drag-to-reorder)
┌──────────┐  ┌──────────┐
│ SSH      │  │ API Test │
└──────────┘  └──────────┘

🕐 RECENT
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Vault    │  │ Diff     │  │ JSON     │
└──────────┘  └──────────┘  └──────────┘
```

- Pinning: click a pin icon on any card (persisted to `localStorage`)
- Recent: updated automatically on tool navigation (up to 5, ring buffer)
- Collapsible sections (state persisted)

---

### [P2] Actionable Error Messages

**Current state:** Errors in some tools display generic messages like "Error" or "Invalid input". The developer must guess what went wrong.

**Fix:** Every error state must answer three questions: **What** happened, **Why**, and **How to fix it**.

| Before | After |
|--------|-------|
| `Error: invalid JSON` | `Invalid JSON at line 14, column 3 — unexpected token '}'. Did you leave a trailing comma?` |
| `Connection failed` | `SSH connection to dev.example.com timed out (15s). Check: host reachable? Port 22 open? Firewall?` |
| `Conversion failed` | `PDF export failed — the Markdown contains an image with a remote URL. DevSuite is offline-first; use base64-encoded images instead.` |

---

### [P2] Loading & Progress States for Slow Operations

**Current state:** File conversion (DOCX→PDF, image processing) and SSH connection have no visible progress indicator beyond a frozen UI.

**Fix:**

- **File Converter**: Progress bar with stage labels (`Parsing → Rendering → Writing PDF`)
- **SSH Terminal**: Connection status badge in the tab header (`Connecting… → Connected`)
- **SFTP Operations**: Byte-level upload progress bar for large files (WebSocket streaming from backend)

Shared `progress.js` provides a reusable `ProgressBar` class (`start(label)`, `update(pct, label)`, `done()`, `error(msg)`).

---

### [P2] In-Tool History (Last 5 Inputs)

**Current state:** If a developer refreshes the page or navigates away from JSON Linter mid-edit, their work is lost. There is no recovery mechanism.

**Fix:** Auto-save the last 5 inputs per tool to `localStorage` with timestamps.

```
┌────────────────────────────────────────┐
│ JSON Linter          [History ▾] [⋯]  │
├────────────────────────────────────────┤
│ ↩ package.json — Apr 22 14:33          │
│ ↩ api-response.json — Apr 22 11:20    │
│ ↩ config.json — Apr 21 17:05          │
└────────────────────────────────────────┘
```

Each entry stores: `{ content, timestamp, label (first 40 chars), charCount }`. Total cap: 100 KB per tool via a LRU eviction.

---

### [P3] Consistent Header Across All Tool Pages

**Current state:** Tool pages use `style.css` (Apple aesthetic) for layout but some tool headers differ in structure — font sizes, padding, and button placement vary between `/diff`, `/json`, `/ssh`, and `/vault`.

**Fix:** Create a single `<header class="ds-tool-header">` component (CSS-only, no JS) with slots for:

```
[ ← Tools ]   [ Tool Name ]   [ Subtitle ]   [ Controls ]   [ Theme ]
```

Define this in `style.css` once. Each tool HTML fills in the named slots. Enforces visual consistency across all 13 pages.

---

### [P3] Skeleton Loading Screens

**Current state:** Tool pages fully block rendering until JS initializes (Monaco Editor takes ~300ms). During this time the user sees a flash of unstyled content (FOUC), especially on slower machines.

**Fix:** CSS skeleton screens that display immediately and are replaced by the real UI once JS fires.

```css
.ds-editor-skeleton {
  background: linear-gradient(90deg, var(--surface) 25%, var(--surface-hover) 50%, var(--surface) 75%);
  background-size: 200% 100%;
  animation: ds-shimmer 1.5s infinite;
  border-radius: 4px;
}
```

The skeleton matches the approximate layout of the real editor — users perceive the page as loading faster even if the actual TTI is identical.

---

### [P3] Mobile / Tablet Responsive Breakpoints (≥ 768px)

**Current state:** DevSuite explicitly targets desktop only. However, developers regularly use iPads or large-format tablets for reading diffs and checking JSON on a secondary screen while their laptop handles the IDE.

**Fix:** A single `@media (max-width: 1024px)` pass for each tool that:
- Collapses side-by-side diff panels to stacked (with a toggle to switch back)
- Converts multi-column tool grids to single column
- Stacks SSH tab bar vertically on tablet portrait
- No behavior change required — just layout reflow

Do not target phones (< 768px) — the use case is genuinely not applicable.

---

## 3. Usability

### [P1] Search / Filter Bar on Tools Page

**Current state:** The `/tools` page has category filter tabs (Dev, Data, Security, Network, Schedule) but no text search. With 13 tools today and more on the roadmap, visual scanning becomes slow.

**Fix:** Add a search input above the filter tabs.

```
┌─────────────────────────────────────────┐
│  🔍  Search tools...                   │
└─────────────────────────────────────────┘
  All   Dev   Data   Security   Network   Schedule
```

- `input[type=search]` with `debounce(200ms)`
- Filters by tool name + description + tags
- Animates non-matching cards with `opacity: 0.2` rather than `display: none` (shows total landscape)
- Clears on Escape

---

### [P1] Drag-and-Drop File Upload on All Tools

**Current state:** File upload via drag-and-drop is implemented in Text Diff but inconsistently available in other tools that accept file input (File Converter, YAML Linter, JSON Linter).

**Fix:** Centralize drag-and-drop into `dropzone.js` — a single reusable module.

```javascript
// Usage in any tool:
createDropzone({
  target: '#editor-left',
  accept: ['.json', '.txt'],
  onDrop: (file, content) => loadIntoEditor(content),
});
```

Shows a dashed overlay border when a file is dragged over the window (not just the textarea), reducing missed-drop frustration.

---

### [P2] "Copy as cURL" in API Tester

**Current state:** The Local API Tester saves collections and shows responses but does not generate cURL commands. Developers frequently need to reproduce a request in a terminal or share it with a colleague.

**Fix:** Add a **Copy as cURL** button in the response panel.

```bash
# Generated example:
curl -X POST "https://api.example.com/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Alice"}'
```

Also add **Copy as fetch** and **Copy as HTTPie** variants behind a dropdown.

---

### [P2] Per-Secret Copy-to-Clipboard Timeout in Vault

**Current state:** The vault copies secrets to the clipboard with no automatic clearing. A secret password can remain in the clipboard indefinitely.

**Fix:** After copying a secret, display a countdown timer and clear the clipboard automatically after 30 seconds.

```
✓ Copied to clipboard  ░░░░░░░░░░░░░░░░  30s  [Cancel]
                       ████████░░░░░░░░  15s
                       ████████████████   0s  → Cleared
```

The vault already handles security well; this plugs the clipboard leak vector.

---

### [P2] SSH Tab Drag-to-Reorder

**Current state:** SSH Terminal supports multiple tabs for concurrent sessions but tabs cannot be reordered. A developer with 4 sessions open must mentally track which tab is which.

**Fix:** HTML5 drag-and-drop on tab elements to reorder. Add color-coded tab indicators (one of 6 colors, user-selectable per session) so sessions are visually distinct at a glance.

---

### [P2] Undo/Redo in JSON/YAML Editors

**Current state:** Monaco Editor supports its own internal undo stack, but the **Format**, **Minify**, and **Sort Keys** buttons replace the editor content wholesale — destroying Monaco's undo history in the process.

**Fix:** Before applying any bulk operation, snapshot the editor's current content and push it onto a manual undo stack (separate from Monaco's). Bind `Ctrl+Z` to pop and restore.

```javascript
const history = [];
function applyBulkOp(fn) {
  history.push(editor.getValue());
  editor.setValue(fn(editor.getValue()));
}
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'z' && history.length) {
    editor.setValue(history.pop());
  }
});
```

---

### [P3] Export Tool Configuration / Settings Backup

**Current state:** Developers who reinstall DevSuite or move to a new machine lose their:
- API Tester collections
- SSH profiles (encrypted)
- Vault entries (encrypted)
- Theme preference

**Fix:** `/settings` page (or DevDB Manager expansion) with an **Export All** button that produces a single `.dsb` archive containing all stores, encrypted with the master password.

```
Export bundle: devsuite-backup-2026-04-22.dsb  (AES-256-GCM encrypted)
Import: drag the .dsb file here or click to select
```

DevDB already has the binary format — this is primarily a UI feature.

---

### [P3] Inline Onboarding Hints (First-Use Only)

**Current state:** The tools are discoverable but not guided. A developer using the vault for the first time sees the unlock screen with no explanation of why a password is needed.

**Fix:** First-use tooltips (shown once, dismissed to localStorage) on:
- Vault unlock: _"Your master password never leaves this machine. It decrypts your secrets locally."_
- SSH Terminal: _"SSH profiles are stored encrypted. Private key content never touches the server."_
- API Tester: _"Requests go through a local proxy — your API keys stay offline."_

These are static HTML with `display: none` after first dismissal. Zero JS complexity.

---

## 4. Developer Friendliness

### [P1] Enable FastAPI's Built-In Swagger UI in Dev Mode

**Current state:** FastAPI auto-generates `/docs` (Swagger) and `/redoc`, but these are either disabled or not prominently mentioned. Internal API documentation is invaluable for future contributors and for testing endpoints without building UI.

**Fix:** Enable conditionally based on an environment variable.

```python
app = FastAPI(
    title="DevSuite API",
    version="0.1.3",
    docs_url="/docs" if os.getenv("DEVSUITE_DEV") else None,
    redoc_url="/redoc" if os.getenv("DEVSUITE_DEV") else None,
)
```

Add `DEVSUITE_DEV=1` to `.env.example`. Document in README.

---

### [P1] Add Integration Tests for Crypto & Auth Paths

**Current state:** The test suite covers some routes but security-critical paths (PBKDF2 key derivation, AES-GCM roundtrip, session token issuance, SSRF allowlist enforcement) have no automated tests.

**Fix:** Minimum test coverage for security paths:

```python
# tests/python/test_security.py
def test_pbkdf2_deterministic():
    key1 = derive_key("password", salt)
    key2 = derive_key("password", salt)
    assert key1 == key2

def test_aes_gcm_roundtrip():
    ciphertext = encrypt(b"secret", key)
    assert decrypt(ciphertext, key) == b"secret"

def test_proxy_ssrf_blocked():
    resp = client.post("/api/proxy", json={"url": "http://192.168.1.1/admin"})
    assert resp.status_code == 403

def test_auth_rate_limit():
    for _ in range(6):
        client.post("/api/auth/session", json={"key_hex": "bad"})
    # 6th attempt should be rate-limited
    assert resp.status_code == 429
```

These prevent regressions when crypto parameters are changed.

---

### [P2] Dockerfile + Docker Compose for One-Command Deploy

**Current state:** Setup requires Python 3.12, pip, and manual venv. On some systems (Windows without WSL, corporate locked-down machines) this is a barrier.

**Fix:** Add a `Dockerfile` and `docker-compose.yml` to the repo root.

```dockerfile
# Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "main.py"]
```

```yaml
# docker-compose.yml
services:
  devsuite:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - devsuite-data:/root/.devsuite
    environment:
      - DEVDB_PASSWORD=${DEVDB_PASSWORD:-}
volumes:
  devsuite-data:
```

This also makes CI/CD trivially easy.

---

### [P2] CONTRIBUTING.md — Tool Creation Guide

**Current state:** There is no documented process for adding a new tool. A contributor must reverse-engineer the pattern from existing tools.

**Fix:** `CONTRIBUTING.md` with a step-by-step new-tool guide.

```markdown
## Adding a New Tool

1. Create `static/mytool.html`
   - Copy template: `static/_template.html`
   - Set `<title>My Tool — DevSuite</title>`
   - Import `style.css`, `theme.js`, `auth-guard.js`
   
2. Create `static/mytool.js` (if needed)
   - Use `window.DevSuiteTheme` for theme-aware colors
   
3. Add the route in `main.py`:
   @app.get("/mytool", response_class=HTMLResponse)
   def read_mytool(): return _serve_html("mytool.html")

4. Add the card to `static/tools.html`
   - Find the tools grid section
   - Add a `<div class="tool-card">` following the existing pattern
   - Set `data-category="dev"` (or data, security, network, schedule)

5. Run tests: `pytest tests/python/`
```

Include a `static/_template.html` starter file.

---

### [P2] `.env.example` File

**Current state:** The only documented environment variable is `DEVDB_PASSWORD` (from README). Developers setting up the project for development must discover other configuration points from the source code.

**Fix:** Add `.env.example` to the repo root documenting all environment variables.

```bash
# .env.example
# Copy to .env and fill in values

# Server-side encryption password for DevDB (leave blank to disable)
DEVDB_PASSWORD=

# Enable Swagger UI at /docs and /redoc (dev only)
DEVSUITE_DEV=0

# Override the port DevSuite listens on (default: 8000)
PORT=8000

# Override the bind host (default: 127.0.0.1)
HOST=127.0.0.1
```

---

### [P3] `make` Targets for Common Dev Tasks

**Current state:** Running tests, starting the server, and checking dependencies each require remembering specific commands.

**Fix:** Add a `Makefile` with common targets.

```makefile
.PHONY: start test lint check-updates clean

start:
	python main.py

test:
	pytest tests/python/ -v
	node tests/javascript/run.js

lint:
	ruff check .
	ruff format --check .

check-updates:
	python scripts/check_updates.py

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
```

---

### [P3] Version Indicator in Every Page Footer

**Current state:** The version `v0.1.3` appears in the README and home page but not in the running application's tool pages. Developers filing bug reports often do not know which version they are running.

**Fix:** FastAPI injects the version as a `data-version` attribute on the `<html>` element at serve time.

```python
def _serve_html(filename: str) -> str:
    content = open(f"static/{filename}").read()
    content = content.replace("<html", f'<html data-ds-version="{APP_VERSION}"')
    return content
```

A single CSS rule in `style.css` renders it as a fixed footer badge:

```css
body::after {
  content: "DevSuite " attr(data-ds-version);  /* reads from <html> */
  position: fixed;
  bottom: 8px;
  right: 12px;
  font-size: 10px;
  opacity: 0.3;
}
```

Visible without being distracting.

---

## 5. Features

### [P2] JWT Inspector (Top Roadmap Priority)

JWT debugging is one of the highest-frequency developer tasks after secret management. All three sections (header, payload, signature) should be visible simultaneously.

**Recommended UI layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  Paste JWT Token                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiO...   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  HEADER          PAYLOAD           SIGNATURE                 │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ {          │  │ {            │  │ Algorithm: RS256      │  │
│  │  alg:RS256 │  │  sub: "user" │  │ Status: ⚠ Unverified  │  │
│  │  typ: JWT  │  │  exp: [date] │  │ [Verify with key...]  │  │
│  │ }          │  │  iat: [date] │  │                       │  │
│  └────────────┘  │  ...         │  └──────────────────────┘  │
│                  │ }            │                             │
│                  └──────────────┘                             │
│  Expiry: ✓ Valid (expires in 3h 22m)                         │
└─────────────────────────────────────────────────────────────┘
```

Client-side only — the JWT never leaves the browser. Optionally accept a JWKS URL for signature verification (using the existing proxy allowlist if the JWKS endpoint is an approved host).

---

### [P2] Base64 Studio

**Recommended feature set beyond basic encode/decode:**

- UTF-8, Latin-1, and binary mode
- URL-safe Base64 (`+` → `-`, `/` → `_`)
- Detect and decode Base64 embedded in JSON strings
- Image preview (if decoded bytes are PNG/JPG)
- Diff view: original ↔ encoded side-by-side

---

### [P2] Diff Tool: 3-Way Merge View

**Current state:** Text Diff is excellent for two-file comparison. However, a common real-world scenario is a merge conflict (base + mine + theirs → result).

**Fix:** Add a 3-way mode toggled by a segmented control: `2-Way | 3-Way`.

```
[Base]        [Mine]        [Theirs]
──────────────────────────────────────
LEFT PANEL    CENTER PANEL  RIGHT PANEL
```

Center panel is the merge target. Arrow buttons send hunks left or right. Conflict markers highlighted in orange.

---

### [P2] Cron Visualizer: Next-Run Countdown

**Current state:** The Cron Visualizer shows a 28-day heatmap of upcoming runs. It does not show the live countdown to the next execution.

**Fix:** Add a real-time countdown badge.

```
*/5 * * * *    Runs every 5 minutes
               ┌───────────────────────────────┐
               │ Next run in:  2m 31s  (14:47) │
               └───────────────────────────────┘
```

Update every second via `setInterval`. This is pure client-side JS (no backend needed).

---

### [P3] Regex Tester: Multi-Input Test Cases

**Current state:** Regex Tester tests one input string at a time. Developers testing a regex against multiple strings (e.g., a list of URLs, emails, or log lines) must test them one at a time.

**Fix:** Add a **Test Suite** tab.

```
PATTERN: ^[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}$   Flags: gi

TEST CASES                                  RESULT
alice@example.com                           ✓ Match
invalid@                                    ✗ No match
bob+filter@company.co.uk                    ✓ Match
```

Input is a textarea (one test case per line). Results column shows match/no-match + captured groups.

---

### [P3] Local History / Timeline View

**Current state:** No tool tracks what a developer has done across sessions. There is no way to see "I compared these two files last Tuesday."

**Fix:** A lightweight `history.js` module that records:

```json
{ "tool": "diff", "label": "left: auth.py, right: auth_new.py", "ts": 1745000000 }
```

Accessible from the command palette (`Ctrl+K → Show History`) or from a `/history` route that shows a timeline of recent activity per tool. Storage: `localStorage`, max 200 entries, no file content (only labels).

---

## Summary Priority Matrix

| # | Improvement | Category | Priority | Effort |
|---|-------------|----------|----------|--------|
| 1 | Hash session tokens server-side | Security | P1 | Low |
| 2 | Rate-limit auth endpoints | Security | P1 | Low |
| 3 | Back-to-Tools nav header on tool pages | UI/UX | P1 | Low |
| 4 | Empty state screens | UI/UX | P1 | Low |
| 5 | Keyboard shortcut overlay (Ctrl+/) | UI/UX | P1 | Medium |
| 6 | Integration tests for crypto/auth | Dev | P1 | Medium |
| 7 | Search bar on tools page | Usability | P1 | Low |
| 8 | Drag-and-drop file upload standardized | Usability | P1 | Medium |
| 9 | HttpOnly cookie for session token | Security | P2 | Medium |
| 10 | CSRF protection middleware | Security | P2 | Low |
| 11 | Audit logging for sensitive ops | Security | P2 | Low |
| 12 | Global command palette (Ctrl+K) | UI/UX | P2 | Medium |
| 13 | Recent + Pinned tools section | UI/UX | P2 | Low |
| 14 | Actionable error messages | UI/UX | P2 | Medium |
| 15 | Loading/progress states | UI/UX | P2 | Medium |
| 16 | In-tool input history | Usability | P2 | Medium |
| 17 | Copy as cURL in API Tester | Usability | P2 | Low |
| 18 | Clipboard auto-clear in Vault | Usability | P2 | Low |
| 19 | Undo/redo for bulk editor ops | Usability | P2 | Low |
| 20 | FastAPI Swagger UI in dev mode | Dev | P2 | Low |
| 21 | Dockerfile + docker-compose | Dev | P2 | Low |
| 22 | CONTRIBUTING.md tool guide | Dev | P2 | Low |
| 23 | JWT Inspector | Feature | P2 | High |
| 24 | Base64 Studio | Feature | P2 | Low |
| 25 | CSP nonces (replace unsafe-inline) | Security | P2 | High |
| 26 | Localhost HTTPS (self-signed cert) | Security | P3 | Medium |
| 27 | Upgrade KDF to Argon2id | Security | P3 | Medium |
| 28 | Consistent tool page header component | UI/UX | P3 | Medium |
| 29 | Skeleton loading screens | UI/UX | P3 | Medium |
| 30 | Tablet responsive (768–1024px) | UI/UX | P3 | High |
| 31 | Cron Visualizer next-run countdown | Feature | P2 | Low |
| 32 | 3-Way merge diff view | Feature | P2 | High |
| 33 | Regex multi-input test suite | Feature | P3 | Low |
| 34 | Export / import all settings backup | Usability | P3 | Medium |
| 35 | Version badge in tool page footers | Dev | P3 | Low |
| 36 | Makefile for dev tasks | Dev | P3 | Low |
| 37 | `.env.example` | Dev | P3 | Low |

---

## Recommended Milestone Plan

### v0.2.0 — Security Hardening ✅ SHIPPED 2026-04-22
Items 1, 2, 9, 10, 11, 20 (all P1/P2 security). Zero visible UI change; deploy with confidence.

**Delivered:**
- \#1 — BLAKE2b session-token hashing (`_sessions` stores digest, not raw token)
- \#2 — Rate limiting on `/api/auth/challenge` + `/api/auth/session` (5 req/min via `slowapi`)
- \#9 — `ds_session` HttpOnly SameSite=Strict cookie; JavaScript can no longer read the token
- \#10 — CSRF middleware (`X-CSRF-Token` header required on all mutating endpoints)
- \#11 — Append-only audit log at `~/.devsuite/audit.log` (AUTH_SESSION, VAULT_ACCESS, SSH_CONNECT)
- \#20 — Swagger UI (`/docs`, `/redoc`) disabled by default; enabled via `DEVSUITE_DEV=1`

### v0.3.0 — UX Foundation
Items 3, 4, 5, 7, 8, 13, 14, 17, 18. Dramatically improves daily usability for existing users.

### v0.4.0 — Power User
Items 12, 15, 16, 19, 23, 24, 31. JWT Inspector ships, command palette unlocks power-user muscle memory.

### v1.0.0 — Production Ready
Items 21, 22, 6, 35, 36, 37, 34. Docker image published, integration tests green, CONTRIBUTING.md in place.

---

*This review reflects the state of DevSuite v0.1.3. The project has an exceptionally strong foundation — particularly its security model and UI polish. The improvements above are refinements, not rewrites.*
