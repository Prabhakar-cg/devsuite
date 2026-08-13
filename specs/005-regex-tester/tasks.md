# Tasks: Regex Tester

**Input**: Design documents from `/specs/005-regex-tester/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: NOT INCLUDED — no automated coverage exists for this tool (see quickstart.md).

**Note**: This tasks.md is retroactive — every task below describes work already completed and
shipped. Checkboxes are `[X]` throughout.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Single project: `routes/`, `static/` at repo root (per plan.md structure).

---

## Phase 1: Setup

- [X] T001 Add `GET /regex` route in `routes/pages.py` serving `static/regex.html` via
      `_serve_html()`
- [X] T002 Author `static/regex.html` page shell reusing `linter.css` two-pane layout plus an
      inline `<style>` block for regex-specific overrides (pattern input row, flag buttons, match
      list, group chips — research.md notes this as the one linter-family tool without a
      dedicated CSS file)

---

## Phase 2: Foundational

- [X] T003 Bootstrap Monaco directly via `require.config`/`require(['vs/editor/editor.main'])`
      (not through `DevSuite.initMonaco()` — research.md R1) for the test-string pane
- [X] T004 Implement local `toast()` helper (page does not load `components.js`)
- [X] T005 Implement `buildRegex(pattern, flags)` wrapping `new RegExp()` in try/catch

---

## Phase 3: User Story 1 - Test a pattern against sample text in real time (Priority: P1) 🎯 MVP

- [X] T006 [US1] Implement `runMatch()`: read pattern/flags/text, compile, collect matches via
      `exec()` loop (or single `exec()` when `g` is off)
- [X] T007 [US1] Wire 180ms debounce (`scheduleRun`) on pattern-input and editor-content-change
      events
- [X] T008 [US1] Implement Monaco `deltaDecorations` inline highlight
      (`regex-match-highlight` class) synced 1:1 with the rendered match list
- [X] T009 [US1] Implement match-pane rendering: empty state, invalid-pattern state, per-match
      rows (index, position range, length, value — "empty string" placeholder for zero-length
      matches)

**Checkpoint**: MVP — pattern testing with live highlight + list fully usable

---

## Phase 4: User Story 2 - Control matching behavior via flags (Priority: P1)

- [X] T010 [US2] Implement flag toggle buttons (`g` default-active, `i`/`m`/`s`) syncing
      `active` class + `aria-pressed` together, triggering `scheduleRun()` on toggle
- [X] T011 [US2] Implement zero-width-match `lastIndex` advance guard to prevent infinite loop
      under the `g` flag (research.md R4)

**Checkpoint**: All four flags independently toggleable and correctly affecting match results

---

## Phase 5: User Story 3 - Inspect capture groups per match (Priority: P2)

- [X] T012 [US3] Implement `appendMatchGroups()`/`buildGroupChip()` rendering numbered group
      chips (`$1`, `$2`, …) with captured value or literal `undefined`
- [X] T013 [US3] Capture `namedGroups` on every match object (`m.groups || {}`) — **not currently
      wired to any rendering path**; carried as dead capability pending a future UI addition (see
      spec.md Assumptions / SPEC.md §4.4 discrepancy)

**Checkpoint**: Numbered-group inspection usable; named-group display remains a gap

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 [P] Implement live line-count badge for the test-string editor
- [X] T015 [P] Implement Copy Matches (clipboard, newline-joined values) and Clear actions
- [X] T016 Retroactive Documentation — this spec-kit folder authored 2026-07-28 from
      `specs/SPEC.md` §4.4 + direct source inspection of `routes/pages.py` and `static/regex.html`;
      the named-group-display discrepancy is flagged in spec.md Assumptions rather than silently
      resolved

---

## Dependencies & Execution Order

- Setup (Phase 1) → Foundational (Phase 2) → US1 (Phase 3, MVP) → US2 (Phase 4, extends US1's
  `runMatch()` with flag handling) → US3 (Phase 5, extends match rendering) → Polish (Phase 6).
- T012 depends on T009 (match rendering must exist first); T010/T011 depend on T006.

## Implementation Strategy

Already shipped as a single cohesive page. A natural next increment (not yet built) would close
the named-group-display gap identified in Phase 5 — render `namedGroups` as labeled chips
alongside the numbered ones, and update SPEC.md §4.4 and this spec together per CLAUDE.md rule 3.
