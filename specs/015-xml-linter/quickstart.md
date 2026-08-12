# Quickstart & Validation: XML Linter & Validator

Manual validation plan for once the tool is built — mirrors the JSON/YAML linters' quickstart
shape. No automated coverage is planned initially (see Complexity Tracking in `plan.md`),
matching the existing JSON/YAML linters.

## Setup

```bash
# from repo root, with the DevSuite server already running per README.md
open http://localhost:8000/xml   # or curl -s http://localhost:8000/xml | head
```

## Functional validation (maps to spec user stories)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| US1 | Live validation, invalid input | Paste `<root><a></root>` (mismatched tag), wait 600ms | Status pill → "Invalid XML"; error panel shows the `DOMParser` `parsererror` text + hint |
| US1 | Live validation, valid input | Paste `<root><a>1</a><b>2</b></root>` | Status pill stays "Ready" while idle; click Validate → "Valid XML ✓", success toast, re-serialized preview shown |
| US1 | Multiple root elements | Paste `<a/><b/>` (two top-level elements) | Validate → "Invalid XML", error panel shown |
| US1 | DOCTYPE / comments / CDATA / PI | Paste XML containing a DOCTYPE, a `<!-- comment -->`, a `<![CDATA[...]]>` section, and `<?pi?>` | Validate → "Valid XML ✓" — no external DTD fetch occurs (verify via browser Network tab: zero requests) |
| US2 | Format | Paste single-line XML, click Format | Output pane shows 2-space-indented XML labeled "Formatted XML" |
| US2 | Minify | Paste indented XML, click Minify | Output pane shows the document with inter-tag whitespace removed, labeled "Minified XML"; non-whitespace text content unchanged |
| US2 | Minify preserves mixed content | Paste `<p>Hello <b>world</b>!</p>`, click Minify | Output text content is untouched (`Hello `, `world`, `!` all preserved) — only whitespace *between* sibling tags with no text is stripped |
| US2 | Format/Minify on invalid input | Break the XML, click Format or Minify | Error panel shown, error toast; no output produced |
| — | Empty input | Clear editor, click any action button | Warning toast ("Editor is empty" / "Nothing to format" / "Nothing to minify"); no crash |
| — | Clipboard | Click Paste / Copy Output | Content moves via `navigator.clipboard`; permission denial shows a graceful warning toast, not an error |
| — | Keyboard shortcut | Focus anywhere on the page, press `Ctrl/Cmd+Enter` | Triggers the same action as clicking Validate |
| — | Round-trip fidelity (SC-004) | Minify a well-formed document, then Format the minified output | Resulting element/attribute structure matches the original |

## No automated gate today

There is no `pytest`/`node tests/javascript/run.js` coverage planned for the initial cut,
matching the JSON/YAML linters. If automated coverage is added later (v1.0.0 Playwright e2e
milestone per SPEC.md §13), it should assert at minimum: the parsererror-detection logic (R2),
the minify whitespace-node filter's mixed-content safety (R4), and that no
`fetch`/`XMLHttpRequest` is ever issued from `xml.html` (privacy invariant, SC-003).

## Acceptance gates

- Every functional-validation row above passes manually.
- `pytest tests/python/` and `node tests/javascript/run.js` continue to pass unaffected by
  this addition (new page route only; no shared module touched).
- `tests/python/test_asset_order.py` unaffected (no UMD bundle involved).
- `specs/SPEC.md` §4 index has a new row 4.13 linking to this spec, added in the same commit
  as the implementation.
- Tool count is 13 and in sync across `routes/pages.py`, `static/tools.html`,
  `static/home.html`, and `README.md`.
