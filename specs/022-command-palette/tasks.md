# Tasks: Command Palette

**Input**: Design documents from `/specs/022-command-palette/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/injected-markup.md, quickstart.md (all present)

**Tests**: Included — this project's established convention (`ws-utils.js`/`test_ws_utils.js`, `id-gen.js`/`test_id_gen.js`, `test_asset_order.py`) is pure-module unit tests plus targeted backend regression tests, so this feature follows the same pattern.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P1/P2) to enable independent implementation and testing of each.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact and absolute-relative to the repo root

---

## Phase 1: Setup

- [X] T001 [P] Create `static/command-palette-data.js`, `static/command-palette.js`, and `static/command-palette.css` as new files, each opening with a header comment matching the project's existing shared-module convention (see `static/ws-utils.js` / `static/ws-tester.js` for the split pure-module/DOM-controller header style) stating the file's purpose and that it's injected suite-wide by `deps.py::_serve_html()`, not included per-page.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story can be verified until this phase is complete — without it, the palette doesn't exist on any page yet.

- [X] T002 [P] Implement the `DESTINATIONS` array (17 entries: 15 tools + Home + Tools Hub) and the pure `matchDestinations(query, list)` function in `static/command-palette-data.js`, dual-exported (`globalThis.CommandPaletteData` for the browser, `module.exports` for node), per `data-model.md`'s field table and validation rules, using the verified name/route/category list and each tool's existing icon SVG markup (copied from `static/tools.html`'s cards) from `research.md` §6. (depends on T001)
- [X] T003 [P] Write `tests/javascript/test_command_palette_data.js` covering `matchDestinations()`: empty/whitespace query returns all 17 entries unchanged; a name-substring match; a category match; each of the shipped keyword mappings (at minimum `"uuid"` → ID Generator, `"jwt"` → Crypto Suite); a query matching nothing returns `[]`; matching is case-insensitive. Register the file in `tests/javascript/run.js`. (depends on T002)
- [X] T004 Build the palette's DOM shell in `static/command-palette.js`: construct the `<dialog>` element (with an accessible label), a search `<input>`, a results list container, and a "no matches" placeholder element (not yet wired to filtering); mount it into `document.body` once on page load; implement `open()`/`close()` via `dialog.showModal()`/`dialog.close()` guarded by an `isOpen` flag (FR-015); implement backdrop-click-to-close using the `e.target === dialog` pattern from `static/api-tester.js` (`research.md` §4). (depends on T002)
- [X] T005 Style the palette shell in `static/command-palette.css`, consuming the existing theme custom properties (`--void`, `--surface`, `--text-primary`, `--electric`, `--border`, `--radius-xl`, …) via `var(--token, fallback-hex)` so it re-themes automatically and still renders legibly on `static/db-manager.html` (which doesn't load `theme.js`); use `--radius-xl` per SPEC §9.4 ("Modals, lock cards"); gate any entrance transition behind `prefers-reduced-motion`. (depends on T004)
- [X] T006 Extend `deps.py::_serve_html()` to inject the `<link rel="stylesheet" href="/static/command-palette.css">` tag immediately after the favicon tag, and the two `<script src="/static/command-palette-data.js" defer></script>` / `<script src="/static/command-palette.js" defer></script>` tags (in that order) immediately before `</body>` — both insertions happening before the existing `_STATIC_ASSET_RE.sub(...)` call so the new references are cache-busted automatically, exactly per `contracts/injected-markup.md`. (depends on T001)
- [X] T007 [P] Write `tests/python/test_command_palette_injection.py` asserting a representative page's rendered HTML (e.g. `GET /regex`) contains all three injected tags, each carrying an 8-character `?v=` fingerprint, in the required order (CSS link in `<head>`, both scripts before `</body>`, data script before controller script). (depends on T006)

**Checkpoint**: The palette can be manually opened/closed (empty of real content/wiring) on any page — foundation ready for user-story work.

---

## Phase 3: User Story 1 - Jump to any tool from anywhere via keyboard (Priority: P1) 🎯 MVP

**Goal**: Cmd/Ctrl+K opens the palette from any page (respecting the one pre-existing conflicting binding), shows all 17 destinations with the first highlighted, arrow keys move/wrap the highlight, Enter navigates, Escape closes without navigating, it works with no auth/session, and it never double-opens.

**Independent Test**: `quickstart.md`'s "US1 — Jump to any tool from anywhere via keyboard" section — from any tool page (including a locked one), press the shortcut, arrow through, Enter, confirm navigation; press Escape from a fresh open, confirm no navigation.

### Implementation for User Story 1

- [X] T008 [US1] Render the full `DESTINATIONS` list into the results container using `createElement`/`textContent` only (never `innerHTML` with any dynamic value, per FR-012) in `static/command-palette.js`, each row showing its icon + name + category, with the first entry highlighted by default whenever the palette opens (FR-004).
- [X] T009 [US1] Wire the global Cmd/Ctrl+K `keydown` listener on `document` in `static/command-palette.js`, including the `/notes`-exemption check from `research.md` §2 (skip attaching/triggering the shortcut when `location.pathname === '/notes'`, since `static/notes.js` already owns Ctrl/Cmd+K there), and the `isOpen` guard so a second press while already open never opens a second overlapping instance (FR-001, FR-003 — no auth check anywhere in this path, FR-015).
- [X] T010 [US1] Implement Up/Down arrow-key highlight movement (wrapping at both ends of the currently-visible list) and Enter-to-navigate (`location.href = highlighted.route`) and Escape-to-close-without-navigating in `static/command-palette.js` (FR-007, FR-008, FR-009).
- [X] T011 [US1] Implement click-to-navigate on any visible result row (FR-008), and on close-without-navigation restore keyboard focus to whatever element had it before the palette opened; rely on native `dialog.showModal()` for the focus-trap-while-open requirement (FR-016, `research.md` §4).
- [X] T012 [US1] Manually verify all of US1's acceptance scenarios against a running server (throwaway `HOME`, per this project's browser-validation convention) on at least one pre-auth lock screen (e.g. `/vault` before setup) and one already-unlocked tool page, confirming the palette needs no master password or session anywhere in the flow. (depends on T008–T011)

**Checkpoint**: User Story 1 is fully functional and independently testable — this is the shippable MVP.

---

## Phase 4: User Story 2 - Narrow the list by typing (Priority: P1)

**Goal**: Typing live-filters the list against name/category/keywords, shows an explicit "no matches" state instead of a blank list, and arrow-key navigation only ever lands on a visible (filtered) entry.

**Independent Test**: `quickstart.md`'s "US2 — Narrow the list by typing" section — type `"uuid"`, confirm only ID Generator remains (a keyword match, not a name match); type something matching nothing, confirm the explicit no-matches state.

### Implementation for User Story 2

- [X] T013 [US2] Wire the search `<input>`'s `input` event in `static/command-palette.js` to call `matchDestinations()` from `static/command-palette-data.js` and re-render the results list on every keystroke, resetting `highlightedIndex` to `0` and clamping it if the filtered list shrinks below the previous highlighted position (FR-005, FR-007).
- [X] T014 [US2] Implement the explicit "no matches" placeholder (built in T004) as the rendered state whenever the filtered list is empty, replacing the results list rather than leaving it blank (FR-006).
- [X] T015 [US2] Manually verify keyword-only matches (at minimum `"uuid"` → ID Generator, `"jwt"` → Crypto Suite, plus the rest of the keyword lists authored in T002) resolve correctly end-to-end through the live UI, not just the unit test from T003 (SC-006). (depends on T013, T014)

**Checkpoint**: User Stories 1 AND 2 both work fully together — palette is genuinely fast to use, not just openable.

---

## Phase 5: User Story 3 - Discover and open via a visible trigger (Priority: P2)

**Goal**: A small, consistently-placed header control on every page opens the palette by click, identically to the keyboard shortcut, without visually colliding with existing header controls.

**Independent Test**: `quickstart.md`'s "US3 — Discover and open via a visible trigger" section — on a page you've never used the shortcut on, find and click the header control, confirm the palette opens the same way.

### Implementation for User Story 3

- [X] T016 [US3] Design and inject a small trigger control (icon + shortcut hint text, e.g. an inline-SVG search glyph + "⌘K"/"Ctrl K") via `static/command-palette.js`'s mount step in T004 — not per-page HTML — positioned consistently across structurally different headers (`static/home.html`'s marketing nav vs. a tool page's compact `.tool-header`) (FR-002).
- [X] T017 [US3] Style the trigger control in `static/command-palette.css` so it reads consistently and legibly across all 6 runtime themes and on `static/db-manager.html` (FR-002; spec Edge Cases).
- [X] T018 [US3] Manually verify the trigger's placement doesn't collide with existing header controls (theme picker, back link, status pill) on at least 3 structurally different page headers: `home.html`, a light "Apple Tool UI" tool page, and `db-manager.html`. (depends on T016, T017)

**Checkpoint**: All three user stories are independently functional — feature complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 [P] Update `specs/SPEC.md`: add a new `§9.11 Command Palette` subsection documenting the trigger/shortcut/theming contract, and add a row to the `§3.2` module-to-file map for the three new shared files — in the same commit as the implementation, per Constitution Art. I.
- [X] T020 [P] Update `.specify/memory/constitution.md`'s "Additional Constraints" tool-list sync-point note to mention `static/command-palette-data.js` as a third manually-synced copy of the destination/tool list (alongside `routes/pages.py` and `static/tools.html`), per `research.md` §6 — a PATCH amendment following the same pattern as the 2026-09-27 tool-count correction.
- [X] T021 Run the full existing test suites — `node tests/javascript/run.js` and `pytest tests/python/` — and confirm zero regressions, paying particular attention to `tests/python/test_asset_order.py` and `tests/python/test_csp.py` (the specific regression risks identified in `research.md` §5 and the Constitution Check).
- [X] T022 Using this project's headless-Chromium validation setup, take live screenshots of the palette in its open/filtered/no-matches states across at least 2 runtime themes plus `db-manager.html`, confirming legibility per SC-005 before considering the feature done.
- [X] T023 Version bump together, per Constitution Art. VII: `deps.py` `APP_VERSION`, `README.md` badge, `CHANGELOG.md` heading, `specs/SPEC.md` §1.3.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (nothing is visible/openable on any page until T006's injection lands).
- **User Stories (Phase 3–5)**: All depend on Foundational completion. US1 and US2 are both P1 and share no file-level conflicts with US3, so US3 could start in parallel with US1/US2 once Foundational is done — but US1 is the MVP and should land first for an incremental-delivery sequence.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational. No dependency on US2/US3.
- **User Story 2 (P1)**: Starts after Foundational. Builds on the render function from T008 (US1) but is independently testable once T013/T014 land — filtering is additive to, not a rewrite of, US1's rendering.
- **User Story 3 (P2)**: Starts after Foundational. Independent of US1/US2's keyboard/filter logic — it only adds a new way to *open* the palette, reusing the `open()` from T004.

### Parallel Opportunities

- T002 and T003 within Foundational are sequential (test needs the implementation), but T002/T006 (data module vs. backend injection) touch unrelated files and can run in parallel.
- T019 and T020 (Polish docs) are independent files and can run in parallel.
- Once Foundational (Phase 2) is done, US3 (Phase 5) has no file overlap with US1/US2's keyboard/filter tasks and could be staffed in parallel if desired — though sequential P1 → P1 → P2 delivery is the recommended order below.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (critical — blocks everything).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run T012's manual verification. At this point the palette is keyboard-usable suite-wide, even without filtering or a visible trigger — already a real improvement.

### Incremental Delivery

1. Setup + Foundational → palette exists but is inert.
2. User Story 1 → keyboard-driven jump-to-tool works everywhere → **MVP**.
3. User Story 2 → typing narrows the list → palette becomes fast, not just possible.
4. User Story 3 → discoverable via a visible trigger, not keyboard-only knowledge.
5. Polish → docs folded back into SPEC.md/constitution, full regression pass, visual verification, version bump.

---

## Notes

- No task in this feature touches `routes/ssh.py`, auth, CSRF, sessions, PBKDF2, or AES-GCM — the Constitution Art. VI "security paths require tests" gate is N/A here, confirmed in `plan.md`'s Constitution Check.
- `[P]` tasks are different files with no dependency on an incomplete task — verified per-task above, not assumed.
- Commit after each checkpoint (end of Phase 2, and end of each user-story phase), matching this project's spec-kit workflow.
