# Feature Specification: Regex Tester

**Feature Branch**: `005-regex-tester`

**Created**: 2026-07-28

**Status**: Implemented (retroactive spec)

**Input**: Retroactive spec-kit conversion of the already-shipped Regex Tester tool (`/regex`),
per the DevSuite spec-kit migration (see `specs/SPEC.md` §4.4). Written from source inspection of
`routes/pages.py` and `static/regex.html`, 2026-07-28.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Test a pattern against sample text in real time (Priority: P1)

A developer is building a regular expression and needs immediate visual feedback: does it compile,
what does it match, and where in the text.

**Why this priority**: This is the entire value proposition of the tool.

**Independent Test**: Type a pattern and test string and confirm matches highlight in the editor
and appear as a list within ~200ms of the last keystroke.

**Acceptance Scenarios**:

1. **Given** an empty pattern field, **When** the user types nothing, **Then** the match pane shows
   "Enter a pattern above" and the status pill reads "Ready".
2. **Given** a syntactically invalid pattern (e.g. unbalanced parenthesis), **When** the user
   types it, **Then** the pattern input gets an `invalid` visual state, the match pane shows the
   `RegExp` constructor's error message, and the status pill reads "Invalid pattern".
3. **Given** a valid pattern with matches in the test string, **When** 180ms elapse after the last
   edit to either field, **Then** every match is highlighted inline in the Monaco editor (yellow
   background + amber underline) and listed in the match pane with its index, character position
   range, length, and matched text.
4. **Given** a valid pattern with zero matches, **When** the match runs, **Then** the match pane
   shows "No matches found" and the status pill reads "0 matches".

---

### User Story 2 - Control matching behavior via flags (Priority: P1)

A developer needs to toggle global/case-insensitive/multiline/dotall matching without retyping the
pattern.

**Why this priority**: Flags fundamentally change match semantics (single vs. all matches is the
most common toggle); without them the tool only covers the first-match case.

**Independent Test**: Toggle each flag button and confirm `aria-pressed` and the visual `active`
state stay in sync, and that toggling `g` on/off changes the match count between "first match
only" and "all matches".

**Acceptance Scenarios**:

1. **Given** the default state, **When** the page loads, **Then** the `g` (global) flag is active
   by default and `i`/`m`/`s` are inactive.
2. **Given** any flag button, **When** clicked, **Then** its `active` CSS class and
   `aria-pressed` attribute toggle together, and matching re-runs immediately with the new flag
   set (via `new RegExp(pattern, flags)`).
3. **Given** the `g` flag is off, **When** the pattern matches multiple times in the text, **Then**
   only the first match is reported (native `RegExp.exec` single-call semantics).
4. **Given** the `g` flag is on and the pattern can match a zero-length string, **When** matching
   runs, **Then** `lastIndex` is manually advanced past the zero-length match to avoid an infinite
   loop.

---

### User Story 3 - Inspect capture groups per match (Priority: P2)

A developer wants to see what each numbered capture group matched, not just the full match.

**Why this priority**: Group inspection is the natural next step once matches are found, but the
tool is still useful for simple find/highlight without it.

**Independent Test**: Use a pattern with two capture groups against text that matches, and confirm
two group chips (`$1`, `$2`) appear under the match with their captured (or `undefined`) values.

**Acceptance Scenarios**:

1. **Given** a match with capture groups, **When** rendered, **Then** each group appears as a chip
   labeled `$1`, `$2`, … in capture order, showing the captured substring or the literal text
   `undefined` for a group that didn't participate in the match.
2. **Given** a match with zero capture groups, **When** rendered, **Then** no group-chips row is
   shown for that match.

---

### Edge Cases

- **Pattern field toggled empty mid-session**: decorations are cleared (`deltaDecorations(decorations, [])`)
  and the match pane resets to the "Enter a pattern above" empty state — no stale highlights linger.
- **Zero-width matches with `g`**: `re.lastIndex++` guard prevents an infinite loop (see US2
  Scenario 4).
- **Empty match value**: rendered as the literal styled text "empty string" rather than a blank
  row, so it's visually distinguishable from a rendering bug.
- **Copy Matches with zero matches**: the button starts `disabled` and is only enabled once at
  least one match renders.
- **Named capture groups**: `m.groups` is captured into `namedGroups` on every match object, but —
  see Assumptions — **the current UI never renders it**. Only numbered `$1`, `$2`… chips are shown.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST compile the user's pattern and flags via the native `RegExp`
  constructor entirely client-side; no content is sent to the backend.
- **FR-002**: The system MUST re-run matching on a 180ms debounce after any edit to the pattern
  field or the test-string editor.
- **FR-003**: The system MUST support four independently toggleable flags — `g`, `i`, `m`, `s` —
  each reflected via a visual `active` state and a synced `aria-pressed` attribute; `g` is active
  by default.
- **FR-004**: On an invalid pattern, the system MUST show the `RegExp` constructor's error message
  in the match pane, mark the pattern input `invalid`, and clear any existing decorations.
- **FR-005**: On a valid pattern, the system MUST highlight every match inline in the Monaco test
  editor via `deltaDecorations`, and list every match with its 1-based index, character position
  range (`pos start–end`), and byte length.
- **FR-006**: For each match, the system MUST render one chip per numbered capture group (`$1`,
  `$2`, …), showing the captured value or `undefined` if the group did not participate.
- **FR-007**: The system MUST provide a Copy Matches action that copies all matched values
  (newline-separated) to the clipboard, and a Clear action that resets pattern, test string,
  decorations, and match pane together.
- **FR-008**: The system MUST track and display a live line count for the test-string editor.

### Key Entities

- **Match**: `{ index, value, groups: string[], namedGroups: object }` — one regex match; `groups`
  drives the rendered chips, `namedGroups` is captured but currently unused by rendering (see
  Assumptions).
- **Flag Set**: the active subset of `{g, i, m, s}`, held as a `Set<string>` and joined into the
  flags string passed to `RegExp`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user sees match results (or a compile error) within ~200ms of finishing a pattern
  edit, without any network round trip.
- **SC-002**: Every match reported in the list corresponds 1:1 to a highlighted range in the editor
  (both derived from the same `matches` array in a single `runMatch()` pass).
- **SC-003**: No test-string or pattern content ever leaves the browser — verified by the absence
  of any `fetch`/`XMLHttpRequest` call in `regex.html`'s inline script.

## Assumptions

- **SPEC.md §4.4 states "Named and numbered group capture display"** — source inspection shows
  only numbered-group (`$1`, `$2`, …) chips are rendered; `buildGroupChip(g, gi, namedGroups)`
  receives `namedGroups` as a parameter but never reads it, and `renderMatches`/`appendMatchGroups`
  never surface named groups anywhere in the DOM. **This is a spec/code discrepancy** (CLAUDE.md
  rule 2) — flagged here rather than silently corrected; SPEC.md's tool-index entry should be
  fixed (drop "Named" or implement named-group display) when this spec is folded back by the
  coordinator.
- **No DevDB persistence**: this tool is fully stateless; nothing survives a page reload.
- **No dedicated CSS file**: unlike other linter-family tools, `regex.html` embeds its
  tool-specific overrides in an inline `<style>` block on top of the shared `linter.css`, rather
  than a separate `regex.css` file — noted as a minor structural inconsistency, not a defect.
