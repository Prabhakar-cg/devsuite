# Implementation Plan: JSON Linter & Formatter

**Branch**: `003-json-linter` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-json-linter/spec.md`

**Note**: Documents the as-built architecture retroactively.

## Summary

A fully client-side JSON validator/formatter built on two Monaco editors (input, writable;
output, read-only) inside a single self-executing script in `static/json.html`. No backend
endpoint is involved at all — `GET /json` only serves the static page.

## Technical Context

**Language/Version**: vanilla ES2017+ JS, inline in `static/json.html`

**Primary Dependencies**: Monaco Editor (via `DevSuite.initMonaco`, `static/components.js`
+ `static/libs/vs` + RequireJS); `js-yaml` (`static/libs/js-yaml.min.js`) for the YAML
conversion action

**Storage**: N/A — no DevDB store, nothing persisted

**Testing**: none currently automated

**Target Platform**: any modern browser hitting `localhost:8000/json`

**Project Type**: static page, zero backend logic beyond page serving

**Performance Goals**: 600ms debounce on live validation to avoid re-parsing on every
keystroke; no other perf budget tracked

**Constraints**: no framework, no build step; output is always written to a separate
read-only model — never back into the input editor (see spec.md Assumptions on the
undo-stack discrepancy)

**Scale/Scope**: one page route (`GET /json`), zero backend endpoints beyond page serving,
one inline script (~240 lines) in `static/json.html`

## Constitution Check

*GATE: retroactively evaluated — PASS, no violations found.*

**Core principles (I–VII):**

| Principle | Compliance |
|---|---|
| I Spec first | This retroactive spec now exists and corrects two drift points from the old SPEC.md §4.2 prose (documented in spec.md Assumptions) — future behavior changes must update this spec first. |
| II No undocumented network paths | Zero backend endpoints beyond `GET /json`. PASS. |
| III Vanilla stack, no external DB | Inline vanilla JS, Monaco only; no persistence. PASS. |
| IV Client-side encryption boundary | N/A — no secrets. |
| V DOM XSS hardening | Content set via Monaco model APIs (`setValue`) and `textContent` for status/error text, not `innerHTML`. PASS (spot-checked). |
| VI Security-critical paths have tests | N/A — no auth/crypto/session path in this tool. |
| VII Version bump protocol | N/A — no version-relevant change in this documentation pass. |

**Spec & security baseline:**
- [x] SPEC.md §4.2 is being superseded by a pointer to this spec, same commit series.
- [x] No new outbound network paths — page is fully static, zero fetch calls.
- [x] Vanilla HTML/CSS/JS, no frameworks/build tools, no DevDB.
- [x] N/A — no vault/SSH blob handling.
- [x] No `innerHTML` with untrusted data.
- [x] N/A — not an auth/CSRF/session/rate-limit/crypto/WS/proxy path.
- [x] N/A — no version bump triggered.
- [ ] Static-analysis gates not re-run for this documentation-only pass; no findings
      currently listed against `json.html` in SPEC §10.4.

**New-tool / UI cross-cutting checklist**: N/A — existing tool, no new asset-order, CSP,
WS, or iconography change.

## Project Structure

### Documentation (this feature)

```text
specs/003-json-linter/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── http-api.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root, as-built)

```text
routes/
└── pages.py          # GET /json -> json.html (no other backend involvement)

static/
├── json.html          # Page markup + the entire tool's logic (inline <script>)
└── linter.css         # Shared two-pane layout with Diff/YAML/Regex/Crypto
```

**Structure Decision**: single self-contained HTML file with inline script — the smallest
of DevSuite's tool implementations; no separate `.js` file, unlike Diff (`app.js`) or
SSH/DB Manager (dedicated `.js` files). This is consistent with YAML Linter
(`004-yaml-linter`), which follows the same pattern.

## Complexity Tracking

No constitutional violations — table not required.
