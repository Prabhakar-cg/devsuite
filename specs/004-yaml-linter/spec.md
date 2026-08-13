# Feature Specification: YAML Linter & Validator

**Feature Branch**: `004-yaml-linter`

**Created**: 2026-07-28

**Status**: Superseded by [specs/016-data-linter/spec.md](../016-data-linter/spec.md) — kept
for record; its functional requirements remain the source of truth for exact YAML-tab
behavior in the consolidated tool.

**Input**: Retroactive spec-kit conversion of the already-shipped YAML Linter & Validator tool
(`/yaml`), per the DevSuite spec-kit migration (see `specs/SPEC.md` §4.3 and the module-to-file
map in §3.4). Written from source inspection of `routes/pages.py`, `static/yaml.html`, and the
shared `static/app.js`/`static/linter.css`, 2026-07-28.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Validate YAML with precise errors (Priority: P1)

A developer pastes a Kubernetes manifest, Docker Compose file, or GitHub Actions workflow into
the editor and needs to know immediately whether it parses, and if not, why.

**Why this priority**: Validation is the tool's core reason to exist — everything else (format,
convert) is only useful once the input is known-valid or the error is visible.

**Independent Test**: Paste syntactically invalid YAML (e.g. bad indentation) and confirm the
error panel shows a message; paste valid YAML and confirm a "Valid YAML" status.

**Acceptance Scenarios**:

1. **Given** the editor is empty, **When** 600ms of inactivity elapses (live-validation debounce),
   **Then** the status pill reads "Ready" and no error is shown.
2. **Given** syntactically invalid YAML, **When** the user stops typing for 600ms, or clicks
   **Validate**, **Then** the status pill switches to "Invalid YAML" and the error panel shows
   `error.message` from `js-yaml` plus the static hint "Check indentation and special characters".
3. **Given** syntactically valid YAML, **When** the user clicks **Validate**, **Then** the status
   pill reads "Valid YAML ✓", a success toast appears, and the output pane shows a re-dumped
   preview of the parsed document.
4. **Given** the document contains multiple `---`-separated YAML documents, **When** validated,
   **Then** all documents are parsed via `jsyaml.loadAll` and returned as an array (single-document
   input returns the bare object, not a one-element array).

---

### User Story 2 - Reformat YAML to a canonical style (Priority: P2)

A developer has inconsistently indented or quoted YAML and wants it re-emitted in a clean,
consistent style before committing it.

**Why this priority**: A common secondary action once content is known-valid; not required for
the tool to deliver its primary validation value.

**Independent Test**: Format a document with mixed quoting/indentation and confirm the output pane
shows 2-space-indented YAML with double-quote quoting.

**Acceptance Scenarios**:

1. **Given** valid YAML, **When** the user clicks **Format**, **Then** the output pane shows
   `jsyaml.dump(data, {indent: 2, lineWidth: 120, quotingType: '"'})` labeled "Formatted YAML".
2. **Given** invalid YAML, **When** the user clicks **Format**, **Then** formatting is refused —
   the error panel and an error toast are shown instead of an output.

---

### User Story 3 - Convert YAML to JSON (Priority: P2)

A developer needs the JSON equivalent of a YAML document (pretty or minified) to feed into another
tool or paste into code.

**Why this priority**: A distinct, frequently-needed conversion; independent of formatting.

**Independent Test**: Convert a valid document via **→ JSON** and via **→ JSON (min)** and confirm
pretty (2-space indented) vs. minified single-line output respectively.

**Acceptance Scenarios**:

1. **Given** valid YAML, **When** the user clicks **→ JSON**, **Then** the output pane shows
   `JSON.stringify(data, null, 2)` with the output language switched to `json` and labeled
   "Converted → JSON".
2. **Given** valid YAML, **When** the user clicks **→ JSON (min)**, **Then** the output pane shows
   `JSON.stringify(data)` (no whitespace) labeled "Converted → JSON (minified)".
3. **Given** invalid YAML, **When** either conversion button is clicked, **Then** the conversion is
   refused and the error panel is shown instead.

---

### Edge Cases

- **Empty editor**: Validate/Format/Convert buttons show a warning toast ("Editor is empty" /
  "Nothing to format" / "Nothing to convert") rather than operating on empty input.
- **Multi-document YAML** (`---` separated): handled via `loadAll`; SPEC.md does not currently
  document this — see Assumptions.
- **Clipboard permission denied** on Paste: caught and surfaced as a warning toast instructing
  manual `Ctrl+V`, not a hard failure.
- **Copy Output before any output exists**: the Copy Output button starts `disabled` and is only
  enabled once `showOutput()` has run at least once.
- **Rapid typing**: live validation is debounced 600ms (`liveTimer`) so parsing doesn't run on
  every keystroke.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST parse YAML client-side using the self-hosted `js-yaml` library
  (`static/libs/js-yaml.min.js`) — no content is sent to the backend.
- **FR-002**: The system MUST live-validate on a 600ms debounce after any edit and reflect the
  result in a status pill (`Ready` / `Valid YAML` / `Invalid YAML`).
- **FR-003**: The system MUST provide an explicit **Validate** action that re-dumps the parsed
  document as a preview and shows a success/error toast.
- **FR-004**: The system MUST provide a **Format** action that re-serializes valid YAML with
  2-space indent, 120-column line width, and double-quote string quoting.
- **FR-005**: The system MUST provide **→ JSON** (pretty, 2-space indent) and **→ JSON (min)**
  (single-line) conversion actions.
- **FR-006**: On any parse failure, the system MUST show the underlying `js-yaml` error message
  and a static remediation hint, and MUST refuse to run Format/Convert on invalid input.
- **FR-007**: The system MUST support `Ctrl/Cmd+Enter` as a keyboard shortcut for Validate.
- **FR-008**: The system MUST track and display live character and line counts for the input
  editor, and a line count for the output once populated.
- **FR-009**: The system MUST provide Paste (clipboard → editor) and Copy Output (output →
  clipboard) actions, both using the async Clipboard API with a graceful fallback toast on denial.
- **FR-010**: The system MUST provide a Clear action that resets the input editor, output pane,
  error panel, and status pill to their empty/idle state.

### Key Entities

- **Parsed Document**: the in-memory result of `jsyaml.loadAll` — either a single object (one
  YAML document) or an array (multiple `---`-separated documents); exists only in the browser tab,
  never persisted or transmitted.
- **Validation Result**: `{ ok: boolean, data | error }` — the tri-state (idle/valid/invalid) that
  drives the status pill and error panel.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can determine whether a pasted YAML document is valid, and see a specific
  parse error location/reason if not, without leaving the page or waiting on a network round trip.
- **SC-002**: Format and both JSON conversions never run against invalid input — the error panel is
  shown instead in 100% of invalid-input attempts (verified by source: each handler checks
  `r.ok` before proceeding).
- **SC-003**: No YAML content the user types ever leaves the browser — verified by the absence of
  any `fetch`/`XMLHttpRequest` call in `yaml.html`'s inline script.

## Assumptions

- **Multi-document YAML support (`loadAll`) is real but undocumented in SPEC.md §4.3** — carried
  into this spec as FR/edge-case content; SPEC.md's tool-index entry should be updated to point
  here rather than re-describing it (coordinator's responsibility, out of scope for this fork).
- **SPEC.md §4.3 lists only "Format YAML · Convert to JSON" as actions**, but the shipped tool has
  four actions (Validate, Format, → JSON, → JSON min) — flagged as a spec/code discrepancy per
  CLAUDE.md rule 2, not silently resolved.
- **No DevDB persistence**: this tool is fully stateless; nothing survives a page reload.
