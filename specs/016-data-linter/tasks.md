---

description: "Task list for Data Format Linter (016-data-linter)"
---

# Tasks: Data Format Linter

**Input**: Design documents from `/specs/016-data-linter/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md,
quickstart.md (all present)

**Tests**: Not requested. Matches `003-json-linter`/`004-yaml-linter`/`015-xml-linter` (all
untested today) — no automated coverage planned initially. Manual validation is
`quickstart.md`; existing suites are re-run for regression only (Polish phase).

**Organization**: Tasks are grouped by user story (P1/P2/P3 from `spec.md`). Because this
feature is a *consolidation* of three already-specified formats behind one shared tab
mechanism, US1 (tab switching) and US2 (validate) are more tightly coupled than a typical
independent-story split — this is called out explicitly in Dependencies below rather than
papered over.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files/regions, no dependency on an incomplete task)
- **[Story]**: Maps the task to US1–US5 from `spec.md`
- Every task names its exact file path

---

## Phase 1: Setup

**Purpose**: Get a servable, empty page shell — with all three formats' markup present but
inert — plus the consolidated backend route, in place before any logic is written.

- [X] T001 Create the `static/data-linter.html` page shell: `<head>`/meta,
      `linter.css` link, `js-yaml.min.js` loaded **before** `require.min.js` (CLAUDE.md
      UMD-order gotcha, research.md R4), the shared DevSuite header/nav, a JSON/YAML/XML
      tab strip above the action toolbar, every action button from all three predecessors
      present in the toolbar tagged with a `data-tabs="json yaml xml"`-style attribute
      (research.md R2) — e.g. Sort Keys gets `data-tabs="json"`, Format gets
      `data-tabs="json yaml xml"` — a status pill, an error panel, and the two editor-pane
      containers (input, output). No JS logic yet, in `static/data-linter.html`
- [X] T002 [P] In `routes/pages.py`, remove `read_json_tool`/`read_yaml_tool` (currently
      serving `json.html`/`yaml.html`) and the `/xml` route added earlier this session
      (currently serving `xml.html`); add one `read_data_linter_tool()` function stacked
      with four `@router.get(...)` decorators — `/data-linter`, `/json`, `/yaml`, `/xml` —
      all calling `_serve_html("data-linter.html")` (research.md R3)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared scaffolding and the *mechanical* half of tab switching (language mode,
button visibility, initial-tab resolution) — everything every user story needs, before any
format-specific validation logic exists.

**⚠️ CRITICAL**: Must be complete before any User Story phase starts

- [X] T003 Wire `DevSuite.initMonaco` to mount the single shared input (writable) and output
      (read-only) Monaco editor pair in `static/data-linter.html`, matching the mount pattern
      from `static/json.html`/`static/yaml.html`/`static/xml.html`
- [X] T004 [P] Implement shared `setStatus()` / `showOutput()` / `showError()` / `resetOutput()`
      helpers in `static/data-linter.html` — `resetOutput()` is factored out as its own
      function (research.md R5) so both Clear (Phase 7) and tab switching (Phase 3) can call
      it without duplicating the four DOM writes
- [X] T005 [P] Implement live character/line counters for the input editor, and a line
      counter for the output pane once populated, in `static/data-linter.html`
- [X] T006 [P] Wire `DevSuite.toast` into the helpers from T004, matching existing toast usage
      in the three predecessor tools, in `static/data-linter.html`
- [X] T007 Implement `resolveInitialTab()` (reads `location.pathname` — `/yaml`→`yaml`,
      `/xml`→`xml`, anything else including `/data-linter` and `/json`→`json` — then an
      optional `?tab=json|yaml|xml` override, falling back to `json` for any unrecognized
      value, research.md R3/FR-007) and the *mechanical* half of `setActiveTab(tab)`: toggles
      `.active` on the tab-strip buttons, calls
      `monaco.editor.setModelLanguage(inputModel, tab)`, shows/hides action buttons by
      checking each button's `data-tabs` attribute (research.md R2). Call
      `setActiveTab(resolveInitialTab())` once on load. **Does not yet reset output or
      re-validate** — that's Phase 3 (US1), which extends this same function. In
      `static/data-linter.html`

**Checkpoint**: Page loads at all four routes; the tab strip visibly switches the editor's
language mode and which buttons show; no validation is wired yet.

---

## Phase 3: User Story 1 - Switch formats instantly without losing your place (Priority: P1)

**Goal**: Switching tabs preserves the input text, resets the output pane, and re-validates
against the newly active format — all without a page reload.

**Independent Test**: Paste text on the JSON tab, click the YAML tab, confirm the text is
unchanged, the editor is now in YAML mode, and the output pane (if it had content) is empty.
(`quickstart.md` US1 rows.)

### Implementation for User Story 1

- [X] T008 [US1] Implement `parseJson(raw)`, `parseYaml(raw)`, and `parseXml(raw)` as three
      separate functions, ported near-verbatim from `003-json-linter`, `004-yaml-linter`, and
      `015-xml-linter` respectively (research.md R1 — no shared abstraction), plus a
      `getActiveParser()` that returns the correct one for the current `activeTab`, in
      `static/data-linter.html`
- [X] T009 [US1] Extend `setActiveTab(tab)` from T007 to also call `resetOutput()` from T004
      (completes Acceptance Scenario 2: output pane resets on switch) and to cancel any
      in-flight live-validation debounce timer and restart it against `getActiveParser()` for
      the newly active tab, re-evaluating the *current* (unchanged) input text (completes
      Acceptance Scenario 3), in `static/data-linter.html`
- [X] T010 [US1] Confirm the input editor uses exactly one shared Monaco model referenced by
      all three tabs (already true by construction from T003 — no separate model per tab is
      ever created), so Acceptance Scenario 1 (text unchanged across switches) holds
      structurally rather than needing its own preserve/restore logic

**Checkpoint**: Switching tabs preserves input, resets output, and re-validates against the
new format's parser — User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Validate the active format with precise errors (Priority: P1)

**Goal**: On whichever tab is active, Validate (live or explicit) reports that format's
validity with a specific, actionable error when it fails.

**Independent Test**: On each tab in turn, paste that format's malformed content and confirm
an error appears live (within 600ms) and via the explicit Validate button; paste valid content
and confirm a "Valid" status. (`quickstart.md` US2 rows.)

### Implementation for User Story 2

- [X] T011 [US2] Implement the explicit **Validate** action (button click + `Ctrl/Cmd+Enter`,
      shared across all tabs per FR-006) dispatching to `getActiveParser()` from T008: on
      success, produce each format's own preview exactly as its predecessor did — JSON's
      pretty-printed preview, YAML's re-dumped preview, XML's `XMLSerializer` preview — with a
      success toast; on failure, show that format's own error message plus its existing
      remediation hint in the error panel, with an error toast, in `static/data-linter.html`
- [X] T012 [US2] Handle the empty-editor case for Validate (shared across all tabs): an
      "Editor is empty" warning toast, no-op, in `static/data-linter.html`

**Checkpoint**: Validate works correctly and shows the right format-specific errors on all
three tabs — User Stories 1 and 2 are both fully functional.

---

## Phase 5: User Story 3 - Use each format's own transforms (Priority: P2)

**Goal**: Every transform action from the three standalone tools is available, unchanged, on
its corresponding tab.

**Independent Test**: On each tab, exercise every action that tab exposes and confirm the
output matches what the corresponding standalone tool's `quickstart.md` documents for the same
input. (`quickstart.md` US3 rows + "Regression check against predecessors.")

### Implementation for User Story 3

- [X] T013 [P] [US3] Port the JSON tab's Format, Minify, Sort Keys, and → YAML actions
      near-verbatim from `003-json-linter` (`static/json.html`), wired to the buttons already
      tagged `data-tabs="json"` from T001, in `static/data-linter.html`
- [X] T014 [P] [US3] Port the YAML tab's Format, → JSON, and → JSON (min) actions
      near-verbatim from `004-yaml-linter` (`static/yaml.html`), wired to the buttons already
      tagged `data-tabs="yaml"` from T001, in `static/data-linter.html`
- [X] T015 [P] [US3] Port the XML tab's Format and Minify actions near-verbatim from
      `015-xml-linter` (`static/xml.html`) — including the mixed-content/CDATA-safety logic —
      wired to the buttons already tagged `data-tabs="xml"` from T001, in
      `static/data-linter.html`
- [X] T016 [US3] Handle the empty-editor case for every transform action across all three
      tabs, matching each predecessor's existing "Nothing to format/minify/sort/convert"
      warning toasts, in `static/data-linter.html`

**Checkpoint**: All nine transform actions (4 JSON + 3 YAML + 2 XML) work identically to their
predecessors — User Stories 1–3 are functional.

---

## Phase 6: User Story 4 - Old bookmarks still land on the right tab (Priority: P2)

**Goal**: `/json`, `/yaml`, `/xml` keep working exactly as before consolidation; `/data-linter`
is the new discoverable primary route.

**Independent Test**: Visit `/json`, `/yaml`, `/xml`, `/data-linter`, and
`/data-linter?tab=xml` directly (not via `/tools`) and confirm each returns 200 with the
correct tab pre-selected and no redirect. (`quickstart.md` US4 rows.)

### Implementation for User Story 4

- [X] T017 [US4] Verify `resolveInitialTab()` (T007) correctly resolves all five entry points
      from the Independent Test above, including the unrecognized-`?tab=`-value fallback to
      `json` (spec.md Edge Cases) — extend it if any case isn't already covered, in
      `static/data-linter.html`
- [X] T018 [US4] Confirm all four routes from T002 return HTTP 200 with no `Location` header
      (i.e. genuinely serve the page rather than redirecting) — this holds by construction of
      the stacked-decorator route, but verify it explicitly (e.g. via `curl -I` or the
      `TestClient` checks used for `015-xml-linter`)

**Checkpoint**: Legacy bookmarks and the new primary route all work — User Stories 1–4 are
functional.

---

## Phase 7: User Story 5 - Clear, paste, and copy workflow (Priority: P3)

**Goal**: Shared utility actions behave identically regardless of which tab is active.

**Independent Test**: On any tab, exercise Clear, Paste, and Copy Output and confirm each
performs its documented effect. (`quickstart.md` US5 row.)

### Implementation for User Story 5

- [X] T019 [P] [US5] Implement **Clear**: resets the input editor, output pane, and error
      panel to empty and the status pill to `Ready`, regardless of active tab (reuses
      `resetOutput()` from T004), in `static/data-linter.html`
- [X] T020 [P] [US5] Implement **Paste** (`navigator.clipboard.readText()` → input editor)
      with a warning-toast fallback on permission denial, shared across tabs, in
      `static/data-linter.html`
- [X] T021 [P] [US5] Implement **Copy Output** (`navigator.clipboard.writeText()` of the last
      output), disabled until an output has been produced at least once, with the same
      permission-denied fallback pattern, in `static/data-linter.html`

**Checkpoint**: All five user stories are independently functional — the tool is
feature-complete per `spec.md`.

---

## Phase 8: Polish & Cross-Cutting Concerns (Migration + Docs)

**Purpose**: Retire the three predecessor tools and sync every cross-cutting doc/asset — this
phase is larger than usual because it's a *consolidation*, not a pure addition.

- [X] T022 Delete `static/json.html`, `static/yaml.html`, and `static/xml.html` — their logic
      now lives in `static/data-linter.html` (plan.md Project Structure)
- [X] T023 [P] Replace the three `.tool-card`s (JSON Linter, YAML Linter, XML Linter) in
      `static/tools.html` with one "Data Format Linter" card (`data-category="data"`); update
      the `all`/`data` filter counts (13→11 / 5→3... → **1**, net one card in the data
      category) and the `qa-stats-strip` "N tools" count
- [X] T024 [P] Update the tool-count strings on `static/home.html` (13 → 11, all three
      occurrences)
- [X] T025 [P] In `README.md`, merge the JSON Linter, YAML Linter, and XML Linter `### N.`
      sections into one "Data Format Linter" section (documenting all nine actions across
      three tabs) and renumber the "Supported Tools" list sequentially 1–11
- [X] T026 Update `specs/SPEC.md`: §3.2 file tree and route table (replace `json.html` /
      `yaml.html` / `xml.html` and their three route rows with `data-linter.html` and one row
      covering all four routes — SSH's multi-route row is the existing precedent), §3.4
      module map (replace the JSON/YAML/XML rows with one "Data Format Linter" row), §4 index
      (collapse the JSON/YAML/XML rows into one row, renumber 4.1–4.11 sequentially — verified
      safe in plan.md's Constitution Check, no code cites a specific §4.N as a stable anchor),
      the three "N tool(s)" count mentions (13 → 11), and "next feature starts at `016-`" →
      "`017-`"
- [X] T027 Add a `CHANGELOG.md` `## [Unreleased]` entry describing the consolidation — no
      `APP_VERSION` bump, matching this repo's observed release cadence (documented rationale
      in `015-xml-linter/tasks.md` T021)
- [X] T028 Run `pytest tests/python/` and `node tests/javascript/run.js`; confirm both suites
      pass, with particular attention to `test_asset_order.py` (js-yaml-before-require.js
      ordering, research.md R4) and `test_csp.py`
- [X] T029 Walk every row of `specs/016-data-linter/quickstart.md` manually in a browser,
      including the "Regression check against predecessors" section — feed each of the nine
      transform actions the same input its predecessor's own `quickstart.md` used and confirm
      byte-identical output (the concrete check behind SC-002)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1. Blocks every user story — in particular,
  T007's tab-switching *mechanism* is a hard prerequisite for all of US1–US5, since nothing
  else can be tested without knowing which tab is active.
- **User Stories (Phase 3-7)**: Unlike a typical spec-kit feature, **US1 and US2 are tightly
  coupled here, not independent** — US1's "re-validate on switch" (T009) calls the same
  `getActiveParser()`/parse functions that US2's Validate action (T011) uses (both introduced
  by T008). Build them together/adjacently even though they're listed as separate phases.
  US3 (transforms), US4 (legacy routes), and US5 (Clear/Paste/Copy) are genuinely independent
  of each other and of US1/US2 once Phase 2 + T008 exist, and may proceed in any order.
- **Polish (Phase 8)**: Depends on all five user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 (T007) and needs T008 (parsers) for its
  re-validate-on-switch behavior — see note above.
- **User Story 2 (P1)**: Depends on Phase 2 and T008 (parsers, built as part of US1's phase).
  Practically ships alongside US1.
- **User Story 3 (P2)**: Depends only on Phase 2 (tab mechanism + button visibility already
  wired by T007) — does not need T008's parsers to exist first, though building it after
  US1/US2 is natural since the parse functions already exist by then.
- **User Story 4 (P2)**: Depends only on Phase 2 (T002's routes, T007's `resolveInitialTab`).
- **User Story 5 (P3)**: Depends only on Phase 2 (T004's `resetOutput`, T003's editors).

### Within Each User Story

- T008 (parsers) before T009 (re-validate-on-switch) and before T011 (Validate action).
- T007 before T009 (extends the same function).
- T013/T014/T015 are independent of each other (different tabs' buttons, same file).
- T019/T020/T021 are independent of each other.

### Parallel Opportunities

- T001 (frontend shell) and T002 (backend route) — different files.
- T004, T005, T006 (Phase 2) — different regions of `data-linter.html`, once T003 exists.
- T013, T014, T015 (Phase 5) — independent per-tab action sets.
- T019, T020, T021 (Phase 7) — independent shared actions.
- T023, T024, T025 (Phase 8 doc/asset updates) — different files.

---

## Parallel Example: Phase 5 (User Story 3)

```bash
Task: "Port JSON tab's Format/Minify/Sort Keys/→YAML actions in static/data-linter.html"
Task: "Port YAML tab's Format/→JSON/→JSON(min) actions in static/data-linter.html"
Task: "Port XML tab's Format/Minify actions in static/data-linter.html"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational).
2. Complete Phase 3 (US1) and Phase 4 (US2) together — they share T008's parsers and are
   listed separately only for spec traceability, not because they can ship independently.
3. **STOP and VALIDATE**: run the US1 and US2 rows of `quickstart.md` manually.
4. This alone is a shippable validate-only tool across three formats with instant switching —
   arguably more useful than the XML linter's own MVP, since it replaces two existing tools'
   core value plus adds the switching win.

### Incremental Delivery

1. Setup + Foundational → tab strip switches modes/buttons, nothing validates yet.
2. Add US1 + US2 together → validate-only, all three formats, instant switching → checkpoint.
3. Add US3 → all nine transforms → checkpoint.
4. Add US4 → legacy routes verified → checkpoint.
5. Add US5 → Clear/Paste/Copy → checkpoint.
6. Polish (Phase 8) → delete predecessors, sync every doc/asset, regression-check against all
   three predecessors' quickstarts → ship, net tool count 13 → 11.

---

## Phase 9: Extension — any-to-any conversion + TOON format (post-ship)

**Purpose**: Close the gap where XML had no conversion actions at all and JSON/YAML only
converted to each other — every tab now converts to every other tab, including a new 4th
format, TOON (FR-010/FR-011/FR-012, User Story 6).

- [X] T030 Add a first-party TOON encoder/decoder (`toonEncode`/`toonDecode`) implementing a
      subset of the published spec — comma delimiter, 2-space indent, tabular arrays for
      uniform flat-object arrays, list form otherwise (research.md R6, FR-011) — in
      `static/data-linter.html`. Verified against 14+ round-trip cases including the spec's own
      canonical tabular example, standalone in Node before integration.
- [X] T031 Add a corrected object↔XML bridge (`jsonToXmlEl`/`xmlToJsonValue`) that wraps named
      array fields in their own element (fixing a field-name-loss bug found in
      `013-file-converter`'s existing `jsonToXml`/`xmlToJson` — research.md R7/R8, FR-012), in
      `static/data-linter.html`.
- [X] T032 Add the canonical-value conversion hub (`toCanonicalValue`/`fromCanonicalValue`,
      research.md R6) and replace the JSON tab's → YAML and YAML tab's → JSON / → JSON (min)
      buttons with four symmetric "Convert to <format>" buttons shown on every tab except the
      one matching the active format (FR-010), in `static/data-linter.html`.
- [X] T033 Add the TOON tab: 4th tab-strip button, Monaco language mapped to `yaml` (no native
      TOON tokenizer), Validate/Format wired to the TOON parser/encoder, `?tab=toon` query-param
      support (no bare `/toon` route — FR-007), in `static/data-linter.html`.
- [X] T034 Update `specs/016-data-linter/spec.md` (FR-001/002/006/007/008 tab-count wording,
      new FR-010/011/012, new User Story 6, updated User Story 3 scenarios, new SC-005, new
      Edge Cases and Assumptions), `research.md` (R6-R8), `data-model.md` (Canonical Value
      entity), `quickstart.md` (new US3/US6/US4 rows), and `contracts/http-api.md` (TOON
      query-param note, first-party-not-vendored note).
- [X] T035 Re-run `pytest tests/python/` and `node tests/javascript/run.js` (unaffected — no
      backend route or pure-module change) to confirm no regression.

---

## Phase 10: Extension — format auto-detection on paste (post-ship, User Story 7)

**Purpose**: Offer to switch to the right tab the moment new content arrives via paste, without
ever overriding manual tab selection (FR-012, User Story 7).

- [X] T036 Implement `detectFormat(raw)` and its priority chain (XML → TOON-with-bracket-header
      → JSON → YAML-if-structured → TOON-generic → XML-fallback, research.md R9) plus
      `looksLikeToonHeader()`/`isStructuredValue()` helpers, in `static/data-linter.html`.
      Verified against 13 hand-picked cases in Node first (including the real vendored
      `js-yaml` bundle loaded via `require()`), including the two deliberately-ambiguous cases.
- [X] T037 Implement `detectAndSwitch()` and wire it to three triggers only — the toolbar Paste
      button, Monaco's `onDidPaste` (native Ctrl/Cmd+V), and a new toolbar Detect button — never
      to `onDidChangeModelContent` (research.md R10), in `static/data-linter.html`.
- [X] T038 Add the Detect button (paired with Paste in the input pane header) with its own
      toast messaging (confident switch / already-correct confirmation / not-confident
      warning), in `static/data-linter.html`.
- [X] T039 Update `specs/016-data-linter/spec.md` (new FR-012, new User Story 7, new SC-006, new
      Edge Cases and Assumptions, Detected Format key entity), `research.md` (R9-R10),
      `data-model.md` (Detected Format entity), and `quickstart.md` (new US7 rows).
- [X] T040 Re-run `pytest tests/python/` and `node tests/javascript/run.js`, and a live route
      smoke-check (`/data-linter` returns 200 with the Detect button present) to confirm no
      regression.

---

## Notes

- Every implementation task lands in `static/data-linter.html` except T002 (backend route)
  and the Phase 8 doc/asset updates.
- No test-writing tasks were generated (see **Tests** note above); T028 re-runs the *existing*
  suites for regression only.
- T022 (deleting the three predecessor files) should land in the **same commit** as the rest
  of this feature, not a separate cleanup commit — otherwise there's a window where both the
  old and new tools exist and could drift.
- Commit after each logical group, per repo convention (propose the commit message and wait
  for approval — CLAUDE.md "What NOT to Do").
