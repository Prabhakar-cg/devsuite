# Quickstart & Validation: Data Format Linter

Manual validation plan for once the tool is built — no automated coverage is planned
initially, matching all three predecessors (`003-json-linter`/`004-yaml-linter`/
`015-xml-linter`).

## Setup

```bash
# from repo root, with the DevSuite server already running per README.md
open http://localhost:8000/data-linter
open http://localhost:8000/json    # legacy route — should still work
open http://localhost:8000/yaml    # legacy route — should still work
open http://localhost:8000/xml     # legacy route — should still work
open http://localhost:8000/data-linter?tab=toon   # TOON has no bare legacy route
```

## Functional validation (maps to spec user stories)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| US1 | Tab switch preserves input | Paste text on the JSON tab, click the YAML tab | Same text still in the editor; language mode is now YAML; status pill re-evaluates against `js-yaml`; Sort Keys/→YAML hidden, → JSON/→ JSON (min) shown |
| US1 | Tab switch resets output | Run Format on the JSON tab (output pane populates), switch to XML tab | Output pane returns to its empty state; input text unchanged |
| US1 | Debounce restarts on switch | Type invalid JSON, immediately (within 600ms) switch to YAML tab | No stale "Invalid JSON" flash after switching — validation resolves against YAML, not the interrupted JSON check |
| US2 | Validate — JSON | JSON tab, paste malformed JSON | Status pill "Invalid JSON", error panel shows the JSON parser's message |
| US2 | Validate — YAML | YAML tab, paste malformed YAML | Status pill "Invalid YAML", error panel shows `js-yaml`'s message + hint |
| US2 | Validate — XML | XML tab, paste malformed XML (e.g. `<a><b></a>`) | Status pill "Invalid XML", error panel shows the `parsererror` text + hint |
| US3 | JSON transforms | JSON tab, valid JSON, click Format / Minify / Sort Keys / → YAML in turn | Each matches `003-json-linter` quickstart.md's equivalent row exactly |
| US3 | YAML transforms | YAML tab, valid YAML, click Format / → JSON / → JSON (min) in turn | Each matches `004-yaml-linter` quickstart.md's equivalent row exactly |
| US3 | XML transforms | XML tab, well-formed XML with mixed content, click Format then Minify | Each matches `015-xml-linter` quickstart.md's equivalent rows exactly — mixed content/CDATA untouched |
| US3 | TOON Validate/Format | TOON tab, paste `items[2]{sku,qty}:` header + two comma rows, click Validate then Format | Status pill "Valid TOON"; Format re-emits canonical TOON (2-space indent, same tabular form) |
| US6 | Convert JSON → YAML/XML/TOON | JSON tab, `{"roles":["admin","ops"]}`, click each of the three Convert buttons in turn | → YAML: `roles:` list; → XML: `<roles><item>admin</item><item>ops</item></roles>` (field name preserved); → TOON: `roles[2]: admin,ops` |
| US6 | Convert XML → JSON | XML tab, the XML output from the row above, click Convert to JSON | Reproduces `{"roles":["admin","ops"]}` (round-trips through the array-wrapper convention) |
| US6 | Convert TOON → JSON | TOON tab, `items[2]{sku,qty}:` + two rows, click Convert to JSON | `{"items":[{"sku":...,"qty":...},{"sku":...,"qty":...}]}` |
| US6 | Convert invalid input | Any tab, malformed content for that tab's format, click any Convert button | Conversion refused — error panel + error toast, no output produced |
| US4 | Legacy route defaults | Visit `/json`, `/yaml`, `/xml` directly (fresh tab, no `/tools` click-through) | Each loads the tool with the matching tab pre-active, HTTP 200, address bar unchanged (no redirect) |
| US4 | TOON via query param | Visit `/data-linter?tab=toon` | Loads with the TOON tab active (TOON has no bare legacy route, per FR-007) |
| US7 | Paste auto-switches | JSON tab active, paste (button or Ctrl/Cmd+V) well-formed XML | Tab switches to XML; toast names the detected format |
| US7 | Detect button | Any tab, content from a different format already in the editor, click Detect | Tab switches to the matching format; toast confirms |
| US7 | Detect — already correct | Any tab, content matching the active tab, click Detect | No tab switch; toast confirms the match instead |
| US7 | No false-positive on typing | JSON tab active, type (not paste) content that happens to also be valid YAML | No tab switch — typing never triggers detection |
| US7 | No false-positive on prose | Any tab, paste plain prose ("hello world") | No tab switch; Paste stays silent, Detect shows a "not confident" warning toast |
| US7 | Ambiguous key:value defaults to YAML | Any tab, paste `id: 123\nname: Ada` (valid under both YAML and TOON, no bracket header) | Switches to (or confirms) YAML, not TOON |
| US4 | Primary route + query param | Visit `/data-linter` (no `tab`), then `/data-linter?tab=xml` | First defaults to JSON tab; second loads with XML tab active |
| US5 | Clear/Paste/Copy | On any tab, exercise Clear, Paste, Copy Output | Same behavior regardless of active tab; matches predecessors |
| — | Empty input | Clear editor, click any action button on any tab | Warning toast ("Editor is empty" / "Nothing to format" / etc.); no crash |
| — | Keyboard shortcut | Focus anywhere, press `Ctrl/Cmd+Enter` on any tab | Triggers Validate for the currently active tab |

## Regression check against predecessors

For each of the nine transform actions (JSON: Format/Minify/Sort Keys/→YAML; YAML:
Format/→JSON/→JSON min; XML: Format/Minify), feed the **same input** used in that
predecessor's own `quickstart.md` and confirm byte-identical output — this is the concrete
check behind SC-002 ("zero behavior regressions").

## No automated gate today

There is no `pytest`/`node tests/javascript/run.js` coverage planned for this tool, matching
all three predecessors. If automated coverage is added later (v1.0.0 Playwright e2e
milestone), it should assert at minimum: tab-switch preserves input/resets output, each of the
nine transforms' happy/error paths, and that no `fetch`/`XMLHttpRequest` is ever issued from
`data-linter.html`.

## Acceptance gates

- Every functional-validation row above passes manually.
- `pytest tests/python/` and `node tests/javascript/run.js` continue to pass — in particular
  `test_asset_order.py` (js-yaml-before-require.js ordering, research.md R4) and `test_csp.py`.
- `specs/SPEC.md` §3.2/§3.4/§4 all reflect the consolidated tool, and `003-json-linter`/
  `004-yaml-linter`/`015-xml-linter` show `Status: Superseded`.
- Tool count is 11 and in sync across `routes/pages.py`, `static/tools.html`,
  `static/home.html`, and `README.md`.
