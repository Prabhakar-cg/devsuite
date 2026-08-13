# Phase 0 Research: Data Format Linter

Forward design decisions for the not-yet-built consolidation. No `[NEEDS CLARIFICATION]`
markers remained after `/speckit-specify` (scope was locked with the user first), so this
phase records the technical choices needed to satisfy the spec.

## R1 — Three concrete per-format function sets, not a plugin abstraction

**Decision**: Carry over `parseJson`/format/minify/sortKeys/toYaml from `003-json-linter`,
`parseYaml`/format/toJson/toJsonMin from `004-yaml-linter`, and `parseXml`/`formatXmlDoc`/
`minifyXmlDoc` from `015-xml-linter` essentially verbatim as three named function groups. No
`LinterPlugin` interface, registry, or generic "format descriptor" abstraction is introduced.

**Rationale**: The set of formats is fixed and known (three, specified in the spec) — there is
no stated requirement or roadmap signal for a fourth. An abstraction only pays for itself once
a new format needs to be added without touching shared code, which isn't a need this spec
states. Matches the project-wide instruction against premature abstraction: "three similar
[things are] better than a premature abstraction."

**Alternative rejected**: A generic `{ id, monacoLang, parse(raw), actions: [...] }` descriptor
array driving a single rendering loop — more code, more indirection, for a benefit (adding a
4th format later) that isn't in scope.

## R2 — Tab switching: `data-tabs` attribute + one `setActiveTab()` function

**Decision**: Each action button carries a `data-tabs="json yaml xml"`-style attribute listing
which tab(s) it's visible on (e.g. Sort Keys → `data-tabs="json"`, Format → `data-tabs="json
yaml xml"`). One `setActiveTab(tab)` function: updates the `activeTab` closure variable, toggles
`.active` on the tab-strip buttons, calls `monaco.editor.setModelLanguage(inputModel, tab)`,
shows/hides action buttons by checking `button.dataset.tabs.split(' ').includes(tab)`, resets
the output pane to empty (spec.md Assumptions), and re-runs live validation against the new
tab's parser.

**Rationale**: Minimal new mechanism — reuses the show/hide-via-`style.display` pattern every
predecessor already uses for its output-empty-state toggle. No new state machine or routing
library needed for three fixed tabs.

**Alternative rejected**: A per-tab `<div>` container that's entirely shown/hidden (three
parallel toolbars in the DOM at once, one visible) — this would let each tab have literally
independent markup, but duplicates the ~10 shared buttons (Validate/Clear/Paste/Copy/status
pill) three times in the DOM for no benefit, since FR-006 requires that chrome to be identical
across tabs anyway.

## R3 — One backend route function, four decorators, all serving one file

**Decision**:

```python
@router.get("/data-linter", ...)
@router.get("/json", ...)
@router.get("/yaml", ...)
@router.get("/xml", ...)
def read_data_linter_tool():
    return _serve_html("data-linter.html")
```

The client reads `location.pathname` (falling back to `/yaml` → yaml tab, `/xml` → xml tab,
anything else including `/data-linter` and `/json` → json tab) and `?tab=` (overrides
pathname when present and recognized) to pick the initial active tab via `setActiveTab()`
from R2.

**Rationale**: `_serve_html()` already does path-independent, content-based cache-busting and
favicon injection — it has no per-route templating hook, and adding one would be new backend
complexity for a decision that's purely "which tab starts active," which is UI state, not
server state. Stacking multiple `@router.get` decorators on one function is standard FastAPI
and keeps `routes/pages.py` at one function instead of four near-identical ones.

**Alternative rejected**: Server-side redirect (`/json` → `302` → `/data-linter?tab=json`) —
rejected explicitly by the spec (FR-007, Assumptions: "additive, not redirects") since this is
a loopback-only local tool with no SEO concern, and a redirect adds a round trip for zero
benefit over serving the same 200 directly.

## R4 — `js-yaml` load-order constraint carries over unchanged

**Decision**: `data-linter.html` keeps the existing `<script src="/static/libs/js-yaml.min.js">`
tag positioned **before** `<script src="/static/libs/require.min.js">`, exactly as both
`json.html` and `yaml.html` already do.

**Rationale**: This is the documented CLAUDE.md gotcha (UMD bundles must load before
`require.min.js`, or RequireJS throws "Mismatched anonymous define()" and kills every button on
the page) — consolidating into one file doesn't change the underlying constraint, and
`tests/python/test_asset_order.py` already asserts it generically (not tied to a specific
filename), so it continues to cover `data-linter.html` once that file exists with the same tag
order.

## R5 — Output-pane-resets-on-tab-switch is implemented as part of `setActiveTab()`, not a
   separate "dirty" flag

**Decision**: `setActiveTab()` unconditionally calls the same `outputModel.setValue('')` /
empty-state-toggle logic every predecessor's Clear button already uses, rather than tracking
"is this output still relevant to the active tab" with extra state.

**Rationale**: Spec.md Assumptions already settled *that* output resets on switch; the only
remaining question is mechanism, and reusing the existing Clear path's output-reset code
(factored into a small shared `resetOutput()` helper called by both Clear and `setActiveTab()`)
avoids two copies of the same four DOM writes.

## R6 — Any-to-any conversion via a canonical-value hub, not 12 pairwise converters

**Decision**: Add a `toCanonicalValue(tab, raw)` / `fromCanonicalValue(format, value)` pair that
every "Convert to <format>" button routes through. JSON's parser already produces a plain JS
value (`JSON.parse`); YAML's already does too (`jsyaml.load`); XML gets a new `xmlToJsonValue()`
bridge; TOON gets a new first-party `toonDecode()`. Serializing back out is the mirror:
`JSON.stringify`, `jsyaml.dump`, a new `jsonToXmlEl()`, and `toonEncode()`.

**Rationale**: This directly contradicts R1's "no plugin abstraction" rule — deliberately. R1
rejected an abstraction for *per-format UI actions* (Format/Minify/Sort Keys), where each format
genuinely does something different and a generic descriptor would only add indirection for three
fixed, unrelated behaviors. Conversion is the opposite case: once there are 4 formats and every
one needs to reach every other one, a direct pairwise implementation is 12 bespoke converters
(and was already visibly not scaling — the original consolidation only wired 2 of what would
become 12 pairs, JSON→YAML and YAML→JSON). A shared canonical value reduces that to 4 parsers +
4 serializers, and the abstraction cost is close to zero because JSON and YAML's parsers already
produced exactly this shape — only XML and TOON needed new bridge code either way.

**Alternative rejected**: Writing all 12 pairwise converters directly (e.g. a dedicated
`xmlToToon()`). Rejected because most of that logic would just be `xmlToJsonValue()` composed
with `toonEncode()` — writing it out 12 times invites the 12 implementations drifting out of
sync with each other, which a single shared value shape structurally prevents.

## R7 — Named-array XML wrapping fixes a data-loss bug found in `013-file-converter`'s
   existing `jsonToXml`/`xmlToJson`, rather than porting it as-is

**Decision**: `jsonToXmlEl(value, tag)` wraps an array field in its own key's element with
repeated `<item>` children: `{"roles":["a","b"]}` → `<roles><item>a</item><item>b</item></roles>`.
`013-file-converter`'s existing `jsonToXml()` (`static/file-converter.html`) instead *drops* the
field's tag entirely for array values (`obj.map(item => jsonToXml(item, 'item'))` discards the
`tag` parameter it was called with), so a field like `roles` disappears and its items are emitted
as bare siblings under whatever the parent happened to be — verified by generating XML for a
payload with a named array field and independently round-tripping it through a Python mirror of
both algorithms (see conversation record); the existing converter's version loses the field name,
this implementation's does not.

**Rationale**: This new tool's conversions are meant to round-trip (JSON → XML → JSON should get
the same shape back), so propagating a bug that breaks that for the common case (a named array
field) was rejected even though "port near-verbatim" is the project's default. `013-file-converter`
itself is out of scope for this spec and was not touched — only this tool's own copy of the logic
was written correctly.

**Alternative rejected**: Fixing `013-file-converter`'s `jsonToXml`/`xmlToJson` in place and
sharing one implementation between the two tools. Rejected as out-of-scope for this spec (that
tool has its own `specs/013-file-converter/` spec and its own behavior contract) and because the
two tools' correctness requirements differ enough (round-trip fidelity here vs. one-shot file
conversion there) that forcing a shared module would be the premature-abstraction mistake R1
already warns against, just one level up.

## R8 — TOON leaf-value type inference reused for XML leaf decoding

**Decision**: XML's leaf-text-to-value inference (`null`/`true`/`false`/number-regex, else
string) is the exact same `inferScalarFromText()` helper TOON's decoder uses for its unquoted
scalar tokens.

**Rationale**: Both formats need the identical judgment call — "this bare text has no explicit
type marker, what should degrade gracefully as a guess" — and using one implementation for both
keeps that judgment call consistent rather than having XML and TOON silently disagree on whether
`"007"` becomes the number `7` or stays a string (both correctly reject it as a number here,
since it has a disallowed leading zero, matching TOON's own spec-mandated rule).

## R9 — Format auto-detection priority: specific-and-strict beats permissive-and-generic

**Decision**: `detectFormat(raw)` tries, in order: (1) XML — cheap `<` leading-character check
before even attempting a parse, then `parseXml().ok`; (2) TOON, but *only* if the text contains
a `key[N]` / `[N]` bracket-length array header (`looksLikeToonHeader()`, reusing the real
`toonParseKeyLine`/`toonParseBareArrayHeader` parsing functions rather than a second regex) —
the one syntax marker TOON doesn't share with YAML; (3) JSON via a strict `JSON.parse` — this
wins even though any valid JSON is also valid YAML, since JSON's literal syntax (quotes, braces,
bare `true`/`false`/`null`/digits) is a deliberate signal; (4) YAML, but only when the parsed
result is a mapping or sequence (`isStructuredValue()`) — a bare parsed scalar doesn't count,
since YAML's plain-scalar grammar accepts almost any text; (5) TOON again, generically this
time, with the same structured-result requirement, for TOON documents with no bracket header;
(6) XML again, as a final generic fallback. No match leaves the active tab unchanged.

**Rationale**: The four formats' grammars nest inside each other in ways that make "try every
parser, take whichever succeeds first" order-dependent and fragile — JSON ⊂ YAML (structurally),
and a plain `key: value` document is valid under both YAML and TOON with no textual
disambiguator at all. Verified empirically in Node before shipping: 13 hand-picked cases
(objects, arrays, tabular TOON, plain XML, bare JSON literals, plain prose, ambiguous
`key: value`) against a faithful reproduction of this exact logic (including the real vendored
`js-yaml` UMD bundle, loaded via `require()` for the test) all resolved to the expected format,
including the two deliberately-ambiguous cases (bare `key: value` → YAML, not TOON; pasted prose
→ no match, not a false-positive YAML detection).

**Alternative rejected**: A single fixed parser-attempt order with no structural-result guard
(i.e., "first successful parse wins," full stop). Rejected because it makes almost every YAML
detection accidentally trigger on *any* plain-text paste (a bare unquoted string is valid YAML),
which would make the feature actively annoying rather than helpful — the exact failure mode the
user's explicit requirement ("keep manual as well") was guarding against.

## R10 — Detection fires on paste (button + native Ctrl/Cmd+V) and an explicit Detect button,
    never on typing

**Decision**: Three trigger points call the same `detectAndSwitch()` helper: the toolbar Paste
button (after `setValue`), Monaco's `onDidPaste` event (native Ctrl/Cmd+V), and a new toolbar
Detect button. `onDidChangeModelContent` (fired on every keystroke) does not call it.

**Rationale**: This is a direct implementation of the user's explicit two-part request —
"auto-identify" and "keep manual as well" — read as: auto-detection should assist the moment new
content *arrives* (which is what pasting is), not fight with a user actively composing or
editing content on a tab they already deliberately chose. Monaco's `onDidPaste` specifically
distinguishes a real paste event from a programmatic `setValue()` or normal typing, which is
exactly the distinction needed — a generic `onDidChangeModelContent` listener can't tell paste
and typing apart. The explicit Detect button covers the case where content already sits in the
editor (typed, or left over from a previous Convert) and the user wants a detection pass without
re-pasting.

**Alternative rejected**: Live detection on every keystroke (debounced like live validation).
Rejected outright — a user typing malformed-then-corrected JSON on the JSON tab would risk being
bounced to a different tab mid-edit the moment their in-progress text happened to also parse as
valid YAML, which is the opposite of "keep manual as well."
