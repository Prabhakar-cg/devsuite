# Feature Specification: Data Format Linter

**Feature Branch**: `016-data-linter`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "Consolidate the three existing single-format linters (JSON
Linter & Formatter, YAML Linter & Validator, XML Linter & Validator — `specs/003-json-linter`,
`specs/004-yaml-linter`, `specs/015-xml-linter`) into one tool, `/data-linter`, with a
JSON/YAML/XML tab strip that switches in-page with no reload — cutting the clicks needed to
check the same content against multiple formats, and reducing DevSuite's tool-list sprawl.
Every action the three standalone tools currently offer is preserved unchanged; `/json`,
`/yaml`, `/xml` keep resolving (same page, defaulting to the matching tab) so existing
bookmarks don't break. This spec supersedes and retires (but does not delete)
`specs/003-json-linter/spec.md`, `specs/004-yaml-linter/spec.md`, and
`specs/015-xml-linter/spec.md`."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch formats instantly without losing your place (Priority: P1)

A developer has pasted some content and wants to check it against a different format — e.g.
paste a response body, confirm it's valid JSON, then flip to the YAML tab to see whether the
same text also holds up as YAML — without navigating to a different page, losing what's typed,
or waiting on a reload.

**Why this priority**: This is the entire reason this tool exists instead of three separate
ones — it replaces "navigate away, lose your place, navigate to the next tool" with one click.
Every other capability already existed in the three standalone tools; only this is new.

**Independent Test**: With text in the input editor while the JSON tab is active, click the
YAML tab and confirm the same text is still there, the editor's language mode and visible
action buttons have switched to YAML's, and no page navigation occurred.

**Acceptance Scenarios**:

1. **Given** text in the input editor while the JSON tab is active, **When** the user clicks
   the YAML tab, **Then** the input editor's text is unchanged, the editor's syntax-highlight
   language switches to YAML, the status pill re-evaluates the same text against the YAML
   parser, JSON-only actions (Sort Keys, → YAML) are hidden, and YAML-only actions (→ JSON,
   → JSON min) appear.
2. **Given** any tab is active with output already showing in the output pane, **When** the
   user switches to a different tab, **Then** the output pane resets to its empty state (the
   prior tab's output was the result of an action run against a different format and is
   cleared rather than left showing under a mismatched label) — the input editor is
   unaffected.
3. **Given** the user is mid-type when a tab switch happens, **When** the switch completes,
   **Then** the 600ms live-validation debounce restarts against the newly active tab's parser
   rather than resolving against the previous tab's.

---

### User Story 2 - Validate the active format with precise errors (Priority: P1)

A developer pastes content into the editor and, for whichever format tab is active, gets
immediate feedback on validity with a specific, actionable error if it doesn't parse.

**Why this priority**: Validation is each format's core value, carried over unchanged from the
three standalone tools — the consolidation must not weaken it.

**Independent Test**: On each tab in turn, paste that format's malformed content and confirm
an error appears (live, within 600ms, and via the explicit Validate action); paste valid
content and confirm a "Valid" status.

**Acceptance Scenarios**:

1. **Given** the JSON tab is active, **When** the input is malformed JSON, **Then** the status
   pill reads "Invalid JSON" and the error panel shows the JSON parser's message — identical
   behavior to `specs/003-json-linter` FR-001/FR-002.
2. **Given** the YAML tab is active, **When** the input is malformed YAML, **Then** the status
   pill reads "Invalid YAML" and the error panel shows `js-yaml`'s error message plus the
   existing remediation hint — identical behavior to `specs/004-yaml-linter` FR-002.
3. **Given** the XML tab is active, **When** the input is malformed XML, **Then** the status
   pill reads "Invalid XML" and the error panel shows the browser's `parsererror` text plus
   the existing remediation hint — identical behavior to `specs/015-xml-linter` FR-002/FR-006.
4. **Given** any tab, **When** the content is valid for that tab's format, **Then** the status
   pill shows the format-specific "Valid" state and Validate produces a preview in the output
   pane, exactly as each standalone tool already does.

---

### User Story 3 - Use each format's own transforms (Priority: P2)

A developer applies whichever in-format transform actions the active tab's format supports —
formatting, minifying, or sorting — exactly as they could in the standalone tool for that
format. (Cross-format conversion is User Story 6.)

**Why this priority**: Preserves existing value; not the reason this feature exists, but
nothing may regress.

**Independent Test**: On each tab, exercise every action that tab exposes and confirm the
output matches what the corresponding standalone tool produces for the same input.

**Acceptance Scenarios**:

1. **Given** the JSON tab is active with valid JSON, **When** the user clicks Format, Minify,
   or Sort Keys, **Then** each produces the same output as `specs/003-json-linter`
   FR-003–FR-005 (2-space pretty-print, single-line minify, recursive alphabetical key sort
   respectively).
2. **Given** the YAML tab is active with valid YAML, **When** the user clicks Format, **Then**
   it produces the same output as `specs/004-yaml-linter` FR-004 (2-space/120-column/
   double-quote re-dump).
3. **Given** the XML tab is active with well-formed XML, **When** the user clicks Format or
   Minify, **Then** each produces the same output as `specs/015-xml-linter` FR-004–FR-005
   (2-space structural reindent; whitespace-only-node stripping that never touches mixed
   content, CDATA, or comments).
4. **Given** any tab, **When** an action is invoked against invalid input for that tab's
   format, **Then** the action is refused — the error panel and an error toast are shown
   instead of output, exactly as each standalone tool already behaves.

---

### User Story 6 - Convert to any other format (Priority: P2)

A developer has content in one format and needs it in another — e.g. an XML API response they
need as JSON for a test fixture, or a JSON config they need as TOON to paste into an
LLM-token-budget-constrained prompt — without leaving the tool or copy-pasting through a third
one.

**Why this priority**: The original consolidation (US1/US2) only let JSON→YAML and YAML→JSON
convert; XML and the newly added TOON format were conversion dead ends. This closes that gap so
every one of the four formats can become any of the other three.

**Independent Test**: On each tab, paste valid content for that tab's format, click each of the
three "Convert to <format>" buttons in turn, and confirm the output pane shows correctly
formatted output in the target format (parseable by that target format's own Validate).

**Acceptance Scenarios**:

1. **Given** any tab with valid input, **When** the user clicks "Convert to <format>" for any
   of the other three formats, **Then** the output pane shows that content re-serialized in the
   target format (FR-010), and re-running the target format's own Validate on that output (by
   switching to it and pasting it in) reports it valid.
2. **Given** any tab with invalid input for its own format, **When** the user clicks any
   "Convert to <format>" button, **Then** the conversion is refused with the same error
   panel/toast pattern as Format/Minify — no output is produced.
3. **Given** the JSON tab holds `{"roles": ["admin", "ops"]}`, **When** the user clicks Convert
   to XML, **Then** the output wraps the array under a `<roles>` element with two `<item>`
   children (FR-013) rather than losing the `roles` field name.
4. **Given** the TOON tab is active, **When** the user pastes TOON with a tabular array header
   (e.g. `items[2]{sku,qty}:` followed by two comma-separated rows), **Then** Validate reports
   it valid and Convert to JSON produces an array of two objects with `sku`/`qty` keys.

---

### User Story 7 - Auto-detect the pasted content's format (Priority: P3)

A developer pastes content without first checking or remembering which tab matches it — the
tool offers to switch to the tab it thinks matches, while manual tab selection remains fully
available at every point (before, during, and after any auto-detected switch).

**Why this priority**: A convenience on top of already-complete functionality (every format
already works correctly once the right tab is active) — useful, but nothing breaks without it,
and it must never take away the manual control User Story 1 already established.

**Independent Test**: On any tab, paste (via the Paste button, or natively with Ctrl/Cmd+V)
content belonging to a different format and confirm the tool switches to the matching tab; then
manually click a different tab and confirm the switch is respected (auto-detect never fights
back or re-triggers on its own).

**Acceptance Scenarios**:

1. **Given** the JSON tab is active, **When** the user pastes well-formed XML (via the Paste
   button or native Ctrl/Cmd+V), **Then** the tool switches to the XML tab and a toast names the
   detected format.
2. **Given** any tab, **When** the user clicks Detect with content already in the editor that
   belongs to a different format, **Then** the tool switches to that tab; if the content already
   matches the active tab, no switch occurs and a toast confirms the match instead.
3. **Given** any tab, **When** the user types content by hand (not a paste), **Then** no
   auto-detection runs and no tab switch occurs — auto-detect only triggers on paste or an
   explicit Detect click, never on ordinary typing, so composing content on a deliberately
   chosen tab is never interrupted.
4. **Given** pasted or Detect-target content that no parser accepts, or that only accepts as an
   unstructured bare scalar under YAML's very permissive grammar (e.g. plain prose), **When**
   detection runs, **Then** no tab switch occurs and, for the explicit Detect button, a warning
   toast says detection wasn't confident (the Paste button stays silent on this case rather than
   warning on every plain-text paste).
5. **Given** content that is syntactically valid under more than one format (e.g. any JSON
   document is also valid YAML; a plain `key: value` document is valid under both YAML and
   TOON), **When** detection runs, **Then** the priority order XML → TOON (only when a
   `key[N]`/`[N]` bracket header is present) → JSON → YAML → TOON (generic) resolves the
   ambiguity deterministically (FR-012).

---

### User Story 4 - Old bookmarks still land on the right tab (Priority: P2)

A developer who bookmarked `/json`, `/yaml`, or `/xml` before this consolidation opens that
bookmark and lands in a working tool with the format they expect already active.

**Why this priority**: Consolidating three tools into one must not break links or muscle
memory that already existed — a real cost of the "one roof" approach if left unaddressed.

**Independent Test**: Visit `/json`, `/yaml`, and `/xml` directly (not via `/tools`) and
confirm each returns the same working page with the matching tab pre-selected, with no
redirect (the address bar keeps the visited URL).

**Acceptance Scenarios**:

1. **Given** a browser navigates directly to `/json`, **When** the page loads, **Then** the
   tool renders with the JSON tab active — same outcome as before consolidation.
2. **Given** a browser navigates directly to `/yaml`, **When** the page loads, **Then** the
   tool renders with the YAML tab active.
3. **Given** a browser navigates directly to `/xml`, **When** the page loads, **Then** the
   tool renders with the XML tab active.
4. **Given** a browser navigates to `/data-linter` (the tool's primary, discoverable route)
   with no format hint, **When** the page loads, **Then** the tool defaults to the JSON tab.
5. **Given** a browser navigates to `/data-linter?tab=xml`, **When** the page loads, **Then**
   the tool renders with the XML tab active — the same querystring mechanism Diff Checker
   already uses for its Folder Diff view.

---

### User Story 5 - Clear, paste, and copy workflow (Priority: P3)

A developer clears the editor, pastes from the clipboard, or copies the current output back
out — shared chrome that behaves identically regardless of which tab is active.

**Why this priority**: Supporting utility actions, unchanged from all three standalone tools.

**Independent Test**: On any tab, exercise Clear, Paste, and Copy Output and confirm each
performs its documented effect.

**Acceptance Scenarios**:

1. **Given** any tab and any editor state, **When** the user clicks Clear, **Then** the input
   editor, output pane, and error panel reset to empty and the status pill returns to "Ready".
2. **Given** any tab, **When** the user clicks Paste, **Then** clipboard text replaces the
   input editor's content (or a permission-denied warning toast appears), independent of
   which tab is active.
3. **Given** output has been produced on the current tab, **When** the user clicks Copy
   Output, **Then** the last-shown output text is written to the clipboard.

---

### Edge Cases

- **Switching tabs with an in-flight live-validation debounce timer**: the timer for the
  previous tab's parser is cancelled; a fresh 600ms timer starts against the newly active
  tab's parser (User Story 1, Scenario 3).
- **Switching tabs while the output pane shows a prior tab's result**: the output pane resets
  to empty rather than displaying a result under a mismatched format label (User Story 1,
  Scenario 2).
- **Empty input on any tab's action buttons**: unchanged from each standalone tool — a
  "Editor is empty" / "Nothing to format" / etc. warning toast, no-op.
- **Clipboard permission denied** on Paste: unchanged — a warning toast instructs manual
  `Ctrl+V`, not a hard failure, regardless of active tab.
- **Direct navigation to `/data-linter?tab=` with an unrecognized value**: falls back to the
  JSON tab default rather than erroring.
- **Converting a value with a key that isn't a valid XML element name**: invalid characters are
  replaced with `_` (FR-013) — not reversible back to the original key on a further XML→other
  round trip.
- **Converting TOON with nested tabular field-groups** (`orders[2]{id,customer{name,country}}:`)
  pasted from an external TOON source: not decoded by this implementation's parser (FR-011) —
  treated as a parse error rather than silently dropping data.
- **Converting a value containing a JS value TOON/XML cannot represent** (e.g. a JSON number
  outside the safe integer/finite range is not itself invalid, but `undefined` inside an array
  literal, which `JSON.parse` never produces): out of scope — every conversion's *source* value
  always comes from one of this tool's own four parsers, none of which can produce such a value.
- **Pasting content that parses under more than one format** (FR-012 priority order resolves
  this — see User Story 7, Scenario 5): deterministic, not an error state.
- **Pasting content the auto-detect heuristic can't confidently place** (invalid under all four
  parsers, or only a bare YAML scalar like plain prose): the active tab does not change; the
  Paste button stays silent about it (a failed *detection* isn't a failed *paste*), while the
  explicit Detect button surfaces a warning toast since detection was the only thing it did.
- **Pasting into a tab whose content already matches the pasted format**: no tab switch (nothing
  to switch to) and no extra toast beyond the normal "Pasted from clipboard" — auto-detect is
  silent when it has nothing to offer.
- **Typing content that happens to become parseable as a different format mid-edit**: no
  detection runs and no tab switches — FR-012 fires only on paste or the explicit Detect click,
  deliberately never on `onDidChangeModelContent`, so a deliberately chosen tab is never
  second-guessed while the user is actively composing content on it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST serve one page, at a single primary route, presenting a JSON /
  YAML / XML / TOON tab strip; selecting a tab MUST NOT reload or navigate the page.
- **FR-002**: Switching tabs MUST preserve the input editor's current text unchanged, MUST
  switch the editor's syntax-highlighting language to match the newly active tab, MUST reset
  the output pane to its empty state, MUST show only the newly active tab's format-specific
  action buttons, and MUST re-run live validation against the newly active tab's parser.
- **FR-003**: The JSON tab MUST expose Validate, Format, Minify, and Sort Keys, each behaving
  identically to `specs/003-json-linter`'s corresponding requirement.
- **FR-004**: The YAML tab MUST expose Validate and Format, each behaving identically to
  `specs/004-yaml-linter`'s corresponding requirement.
- **FR-005**: The XML tab MUST expose Validate, Format, and Minify, each behaving identically
  to `specs/015-xml-linter`'s corresponding requirement (well-formedness only; Format/Minify
  never corrupt mixed content, CDATA, or comments).
- **FR-006**: Clear, Paste, Copy Output, live character/line counts, the 600ms live-validation
  debounce, and the `Ctrl/Cmd+Enter` Validate shortcut MUST behave identically across all four
  tabs — this chrome is shared, not per-tab state.
- **FR-007**: The routes `/json`, `/yaml`, and `/xml` MUST continue to return HTTP 200 (not a
  redirect) serving this same tool, each defaulting to its corresponding tab; the primary
  route MUST also accept a `?tab=json|yaml|xml|toon` query parameter, defaulting to the JSON
  tab when absent or unrecognized. TOON has no dedicated legacy-style bare route (it postdates
  any bookmarkable history) — it is reachable only via `/data-linter?tab=toon`.
- **FR-008**: This consolidation MUST NOT introduce any new third-party dependency — JSON,
  YAML (`js-yaml`, already vendored), XML (native `DOMParser`/`XMLSerializer`), and TOON (a
  first-party encoder/decoder implemented in this file, §FR-010) each keep using exactly the
  parsing mechanism their format calls for. No TOON npm package is vendored.
- **FR-009**: The DevSuite tools directory (`/tools`) MUST show exactly one card for this
  tool; the three prior standalone JSON/YAML/XML cards MUST be removed.
- **FR-010**: Every tab MUST expose a "Convert to <format>" action for each of the other three
  formats (e.g. the JSON tab shows → YAML, → XML, → TOON), replacing the narrower per-pair
  conversions FR-003/FR-004 previously specified (JSON's → YAML, YAML's → JSON / → JSON (min)).
  Conversion parses the active tab's input into a canonical plain-value representation (the
  same JS object/array/primitive shape `JSON.parse` and `jsyaml.load` already produce) and
  re-serializes it in the target format; invalid input in the active tab's format MUST refuse
  the conversion with the same error panel/toast pattern as Format/Minify, without touching
  the output pane.
- **FR-011**: The TOON tab implements [Token-Oriented Object Notation](https://github.com/toon-format/spec)
  — comma-delimited, 2-space indent, tabular arrays for uniform arrays of flat objects, list
  form (`- `) otherwise. Nested tabular field-groups (`{customer{name,country}}`) are a spec
  feature this implementation does not encode (falls back to list form) though it is a known,
  documented gap rather than silent data loss — round-trips through this implementation's own
  output are unaffected since the encoder never produces that construct. TOON has no Minify
  action (the format has no non-structural whitespace to strip).
- **FR-012**: Pasting content (via the toolbar Paste button or native Ctrl/Cmd+V) and clicking
  the explicit Detect button both run format auto-detection against the current editor content
  and switch to the detected tab if it differs from the active one; typing does not trigger
  detection. Detection priority: XML (leading `<` and well-formed) → TOON (only when a
  `key[N]`/`[N]` bracket-length array header is present anywhere in the text, and it decodes
  successfully) → JSON (any successful strict parse, including bare literals like `42` or
  `"str"`) → YAML (successful parse whose result is a mapping or sequence — a bare scalar like
  plain prose does not count, since YAML's grammar accepts nearly any text as a scalar) → TOON
  (generic — a successful decode producing a mapping or sequence, for TOON documents without a
  bracket header) → XML (generic fallback). No match at all leaves the active tab unchanged.
  Manual tab clicks always remain available and are never blocked or reverted by this feature.
- **FR-013**: Converting an object/array value to XML (FR-010) wraps named array fields in
  their key's element with repeated `<item>` children (`{"roles":["a","b"]}` →
  `<roles><item>a</item><item>b</item></roles>`) so the field name survives the round trip.
  Object/array keys that are not valid XML element names have invalid characters replaced with
  `_` when converted to XML — this is lossy and not reversible back to the original key.
  Converting XML to another format infers `null`/`true`/`false`/number leaf values the same way
  the TOON decoder does (FR-011), otherwise keeping leaf text as a string; XML attributes are
  not preserved by this conversion path (there is no attribute concept in the canonical value
  model) — validating/formatting/minifying XML on the XML tab itself is unaffected and keeps
  attributes intact, since those actions never leave XML's own DOM representation.

### Key Entities

- **Active Tab**: one of `json` / `yaml` / `xml` / `toon`; determines the editor's language
  mode, which action buttons are visible, and which parser live validation and every action run
  against. Set on load from the route/query param (FR-007) and thereafter by direct tab clicks.
- **Input Document**: the raw text in the input editor; shared across tab switches (FR-002) —
  the only editor the user directly types into.
- **Output Document**: a separate, read-only pane that the active tab's actions write into;
  reset to empty on every tab switch (FR-002), never fed back into the input editor.
- **Validation State**: one of idle / valid / invalid, scoped to the active tab's parser,
  driving the status pill and error panel.
- **Canonical Value**: the plain JS object/array/primitive representation every format's parser
  produces and every format's serializer consumes (FR-010) — the hub every "Convert to <format>"
  action routes through, so the matrix needs 4 parsers + 4 serializers rather than 12 bespoke
  pairwise converters.
- **Detected Format**: the result of running the FR-012 auto-detect heuristic against the
  current editor content — one of `json` / `yaml` / `xml` / `toon` / no-match. Advisory only: it
  offers to switch the Active Tab (and does, on paste/Detect if it differs from the current
  tab) but is never itself a source of truth for parsing — once a tab is active, that tab's own
  parser is what actually validates/transforms/converts the content, regardless of how the tab
  became active.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can check the same pasted content against a second format in one click
  and zero page loads, down from two full page navigations (tool page → `/tools` → other
  tool page) before this consolidation.
- **SC-002**: Every action available in the three standalone tools remains available and
  produces identical output for identical input after consolidation — zero behavior
  regressions.
- **SC-003**: A pre-existing bookmark to `/json`, `/yaml`, or `/xml` continues to load a
  working, correctly-tabbed tool — zero broken links from this change.
- **SC-004**: DevSuite's total tool count decreases from 13 to 11 (three standalone linter
  cards replaced by one consolidated card), reducing the number of clicks from `/tools` to
  reach any of the three formats' linting capability to exactly one, regardless of format.
- **SC-005**: Any of the four formats can be converted to any of the other three in one click
  (FR-010) — up from JSON→YAML and YAML→JSON/JSON-min being the only two conversion pairs
  before this extension, and XML/TOON having none.
- **SC-006**: Pasting content belonging to a different format than the currently active tab
  reaches the correct tab in one paste (zero manual tab clicks) for any of the four formats,
  down from always requiring a manual click before this extension — without removing the manual
  click as an option (FR-012).

## Assumptions

- **Default tab is JSON** when the primary route is visited with no format hint — JSON Linter
  was the first and most historically reached-for of the three standalone tools.
- **Output pane resets on tab switch; input editor does not** — a deliberate design decision
  (User Story 1, Scenario 2) made to avoid showing a transform result mislabeled under the
  wrong format after a switch, at the cost of requiring one extra click (re-run the action) if
  a user genuinely wants to compare two formats' output side by side. No case in the original
  three tools required comparing outputs across formats simultaneously, so this tradeoff was
  judged acceptable rather than adding a per-tab output cache.
- **Backward-compatible routes are additive, not redirects** — `/json`/`/yaml`/`/xml` return
  200 directly rather than 3xx-redirecting to `/data-linter`, since DevSuite is a
  loopback-only local tool (no SEO concern) and this keeps the implementation simpler (no
  redirect-loop or query-param-preservation edge cases to handle).
- **No DevDB persistence, no auth** — matches all three prior standalone tools; this tool is
  fully stateless, nothing survives a page reload beyond whatever tab the route/query param
  specifies.
- **`specs/003-json-linter/spec.md`, `specs/004-yaml-linter/spec.md`, and
  `specs/015-xml-linter/spec.md` are superseded, not deleted** — their `Status` fields are
  updated to point here, following the same treatment `specs/001-devsuite-baseline/spec.md`
  already receives as a superseded-but-kept-for-record historical spec. Their functional
  requirements remain the source of truth for exact per-format behavior this spec must match
  (FR-003–FR-005 above reference them directly rather than re-deriving each detail).
- **TOON is a first-party implementation of a subset of the published spec**
  (https://github.com/toon-format/spec), not a vendored library (FR-008/FR-011) — comma
  delimiter only (no tab/pipe), 2-space indent only (not configurable), and no nested tabular
  field-groups on encode (falls back to list form; decode rejects them as a parse error rather
  than guessing). This covers TOON's documented "sweet spot" (uniform arrays of flat objects)
  and every shape this tool's own encoder can produce, at the cost of not accepting every
  valid document the formal spec allows.
- **The any-to-any conversion matrix (FR-010) replaces the narrower JSON→YAML / YAML→JSON(-min)
  buttons the original consolidation shipped** — a deliberate behavior change from this spec's
  first version, requested once XML and TOON needed the same capability; SC-002's "zero
  behavior regressions" claim from the original consolidation no longer strictly holds for
  those two specific buttons (superseded by the more general FR-010), which is treated as
  acceptable scope evolution rather than a regression since the underlying capability (JSON
  ⇄ YAML) is still reachable via the general Convert buttons.
- **XML conversion has no attribute concept in the canonical value model (FR-013)** — this is a
  reduction in fidelity versus XML's own Validate/Format/Minify (which never leave XML's DOM
  representation and so keep attributes intact). A future iteration could map attributes to a
  reserved key (e.g. `@attributes`, matching `013-file-converter`'s existing convention) if a
  concrete need for round-tripping attribute-bearing XML through JSON/YAML/TOON arises; not
  built now since no such need was stated for this extension.
- **Auto-detection never overrides manual control** (FR-012) — it only fires on paste (button or
  native Ctrl/Cmd+V) or an explicit Detect click, and it only ever *offers* a switch by actually
  performing it once, immediately; there is no "detection mode" toggle, no periodic re-detection,
  and ordinary typing never triggers it. This was a hard requirement from the request that
  motivated this feature ("keep manual as well"), not a judgment call this spec made
  independently.
- **Detection priority favors the more syntactically specific / less permissive format when
  content is ambiguous** (XML's `<` marker → TOON's `[N]` bracket marker → JSON's strict literal
  grammar → YAML's mapping/sequence-only structured parse → TOON's unmarked generic form → XML
  generic fallback) — chosen because the alternative (e.g. defaulting ambiguous content to
  whichever format's parser happens to run first in an arbitrary order) would make YAML-superset
  formats like JSON rarely detected as themselves. A bare YAML scalar (e.g. pasted prose) is
  deliberately excluded from counting as a YAML "detection" — otherwise nearly any pasted text
  would falsely claim to be YAML, since YAML's plain-scalar grammar accepts almost anything.
