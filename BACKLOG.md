# DevSuite — Backlog

> This is a prioritized list of features and improvements to make DevSuite a "best-in-class" locally-hosted developer suite.

**Status legend**: `[ ]` Open · `[/]` In Progress · `[x]` Done · `[-]` Rejected

---

## 🔒 Security (Hardening)

| # | Item | Effort | Status |
|---|---|---|---|
| S-1 | **Audit & CVE Scanning**: Integrate `pip-audit` into the development workflow to scan dependencies before every release. | XS | `[ ]` |
| S-2 | **CORS Hardening**: Explicitly configure `CORSMiddleware` in `main.py` to only allow `localhost` and `127.0.0.1`. | XS | `[ ]` |
| S-3 | **Rate Limiting**: Add `slowapi` to the backend to protect `/api/shorten` and `/upload` from local automated abuse. | S | `[ ]` |
| S-4 | **Subresource Integrity (SRI)**: Add hash checks to CDN-loaded scripts (RequireJS, js-yaml, papaparse, marked). | XS | `[ ]` |
| S-5 | **CSP Audit**: Tighten Content Security Policy in `main.py` where possible (e.g., removing `unsafe-eval` if Monaco allows). | M | `[ ]` |
| S-6 | **JS Sandboxing**: Explore using Web Workers for heavy JS logic (like diffing) to keep the UI thread responsive and isolated. | L | `[ ]` |
| S-7 | **Vault Password Change**: Add a "Change Master Password" flow in the Vault that re-encrypts all secrets with the new key. | M | `[ ]` |
| S-8 | **Vault Export / Backup**: Allow exporting vault entries as an encrypted backup file for disaster recovery. | S | `[ ]` |

---

## 🧑‍💻 Developer Experience (DX)

| # | Item | Effort | Status |
|---|---|---|---|
| D-1 | **Automated Linting**: Set up `ruff` (Python) and `eslint` (JS) with a `pre-commit` hook to enforce highest standards. | S | `[ ]` |
| D-2 | **JS Modularization**: Split `app.js` into smaller, tool-specific modules (e.g., `diff-engine.js`, `tree-view.js`). | M | `[ ]` |
| D-3 | **Hot Reload Sidecar**: Add a `watchdog`-based reloader that automatically refreshes the browser window on file edits. | S | `[ ]` |
| D-4 | **Lazy Loading**: Only load Monaco Editor and heavy libraries when the user navigates to a relevant tool. | M | `[ ]` |
| D-5 | **Accessibility (a11y)**: Complete ARIA/Role audit and ensure keyboard-only navigation for all tools. Folder Diff picker buttons converted to `<label>` elements in v0.1.1 (partial). | M | `[/]` |
| D-6 | **File Converter — more formats**: Add image format conversion (PNG ↔ JPG ↔ WebP) and XML ↔ JSON client-side. | M | `[ ]` |

---

## 🧪 Testing & Reliability

| # | Item | Effort | Status |
|---|---|---|---|
| T-1 | **Playwright e2e tests**: Implement happy-path browser tests for every tool in the suite. | L | `[ ]` |
| T-2 | **Visual Regression**: Use Playwright to capture screenshots across all 6 themes to detect CSS regressions. | M | `[ ]` |
| T-3 | **CI/CD Pipeline**: Add GitHub Actions to run linters, security audits, and tests on every pull request. | S | `[ ]` |
| T-4 | **Large-File Benchmarking**: Add stress tests for diffing files > 10,000 lines to optimize performance. | S | `[ ]` |
| T-5 | **SonarQube CI Integration**: Wire `sonar-project.properties` (added in v0.1.1) into a GitHub Actions workflow for automated quality gate analysis on every PR. | S | `[ ]` |

---

## 📦 Distribution & Portability

| # | Item | Effort | Status |
|---|---|---|---|
| P-1 | **Dockerization**: Create a multi-stage `Dockerfile` and `docker-compose.yml` for zero-setup deployment. | S | `[ ]` |
| P-2 | **PyPI Packaging**: Add `pyproject.toml` to allow installation via `pip install devsuite` with a CLI entry point. | M | `[ ]` |
| P-3 | **GitHub Release Automation**: Script to auto-generate zip releases and update version tags on every release. | M | `[ ]` |
| P-4 | **Homebrew Formula**: Create a one-liner formula for macOS/Linux `brew` users. | L | `[ ]` |
| P-5 | **Native App Wrapper**: Evaluate Tauri for packaging DevSuite as a native OS app (`.app`, `.exe`). | XL | `[ ]` |

---

## ✨ New Tool Ideas

| # | Item | Effort | Status |
|---|---|---|---|
| N-1 | **Color Studio**: Gradient generator, contrast checker, and palette exporter (HEX/HSL/RGB). | M | `[ ]` |
| N-2 | **ID Generator**: Bulk generate UUIDs, ULIDs, and CUIDs with entropy inspection. | S | `[ ]` |
| N-3 | **Markdown Lab**: Real-time Monaco → Rendered HTML preview for README testing. | M | `[ ]` |
| N-4 | **JWT Debugger**: Full JWT decode and verify tool (HS256/RS256) — standalone page with signature validation. | M | `[ ]` |
| N-5 | **HTTP Mock Server**: Define mock endpoints locally; replay canned JSON responses for frontend testing. | XL | `[ ]` |
| N-6 | **Diff Checker** | — | `[x]` Done |
| N-7 | **JSON Linter** | — | `[x]` Done |
| N-8 | **YAML Linter** | — | `[x]` Done |
| N-9 | **Regex Tester** | — | `[x]` Done |
| N-10 | **Crypto Suite** | — | `[x]` Done |
| N-11 | **Link & QR Studio** | — | `[x]` Done |
| N-12 | **Local API Tester (HTTP Request Builder)** | — | `[x]` Done |
| N-13 | **Secure Terminal & SFTP** | — | `[x]` Done |
| N-14 | **Cron Visualizer** | — | `[x]` Done |
| N-15 | **Secret Vault** | — | `[x]` Done |
| N-16 | **DevDB Manager** | — | `[x]` Done |
| N-17 | **File Format Converter** | — | `[x]` Done |

---

## Effort Scale
`XS` < 1 hr · `S` 1–3 hrs · `M` 3–8 hrs · `L` 1–2 days · `XL` 2+ days
