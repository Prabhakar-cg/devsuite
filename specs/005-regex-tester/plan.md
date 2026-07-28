# Implementation Plan: Regex Tester

**Branch**: `005-regex-tester` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-regex-tester/spec.md`

**Note**: Retroactive plan — the feature shipped before this spec-kit conversion.

## Summary

A single-page, fully client-side regex tester served at `GET /regex`
(`routes/pages.py:49-52` → `_serve_html("regex.html")`). Matching uses the native browser
`RegExp` engine (no third-party regex library); the test-string pane is a Monaco editor loaded
directly via RequireJS (not through `DevSuite.initMonaco()` — see research.md R1) so matches can
be rendered as inline decorations. No backend endpoint is involved beyond serving the static page.

## Technical Context

**Language/Version**: Vanilla JS (ES2017+, IIFE module), Python 3.10+ (FastAPI route only)

**Primary Dependencies**: Native `RegExp`; Monaco Editor (self-hosted via RequireJS, loaded
directly rather than via `components.js`'s `initMonaco` helper); a small inline `toast()`
re-implementation (does not use `DevSuite.toast` from `components.js`, since `components.js` is
not loaded on this page — see research.md R1)

**Storage**: N/A — stateless, no DevDB store, nothing persisted across reloads

**Testing**: None currently. No file under `tests/python/` or `tests/javascript/` references
`regex.html`, `/regex`, or regex-matching logic — see [quickstart.md](quickstart.md).

**Target Platform**: Any modern browser reachable at `localhost:8000/regex`

**Project Type**: Single static page within DevSuite's existing vanilla-JS multi-page app

**Performance Goals**: Matching re-runs on a 180ms debounce — tighter than the YAML linter's
600ms, because regex re-matching is cheap and users iterate on patterns rapidly

**Constraints**: No CDN dependencies (SPEC.md §2); all matching stays client-side; no `innerHTML`
with untrusted data (SPEC.md §7.7) — verified: match values, group captures, and error messages
(all potentially attacker/user-controlled via the pattern or test string) are inserted via
`textContent`/`document.createElement()` throughout `regex.html`, never `innerHTML`

**Scale/Scope**: One HTML page, one inline script block (~270 LOC), no new dependencies, no new
backend surface

## Constitution Check

*GATE: evaluated retroactively against `.specify/memory/constitution.md` — PASS, no violations
found.*

**Core principles (I–VII):**

| Principle | Compliance |
|---|---|
| I. Spec first | Retroactively satisfied; SPEC.md §4.4 already existed but overstates the shipped feature set (named-group display) — flagged in spec.md Assumptions, not silently fixed here. |
| II. Verify against source | Written directly from `regex.html` + `routes/pages.py`. |
| III. No undocumented behavior | Route `/regex`, no stores, no env vars, no security rules introduced. |
| IV–VII | N/A / satisfied — see checklist below. |

**Spec & security baseline**:
- [x] `specs/SPEC.md` update — N/A for this documentation-only pass (no behavior changed); the
      SPEC.md §4.4 discrepancy is flagged for the coordinator's trim pass, not fixed here.
- [x] No new outbound network paths — zero network calls beyond initial page load.
- [x] Vanilla HTML/CSS/JS, no frameworks or build tools; no persistence.
- [x] N/A — no encrypted/opaque data involved.
- [x] No `innerHTML` with untrusted data — verified across all DOM-construction call sites in
      `regex.html` (`buildMatchItem`, `buildGroupChip`, `renderEmpty`, `toast`).
- [x] No security-critical path touched — N/A.
- [x] Version bump protocol — N/A, no behavior change.
- [x] Static-analysis gates — SPEC.md §10.4 lists `regex.html:398` (S2004, functions nested >4
      levels) as an existing open finding; not addressed by this documentation-only pass (out of
      scope — flagged for awareness, not silently ignored).

**New-tool / UI cross-cutting checklist**: N/A — retroactive spec for an existing tool.

## Project Structure

### Documentation (this feature)

```text
specs/005-regex-tester/
├── spec.md
├── plan.md              # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── http-api.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
routes/pages.py          # GET /regex → _serve_html("regex.html")  (lines 49-52)
static/
├── regex.html            # page shell + inline <style> overrides + inline script (all logic here)
├── linter.css             # shared two-pane layout base
├── theme.js                # theme manager (shared)
└── libs/
    ├── require.min.js      # RequireJS loader for Monaco (vendored)
    └── vs/                 # Monaco Editor (vendored)
```

**Structure Decision**: matches DevSuite's "one HTML file + shared CSS/JS" pattern; unlike
`yaml.html`/`json.html` this page does not load `static/components.js`, instead reimplementing a
minimal local `toast()` and loading Monaco directly via `require([...])` rather than
`DevSuite.initMonaco()` — a real structural inconsistency across the linter-family tools, noted
here rather than silently normalized (no code change made in this documentation pass).

## Complexity Tracking

No constitutional violations — table not required.
