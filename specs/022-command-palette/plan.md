# Implementation Plan: Command Palette

**Branch**: `022-command-palette` | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-command-palette/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

A global Cmd/Ctrl+K overlay, injected centrally by the backend into every page response
(no per-page HTML edits), that lists the 15 tools plus Home and Tools Hub, filters live as
the user types against name/category/keywords, and navigates via arrow keys + Enter or a
click. Built as two new vanilla-JS files (a pure, node-testable data/matching module and a
DOM controller using native `<dialog>`) plus one new CSS file, wired in by extending
`deps.py::_serve_html()` — the same function that already auto-injects the favicon tag —
so the feature ships with zero edits to any of the 18 existing static HTML pages.

## Technical Context

**Language/Version**: JavaScript (vanilla, browser-native ES2020+) for the client module;
Python 3.10+ for the one backend change (`deps.py::_serve_html()`).

**Primary Dependencies**: None new. Native `<dialog>` element, native CSS custom
properties already defined by `static/theme.js`'s 6-theme system. No third-party JS.

**Storage**: N/A — the destination list is static data shipped in the client module, not
fetched from the server and not persisted per-user.

**Testing**: `tests/javascript/run.js` (new pure-module test for the matching/filter
function, node-testable with zero dependencies, mirroring `static/ws-utils.js` /
`static/id-gen.js`); `tests/python/` (new test verifying `_serve_html()` injects the
expected tags, correctly cache-busted, into a representative page's response).

**Target Platform**: Any evergreen browser (Chrome/Edge/Firefox/Safari) against the
existing FastAPI/Uvicorn backend — no new platform surface.

**Project Type**: Existing single-project web application (DevSuite itself) — this is
suite-wide chrome, not a new service or a split frontend/backend project.

**Performance Goals**: Palette opens within one rendered frame of the keypress/click;
filtering 17 static in-memory entries on every keystroke has no perceptible latency
(no debouncing needed at this data size).

**Constraints**: No new outbound network path (Constitution Art. II); no new inline
`<script>` tags — the injected script references must be external files with `defer`,
never inline, per the existing SEC-11 "do not add more inline scripts" debt rule;
cache-busting must stay automatic via the existing `_STATIC_ASSET_RE` mechanism in
`_serve_html()`, not a manual version string.

**Scale/Scope**: 17 static destination entries; 2 new static files
(`command-palette-data.js`, `command-palette.js`) + 1 new CSS file
(`command-palette.css`); one modified backend function (`_serve_html()`); zero
modified HTML files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Confirm this feature upholds every applicable principle in `.specify/memory/constitution.md`.
Record PASS/violation for each; a violation requires an entry in Complexity Tracking with a
documented justification.

**Core principles (I–VII):**

- **I. Spec First** — PASS. `spec.md` written and validated before this plan; `specs/SPEC.md`
  §9 (new subsection) and §3.2 (module-to-file map) will be updated in the same commit as
  the implementation, per the New-tool checklist below.
- **II. Local-Only, Offline-First** — PASS. No new outbound network path of any kind: the
  destination list is static client-side data, navigation targets are all existing
  same-origin DevSuite routes, and no request is made to open/filter/close the palette.
- **III. Vanilla Stack, Single Store** — PASS. Two new plain JS files + one CSS file, no
  framework, no build step, no new persistence (DevDB untouched).
- **IV. Client-Side Encryption Boundary** — N/A. The feature touches no vault/SSH blob,
  no master password, no session token — FR-003 explicitly requires it work with **no**
  auth/session at all, on the lock screen itself.
- **V. DOM and CSP Hardening** — PASS. Rendering uses `createElement`/`textContent` only
  (FR-012); the injected tags are external `<script src="...">`/`<link>` references with
  `defer`, never an inline `<script>` block, so this does not widen or add to the SEC-11
  inline-script debt; no `unsafe-eval` is introduced or needed.
- **VI. Security Paths Require Tests** — N/A. No auth, CSRF, session, rate-limiting,
  PBKDF2, AES-GCM, WebSocket-gate, or CORS-proxy code is touched. The one backend change
  (`_serve_html()`) is still covered by a new regression test (below) as good hygiene, not
  because SPEC §10.2 classifies it as security-critical.
- **VII. Versioning Discipline** — PASS (deferred to ship step). `APP_VERSION` /
  README badge / CHANGELOG heading / SPEC §1.3 bump happens together at ship time per the
  existing protocol; cache-busting for the two new static files is automatic via the
  existing `_STATIC_ASSET_RE` substitution in `_serve_html()` — no manual version string.

**Spec & security baseline**:
- [x] `specs/SPEC.md` updated in the same commit (§9 new subsection, §3.2 map row).
- [x] No new outbound network paths; no CDN assets.
- [x] Vanilla HTML/CSS/JS, no frameworks/build tools; no new persistence.
- [x] N/A — no vault/SSH/session code touched (Art. IV).
- [x] No `innerHTML` with untrusted data; no `unsafe-eval`; no new inline `<script>`.
- [x] N/A — no auth/CSRF/session/rate-limit/PBKDF2/AES-GCM/WS-gate/CORS-proxy change (Art. VI).
- [x] Version bump deferred to ship step, done together per protocol; cache-busting automatic.
- [x] Static-analysis gates targeted green (no new hotspots expected — no eval, no dynamic
      HTML injection, no new external dependency).

**New-tool / UI cross-cutting checklist**:
- [x] N/A for tool count — this is not a 16th tool (spec Assumptions); `specs/SPEC.md`
      §3.2's module-to-file map still gains a row for the two new shared files, tracked in
      Phase 1 design and the ship-time doc-sync task.
- [x] N/A — no UMD bundle involved; new `<script>` tags are appended immediately before
      `</body>`, after all existing page scripts, so `tests/python/test_asset_order.py`'s
      existing relative-order assertions (UMD-vs-require, components-vs-vault) are
      unaffected — verified in Phase 0 research and re-checked with a new dedicated test.
- [x] N/A — no scripting/eval feature; CSP is unaffected since the new files are
      served same-origin under the existing `script-src 'self'` (already covers external
      same-origin scripts without needing `'unsafe-inline'` or `'unsafe-eval'`).
- [x] N/A — `routes/ssh.py` untouched.
- [x] Icons are stroke-based inline SVG reused from `static/tools.html`'s existing tool
      cards, no emoji; palette styling consumes `static/theme.js`'s existing CSS custom
      properties (`--void`, `--surface`, `--text-primary`, `--electric`, `--radius-xl`, …)
      with hex fallbacks for the one page without the theme system (`db-manager.html`).
- [x] N/A — no new third-party JS.

**Additional conflict found in Phase 0 research** (not a constitution violation, but a
real pre-existing keybinding that the design must not regress): `static/notes.js` already
binds Ctrl/Cmd+K to its own in-page "search notes" modal. Resolution documented in
`research.md`.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
static/
├── command-palette-data.js   # NEW — pure, dual-export (browser global + node require):
│                              #   DESTINATIONS array (17 entries) + matchDestinations(query, list)
│                              #   filter function. No DOM. Mirrors static/ws-utils.js / static/id-gen.js.
├── command-palette.js        # NEW — DOM controller: builds the <dialog>, mounts the header
│                              #   trigger button, wires Cmd/Ctrl+K (with the notes.js exemption),
│                              #   arrow/Enter/Escape, backdrop-click-to-close, renders results via
│                              #   createElement/textContent using command-palette-data.js.
└── command-palette.css       # NEW — palette visual styling via existing theme CSS custom
                               #   properties, var(--token, fallback) for db-manager.html.

deps.py                       # MODIFIED — _serve_html() gains injection of the CSS <link> (near
                               #   the favicon tag) and the two <script defer> tags (before </body>),
                               #   ahead of the existing _STATIC_ASSET_RE cache-busting pass so the
                               #   new references get fingerprinted automatically like every other asset.

specs/SPEC.md                 # MODIFIED — §9 gains §9.11 "Command Palette"; §3.2 module-to-file
                               #   map gains a row for the three new shared files.

tests/javascript/
├── test_command_palette_data.js   # NEW — node test for matchDestinations() against name/
│                                  #   category/keyword queries, empty query, no-match query.
└── run.js                          # MODIFIED — registers the new test file.

tests/python/
└── test_command_palette_injection.py   # NEW — asserts a representative page's rendered HTML
                                          # contains the CSS link and both script tags, each
                                          # carrying a ?v= cache-busting fingerprint, and that
                                          # existing test_asset_order.py assertions still hold.
```

**Structure Decision**: Existing DevSuite single-project layout (no frontend/backend split —
this *is* the one web application). All new files live under the existing `static/` tree
that already holds every shared module (`components.js`, `theme.js`, `ws-utils.js`, …); the
one backend touch point is the existing shared `_serve_html()` helper in `deps.py`, not a
new route or module.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
