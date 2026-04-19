# SonarCloud Findings — `main` branch

> Pulled: 2026-04-19 | Project: `Prabhakar-cg_devsuite` | Quality Gate: **FAILED**
> Previous fix session: 2026-04-19 (v0.1.3) | Baseline version date: 2026-03-29

## Sonar Exclusion Status (sonar-project.properties)

> ⚠️ The API reports **no exclusions active** on the project. JS files are now being scanned.
> Previous `static/*.js` exclusion is no longer in effect — all `static/` JS findings below are live.

```
sonar.exclusions=static/libs/**,static/vendor/**,tests/**   ← current effective state (inferred)
sonar.security.exclusions=tests/**,static/libs/**
```

- `static/libs/**` → Monaco vendored JS: status unclear (hotspots for check_updates.py now appearing)
- `static/*.js` → ❌ **No longer excluded** — JS findings are active again
- `tests/**` → Test JS: likely still excluded (no test findings in scan)
- `scripts/**` → ❌ **Not excluded** — `scripts/check_updates.py` fully scanned

---

## Summary (effective — post-scan 2026-04-19)

| Category | Count | Status |
|---|---|---|
| Security Hotspots | 2 (TO_REVIEW) | 🔴 Unreviewed — gate failing |
| BLOCKER Vulnerabilities | 1 | 🔴 New — path injection in check_updates.py |
| Python (`main.py` / `devdb.py`) | 1 | 🟡 S8415 HTTPException doc pending |
| Python (`scripts/check_updates.py`) | 5 | 🔴 New file — all open |
| JavaScript (first-party) | ~40 | 🔴 Exclusion gone — now active |
| Shell (`start.sh`) | 3 | 🔴 New |
| HTML / Accessibility (S6819) | 3 | 🟡 Pending |
| CSS Contrast (S7924) | ~30 | 🟡 Expanded (many new files) |
| Tests | ✅ Excluded | No action needed |
| Vendored Libs | ✅ Excluded | No action needed |

**Quality Gate conditions failing:**
| Metric | Actual | Threshold | Status |
|---|---|---|---|
| Security Rating | E (5) | Must be ≥ A | ❌ FAIL |
| New Security Hotspots Reviewed | 0% | 100% | ❌ FAIL |
| New Violations | 78 | 0 | ❌ FAIL |
| Security Hotspots Reviewed | 0% | 100% | ❌ FAIL |
| Reliability Rating | A (1) | ≤ C | ✅ OK |
| New Duplicated Lines | 2.0% | ≤ 3% | ✅ OK |

---

## 1. Security Hotspots — UNREVIEWED (Gate Failure)

> Was excluded via `static/libs/**`; now `scripts/check_updates.py` has 2 new hotspots that are unreviewed and directly causing the quality gate to fail.

| Severity | Rule | File | Line | Message | Status |
|---|---|---|---|---|---|
| LOW | python:S5042 | [scripts/check_updates.py](scripts/check_updates.py) | 355 | "Make sure that expanding this archive file is safe here." | TO_REVIEW |
| LOW | python:S5042 | [scripts/check_updates.py](scripts/check_updates.py) | 421 | "Make sure that expanding this archive file is safe here." | TO_REVIEW |

**Fix:** Review both hotspots in SonarCloud UI and mark as **Safe** (if tar extraction is from a trusted source) or **Fix** (add path validation). Marking as reviewed will unblock `new_security_hotspots_reviewed` and `security_hotspots_reviewed` gate conditions.

---

## 2. BLOCKER Vulnerability — `scripts/check_updates.py`

| Severity | Rule | File | Line | Message |
|---|---|---|---|---|
| BLOCKER | pythonsecurity:S2083 | [scripts/check_updates.py](scripts/check_updates.py) | 104 | "Change this code to not construct the path from user-controlled data." |

**Fix:** Validate/sanitize the user-controlled input before using it in `os.path.join()` or equivalent path construction. Use `os.path.abspath()` + check it stays within allowed base directory.

---

## 3. Python Backend

### 3a. `scripts/check_updates.py` — ALL OPEN (New File)

| Severity | Rule | Line | Message |
|---|---|---|---|
| CRITICAL | python:S1192 | 23 | Define constant for `'static/libs/vs'` (used 4×) |
| CRITICAL | python:S1192 | 49 | Define constant for version regex `r'\b([0-9]+\.[0-9]+\.[0-9]+)\b'` (used 3×) |
| CRITICAL | python:S3776 | 241 | Cognitive Complexity 29 → 15 (refactor function) |
| CRITICAL | python:S1192 | 261 | Define constant for `'[untracked]'` (used 3×) |

### 3b. `main.py` and `devdb.py` — Previously Fixed

| Rule | Status |
|---|---|
| S1192 — Duplicate literals | ✅ Fixed (v0.1.3) |
| S3776 — Cognitive Complexity | ✅ Fixed (v0.1.3) |
| S5754 — Bare except | ✅ Fixed |
| S108 — Empty except blocks | ✅ Fixed |
| S6353 — Regex char class | ✅ Fixed |

### 3c. `main.py` — S8415 HTTPException (MAJOR) — PENDING

| Line | Code | Status |
|---|---|---|
| 207 | `_serve_html` raises 404 | Pending — add `# NOSONAR` or document in route `responses=` |

Remaining undocumented raises are in helper functions. All route-level 500/503/400/401/413/404/409 responses are documented. Helper-level raises are the only remaining gap.

---

## 4. JavaScript (First-Party) — ACTIVE (Exclusion Removed)

> `static/*.js` is no longer excluded. All JS findings below are live in the scan.

### 4a. Cognitive Complexity (CRITICAL — S3776)

| File | Line | Complexity | Status |
|---|---|---|---|
| [static/cron.js](static/cron.js) | 528 | 21 → 15 | Open |
| [static/ssh-manager.js](static/ssh-manager.js) | 946 | 18 → 15 | Open |
| [static/ssh-manager.js](static/ssh-manager.js) | 1142 | 23 → 15 | Open |
| [static/file-converter.html](static/file-converter.html) | 1102 | 21 → 15 | Open |

### 4b. Nested Functions Too Deep (CRITICAL — S2004)

| File | Line | Message | Status |
|---|---|---|---|
| [static/ssh-manager.js](static/ssh-manager.js) | 352 | Functions nested >4 levels deep | Open |
| [static/regex.html](static/regex.html) | 398 | Functions nested >4 levels deep | Open |

### 4c. MAJOR Issues by File

**cron.js**
| Line | Rule | Message |
|---|---|---|
| 1007 | javascript:S3358 | Extract nested ternary into independent statement |
| 1115 | javascript:S6582 | Use optional chaining |
| 1132 | javascript:S7762 | Prefer `childNode.remove()` over `parentNode.removeChild()` |

**ssh-manager.js**
| Line | Rule | Message |
|---|---|---|
| 599 | javascript:S6582 | Use optional chaining |
| 773 | javascript:S6582 | Use optional chaining |
| 782 | javascript:S6582 | Use optional chaining |
| 788 | javascript:S6582 | Use optional chaining |

**app.js**
| Line | Rule | Message |
|---|---|---|
| 567 | javascript:S7761 | Prefer `.dataset` over `getAttribute(…)` |
| 569 | javascript:S6582 | Use optional chaining |
| 588 | javascript:S7761 | Prefer `.dataset` over `getAttribute(…)` |
| 880 | javascript:S6582 | Use optional chaining |
| 922 | javascript:S6582 | Use optional chaining |
| 1477 | javascript:S6582 | Use optional chaining |
| 1501 | javascript:S6660 | `if` should not be only statement in `else` block |

**api-tester.js**
| Line | Rule | Message |
|---|---|---|
| 380 | javascript:S1854 | Remove useless assignment to `pwd` |
| 387 | javascript:S7785 | Prefer top-level await over async `initApp()` call |

**json.html**
| Line | Rule | Message |
|---|---|---|
| 157 | javascript:S1854 | Remove useless assignment to `outputEditor` |
| 218 | javascript:S7721 | Move `parseJson` to outer scope |
| 226 | javascript:S7721 | Move `sortKeysDeep` to outer scope |

### 4d. MINOR Issues

| File | Rule | Lines | Message |
|---|---|---|---|
| [static/app.js](static/app.js) | S7735 | 438, 439, 645, 879, 921, 1398, 1459 | Unexpected negated condition |
| [static/app.js](static/app.js) | S7764 | 1474, 1522 | Prefer `globalThis` over `window` |
| [static/app.js](static/app.js) | S7766 | 461, 462 | Prefer `Math.max()` over ternary |
| [static/app.js](static/app.js) | S7756 | 523 | Prefer `Blob#arrayBuffer()` |
| [static/ssh-manager.js](static/ssh-manager.js) | S7735 | 1163, 1185, 1204, 1264 | Unexpected negated condition |
| [static/cron.js](static/cron.js) | S1874 | 1131 | `document.execCommand` is deprecated |
| [static/cron.js](static/cron.js) | S7764 | 1164 | Prefer `globalThis` over `window` |
| [static/api-tester.js](static/api-tester.js) | S1481 | 380 | Remove unused `pwd` variable |
| [static/devdb-client.js](static/devdb-client.js) | S2486 | 35, 111 | Handle or don't catch exception |
| [static/json.html](static/json.html) | S7735 | 191 | Unexpected negated condition |
| [static/base64.html](static/base64.html) | S7756 | 401 | Prefer `Blob#text()` over `FileReader#readAsText()` |
| [static/url-shortener.html](static/url-shortener.html) | S2486 | 389–391, 400–402 | Handle or don't catch exception |
| [static/home.html](static/home.html) | S7764 | 15×2, 17, 18×2, 528×2, 535 (8×) | Prefer `globalThis` over `window` |
| [static/tools.html](static/tools.html) | S7764 | 15×2, 18, 19×2, 797×2, 805 (8×) | Prefer `globalThis` over `window` |

---

## 5. Shell (`start.sh`) — NEW

| Severity | Rule | Line | Message |
|---|---|---|---|
| MAJOR | shelldre:S7682 | 13 | Add explicit `return` statement at end of function |
| MAJOR | shelldre:S7682 | 121 | Add explicit `return` statement at end of function |
| MAJOR | shelldre:S1066 | 233 | Merge this `if` with enclosing one |

---

## 6. HTML / Accessibility — PENDING

| Severity | Rule | File | Line | Status |
|---|---|---|---|---|
| MAJOR | Web:S6819 | [static/home.html](static/home.html) | 53 | `<div role="dialog">` → needs JS refactor to `<dialog>` |
| MAJOR | Web:S6819 | [static/tools.html](static/tools.html) | 117 | `<div role="dialog">` → needs JS refactor to `<dialog>` |
| MAJOR | Web:S6819 | [static/db-manager.html](static/db-manager.html) | 280 | `<div role="dialog">` → same pattern — NEW |

**Note:** `tools.html:240` (`role="radiogroup"`) is no longer in the scan (fixed or resolved).

All three require replacing `<div role="dialog">` with `<dialog>` and updating JS from CSS class-toggle to `dialog.show()` / `dialog.close()`.

---

## 7. CSS — PENDING (Significantly Expanded)

### 7a. Contrast Ratio (MAJOR — S7924)

Many new files added since last scan. All need contrast increased to WCAG AA (4.5:1 for normal text).

| File | Lines | Status |
|---|---|---|
| [static/home.css](static/home.css) | 1902 | Pending |
| [static/style.css](static/style.css) | 597, 619 | Pending |
| [static/vault.css](static/vault.css) | 129 (**new**), 248, 402, 408 (**new**), 413–417 | Pending |
| [static/db-manager.css](static/db-manager.css) | 252, 362 | **New** — Pending |
| [static/sftp-browser.css](static/sftp-browser.css) | 50, 92, 234, 273, 309, 494 | **New** — Pending |
| [static/ssh-manager.css](static/ssh-manager.css) | 127, 153, 348 | **New** — Pending |
| [static/ssh-manager.html](static/ssh-manager.html) | 170 (**new**), 210 | Pending (line 228 from prior scan resolved) |
| [static/file-converter.html](static/file-converter.html) | 310 | Pending |
| [static/api-tester.html](static/api-tester.html) | 30 | **New** — Pending |
| [static/regex.html](static/regex.html) | 87 | **New** — Pending |

### 7b. Duplicate Selectors (MAJOR — S4666) ✅ FIXED

| File | Selector | Status |
|---|---|---|
| [static/style.css](static/style.css) | `.editor-host` | ✅ Fixed (v0.1.3) |
| [static/home.css](static/home.css) | `.nav-active`, `.feat-card`, etc. | ✅ Not appearing in current scan |

### 7c. Empty Blocks (MAJOR — S4658) ✅ RESOLVED

Not appearing in current scan. Either fixed or sonar-project.properties change affected this.

---

## 8. Tests ✅ EXCLUDED FROM SCAN

`tests/**` exclusion in effect. No test findings in current scan.

---

## 9. Vendored Libs ✅ EXCLUDED FROM SCAN

`static/libs/**` exclusion in effect for Monaco. No vendored findings.

---

## What To Do Next (Priority Order)

| Priority | Area | Action |
|---|---|---|
| **1 — GATE BLOCKER** | **Security Hotspots (§1)** | Go to SonarCloud → Security Hotspots → review both `check_updates.py` S5042 hotspots and mark as Safe or Fix. This unblocks the two hotspot gate conditions immediately. |
| **2 — GATE + BLOCKER** | **Path injection (§2)** | Fix `check_updates.py:104` S2083 — validate path before construction from user input |
| **3** | **JS exclusion (§4)** | Decide: re-add `static/*.js` to `sonar.exclusions` to silence ~40 JS issues, OR fix the CRITICAL ones (S3776×4, S2004×2) and suppress the rest |
| **4** | **`check_updates.py` Python (§3a)** | Extract 3 string constants (S1192) and refactor the complex function at line 241 (S3776) |
| **5** | **Shell `start.sh` (§5)** | Add `return` to functions at lines 13 and 121; merge `if` at line 233 |
| **6** | **CSS contrast (§7a)** | Expand from previous 9 lines to ~25 lines across 10 files — work file by file starting with `home.css:1902`, `style.css:597+619` |
| **7** | **HTML dialog (§6)** | Convert 3× `<div role="dialog">` to `<dialog>` in home.html, tools.html, db-manager.html |
| **8** | **S8415 HTTPException (§3c)** | Add `# NOSONAR` to `_serve_html:207` |
