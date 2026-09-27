# DevSuite — Backlog

> Structured by type: Security, Feature, Bugfix, DX, and Roadmap.
> Promote items from GitHub issues into the Bugfix table as they're triaged.

**Status legend**: `[ ]` Open · `[/]` In Progress · `[x]` Done · `[-]` Rejected  
**Effort scale**: `XS` < 1 hr · `S` 1–3 hrs · `M` 3–8 hrs · `L` 1–2 days · `XL` 2+ days

---

## 🤖 AI-Era Tooling

> **Research note (2026-09-27):** AI coding agents (Claude Code, Cursor, Copilot) are now in production
> at most orgs, and MCP has become the standard agent-integration protocol (17k+ public servers,
> now Linux Foundation-governed). The failure mode that comes with both: secrets sprawl. GitGuardian's
> 2026 report found **24,008 unique secrets in public MCP config files** and found AI-assisted commits
> leak credentials at ~2x the base rate; a separate August 2026 study pulled 62 live API keys and 33
> passwords out of shared agent *reasoning* logs. None of this needs a cloud AI call to fix — it needs
> better local linting and secret detection, which is exactly DevSuite's existing lane (Data Linter,
> Secret Vault). Items below stay inside Constitution Principle II (local-only, offline-first): no item
> here calls out to a cloud LLM API by default. Each would go through `/speckit-specify` (next spec
> number: `021-`) before implementation, per the spec-first rule.

| # | Item | Effort | Status |
|---|---|---|---|
| AI-1 | **MCP Config Secret Scanner**: Validate `.mcp.json` / `claude_desktop_config.json` / similar MCP server manifests (schema shape: `mcpServers`, `command`, `args`, `env`) and flag inline API keys/tokens/high-entropy strings sitting in plaintext `env` blocks instead of a real secrets mechanism — the exact pattern behind GitGuardian's 24k-secret MCP finding. Offer a one-click "move to Secret Vault, reference by name" fix. Extends Data Linter's JSON engine; entirely client-side. | M | `[ ]` |
| AI-2 | **Paste-box Secret Scanner**: Standalone panel (or Vault sub-tab) that runs regex + Shannon-entropy secret detection (AWS/GitHub/OpenAI/Anthropic key shapes, JWTs, private-key headers) over arbitrary pasted text — agent session logs, `.env` files, shell history, diffs — before a developer commits or shares them. Nothing leaves the browser; this is the client-side, offline analog of gitleaks/detect-secrets. | M | `[ ]` |
| AI-3 | **LLM Token & Cost Estimator**: Offline BPE-style tokenizer (vendor a small cl100k/o200k merge table under `static/libs/`) plus a manually-maintained per-provider price table, so a developer can paste a prompt and get a token count + estimated API cost with zero network calls. Pure client-side, no live pricing fetch (keeps Principle II intact — price table is a static asset, updated by hand like `scripts/versions.json`). | M | `[ ]` |
| AI-4 | **JSON Schema Validator (structured-output mode)**: Extend Data Linter to validate a JSON payload against a user-supplied JSON Schema, framed for the LLM function-calling / structured-output use case (tool-call args, response shapes) that's now ubiquitous in agent code. | S | `[ ]` |
| AI-5 | **Agent Config Linter**: Schema-aware validation for the config files the AI-agent ecosystem itself has proliferated — Claude Code `settings.json` (incl. `hooks` arrays), `SKILL.md` YAML frontmatter, `.cursor/rules`, `AGENTS.md` front-matter shapes. Same engine as AI-1/AI-4, different schemas. | M | `[ ]` |
| AI-6 | **Local LLM Playground** *(stretch, opt-in)*: Minimal chat/completion test panel that talks only to a user-specified `localhost`/LAN endpoint (Ollama `:11434`, LM Studio, etc.) — never a cloud endpoint by default. Same "not-strictly-offline" exception class as the existing CORS proxy and SSH terminal, labeled identically in UI and spec. Rides the growing on-device-LLM trend (Ollama, Meta Muse Glimmer) without breaking the local-only mission. | L | `[ ]` |

---

## 🔒 Security

| # | Item | Effort | Status |
|---|---|---|---|
| SEC-1 | **pip-audit CVE Scanning**: Integrate `pip-audit` into the dev workflow to scan Python dependencies before every release. | XS | `[ ]` |
| SEC-2 | **JS Dependency CVE Visibility**: Add a `package.json` listing all vendored JS libs (xterm, crypto-js, marked, highlight.js, papaparse, js-yaml, requirejs, monaco-editor) so `npm audit` catches CVEs in CI and Dependabot auto-raises alerts. Currently `check_updates.py` only detects newer versions — known vulnerabilities in `static/libs` are a blind spot when open-sourcing. Wire `npm audit --audit-level=high` into GitHub Actions alongside `pip-audit`. | S | `[ ]` |
| SEC-3 | **CORS Hardening**: `CORSMiddleware` restricted to `_ALLOWED_ORIGINS`. Closed v0.2.3. | XS | `[x]` |
| SEC-4 | **Rate Limiting**: `slowapi` on auth endpoints, 5 req/min/IP. Closed v0.2.0. | S | `[x]` |
| SEC-6 | **Remove `unsafe-eval` from CSP**: API Tester scripting isolated in `script-sandbox-worker.js`. Closed v0.3.0 — see `tests/python/test_csp.py`. | M | `[x]` |
| SEC-7 | **JS Sandboxing**: Use Web Workers for heavy/untrusted JS logic to isolate the UI thread. API Tester scripting done in v0.3.0 (10 s timeout, no DOM/network). Remaining: diffing, crypto. | L | `[/]` |
| SEC-8 | **Vault Password Change**: "Change Password" flow re-derives/re-encrypts client-side and rotates the auth challenge. Closed — see `specs/011-secret-vault/spec.md` US8/FR-019/FR-020. | M | `[x]` |
| SEC-9 | **Vault Export / Backup**: Encrypted backup/restore via header controls in `vault.html`. Closed — see `specs/011-secret-vault/spec.md` US7/FR-017/FR-018. | S | `[x]` |
| SEC-11 | **CSP Nonces (replace `unsafe-inline`)**: Generate a per-response nonce in `_serve_html()` and inject it into all `<script>` and `<style>` tags; update CSP accordingly. Requires moving remaining inline scripts to external `.js` files first. | M | `[ ]` |
| SEC-12 | **Localhost HTTPS**: On first run, auto-generate a self-signed cert (`trustme` or `cryptography`) and start uvicorn with `ssl_keyfile` / `ssl_certfile`. Eliminates plaintext token transit over the loopback. | M | `[ ]` |
| SEC-13 | **Argon2id KDF**: Replace PBKDF2-HMAC-SHA256 with Argon2id (`argon2-cffi`) for the vault password. Keep PBKDF2 read path for backward compatibility via the existing header version field. Target v0.3.0+ to avoid a breaking migration. | M | `[ ]` |

---

## ✨ Feature

| # | Item | Effort | Status |
|---|---|---|---|
| FEAT-1 | **Color Studio**: Gradient generator, contrast checker, and palette exporter (HEX/HSL/RGB). | M | `[ ]` |
| FEAT-2 | **ID Generator**: Bulk UUIDs/ULIDs/CUIDs with entropy inspection. Shipped v0.6.0 as `/id-generator` (`specs/019-id-generator/`). | S | `[x]` |
| FEAT-3 | **Markdown Lab**: Real-time Monaco → rendered HTML preview for README testing. | M | `[ ]` |
| FEAT-4 | **JWT Debugger**: Full JWT decode/verify (HS256/RS256). Shipped as the JWT Inspector tab in Crypto Suite (`specs/007-crypto-suite/spec.md` US6). | M | `[x]` |
| FEAT-5 | **HTTP Mock Server**: Define mock endpoints locally; replay canned JSON responses for frontend testing. | XL | `[ ]` |
| FEAT-6 | **File Converter — more formats**: Image format conversion (PNG ↔ JPG ↔ WebP) and XML ↔ JSON client-side. | M | `[ ]` |
| FEAT-7 | **Folder Diff — Streaming Zip Download**: Current in-browser zip (JSZip) buffers the entire output in RAM, making it unusable for files > 512 MB. Research streaming zip generation using `fflate` (streaming mode) + the File System Access API (`showSaveFilePicker`) to write chunks directly to disk with no RAM ceiling. Blocked on Chrome/Edge-only `showSaveFilePicker` availability; needs a graceful fallback for Firefox. | L | `[ ]` |
| FEAT-8 | **API Tester — masked environment secrets**: `secret` flag per env variable, masked in UI; phase 2 backs them with the Secret Vault (SPEC §13 v0.3.x). | M | `[ ]` |
| FEAT-9 | **API Tester — daily-driver v0.3.0 track**: Worker sandbox, collection runner, cURL import/code-gen, nested folders, cookie jar, zip export. Shipped v0.3.0 (SPEC §4.7.1–§4.7.6). | XL | `[x]` |
| FEAT-10 | **API Tester — sidebar request management** (Bruno gap #1): rename/duplicate/move/delete, drag-to-reorder. Shipped v0.3.0 (SPEC §4.7.4). | M | `[x]` |
| FEAT-11 | **API Tester — "honest proxy" slice** (Bruno gap #2): per-request skip-TLS-verify / timeout / redirect toggle; multipart file upload; binary-safe responses (base64 proxy mode, download button, image preview). | M | `[ ]` |
| FEAT-12 | **API Tester — OAuth2 authorization-code + PKCE** (Bruno gap #3): popup/redirect-capture flow for Auth0/Keycloak/Azure AD-style providers. | L | `[ ]` |
| FEAT-13 | **API Tester — CLI runner** (Bruno `bru run` equivalent): `python -m devsuite run <collection.zip> --env <name> --report junit.xml`; consumes the git-friendly zip (SPEC §13 v0.3.x #4). | L | `[ ]` |
| FEAT-14 | **API Tester — declarative assertions**: no-code assert rows (field/operator/value) compiled onto the sandbox `expect` engine. | S | `[ ]` |
| FEAT-15 | **API Tester — collection/folder-level variables** + folder-level cascading scripts, extending the folder-auth inheritance pattern. | M | `[ ]` |
| FEAT-16 | **WebSocket tester**: direct browser `ws:`/`wss:` connect, message log, subprotocols. Shipped v0.7.0 as `/ws-tester` (`specs/020-websocket-tester/`). | M | `[x]` |
| FEAT-17 | **API Tester — cheap parity wins**: Insomnia import; code-gen for Python `requests`/axios/Go; markdown docs field per request; collection-level default auth. | S | `[ ]` |
| FEAT-18 | **SSH Terminal — optional session output logging**: per-tab "Log Output" toggle, bounded in-memory buffer, "Download Log" as plain text. Client-side only. Shipped v0.10.0 (`specs/009-secure-terminal-sftp/spec.md` FR-002a/SC-007). | S | `[x]` |

---

## 🐛 Bugfix

| # | Item | Effort | Status |
|---|---|---|---|
| BUG-1 | **DB Manager password-change locks out a v2 Vault**: `db-manager.js`'s `savePassword()` always POSTs the v1 challenge shape (no `challenge_version`), downgrading an existing v2 Vault's auth challenge to v1 while the vault's ciphertext stays v2/GCM. On the next `/vault` unlock, `_unlockVaultNormal` authenticates fine (v1 key matches the v1 challenge) but never decrypts — `blobVersion===2 && masterKenc` is false (v1 path never sets `masterKenc`) and `blobVersion===1 && masterKey` is false (blob is still 2), so it falls into the generic "Unexpected vault/challenge version mismatch — please reload" branch, which never resolves. Verified against source while building SEC-8; see `specs/012-db-manager/spec.md` Assumptions (2026-09-25 correction) and `specs/011-secret-vault/spec.md` Assumptions. Fix belongs in `savePassword()` (always emit the v2 shape) or a defensive fallback in `_unlockVaultNormal`. | S | `[ ]` |
| BUG-2 | **SFTP upload has no feedback for the real (remote) transfer phase, and can't be cancelled**: `sftp_upload` (routes/ssh.py) buffers the whole file (`await file.read()`) then does one `await remote_file.write(...)` to the actual remote host — the slow part. The browser's `xhr.upload.onprogress` only measures the fast local browser→server leg, so the UI looked "finished" while the real transfer kept running silently. Fixed the *visibility* gap in this session (`static/ssh-manager.js`/`.html`, `specs/009-secure-terminal-sftp/spec.md` FR-012a/SC-006): a single reused per-file status toast now shows "sent to server — writing to remote via SFTP…" for that gap instead of one new auto-dismissing toast per progress tick (which used to visibly pile up), and the Upload button disables for the duration. **Not fixed**: the server still buffers the whole file in memory instead of streaming (unlike `sftp_download`'s 64 KB chunks), and there's no `request.is_disconnected()` check — closing the tab mid-upload doesn't stop the backend write. Proper fix needs chunked streaming + a real mid-transfer progress channel (HTTP alone can't push server-side progress back mid-request). | M | `[/]` |

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
| DX-10 | **JS unit test suite (node)**: Zero-dependency runner at `tests/javascript/run.js`. Bootstrapped v0.3.0; extend as more logic is extracted into pure modules (DX-2, AI-2/AI-3). | S | `[x]` |
| DX-7 | **Visual Regression**: Playwright screenshots across all themes to catch CSS regressions. | M | `[ ]` |
| DX-8 | **Large-File Benchmarking**: Stress tests for diffing files > 10,000 lines. | S | `[ ]` |
| DX-9 | **De-emoji UI chrome (design-system §9.8/§9.9)**: Replace emoji used as icons/status glyphs with stroke-based inline SVG across all tool pages. Done in v0.2.4: `auth-guard.js`, DevDB Manager (`db-manager.html`/`.js`). Remaining: `home.html`, `ssh-manager.*`, `crypto.html`, `base64.html`, `vault.*`, `cron.js`, `regex.html`, `data-linter.html` (superseded `json.html`/`yaml.html` — corrected 2026-09-27, those files no longer exist), `index.html`, `sftp-browser.js`, `file-converter.html`, `api-tester.js`, and the shared toast close glyph in `components.js`. | M | `[/]` |

---

## 🗺️ Roadmap

| # | Item | Effort | Status |
|---|---|---|---|
| ROAD-1 | **CI/CD Pipeline**: GitHub Actions running linters, `pip-audit`, `npm audit`, and tests on every PR. Prerequisite for SEC-1, SEC-2, DX-6. CodeQL workflow uses standard `github/codeql-action@v3`. `tests.yml` added in v0.2.4 — runs `pytest` on push/PR (Python 3.10 + 3.12). Remaining: wire linters (DX-1) + audit tools (SEC-1/SEC-2). | S | `[/]` |
| ROAD-2 | **SonarQube CI Integration**: Wire `sonar-project.properties` into GitHub Actions for automated quality gate on every PR. v0.1.3 closed multiple S3776/S4666/S108 findings. | S | `[/]` |
| ROAD-3 | **Dockerization**: Multi-stage `Dockerfile` and `docker-compose.yml` for zero-setup deployment. | S | `[ ]` |
| ROAD-4 | **PyPI Packaging**: `pyproject.toml` to allow `pip install devsuite` with a CLI entry point. | M | `[ ]` |
| ROAD-5 | **GitHub Release Automation**: Auto-generate zip releases and update version tags on every release. | M | `[ ]` |
| ROAD-6 | **Homebrew Formula**: One-liner formula for macOS/Linux `brew` users. *Candidate for deprioritization (2026-09-27) — ROAD-4 (PyPI) covers the same distribution need with far less effort; revisit only if user demand shows up.* | L | `[ ]` |
| ROAD-7 | **Native App Wrapper**: Evaluate Tauri for packaging DevSuite as a native OS app (`.app`, `.exe`). *Candidate for deprioritization (2026-09-27) — XL effort for a cosmetic wrapper around what's already a `localhost:8000` app; lower ROI than the AI-Era Tooling items above, which serve the stated "help developers" mission more directly.* | XL | `[ ]` |

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
| ID Generator | `specs/019-id-generator/` |
| WebSocket Tester | `specs/020-websocket-tester/` |
| Notes Workspace | `specs/017-notes-workspace/` |
| Learning Roadmap | `specs/018-learning-roadmap/` |
