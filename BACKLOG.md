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
| S-4 | **Subresource Integrity (SRI)**: Add hash checks to all CDN-loaded scripts (RequireJS, Highlight.js, js-yaml). | XS | `[ ]` |
| S-5 | **Secure Data Storage**: Move `url_db.json` from project root to a more secure system path (e.g., `~/.local/share/devsuite/`). | S | `[ ]` |
| S-6 | **CSP Audit**: Tighten Content Security Policy in `main.py` where possible (e.g., removing `unsafe-eval` if Monaco allows). | M | `[ ]` |
| S-7 | **JS Sandboxing**: Explore using Web Workers for heavy JS logic (like diffing) to keep the UI thread responsive and isolated. | L | `[ ]` |

---

## 🧑‍💻 Developer Experience (DX)

| # | Item | Effort | Status |
|---|---|---|---|
| D-1 | **Automated Linting**: Set up `ruff` (Python) and `eslint` (JS) with a `pre-commit` hook to enforce highest standards. | S | `[ ]` |
| D-2 | **JS Modularization**: Split `app.js` into smaller, tool-specific modules (e.g., `diff-engine.js`, `tree-view.js`). | M | `[ ]` |
| D-3 | **Hot Reload Sidecar**: Add a `watchdog`-based reloader that automatically refreshes the browser window on file edits. | S | `[ ]` |
| D-4 | **Component Library**: Consolidate UI elements (toasts, headers, theme pickers) into a shared `components.js`. | M | `[ ]` |
| D-5 | **Lazy Loading**: Only load Monaco Editor and heavy libraries when the user navigates to a relevant tool. | M | `[ ]` |
| D-6 | **Accessibility (a11y)**: Complete ARIA/Role audit and ensure keyboard-only navigation for all tools. | M | `[ ]` |

---

## 🧪 Testing & Reliability

| # | Item | Effort | Status |
|---|---|---|---|
| T-1 | **Playwright e2e tests**: Implement happy-path browser tests for every tool in the suite. | L | `[ ]` |
| T-2 | **Visual Regression**: Use Playwright to capture screenshots across all 4 themes to detect CSS regressions. | M | `[ ]` |
| T-3 | **CI/CD Pipeline**: Add GitHub Actions to run linters, security audits, and tests on every pull request. | S | `[ ]` |
| T-4 | **Large-File Benchmarking**: Add stress tests for diffing files > 10,000 lines to optimize performance. | S | `[ ]` |

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
| N-1 | **JWT Debugger**: Decode and verify JWTs client-side (no data leaks). | M | `[ ]` |
| N-2 | **Cron Visualizer**: Enter a cron string and see a human-readable description and next run times. | S | `[ ]` |
| N-3 | **Color Studio**: Gradient generator, contrast checker, and palette exporter (HEX/HSL/RGB). | M | `[ ]` |
| N-4 | **ID Generator**: Bulk generate UUIDs, ULIDs, and CUIDs with entropy inspection. | S | `[ ]` |
| N-5 | **Markdown Lab**: Real-time Monaco → Rendered HTML preview for README testing. | M | `[ ]` |
| N-6 | **HTTP Request Builder**: Lightweight, local-only tool for testing APIs without an external client. | XL | `[ ]` |

---

## Effort Scale
`XS` < 1 hr · `S` 1–3 hrs · `M` 3–8 hrs · `L` 1–2 days · `XL` 2+ days

