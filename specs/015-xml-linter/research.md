# Phase 0 Research: XML Linter & Validator

Forward design decisions for the not-yet-built tool. No `[NEEDS CLARIFICATION]` markers
remained after `/speckit-specify` (scope was locked with the user before the spec was
written), so this phase records the technical choices needed to satisfy the spec rather than
resolving open unknowns.

## R1 — Native `DOMParser`/`XMLSerializer` instead of a vendored XML library

**Decision**: Parse with `new DOMParser().parseFromString(text, "application/xml")` and
re-serialize with `new XMLSerializer().serializeToString(doc)`. No third-party XML library is
added to `static/libs/`.

**Rationale**: Every evergreen browser ships a spec-compliant XML parser as a built-in. Using
it satisfies FR-001 (client-side, no backend transmission) with zero new dependencies, so no
`specs/SPEC.md §11` / `UPGRADE_PLAN.md` update is triggered (Art. II/III, and the
"no new third-party JS deps" cross-cutting rule in CLAUDE.md). This mirrors how the JSON
linter uses the built-in `JSON.parse`/`JSON.stringify` rather than a vendored JSON library.

**Alternatives considered**: A vendored library (e.g. `fast-xml-parser`) — rejected because it
would add a dependency for capability the platform already provides for the well-formedness-
only scope this spec commits to (FR-011 explicitly excludes schema validation, which is the
main reason a heavier library would otherwise be attractive).

## R2 — Detecting parse errors from `DOMParser`

**Decision**: `DOMParser.parseFromString` never throws on malformed XML — it returns a
`Document` whose root element is `<parsererror>` (in the
`http://www.w3.org/1999/xhtml` namespace) containing the browser's diagnostic text. Validity
is determined by checking `doc.getElementsByTagName("parsererror").length === 0` (also guard
against a legitimate user document that itself contains an element literally named
`parsererror`, by additionally checking the element's namespace).

**Rationale**: This is the standard cross-browser technique for surfacing `DOMParser` errors;
Chromium and Firefox both embed line/column information in the `parsererror` text, which
satisfies FR-006's "line/column when available" requirement without extra parsing work.

**Alternative rejected**: Wrapping in try/catch — `DOMParser` doesn't throw for malformed
input, so this would silently treat all malformed XML as valid; would fail Acceptance
Scenario US1.2 outright.

## R3 — Pretty-printing via a small recursive indenter, not a library

**Decision**: `XMLSerializer` produces compact output with no control over indentation.
Format (FR-004) is implemented as a ~30-40 line recursive function that walks the parsed
`Document`, inserts/normalizes whitespace-only text nodes between element children to achieve
2-space-per-level indentation, then serializes.

**Rationale**: Keeps the "no new dependency" property from R1. The transform is small and
well-understood (the same technique appears in many minimal vanilla-JS "format XML" snippets)
— proportionate to a ~370-line single-file tool like `json.html`.

**Alternative rejected**: A full pretty-printing library — unjustified size/complexity for a
single formatting action, and would be DevSuite's second XML-adjacent dependency alongside
zero justification (R1's whole point is that one wasn't needed for parsing either).

## R4 — Minify by removing whitespace-only text nodes via `TreeWalker`

**Decision**: Minify (FR-005) walks the DOM with `document.createTreeWalker(doc,
NodeFilter.SHOW_TEXT)` and removes only text nodes whose content is entirely whitespace
*and* whose parent is an element with element children (i.e. structural indentation, not
meaningful text). Text nodes containing any non-whitespace content, CDATA sections, and
comments are left untouched.

**Rationale**: Directly satisfies FR-005 and the mixed-content edge case in spec.md — naive
whitespace-stripping across the whole serialized string (e.g. a regex over the raw text)
risks corrupting significant whitespace inside text content; walking the DOM and checking
node type is the only reliable way to distinguish "indentation whitespace" from "meaningful
whitespace."

**Alternative rejected**: Regex-based whitespace collapsing on the raw string — rejected
because it cannot safely distinguish inter-tag indentation from significant whitespace inside
a text node (e.g. `<pre>` content or a value like `<name>  Jane Doe  </name>`), which would
violate SC-004 (round-trip fidelity).

## R5 — Reusing the existing two-pane Monaco shell and 600ms debounce

**Decision**: Reuse `DevSuite.initMonaco` (`static/components.js`) for both panes and the
existing 600ms live-validation debounce pattern already shipped in `json.html`/`yaml.html`.

**Rationale**: Consistency with the two sibling linters (same visual language, same
keyboard shortcuts, same `linter.css`) and zero new UI infrastructure — the fastest path to a
spec-compliant tool that doesn't introduce a fourth editor-shell pattern into the codebase.
