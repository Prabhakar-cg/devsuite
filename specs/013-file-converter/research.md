# Phase 0 Research: File Format Converter

## R1 — Why split client-side vs. server-side by format, rather than doing everything server-side

**Decision**: Structured text formats (JSON/CSV/TSV/YAML/XML) and images convert client-side;
binary office/PDF formats convert server-side.

**Rationale** (inferred from the `server: bool` flag threaded through `CONV_MAP` and the actual
library choices): pure-JS libraries exist and are already vendored for the text formats
(`js-yaml`, `papaparse`) and the browser has native `DOMParser`/`Canvas` for XML and images — so
those conversions cost nothing extra to keep local and fast, and reinforce the "stays on your
machine" mission (SPEC §1.1) for the tool's most common use cases. XLSX (a zipped XML-based
binary format), PDF rendering, and DOCX parsing have no comparably mature, dependency-free
browser-native path — `openpyxl`/`pypdf`/`python-docx`/`weasyprint` are mature, well-maintained
Python libraries already a reasonable dependency for a Python backend, whereas the JS
equivalents (e.g. driving a full PDF renderer in-browser) would mean vendoring a much heavier
WASM bundle for one tool.

**Alternatives considered** (not documented in code, inferred from the shape of the decision):
- *WASM-based XLSX/PDF libraries in-browser*: would preserve the zero-network property for these
  formats too, at the cost of significant bundle size and self-hosting complexity for a
  single-tool benefit; rejected implicitly by not being pursued.
- *Server-side for everything, including JSON/YAML/CSV*: would simplify the client (`CONV_MAP`
  wouldn't need a `server` flag) but would make the fastest, most common conversions dependent on
  a round-trip and Python startup/import cost for no benefit — rejected implicitly.

## R2 — Why `_safe_url_fetcher` restricts weasyprint to `''`/`data:` schemes

**Decision**: `_conv_any_to_pdf()` passes a custom `url_fetcher` to `weasyprint.HTML(...)` that
raises `ValueError` for any URL scheme other than empty or `data:`.

**Rationale** (from the inline comment/structure): converting user-supplied HTML/Markdown/DOCX to
PDF means weasyprint will, by default, follow any `<img src>`/`<link href>` it finds in that
content — including `http://`, `https://`, and `file://` URLs. Without a restriction, this is a
straightforward SSRF (server-side fetches an attacker-chosen URL) and local-file-disclosure
(`file://` reads arbitrary server-local files into the rendered PDF) vector triggered by
uploading a crafted document. Restricting to `data:`/empty schemes preserves the ability to embed
inline images (`data:image/png;base64,...`) — the common case for exported/rendered content —
while closing both attack classes. This mirrors the reasoning behind the CORS proxy's SSRF
protections (SPEC §5.9), applied to a different subsystem.

## R3 — Why format detection is extension-only, not content-sniffed

**Decision**: `extFromName()` / `normalizeExt()` derive the source format purely from the
filename's extension (with `jpeg→jpg` and `markdown→md` aliasing).

**Rationale**: Content-sniffing (magic-byte detection) would add real complexity — JSON/YAML/CSV
in particular are not reliably distinguishable from their first bytes alone (a CSV with one
column and JSON-looking values, a YAML document that happens to start with `{`) — for a tool
whose primary users are developers who already know what file they're uploading and will
correct a wrong auto-detected `from` dropdown in one click. The trade-off favors simplicity.

## R4 — Why HTTP 503 (not 500) for missing optional libraries

**Decision**: Every server-side conversion helper wraps its `import` in a `try/except
ImportError`, raising `HTTPException(503, "... is not installed. Run: pip install ...")`.

**Rationale**: 500 signals "the server is broken"; 503 ("Service Unavailable") more accurately
communicates "this specific capability isn't available right now" while the rest of the app
functions normally — and the actionable `pip install` message turns a confusing failure into a
one-line fix, appropriate for a self-hosted tool where the user IS the operator who can run that
command.

## R5 — TOON support via the shared `static/toon.js` module, not a local copy

**Decision**: `static/toon.js` (a first-party subset implementation of
[TOON](https://github.com/toon-format/spec) — see `specs/016-data-linter/research.md` R6-R9 for
the codec's own design decisions) is loaded by both `static/data-linter.html` and this tool,
rather than each tool carrying its own copy. `CONV_MAP` gets a `toon` node connected to
json/csv/tsv/yaml/xml (all client-side); the existing `convert*Text()` functions each get a
`toon` branch calling `Toon.encode`/`Toon.decode`.

**Rationale**: This tool's `specs/016-data-linter` sibling needed the identical codec first;
duplicating ~250 lines of encoder/decoder logic across two tools would mean any future bug fix
(and one was found and fixed during this same change — R6 below) has to land twice or silently
drift out of sync. Extracting to a shared, `require()`-able module follows the exact precedent
already set by `curl-codegen.js`/`cookie-jar.js`/`collection-utils.js` (SPEC §10.1) — this is the
first of those pure modules to be consumed by *two* tools rather than one, but the browser/node
dual-export pattern needed no changes to support that. `tests/javascript/test_toon.js` gives this
tool real automated coverage for the format it didn't have before (this tool otherwise has zero
automated tests — R3's manual-correction philosophy extends to conversion correctness generally,
but TOON's codec is intricate enough that round-trip unit tests earn their keep here specifically).

**Alternative rejected**: Duplicating the codec inline in `file-converter.html`, matching this
tool's existing single-file-per-tool shape. Rejected once a second consumer existed — the
project's own guidance is to avoid abstraction *until* a need is concrete, and by the time this
tool needed TOON, Data Format Linter's copy already existed and was already the case the
"three similar things is better than a premature abstraction" heuristic doesn't apply to (this
isn't three similar-but-independent things, it's the same 250 lines needed verbatim twice).

## R6 — Fixing `jsonToXml`'s array-field-name-loss bug, found while wiring the completed XML matrix

**Decision**: `jsonToXml(obj, tag)` now wraps an array value in its own `tag` element with
repeated `<item>` children (`{"roles":["a","b"]}` → `<roles><item>a</item><item>b</item></roles>`).
Previously, the array branch (`if (Array.isArray(obj)) return obj.map(item => jsonToXml(item,
'item')).join('\n')`) discarded the `tag` parameter entirely — a field like `roles` vanished from
the output, its items emitted as bare `<item>` siblings under whatever the parent happened to be.
`xmlToJson`'s decode side gained a matching special case: an element with no attributes whose
children are *all* named `item` decodes back to a real array, with plain-scalar items decoded
directly (reusing `Toon.inferScalarFromText`, since the array-wrapper convention is entirely this
tool's own construct that a plain-text leaf inside it can always be typed) rather than the
generic `{"#text": ...}` wrapper every other leaf field still gets — so a string/number array now
survives a JSON→XML→JSON (or YAML→XML→TOON, or any pair through XML) round trip intact.

**Rationale**: This bug was found, not looked for — while completing the XML matrix (adding
YAML→XML, CSV→XML, TSV→XML, TOON→XML and their reverses), it became clear that any object
containing a named array field would silently lose that field's name the moment it passed through
`jsonToXml`, which is now a load-bearing function for six format pairs instead of one
(previously only JSON→XML used it). Left unfixed, every new conversion path through XML would
have inherited a real, silent, unambiguous data-loss bug, not merely an aesthetic issue. The
`#text` wrapper convention for every *other* leaf field, and the `@attributes` convention, are
deliberately left untouched — those are pre-existing, non-lossy (if verbose) design choices for
handling arbitrary/foreign XML that this fix's scope does not extend to.

**Alternative rejected**: Leaving the bug in place and only adding the new conversion pairs.
Rejected because it would have meant knowingly shipping six new conversion pairs that lose data
on a common, unremarkable input shape (any object with an array field) — worse than not adding
those pairs at all.

**Verification**: `jsonToXml`'s output verified well-formed via Python's `xml.etree.ElementTree`;
`xmlToJson`'s decode logic (including the new array-item special case, and the unchanged
`@attributes`/`#text` behavior for everything else) verified via a line-for-line Python mirror of
the actual JS algorithm, round-tripping a payload with a named array field nested inside a named
array of objects (`{"users":[{"id":1,"roles":["admin","ops"]}, ...]}`) back to its original shape.
