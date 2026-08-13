# Implementation Plan: XML Linter & Validator

**Branch**: `015-xml-linter` | **Date**: 2026-08-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/015-xml-linter/spec.md`

**Note**: Forward plan — the tool does not exist yet. Designed to be the smallest possible
addition consistent with the constitution: reuse the JSON/YAML linter shape exactly, add zero
new dependencies and zero new backend logic.

## Summary

A fully client-side XML well-formedness validator/formatter, structurally identical to
`003-json-linter` and `004-yaml-linter`: two Monaco editors (input, writable; output,
read-only) inside a single self-executing inline `<script>` in a new `static/xml.html`. No
backend endpoint beyond serving the page — `GET /xml` returns the static file, exactly like
`GET /json` and `GET /yaml`. Parsing uses the browser's native `DOMParser`/`XMLSerializer`,
so no new library is vendored.

## Technical Context

**Language/Version**: vanilla ES2017+ JS, inline in `static/xml.html`

**Primary Dependencies**: Monaco Editor (via `DevSuite.initMonaco`, `static/components.js` +
`static/libs/vs` + RequireJS) for the two-pane editor shell — the same mechanism `json.html`
and `yaml.html` already use. XML parsing/serialization uses the browser's built-in
`DOMParser` and `XMLSerializer` — **no new third-party library**, so no `specs/SPEC.md §11`
or `UPGRADE_PLAN.md` update is triggered.

**Storage**: N/A — no DevDB store, nothing persisted, matching JSON/YAML linters

**Testing**: `tests/javascript/run.js` currently only covers `curl-codegen.js`,
`cookie-jar.js`, `collection-utils.js` — the JSON/YAML linters have no automated test
coverage either (documented as a gap in their own specs' Assumptions). This plan keeps parity
rather than introducing a coverage requirement the sibling tools don't meet; see Complexity
Tracking — not a constitutional violation since Art. VI only mandates tests for
auth/CSRF/session/rate-limit/crypto/WS/proxy paths, none of which this tool touches.

**Target Platform**: any modern browser hitting `localhost:8000/xml`

**Project Type**: static page, zero backend logic beyond page serving

**Performance Goals**: 600ms debounce on live validation (matches FR-002 and the JSON/YAML
linters' existing debounce), so `DOMParser` doesn't re-run on every keystroke

**Constraints**: no framework, no build step; Format/Minify/Validate write only to the
separate read-only output pane, never back into the input editor — same two-pane
never-mutate-input pattern as JSON/YAML (spec.md Assumptions); DOCTYPE accepted syntactically
but never resolved (no network fetch of external DTDs — browsers don't do this via
`DOMParser` regardless, so this is a statement of existing platform behavior, not new code)

**Scale/Scope**: one page route (`GET /xml`), zero backend endpoints beyond page serving, one
inline script in `static/xml.html`, sized comparably to `json.html` (~370 lines) /
`yaml.html` (~340 lines)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Core principles (I–VII):**

| Principle | Compliance |
|---|---|
| I Spec first | `specs/015-xml-linter/spec.md` exists and is written before any implementation code; `specs/SPEC.md` §4 index gets a new row (4.13) in the same commit that ships the tool. PASS. |
| II No undocumented network paths | Zero new outbound network paths — `GET /xml` is a static page serve, same as `/json`/`/yaml`. PASS. |
| III Vanilla stack, no external DB | Inline vanilla JS, Monaco (already vendored) only; no persistence. PASS. |
| IV Client-side encryption boundary | N/A — no secrets, no vault/SSH blob involved. |
| V DOM XSS hardening | Content set via Monaco model APIs (`setValue`) and `textContent` for status/error text, matching `json.html`/`yaml.html`; no `innerHTML` with parsed XML content. PASS (verify at implementation time). |
| VI Security-critical paths have tests | N/A — no auth/crypto/session/rate-limit/WS/proxy path in this tool. |
| VII Version bump protocol | Shipping this tool bumps `APP_VERSION` (minor bump — new user-facing tool), README badge, CHANGELOG heading, and SPEC §1.3 together, per Art. VII. Tracked as a tasks.md item, not yet done. |

**Spec & security baseline:**
- [ ] `specs/SPEC.md` §4 index gets row 4.13 pointing at this spec, in the same commit as the
      implementation (Art. I).
- [x] No new outbound network paths — page is fully static, zero `fetch`/XHR/WS calls.
- [x] Vanilla HTML/CSS/JS, no frameworks/build tools, no DevDB.
- [x] N/A — no vault/SSH blob handling.
- [x] No `innerHTML` with untrusted data — Monaco `setValue` + `textContent` only, per FR-001–FR-010.
- [x] N/A — not an auth/CSRF/session/rate-limit/crypto/WS/proxy path.
- [ ] Version bump (`deps.py` `APP_VERSION`, README badge, CHANGELOG, SPEC §1.3) — deferred to
      the implementation tasks, not yet done.
- [ ] Static-analysis gates (SonarCloud/CodeQL/CodeRabbit/Snyk) re-run once the new file lands;
      no findings possible yet since no code exists.

**New-tool / UI cross-cutting checklist:**
- [ ] Tool count moves 12 → 13: `routes/pages.py` (new `/xml` route), `static/tools.html`
      (new card, `data-category="data"`, plus its static pre-JS filter-count paint),
      `static/home.html`, `README.md`, `specs/SPEC.md` all updated together.
- [x] N/A — no UMD bundle involved (DOMParser is a browser built-in, not a vendored script);
      asset-order test unaffected.
- [x] N/A — no scripting/eval feature; CSP untouched, no `script-sandbox-worker.js` involvement.
- [x] N/A — doesn't touch `routes/ssh.py` or any WebSocket.
- [ ] Icons: new tool card in `tools.html` uses a stroke-based inline SVG icon (no emoji), per
      the existing card pattern — to be copied from a sibling card's `<svg>` markup.
- [x] N/A — no new third-party JS; `DOMParser`/`XMLSerializer` are native browser APIs.

*Re-checked after Phase 1 design below — no new violations introduced by data-model/contracts.*

## Project Structure

### Documentation (this feature)

```text
specs/015-xml-linter/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── http-api.md       # Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root, planned)

```text
routes/
└── pages.py           # + GET /xml -> xml.html (mirrors the /json, /yaml route blocks)

static/
├── xml.html            # New. Page markup + the entire tool's logic (inline <script>)
├── linter.css           # Reused as-is — shared two-pane layout with JSON/YAML/Diff/Regex/Crypto
└── tools.html           # + one new .tool-card (data-category="data")
static/home.html         # Tool-count string updated (12 -> 13)
README.md                # Tool-count prose / tool list updated
specs/SPEC.md             # §4 index: new row 4.13; §1.3 version bump on release
```

**Structure Decision**: single self-contained HTML file with inline script, reusing
`linter.css` unmodified — the same minimal shape as `003-json-linter` and `004-yaml-linter`.
No new CSS file, no new shared JS module, no backend router changes beyond one new page route
function. This is the simplest option that satisfies the spec; no alternative structure was
considered necessary.

## Complexity Tracking

No constitutional violations — table not required. The only open items are checklist
line-items still pending *implementation* (version bump, SPEC.md row, tool-count sync), not
design-time violations; they are captured as tasks in Phase 2 (`/speckit-tasks`), not as
justified complexity here.
