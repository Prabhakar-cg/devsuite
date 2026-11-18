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
> here calls out to a cloud LLM API by default. AI-1/AI-2 were combined into `specs/021-secret-scanner/`
> via `/speckit-specify` on 2026-09-27; the remaining items would go through `/speckit-specify`
> (next spec number: `022-`) before implementation, per the spec-first rule.

| # | Item | Effort | Status |
|---|---|---|---|
| AI-1 | **MCP Config Secret Scanner**: shipped v0.19.0 as part of `/secret-scanner` (`specs/021-secret-scanner/`) — manifest-aware literal-`env` detection with a corrected-manifest output. The one-click "move to Vault" write was replaced by a copy/handoff flow (the vault key is deliberately never available to other pages — see the spec's implementation note). | M | `[x]` |
| AI-2 | **Paste-box Secret Scanner**: shipped v0.19.0 (`/secret-scanner`, 16th tool) — regex + entropy detection, redacted previews, 100% client-side. | M | `[x]` |
| AI-3 | **LLM Token & Cost Estimator**: Offline BPE-style tokenizer (vendor a small cl100k/o200k merge table under `static/libs/`) plus a manually-maintained per-provider price table, so a developer can paste a prompt and get a token count + estimated API cost with zero network calls. Pure client-side, no live pricing fetch (keeps Principle II intact — price table is a static asset, updated by hand like `scripts/versions.json`). | M | `[ ]` |
| AI-4 | **JSON Schema Validator (structured-output mode)**: shipped v0.19.0 — *Schema* button in the Data Linter (`json-schema-lite.js`, 18 tests). | S | `[x]` |
| AI-5 | **Agent Config Linter**: Schema-aware validation for the config files the AI-agent ecosystem itself has proliferated — Claude Code `settings.json` (incl. `hooks` arrays), `SKILL.md` YAML frontmatter, `.cursor/rules`, `AGENTS.md` front-matter shapes. Same engine as AI-1/AI-4, different schemas. | M | `[ ]` |
| AI-6 | **Local LLM Playground** *(stretch, opt-in)*: Minimal chat/completion test panel that talks only to a user-specified `localhost`/LAN endpoint (Ollama `:11434`, LM Studio, etc.) — never a cloud endpoint by default. Same "not-strictly-offline" exception class as the existing CORS proxy and SSH terminal, labeled identically in UI and spec. Rides the growing on-device-LLM trend (Ollama, Meta Muse Glimmer) without breaking the local-only mission. | L | `[ ]` |

---

## 🔒 Security

| # | Item | Effort | Status |
|---|---|---|---|
| SEC-1 | **pip-audit CVE Scanning**: `pip-audit -r requirements.txt` runs in CI (`.github/workflows/tests.yml`); clean as of 2026-11-17. | XS | `[x]` |
| SEC-2 | **JS Dependency CVE Visibility**: `package.json` lists the vendored libs so `npm audit` sees their CVEs; wired into CI (`vendored-js-audit`). First run (2026-11-17) found real advisories — js-yaml 4.2.0 (high, merge-key/`!!omap` CPU DoS) and DOMPurify 3.4.13 (critical `SAFE_FOR_TEMPLATES` bypass, not enabled by DevSuite) — both upgraded in place (js-yaml 4.3.2, DOMPurify 3.4.18). xterm/crypto-js versions are not identifiable from the bundles. | S | `[x]` |
| SEC-3 | **CORS Hardening**: `CORSMiddleware` restricted to `_ALLOWED_ORIGINS`. Closed v0.2.3. | XS | `[x]` |
| SEC-4 | **Rate Limiting**: `slowapi` on auth endpoints, 5 req/min/IP. Closed v0.2.0. | S | `[x]` |
| SEC-6 | **Remove `unsafe-eval` from CSP**: API Tester scripting isolated in `script-sandbox-worker.js`. Closed v0.3.0 — see `tests/python/test_csp.py`. | M | `[x]` |
| SEC-7 | **JS Sandboxing**: Use Web Workers for heavy/untrusted JS logic to isolate the UI thread. API Tester scripting done in v0.3.0 (10 s timeout, no DOM/network). Remaining: diffing, crypto. | L | `[/]` |
| SEC-8 | **Vault Password Change**: "Change Password" flow re-derives/re-encrypts client-side and rotates the auth challenge. Closed — see `specs/011-secret-vault/spec.md` US8/FR-019/FR-020. | M | `[x]` |
| SEC-9 | **Vault Export / Backup**: Encrypted backup/restore via header controls in `vault.html`. Closed — see `specs/011-secret-vault/spec.md` US7/FR-017/FR-018. | S | `[x]` |
| SEC-11 | **CSP Nonces (replace `unsafe-inline`)**: Generate a per-response nonce in `_serve_html()` and inject it into all `<script>` and `<style>` tags; update CSP accordingly. Requires moving remaining inline scripts to external `.js` files first. | M | `[ ]` |
| SEC-12 | **Localhost HTTPS**: On first run, auto-generate a self-signed cert (`trustme` or `cryptography`) and start uvicorn with `ssl_keyfile` / `ssl_certfile`. Eliminates plaintext token transit over the loopback. | M | `[ ]` |
| SEC-13 | **Argon2id KDF**: Replace PBKDF2-HMAC-SHA256 with Argon2id (`argon2-cffi`) for the vault password. Keep PBKDF2 read path for backward compatibility via the existing header version field. Target v0.3.0+ to avoid a breaking migration. | M | `[ ]` |
| SEC-15 | **Host-header allowlist (DNS rebinding)**. Closed v0.14.0 — `specs/025-security-hardening/`. | S | `[x]` |
| SEC-16 | **Origin validation** (HTTP mutating + WebSocket; no Host-derived trust). Closed v0.14.0. | S | `[x]` |
| SEC-17 | **Session-gate SFTP/WSL HTTP endpoints**. Closed v0.14.0. | XS | `[x]` |
| SEC-18 | **Proxy connect-time peer check + mapped/unspecified IPs**. Closed v0.14.0. | S | `[x]` |
| SEC-19 | **CSP framing/base/object/form directives, Permissions-Policy, COOP/CORP, API `no-store`**. Closed v0.14.0. | XS | `[x]` |
| SEC-20 | **docx/xlsx archive-bomb limits**. Closed v0.14.0. | XS | `[x]` |
| SEC-21 | **Session eviction/cap, `AUTH_FAIL` audit, `/api/auth/setup` rate limit**. Closed v0.14.0. | XS | `[x]` |
| SEC-22 | **Raise master-password KDF cost**: **decided not to do as proposed (2026-11-17).** Raising 310k→600k buys only ~2× guessing cost, yet the iteration count is hard-coded in the vault (10 call sites incl. backup/restore/password-change), notes and auth-guard; changing it means a cross-store re-encryption migration with real lock-out risk. The meaningful upgrade is Argon2id (SEC-13), which needs a vendored WASM library and the same migration — revisit only as a dedicated, fully-tested feature. | M | `[-]` |
| SEC-23 | **Monaco bundles a vulnerable DOMPurify** (3.4.15; GHSA-cg2g-xh64-v4q7). Monaco 0.57.0 is the latest release and does not enable the affected option; DevSuite never gives it untrusted HTML. Blocked upstream — re-check when Monaco 0.58 ships, then bump `static/libs/vs` and re-add it to `package.json`. | M | `[ ]` |

---

## ✨ Feature

| # | Item | Effort | Status |
|---|---|---|---|
| FEAT-1 | **Color Studio**: Gradient generator, contrast checker, and palette exporter (HEX/HSL/RGB). | M | `[ ]` |
| FEAT-2 | **ID Generator**: Bulk UUIDs/ULIDs/CUIDs with entropy inspection. Shipped v0.6.0 as `/id-generator` (`specs/019-id-generator/`). | S | `[x]` |
| FEAT-3 | **Markdown Lab**: Real-time Monaco → rendered HTML preview for README testing. | M | `[ ]` |
| FEAT-4 | **JWT Debugger**: Full JWT decode/verify (HS256/RS256). Shipped as the JWT Inspector tab in Crypto Suite (`specs/007-crypto-suite/spec.md` US6). | M | `[x]` |
| FEAT-5 | **HTTP Mock Server**: declined 2026-11-17 — XL, needs a long-lived listener beyond the loopback-only/local-first model. Revisit only with a concrete need. | XL | `[-]` |
| FEAT-6 | **File Converter — more formats**: Image conversion (PNG/JPG/WebP/GIF/BMP/SVG/ICO) and XML ↔ JSON are shipped (see the converter's *Supported conversions* tiles); redesigned in `specs/027-file-converter-bento/`. | M | `[x]` |
| FEAT-7 | **Folder Diff — Streaming Zip Download**: still blocked on Firefox lacking `showSaveFilePicker` (needs a fallback design). | L | `[ ]` |
| FEAT-8 | **API Tester — masked environment secrets**: `secret` flag per env variable, masked in UI; phase 2 backs them with the Secret Vault (SPEC §13 v0.3.x). | M | `[ ]` |
| FEAT-9 | **API Tester — daily-driver v0.3.0 track**: Worker sandbox, collection runner, cURL import/code-gen, nested folders, cookie jar, zip export. Shipped v0.3.0 (SPEC §4.7.1–§4.7.6). | XL | `[x]` |
| FEAT-10 | **API Tester — sidebar request management** (Bruno gap #1): rename/duplicate/move/delete, drag-to-reorder. Shipped v0.3.0 (SPEC §4.7.4). | M | `[x]` |
| FEAT-11 | **API Tester — "honest proxy" slice** (Bruno gap #2): per-request skip-TLS-verify / timeout / redirect toggle; multipart file upload; binary-safe responses (base64 proxy mode, download button, image preview). | M | `[ ]` |
| FEAT-12 | **API Tester — OAuth2 authorization-code + PKCE** (Bruno gap #3): popup/redirect-capture flow for Auth0/Keycloak/Azure AD-style providers. | L | `[ ]` |
| FEAT-13 | **API Tester — CLI runner** (Bruno `bru run` equivalent): `python -m devsuite run <collection.zip> --env <name> --report junit.xml`; consumes the git-friendly zip (SPEC §13 v0.3.x #4). | L | `[ ]` |
| FEAT-14 | **API Tester — declarative assertions**: no-code assert rows (field/operator/value) compiled onto the sandbox `expect` engine. | S | `[ ]` |
| FEAT-15 | **API Tester — collection/folder-level variables** + folder-level cascading scripts, extending the folder-auth inheritance pattern. | M | `[ ]` |
| FEAT-16 | **WebSocket tester**: direct browser `ws:`/`wss:` connect, message log, subprotocols. Shipped v0.7.0 as `/ws-tester` (`specs/020-websocket-tester/`). | M | `[x]` |
| FEAT-17 | **API Tester — cheap parity wins**: code-gen for Python `requests`, axios and Go shipped v0.19.0. Remaining: Insomnia import, markdown docs field per request, collection-level default auth. | S | `[/]` |
| FEAT-18 | **SSH Terminal — optional session output logging**: per-tab "Log Output" toggle, bounded in-memory buffer, "Download Log" as plain text. Client-side only. Shipped v0.10.0 (`specs/009-secure-terminal-sftp/spec.md` FR-002a/SC-007). | S | `[x]` |

---

## 🐛 Bugfix

| # | Item | Effort | Status |
|---|---|---|---|
| BUG-1 | **DB Manager password-change locks out a v2 Vault**: closed 2026-11-17 by **removing the feature**. The "Database Password" card only rewrote the master-password challenge (fresh salt, v1 shape) without re-encrypting the vault, so any use orphaned encrypted data, and the advertised DB-file encryption had no backend endpoint (it is enabled with the `DEVDB_PASSWORD` env var). DevDB Manager now shows an info card pointing to Secret Vault → *Change Password*, which rotates the challenge and re-encrypts together. Guarded by `tests/python/test_backlog_fixes.py`. | S | `[x]` |
| BUG-2 | **SFTP upload has no feedback for the real (remote) transfer phase, and can't be cancelled**: `sftp_upload` (routes/ssh.py) buffers the whole file (`await file.read()`) then does one `await remote_file.write(...)` to the actual remote host — the slow part. The browser's `xhr.upload.onprogress` only measures the fast local browser→server leg, so the UI looked "finished" while the real transfer kept running silently. Fixed the *visibility* gap in this session (`static/ssh-manager.js`/`.html`, `specs/009-secure-terminal-sftp/spec.md` FR-012a/SC-006): a single reused per-file status toast now shows "sent to server — writing to remote via SFTP…" for that gap instead of one new auto-dismissing toast per progress tick (which used to visibly pile up), and the Upload button disables for the duration. **Not fixed**: the server still buffers the whole file in memory instead of streaming (unlike `sftp_download`'s 64 KB chunks), and there's no `request.is_disconnected()` check — closing the tab mid-upload doesn't stop the backend write. Proper fix needs chunked streaming + a real mid-transfer progress channel (HTTP alone can't push server-side progress back mid-request). | M | `[/]` |

---

## 🧑‍💻 Developer Experience (DX)

| # | Item | Effort | Status |
|---|---|---|---|
| DX-1 | **Automated Linting**: `ruff` (Python) with `ruff.toml`, a `.pre-commit-config.yaml` (ruff on commit; pytest + node tests on push) and a CI step — the codebase is ruff-clean. Remaining: `eslint` for `static/*.js` (needs a node toolchain decision, Constitution III). | S | `[/]` |
| DX-2 | **JS Modularization**: Split `app.js` into tool-specific modules (e.g., `diff-engine.js`, `tree-view.js`). | M | `[ ]` |
| DX-3 | **Hot Reload Sidecar**: `watchdog`-based reloader that refreshes the browser on file edits. | S | `[ ]` |
| DX-4 | **Lazy Loading**: Load Monaco Editor and heavy libs only when the user navigates to a relevant tool. | M | `[ ]` |
| DX-5 | **Accessibility (a11y)**: WCAG 2.1 AA delivered in features 023/024/028 — skip links, landmarks, focus ring, shared dialogs, live regions, contrast in 6 themes; axe-clean on every page. Remaining: manual screen-reader (VoiceOver/NVDA) testing. | M | `[/]` |
| DX-6 | **Playwright e2e Tests**: first slice shipped — `tests/e2e/smoke.py` loads every page and fails on JS errors / 4xx-5xx (it found three dead-feature bugs). Remaining: per-tool happy-path flows and CI wiring. | L | `[/]` |
| DX-10 | **JS unit test suite (node)**: Zero-dependency runner at `tests/javascript/run.js`. Bootstrapped v0.3.0; extend as more logic is extracted into pure modules (DX-2, AI-2/AI-3). | S | `[x]` |
| DX-7 | **Visual Regression**: Playwright screenshots across all themes to catch CSS regressions. | M | `[ ]` |
| DX-8 | **Large-File Benchmarking**: Stress tests for diffing files > 10,000 lines. | S | `[ ]` |
| DX-9 | **De-emoji UI chrome (§9.8/§9.9)**: done v0.19.0 — all pictographic emoji replaced by the shared stroke-icon set (`icons.js`) across every page; guarded by a test. (✓ ✗ ✕ ● are typographic symbols and allowed.) | M | `[x]` |

---

## 🗺️ Roadmap

| # | Item | Effort | Status |
|---|---|---|---|
| ROAD-1 | **CI/CD Pipeline**: `.github/workflows/tests.yml` now runs pytest (Py 3.10 + 3.12), `ruff`, `pip-audit`, `npm audit` (vendored libs) and a Docker build + health check. CodeQL runs separately. Remaining: eslint (DX-1), the e2e suite (DX-6). | S | `[/]` |
| ROAD-2 | **SonarQube CI Integration**: Wire `sonar-project.properties` into GitHub Actions for automated quality gate on every PR. v0.1.3 closed multiple S3776/S4666/S108 findings. | S | `[/]` |
| ROAD-3 | **Dockerization**: multi-stage `Dockerfile` (non-root, `/data` volume, healthcheck) and `docker-compose.yml` (loopback-only port, read-only FS, dropped caps) shipped; the image build is verified by the new `docker-build` CI job (not buildable in the authoring sandbox). | S | `[/]` |
| ROAD-4 | **PyPI Packaging**: blocked on a restructure — the backend is a flat layout (`main.py`, `deps.py`, `routes/`, `static/` at the repo root), so a wheel would install generically named top-level modules (`main`, `deps`). Needs a `devsuite/` package move (imports, tests, Docker, scripts) first; worth doing as its own spec. | M | `[ ]` |
| ROAD-5 | **GitHub Release Automation**: Auto-generate zip releases and update version tags on every release. | M | `[ ]` |
| ROAD-6 | **Homebrew Formula**: declined 2026-11-17 — covered by Docker (ROAD-3) and, later, PyPI (ROAD-4). | L | `[-]` |
| ROAD-7 | **Native App Wrapper (Tauri)**: declined 2026-11-17 — XL effort for a cosmetic wrapper around a `localhost` app. | XL | `[-]` |

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
