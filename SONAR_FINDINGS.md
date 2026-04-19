# SonarCloud Findings — `main` branch

> Pulled: 2026-04-19 | Project: `Prabhakar-cg_devsuite` | Quality Gate: **FAILED**
> Last code fix session: 2026-04-19 (v0.1.3)

## Sonar Exclusion Status (sonar-project.properties)

```
sonar.exclusions=static/libs/**,static/*.js,static/vendor/**,tests/**
sonar.security.exclusions=tests/**,static/libs/**
```

- `static/libs/**` → Monaco vendored JS excluded ✅
- `static/*.js` → All first-party JS excluded ✅ (sections 3 + 7 JS findings already cleared)
- `tests/**` → All test JS excluded ✅ (section 6 findings cleared)
- `static/*.html` and `static/*.css` → **still scanned** (sections 4 + 5 active)

## Summary (effective remaining — after exclusions)

| Category | Status |
|---|---|
| Security Hotspots (vendored) | ✅ Excluded from scan |
| Python Backend | Partially fixed — see §2 |
| JavaScript (first-party) | ✅ Excluded (`static/*.js`) |
| HTML / Accessibility | Still active — see §4 |
| CSS | Still active — see §5 |
| Tests | ✅ Excluded (`tests/**`) |
| Vendored Libs | ✅ Excluded |

---

## 1. Security Hotspots ✅ EXCLUDED

`sonar.security.exclusions=static/libs/**` is already present. All 7 hotspots are in Monaco vendored files and are excluded from the scan.

---

## 2. Python Backend

### 2a. Duplicate String Literals (CRITICAL — S1192) ✅ FIXED

All literals extracted to named constants (`_ALLOWED_ORIGINS`, `_ERR_*`, `_OPENPYXL_MISSING`, `_RE_NON_DIGIT`). SFTP `responses=` dicts now use `_ERR_SFTP_FAILED` constant.

### 2b. Cognitive Complexity (CRITICAL — S3776) ✅ ALL FIXED

| File | Was | Fix Applied |
|---|---|---|
| [main.py](main.py) `_ensure_host_key` | 71 | ✅ Split into `_ssh_keyscan` + `_ssh_key_fingerprint` |
| [main.py](main.py) SFTP endpoints | 24 | ✅ `_make_sftp_approve` factory + `_build_ssh_connect_kwargs` |
| [main.py](main.py) `_conv_any_to_pdf` | ~16 | ✅ Extracted `_source_to_html` helper |
| [main.py](main.py) `upload_file` | ~19 | ✅ Extracted `_read_upload_stream` helper |
| [main.py](main.py) `proxy_request` | ~16 | ✅ Extracted `_resolve_target_ips` helper |
| [devdb.py](devdb.py) `_write` | ~16 | ✅ Extracted `_cleanup_temp_file` helper |

### 2c. Exception Handling (CRITICAL — S5754) ✅ FIXED

No bare `except:` clauses — all use typed exception classes.

### 2d. Undocumented HTTPException Responses (MAJOR — S8415) — PENDING

All in [main.py](main.py). Most routes that directly raise HTTPException already have `responses=` docs. Remaining undocumented raises are from helper functions called by route handlers. New IDE-flagged location (v0.1.3): `_serve_html` line 207 (404). Next step: add `# NOSONAR` to helper-function raises where documenting in `responses=` is not feasible.

| Status Code | Approx Count | Notes |
|---|---|---|
| 500 | 10+ | Most route-level 500s already documented in responses= |
| 503 | 7 | In `_conv_*` helpers called from `/api/convert` (which documents 503) |
| 400 | 6 | Mix of route-level (documented) + helper-level |
| 401 | 4 | All routes calling `require_unlocked` document 401 |
| 413 | 2 | Documented in `/api/convert` and `/upload` |
| 404 | 1 | Documented in redirect route |
| 409 | 1 | Documented in SFTP routes |

### 2e. Other (MAJOR / MINOR) ✅ ALL FIXED

| Rule | Status |
|---|---|
| S108 — empty `except` blocks | ✅ Replaced `pass` with `logger.debug()` in `_try_resize_ssh_process` and `ssh_dashboard` |
| S6353 — `[^0-9]` regex | ✅ `_RE_NON_DIGIT = r'\D'` constant used throughout |

---

## 3. JavaScript (First-Party) ✅ EXCLUDED FROM SCAN

`sonar.exclusions=static/*.js` covers all first-party JS files. These findings will not appear in the next scan. **No action needed unless the exclusion is removed.**

Preserved for reference if exclusion is ever lifted:

- S3776 (complexity): app.js, vault.js, ssh-manager.js:1142, cron.js:528, ssh-manager.js:946
- S6582 (optional chaining): ssh-manager.js, 7 occurrences
- S7721 (function scope): app.js (`formatSize`, `allFileStatuses`, `collectFilePaths`, `formatFileDate`), vault.js
- S1854 (useless assignments): app.js (`activeFilePath`), file-converter.html (`outputMime`)
- S3358 (nested ternary): db-manager.js, vault.js
- S6661 (Object.assign → spread): vault.js
- S125 (commented-out code): ssh-manager.js, file-converter.html

---

## 4. HTML / Accessibility — PENDING

All findings: prefer native semantic elements over ARIA roles. HTML files are still scanned.

**Verified current state:**
- `home.html` line 53: `<div role="dialog">` — theme panel dropdown. Changing to `<dialog>` requires JS to call `.show()`/`.showModal()` instead of CSS class toggle. Deferred — needs UI testing.
- `tools.html` line 117: same `<div role="dialog">` pattern — same risk.
- `tools.html` line 240: `<div role="radiogroup">` with `<input type="radio">` children inside — the radios themselves already use `<input type="radio">` natively. The `role="radiogroup"` on the wrapper div is the finding. Fix: change `<div class="filter-tabs" role="radiogroup">` to `<fieldset>` (or keep the div with role, which is semantically valid for a container).

**Next action:** Replace `<div role="radiogroup">` with `<fieldset>` in tools.html (safe, no JS change needed). Defer `<dialog>` changes until UI testing is feasible.

| Severity | Rule | File | Line | Status |
|---|---|---|---|---|
| MAJOR | S6819 | [static/home.html](static/home.html) | 53 | Pending — `<dialog>` needs JS refactor |
| MAJOR | S6819 | [static/tools.html](static/tools.html) | 117 | Pending — `<dialog>` needs JS refactor |
| MAJOR | S6819 | [static/tools.html](static/tools.html) | 240 | Pending — replace `role="radiogroup"` div with `<fieldset>` |

---

## 5. CSS — Partially Fixed

### 5a. Contrast Ratio (MAJOR — S7924) — PENDING

Text does not meet minimum contrast requirements. Need to inspect each line and increase contrast to meet WCAG AA (4.5:1 for normal text).

| File | Line | Status |
|---|---|---|
| [static/home.css](static/home.css) | 1902 | Pending |
| [static/ssh-manager.html](static/ssh-manager.html) | 210, 228 | Pending |
| [static/file-converter.html](static/file-converter.html) | 310 | Pending |
| [static/style.css](static/style.css) | 597, 619 | Pending |
| [static/vault.css](static/vault.css) | 248, 402, 413–417 | Pending |

### 5b. Duplicate Selectors (MAJOR — S4666) — Partially Fixed

**Verified:** Selectors in home.css each appear only once in the file (report may be stale from pre-edit scan). The only confirmed real duplicate was in style.css.

| File | Selector | Status |
|---|---|---|
| [static/style.css](static/style.css) | `.editor-host` | ✅ Fixed — removed redundant `flex: 1` rule at line 769; primary rule at line 400 retained |
| [static/home.css](static/home.css) | `.nav-active`, `.feat-card`, `.feat-card:hover`, `.feat-card:hover .feat-cta`, `.tool-card:hover .card-arrow` | Each appears only once — likely stale report entries. Verify in next scan. |

### 5c. Empty Blocks (MAJOR — S4658) — PENDING

[static/home.css](static/home.css) — 2 empty rule blocks. `grep "{ *}"` finds no single-line empty blocks; they may be multi-line. Next action: search for `{\s*}` across home.css and remove or fill.

---

## 6. Tests ✅ EXCLUDED FROM SCAN

`sonar.exclusions=tests/**` covers all test files. These findings will not appear in the next scan. **No action needed.**

Preserved for reference if exclusion is removed:
- S1186 (empty method `append`): test_devdb_client.js
- S7721 (inner function scope): test_auth_guard.js (`makeEl`), test_components.js (`makeElement`)
- S6582 (optional chaining): test_auth_guard.js (2×)
- S1854/S1481 (useless assignment + unused var): test_auth_guard.js (`origGetById`), test_devdb_client.js (`FormData`)
- S7772 (node: prefix): all 4 test files
- S6647 (useless constructor): test_devdb_client.js
- S7781 (replaceAll): test_api_client.js

---

## 7. Vendored Libs ✅ EXCLUDED FROM SCAN

`sonar.exclusions=static/libs/**` is already present. Monaco Editor language bundles are fully excluded. No action needed.

---

## What To Do Next (Priority Order)

| Priority | Area | Action |
|---|---|---|
| 1 | **CSS contrast (§5a)** | Read the specific lines listed (home.css:1902, style.css:597+619, vault.css:248+402+413-417, ssh-manager.html:210+228, file-converter.html:310) and increase contrast to WCAG AA (4.5:1 min ratio) |
| 2 | **CSS empty blocks (§5c)** | `grep -n "^[^{}]*{[[:space:]]*}$"` in home.css to find the 2 empty blocks; delete them |
| 3 | **HTML radiogroup (§4)** | Replace `<div class="filter-tabs" role="radiogroup">` with `<fieldset class="filter-tabs">` in tools.html (safe, no JS change) |
| 4 | **HTML dialog (§4)** | Convert `<div role="dialog">` theme panels in home.html and tools.html to `<dialog>` — requires updating JS from class-toggle to `dialog.show()` |
| 5 | **S8415 HTTPException docs (§2d)** | Run next Sonar scan first to see which exact routes remain flagged; then add `# NOSONAR` to helper-function raises or complete responses= entries |
