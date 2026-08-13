# Implementation Plan: Data Format Linter

**Branch**: `016-data-linter` | **Date**: 2026-08-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/016-data-linter/spec.md`

**Note**: Forward plan — the tool does not exist yet. This consolidates three specs
(`003-json-linter`, `004-yaml-linter`, `015-xml-linter`) into one implementation; those specs'
own functional requirements remain the source of truth for exact per-format behavior (see
spec.md FR-003–FR-005), so this plan focuses on what's *new*: the tab mechanism, shared
chrome, and backward-compatible routing.

## Summary

One new file, `static/data-linter.html`, replacing `static/json.html`, `static/yaml.html`,
and `static/xml.html`. A single Monaco input/output editor pair and shared toolbar chrome
(Clear/Paste/Copy/counts/Ctrl+Enter) serve all three formats; a JSON/YAML/XML tab strip swaps
the editor's language mode, which action buttons are visible, and which parser live validation
runs against — all client-side, no reload. One backend route function, decorated for four
paths (`/data-linter`, `/json`, `/yaml`, `/xml`), serves the same file; the client determines
the initial active tab from `location.pathname` / `?tab=`.

## Technical Context

**Language/Version**: vanilla ES2017+ JS, inline in `static/data-linter.html`

**Primary Dependencies**: Monaco Editor (`DevSuite.initMonaco`) for the shared editor shell;
`js-yaml` (`static/libs/js-yaml.min.js`, already vendored — used today by both `json.html`'s
→YAML action and all of `yaml.html`) for the YAML tab's parse/dump and the JSON tab's →YAML
conversion; native `JSON.parse`/`JSON.stringify` for the JSON tab; native
`DOMParser`/`XMLSerializer` for the XML tab (carried over verbatim from `015-xml-linter`
research.md R1–R4). **No new third-party dependency** (FR-008).

**Storage**: N/A — no DevDB store, nothing persisted, matching all three predecessors

**Testing**: None automated, matching `003-json-linter`/`004-yaml-linter`/`015-xml-linter` (all
untested today). Manual validation is `quickstart.md`; existing suites are re-run for
regression only.

**Target Platform**: any modern browser hitting `localhost:8000/data-linter` (or the legacy
`/json`, `/yaml`, `/xml` paths)

**Project Type**: static page, minimal backend route change (one function, four route
decorators, all serving the same static file — see research.md R3)

**Performance Goals**: 600ms live-validation debounce per active tab (unchanged from all three
predecessors); tab switching itself must be instant (in-memory DOM/Monaco state change, no
network round trip — FR-001).

**Constraints**: no framework, no build step; switching tabs preserves input text but resets
the output pane (spec.md Assumptions — deliberate, not an oversight); `/json`/`/yaml`/`/xml`
remain additive 200-responses, not redirects (FR-007, spec.md Assumptions).

**Scale/Scope**: one page route family (4 paths → 1 file), zero new backend logic beyond
routing, one inline script in `static/data-linter.html` combining the three predecessors'
logic (~370 + ~340 + ~430 lines of prior single-file tools, expected to land smaller than the
sum once shared chrome is deduplicated), 3 files deleted (`json.html`, `yaml.html`, `xml.html`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Core principles (I–VII):**

| Principle | Compliance |
|---|---|
| I Spec first | `specs/016-data-linter/spec.md` exists before implementation; `specs/SPEC.md` §3.2/§3.4/§4 get updated in the same commit as the code (route table, module map, and the §4 index collapsing three rows into one). `003-json-linter`/`004-yaml-linter`/`015-xml-linter` are marked Superseded, not deleted. PASS. |
| II No undocumented network paths | Zero new outbound network paths — all four routes are static page serves, same as before. PASS. |
| III Vanilla stack, no external DB | Inline vanilla JS, Monaco + already-vendored `js-yaml` only; no persistence. PASS. |
| IV Client-side encryption boundary | N/A — no secrets, no vault/SSH blob involved. |
| V DOM XSS hardening | Content set via Monaco model APIs (`setValue`, `setModelLanguage`) and `textContent`, carried over from all three predecessors; no `innerHTML` with parsed content. PASS (verify at implementation time). |
| VI Security-critical paths have tests | N/A — no auth/crypto/session/rate-limit/WS/proxy path in this tool. |
| VII Version bump protocol | Deferred to an actual release cut, matching this repo's observed practice (see `015-xml-linter/tasks.md` T021 rationale) — not done per-feature. A CHANGELOG `[Unreleased]` entry is added instead. |

**Spec & security baseline:**
- [ ] `specs/SPEC.md` §3.2 (routes), §3.4 (module map), and §4 (index) updated in the same
      commit as the implementation (Art. I) — index goes from 12 tool rows to 11 (3 collapsed
      into 1) and gets renumbered sequentially, which is safe: verified via
      `grep -rn "SPEC.md §4\."` that no code/test/doc cites a specific §4.N row as a stable
      anchor (only `§4.7.x` API-Tester-internal sub-numbering is cited elsewhere, and this
      change doesn't touch §4.7).
- [x] No new outbound network paths — all four routes are fully static, zero `fetch`/XHR/WS.
- [x] Vanilla HTML/CSS/JS, no frameworks/build tools, no DevDB.
- [x] N/A — no vault/SSH blob handling.
- [x] No `innerHTML` with untrusted data.
- [x] N/A — not an auth/CSRF/session/rate-limit/crypto/WS/proxy path.
- [ ] Version bump — deliberately deferred (see Art. VII row above); CHANGELOG
      `[Unreleased]` entry instead.
- [ ] Static-analysis gates re-run once the change lands; no findings possible yet.

**New-tool / UI cross-cutting checklist:**
- [ ] Tool count moves 13 → 11 (net −2: three cards removed, one added):
      `routes/pages.py`, `static/tools.html`, `static/home.html`, `README.md`,
      `specs/SPEC.md` all updated together.
- [x] UMD bundle order preserved — `js-yaml.min.js` still loads **before**
      `require.min.js` in `data-linter.html`, same as both predecessors that used it
      (`tests/python/test_asset_order.py` must keep passing).
- [x] N/A — no scripting/eval feature; CSP untouched.
- [x] N/A — doesn't touch `routes/ssh.py` or any WebSocket.
- [ ] Icons: the new tool card reuses/adapts a sibling card's inline-SVG icon — no emoji.
- [x] N/A — no new third-party JS.

*Re-checked after Phase 1 design below.*

## Project Structure

### Documentation (this feature)

```text
specs/016-data-linter/
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
└── pages.py            # read_json_tool/read_yaml_tool removed; the /xml route (added
                         # earlier this session) removed; one read_data_linter_tool()
                         # function stacked with @router.get for /data-linter, /json,
                         # /yaml, /xml — all serving data-linter.html (research.md R3)

static/
├── data-linter.html     # New. Combines json.html + yaml.html + xml.html's logic
├── json.html             # DELETED
├── yaml.html              # DELETED
├── xml.html                # DELETED (built earlier this session, folded in here instead)
├── linter.css            # Reused as-is — no changes needed
└── tools.html             # 3 cards (JSON/YAML/XML) -> 1 card (data-category="data")
static/home.html          # Tool-count strings updated (13 -> 11)
README.md                 # ### 2/3/13 sections merged into one; list renumbered 1-11
specs/SPEC.md              # §3.2 route table, §3.4 module map, §4 index all updated;
                            # "next feature starts at 016-" -> "017-"
```

**Structure Decision**: single self-contained HTML file with inline script, same minimal
shape as every predecessor — no new shared JS module, no new CSS file, one backend function
change. This is the smallest structure that satisfies the spec; splitting per-format logic
into separate `.js` files was considered and rejected (see research.md R1) since three fixed,
known formats don't justify a plugin-style module split.

## Complexity Tracking

No constitutional violations — table not required. Open checklist items (SPEC.md/tools.html/
home.html/README sync, version bump deferral) are implementation-phase tasks, not design-time
violations.
