# SonarCloud Findings — `main` branch

> Pulled: 2026-04-19 | Project: `Prabhakar-cg_devsuite` | Quality Gate: **FAILED**

## Summary

| Category | Critical | Major | Minor | Total |
|---|---|---|---|---|
| Security Hotspots | — | 7 | — | 7 |
| Python Backend | 9 | 35+ | 4 | ~48 |
| JavaScript (first-party) | 5 | 15 | 7 | ~27 |
| HTML / Accessibility | — | 8 | — | 8 |
| CSS | — | 14 | — | 14 |
| Tests | 1 | 4 | 8 | 13 |
| Vendored Libs *(exclude)* | 31 | 12 | 7 | 50 |

---

## 1. Security Hotspots

> All 7 are in **vendored Monaco Editor libs** (`static/libs/`). Fix: extend `sonar.security.exclusions` to fully cover `static/libs/**`.

| Probability | Rule | File | Finding |
|---|---|---|---|
| MEDIUM | ReDoS | [static/libs/vs/basic-languages/azcli/azcli.js](static/libs/vs/basic-languages/azcli/azcli.js) | Regex vulnerable to super-linear backtracking (2 instances) |
| MEDIUM | ReDoS | [static/libs/vs/basic-languages/wgsl/wgsl.js](static/libs/vs/basic-languages/wgsl/wgsl.js) | Regex vulnerable to super-linear backtracking (5 instances) |

**Action:** Add `sonar.security.exclusions=static/libs/**` to [sonar-project.properties](sonar-project.properties).

---

## 2. Python Backend

### 2a. Duplicate String Literals (CRITICAL — S1192)

All in [main.py](main.py) — extract each to a named constant.

| Literal | Occurrences |
|---|---|
| `"SFTP operation failed"` | 3× |
| `"http://127.0.0.1:8000"` | 3× |
| `"http://localhost:8000"` | 3× |
| `"Origin header required"` | 3× |
| `"Origin not allowed"` | 3× |
| `r'[^0-9]'` | 4× |
| `"openpyxl is not installed. Run: pip install openpyxl"` | 3× |

### 2b. Cognitive Complexity (CRITICAL — S3776)

| File | Complexity | Limit |
|---|---|---|
| [main.py](main.py) | 71 | 15 |
| [main.py](main.py) | 24 | 15 |
| [main.py](main.py) | 19 | 15 |
| [main.py](main.py) | 16 | 15 |
| [main.py](main.py) | 16 | 15 |
| [devdb.py](devdb.py) | 16 | 15 |

### 2c. Exception Handling (CRITICAL — S5754)

- [main.py](main.py) — Bare `except:` clause — specify an exception class or re-raise

### 2d. Undocumented HTTPException Responses (MAJOR — S8415)

All in [main.py](main.py) — add each status code to the route's `responses=` parameter.

| Status Code | Count |
|---|---|
| 500 | 10+ |
| 503 | 7 |
| 400 | 6 |
| 401 | 4 |
| 413 | 2 |
| 404 | 1 |
| 409 | 1 |

### 2e. Other (MAJOR / MINOR)

| Severity | Rule | File | Finding |
|---|---|---|---|
| MAJOR | S108 | [main.py](main.py) | Empty `except` or `pass` block — fill or remove |
| MINOR | S6353 | [main.py](main.py) | Use `\D` instead of `[^0-9]` (4 occurrences) |

---

## 3. JavaScript (First-Party)

### 3a. Cognitive Complexity (CRITICAL — S3776)

| File | Location | Complexity | Limit |
|---|---|---|---|
| [static/app.js](static/app.js) | unknown | 25 | 15 |
| [static/vault.js](static/vault.js) | unknown | 24 | 15 |
| [static/ssh-manager.js](static/ssh-manager.js) | line 1142 | 23 | 15 |
| [static/cron.js](static/cron.js) | line 528 | 21 | 15 |
| [static/ssh-manager.js](static/ssh-manager.js) | line 946 | 18 | 15 |

### 3b. Optional Chaining (MAJOR — S6582)

Use `?.` instead of manual null checks — [static/ssh-manager.js](static/ssh-manager.js) (7 occurrences, including line 599).

### 3c. Function Scope (MAJOR — S7721)

Move inner helper functions to outer scope:

| File | Function |
|---|---|
| [static/app.js](static/app.js) | `formatSize`, `allFileStatuses`, `collectFilePaths`, `formatFileDate` |
| [static/vault.js](static/vault.js) | unknown |

### 3d. Useless Assignments (MAJOR — S1854)

| File | Variable |
|---|---|
| [static/app.js](static/app.js) | `activeFilePath` |
| [static/file-converter.html](static/file-converter.html) | `outputMime` |

### 3e. Code Style (MAJOR)

| Rule | File | Finding |
|---|---|---|
| S3358 | [static/db-manager.js](static/db-manager.js) | Nested ternary — extract to statement |
| S3358 | [static/vault.js](static/vault.js) | Nested ternary — extract to statement |
| S6661 | [static/vault.js](static/vault.js) | Use object spread `{ ...foo }` instead of `Object.assign` |
| S125 | [static/ssh-manager.js](static/ssh-manager.js) | Remove commented-out code |
| S125 | [static/file-converter.html](static/file-converter.html) | Remove commented-out code |

### 3f. Modern JS Preferences (MINOR)

| Rule | File | Finding |
|---|---|---|
| S7764 | [static/home.html](static/home.html) | Prefer `globalThis` over `window` (8 occurrences) |
| S7764 | [static/tools.html](static/tools.html) | Prefer `globalThis` over `window` (8 occurrences) |
| S7764 | [static/ssh-manager.js](static/ssh-manager.js) | Prefer `globalThis` over `window` |
| S7773 | [static/ssh-manager.js](static/ssh-manager.js) | Prefer `Number.parseInt` over `parseInt` (2 occurrences) |
| S7735 | [static/ssh-manager.js](static/ssh-manager.js) | Unexpected negated condition at lines 1163, 1185, 1204, 1264 |

---

## 4. HTML / Accessibility

All findings: prefer native semantic elements over ARIA roles.

| Severity | Rule | File | Line | Finding |
|---|---|---|---|---|
| MAJOR | S6819 | [static/home.html](static/home.html) | 53 | Use `<dialog>` instead of `role="dialog"` |
| MAJOR | S6819 | [static/tools.html](static/tools.html) | 117 | Use `<dialog>` instead of `role="dialog"` |
| MAJOR | S6819 | [static/tools.html](static/tools.html) | multiple | Use `<input type="radio">` instead of `role="radio"` (6 occurrences) |

---

## 5. CSS

### 5a. Contrast Ratio (MAJOR — S7924)

Text does not meet minimum contrast requirements:

| File | Line |
|---|---|
| [static/home.css](static/home.css) | 1902 |
| [static/ssh-manager.html](static/ssh-manager.html) | 210, 228 |
| [static/file-converter.html](static/file-converter.html) | 310 |
| [static/style.css](static/style.css) | 597, 619 |
| [static/vault.css](static/vault.css) | 248, 402, 413, 414, 415, 416, 417 |

### 5b. Duplicate Selectors (MAJOR — S4666)

| File | Duplicate Selector | First Defined At |
|---|---|---|
| [static/home.css](static/home.css) | `.nav-active` | line 1388 |
| [static/home.css](static/home.css) | `.feat-card:hover .feat-cta` | line 1519 |
| [static/home.css](static/home.css) | `.tool-card:hover .card-arrow` | line 1742 |
| [static/home.css](static/home.css) | `.feat-card` | line 1150 |
| [static/home.css](static/home.css) | `.feat-card:hover` | line 1161 |
| [static/style.css](static/style.css) | `.editor-host` | line 400 |

### 5c. Empty Blocks (MAJOR — S4658)

- [static/home.css](static/home.css) — 2 empty rule blocks (remove or fill)

---

## 6. Tests

### 6a. Critical

| Rule | File | Finding |
|---|---|---|
| S1186 | [tests/javascript/test_devdb_client.js](tests/javascript/test_devdb_client.js) | Unexpected empty method `append` |

### 6b. Major

| Rule | File | Finding |
|---|---|---|
| S7721 | [tests/javascript/test_auth_guard.js](tests/javascript/test_auth_guard.js) | Move `makeEl` to outer scope |
| S7721 | [tests/javascript/test_components.js](tests/javascript/test_components.js) | Move `makeElement` to outer scope |
| S6582 | [tests/javascript/test_auth_guard.js](tests/javascript/test_auth_guard.js) | Use optional chaining `?.` (2 occurrences) |
| S1854 | [tests/javascript/test_auth_guard.js](tests/javascript/test_auth_guard.js) | Useless assignment to `origGetById` |
| S1854 | [tests/javascript/test_devdb_client.js](tests/javascript/test_devdb_client.js) | Useless assignment to `FormData` |

### 6c. Minor

| Rule | File | Finding |
|---|---|---|
| S7772 | test_api_client.js, test_auth_guard.js, test_components.js, test_devdb_client.js | Use `node:fs`, `node:vm`, `node:path` prefixes |
| S1481 | [tests/javascript/test_auth_guard.js](tests/javascript/test_auth_guard.js) | Unused variable `origGetById` |
| S1481 | [tests/javascript/test_devdb_client.js](tests/javascript/test_devdb_client.js) | Unused variable `FormData` |
| S6647 | [tests/javascript/test_devdb_client.js](tests/javascript/test_devdb_client.js) | Useless constructor |
| S7781 | [tests/javascript/test_api_client.js](tests/javascript/test_api_client.js) | Prefer `String#replaceAll()` over `String#replace()` |

---

## 7. Vendored Libs — Fix by Exclusion

> All findings below are in `static/libs/` (Monaco Editor language bundles). **Do not fix the code — fix the SonarQube exclusion config.**

Current config in [sonar-project.properties](sonar-project.properties):
```
sonar.exclusions=static/libs/**,...
sonar.security.exclusions=tests/**,static/libs/**
```

The `sonar.exclusions` already covers `static/libs/**` — verify this is being applied. If `var` and hotspot findings still appear, the scanner may be picking up cached results. Clear `.scannerwork/` and re-scan.

Files affected: `azcli.js` (31 issues), `ini.js` (14 issues), `wgsl.js` (19 issues)

---

## Recommended Fix Order

| Priority | Area | Why |
|---|---|---|
| 1 | Sonar exclusions | Clears ~57 false-positive findings instantly |
| 2 | `main.py` HTTPException docs | Likely root cause of Quality Gate failure |
| 3 | `main.py` duplicate literals | Quick wins, high CRITICAL count |
| 4 | `main.py` cognitive complexity | Largest function (71!) needs splitting |
| 5 | CSS contrast issues | Accessibility / WCAG compliance |
| 6 | HTML ARIA → semantic elements | Low effort, accessibility win |
| 7 | JS complexity & optional chaining | Code health |
| 8 | Test file cleanup | Hygiene |
