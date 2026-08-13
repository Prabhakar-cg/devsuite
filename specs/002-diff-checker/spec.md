# Feature Specification: Diff Checker

**Feature Branch**: `002-diff-checker`

**Created**: 2026-07-28

**Status**: Implemented (retroactive spec)

**Input**: Retroactive documentation of the already-shipped Diff Checker tool (`/diff`,
`static/index.html` + `static/app.js`), migrating SPEC.md §4.1 into the spec-kit
per-feature structure. Ground truth is the current source, not the prose that was in
SPEC.md before this migration — see **Assumptions** for discrepancies found between the
two.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compare two text snippets (Priority: P1)

A developer pastes or types text into the Original (left) and Modified (right) panels and
compares them to see exactly what changed, rendered as a Monaco side-by-side diff with
inline change highlighting.

**Why this priority**: This is the tool's whole reason to exist — everything else (export,
merge, folder mode) builds on a working two-panel comparison.

**Independent Test**: Paste two different snippets into the panels, trigger a compare, and
confirm the diff view renders with additions/removals highlighted and the stats bar
populated.

**Acceptance Scenarios**:

1. **Given** text in both the Original and Modified panels, **When** the user clicks
   "Compare" or presses `Ctrl/Cmd+Enter`, **Then** a Monaco diff editor renders showing
   line-level changes, and the Diff Stats Bar shows additions, removals (rendered as
   "hunks"), and hunk count (`static/app.js:452` `updateDiffStats`).
2. **Given** an active diff view, **When** the user presses `Escape`, **Then** the view
   returns to the editable two-panel input state (`static/app.js:666-672`).
3. **Given** text is typed into either panel, **When** each keystroke occurs, **Then** the
   panel's line-count badge updates immediately (`countLines()`, `static/app.js:39`).

---

### User Story 2 - Toggle side-by-side vs. inline view (Priority: P2)

A developer reviewing a large diff switches to inline mode to read changes as a single
unified stream instead of two columns.

**Why this priority**: Improves readability for large diffs but is a display preference on
top of a working comparison, not core value.

**Independent Test**: With an active diff, click "Inline View" and confirm the Monaco diff
editor's `renderSideBySide` option flips and the button label/`aria-pressed` state update.

**Acceptance Scenarios**:

1. **Given** a rendered side-by-side diff, **When** the user clicks "Inline View", **Then**
   the editor switches to unified/inline rendering and the button becomes "Side‑by‑Side"
   with `aria-pressed="true"` (`static/app.js:691-697`).
2. **Given** the Folder Diff tab is active, **When** the user toggles its own "Inline View"
   button, **Then** only the folder diff editor's rendering mode changes, independent of the
   text-diff toggle (`static/app.js:728-734`).

---

### User Story 3 - Merge individual hunks between panels (Priority: P2)

A developer resolving a manual merge copies one changed hunk from Modified into Original
(or vice versa) without retyping it, using clickable merge glyphs in the gutter.

**Why this priority**: This is the tool's main productivity feature beyond a read-only diff
— it turns the diff view into a lightweight merge tool.

**Independent Test**: Render a diff with at least one change hunk, click its merge arrow,
and confirm the target panel's content updates to match the source hunk while the diff
re-renders.

**Acceptance Scenarios**:

1. **Given** a change hunk that is a pure insertion, deletion, or edit, **When** the user
   clicks the right-pointing merge glyph, **Then** the hunk is applied to the Modified
   panel (`_mergeToRight*` / `_computeToRightEdit`, `static/app.js:112-183`) and a success
   toast appears ("Merged hunk to Modified.").
2. **Given** the same hunk types, **When** the user clicks the left-pointing glyph, **Then**
   the hunk is applied to the Original panel and a corresponding toast appears.

---

### User Story 4 - Export the diff (Priority: P2)

A developer needs the diff outside the browser — attached to a ticket or applied with
`patch`/`git apply` — and downloads it as a `.patch` file or copies the unified diff text.

**Why this priority**: Makes the tool useful beyond visual inspection; a common follow-up
action once a diff is confirmed correct.

**Independent Test**: With an active diff, open the Export menu and use each option;
confirm a `diff.patch` file downloads and that clipboard copy succeeds.

**Acceptance Scenarios**:

1. **Given** an active text diff, **When** the user chooses "Download as .patch", **Then** a
   unified-diff file named `diff.patch` is downloaded (`static/app.js:1064`).
2. **Given** an active text diff, **When** the user chooses the clipboard copy export
   option, **Then** the unified diff text is written to the clipboard
   (`static/app.js:1078`).
3. **Given** an active Folder Diff, **When** the user opens the folder Export menu, **Then**
   right-merged, left-merged, and unified-patch export actions are available
   (`folderExportRightBtn`/`folderExportLeftBtn`/`folderExportPatchBtn`,
   `static/app.js:311-315, 984-1014`) and the patch option copies to the clipboard.

---

### User Story 5 - Upload files instead of pasting (Priority: P3)

A developer diffing two local files uploads them via a file picker per panel instead of
copy-pasting their contents.

**Why this priority**: Convenience path for larger files; the paste-based flow (US1) already
covers the primary use case.

**Independent Test**: Upload a small text file to each panel and confirm content, filename,
and size are reflected; upload an oversized or binary file and confirm it is rejected.

**Acceptance Scenarios**:

1. **Given** a text file under 50 MB, **When** the user selects it via the panel's file
   picker, **Then** `POST /upload` returns `{filename, content, size_bytes}` and the panel
   is populated with the file's content.
2. **Given** a file over 50 MB, **When** it is uploaded, **Then** the server rejects it with
   HTTP 413 ("File too large. Exceeds 50MB limit.") — enforced by
   `_read_upload_stream` (`routes/pages.py:110-121`) as it streams in 1 MB chunks.
3. **Given** a binary file (null byte detected in the first 512 bytes of the first chunk, or
   a binary `Content-Type` such as `image/*`, `video/*`, `application/pdf`,
   `application/zip`, `application/octet-stream`), **When** it is uploaded, **Then** the
   server returns HTTP 400 rather than passing binary content into the diff engine
   (`routes/pages.py:126-141`).

---

### User Story 6 - Compare entire folder trees (Priority: P3)

A developer compares two directory trees (e.g. two versions of a project checkout) file by
file, filtering to only the files that actually changed.

**Why this priority**: A materially different, heavier workflow than single-file diffing;
valuable but a superset of the P1 capability, not required for the tool to be useful.

**Independent Test**: Select two folders via the folder pickers, confirm a file tree renders
with per-file status, and confirm each filter chip narrows the list correctly.

**Acceptance Scenarios**:

1. **Given** two folders selected via `<input type="file" webkitdirectory>` pickers
   (`static/index.html:322-323`), **When** the comparison runs, **Then** a merged file tree
   is built and each file/folder node is assigned a status via `propagateFolderStatuses()`
   (`static/app.js:97-111`), with paths sorted using `localeCompare()` for locale-aware
   ordering (`static/app.js:1254`).
2. **Given** a rendered folder tree, **When** the user clicks a filter chip (`All` /
   `● Differs` / `● Added only` / `● Removed only`, `static/index.html:395-398`), **Then**
   only files matching that status remain visible (`static/app.js:1195-1197` and
   surrounding filter logic).
3. **Given** the folder-diff tab is not the active tab, **When** the page loads, **Then**
   the folder file-input elements remain reachable by the browser's file-picker dialog even
   though their `folder-setup-panels-wrapper` ancestor may later be hidden with
   `display:none` post-compare (`static/index.html:319-323` comment + inputs placed outside
   that wrapper) — this is the constraint SPEC.md previously called out.

---

### Edge Cases

- Empty input in either panel: Compare still runs (empty string is valid diff input); export
  actions are guarded by "nothing to export" style checks where relevant.
- Uploading a file that looks textual but contains an embedded null byte later than the
  first 512 bytes of the first 1 MB chunk: not caught by the null-byte heuristic (only the
  first chunk's first 512 bytes are checked) — accepted and decoded with
  `errors="replace"`, which will show replacement characters rather than a rejection.
- Very large single-file paste (no explicit client-side cap on paste, unlike the 50 MB
  upload cap) — bounded only by browser/Monaco practical limits.
- Folder diff with files present on only one side: represented via the `added`/`removed`
  filter states, not treated as an error.
- Escape while not on the text-diff view (e.g. already editing, or on the Folder Diff tab):
  the handler is guarded by `!textDiffContainer.classList.contains('hidden')` and is a
  no-op in that case (`static/app.js:672`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to enter text into two independent panels (Original /
  Modified) and trigger a comparison via a button or `Ctrl/Cmd+Enter`.
- **FR-002**: The system MUST render the comparison as a Monaco diff editor with line-level
  highlighting, defaulting to side-by-side rendering.
- **FR-003**: Users MUST be able to toggle between side-by-side and inline rendering,
  independently for the text-diff and folder-diff views.
- **FR-004**: The system MUST display a live Diff Stats Bar (additions, removals, hunk
  count) that updates whenever the diff is (re-)computed.
- **FR-005**: The system MUST display a live line-count badge per panel that updates on
  every keystroke.
- **FR-006**: Users MUST be able to merge an individual change hunk from one panel into the
  other in either direction (pure insertion, pure deletion, and edit hunks), via a clickable
  gutter glyph.
- **FR-007**: Users MUST be able to export the current text diff as a downloadable
  `diff.patch` unified-diff file, or copy the unified diff to the clipboard.
- **FR-008**: Users MUST be able to upload a text file into either panel via
  `POST /upload`; the server MUST reject files over 50 MB (HTTP 413) and reject binary
  content — detected via a leading-null-byte heuristic or a binary `Content-Type` — with
  HTTP 400.
- **FR-009**: Users MUST be able to switch to a Folder Diff mode (`/diff?tab=folder-diff`)
  and select two directory trees via `webkitdirectory` file pickers.
- **FR-010**: In Folder Diff mode, the system MUST build a merged file tree, assign each
  node a status (added / removed / modified / unchanged), and let the user filter the tree
  by status via chips (All / Differs / Added only / Removed only).
- **FR-011**: In Folder Diff mode, the system MUST offer export actions equivalent to the
  text-diff export (right-merged, left-merged, unified patch to clipboard).
- **FR-012**: File-path lists in Folder Diff MUST be sorted with `localeCompare()` for
  deterministic, locale-aware ordering.
- **FR-013**: The folder-picker `<input type="file" webkitdirectory>` elements MUST remain
  outside any `display:none` ancestor so their native file-selection dialog stays usable
  after the initial setup panel is hidden post-compare.

### Key Entities

- **Diff Panel**: one side (Original/Modified) of the text comparison — holds raw text,
  a derived line count, and an optional source filename when populated via upload.
- **Diff Result**: the Monaco diff editor's computed change list — additions, deletions,
  and hunk count, rendered live and re-derived on every recompare or merge.
- **Change Hunk**: one contiguous diff change (insertion, deletion, or edit) exposed by
  Monaco's diff model; the unit merge glyphs operate on.
- **Folder Tree Node**: one file or directory in the merged folder-diff tree, carrying a
  status (added/removed/modified/unchanged) used for filtering and icon selection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from pasting two snippets to seeing a highlighted diff with
  populated stats in a single action (button click or `Ctrl/Cmd+Enter`), with no page
  reload.
- **SC-002**: Every merge-hunk direction (left→right, right→left) for every hunk type
  (pure insertion, pure deletion, edit) produces a panel whose content, when re-diffed,
  shows that hunk as resolved.
- **SC-003**: Uploading a file at exactly the 50 MB boundary succeeds; one byte over fails
  with HTTP 413 — verified by the streaming size check in `_read_upload_stream`.
- **SC-004**: A folder diff of a tree with N changed / M unchanged files, filtered to
  "Differs", shows exactly N entries.

## Assumptions

- **Client-only tool for the primary text-diff flow**: `/upload` is the only backend
  endpoint involved; nothing under this feature touches DevDB, auth, or the CORS proxy —
  consistent with SPEC.md §8 ("No auth required").
- **SPEC.md §3.4 discrepancy (flagged per CLAUDE.md rule 2)**: the pre-migration Module-to-
  File Map listed `app.js` as JSON Linter's script; in the actual source, `app.js` belongs
  only to the Diff tool (`index.html`) — the JSON Linter (`003-json-linter`) uses its own
  inline `<script>` in `json.html`. This spec and `003-json-linter` correct that mapping;
  SPEC.md's cross-cutting §3.4 table should be corrected in the same pass that trims §4.
- **Filter chip labels changed since SPEC.md was last accurate**: the pre-migration text
  named the chips "Modified / Added / Removed"; the shipped labels are "● Differs" /
  "● Added only" / "● Removed only" (`static/index.html:395-398`). Cosmetic only — noted for
  completeness, not treated as a functional gap.
- **No automated test coverage**: neither `tests/python/` nor `tests/javascript/` contains
  tests exercising `/upload`, the diff-merge logic, or the folder-diff filtering — this
  tool's behavior is currently verified manually only (see `quickstart.md`).
