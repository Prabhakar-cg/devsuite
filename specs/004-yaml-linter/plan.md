# Implementation Plan: YAML Linter & Validator

**Branch**: `004-yaml-linter` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-yaml-linter/spec.md`

**Note**: Retroactive plan — the feature shipped before this spec-kit conversion. Written from
source inspection, not forward planning.

## Summary

A single-page, fully client-side YAML linter/formatter/converter served at `GET /yaml`
(`routes/pages.py:43-46` → `_serve_html("yaml.html")`). Parsing/serialization uses the self-hosted
`js-yaml` UMD bundle loaded via a plain `<script>` tag (not RequireJS); the Monaco editor panes
are bootstrapped through `DevSuite.initMonaco()` (`static/components.js`) which itself loads
Monaco via RequireJS (`static/libs/require.min.js` + `static/libs/vs/`). No backend endpoint is
involved beyond serving the static page — see [research.md](research.md) R1.

## Technical Context

**Language/Version**: Vanilla JS (ES2017+, IIFE module), Python 3.10+ (FastAPI route only)

**Primary Dependencies**: `js-yaml` (self-hosted, `static/libs/js-yaml.min.js`), Monaco Editor
(self-hosted via RequireJS), `static/components.js` (`DevSuite.toast`, `DevSuite.initMonaco`)

**Storage**: N/A — stateless, no DevDB store, nothing persisted across reloads

**Testing**: None currently. No file under `tests/python/` or `tests/javascript/` references
`yaml.html`, YAML parsing, or this route — see [quickstart.md](quickstart.md).

**Target Platform**: Any modern browser reachable at `localhost:8000/yaml`

**Project Type**: Single static page within DevSuite's existing vanilla-JS multi-page app (no
build step, no framework — SPEC.md §2)

**Performance Goals**: Live validation must not visibly lag typing — met via a 600ms debounce
before re-parsing (`app.js` inline handler pattern shared with Diff/JSON tools)

**Constraints**: No CDN dependencies (SPEC.md §2); all parsing must stay client-side (privacy
mission, SPEC.md §1.1); no `innerHTML` with untrusted content (SPEC.md §7.7) — verified: all
dynamic text in `yaml.html` uses `.textContent`/Monaco APIs, never `innerHTML`

**Scale/Scope**: One HTML page, one inline script block (~200 LOC), no new dependencies, no new
backend surface

## Constitution Check

*GATE: evaluated retroactively against `.specify/memory/constitution.md` — PASS, no violations
found.*

**Core principles (I–VII):**

| Principle | Compliance |
|---|---|
| I. Spec first | Retroactively satisfied by this conversion; SPEC.md §4.3 already existed but under-described the shipped actions (see spec.md Assumptions) — flagged, not silently fixed here. |
| II. Verify against source | This plan/spec were written directly from `yaml.html` + `routes/pages.py`, not from SPEC.md prose alone. |
| III. No undocumented behavior | Route `/yaml`, no stores, no env vars, no security rules introduced by this tool. |
| IV–VII | N/A / satisfied — see checklist below. |

**Spec & security baseline**:
- [x] `specs/SPEC.md` is updated in the same commit as behavior/API/UI changes — N/A for this
      retroactive documentation pass (no behavior changed); the coordinator's SPEC.md trim happens
      in the same overall change set.
- [x] No new outbound network paths — `/yaml` makes zero network calls beyond the initial page
      load; `js-yaml` and Monaco are self-hosted under `/static/`.
- [x] Vanilla HTML/CSS/JS, no frameworks or build tools; no persistence used (N/A for DevDB).
- [x] Backend never decrypts anything here — N/A, no encrypted data involved.
- [x] No `innerHTML` with untrusted data — verified: `yaml.html` uses `textContent` and Monaco's
      model APIs exclusively; the static `<style>`/markup is authored, not user-derived.
- [x] No security-critical path (auth/CSRF/sessions/rate-limiting/PBKDF2/AES-GCM/WS/CORS proxy)
      touched by this tool — N/A, test requirement does not apply.
- [x] Version bump protocol — N/A, no behavior change in this pass.
- [x] Static-analysis gates — no findings against `yaml.html`/`app.js` YAML-specific code in
      SPEC.md §10.4's open findings list.

**New-tool / UI cross-cutting checklist**: N/A — this is a retroactive spec for an existing tool,
not a new one; tool count, asset order, CSP, WS auth, iconography, and third-party JS entries are
all already accounted for in SPEC.md §3.4/§9/§11 and unaffected by this pass.

## Project Structure

### Documentation (this feature)

```text
specs/004-yaml-linter/
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
routes/pages.py          # GET /yaml → _serve_html("yaml.html")  (lines 43-46)
static/
├── yaml.html             # page shell + inline script (all tool logic lives here)
├── linter.css            # shared two-pane layout (also used by Diff/JSON/Regex/Base64/Crypto)
├── components.js         # DevSuite.toast, DevSuite.initMonaco (shared)
├── theme.js               # theme manager (shared)
└── libs/
    ├── js-yaml.min.js     # YAML parse/dump (vendored, not read — cited only)
    ├── require.min.js     # RequireJS loader for Monaco (vendored)
    └── vs/                # Monaco Editor (vendored)
```

**Structure Decision**: matches DevSuite's established "one HTML file + shared CSS/JS" pattern for
simple tools (SPEC.md §3.2); no dedicated `yaml.js` file exists — all logic is inline in
`yaml.html`, unlike API Tester's multi-file structure. No change proposed.

## Complexity Tracking

No constitutional violations — table not required.
