# Tasks: Notes Workspace

**Input**: Design documents from `/specs/017-notes-workspace/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/notes-api.md, quickstart.md (all present)

**Tests**: Not blanket-requested by the spec, but Constitution Art. VI requires tests for security-relevant paths, and `plan.md`'s Constitution Check already commits to specific test tasks (the new `/api/notes` endpoints, the asset-load-order gotcha, and the pure link/tag/search logic). Those are included below; broad UI/browser tests are out of scope per CLAUDE.md ("Browser/e2e tests are still a v1.0.0 deliverable").

**Organization**: Tasks are grouped by user story (spec.md P1/P2/P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task in the same batch)
- **[Story]**: Which user story this task belongs to (US1/US2/US3)
- File paths are exact, relative to the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Vendor the one new dependency and scaffold every new file this feature touches.

- [X] T001 [P] Vendor DOMPurify as `static/libs/dompurify.min.js` (research.md item 5) — self-hosted, no CDN reference anywhere.
- [X] T002 [P] Add `"notes"` to `_ALLOWED_STORES` in `deps.py` (line ~178) so DevDB Manager's generic store browser (`routes/db.py`) can list/back up/restore the new store.
- [X] T003 [P] Add `GET /notes` route in `routes/pages.py` serving `static/notes.html` via `_serve_html("notes.html")`, following the exact pattern of every existing tool route (e.g. the `/ssh` route).
- [X] T004 [P] Create `static/notes.html` skeleton: header (matching other tools' `.app-header`/`.tool-identity` pattern), script/link tags for `style.css`, `theme.js`, `auth-guard.js`, `marked.min.js`, `dompurify.min.js`, `require.min.js` (Monaco loader) — **`marked.min.js` and `dompurify.min.js` must appear before `require.min.js`** (UMD-before-RequireJS gotcha, CLAUDE.md) — and `notes.css`/`notes-links.js`/`notes.js`.
- [X] T005 [P] Create `static/notes.css` skeleton: layout shell (tree sidebar / tab strip / editor pane / backlinks panel / tag browser regions) built entirely on `static/style.css`'s shared design tokens — no hardcoded hex colors (the exact defect just fixed in `static/ssh-manager.css` this session).
- [X] T006 [P] Create `static/notes-links.js` skeleton: a pure-logic module with a Node/browser dual export, mirroring `static/toon.js`'s export pattern — this file will hold every function that's unit-testable without a DOM (wiki-link parsing, title index, backlinks, tags, search).
- [X] T007 [P] Create `static/notes.js` skeleton: the DOM-wiring entry point (unlock flow, Monaco integration, tree orchestration, autosave) that consumes `notes-links.js`.

**Checkpoint**: All new files exist; no behavior yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The encrypted storage round-trip and page shell every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T008 Implement `GET /api/notes` and `POST /api/notes` in `routes/storage.py`, byte-for-byte mirroring `get_vault`/`save_vault` (`require_unlocked`, `deps._db.get_store("notes")` / `set_store("notes", data)` / `deps._db.save()`), per `contracts/notes-api.md`.
- [X] T009 [US-shared] `tests/python/test_notes_api.py`: 401 without a session, 200 round-trip (POST then GET returns the same opaque blob), persists across requests — mirrors the existing vault API test file's structure. Depends on T008.
- [X] T010 [P] Extend `tests/python/test_asset_order.py` with an assertion that `/notes` loads `dompurify.min.js` and `marked.min.js` before `require.min.js` (same pattern as the existing `jszip.min.js`/`crypto-js.min.js` checks). Depends on T004.
- [X] T011 In `static/notes.js`, implement the unlock flow via `AuthGuard.init('Notes Workspace')` plus the v2 WebCrypto key derivation and AES-256-GCM encrypt/decrypt functions, mirroring `static/vault.js`'s `_deriveMasterKeysV2`/`encryptVaultGCM`/`decryptVaultGCM` exactly (research.md items 2–3). Depends on T007.
- [X] T012 In `static/notes.js`, implement `loadNotesTree()` (GET `/api/notes` → decrypt → in-memory tree, or initialize an empty tree + fresh salt if none exists yet) and debounced `saveNotesTree()` (800ms after last edit, re-encrypt the whole tree, POST `/api/notes`; also flushes on tab close/switch) per `research.md` item 7 and `data-model.md` §4–5. Depends on T011, T008.
- [X] T013 In `static/notes.html`/`static/notes.js`, implement the base page shell: tree sidebar region, tab strip region, editor pane placeholder, and the zero-notebook empty state (spec.md Edge Cases). Depends on T012.

**Checkpoint**: Unlocking `/notes` loads (or initializes) an encrypted, empty workspace and shows the empty state. Foundation ready — user stories can now begin.

---

## Phase 3: User Story 1 - Capture and organize notes (Priority: P1) 🎯 MVP

**Goal**: Notebook → Section → Page organization plus a working multi-tab Markdown editor with autosave — a complete, useful notes app on its own.

**Independent Test**: Create a notebook, two sections, three pages across them; edit content; reload; confirm hierarchy and content persisted exactly.

- [X] T014 [P] [US1] In `static/notes-links.js`, implement `normalizeTitle(title)` and `isTitleAvailable(tree, title, excludePageId)` per `data-model.md` §3's uniqueness rule (FR-013). Depends on T006.
- [X] T015 [US1] Implement Notebook CRUD (create/rename/delete, with the delete-cascade confirmation from spec.md Edge Cases) in `static/notes.js` + sidebar tree UI in `static/notes.html`/`notes.css`. Depends on T013.
- [X] T016 [US1] Implement Section CRUD + drag-to-reorder (`Notebook.sectionOrder`) in `static/notes.js`/`notes.html`/`notes.css`. Depends on T015.
- [X] T017 [US1] Implement Page CRUD + drag-to-reorder (`Section.pageOrder`) in `static/notes.js`/`notes.html`/`notes.css`, using T014's `isTitleAvailable` to reject duplicate titles on create/rename. Depends on T016, T014.
- [X] T018 [US1] Wire the Monaco Editor (Markdown mode, reusing the already-vendored `static/libs/vs/markdown-*.js` chunk) into the editor pane for the currently active page, feeding keystrokes into T012's debounced `saveNotesTree()`. Depends on T013.
- [X] T019 [US1] Implement multi-tab UI in `static/notes.js`/`notes.html`/`notes.css`: open/switch/close tabs, per-tab scroll+cursor position, title truncation with ellipsis, empty-state on last-tab-close. Depends on T018.
- [X] T020 [P] [US1] `tests/javascript/test_notes_links.js`: unit tests for `normalizeTitle`/`isTitleAvailable` (T014); register the new file in `tests/javascript/run.js`'s `TEST_FILES` array. Depends on T014.
- [ ] T021 [US1] Manual validation: run `quickstart.md` steps 1–3. Depends on T017, T019.

**Checkpoint**: User Story 1 is fully functional and testable independently — a working Notepad++/OneNote-style notes app, no linking yet.

---

## Phase 4: User Story 2 - Cross-reference notes with wiki-links and backlinks (Priority: P2)

**Goal**: `[[wiki-links]]` with autocomplete and create-on-link, plus an automatic backlinks panel — the Obsidian-style differentiator.

**Independent Test**: Link page A to page B via `[[Page B]]`; confirm it's clickable and navigates; confirm B's backlinks panel lists A.

- [X] T022 [P] [US2] In `static/notes-links.js`, implement `parseWikiLinks(body)`, `buildTitleIndex(tree)`, and `resolveLink(title, titleIndex)` (case-insensitive/trimmed match, per `data-model.md` §3 "Derived: Wiki-link index"). Depends on T006 (and logically follows T014/T020 in the same file, but has no functional dependency on them).
- [X] T023 [US2] In `static/notes-links.js`, implement `buildBacklinksIndex(tree)` (the inverse view, with per-reference context snippets). Depends on T022 (same file, sequential).
- [X] T024 [US2] Wire a `[[` autocomplete dropdown into the Monaco editor in `static/notes.js`, sourced from T022's title index, ranked by match quality. Depends on T022, T018.
- [X] T025 [US2] Render resolved vs. unresolved wiki-links with visually distinct styling in the editor/preview (`static/notes.js`/`notes.css`). Depends on T022.
- [X] T026 [US2] Implement create-on-link in `static/notes.js`: activating an unresolved `[[Title]]` link creates and opens a new empty page titled "Title" (via T017's Page-create path) and resolves every link pointing at that title. Depends on T017, T022.
- [X] T027 [US2] Implement rename propagation in `static/notes.js`: renaming a page rewrites every `[[OldTitle]]` occurrence across the tree to `[[NewTitle]]` before the next save (FR-011). Depends on T022.
- [X] T028 [US2] Verify/implement delete handling in `static/notes.js`: deleting a page removes only its own entry (per `data-model.md` §5 "Delete") — referencing pages' bodies are left untouched, so their links naturally show as unresolved via T023's index (FR-012). Depends on T023.
- [X] T029 [US2] Implement the backlinks panel UI (list of referencing pages + snippet, click-to-navigate) in `static/notes.html`/`notes.css`/`notes.js`. Depends on T023.
- [X] T030 [P] [US2] `tests/javascript/test_notes_links.js`: unit tests for `parseWikiLinks`/`buildTitleIndex`/`resolveLink`/`buildBacklinksIndex`, including a rename-propagation case and an unresolved-after-delete case. Depends on T022, T023.
- [ ] T031 [US2] Manual validation: run `quickstart.md` step 4. Depends on T024, T025, T026, T027, T028, T029.

**Checkpoint**: User Stories 1 AND 2 both work independently — notes are now a connected graph, not just a filing cabinet.

---

## Phase 5: User Story 3 - Tag and search across the workspace (Priority: P3)

**Goal**: Inline `#tags`, a tag browser, workspace-wide full-text search, and in-page find & replace.

**Independent Test**: Tag two pages with the same tag; confirm the tag browser lists both; search for a word unique to one page; confirm only it's returned.

- [X] T032 [P] [US3] In `static/notes-links.js`, implement `extractTags(body)` and `buildTagIndex(tree)` (`#word` regex scan, per `data-model.md` §3 "Derived: Tag index"). Depends on T006 (follows T022/T023/T030 in the same file, no functional dependency on them).
- [X] T033 [US3] In `static/notes-links.js`, implement `searchNotes(tree, query)` returning matching pages with a context snippet per match (linear scan, per `research.md` item 6). Depends on T032 (same file, sequential).
- [X] T034 [US3] Implement the tag browser UI (all tags in use; selecting one lists its pages) in `static/notes.html`/`notes.css`/`notes.js`. Depends on T032.
- [X] T035 [US3] Implement the search palette UI (query input, results with snippets, click-to-open) in `static/notes.html`/`notes.css`/`notes.js`. Depends on T033.
- [X] T036 [US3] Enable and wire Monaco's built-in find & replace widget (`Ctrl+F`/`Ctrl+H`) for the active page editor in `static/notes.js`. Depends on T018.
- [X] T037 [P] [US3] `tests/javascript/test_notes_links.js`: unit tests for `extractTags`/`buildTagIndex`/`searchNotes` (multi-term queries, zero-result case). Depends on T032, T033.
- [ ] T038 [US3] Manual validation: run `quickstart.md` step 5. Depends on T034, T035, T036.

**Checkpoint**: All three user stories are independently functional — the full Notepad++ / OneNote / Obsidian feature set is in place.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: The mechanical integration steps CLAUDE.md flags as easy to drop, plus release-readiness checks.

- [X] T039 [P] Add a Notes Workspace card to `static/tools.html`; update its static filter counts to match what `updateFilterCounts()` recomputes at runtime (12 → 13 tools).
- [X] T040 [P] Update the tool count in `static/home.html` (12 → 13).
- [X] T041 [P] Update the tool count/list in `README.md` (12 → 13).
- [X] T042 [P] Update `specs/SPEC.md`: §4 tool index (add Notes Workspace row), §5 (document `GET/POST /api/notes`), §6 (document the `notes` DevDB store shape), §11.3 (add the `dompurify.min.js` row).
- [X] T043 [P] Update `UPGRADE_PLAN.md`'s vendored-JS inventory table with the new DOMPurify row.
- [ ] T044 Theme sweep: verify `/notes` renders correctly under all 6 DevSuite themes (`theme.js`); fix any hardcoded-color regressions found in `notes.css`. Depends on T039–T038 (all UI built).
- [X] T045 No-emoji / inline-SVG-icon audit of `static/notes.html` and everything `static/notes.js` generates, mirroring the audit already applied to `static/ssh-manager.html` this session (FR-019). Depends on all UI tasks.
- [ ] T046 Manual validation: run `quickstart.md` step 6 end-to-end (theme sweep, emoji audit, DB Manager store visibility, tool-count consistency, and the DOMPurify XSS check — typing `<img src=x onerror=alert(1)>` into a page and confirming no script execution in preview). Depends on T042, T044, T045.
- [ ] T047 Version bump for release: `deps.py` `APP_VERSION`, `README.md` badge, `CHANGELOG.md` heading, `specs/SPEC.md` §1.3 — bumped together per Constitution Art. VII. Depends on T046 passing.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — all 7 tasks parallelizable.
- **Foundational (Phase 2)**: Depends on Setup completion — **BLOCKS all user stories**.
- **User Stories (Phase 3–5)**: All depend on Foundational (Phase 2) completion. Independently testable once it's done; below they're listed in priority order (P1 → P2 → P3) since P2/P3 build richer UI on top of P1's tree/tab/editor shell, but a second implementer could start P2 or P3 immediately after Foundational if they're comfortable stubbing P1's UI.
- **Polish (Phase 6)**: Depends on whichever user stories are in scope for this release being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational. This is the MVP.
- **User Story 2 (P2)**: Depends on Foundational; T026 additionally depends on US1's T017 (page creation) since create-on-link creates a page. Otherwise independent of US1's UI specifics.
- **User Story 3 (P3)**: Depends on Foundational; T036 additionally depends on US1's T018 (the Monaco instance find/replace attaches to). Otherwise independent.

### Within Each User Story

- Pure-logic (`notes-links.js`) tasks before the UI tasks that consume them.
- Tree/tab/editor shell (US1) before link/tag features that render inside it (US2/US3 both assume an open, editable page).
- Story complete (checkpoint) before considering the next priority done.

### Parallel Opportunities

- All 7 Setup tasks (T001–T007) — different files, no dependencies.
- T010 (asset-order test) can run parallel to T008/T009 (backend) — different concern, only depends on T004.
- T014 (`notes-links.js` title validation) can run parallel to T015–T018 (`notes.js`/`notes.html` CRUD/editor) — different file.
- T020, T030, T037 (JS unit test additions) can each run parallel to that phase's UI-wiring tasks — different file from `notes.js`.
- Phase 6's documentation tasks (T039–T043) are all different files — fully parallelizable.

---

## Parallel Example: Setup Phase

```bash
# Launch all Setup tasks together — 7 independent files:
Task: "Vendor DOMPurify as static/libs/dompurify.min.js"
Task: "Add \"notes\" to _ALLOWED_STORES in deps.py"
Task: "Add GET /notes route in routes/pages.py"
Task: "Create static/notes.html skeleton"
Task: "Create static/notes.css skeleton"
Task: "Create static/notes-links.js skeleton"
Task: "Create static/notes.js skeleton"
```

## Parallel Example: User Story 1

```bash
# T014 (different file) can run alongside the notes.js/html/css chain:
Task: "Implement normalizeTitle/isTitleAvailable in static/notes-links.js"
# ...while T015-T019 proceed sequentially in notes.js/notes.html/notes.css
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (encrypted storage round-trip + page shell — CRITICAL, blocks everything).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run `quickstart.md` steps 1–3 independently.
5. This is already a complete, shippable notes app (Notepad++ editor + OneNote-style organization) even with zero wiki-link/tag/search work done.

### Incremental Delivery

1. Setup + Foundational → encrypted, empty workspace loads and unlocks.
2. Add User Story 1 → validate → demo-able MVP.
3. Add User Story 2 → validate → notes are now a linked graph.
4. Add User Story 3 → validate → tags + search complete the feature set.
5. Phase 6 → tool-count/doc sync, theme sweep, security check, version bump → ready to ship.

### Notes on Test Scope

Per CLAUDE.md, DevSuite's JS test suite covers pure modules only (no browser/DOM
tests yet) — that's why every test task above targets `notes-links.js`
(pure functions) or the Python API layer, not Monaco/DOM interactions. The
one security-sensitive DOM behavior this feature adds (DOMPurify sanitizing
Markdown-rendered HTML) is validated manually via `quickstart.md` step 6
(T046) rather than an automated test, consistent with the project not yet
having browser/e2e test infrastructure.
