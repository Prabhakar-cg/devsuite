# Implementation Plan: Diff Checker

**Branch**: `002-diff-checker` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-diff-checker/spec.md`

**Note**: This plan documents the as-built architecture retroactively; it was not used to
drive implementation (the tool predates this spec-kit migration).

## Summary

A client-side text/folder diff tool built on Monaco's built-in diff editor. The backend's
only involvement is `POST /upload` (streamed, size- and binary-content-checked text file
ingestion for either panel). All diff computation, hunk merging, stats, filtering, and
export happen in the browser in `static/app.js`, served at `GET /diff` → `static/index.html`.

## Technical Context

**Language/Version**: Python 3.10+ (backend, `routes/pages.py`); vanilla ES2017+ JS
(frontend, `static/app.js`)

**Primary Dependencies**: FastAPI (upload route); Monaco Editor (`static/libs/vs`, self-
hosted via RequireJS) for the diff engine and editors; JSZip (`static/libs/jszip.min.js`)
loaded for potential folder-diff zip download (SPEC §13 backlog item — not yet wired to a
UI action in this version)

**Storage**: N/A — no DevDB store; nothing persisted server-side or client-side

**Testing**: none currently automated for this tool; `pytest tests/python/` covers only
security-critical paths elsewhere (SPEC §10.2), not `/upload`'s content-type/size logic

**Target Platform**: any browser hitting `localhost:8000/diff`; folder picking depends on
`webkitdirectory` support (Chromium/Firefox/Safari desktop)

**Project Type**: single FastAPI app + static frontend (existing DevSuite layout)

**Performance Goals**: diff render is Monaco's responsibility (no custom perf budget
tracked); `/upload` streams in 1 MB chunks to avoid buffering an entire oversized file
before rejecting it

**Constraints**: no framework, no build step (constitution Art. III); `/upload` enforces a
50 MB hard cap distinct from the File Converter's 20 MB `/api/convert` cap (SPEC §5.7)

**Scale/Scope**: one page route (`/diff`), one upload route (`/upload`), one JS file
(`static/app.js`, ~1650 lines) covering both text-diff and folder-diff modes

## Constitution Check

*GATE: retroactively evaluated against `.specify/memory/constitution.md` — PASS, no
violations found.*

**Core principles (I–VII):**

| Principle | Compliance |
|---|---|
| I Spec first | This retroactive spec now exists; going forward, changes to `/diff` behavior must update this spec before code (constitution Art. I). |
| II No undocumented network paths | Only `/upload`; no CORS proxy, no SSH. PASS. |
| III Vanilla stack, no external DB | Pure HTML/CSS/JS + Monaco; no persistence at all. PASS. |
| IV Client-side encryption boundary | N/A — no secrets handled by this tool. |
| V DOM XSS hardening | Diff content is rendered via Monaco's own model API, not `innerHTML`; file names inserted as `textContent`. PASS (spot-checked `static/app.js`). |
| VI Security-critical paths have tests | `/upload`'s size/binary checks are not security-critical in the SPEC §10.2 sense (no auth/crypto involved) — no test requirement triggered. |
| VII Version bump protocol | N/A unless this feature's behavior changes; no version-relevant edit made by this retroactive spec. |

**Spec & security baseline:**
- [x] `specs/SPEC.md` §4.1 content is being superseded by this spec + a pointer, in the
      same commit series as this migration (Art. I).
- [x] No new outbound network paths — `/upload` is a same-origin POST. PASS.
- [x] Vanilla HTML/CSS/JS, no frameworks/build tools; no DevDB usage. PASS.
- [x] N/A — tool never handles vault/SSH blobs.
- [x] No `innerHTML` with untrusted data observed in `static/app.js`/`static/index.html`
      for diff content or filenames.
- [x] N/A — `/upload` is not an auth/CSRF/session/rate-limit/crypto/WS/CORS-proxy path;
      no new tests required by Art. VI.
- [x] N/A — no version-relevant behavior change in this documentation-only pass.
- [ ] Static-analysis gates: not re-run as part of this documentation change (no code
      touched); existing SonarCloud findings for this feature are tracked in SPEC §10.4
      (none currently listed against `app.js`/`index.html`/`pages.py`).

**New-tool / UI cross-cutting checklist**: N/A — this is documentation for an existing tool,
not a new one; tool count, asset load order, CSP, WS auth, iconography, and third-party JS
inventory are unchanged by this pass.

## Project Structure

### Documentation (this feature)

```text
specs/002-diff-checker/
├── plan.md              # This file
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
└── pages.py          # GET /diff -> index.html; POST /upload (shared upload endpoint)

static/
├── index.html        # Diff tool page: text-diff panels + Folder Diff tab
├── app.js             # All diff-tool client logic (~1650 lines): compare, merge,
│                       # stats, export, folder-diff tree + filters
└── linter.css         # Shared two-pane layout styling with JSON/YAML/Regex/Crypto
```

**Structure Decision**: no structural change — this plan documents the existing single-
project layout. `app.js` is diff-tool-only (see spec.md Assumptions re: the SPEC §3.4
correction); it is not shared with the JSON/YAML linters, which use their own inline
scripts.

## Complexity Tracking

No constitutional violations — table not required.
