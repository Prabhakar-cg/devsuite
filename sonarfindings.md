# SonarCloud Findings — devsuite

**Project:** Prabhakar-cg_devsuite  
**Analysis date:** 2026-06-07  
**Report generated:** 2026-06-08  
**Source:** https://sonarcloud.io/project/overview?id=Prabhakar-cg_devsuite

---

## Summary

| Metric | Value |
|--------|-------|
| Lines of Code | 22,296 |
| Bugs | 0 |
| Vulnerabilities | 0 |
| Code Smells | 21 (active; 49 total open issues) |
| Security Hotspots | 2 |
| Duplicated Lines | 1.8% |
| Technical Debt | 5h 32min |
| Reliability Rating | A |
| Security Rating | A |
| Maintainability Rating | A |

### Issues by Severity

| Severity | Count |
|----------|-------|
| BLOCKER | 1 |
| CRITICAL | 4 |
| MAJOR | 29 |
| MINOR | 15 |
| **Total** | **49** |

All 49 open issues are **CODE_SMELL** type, spread across 10 files.

---

## Security Hotspots

> **Status: LOW probability** — both flagged in `routes/ssh.py`

| File | Line | Probability | Message |
|------|------|-------------|---------|
| [routes/ssh.py](routes/ssh.py#L156) | 156 | LOW | Using http protocol is insecure. Use https instead |
| [routes/ssh.py](routes/ssh.py#L156) | 156 | LOW | Using http protocol is insecure. Use https instead |

**Action:** Review whether the `http://` URL at line 156 is an internal/controlled endpoint. If it reaches out to external services, replace with `https://`.

---

## Issues by File

---

### main.py — 1 issue

#### [BLOCKER] `python:S8414` — L96
**Add CORSMiddleware last in the middleware chain.**  
Effort: 5min  
Tags: `configuration`, `cors`, `fastapi`, `middleware`

FastAPI/Starlette processes middleware in reverse registration order. `CORSMiddleware` must be added *last* so it executes *first* on incoming requests; otherwise CORS headers may not be applied to error responses from earlier middleware.

---

### routes/ssh.py — 1 issue

#### [MAJOR] `python:S8513` — L93
**Replace chained "startswith" calls with a single call using a tuple argument.**  
Effort: 5min  
Tags: `performance`, `pythonic`

```python
# Instead of:
s.startswith("a") or s.startswith("b")
# Use:
s.startswith(("a", "b"))
```

---

### static/api-tester.html — 3 issues

#### [MAJOR] `Web:S7927` — L186
**The accessible name should be part of the visible label.**  
Effort: 5min

Screen readers derive the accessible name from `aria-label` or `aria-labelledby`; if it differs from the visible text, voice control users cannot activate the element by speaking what they see.

#### [MAJOR] `Web:S6825` — L324
**aria-hidden="true" must not be set on focusable elements.**  
Effort: 5min

#### [MAJOR] `Web:S6825` — L325
**aria-hidden="true" must not be set on focusable elements.**  
Effort: 5min

Focusable elements with `aria-hidden="true"` are invisible to assistive technology but still reachable via keyboard, creating a confusing experience for screen-reader users. Either remove `aria-hidden` or also add `tabindex="-1"`.

---

### static/api-tester.js — 20 issues

#### [CRITICAL] `javascript:S3776` — L698
**Refactor this function to reduce its Cognitive Complexity from 20 to the 15 allowed.**  
Effort: 10min

#### [CRITICAL] `javascript:S3776` — L858
**Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed.**  
Effort: 8min

#### [CRITICAL] `javascript:S3776` — L1079
**Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed.**  
Effort: 6min

#### [CRITICAL] `javascript:S3776` — L1377
**Refactor this function to reduce its Cognitive Complexity from 30 to the 15 allowed.**  
Effort: 20min

These four functions exceed the maximum cognitive complexity threshold. Extract sub-operations into smaller named helpers to improve readability and testability. The function at L1377 (complexity 30) is the most critical to address first.

#### [MAJOR] `javascript:S1121` — L971
**Extract the assignment of "el.style.cssText" from this expression.**  
Effort: 5min

Assignments inside expressions are hard to spot and can mask intent. Move the assignment to its own statement.

#### [MAJOR] `javascript:S6582` — L1521
**Prefer using an optional chain expression instead, as it's more concise and easier to read.**  
Effort: 5min

#### [MAJOR] `javascript:S6582` — L1564
**Prefer using an optional chain expression instead, as it's more concise and easier to read.**  
Effort: 5min

Replace `x && x.y` patterns with `x?.y`.

#### [MAJOR] `javascript:S3800` — L1600
**Refactor this function to always return the same type.**  
Effort: 20min

Inconsistent return types make callers harder to reason about and can cause subtle runtime errors.

#### [MAJOR] `javascript:S7721` — L477
**Move function 'expect' to the outer scope.**  
Effort: 5min

Functions defined inside other functions are recreated on every call. Moving `expect` to the outer scope avoids unnecessary allocations.

#### [MINOR] `javascript:S2486` — L1348
**Handle this exception or don't catch it at all.**  
Effort: 1h

An empty (or no-op) `catch` block silently swallows errors, making failures invisible. Either handle the error meaningfully or remove the try/catch.

#### [MINOR] `javascript:S7735` — L772, L1026, L1236, L1507, L1533, L1546, L1554
**Unexpected negated condition.** (7 occurrences)  
Effort: 2min each (14min total)

Prefer the positive branch first in `if/else` statements:
```js
// Instead of:
if (!condition) { /* falsy */ } else { /* truthy */ }
// Prefer:
if (condition) { /* truthy */ } else { /* falsy */ }
```

#### [MINOR] `javascript:S7781` — L409
**Prefer `String#replaceAll()` over `String#replace()`.**  
Effort: 5min

#### [MINOR] `javascript:S7778` — L515, L516
**Do not call `Array#push()` multiple times.** (2 occurrences)  
Effort: 5min each

Combine into a single `push(...items)` call.

---

### static/auth-guard.js — 1 issue

#### [MINOR] `javascript:S7773` — L140
**Prefer `Number.parseInt` over `parseInt`.**  
Effort: 2min

The global `parseInt` is functionally equivalent but `Number.parseInt` is more explicit about the type context.

---

### static/crypto.html — 3 issues

#### [MAJOR] `javascript:S125` — L1027
**Remove this commented out code.**  
Effort: 5min

Commented-out code adds noise and should be removed; version control preserves history.

#### [MINOR] `javascript:S7751` — L1247
**Prefer `Array#flat()` over `[].concat()` to flatten an array.**  
Effort: 5min

```js
// Instead of:
[].concat(...arrays)
// Use:
arrays.flat()
```

#### [MINOR] `javascript:S7756` — L1142
**Prefer `Blob#arrayBuffer()` over `FileReader#readAsArrayBuffer(blob)`.**  
Effort: 5min

`Blob#arrayBuffer()` returns a Promise directly; `FileReader` is the older event-based API.

---

### static/file-converter.html — 2 issues

#### [MAJOR] `css:S7924` — L310
**Text does not meet the minimal contrast requirement with its background.**  
Effort: 5min

#### [MAJOR] `css:S7924` — L317
**Text does not meet the minimal contrast requirement with its background.**  
Effort: 5min

---

### static/regex.html — 1 issue

#### [MAJOR] `css:S7924` — L87
**Text does not meet the minimal contrast requirement with its background.**  
Effort: 5min

---

### static/style.css — 14 issues

#### [MAJOR] `css:S7924` — L602, L624, L876, L877, L878, L894–L898, L917, L922, L931, L937
**Text does not meet the minimal contrast requirement with its background.** (14 occurrences)  
Effort: 5min each (70min total)

These color values fail WCAG AA contrast ratio requirements (4.5:1 for normal text, 3:1 for large text). The affected lines are clustered in two regions:
- Lines 876–898: likely dark-mode or themed color definitions
- Lines 602, 624, 917, 922, 931, 937: scattered utility/component styles

Use a contrast checker tool (e.g. https://webaim.org/resources/contrastchecker/) to find compliant replacements.

---

### static/vault.js — 3 issues

#### [MAJOR] `javascript:S4624` — L778
**Refactor this code to not use nested template literals.**  
Effort: 10min

Nested backtick expressions are hard to read. Extract the inner template into a variable.

#### [MAJOR] `javascript:S2814` — L797
**'copyBtn' is already defined.**  
Effort: 20min

Duplicate `let`/`const`/`var` declaration for `copyBtn`. This may mask a scoping bug or indicate copy-paste error.

#### [MINOR] `javascript:S7773` — L80
**Prefer `Number.parseInt` over `parseInt`.**  
Effort: 2min

---

## Prioritised Fix Order

| Priority | File | Line(s) | Issue | Effort |
|----------|------|---------|-------|--------|
| 1 | [main.py](main.py#L96) | 96 | BLOCKER: CORSMiddleware ordering | 5min |
| 2 | [static/api-tester.js](static/api-tester.js#L1377) | 1377 | CRITICAL: Cognitive complexity 30 | 20min |
| 3 | [static/api-tester.js](static/api-tester.js#L858) | 858 | CRITICAL: Cognitive complexity 18 | 8min |
| 4 | [static/api-tester.js](static/api-tester.js#L698) | 698 | CRITICAL: Cognitive complexity 20 | 10min |
| 5 | [static/api-tester.js](static/api-tester.js#L1079) | 1079 | CRITICAL: Cognitive complexity 16 | 6min |
| 6 | [static/api-tester.js](static/api-tester.js#L1600) | 1600 | MAJOR: Inconsistent return type | 20min |
| 7 | [static/vault.js](static/vault.js#L797) | 797 | MAJOR: Duplicate variable declaration | 20min |
| 8 | [static/style.css](static/style.css) | multiple | MAJOR: 14× contrast failures | 70min |
| 9 | [static/file-converter.html](static/file-converter.html) | 310, 317 | MAJOR: 2× contrast failures | 10min |
| 10 | [static/api-tester.html](static/api-tester.html) | 186, 324, 325 | MAJOR: Accessibility (aria) | 15min |
| 11 | [routes/ssh.py](routes/ssh.py#L156) | 156 | HOTSPOT: http vs https | — |
| 12 | [static/api-tester.js](static/api-tester.js#L1348) | 1348 | MINOR: Empty catch block (1h debt) | 1h |
| 13 | remaining MINOR issues | various | Style/modernisation | ~45min |

**Total estimated effort: ~5h 30min**
