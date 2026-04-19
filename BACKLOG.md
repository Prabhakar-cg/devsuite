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
| SEC-3 | **CORS Hardening**: Explicitly configure `CORSMiddleware` in `main.py` to only allow `localhost` and `127.0.0.1`. | XS | `[ ]` |
| SEC-4 | **Rate Limiting**: Add `slowapi` to the backend to protect `/api/shorten` and `/upload` from local automated abuse. | S | `[ ]` |
| SEC-5 | **Subresource Integrity (SRI)**: Add hash checks to CDN-loaded scripts (RequireJS, js-yaml, papaparse, marked). | XS | `[ ]` |
| SEC-6 | **CSP Audit**: Tighten Content Security Policy in `main.py` where possible (e.g., removing `unsafe-eval` if Monaco allows). | M | `[ ]` |
| SEC-7 | **JS Sandboxing**: Use Web Workers for heavy JS logic (diffing, crypto) to isolate the UI thread. | L | `[ ]` |
| SEC-8 | **Vault Password Change**: Add a "Change Master Password" flow that re-encrypts all secrets with the new key. | M | `[ ]` |
| SEC-9 | **Vault Export / Backup**: Export vault entries as an encrypted backup file for disaster recovery. | S | `[ ]` |

---

## ✨ Feature

| # | Item | Effort | Status |
|---|---|---|---|
| FEAT-1 | **Color Studio**: Gradient generator, contrast checker, and palette exporter (HEX/HSL/RGB). | M | `[ ]` |
| FEAT-2 | **ID Generator**: Bulk generate UUIDs, ULIDs, and CUIDs with entropy inspection. | S | `[ ]` |
| FEAT-3 | **Markdown Lab**: Real-time Monaco → rendered HTML preview for README testing. | M | `[ ]` |
| FEAT-4 | **JWT Debugger**: Full JWT decode and verify tool (HS256/RS256) with signature validation. | M | `[ ]` |
| FEAT-5 | **HTTP Mock Server**: Define mock endpoints locally; replay canned JSON responses for frontend testing. | XL | `[ ]` |
| FEAT-6 | **File Converter — more formats**: Image format conversion (PNG ↔ JPG ↔ WebP) and XML ↔ JSON client-side. | M | `[ ]` |

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
| DX-7 | **Visual Regression**: Playwright screenshots across all themes to catch CSS regressions. | M | `[ ]` |
| DX-8 | **Large-File Benchmarking**: Stress tests for diffing files > 10,000 lines. | S | `[ ]` |

---

## 🗺️ Roadmap

| # | Item | Effort | Status |
|---|---|---|---|
| ROAD-1 | **CI/CD Pipeline**: GitHub Actions running linters, `pip-audit`, `npm audit`, and tests on every PR. Prerequisite for SEC-1, SEC-2, DX-6. | S | `[ ]` |
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
| Crypto Suite | |
| Link & QR Studio | |
| Local API Tester (HTTP Request Builder) | |
| Secure Terminal & SFTP | |
| Cron Visualizer | |
| Secret Vault | |
| DevDB Manager | |
| File Format Converter | |
