# Tasks: Cron Visualizer

**Input**: Design documents from `/specs/010-cron-visualizer/`

**Note**: Retroactive task log. The feature already shipped; every task below is marked `[X]`
and phrased as what was built, reconstructed from `routes/pages.py` and
`static/cron.{html,js,css}`. This is not a forward execution plan.

**Tests**: NONE — no automated coverage exists for this tool (see quickstart.md Coverage note);
all validation is manual.

## Format: `[ID] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Add page route `GET /cron` → `cron.html` in `routes/pages.py`
- [X] T002 Scaffold `static/cron.html` / `static/cron.css` layout: input, status pill, field
      builder, next-runs panel, heatmap, preset list, export controls

---

## Phase 2: Foundational (shared parsing engine)

- [X] T003 Define `DIALECTS` data (unix, quartz, aws, github: fields, ranges, capability flags,
      example, placeholder) in `static/cron.js`
- [X] T004 Implement `CronParser` (dialect-aware field-count check, per-field range/token
      validation, field-attributed error reporting) in `static/cron.js`
- [X] T005 [P] Implement `CronDescriber` (natural-language description from a parsed
      expression) in `static/cron.js`
- [X] T006 [P] Define `PRESETS` per dialect in `static/cron.js`

**Checkpoint**: parsing/description engine ready for all four dialects

---

## Phase 3: User Story 1 - Validate and understand an expression (Priority: P1) 🎯 MVP

- [X] T007 [US1] `CronVisualizer` controller: bind input/status pill/description elements,
      debounced live re-parse on input (`_parseAndUpdate`) — `static/cron.js`
- [X] T008 [US1] Per-field tokenized chip rendering with color coding — `static/cron.js`
- [X] T009 [US1] Invalid-state rendering: red status pill + field-specific error text —
      `static/cron.js`

**Checkpoint**: paste-and-validate flow usable standalone

---

## Phase 4: User Story 2 - Multi-dialect support (Priority: P1)

- [X] T010 [US2] Dialect selector buttons with `aria-pressed` sync (`_renderDialect`,
      dialect-button click handlers) — `static/cron.js`, `static/cron.html`
- [X] T011 [US2] Re-instantiate `CronParser` and refresh field builder/preset list on dialect
      switch — `static/cron.js`

**Checkpoint**: all four dialects independently selectable and correctly scoped

---

## Phase 5: User Story 3 - Visual Field Builder (Priority: P2)

- [X] T012 [US3] Click-to-toggle grids for Minute/Hour/Day-of-Month/Month/Day-of-Week —
      `static/cron.js`, `static/cron.html`
- [X] T013 [US3] Grid → text sync (toggle rewrites the corresponding raw-expression field) —
      `static/cron.js`
- [X] T014 [P] [US3] Text → grid sync (valid parse re-renders builder cell state) —
      `static/cron.js`

**Checkpoint**: bidirectional sync verified in both directions

---

## Phase 6: User Story 4 - Next run times & activity heatmap (Priority: P2)

- [X] T015 [US4] Brute-force minute-iteration next-10-runs search with locale
      date/time + relative countdown formatting — `static/cron.js`
- [X] T016 [P] [US4] 28-Day Activity Heatmap rendering (CSS grid calendar, intensity shading,
      hover tooltip) — `static/cron.js`, `static/cron.css`

**Checkpoint**: concrete upcoming-run feedback available for any valid expression

---

## Phase 7: User Story 5 - Presets & export (Priority: P3)

- [X] T017 [US5] Preset list rendering + click-to-load (`presetList` binding) — `static/cron.js`
- [X] T018 [P] [US5] Raw-expression clipboard copy (`copyExprBtn`) — `static/cron.js`
- [X] T019 [P] [US5] Export as GitHub Actions/Kubernetes CronJob YAML (`copyYamlBtn`) —
      `static/cron.js`
- [X] T020 [P] [US5] Export as AWS EventBridge JSON (`copyJsonBtn`) — `static/cron.js`

**Checkpoint**: full preset + export surface available

---

## Phase 8: Retroactive Documentation

- [X] T021 Author `specs/010-cron-visualizer/{spec,plan,research,data-model,quickstart,tasks}.md`
      and `contracts/http-api.md` (2026-07-28), grounded in `routes/pages.py` and
      `static/cron.{html,js,css}` — no code changes made

---

## Dependencies & Execution Order (as originally built)

- Phase 2 (parsing engine) is a hard prerequisite for every user story — nothing downstream can
  render without a `ParsedExpression`.
- US1 (validate/describe) is the MVP; US2 (dialects) is co-primary since the parser is
  dialect-parameterized from the start (R2 in research.md) rather than retrofitted.
- US3 (visual builder) depends on US1's parser output shape (structured per-field values, not
  just pass/fail).
- US4 (next-runs/heatmap) depends on US1 (only runs against a valid `ParsedExpression`).
- US5 (presets/export) is independent of US3/US4 mechanically but assumes US1/US2 for
  load-and-revalidate behavior.
