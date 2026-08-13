# Feature Specification: XML Linter & Validator

**Feature Branch**: `015-xml-linter`

**Created**: 2026-08-12

**Status**: Superseded by [specs/016-data-linter/spec.md](../016-data-linter/spec.md) — kept
for record; its functional requirements remain the source of truth for exact XML-tab behavior
in the consolidated tool. (This spec's own implementation, built earlier in the same session,
is being folded into 016 rather than shipped as a standalone `/xml` tool.)

**Input**: User description: "Add an XML Linter & Validator to DevSuite's file-operations
tools, following the exact same pattern as the JSON Linter (`specs/003-json-linter`) and
YAML Linter & Validator (`specs/004-yaml-linter`): a client-side, live-validating editor for
XML documents. Well-formedness validation only — no XSD/DTD schema validation. Format
(pretty-print) and Minify actions, matching the JSON linter's format/minify pair. Standalone
tool — XML↔JSON conversion stays with the separate File Format Converter
(`specs/013-file-converter`) and is out of scope here."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Validate XML with precise errors (Priority: P1)

A developer pastes an XML document — a SOAP payload, an Android layout, a Maven `pom.xml`,
an RSS feed, a config file — into the editor and needs to know immediately whether it's
well-formed, and if not, where the problem is.

**Why this priority**: Validation is the tool's core reason to exist — everything else
(format, minify) is only useful once the input is known well-formed or the error location
is visible.

**Independent Test**: Paste well-formed XML and confirm a "Valid XML" status; paste XML with
an unclosed or mismatched tag and confirm the error panel shows a message, without any button
click required.

**Acceptance Scenarios**:

1. **Given** the editor is empty, **When** 600ms of inactivity elapses (live-validation
   debounce), **Then** the status pill reads "Ready" and no error is shown.
2. **Given** malformed XML (e.g. an unclosed tag, a mismatched closing tag, an unescaped `&`,
   or more than one root element), **When** the user stops typing for 600ms, or clicks
   **Validate**, **Then** the status pill switches to "Invalid XML" and the error panel shows
   the parser's error text (including line/column when the browser's parser reports one) plus
   a static remediation hint ("Check tag matching, attribute quoting, and root element
   count").
3. **Given** well-formed XML, **When** the user clicks **Validate**, **Then** the status pill
   reads "Valid XML ✓", a success toast appears, and the output pane shows a re-serialized
   preview of the parsed document.
4. **Given** well-formed XML containing a DOCTYPE declaration, comments, processing
   instructions, or CDATA sections, **When** validated, **Then** the document is accepted as
   valid — these constructs are recognized syntactically but never resolved (no external DTD
   or entity is fetched).

---

### User Story 2 - Reformat XML to a consistent style (Priority: P2)

A developer has minified or inconsistently indented XML and wants it re-emitted in a clean,
readable form — or the reverse: wants a verbose document compacted before pasting it
elsewhere.

**Why this priority**: A common secondary action once content is known well-formed; not
required for the tool to deliver its primary validation value.

**Independent Test**: Format a single-line XML document and confirm the output pane shows
indented, multi-line XML; minify a verbosely-indented document and confirm the output pane
shows the same document with insignificant inter-tag whitespace removed.

**Acceptance Scenarios**:

1. **Given** well-formed XML, **When** the user clicks **Format**, **Then** the output pane
   shows the document re-serialized with 2-space indentation per nesting level, labeled
   "Formatted XML".
2. **Given** well-formed XML, **When** the user clicks **Minify**, **Then** the output pane
   shows the document with whitespace-only text nodes between tags removed and no
   indentation, labeled "Minified XML" — text content that is not purely whitespace is left
   untouched, so minifying never changes a document's meaning.
3. **Given** malformed XML, **When** either Format or Minify is clicked, **Then** the action
   is refused — the error panel and an error toast are shown instead of an output.

---

### User Story 3 - Clear, paste, and copy workflow (Priority: P3)

A developer clears the editor to start fresh, pastes from the clipboard, or copies the
current output back out.

**Why this priority**: Supporting utility actions around the core validate/format loop,
matching the workflow already established by the JSON and YAML linters.

**Independent Test**: Exercise Clear, Paste, and Copy Output and confirm each performs its
documented effect.

**Acceptance Scenarios**:

1. **Given** any editor state, **When** the user clicks "Clear", **Then** both the input
   editor and output pane reset to empty, the error panel hides, the copy button disables,
   and the status pill returns to "Ready".
2. **Given** clipboard read permission is granted, **When** the user clicks "Paste", **Then**
   clipboard text replaces the input editor's content; if permission is denied, a warning
   toast tells the user to paste manually.
3. **Given** output has been produced, **When** the user clicks the copy button, **Then** the
   last-shown output text is written to the clipboard.

---

### Edge Cases

- **Empty editor**: Validate/Format/Minify show a "Editor is empty" / "Nothing to format" /
  "Nothing to minify" warning toast rather than operating on empty input.
- **Multiple root elements**: rejected as invalid — a well-formed XML document must have
  exactly one root element.
- **XML declaration** (`<?xml version="1.0" encoding="UTF-8"?>`): accepted when present,
  optional when absent; not required for validity.
- **DOCTYPE with external subset**: accepted syntactically as part of well-formedness, but
  the external DTD is never fetched or resolved — no schema-level checking occurs and no
  network request is made (see FR-011).
- **CDATA sections and comments**: parsed and preserved as-is by Format; never altered by
  Minify's whitespace collapsing.
- **Mixed content** (text interleaved with child elements): Minify only strips text nodes
  that are entirely whitespace between tags — it never strips or alters non-whitespace text,
  so mixed content is not corrupted.
- **Very large documents**: parsing is bounded only by the browser's `DOMParser` and
  available memory — no server-side size limit applies since nothing is transmitted.
- **Rapid typing**: live validation is debounced 600ms so parsing doesn't run on every
  keystroke.
- **Clipboard permission denied** on Paste: caught and surfaced as a warning toast instructing
  manual `Ctrl+V`, not a hard failure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST parse XML client-side using the browser's native `DOMParser` —
  no XML content is sent to the backend, and no third-party XML parsing library is added.
- **FR-002**: The system MUST live-validate on a 600ms debounce after any edit and reflect the
  result in a status pill (`Ready` / `Valid XML` / `Invalid XML`).
- **FR-003**: The system MUST provide an explicit **Validate** action, triggerable by button
  click or `Ctrl/Cmd+Enter`, that re-serializes the parsed document as a preview on success.
- **FR-004**: The system MUST provide a **Format** action that re-serializes well-formed XML
  with 2-space indentation per nesting level.
- **FR-005**: The system MUST provide a **Minify** action that removes whitespace-only text
  nodes between tags without altering any non-whitespace text content, comments, or CDATA
  sections.
- **FR-006**: On any parse failure, the system MUST show the parser's error message (with
  line/column when available) and a static remediation hint, and MUST refuse to run
  Format/Minify on invalid input.
- **FR-007**: The system MUST support `Ctrl/Cmd+Enter` as a keyboard shortcut for Validate.
- **FR-008**: The system MUST track and display live character and line counts for the input
  editor, and a line count for the output once populated.
- **FR-009**: The system MUST provide Paste (clipboard → editor) and Copy Output (output →
  clipboard) actions, both using the async Clipboard API with a graceful fallback toast on
  denial.
- **FR-010**: The system MUST provide a Clear action that resets the input editor, output
  pane, error panel, and status pill to their empty/idle state.
- **FR-011**: The system MUST NOT perform XSD or DTD schema validation, MUST NOT resolve or
  fetch external DTD subsets or external entities, and MUST NOT offer XPath querying, XSLT
  transforms, or XML↔JSON conversion — those remain out of scope for this feature (schema
  validation and XPath/XSLT are candidate future specs; XML↔JSON conversion belongs to the
  File Format Converter, `specs/013-file-converter`).

### Key Entities

- **Input Document**: the raw text in the input editor; the only editor the user directly
  types into.
- **Output Document**: a separate, read-only pane that Validate/Format/Minify write into;
  never fed back into the input editor.
- **Validation State**: one of idle / valid / invalid, driving the status pill and error
  panel visibility.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can determine whether a pasted XML document is well-formed, and see a
  specific error location/reason if not, without leaving the page or waiting on a network
  round trip.
- **SC-002**: Format and Minify never run against invalid input — the error panel is shown
  instead in 100% of invalid-input attempts.
- **SC-003**: No XML content the user types ever leaves the browser — verifiable by the
  absence of any `fetch`/`XMLHttpRequest`/WebSocket call in the tool's page script.
- **SC-004**: Minifying a document and then formatting the result reproduces the same element
  and attribute structure as the original (round-trip fidelity for well-formed input).

## Assumptions

- **Follows the established two-pane editor pattern** (read-write input, read-only output)
  used by the JSON and YAML linters, per the constitution's vanilla-stack, no-new-JS-deps
  principle — exact editor component choice is a planning-phase decision, not a spec
  decision, but it must not introduce a new third-party dependency given `DOMParser` already
  covers the parsing need.
- **No DevDB persistence, no auth**: this tool is fully stateless, matching the JSON/YAML
  linters — nothing survives a page reload.
- **No XXE exposure**: browsers' native `DOMParser` does not fetch external DTDs or resolve
  external entities, so accepting a DOCTYPE syntactically (per FR-011) carries no
  server-side-injection risk of the kind XXE normally implies — there is no server-side
  parsing step in this feature at all.
- **New route `/xml`, new page `static/xml.html`**, and a new `tools.html` card with
  `data-category="data"` — the same category as the JSON Linter, YAML Linter, and File
  Format Converter.
- **Tool count**: shipping this feature moves DevSuite from 12 to 13 tools; `README.md`,
  `specs/SPEC.md` §4 index, `tools.html`, and `home.html` counts must be updated together
  per the constitution's tool-count-sync rule.
