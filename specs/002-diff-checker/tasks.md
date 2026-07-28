# Tasks: Diff Checker

**Input**: Design documents from `/specs/002-diff-checker/`

**Tests**: not previously included for this tool (see plan.md Constitution Check); no test
tasks are retrofitted here since no behavior is changing.

**Organization**: grouped by user story, mirroring spec.md. All tasks below are marked done
— they describe what already shipped, reconstructed from source, not forward work.

## Format: `[ID] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Add `GET /diff` route serving `static/index.html` (`routes/pages.py`)
- [X] T002 Add shared two-pane layout styling `static/linter.css`

---

## Phase 2: Foundational

- [X] T003 Load Monaco Editor via RequireJS (`static/libs/vs`) and JSZip
      (`static/libs/jszip.min.js`) in `static/index.html`
- [X] T004 Implement `countLines()`, `formatSize()`, `getLanguageFromPath()` helpers
      (`static/app.js:39-86`)

**Checkpoint**: editors load, helpers available — user-story work can build on this

---

## Phase 3: User Story 1 - Compare two text snippets (P1) 🎯 MVP

- [X] T005 [US1] Create Original/Modified Monaco editors and wire the Compare button +
      `Ctrl/Cmd+Enter` shortcut (`static/app.js:665-670`)
- [X] T006 [US1] Implement live Diff Stats Bar (`updateDiffStats`, `static/app.js:452-473`)
- [X] T007 [US1] Implement `Escape` to return to the editable input state
      (`static/app.js:666-672`)
- [X] T008 [US1] Wire per-panel live line-count badge on every keystroke

**Checkpoint**: core compare flow usable end-to-end

---

## Phase 4: User Story 2 - Side-by-side / inline toggle (P2)

- [X] T009 [US2] Implement `toggleInlineBtn` handler flipping `renderSideBySide`
      (`static/app.js:691-697`)
- [X] T010 [US2] Implement the independent folder-diff inline toggle
      (`static/app.js:728-734`)

---

## Phase 5: User Story 3 - Merge hunks between panels (P2)

- [X] T011 [US3] Implement pure-deletion/insertion merge helpers
      (`_mergeToRightPureDeletion`/`_mergeToRightPureInsertion`/`_mergeToLeftPureDeletion`/
      `_mergeToLeftPureInsertion`, `static/app.js:112-161`)
- [X] T012 [US3] Implement edit-hunk merge computation
      (`_computeToRightEdit`/`_computeToLeftEdit`, `static/app.js:162-183`)
- [X] T013 [US3] Wire clickable gutter merge glyphs to `handleMergeClick` with success
      toasts (`static/app.js:184-193, 858, 869`)

---

## Phase 6: User Story 4 - Export the diff (P2)

- [X] T014 [US4] Implement `.patch` download for the text diff (`static/app.js:1064`)
- [X] T015 [US4] Implement clipboard copy of the unified diff (`static/app.js:1078`)
- [X] T016 [US4] Implement folder-diff Export menu: right-merged, left-merged, and
      unified-patch-to-clipboard actions (`static/app.js:311-315, 984-1014`)

---

## Phase 7: User Story 5 - Upload files instead of pasting (P3)

- [X] T017 [US5] Implement `_read_upload_stream` — 1 MB chunked read, 50 MB cap, leading
      null-byte detection (`routes/pages.py:110-121`)
- [X] T018 [US5] Implement `POST /upload` handler: binary `Content-Type` rejection (400),
      binary-content rejection (400), success payload `{filename, content, size_bytes}`
      (`routes/pages.py:125-150`)
- [X] T019 [US5] Wire per-panel file picker to call `/upload` and populate panel content
      (`static/app.js:504-...`, `MAX_FILE_SIZE_BYTES` client-side pre-check)

---

## Phase 8: User Story 6 - Folder tree comparison (P3)

- [X] T020 [US6] Wire `webkitdirectory` folder pickers positioned outside any
      `display:none` ancestor (`static/index.html:319-323`)
- [X] T021 [US6] Implement merged-tree construction + status propagation
      (`allFileStatuses`, `collectFilePaths`, `propagateFolderStatuses`,
      `static/app.js:87-111`)
- [X] T022 [US6] Implement filter chips (All / Differs / Added only / Removed only) and
      their filtering logic (`static/index.html:395-398`, `static/app.js:1195-1197ff`)
- [X] T023 [US6] Sort file paths with `localeCompare()` for deterministic ordering
      (`static/app.js:1254`)

**Checkpoint**: folder-diff mode fully usable

---

## Phase 9: Retroactive Documentation

- [X] T024 Author `specs/002-diff-checker/{spec,plan,tasks,data-model,quickstart,
      research}.md`, `contracts/http-api.md`, and `checklists/requirements.md` from
      SPEC.md §4.1 + direct source inspection (2026-07-28); flag the §3.4 `app.js`
      ownership discrepancy and the filter-chip label drift found during verification.

---

## Dependencies & Execution Order

- Setup → Foundational → US1 (MVP) → US2/US3/US4 (build on US1's editor + panels) →
  US5 (independent — only touches `/upload` + one file input) → US6 (independent editor
  instance, reuses the same merge/export/stats helpers where applicable).
- All phases are already complete; ordering here reflects logical build order for future
  changes, not a remaining backlog.
