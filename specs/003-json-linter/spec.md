# Feature Specification: JSON Linter & Formatter

**Feature Branch**: `003-json-linter`

**Created**: 2026-07-28

**Status**: Superseded by [specs/016-data-linter/spec.md](../016-data-linter/spec.md) — kept
for record; its functional requirements remain the source of truth for exact JSON-tab
behavior in the consolidated tool.

**Input**: Retroactive documentation of the already-shipped JSON Linter tool (`/json`,
`static/json.html`), migrating SPEC.md §4.2 into the spec-kit per-feature structure. Ground
truth is the current source — **this spec corrects two material discrepancies found
against the pre-migration SPEC.md §4.2 text; see Assumptions.**

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Validate JSON with live feedback (Priority: P1)

A developer pastes JSON into the editor and gets immediate feedback on whether it's valid,
with an exact error location if not, without clicking anything.

**Why this priority**: Live validation is the tool's core value — catching a syntax error
the instant it's typed is what makes this faster than a generic text editor.

**Independent Test**: Type invalid JSON and confirm an error state appears within ~600ms
without any button click; fix it and confirm the state clears.

**Acceptance Scenarios**:

1. **Given** the editor has content, **When** 600ms elapse after the last keystroke with no
   further typing, **Then** `liveValidate()` runs: valid JSON sets the status pill to
   "Valid JSON" and clears any error panel; invalid JSON shows the parser's error message
   in the error panel and sets the pill to "Invalid JSON" (`static/json.html:236-250`).
2. **Given** the editor is empty, **When** live validation runs, **Then** the status pill
   shows "Ready" (idle) rather than an error.
3. **Given** the user clicks "Validate" (or presses `Ctrl/Cmd+Enter`, which triggers the
   same button), **When** the content is valid JSON, **Then** a pretty-printed preview is
   shown in the output pane labeled "Validated — Preview" and a success toast appears
   (`static/json.html:253-267, 358-364`).

---

### User Story 2 - Pretty-print, minify, and sort keys (Priority: P1)

A developer normalizes messy JSON (from an API response or a minified config) into a
readable, canonical form, or compacts it for transport.

**Why this priority**: The three one-click transforms are the tool's main productivity
feature beyond validation.

**Independent Test**: Paste unformatted JSON, click each of Format/Minify/Sort Keys in
turn, and confirm the output pane shows the expected transform each time, leaving the input
pane untouched.

**Acceptance Scenarios**:

1. **Given** valid JSON in the input editor, **When** the user clicks "Format", **Then**
   the output pane shows `JSON.stringify(parsed, null, 2)` labeled "Formatted (2-space
   indent)" (`static/json.html:270-280`).
2. **Given** valid JSON, **When** the user clicks "Minify", **Then** the output pane shows
   `JSON.stringify(parsed)` (no whitespace) labeled "Minified" (`static/json.html:283-293`).
3. **Given** valid JSON, **When** the user clicks "Sort Keys", **Then** the output pane
   shows the JSON with all object keys sorted alphabetically at every nesting depth
   (`sortKeysDeep()`, `static/json.html:145-153, 296-306`).
4. **Given** invalid JSON, **When** any of the three buttons is clicked, **Then** the
   action is refused, the error panel shows the parse error, and a "Cannot format/minify/
   sort invalid JSON" error toast appears — no output pane change.

---

### User Story 3 - Convert JSON to YAML (Priority: P2)

A developer converts a JSON document to YAML for use in a Kubernetes manifest or CI config
without leaving the tool.

**Why this priority**: A one-click cross-format convenience feature; not the tool's primary
purpose but frequently useful alongside JSON formatting.

**Independent Test**: Paste valid JSON, click "Convert to YAML", and confirm the output pane
renders YAML syntax-highlighted content.

**Acceptance Scenarios**:

1. **Given** valid JSON, **When** the user clicks the YAML conversion action, **Then** the
   output pane shows `jsyaml.dump(parsed, {indent: 2, lineWidth: -1})`, labeled "YAML
   (Converted)" with output-pane syntax switched to `yaml` (`static/json.html:309-324`).
2. **Given** the conversion throws (unexpected for valid JSON, but guarded), **When** it
   fails, **Then** the error panel shows the conversion error and an error toast appears.

---

### User Story 4 - Clear, paste, and copy workflow (Priority: P3)

A developer clears the editor to start fresh, pastes from the clipboard, or copies the
current output back out.

**Why this priority**: Supporting utility actions around the core validate/transform loop.

**Independent Test**: Exercise Clear, Paste, and Copy Output and confirm each performs its
documented effect.

**Acceptance Scenarios**:

1. **Given** any editor state, **When** the user clicks "Clear", **Then** both editors
   reset to empty, the output pane hides, the copy button disables, and status returns to
   "Ready" (`static/json.html:327-338`).
2. **Given** clipboard read permission is granted, **When** the user clicks "Paste",
   **Then** clipboard text replaces the input editor's content; if permission is denied, a
   warning toast tells the user to paste manually (`static/json.html:341-347`).
3. **Given** output has been produced, **When** the user clicks the copy button, **Then**
   the last-shown output text is written to the clipboard (`static/json.html:350-356`).

---

### Edge Cases

- Empty input on Validate/Format/Minify/Sort: each action shows a "Nothing to X"/"Editor is
  empty" warning toast and takes no further action, rather than erroring.
- Very deeply nested objects passed to `sortKeysDeep()`: recursion depth is bounded only by
  the JS call stack (no explicit depth guard).
- YAML conversion of JSON containing values `jsyaml.dump` cannot represent losslessly (e.g.
  keys that collide only after YAML's own normalization): surfaced as a caught exception,
  shown in the error panel — not a silent corruption.
- Live validation firing mid-formatting-action: guarded implicitly by the 600ms debounce
  (`liveTimer`) rather than an explicit re-entrancy lock.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST parse and live-validate the editor's JSON content 600ms
  after the last keystroke, showing a status pill (idle/valid/invalid) and, when invalid,
  the parser's error message in an error panel.
- **FR-002**: Users MUST be able to trigger an explicit validation via a "Validate" button
  or `Ctrl/Cmd+Enter`, producing a pretty-printed preview of the parsed value on success.
- **FR-003**: Users MUST be able to pretty-print valid JSON (2-space indent) into a
  separate, read-only output pane without modifying the input editor's content.
- **FR-004**: Users MUST be able to minify valid JSON (no whitespace) into the output pane.
- **FR-005**: Users MUST be able to sort all object keys alphabetically, recursively, at
  every nesting depth, into the output pane.
- **FR-006**: Users MUST be able to convert valid JSON to YAML (2-space indent, no line
  wrapping) into the output pane, with the pane's syntax highlighting switched to YAML.
- **FR-007**: Every transform action (Format/Minify/Sort/Convert) MUST reject invalid JSON
  input by showing the parse error and an error toast rather than producing partial output.
- **FR-008**: Users MUST be able to clear both editors, paste clipboard content into the
  input editor, and copy the current output pane content to the clipboard.
- **FR-009**: A live character count and line count for the input editor MUST update on
  every keystroke.

### Key Entities

- **Input Document**: the raw text in the input Monaco editor; the only editor the user
  directly types into.
- **Output Document**: a separate, read-only Monaco model (`outputModel`) that every
  transform writes into; never fed back into the input editor.
- **Validation State**: one of idle / valid / invalid, driving the status pill and error
  panel visibility.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Typing invalid JSON produces a visible error state within 1 second (600ms
  debounce + render) with no button click required.
- **SC-002**: Each of Format/Minify/Sort/Convert-to-YAML, given the same valid input,
  produces byte-identical output across repeated runs (pure functions of the parsed value).
- **SC-003**: None of the four transform actions ever mutates the input editor's content —
  verifiable by diffing the input editor's value before and after each action.

## Assumptions

- **SPEC.md §4.2 discrepancy #1 — no undo stack exists (flagged per CLAUDE.md rule 2)**:
  the pre-migration spec stated *"Bulk operations (format, minify, sort) must push a
  snapshot to a manual undo stack before replacing content, so Ctrl+Z restores the previous
  value."* No such undo stack exists in `static/json.html`. This is moot in the current
  implementation for a stronger reason than a missing feature: Format/Minify/Sort/Convert
  never touch the input editor at all — they only ever write to the separate read-only
  output pane (`showOutput()` → `outputModel.setValue(...)`). `Ctrl+Z` in the input editor
  already works via Monaco's native undo stack for the user's own typing, but there is
  nothing to "restore" from a bulk operation because bulk operations don't replace input
  content. This spec documents the as-built two-pane behavior as authoritative; the old
  claim should not be treated as a missing bug unless product direction wants a single-pane
  in-place-edit model instead (that would be a new feature, not a bug fix).
- **SPEC.md §4.2 discrepancy #2 — undocumented "Convert to YAML" action**: the pre-
  migration spec listed only "Pretty-print · Minify · Sort keys alphabetically"; the shipped
  tool also has a JSON→YAML conversion button (`static/json.html:309-324`, using
  `static/libs/js-yaml.min.js`). Documented here as User Story 3.
- **SPEC.md §3.4 discrepancy (see `002-diff-checker/spec.md` Assumptions)**: this tool's
  logic lives in an inline `<script>` in `json.html`, not in `static/app.js` as the old
  module map claimed.
- **No DevDB persistence, no auth** (SPEC.md §8: "No auth required").
- **No automated test coverage**: no `tests/python/` or `tests/javascript/` tests exercise
  this tool's parsing/transform logic.
