# SonarCloud Findings — `main` branch

> Pulled: 2026-04-25 (full API pull — hotspots + issues + quality gate) | Project: `Prabhakar-cg_devsuite` | Quality Gate: **FAILED**
> Previous pull: 2026-04-22 | Baseline version date: 2026-04-19

## Sonar Exclusion Status (sonar-project.properties)

```
sonar.exclusions=static/libs/**,static/vendor/**,tests/**
sonar.security.exclusions=tests/**,static/libs/**
```

- `static/libs/**` → Monaco vendored JS: excluded ✅
- `tests/**` → Test JS: excluded ✅
- `scripts/**` → ❌ Not excluded — `scripts/check_updates.py` fully scanned
- `static/*.js` → ❌ Not excluded — JS findings active

---

## Summary (effective — post-scan 2026-04-25)

| Category | Count | Status |
|---|---|---|
| Security Hotspots (TO_REVIEW) | 3 | 🔴 Unreviewed — gate failing |
| BLOCKER (S2703 implicit global) | 1 | 🔴 `db-manager.js:188` |
| VULNERABILITY (S2092 cookie) | 2 | 🔴 NEW since 2026-04-19 |
| JS Critical (S3776 complexity) | 4 | 🔴 Active |
| JS Critical (S2004 nesting) | 2 | 🔴 Active |
| JS Major (S6582, S6660, S7785) | 7 | 🟡 Active |
| JS Minor (S6594, S7735, S7756, S7766, S1874) | 16 | 🟡 Active |
| HTML / Accessibility (S6819) | 3 | 🟡 Active |
| CSS Contrast (S7924) | 30 | 🟡 Active |
| **Total active issues** | **67** | |

**Quality Gate conditions:**
| Metric | Actual | Threshold | Status |
|---|---|---|---|
| Reliability Rating | A (1) | ≤ C (3) | ✅ OK |
| **Security Rating** | **B (2)** | **≤ A (1)** | ❌ **FAIL** |
| New Duplicated Lines | 1.5% | ≤ 3% | ✅ OK |
| **New Security Hotspots Reviewed** | **0%** | **100%** | ❌ **FAIL** |
| **New Violations** | **8** | **0** | ❌ **FAIL** |
| **Security Hotspots Reviewed** | **0%** | **100%** | ❌ **FAIL** |

> 4 gate conditions failing. Security Rating dropped from A → B due to new S2092 (cookie `secure` flag) vulnerabilities in `main.py`. 8 new violations introduced since 2026-04-19.

---

## 1. Security Hotspots — UNREVIEWED (Gate Failure)

| Severity | Rule | File | Line | Message | Status |
|---|---|---|---|---|---|
| LOW | python:S3330 | [main.py](main.py) | 1327 | "Make sure creating this cookie without the 'HttpOnly' flag is safe." | TO_REVIEW ⚠️ NEW |
| LOW | python:S5042 | [scripts/check_updates.py](scripts/check_updates.py) | 398 | "Make sure that expanding this archive file is safe here." | TO_REVIEW |
| LOW | python:S5042 | [scripts/check_updates.py](scripts/check_updates.py) | 467 | "Make sure that expanding this archive file is safe here." | TO_REVIEW |

**Fix:** Go to SonarCloud → Security Hotspots → review all 3. Mark S5042 entries as **Safe** (trusted archive source). Evaluate S3330 — mark **Safe** if the cookie doesn't need to be HttpOnly, or fix by adding `httponly=True`. This addresses two gate conditions: `security_hotspots_reviewed` and `new_security_hotspots_reviewed`.

---

## 2. Vulnerabilities — ACTIVE (Gate Failure)

### 2a. Cookie Without `secure` Flag (MINOR — S2092) ⚠️ NEW

| File | Line | Message | Status |
|---|---|---|---|
| [main.py](main.py) | 1322 | "Make sure creating this cookie without the 'secure' flag is safe." | NEW ⚠️ |
| [main.py](main.py) | 1327 | "Make sure creating this cookie without the 'secure' flag is safe." | NEW ⚠️ |

> These 2 new MINOR vulnerabilities caused the Security Rating to drop from A → B, failing the `security_rating ≤ A` gate condition. Fix: add `secure=True` to the cookie responses at `main.py:1322` and `main.py:1327`, or suppress if intentionally serving over HTTP only.

---

## 3. JavaScript (First-Party) — ACTIVE

### 3a. BLOCKER — Implicit Global Variable (S2703)

| File | Line | Message | Status |
|---|---|---|---|
| [static/db-manager.js](static/db-manager.js) | 188 | Add "let", "const" or "var" keyword to declaration of `_serverToken` | 🔴 Active |

### 3b. Cognitive Complexity (CRITICAL — S3776)

| File | Line | Complexity | Status |
|---|---|---|---|
| [static/vault.js](static/vault.js) | 236 | 21 → 15 | 🔴 NEW ⚠️ |
| [static/cron.js](static/cron.js) | 528 | 21 → 15 | 🔴 Active |
| [static/ssh-manager.js](static/ssh-manager.js) | 947 | 18 → 15 | 🔴 Active |
| [static/file-converter.html](static/file-converter.html) | 1102 | 21 → 15 | 🔴 Active |

### 3c. Nested Functions Too Deep (CRITICAL — S2004)

| File | Line | Message | Status |
|---|---|---|---|
| [static/ssh-manager.js](static/ssh-manager.js) | 353 | Functions nested >4 levels deep | 🔴 Active |
| [static/regex.html](static/regex.html) | 398 | Functions nested >4 levels deep | 🔴 Active |

### 3d. MAJOR Issues

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
| 189 | javascript:S7785 | Prefer top-level await over async IIFE |

**api-tester.js**
| Line | Rule | Message |
|---|---|---|
| 385 | javascript:S7785 | Prefer top-level await over async function call |

### 3e. MINOR Issues

**app.js**
| Lines | Rule | Message |
|---|---|---|
| 440, 441, 648, 878, 1040, 1519, 1580 | javascript:S7735 | Unexpected negated condition |
| 463, 464 | javascript:S7766 | Prefer `Math.max()` to simplify ternary |
| 526 | javascript:S7756 | Prefer `Blob#arrayBuffer()` over `FileReader#readAsArrayBuffer()` |

**Other JS files — S6594 (RegExp.exec) ⚠️ NEW**
| File | Line | Message |
|---|---|---|
| [static/db-manager.js](static/db-manager.js) | 22 | Use `RegExp.exec()` instead of `String.match()` |
| [static/devdb-client.js](static/devdb-client.js) | 19 | Use `RegExp.exec()` instead of `String.match()` |
| [static/sftp-browser.js](static/sftp-browser.js) | 40 | Use `RegExp.exec()` instead of `String.match()` |
| [static/ssh-manager.js](static/ssh-manager.js) | 58 | Use `RegExp.exec()` instead of `String.match()` |
| [static/vault.js](static/vault.js) | 71 | Use `RegExp.exec()` instead of `String.match()` |

**Other**
| File | Line | Rule | Message |
|---|---|---|---|
| [static/cron.js](static/cron.js) | 1132 | javascript:S1874 | Deprecated `document.execCommand` |
| [static/base64.html](static/base64.html) | 401 | javascript:S7756 | Prefer `Blob#text()` over `FileReader#readAsText()` |
| [static/json.html](static/json.html) | 209 | javascript:S7735 | Unexpected negated condition |

---

## 4. HTML / Accessibility — ACTIVE

| Severity | Rule | File | Line | Message |
|---|---|---|---|---|
| MAJOR | Web:S6819 | [static/home.html](static/home.html) | 53 | Use `<dialog>` instead of the dialog role |
| MAJOR | Web:S6819 | [static/tools.html](static/tools.html) | 117 | Use `<dialog>` instead of the dialog role |
| MAJOR | Web:S6819 | [static/db-manager.html](static/db-manager.html) | 280 | Use `<dialog>` instead of the dialog role |

---

## 5. CSS — ACTIVE

### 5a. Contrast Ratio (MAJOR — S7924) — 30 occurrences

| File | Lines |
|---|---|
| [static/home.css](static/home.css) | 1902 |
| [static/style.css](static/style.css) | 597, 619 |
| [static/vault.css](static/vault.css) | 129, 248, 402, 408, 413, 414, 415, 416, 417 |
| [static/db-manager.css](static/db-manager.css) | 252, 362 |
| [static/sftp-browser.css](static/sftp-browser.css) | 50, 92, 234, 273, 309, 494 |
| [static/ssh-manager.css](static/ssh-manager.css) | 127, 153, 348 |
| [static/ssh-manager.html](static/ssh-manager.html) | 170, 196, 210, 228 |
| [static/file-converter.html](static/file-converter.html) | 310 |
| [static/api-tester.html](static/api-tester.html) | 30 |
| [static/regex.html](static/regex.html) | 87 |

---

## 6. New Issues Since 2026-04-19 (8 — causing `new_violations` gate failure)

| Severity | File | Line | Rule | Description |
|---|---|---|---|---|
| CRITICAL | static/vault.js | 236 | S3776 | Cognitive Complexity 21 |
| MINOR | main.py | 1322 | S2092 | Cookie without `secure` flag |
| MINOR | main.py | 1327 | S2092 | Cookie without `secure` flag |
| MINOR | static/db-manager.js | 22 | S6594 | Use `RegExp.exec()` |
| MINOR | static/devdb-client.js | 19 | S6594 | Use `RegExp.exec()` |
| MINOR | static/sftp-browser.js | 40 | S6594 | Use `RegExp.exec()` |
| MINOR | static/ssh-manager.js | 58 | S6594 | Use `RegExp.exec()` |
| MINOR | static/vault.js | 71 | S6594 | Use `RegExp.exec()` |

---

## What To Do Next (Priority Order)

| Priority | Area | Action |
|---|---|---|
| **1 — GATE: security_rating** | **S2092 Vulnerabilities** | Add `secure=True` to cookie responses at `main.py:1322` and `main.py:1327`. Fixes Security Rating B → A. |
| **2 — GATE: hotspots** | **Security Hotspots (§1)** | Review all 3 hotspots in SonarCloud UI. Mark S5042 (×2) as Safe. Evaluate S3330 (HttpOnly) — fix or mark Safe. Fixes both hotspot gate conditions. |
| **3 — GATE: new_violations** | **New issues (§6)** | Fix `vault.js:236` S3776 complexity + 5× S6594 RegExp.exec() across JS files. Reduces new violations from 8 → 2 (S2092 handled in priority 1). |
| **4** | **BLOCKER S2703** | Declare `_serverToken` with `let`/`const` in `db-manager.js:188`. |
| **5** | **JS Critical S3776 (§3b)** | Reduce complexity in `cron.js:528`, `ssh-manager.js:947`, `file-converter.html:1102`. |
| **6** | **JS Critical S2004 (§3c)** | Flatten nesting in `ssh-manager.js:353`, `regex.html:398`. |
| **7** | **JS Major (§3d)** | Optional chaining in `app.js` (×4 S6582); top-level await in `ssh-manager.js:189`, `api-tester.js:385`. |
| **8** | **HTML S6819 (§4)** | Convert role="dialog" divs to `<dialog>` elements in home.html, tools.html, db-manager.html. |
| **9** | **CSS S7924 (§5)** | Fix contrast ratios across 30 occurrences in 10 files. |
