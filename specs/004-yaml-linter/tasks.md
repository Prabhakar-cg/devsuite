# Tasks: YAML Linter & Validator

**Input**: Design documents from `/specs/004-yaml-linter/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: NOT INCLUDED — no automated coverage exists for this tool (see quickstart.md); adding
it is future work, not retroactively fabricated here.

**Note**: This tasks.md is retroactive — every task below describes work already completed and
shipped. Checkboxes are `[X]` throughout.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Single project: `routes/`, `static/` at repo root (per plan.md structure).

---

## Phase 1: Setup

- [X] T001 Add `GET /yaml` route in `routes/pages.py` serving `static/yaml.html` via `_serve_html()`
- [X] T002 Author `static/yaml.html` page shell reusing `static/linter.css` two-pane layout and
      `static/theme.js`

---

## Phase 2: Foundational

- [X] T003 Load `js-yaml.min.js` via a plain `<script>` tag before `require.min.js` (avoids the
      UMD/AMD ordering hazard — research.md R2)
- [X] T004 Bootstrap Monaco editors (input + read-only output) via `DevSuite.initMonaco()`

---

## Phase 3: User Story 1 - Validate YAML with precise errors (Priority: P1) 🎯 MVP

- [X] T005 [US1] Implement `parseYaml()` wrapping `jsyaml.loadAll` with try/catch → `{ok, data|error}`
- [X] T006 [US1] Wire live validation on a 600ms debounce (`inputEditor.onDidChangeModelContent`)
- [X] T007 [US1] Implement explicit **Validate** button: re-dump preview on success, error panel +
      toast on failure
- [X] T008 [US1] Implement error panel (message + static hint) and status pill states
      (idle/valid/invalid)

**Checkpoint**: MVP — validation fully usable

---

## Phase 4: User Story 2 - Reformat YAML (Priority: P2)

- [X] T009 [US2] Implement **Format** button: `jsyaml.dump(data, {indent:2, lineWidth:120,
      quotingType:'"'})`, refuses on invalid input

---

## Phase 5: User Story 3 - Convert YAML to JSON (Priority: P2)

- [X] T010 [US3] Implement **→ JSON** button (pretty, `JSON.stringify(data, null, 2)`)
- [X] T011 [US3] Implement **→ JSON (min)** button (`JSON.stringify(data)`)

**Checkpoint**: All three conversion actions usable

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T012 [P] Implement char/line counters, Clear, Paste, Copy Output actions
- [X] T013 [P] Wire `Ctrl/Cmd+Enter` keyboard shortcut to Validate
- [X] T014 Retroactive Documentation — this spec-kit folder (`spec.md`, `plan.md`, `tasks.md`,
      `research.md`, `data-model.md`, `quickstart.md`, `contracts/http-api.md`,
      `checklists/requirements.md`) authored 2026-07-28 from `specs/SPEC.md` §4.3 + direct source
      inspection of `routes/pages.py` and `static/yaml.html`; two SPEC.md discrepancies flagged in
      spec.md Assumptions rather than silently resolved

---

## Dependencies & Execution Order

- Setup (Phase 1) → Foundational (Phase 2) → US1 (Phase 3, MVP) → US2/US3 (Phases 4-5, both
  depend only on US1's `parseYaml()`) → Polish (Phase 6).
- T009/T010/T011 are independent of each other (different button handlers, same `parseYaml()`
  dependency) and could have been built in parallel.

## Implementation Strategy

Already shipped as a single cohesive page; no incremental rollout was needed given the tool's
small scope. Future changes should still follow MVP-first sequencing (validation before
format/convert) if the tool is extended.
