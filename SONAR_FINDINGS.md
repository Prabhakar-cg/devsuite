# SonarCloud Findings — `main` branch

> Pulled: 2026-05-09 (full API pull — hotspots + issues + quality gate) | Project: `Prabhakar-cg_devsuite` | Quality Gate: **FAILED**
> Previous pull: 2026-04-25 | Baseline version date: 2026-04-19

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

## Changes Since Last Pull (2026-04-25)

**Resolved ✅**
- Security Rating: B → **A** (S2092 cookie `secure` flag fixes applied to `main.py`)
- BLOCKER S2703 (`db-manager.js:188` implicit global `_serverToken`) — fixed
- S3330 hotspot (`main.py:1327` HttpOnly cookie) — resolved
- All prior S3776 cognitive complexity issues (`cron.js`, `ssh-manager.js`, `file-converter.html`) — resolved
- S2004 nesting issues (`ssh-manager.js:353`, `regex.html:398`) — resolved
- S6582 optional chaining (`app.js` ×4), S6660, S7785, S6594 `RegExp.exec` (×5 files) — all resolved
- Most prior S7735, S7766, S1874 minor issues — resolved

**New ⚠️**
- 6 new security hotspots in `api-tester.js` (ReDoS, dynamic code execution) + `main.py` (hashing)
- 5 new code issues in `api-tester.js` (new file added to scan)
- 3 new code issues in `crypto.html` (new file added to scan)
- 12 new CSS contrast violations in `style.css` (new CSS added)
- New violations gate: 8 → **23**

---

## Summary (effective — post-scan 2026-05-09)

| Category | Count | Status |
|---|---|---|
| Security Hotspots (TO_REVIEW) | 8 | 🔴 Unreviewed — gate failing |
| JS Major (S125 commented code, S7721 fn scope) | 2 | 🟡 Active |
| JS Minor (S7751, S7756, S7781, S7778, S7735) | 6 | 🟡 Active |
| CSS Contrast (S7924) | 17 | 🟡 Active |
| **Total active issues** | **25** | |

**Quality Gate conditions:**
| Metric | Actual | Threshold | Status |
|---|---|---|---|
| Reliability Rating | A (1) | ≤ C (3) | ✅ OK |
| Security Rating | A (1) | ≤ A (1) | ✅ OK ← *fixed since last pull* |
| New Duplicated Lines | 0.5% | ≤ 3% | ✅ OK |
| **New Security Hotspots Reviewed** | **0%** | **100%** | ❌ **FAIL** |
| **New Violations** | **23** | **0** | ❌ **FAIL** |
| **Security Hotspots Reviewed** | **0%** | **100%** | ❌ **FAIL** |

> 3 gate conditions failing (was 4). Security Rating now passes — S2092 cookie fixes resolved the B rating. Gate is still blocked by unreviewed hotspots and 23 new violations (12 CSS contrast + 8 issues in api-tester.js/crypto.html + 3 from style.css CSS additions).

---

## 1. Security Hotspots — UNREVIEWED (Gate Failure)

### 1a. NEW — Dynamic Code Execution / ReDoS (MEDIUM — api-tester.js) ⚠️

| Rule | File | Line | Message |
|---|---|---|---|
| javascript:S5852 | [static/api-tester.js](static/api-tester.js) | 409 | Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service. |
| javascript:S1523 | [static/api-tester.js](static/api-tester.js) | 453 | Make sure that this dynamic injection or execution of code is safe. |
| javascript:S1523 | [static/api-tester.js](static/api-tester.js) | 454 | Make sure that this dynamic injection or execution of code is safe. |
| javascript:S1523 | [static/api-tester.js](static/api-tester.js) | 499 | Make sure that this dynamic injection or execution of code is safe. |
| javascript:S1523 | [static/api-tester.js](static/api-tester.js) | 500 | Make sure that this dynamic injection or execution of code is safe. |

> S1523 (×4): Intentional scripting sandbox — `runPreRequestScript` and `runTestScript` use `new Function` to execute user-authored scripts from the Monaco editor, matching Postman's pre-request/test script model. `// NOSONAR` added to both call sites; **go to SonarCloud → Security Hotspots and mark all 4 as Acknowledged** to clear the tracked hotspots from the current scan.
> S5852: The regex on line 409 may be vulnerable to ReDoS. Review the pattern and test against adversarial input, or use `String#replaceAll()` with a literal string if no capture groups are needed.

### 1b. NEW — Hashing Safety (LOW — main.py) ⚠️

| Rule | File | Line | Message |
|---|---|---|---|
| python:S4790 | [main.py](main.py) | 226 | Make sure that hashing data is safe here. |

> `main.py:226` uses a hashing function (likely `hashlib.md5` or `sha1`) in a context Sonar considers potentially insecure. If this hash is used for cryptographic purposes, switch to `sha256`+. If it's non-cryptographic (e.g., cache key, ETag), mark **Safe**.

### 1c. EXISTING — Archive Expansion (LOW — scripts/check_updates.py)

| Rule | File | Line | Message |
|---|---|---|---|
| python:S5042 | [scripts/check_updates.py](scripts/check_updates.py) | 398 | Make sure that expanding this archive file is safe here. |
| python:S5042 | [scripts/check_updates.py](scripts/check_updates.py) | 467 | Make sure that expanding this archive file is safe here. |

> Archive source is trusted (official release downloads). Mark both **Safe** in SonarCloud UI.

**Fix path for gate:** Review all 8 hotspots in SonarCloud → Security Hotspots. Mark S5042 (×2) as **Safe**. Mark S4790 as **Safe** if non-cryptographic. Evaluate S1523 — fix or **Acknowledge**. Evaluate S5852 — fix or **Acknowledge**. This clears both `security_hotspots_reviewed` and `new_security_hotspots_reviewed` gate conditions.

---

## 2. JavaScript — ACTIVE

### 2a. MAJOR Issues

| File | Line | Rule | Message |
|---|---|---|---|
| [static/crypto.html](static/crypto.html) | 1027 | javascript:S125 | Remove this commented out code. ⚠️ NEW |
| [static/api-tester.js](static/api-tester.js) | 477 | javascript:S7721 | Move function 'expect' to the outer scope. ⚠️ NEW |

### 2b. MINOR Issues

| File | Line | Rule | Message |
|---|---|---|---|
| [static/api-tester.js](static/api-tester.js) | 409 | javascript:S7781 | Prefer `String#replaceAll()` over `String#replace()`. ⚠️ NEW |
| [static/api-tester.js](static/api-tester.js) | 515 | javascript:S7778 | Do not call `Array#push()` multiple times. ⚠️ NEW |
| [static/api-tester.js](static/api-tester.js) | 516 | javascript:S7778 | Do not call `Array#push()` multiple times. ⚠️ NEW |
| [static/api-tester.js](static/api-tester.js) | 772 | javascript:S7735 | Unexpected negated condition. ⚠️ NEW |
| [static/crypto.html](static/crypto.html) | 1142 | javascript:S7756 | Prefer `Blob#arrayBuffer()` over `FileReader#readAsArrayBuffer(blob)`. ⚠️ NEW |
| [static/crypto.html](static/crypto.html) | 1247 | javascript:S7751 | Prefer `Array#flat()` over `[].concat()` to flatten an array. ⚠️ NEW |

---

## 3. CSS Contrast (MAJOR — S7924) — 17 occurrences

| File | Lines |
|---|---|
| [static/style.css](static/style.css) | 602, 624, 876, 877, 878, 894, 895, 896, 897, 898, 917, 922, 931, 937 |
| [static/file-converter.html](static/file-converter.html) | 310, 317 |
| [static/regex.html](static/regex.html) | 87 |

> 14 of these are in `style.css` — 12 are new since last pull (added with recent CSS changes). Lines 876–937 appear to be a new theme or color block with insufficient contrast ratios.

---

## 4. New Issues Since 2026-04-19 (23 — causing `new_violations` gate failure)

| Severity | File | Line | Rule | Description |
|---|---|---|---|---|
| MAJOR | static/crypto.html | 1027 | S125 | Commented out code |
| MAJOR | static/api-tester.js | 477 | S7721 | Function 'expect' should be at outer scope |
| MAJOR | static/style.css | 876 | S7924 | CSS contrast violation |
| MAJOR | static/style.css | 877 | S7924 | CSS contrast violation |
| MAJOR | static/style.css | 878 | S7924 | CSS contrast violation |
| MAJOR | static/style.css | 894 | S7924 | CSS contrast violation |
| MAJOR | static/style.css | 895 | S7924 | CSS contrast violation |
| MAJOR | static/style.css | 896 | S7924 | CSS contrast violation |
| MAJOR | static/style.css | 897 | S7924 | CSS contrast violation |
| MAJOR | static/style.css | 898 | S7924 | CSS contrast violation |
| MAJOR | static/style.css | 917 | S7924 | CSS contrast violation |
| MAJOR | static/style.css | 922 | S7924 | CSS contrast violation |
| MAJOR | static/style.css | 931 | S7924 | CSS contrast violation |
| MAJOR | static/style.css | 937 | S7924 | CSS contrast violation |
| MAJOR | static/file-converter.html | 310 | S7924 | CSS contrast violation |
| MAJOR | static/style.css | 602 | S7924 | CSS contrast violation |
| MAJOR | static/style.css | 624 | S7924 | CSS contrast violation |
| MINOR | static/api-tester.js | 409 | S7781 | Use `String#replaceAll()` |
| MINOR | static/api-tester.js | 515 | S7778 | Multiple `Array#push()` calls |
| MINOR | static/api-tester.js | 516 | S7778 | Multiple `Array#push()` calls |
| MINOR | static/api-tester.js | 772 | S7735 | Unexpected negated condition |
| MINOR | static/crypto.html | 1142 | S7756 | Use `Blob#arrayBuffer()` |
| MINOR | static/crypto.html | 1247 | S7751 | Use `Array#flat()` |

---

## What To Do Next (Priority Order)

| Priority | Area | Action |
|---|---|---|
| **1 — GATE: hotspots** | **Security Hotspots (§1)** | Review all 8 hotspots in SonarCloud UI. Mark S5042 (×2) as **Safe**. Mark S4790 as **Safe** if non-cryptographic. Evaluate S1523 (×4 dynamic eval in api-tester.js) — fix or **Acknowledge** if intentional sandbox. Evaluate S5852 (ReDoS regex). Clears both hotspot gate conditions. |
| **2 — GATE: new_violations** | **CSS Contrast in style.css (§3)** | Fix contrast ratios on `style.css` lines 876–937 (12 violations) and lines 602, 624. This is the bulk of the 23 new violations. Likely a recently added theme block needs color token adjustments. |
| **3 — GATE: new_violations** | **api-tester.js + crypto.html issues (§2)** | Fix S7721 (move `expect` fn to outer scope), S7781 (replaceAll), S7778 (consolidate push), S7735 (negated condition) in api-tester.js. Fix S125 (remove commented code), S7756 (Blob#arrayBuffer), S7751 (Array#flat) in crypto.html. |
| **4** | **S1523 Dynamic eval (api-tester.js)** | Audit `api-tester.js:453–454` and `499–500`. If `eval`/`Function` is used for user-supplied expressions, replace with a safe JSON parser or expression evaluator. If sandboxed intentionally, document and acknowledge in Sonar. |
| **5** | **S5852 ReDoS (api-tester.js:409)** | Review the regex. If no capture groups needed, use `String#replaceAll()` with a literal. If dynamic pattern, validate against ReDoS test cases. |
| **6** | **S4790 Hashing (main.py:226)** | Check what `main.py:226` is hashing and why. If non-cryptographic (e.g., ETag, deduplication key), mark **Safe**. If security-sensitive, upgrade to `sha256`. |
| **7** | **Remaining CSS contrast (§3)** | Fix `file-converter.html:310`, `file-converter.html:317`, `regex.html:87`. |
