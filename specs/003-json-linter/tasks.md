# Tasks: JSON Linter & Formatter

**Input**: Design documents from `/specs/003-json-linter/`

**Tests**: none retrofitted — no behavior is changing in this documentation pass.

**Organization**: grouped by user story. All tasks are marked done — reconstructed from
source, not forward work.

## Format: `[ID] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Add `GET /json` route serving `static/json.html` (`routes/pages.py`)
- [X] T002 Load Monaco via `DevSuite.initMonaco` + RequireJS + `js-yaml.min.js`
      (`static/json.html:11, 127-131`)

---

## Phase 2: Foundational

- [X] T003 Create writable input editor + read-only output editor/model
      (`static/json.html:161-184`)
- [X] T004 Implement `parseJson()` and `sortKeysDeep()` pure helpers
      (`static/json.html:137-153`)
- [X] T005 Wire status pill / char+line counters / error panel show-clear helpers
      (`static/json.html:186-222`)

**Checkpoint**: editors and helpers ready

---

## Phase 3: User Story 1 - Live validation (P1) 🎯 MVP

- [X] T006 [US1] Wire 600ms-debounced `liveValidate()` on input change
      (`static/json.html:236-250`)
- [X] T007 [US1] Wire explicit "Validate" button + `Ctrl/Cmd+Enter` shortcut producing a
      pretty-printed preview on success (`static/json.html:253-267, 358-364`)

---

## Phase 4: User Story 2 - Format / minify / sort keys (P1)

- [X] T008 [US2] Wire "Format" button → 2-space pretty-print into output pane
      (`static/json.html:270-280`)
- [X] T009 [US2] Wire "Minify" button → whitespace-free output (`static/json.html:283-293`)
- [X] T010 [US2] Wire "Sort Keys" button → `sortKeysDeep()` output
      (`static/json.html:296-306`)
- [X] T011 [US2] Guard all three actions against invalid/empty input with error
      panel + toast, no output mutation

---

## Phase 5: User Story 3 - Convert to YAML (P2)

- [X] T012 [US3] Wire YAML conversion via `jsyaml.dump()`, switching output pane syntax to
      `yaml` (`static/json.html:309-324`)

---

## Phase 6: User Story 4 - Clear / paste / copy (P3)

- [X] T013 [US4] Wire "Clear" resetting both editors and UI state
      (`static/json.html:327-338`)
- [X] T014 [US4] Wire "Paste" via `navigator.clipboard.readText()` with permission-denied
      fallback toast (`static/json.html:341-347`)
- [X] T015 [US4] Wire output copy button via `navigator.clipboard.writeText()`
      (`static/json.html:350-356`)

---

## Phase 7: Retroactive Documentation

- [X] T016 Author `specs/003-json-linter/{spec,plan,tasks,data-model,quickstart,
      research}.md`, `contracts/http-api.md`, `checklists/requirements.md` from SPEC.md
      §4.2 + direct source inspection (2026-07-28); flag the missing-undo-stack claim and
      the undocumented YAML-conversion action found during verification.

---

## Dependencies & Execution Order

- Setup → Foundational → US1 (MVP) → US2/US3/US4 all build independently on the
  Foundational editors/helpers and can be done in any order.
- All phases already complete.
