# DevSuite — Backlog

> Structured by type: Security, Feature, Bugfix, DX, and Roadmap.
> Promote items from GitHub issues into the Bugfix table as they're triaged.

**Status legend**: `[ ]` Open · `[/]` In Progress · `[x]` Done · `[-]` Rejected  
**Effort scale**: `XS` < 1 hr · `S` 1–3 hrs · `M` 3–8 hrs · `L` 1–2 days · `XL` 2+ days

---

## 🔒 Security

| # | Item | Effort | Status |
|---|---|---|---|
| SEC-1 | **pip-audit CVE Scanning**: Integrate `pip-audit` into the dev workflow to scan Python dependencies before every release. | XS | `[ ]` |
| SEC-2 | **JS Dependency CVE Visibility**: Add a `package.json` listing all vendored JS libs (xterm, crypto-js, marked, highlight.js, papaparse, js-yaml, requirejs, monaco-editor) so `npm audit` catches CVEs in CI and Dependabot auto-raises alerts. Currently `check_updates.py` only detects newer versions — known vulnerabilities in `static/libs` are a blind spot when open-sourcing. Wire `npm audit --audit-level=high` into GitHub Actions alongside `pip-audit`. | S | `[ ]` |
| SEC-3 | **CORS Hardening**: `CORSMiddleware` in `main.py` restricted to the `_ALLOWED_ORIGINS` allowlist (`localhost:8000`, `127.0.0.1:8000`). Closed in v0.2.3. | XS | `[x]` |
| SEC-4 | **Rate Limiting**: `slowapi>=0.1.9` added (v0.2.0). Auth endpoints (`/api/auth/challenge`, `/api/auth/session`) capped at 5 req/min per IP. | S | `[x]` |
| SEC-6 | **Remove `unsafe-eval` from CSP**: Closed in v0.3.0 — API Tester scripting moved into `static/script-sandbox-worker.js` (dedicated Worker, scoped CSP with `connect-src 'none'`); document responses no longer carry `unsafe-eval`. Covered by `tests/python/test_csp.py`. | M | `[x]` |
| SEC-7 | **JS Sandboxing**: Use Web Workers for heavy/untrusted JS logic to isolate the UI thread. API Tester scripting done in v0.3.0 (10 s timeout, no DOM/network). Remaining: diffing, crypto. | L | `[/]` |
| SEC-8 | **Vault Password Change**: Add a "Change Master Password" flow that re-encrypts all secrets with the new key. | M | `[ ]` |
| SEC-9 | **Vault Export / Backup**: Export vault entries as an encrypted backup file for disaster recovery. | S | `[ ]` |
| SEC-11 | **CSP Nonces (replace `unsafe-inline`)**: Generate a per-response nonce in `_serve_html()` and inject it into all `<script>` and `<style>` tags; update CSP accordingly. Requires moving remaining inline scripts to external `.js` files first. | M | `[ ]` |
| SEC-12 | **Localhost HTTPS**: On first run, auto-generate a self-signed cert (`trustme` or `cryptography`) and start uvicorn with `ssl_keyfile` / `ssl_certfile`. Eliminates plaintext token transit over the loopback. | M | `[ ]` |
| SEC-13 | **Argon2id KDF**: Replace PBKDF2-HMAC-SHA256 with Argon2id (`argon2-cffi`) for the vault password. Keep PBKDF2 read path for backward compatibility via the existing header version field. Target v0.3.0+ to avoid a breaking migration. | M | `[ ]` |

---

## ✨ Feature

| # | Item | Effort | Status |
|---|---|---|---|
| FEAT-1 | **Color Studio**: Gradient generator, contrast checker, and palette exporter (HEX/HSL/RGB). | M | `[ ]` |
| FEAT-2 | **ID Generator**: Bulk generate UUIDs, ULIDs, and CUIDs with entropy inspection. | S | `[ ]` |
| FEAT-3 | **Markdown Lab**: Real-time Monaco → rendered HTML preview for README testing. | M | `[ ]` |
| FEAT-4 | **JWT Debugger**: Full JWT decode and verify tool (HS256/RS256) with signature validation. Already shipped as the JWT Inspector tab in Crypto Suite (`static/crypto.html`, `specs/007-crypto-suite/spec.md` US6) — HS256/384/512 + RS256, real `crypto.subtle.verify`. Was undiscoverable (Crypto Suite's tools.html card didn't mention it, and a stale "Coming Soon" roadmap card duplicated it); both fixed. | M | `[x]` |
| FEAT-5 | **HTTP Mock Server**: Define mock endpoints locally; replay canned JSON responses for frontend testing. | XL | `[ ]` |
| FEAT-6 | **File Converter — more formats**: Image format conversion (PNG ↔ JPG ↔ WebP) and XML ↔ JSON client-side. | M | `[ ]` |
| FEAT-7 | **Folder Diff — Streaming Zip Download**: Current in-browser zip (JSZip) buffers the entire output in RAM, making it unusable for files > 512 MB. Research streaming zip generation using `fflate` (streaming mode) + the File System Access API (`showSaveFilePicker`) to write chunks directly to disk with no RAM ceiling. Blocked on Chrome/Edge-only `showSaveFilePicker` availability; needs a graceful fallback for Firefox. | L | `[ ]` |
| FEAT-8 | **API Tester — masked environment secrets**: `secret` flag per env variable, masked in UI; phase 2 backs them with the Secret Vault (SPEC §13 v0.3.x). | M | `[ ]` |
| FEAT-9 | **API Tester — daily-driver v0.3.0 track**: Worker script sandbox, collection runner, cURL import/code-gen, nested folders, cookie jar, git-friendly zip export. Shipped in v0.3.0 (SPEC §4.7.1–§4.7.6). | XL | `[x]` |
| FEAT-10 | **API Tester — sidebar request management** (Bruno gap #1): rename/duplicate/move/delete requests via context menu, rename/delete folders (path cascade incl. `folderAuths`), drag-to-reorder + drag-into-folder. Pure logic in `collection-utils.js`. Shipped in v0.3.0 (SPEC §4.7.4). | M | `[x]` |
| FEAT-11 | **API Tester — "honest proxy" slice** (Bruno gap #2): per-request skip-TLS-verify / timeout / redirect toggle; multipart file upload; binary-safe responses (base64 proxy mode, download button, image preview). | M | `[ ]` |
| FEAT-12 | **API Tester — OAuth2 authorization-code + PKCE** (Bruno gap #3): popup/redirect-capture flow for Auth0/Keycloak/Azure AD-style providers. | L | `[ ]` |
| FEAT-13 | **API Tester — CLI runner** (Bruno `bru run` equivalent): `python -m devsuite run <collection.zip> --env <name> --report junit.xml`; consumes the git-friendly zip (SPEC §13 v0.3.x #4). | L | `[ ]` |
| FEAT-14 | **API Tester — declarative assertions**: no-code assert rows (field/operator/value) compiled onto the sandbox `expect` engine. | S | `[ ]` |
| FEAT-15 | **API Tester — collection/folder-level variables** + folder-level cascading scripts, extending the folder-auth inheritance pattern. | M | `[ ]` |
| FEAT-16 | **WebSocket tester**: browsers don't enforce CORS on WS — mostly frontend, no proxy needed. gRPC explicitly out of scope. | M | `[ ]` |
| FEAT-17 | **API Tester — cheap parity wins**: Insomnia import; code-gen for Python `requests`/axios/Go; markdown docs field per request; collection-level default auth. | S | `[ ]` |

---

## 🐛 Bugfix

| # | Item | Effort | Status |
|---|---|---|---|
| — | No open bugs tracked. Triage GitHub issues and promote here as needed. | — | — |

---

## 🧑‍💻 Developer Experience (DX)

| # | Item | Effort | Status |
|---|---|---|---|
| DX-1 | **Automated Linting**: Set up `ruff` (Python) and `eslint` (JS) with a `pre-commit` hook. | S | `[ ]` |
| DX-2 | **JS Modularization**: Split `app.js` into tool-specific modules (e.g., `diff-engine.js`, `tree-view.js`). | M | `[ ]` |
| DX-3 | **Hot Reload Sidecar**: `watchdog`-based reloader that refreshes the browser on file edits. | S | `[ ]` |
| DX-4 | **Lazy Loading**: Load Monaco Editor and heavy libs only when the user navigates to a relevant tool. | M | `[ ]` |
| DX-5 | **Accessibility (a11y)**: Complete ARIA/role audit; keyboard-only navigation for all tools. Folder Diff, json/yaml/base64/regex pages partially done in v0.1.1–v0.1.2. | M | `[/]` |
| DX-6 | **Playwright e2e Tests**: Happy-path browser tests for every tool in the suite. | L | `[ ]` |
| DX-10 | **JS unit test suite (node)**: Zero-dependency runner at `tests/javascript/run.js` covering the pure modules (`curl-codegen.js`, `cookie-jar.js`). Bootstrapped in v0.3.0; extend as more logic is extracted into pure modules (DX-2). | S | `[x]` |
| DX-7 | **Visual Regression**: Playwright screenshots across all themes to catch CSS regressions. | M | `[ ]` |
| DX-8 | **Large-File Benchmarking**: Stress tests for diffing files > 10,000 lines. | S | `[ ]` |
| DX-9 | **De-emoji UI chrome (design-system §9.8/§9.9)**: Replace emoji used as icons/status glyphs with stroke-based inline SVG across all tool pages. Done in v0.2.4: `auth-guard.js`, DevDB Manager (`db-manager.html`/`.js`). Remaining: `home.html`, `ssh-manager.*`, `crypto.html`, `base64.html`, `vault.*`, `cron.js`, `regex.html`, `json.html`, `yaml.html`, `index.html`, `sftp-browser.js`, `file-converter.html`, `api-tester.js`, and the shared toast close glyph in `components.js`. | M | `[/]` |

---

## 🗺️ Roadmap

| # | Item | Effort | Status |
|---|---|---|---|
| ROAD-1 | **CI/CD Pipeline**: GitHub Actions running linters, `pip-audit`, `npm audit`, and tests on every PR. Prerequisite for SEC-1, SEC-2, DX-6. CodeQL workflow uses standard `github/codeql-action@v3`. `tests.yml` added in v0.2.4 — runs `pytest` on push/PR (Python 3.10 + 3.12). Remaining: wire linters (DX-1) + audit tools (SEC-1/SEC-2). | S | `[/]` |
| ROAD-2 | **SonarQube CI Integration**: Wire `sonar-project.properties` into GitHub Actions for automated quality gate on every PR. v0.1.3 closed multiple S3776/S4666/S108 findings. | S | `[/]` |
| ROAD-3 | **Dockerization**: Multi-stage `Dockerfile` and `docker-compose.yml` for zero-setup deployment. | S | `[ ]` |
| ROAD-4 | **PyPI Packaging**: `pyproject.toml` to allow `pip install devsuite` with a CLI entry point. | M | `[ ]` |
| ROAD-5 | **GitHub Release Automation**: Auto-generate zip releases and update version tags on every release. | M | `[ ]` |
| ROAD-6 | **Homebrew Formula**: One-liner formula for macOS/Linux `brew` users. | L | `[ ]` |
| ROAD-7 | **Native App Wrapper**: Evaluate Tauri for packaging DevSuite as a native OS app (`.app`, `.exe`). | XL | `[ ]` |

---

## ✅ Completed

| Item | Notes |
|---|---|
| Diff Checker | |
| JSON Linter | |
| YAML Linter | |
| Regex Tester | |
| Base64 Encoder / Decoder (+ JWT decode-only panel) | |
| Crypto Suite (+ full JWT Inspector w/ signature verification) | |
| Local API Tester (HTTP Request Builder) | |
| Secure Terminal & SFTP | |
| Cron Visualizer | |
| Secret Vault | |
| DevDB Manager | |
| File Format Converter | |
