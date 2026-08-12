---

description: "Task list for XML Linter & Validator (015-xml-linter)"
---

# Tasks: XML Linter & Validator

**Input**: Design documents from `/specs/015-xml-linter/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md (all present)

**Tests**: Not requested. Per `plan.md` Technical Context, this tool ships with no automated
test coverage initially, matching `003-json-linter`/`004-yaml-linter` (both untested today).
Manual validation is `quickstart.md`; existing suites are re-run for regression only (Polish
phase), not extended.

**Organization**: Tasks are grouped by user story (P1/P2/P3 from `spec.md`) so each can be
implemented and demoed independently. Everything lives in one new file, `static/xml.html`
(plus one new route line and four cross-cutting doc/asset updates), matching the JSON/YAML
linters' single-file shape — there is no `src/`/`tests/` split for this project.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files/regions, no dependency on an incomplete task)
- **[Story]**: Maps the task to US1/US2/US3 from `spec.md`
- Every task names its exact file path

---

## Phase 1: Setup

**Purpose**: Get a servable, empty page shell in place before any logic is written

- [X] T001 Create the `static/xml.html` page shell — `<head>`/meta, `linter.css` link, the
      shared DevSuite header/nav markup (copy structure from `static/json.html`), a toolbar
      with placeholder buttons (Validate, Format, Minify, Clear, Paste, Copy Output), a status
      pill element, an error panel container, and two editor-pane containers (input, output) —
      no JS logic yet, in `static/xml.html`
- [X] T002 [P] Add the `GET /xml` route serving `xml.html` in `routes/pages.py`, mirroring the
      existing `/json` and `/yaml` route blocks (`routes/pages.py:37-46`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared scaffolding every user story's logic plugs into

**⚠️ CRITICAL**: Must be complete before any User Story phase starts

- [X] T003 Wire `DevSuite.initMonaco` (`static/components.js`) to mount two Monaco editors in
      `static/xml.html` — input (writable) and output (read-only) — matching the mount
      pattern already used in `static/json.html`/`static/yaml.html` (plan.md R5)
- [X] T004 [P] Implement live character/line counters for the input editor, and a line counter
      for the output pane once populated, per FR-008, in `static/xml.html`
- [X] T005 [P] Implement shared `setStatus()` / `showOutput()` / `showError()` helper
      functions that drive the status pill (`Ready` / `Valid XML` / `Invalid XML`), the error
      panel, and the output pane — every action in later phases calls these rather than
      touching the DOM directly — in `static/xml.html`
- [X] T006 [P] Wire `DevSuite.toast` success/warning/error notifications into the helpers from
      T005, matching the toast usage already in `static/json.html`/`static/yaml.html`, in
      `static/xml.html`

**Checkpoint**: Page loads at `/xml`, both editors render, status pill shows "Ready" — no
validation logic yet.

---

## Phase 3: User Story 1 - Validate XML with precise errors (Priority: P1) 🎯 MVP

**Goal**: A user pastes XML and immediately knows whether it's well-formed, with an exact
error location if not.

**Independent Test**: Paste malformed XML (e.g. `<root><a></root>`) and confirm the error
panel shows a message within 600ms with no click; paste well-formed XML and confirm "Valid
XML ✓" on Validate. (`quickstart.md` US1 rows.)

### Implementation for User Story 1

- [X] T007 [US1] Implement `parseXml(text)` in `static/xml.html`: run
      `new DOMParser().parseFromString(text, "application/xml")`, detect failure via a
      namespaced `parsererror` element check (not try/catch — `DOMParser` never throws), and
      return `{ ok, doc }` or `{ ok: false, message }` (plan.md R2, data-model.md Validation
      Result)
- [X] T008 [US1] Wire a 600ms debounced live-validation handler on input-editor change events
      that calls `parseXml()` and updates the status pill via `setStatus()` (idle when empty,
      `Valid XML`/`Invalid XML` otherwise) per FR-002, in `static/xml.html`
- [X] T009 [US1] Implement the explicit **Validate** action (button click + `Ctrl/Cmd+Enter`
      shortcut, FR-003/FR-007): on success, re-serialize via `XMLSerializer` and show the
      result in the output pane labeled "Validated — Preview" with a success toast; on
      failure, show `message` from T007 plus the static hint "Check tag matching, attribute
      quoting, and root element count" in the error panel, with an error toast (FR-006), in
      `static/xml.html`
- [X] T010 [US1] Handle the empty-editor case for Validate: show an "Editor is empty" warning
      toast and take no further action, in `static/xml.html`

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable.

---

## Phase 4: User Story 2 - Reformat XML to a consistent style (Priority: P2)

**Goal**: A user turns minified XML into readable, indented XML, or compacts verbose XML —
without corrupting mixed text content.

**Independent Test**: Format a single-line document and confirm indented multi-line output;
minify an indented document and confirm inter-tag whitespace is gone while text content is
unchanged. (`quickstart.md` US2 rows.)

### Implementation for User Story 2

- [X] T011 [P] [US2] Implement a recursive XML pretty-printer (walks the `Document` from
      `parseXml()`, inserts/normalizes whitespace-only text nodes for 2-space-per-level
      indentation, then serializes) invoked by the **Format** button; writes to the output
      pane labeled "Formatted XML" via `showOutput()`; refuses (error panel + toast) on
      invalid input per FR-004, in `static/xml.html` (plan.md R3)
- [X] T012 [P] [US2] Implement a `TreeWalker`-based minifier (`NodeFilter.SHOW_TEXT`, removes
      only whitespace-only text nodes between element siblings; leaves CDATA, comments, and
      any non-whitespace text untouched) invoked by the **Minify** button; writes to the
      output pane labeled "Minified XML"; refuses on invalid input per FR-005, in
      `static/xml.html` (plan.md R4)
- [X] T013 [US2] Handle the empty-editor case for Format and Minify: "Nothing to format" /
      "Nothing to minify" warning toasts, no-op, in `static/xml.html`

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Clear, paste, and copy workflow (Priority: P3)

**Goal**: Supporting utility actions around the core validate/format loop.

**Independent Test**: Exercise Clear, Paste, and Copy Output and confirm each performs its
documented effect. (`quickstart.md`, "Clipboard" and general rows.)

### Implementation for User Story 3

- [X] T014 [P] [US3] Implement the **Clear** action: reset the input editor, output pane, and
      error panel to empty and the status pill to `Ready`, per FR-010, in `static/xml.html`
- [X] T015 [P] [US3] Implement the **Paste** action (`navigator.clipboard.readText()` →
      replace input editor content) with a warning-toast fallback ("paste manually with
      Ctrl+V") on permission denial, per FR-009, in `static/xml.html`
- [X] T016 [P] [US3] Implement the **Copy Output** action (`navigator.clipboard.writeText()`
      of the last-shown output text); the button stays disabled until an output has been
      produced at least once; permission denial shows the same warning-toast fallback pattern,
      per FR-009, in `static/xml.html`

**Checkpoint**: All three user stories are independently functional — the tool is
feature-complete per `spec.md`.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Ship the tool as DevSuite's 13th tool — spec/doc/asset sync required by the
constitution's tool-count-sync rule and Art. VII version-bump protocol.

- [X] T017 [P] Add a new "XML Linter & Validator" `.tool-card` (`data-category="data"`, a
      stroke-based inline SVG icon copied/adapted from a sibling card — no emoji, per
      SPEC §9.8/§9.9) to `static/tools.html`, and update its static pre-JS filter-count paint
      that `updateFilterCounts()` later recomputes from the DOM
- [X] T018 [P] Update the tool-count string/grid on `static/home.html` (12 → 13)
- [X] T019 [P] Update `README.md`'s tool count and tool list to include XML Linter & Validator
- [X] T020 Add row `4.13 | XML Linter & Validator | /xml | specs/015-xml-linter/spec.md` to
      `specs/SPEC.md` §4 index, in the same commit as the implementation (Art. I)
- [ ] T021 ~~Bump `APP_VERSION`...~~ **Deliberately deferred, not skipped by oversight.**
      Checked `git log -p -- deps.py` and `git log --oneline -- CHANGELOG.md`: the three most
      recent shipped features (Vault backup/restore, Cron day-of-month grid, API Tester proxy
      mode) all landed as `### Features` entries under `CHANGELOG.md`'s `## [Unreleased]`
      heading without touching `APP_VERSION` — this repo bumps the version once at an actual
      release cut, not per feature commit. Added this tool under `## [Unreleased]` instead
      (see CHANGELOG.md); a future release-cut commit should bump `deps.py`/README badge/
      CHANGELOG heading/`SPEC.md §1.3` together per Art. VII, covering everything accumulated
      in `[Unreleased]` at that time, not just this tool.
- [X] T022 Ran `pytest tests/python/` (42 passed) and `node tests/javascript/run.js` (41
      passed, 0 failed); `tests/python/test_asset_order.py` and `test_csp.py` re-run
      individually and pass — no new UMD bundle, no CSP change (T007 uses only native
      `DOMParser`/`XMLSerializer`).
- [~] T023 Partially done. No interactive-browser tool is available in this session, so the
      full manual click-through of `quickstart.md` (Monaco rendering, live typing, clipboard
      permission prompts) was **not** performed — this is a real gap, not a claimed pass.
      What *was* verified via FastAPI's `TestClient`: `GET /xml` returns 200 with the expected
      title/markup/`DOMParser` usage and a CSP with no `unsafe-eval` and `connect-src 'self'`;
      every asset `xml.html` references (`linter.css`, `theme.js`, `components.js`,
      `require.min.js`, `fonts.css`, and Monaco's vendored `xml-*.js` language chunk) resolves
      to 200. The `parseXml`/`formatXmlDoc`/`minifyXmlDoc` logic was traced by hand against
      each `quickstart.md` row (mismatched tags, multiple roots, DOCTYPE/comment/CDATA/PI,
      mixed-content minify, round-trip) but not executed, since no `DOMParser` exists outside
      a real browser (Node has none; no `jsdom`/browser-automation dependency is available or
      appropriate to add for this). **Recommend the user open `/xml` in a browser and walk
      `quickstart.md` before considering this tool fully verified.**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 (needs the page shell to mount editors into).
  Blocks every user story.
- **User Stories (Phase 3-5)**: All depend on Phase 2 completion. US1 (Phase 3) is the MVP;
  US2 and US3 depend only on Phase 2, not on each other or on US1 — they may proceed in any
  order once Phase 2 is done, though US1 is recommended first since it's the tool's reason to
  exist and US2/US3 are easier to demo against known-valid input.
- **Polish (Phase 6)**: Depends on all three user stories being complete (T017-T023 describe
  the finished tool).

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on US2/US3. Fully demoable alone (validate-only tool).
- **User Story 2 (P2)**: No dependency on US1/US3 at the code level (T011/T012 only need
  `parseXml()` from T007 to exist as a function signature, which Phase 2 could stub — in
  practice, build after US1 since T007 lives in that phase).
- **User Story 3 (P3)**: No dependency on US1/US2 — Clear/Paste/Copy operate on the editors
  from Phase 2 alone.

### Within Each User Story

- T007 (parse) before T008/T009 (both call `parseXml()`).
- T008/T009 before T010 (empty-input guard wraps the same action).
- T011 and T012 are independent of each other (different functions, same file) — both need
  T007 from Phase 3.
- T014/T015/T016 are mutually independent.

### Parallel Opportunities

- T002 (backend route) can run in parallel with T001 (frontend shell) — different files.
- T004, T005, T006 (Phase 2) touch different regions of `xml.html` and can be done in
  parallel once T003 (editor mount) exists.
- T011 and T012 (Phase 4) are parallel — separate functions, both consumers of T007.
- T014, T015, T016 (Phase 5) are parallel — separate functions.
- T017, T018, T019 (Phase 6 doc/asset updates) are parallel — different files.

---

## Parallel Example: Phase 4 (User Story 2)

```bash
Task: "Implement recursive XML pretty-printer for the Format button in static/xml.html"
Task: "Implement TreeWalker-based minifier for the Minify button in static/xml.html"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational).
2. Complete Phase 3 (US1 — Validate).
3. **STOP and VALIDATE**: run the US1 rows of `quickstart.md` manually.
4. This alone is a shippable, useful tool — a well-formedness checker with live feedback.

### Incremental Delivery

1. Setup + Foundational → editors render, nothing validates yet.
2. Add US1 → validate-only tool → demo/checkpoint.
3. Add US2 → format/minify → demo/checkpoint.
4. Add US3 → clear/paste/copy → demo/checkpoint.
5. Polish (Phase 6) → tool count, SPEC.md row, version bump, regression tests, quickstart
   walkthrough → ship as DevSuite's 13th tool.

---

## Notes

- Every implementation task lands in the same file, `static/xml.html` (plus the one-line
  route in `routes/pages.py` from T002) — `[P]` here means "independent region/function," not
  "different file," except where noted (T002, T017-T019).
- No test-writing tasks were generated (see **Tests** note above); T022 re-runs the *existing*
  suites for regression only.
- Commit after each task or logical group, per repo convention (propose the commit message and
  wait for approval — CLAUDE.md "What NOT to Do").
