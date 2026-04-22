# SonarCloud Findings — `main` branch

> Pulled: 2026-04-22 (full API pull — hotspots + issues + quality gate) | Project: `Prabhakar-cg_devsuite` | Quality Gate: **FAILED**
> Previous fix session: 2026-04-19 (v0.1.3) | Baseline version date: 2026-03-29

## Sonar Exclusion Status (sonar-project.properties)

```
sonar.exclusions=static/libs/**,static/vendor/**,tests/**   ← current effective state (inferred)
sonar.security.exclusions=tests/**,static/libs/**
```

- `static/libs/**` → Monaco vendored JS: excluded ✅
- `tests/**` → Test JS: excluded ✅
- `scripts/**` → ❌ Not excluded — `scripts/check_updates.py` fully scanned
- `static/*.js` → ❌ Not excluded — JS findings active

---

## Summary (effective — post-scan 2026-04-22)

| Category | Count | Status |
|---|---|---|
| Security Hotspots | 2 (TO_REVIEW) | 🔴 Unreviewed — gate failing |
| BLOCKER Vulnerability (S2083 path injection) | 0 | ✅ Fixed since 2026-04-19 |
| Python (`scripts/check_updates.py`) | 0 | ✅ All resolved / not appearing |
| Python (`main.py` / `devdb.py`) | 0 | ✅ All resolved |
| JavaScript (first-party) | ~20 | 🔴 Active (exclusion still off) |
| Shell (`start.sh`) | 0 | ✅ Fixed since 2026-04-19 |
| HTML / Accessibility (S6819) | 3 | 🟡 Pending |
| CSS Contrast (S7924) | ~25 | 🟡 Pending |
| Tests | ✅ Excluded | No action needed |
| Vendored Libs | ✅ Excluded | No action needed |

**Quality Gate conditions:**
| Metric | Actual | Threshold | Status |
|---|---|---|---|
| Security Rating | A (1) | ≤ A | ✅ OK |
| New Security Hotspots Reviewed | 100% | 100% | ✅ OK |
| New Violations | 0 | 0 | ✅ OK |
| Reliability Rating | A (1) | ≤ C | ✅ OK |
| New Duplicated Lines | 2.2% | ≤ 3% | ✅ OK |
| **Security Hotspots Reviewed** | **0%** | **100%** | ❌ **FAIL** |

> Only 1 gate condition failing now — down from 4 on 2026-04-19. Sole blocker: the 2 existing hotspots have not been reviewed in the SonarCloud UI.

---

## 1. Security Hotspots — UNREVIEWED (Gate Failure)

| Severity | Rule | File | Line | Message | Status |
|---|---|---|---|---|---|
| LOW | python:S5042 | [scripts/check_updates.py](scripts/check_updates.py) | 376 | "Make sure that expanding this archive file is safe here." | TO_REVIEW |
| LOW | python:S5042 | [scripts/check_updates.py](scripts/check_updates.py) | 445 | "Make sure that expanding this archive file is safe here." | TO_REVIEW |

**Fix:** Go to SonarCloud → Security Hotspots → review both and mark **Safe** (extraction is from a trusted/controlled source) or **Acknowledged** / **Fix** if path traversal risk exists. This is the only action needed to pass the quality gate.

---

## 2. JavaScript (First-Party) — ACTIVE

### 2a. Cognitive Complexity (CRITICAL — S3776)

| File | Line | Complexity | Status |
|---|---|---|---|
| [static/cron.js](static/cron.js) | 528 | 21 → 15 | Open |
| [static/ssh-manager.js](static/ssh-manager.js) | 946 | 18 → 15 | Open |
| [static/file-converter.html](static/file-converter.html) | 1102 | 21 → 15 | Open |

> `ssh-manager.js:1142` resolved since last scan. ✅

### 2b. Nested Functions Too Deep (CRITICAL — S2004)

| File | Line | Message | Status |
|---|---|---|---|
| [static/ssh-manager.js](static/ssh-manager.js) | 352 | Functions nested >4 levels deep | Open |
| [static/regex.html](static/regex.html) | 398 | Functions nested >4 levels deep | Open |

### 2c. MAJOR Issues by File

**app.js**
| Line | Rule | Message |
|---|---|---|
| 572 | javascript:S6582 | Use optional chaining |
| 879 | javascript:S6582 | Use optional chaining |
| 1041 | javascript:S6582 | Use optional chaining |
| 1598 | javascript:S6582 | Use optional chaining |
| 1622 | javascript:S6660 | `if` should not be only statement in `else` block |

**ssh-manager.js**
| Line | Rule | Message |
|---|---|---|
| 188 | javascript:S7785 | Prefer top-level await over async IIFE |

> `S6582` at lines 599/773/782/788 resolved since last scan. ✅

**api-tester.js**
| Line | Rule | Message |
|---|---|---|
| 385 | javascript:S7785 | Prefer top-level await over async function call |

> `S1854` (useless assignment to `pwd`) resolved since last scan. ✅

### 2d. MINOR Issues

| File | Rule | Lines | Message |
|---|---|---|---|
| [static/app.js](static/app.js) | S7735 | 440, 441, 648, 878, 1040, 1519, 1580 | Unexpected negated condition |
| [static/app.js](static/app.js) | S7766 | 463, 464 | Prefer `Math.max()` over ternary |
| [static/app.js](static/app.js) | S7756 | 526 | Prefer `Blob#arrayBuffer()` |
| [static/cron.js](static/cron.js) | S1874 | 1132 | `document.execCommand` is deprecated |
| [static/base64.html](static/base64.html) | S7756 | 401 | Prefer `Blob#text()` over `FileReader#readAsText()` |
| [static/json.html](static/json.html) | S7735 | 209 | Unexpected negated condition |

> Resolved since last scan: `cron.js` S3358/S6582/S7762/S7764; `app.js` S7761/S7764; `api-tester.js` S1854; `devdb-client.js` S2486; `json.html` S1854/S7721; `url-shortener.html` S2486. ✅

---

## 3. HTML / Accessibility — PENDING

| Severity | Rule | File | Line | Status |
|---|---|---|---|---|
| MAJOR | Web:S6819 | [static/home.html](static/home.html) | 53 | `<div role="dialog">` → needs JS refactor to `<dialog>` |
| MAJOR | Web:S6819 | [static/tools.html](static/tools.html) | 117 | `<div role="dialog">` → needs JS refactor to `<dialog>` |
| MAJOR | Web:S6819 | [static/db-manager.html](static/db-manager.html) | 280 | `<div role="dialog">` → same pattern |

All three require replacing `<div role="dialog">` with `<dialog>` and updating JS from CSS class-toggle to `dialog.show()` / `dialog.close()`.

---

## 4. CSS — PENDING

### 4a. Contrast Ratio (MAJOR — S7924)

| File | Lines | Status |
|---|---|---|
| [static/home.css](static/home.css) | 1902 | Pending |
| [static/style.css](static/style.css) | 597, 619 | Pending |
| [static/vault.css](static/vault.css) | 129, 248, 402, 408, 413–417 | Pending |
| [static/db-manager.css](static/db-manager.css) | 252, 362 | Pending |
| [static/sftp-browser.css](static/sftp-browser.css) | 50, 92, 234, 273, 309, 494 | Pending |
| [static/ssh-manager.css](static/ssh-manager.css) | 127, 153, 348 | Pending |
| [static/ssh-manager.html](static/ssh-manager.html) | 170, 196, 210, 228 | Pending (196 new) |
| [static/file-converter.html](static/file-converter.html) | 310 | Pending |
| [static/api-tester.html](static/api-tester.html) | 30 | Pending |
| [static/regex.html](static/regex.html) | 87 | Pending |

---

## 5. Resolved Since Last Scan (2026-04-19) ✅

| Area | What Was Fixed |
|---|---|
| BLOCKER — `check_updates.py:104` S2083 | Path injection vulnerability — fixed |
| `scripts/check_updates.py` Python | S1192 (3× constants), S3776 (complexity at 241) — all gone |
| `main.py` S8415 HTTPException | No longer appearing |
| `start.sh` Shell | S7682 (×2 return), S1066 (merge if) — all gone |
| `ssh-manager.js` | S3776 at line 1142; S6582 at 599/773/782/788 |
| `cron.js` | S3358/S6582/S7762/S7764 — all gone |
| `app.js` | S7761 (dataset), S7764 (globalThis) |
| `api-tester.js` | S1854 useless assignment |
| `devdb-client.js` | S2486 exception handling |
| `json.html` | S1854, S7721 (×2) |
| `url-shortener.html` | S2486 (×4) |

---

## What To Do Next (Priority Order)

| Priority | Area | Action |
|---|---|---|
| **1 — GATE BLOCKER** | **Security Hotspots (§1)** | Review both `check_updates.py` S5042 hotspots in SonarCloud UI and mark as Safe/Acknowledged. This is the **only** action needed to pass the quality gate. |
| **2** | **JS Critical (§2a,b)** | Fix S3776 in `cron.js:528`, `ssh-manager.js:946`, `file-converter.html:1102`; fix S2004 nesting in `ssh-manager.js:352`, `regex.html:398` |
| **3** | **JS Major (§2c)** | Optional chaining in `app.js` (×4 S6582); top-level await in `ssh-manager.js:188` and `api-tester.js:385` |
| **4** | **CSS contrast (§4a)** | Work file by file — ~25 lines across 10 files |
| **5** | **HTML dialog (§3)** | Convert 3× `<div role="dialog">` to `<dialog>` in home.html, tools.html, db-manager.html |
