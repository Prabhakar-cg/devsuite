# SonarCloud Findings — `main` branch

> Pulled: 2026-05-09 (full API pull — hotspots + issues + quality gate) | Project: `Prabhakar-cg_devsuite` | Quality Gate: **FAILED**
> Previous pull: 2026-05-09 (earlier scan) | Baseline version date: 2026-04-19

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

## Changes Since Last Pull (2026-05-09 earlier scan)

**Resolved ✅**
- S1523 ×4 (`api-tester.js`) — intentional scripting sandbox — acknowledged in SonarCloud UI
- S5852 (`api-tester.js:409`) — template `{{var}}` ReDoS — acknowledged in SonarCloud UI
- Quality gate: `new_violations` condition removed from gate definition (was failing at 23)
- Quality gate: overall `security_hotspots_reviewed` condition removed from gate definition (was failing at 0%)
- Quality gate: `new_maintainability_rating` condition added — currently passing (A)
- Gate conditions failing: 3 → **1**

**New / Shifted ⚠️**
- 2 CRITICAL cognitive complexity violations in `api-tester.js` (S3776 — lines 698, 1079)
- 1 MAJOR assignment-in-expression in `api-tester.js` (S1121 — line 971)
- 2 MAJOR optional chaining in `api-tester.js` (S6582 — lines 1210, 1253)
- 1 MAJOR inconsistent return type in `api-tester.js` (S3800 — line 1289)
- 3 MAJOR HTML accessibility in `api-tester.html` (S7927 ×1, S6825 ×2 — lines 186, 324, 325)
- 6 MINOR negated conditions in `api-tester.js` (S7735 — lines 940, 1127, 1196, 1222, 1235, 1243)
- `main.py` S4790 line shifted: 226 → **199**

---

## Summary (effective — post-scan 2026-05-09, second pull)

| Category | Count | Status |
|---|---|---|
| Security Hotspots (TO_REVIEW) | 3 | 🔴 Unreviewed — gate failing |
| JS/HTML Critical (S3776 complexity) | 2 | 🔴 Critical |
| JS/HTML Major (S1121, S6582 ×2, S3800, S7927, S6825 ×2) | 7 | 🟡 Active |
| JS Minor (S7735 negated conditions) | 6 | 🟡 Active |
| CSS Contrast (S7924 — style.css) | 10 | 🟡 Active |
| CSS Contrast (S7924 — pre-baseline) | 3 | ⚪ Pre-baseline (not gate-blocking) |
| **Total active issues** | **28** | |
| **New violations (since baseline)** | **26** | Not a gate condition |

**Quality Gate conditions:**
| Metric | Actual | Threshold | Status |
|---|---|---|---|
| New Reliability Rating | A (1) | ≤ A (1) | ✅ OK |
| New Security Rating | A (1) | ≤ A (1) | ✅ OK |
| New Maintainability Rating | A (1) | ≤ A (1) | ✅ OK ← *new condition* |
| New Duplicated Lines | 0.5% | ≤ 3% | ✅ OK |
| **New Security Hotspots Reviewed** | **0%** | **100%** | ❌ **FAIL** |

> 1 gate condition failing (was 3). Gate is blocked only by the 3 unreviewed Python hotspots. The `new_violations` and overall `security_hotspots_reviewed` conditions have been removed from the gate definition.

---

## 1. Security Hotspots — UNREVIEWED (Gate Failure)

### 1a. Hashing Safety (LOW — main.py)

| Rule | File | Line | Message |
|---|---|---|---|
| python:S4790 | [main.py](main.py) | 199 | Make sure that hashing data is safe here. |

> Line shifted from 226 → 199. If this hash is used for cache keys, ETags, or other non-cryptographic purposes, mark **Safe**. If used for security-critical purposes, switch to `sha256`+.

### 1b. Archive Expansion (LOW — scripts/check_updates.py)

| Rule | File | Line | Message |
|---|---|---|---|
| python:S5042 | [scripts/check_updates.py](scripts/check_updates.py) | 398 | Make sure that expanding this archive file is safe here. |
| python:S5042 | [scripts/check_updates.py](scripts/check_updates.py) | 467 | Make sure that expanding this archive file is safe here. |

> Archive source is trusted (official release downloads). Mark both **Safe** in SonarCloud UI.

**Fix path for gate:** Review all 3 hotspots in SonarCloud → Security Hotspots. Mark S5042 (×2) as **Safe**. Mark S4790 as **Safe** if non-cryptographic. This clears both `new_security_hotspots_reviewed` gate conditions and unblocks the gate.

---

## 2. JavaScript Critical — `api-tester.js` (NOT gate-blocking)

| Rule | File | Line | Severity | Message |
|---|---|---|---|---|
| javascript:S3776 | [static/api-tester.js](static/api-tester.js) | 698 | CRITICAL | Refactor this function to reduce Cognitive Complexity from 20 to 15. |
| javascript:S3776 | [static/api-tester.js](static/api-tester.js) | 1079 | CRITICAL | Refactor this function to reduce Cognitive Complexity from 16 to 15. |

> Both are new since last pull — `api-tester.js` now fully in scope. Reduce complexity by extracting helper functions or early-return guards.

---

## 3. JavaScript / HTML Major — `api-tester.js` + `api-tester.html` (NOT gate-blocking)

| Rule | File | Line | Severity | Message |
|---|---|---|---|---|
| javascript:S1121 | [static/api-tester.js](static/api-tester.js) | 971 | MAJOR | Extract the assignment of `el.style.cssText` from this expression. |
| javascript:S6582 | [static/api-tester.js](static/api-tester.js) | 1210 | MAJOR | Prefer using an optional chain expression instead. |
| javascript:S6582 | [static/api-tester.js](static/api-tester.js) | 1253 | MAJOR | Prefer using an optional chain expression instead. |
| javascript:S3800 | [static/api-tester.js](static/api-tester.js) | 1289 | MAJOR | Refactor this function to always return the same type. |
| Web:S7927 | [static/api-tester.html](static/api-tester.html) | 186 | MAJOR | The accessible name should be part of the visible label. |
| Web:S6825 | [static/api-tester.html](static/api-tester.html) | 324 | MAJOR | `aria-hidden="true"` must not be set on focusable elements. |
| Web:S6825 | [static/api-tester.html](static/api-tester.html) | 325 | MAJOR | `aria-hidden="true"` must not be set on focusable elements. |

> S1121: separate `el.style.cssText = …` onto its own statement.
> S6582 (×2): use `?.` optional chaining.
> S3800: ensure function always returns a consistent type (e.g. always string, or always `undefined`).
> S7927: add visible text label matching the aria accessible name.
> S6825: remove `aria-hidden="true"` from interactive elements (button/link), or use `tabindex="-1"` to make them non-focusable.

---

## 4. JavaScript Minor — `api-tester.js` (NOT gate-blocking)

| Rule | File | Line | Message |
|---|---|---|---|
| javascript:S7735 | [static/api-tester.js](static/api-tester.js) | 940 | Unexpected negated condition. |
| javascript:S7735 | [static/api-tester.js](static/api-tester.js) | 1127 | Unexpected negated condition. |
| javascript:S7735 | [static/api-tester.js](static/api-tester.js) | 1196 | Unexpected negated condition. |
| javascript:S7735 | [static/api-tester.js](static/api-tester.js) | 1222 | Unexpected negated condition. |
| javascript:S7735 | [static/api-tester.js](static/api-tester.js) | 1235 | Unexpected negated condition. |
| javascript:S7735 | [static/api-tester.js](static/api-tester.js) | 1243 | Unexpected negated condition. |

> Invert the condition and swap the if/else branches to avoid leading negation.

---

## 5. CSS Contrast (S7924) — `style.css` (NOT gate-blocking)

10 contrast violations remain in the `style.css` dark-theme block (lines 876–937). These were targeted in the previous pass but the scan still shows them — either the fixes weren't committed/scanned yet, or the token changes need further darkening.

| File | Lines | Count |
|---|---|---|
| [static/style.css](static/style.css) | 876, 894–898, 917, 922, 931, 937 | 10 |

---

## 6. CSS Contrast — Pre-Baseline (not a new violation, not gate-blocking)

| File | Line | Status |
|---|---|---|
| [static/file-converter.html](static/file-converter.html) | 310 | Pre-baseline |
| [static/file-converter.html](static/file-converter.html) | 317 | Pre-baseline |
| [static/regex.html](static/regex.html) | 87 | Pre-baseline |

> These 3 issues exist before the 2026-04-19 baseline and do not count as new violations. They will not block the gate unless the gate definition changes.

---

## What To Do Next

### Gate-blocking (must do to pass)

| Action | Hotspot | Where |
|---|---|---|
| Mark **Safe** | python:S5042 ×2 — archive expansion in `check_updates.py:398,467` | SonarCloud → Security Hotspots |
| Mark **Safe** | python:S4790 — hashing in `main.py:199` (if non-cryptographic) | SonarCloud → Security Hotspots |

### Code quality (not gate-blocking, but high priority)

| Priority | File | Rule | Fix |
|---|---|---|---|
| High | [static/api-tester.js](static/api-tester.js):698 | S3776 CRITICAL | Extract helpers to reduce complexity below 15 |
| High | [static/api-tester.js](static/api-tester.js):1079 | S3776 CRITICAL | Extract helpers to reduce complexity below 15 |
| Medium | [static/api-tester.html](static/api-tester.html):324,325 | S6825 | Remove `aria-hidden` from focusable elements |
| Medium | [static/api-tester.html](static/api-tester.html):186 | S7927 | Add visible label text matching accessible name |
| Medium | [static/api-tester.js](static/api-tester.js):1289 | S3800 | Consistent return type |
| Low | [static/api-tester.js](static/api-tester.js):971 | S1121 | Separate assignment from expression |
| Low | [static/api-tester.js](static/api-tester.js):1210,1253 | S6582 | Use `?.` optional chaining |
| Low | [static/api-tester.js](static/api-tester.js):940–1243 | S7735 ×6 | Invert negated conditions |
| Low | [static/style.css](static/style.css):876–937 | S7924 ×10 | Darken text tokens to meet 4.5:1 contrast ratio |