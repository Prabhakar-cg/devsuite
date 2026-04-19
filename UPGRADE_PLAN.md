# Library Upgrade Plan

> Last reviewed: 2026-04-19

## Cadence

| Type | Frequency | Trigger |
|---|---|---|
| Security patches | Immediately | CVE alert or `pip-audit` finding |
| Patch versions (x.x.N) | Monthly | First Monday of the month |
| Minor versions (x.N.0) | Quarterly | Start of each quarter |
| Major versions (N.0.0) | Per-release | Manual review — check breaking changes |
| Vendored JS libs | Quarterly | Same as minor, plus any security advisory |

---

## Library Inventory

### Python — `requirements.txt`

| Package | Current Constraint | Notes |
|---|---|---|
| fastapi | `>=0.136.0` | Core web framework |
| uvicorn[standard] | `>=0.44.0` | ASGI server |
| python-multipart | `~=0.0.26` | File upload parsing |
| asyncssh | `>=2.22.0` | SSH/SFTP backend |
| cryptography | `>=46.0.7` | Security-critical — prioritize patches |
| websockets | `>=16.0` | WebSocket support |
| wsproto | `>=1.3.2` | WebSocket protocol |
| openpyxl | `>=3.1.5` | Excel read/write |
| pypdf | `>=6.10.2` | PDF processing |
| python-docx | `>=1.2.0` | Word doc processing |
| mammoth | `>=1.12.0` | DOCX → HTML conversion |
| weasyprint | `>=68.1` | HTML → PDF rendering |
| markdown | `>=3.10.2` | Markdown parsing |

### Vendored JavaScript — `static/`

> These are bundled files committed directly. Upgrades require manual download and replacement.

| File | Library | Known Version | CDN / Source |
|---|---|---|---|
| `static/xterm.js` | xterm.js | unknown | [npmjs xterm](https://www.npmjs.com/package/xterm) |
| `static/xterm-addon-fit.js` | xterm-addon-fit | unknown | [npmjs xterm-addon-fit](https://www.npmjs.com/package/xterm-addon-fit) |
| `static/crypto-js.min.js` | CryptoJS | unknown | [npmjs crypto-js](https://www.npmjs.com/package/crypto-js) |
| `static/bwip-js-min.js` | bwip-js | unknown | [npmjs bwip-js](https://www.npmjs.com/package/bwip-js) |

### Vendored JavaScript — `static/libs/`

| File | Library | Known Version | CDN / Source |
|---|---|---|---|
| `static/libs/highlight.min.js` | highlight.js | unknown | [npmjs highlight.js](https://www.npmjs.com/package/highlight.js) |
| `static/libs/marked.min.js` | marked | unknown | [npmjs marked](https://www.npmjs.com/package/marked) |
| `static/libs/papaparse.min.js` | PapaParse | unknown | [npmjs papaparse](https://www.npmjs.com/package/papaparse) |
| `static/libs/js-yaml.min.js` | js-yaml | 4.1.0 → **4.1.1 available** | [npmjs js-yaml](https://www.npmjs.com/package/js-yaml) |
| `static/libs/require.min.js` | RequireJS | 2.3.6 → **2.3.8 available** | [requirejs.org](https://requirejs.org/docs/download.html) |
| `static/libs/vs/` | Monaco Editor | 0.45.0 → **0.55.1 available** | [npmjs monaco-editor](https://www.npmjs.com/package/monaco-editor) |

> **Action:** Run `scripts/check_updates.py` to populate missing version numbers for vendored JS files.

---

## Upgrade Process

### Step 1 — Check (run `scripts/check_updates.py`)

```bash
cd devsuite
python scripts/check_updates.py
```

This will:
- Compare installed Python packages against latest on PyPI
- Flag any packages with known CVEs (via `pip-audit` if installed)
- Print current vs latest for each vendored JS lib via npm registry

### Step 2 — Review

For each flagged package:
1. Read the changelog / release notes
2. Check for breaking changes (especially for major versions)
3. Check if any open issues affect DevSuite's usage pattern

Key packages to review carefully:
- **fastapi** — router/middleware API changes are common across minors
- **asyncssh** — auth and key-format changes affect SSH/SFTP features
- **cryptography** — may require OpenSSL version bump on the host
- **weasyprint** — CSS rendering behavior can change subtly
- **Monaco Editor** — largest vendored dep, significant bundle size impact on upgrade

### Step 3 — Update Python

```bash
# Update requirements.txt constraints, then:
pip install -r requirements.txt --upgrade

# Verify no dependency conflicts
pip check

# Security audit
pip-audit  # install with: pip install pip-audit
```

### Step 4 — Update Vendored JS

For each JS library being upgraded:

```bash
# Download the minified build from CDN or npm
npm pack <library>@<new-version>  # or download from jsDelivr

# Replace the file in static/ or static/libs/
cp new-file.min.js static/libs/old-file.min.js

# Update the version in UPGRADE_PLAN.md Known Version column
```

For **Monaco Editor** specifically:
```bash
npm install monaco-editor@<version>
cp -r node_modules/monaco-editor/min/vs static/libs/vs
```

### Step 5 — Test

Run through this checklist after every upgrade:

**Automated:**
```bash
python -m pytest
```

**Manual golden path:**
- [ ] App loads, login works
- [ ] SSH connection + terminal works (xterm.js)
- [ ] SFTP browser — browse, upload, download
- [ ] DB Manager — connect, query, results render
- [ ] Vault — create/read/delete entries (crypto-js)
- [ ] File Converter — PDF, DOCX, XLSX conversion (weasyprint, pypdf, python-docx, openpyxl)
- [ ] Code editor loads and highlights (Monaco Editor, highlight.js)
- [ ] Cron expression builder renders (cron.js)
- [ ] API Tester — send request, view response
- [ ] YAML/JSON tools (js-yaml, papaparse)
- [ ] Markdown preview (marked)

### Step 6 — Commit

```bash
git add requirements.txt static/libs/ static/xterm*.js static/crypto-js.min.js static/bwip-js-min.js
git commit -m "chore: upgrade third-party libraries - <month> <year>"
```

Update the **Known Version** columns in this file and the **Last reviewed** date at the top.

---

## Security-Only Fast Track

If a CVE is reported for any library, skip Steps 1–2 and go straight to patch:

```bash
pip install <package>==<patched-version>
pip-audit  # confirm clean
python -m pytest
# manual test for the affected feature only
git commit -m "fix: patch <package> for CVE-XXXX-XXXXX"
```

For vendored JS CVEs (e.g., a CryptoJS or xterm.js advisory), also check if the vulnerability is exploitable in DevSuite's local-only, offline-first context before treating as critical.

---

## Tools

| Tool | Install | Purpose |
|---|---|---|
| `pip-audit` | `pip install pip-audit` | CVE scanning for Python deps |
| `scripts/check_updates.py` | (included) | Automated version diff report |
| [jsDelivr](https://www.jsdelivr.com/) | web | CDN source for JS lib downloads |
| [deps.dev](https://deps.dev/) | web | Dependency graph and vulnerability lookup |
