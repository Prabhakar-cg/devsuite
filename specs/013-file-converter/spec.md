# Feature Specification: File Format Converter

**Feature Branch**: `013-file-converter`

**Created**: 2026-07-28

**Status**: Implemented (retroactive spec)

**Input**: Retroactive documentation of the already-shipped File Format Converter tool
(`/file-converter`), written from `specs/SPEC.md` §4.12 / §5.7 and verification against
`routes/convert.py` and the inline JS in `static/file-converter.html`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Convert a structured-data file entirely in the browser (Priority: P1)

A developer drags a JSON, CSV, TSV, YAML, or XML file onto the converter and gets an instant
conversion with no data ever leaving the machine.

**Why this priority**: This is the tool's offline-first core — the fastest, most private path,
and the one that should be preferred whenever a conversion pair supports it.

**Independent Test**: Convert a JSON array of objects to CSV — the output renders inline with a
download button, and no `/api/convert` network request is made (verifiable via browser devtools).

**Acceptance Scenarios**:

1. **Given** a `.json` file containing an array of objects, **When** the user selects CSV, TSV,
   YAML, or XML as the target and clicks Convert, **Then** the conversion runs via
   `convertJsonText()` entirely client-side (`jsyaml`/hand-rolled CSV+XML serializers) and the
   result displays with no server round-trip.
2. **Given** a `.csv` or `.tsv` file, **When** converting to JSON, the other delimited format, or
   YAML, **Then** `Papa.parse()` parses it client-side and the result is produced without a
   server call.
3. **Given** a `.yaml` file, **When** converting to JSON or CSV, **Then** `jsyaml.load()` parses
   it client-side.
4. **Given** an `.xml` file, **When** converting to JSON, **Then** the browser's native
   `DOMParser` parses it and a recursive walker (`xmlToJson`) produces the JSON tree client-side.
5. **Given** malformed input for any of the above (invalid JSON/YAML/XML, CSV with parse errors),
   **When** conversion is attempted, **Then** a toast shows "Conversion failed: <message>" and no
   partial/corrupt output is displayed.

---

### User Story 2 - Convert document formats server-side (Priority: P1)

A developer converts an XLSX spreadsheet to CSV/JSON, a PDF or DOCX to plain text, or a
DOCX/HTML/Markdown file to PDF — operations that require server-side Python libraries not
available (or not practical) to run in-browser.

**Why this priority**: These formats (binary spreadsheet/document formats, PDF rendering) have no
practical pure-JS client-side equivalent at production quality; server-side is the only viable
path, and it is still local (`localhost`-only), just not zero-network like User Story 1.

**Independent Test**: Upload an XLSX file, select CSV as target — `POST /api/convert` is called,
and a downloadable CSV is returned; the origin of the request never leaves `localhost`.

**Acceptance Scenarios**:

1. **Given** an `.xlsx` file, **When** converting to CSV or JSON, **Then** `POST /api/convert` is
   called (`target_format` in the multipart form), `openpyxl` reads the workbook server-side, and
   a downloadable file is returned.
2. **Given** a `.csv` or `.json` file, **When** converting to XLSX, **Then** the server builds a
   workbook via `openpyxl` and streams it back as
   `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
3. **Given** a `.pdf` file, **When** converting to TXT, **Then** `pypdf` extracts text
   page-by-page server-side, joined with blank-line separators.
4. **Given** a `.docx` file, **When** converting to TXT, **Then** `python-docx` extracts
   paragraph text server-side.
5. **Given** a `.docx`, `.doc`, `.html`/`.htm`, or `.md`/`.markdown` file, **When** converting to
   PDF, **Then** the server converts the source to an intermediate HTML string (via `mammoth` for
   DOCX, `markdown` for Markdown, passthrough for HTML) and renders it to PDF with `weasyprint`,
   using a hardened `url_fetcher` that blocks any external/`file:` URL scheme in the source
   content (only `''`/`data:` schemes are allowed).
6. **Given** a required Python library is not installed, **When** its conversion path is hit,
   **Then** the server returns HTTP 503 with an actionable `pip install <package>` message rather
   than a generic 500.

---

### User Story 3 - Enforce upload limits (Priority: P2)

The system rejects oversized uploads before doing significant work, protecting the server from
resource exhaustion.

**Why this priority**: A local single-user tool still benefits from basic resource guards,
especially since some conversions (PDF/XLSX parsing) are CPU-intensive.

**Independent Test**: Attempt to convert a file larger than 20 MB — the request is rejected with
HTTP 413 without the full file being buffered.

**Acceptance Scenarios**:

1. **Given** a `Content-Length` header exceeding `MAX_UPLOAD_SIZE` (20 MB, `deps.py`), **When**
   the request arrives, **Then** it is rejected with HTTP 413 before the body is read
   (`_check_content_length_header`).
2. **Given** a request with no/invalid `Content-Length` header but a body that streams past 20 MB,
   **When** `file.read(MAX_UPLOAD_SIZE + 1)` returns more than the limit, **Then** the request is
   still rejected with 413 (defense against a spoofed or absent header).
3. **Given** a `Content-Length` that is present but non-numeric or negative, **When** parsed,
   **Then** the request is rejected with HTTP 400 "Invalid Content-Length header".

---

### User Story 4 - Convert image formats entirely in the browser (Priority: P2)

A developer converts between raster image formats (PNG, JPG, WEBP, GIF, BMP, SVG, ICO) and a
Base64 data-URL representation, all via the Canvas API, with nothing uploaded to the server.

**Why this priority**: Image conversion is a common, self-contained need; doing it via
`<canvas>` keeps it inside the offline-first, zero-network-for-core-features mission, but it's a
secondary path behind the structured-data conversions that are the tool's headline use case.

**Independent Test**: Upload a PNG, select WEBP, convert — the browser draws the image to an
offscreen canvas and re-encodes it via `canvas.toBlob()`/`toDataURL()`, with no `/api/convert`
call.

**Acceptance Scenarios**:

1. **Given** an image file in any of PNG/JPG/JPEG/GIF/BMP/WEBP/SVG/ICO, **When** the target is
   any *other* raster format in that set (or Base64/Data URL), **Then** `convertImage()` draws
   the source to a `<canvas>` and re-encodes to the target via the Canvas API — fully
   client-side.
2. **Given** the source and target formats are identical, **When** building the target-format
   dropdown, **Then** that format is excluded from the options (`imageTargets()` filters `t !==
   src`), and converting GIF→GIF specifically is excluded even though GIF appears as a source.

---

### User Story 5 - Convert structured data to/from TOON (Priority: P2)

A developer converts JSON, CSV, TSV, YAML, or XML into TOON (Token-Oriented Object Notation) to
paste into a token-budget-constrained LLM prompt, or converts TOON back into any of those formats
— all client-side, no data leaving the machine.

**Why this priority**: A new format node connecting to the existing structured-data cluster,
using the same shared `static/toon.js` codec `016-data-linter`'s TOON tab already validated;
useful, but the tool's core value (the formats it already supported) doesn't depend on it.

**Independent Test**: Convert a JSON array of objects to TOON — the output uses TOON's tabular
form (`items[N]{fields}:` header + comma rows) for uniform arrays — then convert that TOON output
back to JSON and confirm it reproduces the original array, with no `/api/convert` network request
at any point.

**Acceptance Scenarios**:

1. **Given** a `.json`, `.csv`, `.tsv`, `.yaml`, or `.xml` file, **When** the user selects TOON as
   the target, **Then** the conversion runs entirely client-side via `Toon.encode()` (loaded from
   the shared `static/toon.js` module) and the result displays with no server round-trip.
2. **Given** a `.toon` file, **When** the user selects JSON, CSV, TSV, YAML, or XML as the target,
   **Then** `Toon.decode()` parses it client-side and the result is produced without a server call.
3. **Given** malformed TOON (e.g. a tabular header declaring more rows than are present), **When**
   conversion is attempted, **Then** a toast shows "Conversion failed: <message>" naming what was
   wrong, not a generic crash.

---

### Edge Cases

- **Server-side XLSX with an empty first sheet**: rejected with HTTP 400 "Spreadsheet is empty"
  rather than returning an empty file.
- **JSON→XLSX where the JSON is not an array of objects**: rejected with HTTP 400 ("JSON must be
  an array of objects for XLSX conversion"); a bare object is auto-wrapped in a single-element
  array first.
- **PDF/DOCX→PDF source URL fetcher**: any `<img src="http://...">` or `file://` reference inside
  converted HTML is blocked at render time (`ValueError` from `_safe_url_fetcher`), preventing
  SSRF-via-PDF-rendering — the resulting PDF simply omits that resource rather than failing the
  whole conversion (weasyprint's fetcher raising typically drops the one resource).
- **`txt` → `md` "conversion"**: passthrough — plain text becomes the "output" with a `.md`
  extension and no transformation, since Markdown is a superset of plain text.
- **File extension is the sole format-detection signal**: there is no content-sniffing; a
  mislabeled extension (e.g. a JSON file named `.txt`) will be routed as `txt`, not `json`.
- **Converting an object/array containing a key that isn't a valid XML element name** (through
  any pair that routes via XML): invalid characters are replaced with `_` when serialized — not
  reversible back to the original key on a further XML→other round trip (same trade-off as
  `016-data-linter`'s identical XML bridge).
- **Converting TOON with nested tabular field-groups** (`orders[2]{id,customer{name,country}}:`)
  from an external TOON source: not decoded by this implementation (`Toon.decode` — see
  `specs/016-data-linter/spec.md` FR-011) — a parse error, not silently-dropped data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support file selection via drag-and-drop onto a drop zone or via a
  file picker.
- **FR-002**: The system MUST auto-detect the source format from the file extension and populate
  a target-format dropdown from a fixed conversion matrix (`CONV_MAP`).
- **FR-003**: For every conversion pair marked client-side in the matrix, the system MUST perform
  the conversion entirely in the browser with no network request.
- **FR-004**: For every conversion pair marked server-side, the system MUST `POST` the file and
  target format to `/api/convert` as multipart form data.
- **FR-005**: The system MUST display text output inline with syntax-appropriate presentation and
  a download button; binary output (XLSX/PDF/images) MUST be offered as a direct download.
- **FR-006**: The backend MUST enforce a 20 MB upload limit (`MAX_UPLOAD_SIZE`), rejecting
  oversized requests via both a `Content-Length` pre-check and a hard read-cap, distinct from the
  `/upload` text-diff endpoint's separate 50 MB limit (SPEC §5.7).
- **FR-007**: The backend MUST return HTTP 503 (not 500) with an actionable message when an
  optional conversion library is not installed.
- **FR-008**: PDF-rendering conversions (`weasyprint`) MUST block non-`data:`/non-empty URL
  schemes in source content to prevent SSRF via embedded resource references.
- **FR-009**: The client MUST support full round-trip client-side image format conversion (PNG,
  JPG, GIF, BMP, WEBP, SVG, ICO ↔ each other, plus a Base64/Data-URL target) via the Canvas API.
- **FR-010**: Unsupported source→target pairs (not present in `CONV_MAP`) MUST NOT be offered in
  the target dropdown; if attempted anyway via the server path, the backend MUST reject with HTTP
  400 naming the unsupported pair.
- **FR-011**: JSON, CSV, TSV, YAML, XML, and TOON MUST form a fully-connected client-side
  conversion cluster — every one of these six formats MUST be able to convert to every other one
  in the cluster, all client-side (`Toon.encode`/`Toon.decode` from the shared `static/toon.js`
  module for TOON; `jsonToXml`/`xmlToJson` for the XML pairs, per FR-013).
- **FR-012**: TOON support MUST NOT introduce a second implementation of the codec — this tool and
  `specs/016-data-linter` MUST both load the same `static/toon.js` module rather than each
  carrying an inline copy.
- **FR-013**: Converting an object/array value to XML MUST wrap named array fields in their key's
  element with repeated `<item>` children (`{"roles":["a","b"]}` →
  `<roles><item>a</item><item>b</item></roles>`) so the field name and the array survive the round
  trip; decoding XML back to another format MUST recognize that convention (an element with no
  attributes whose children are all `<item>` decodes to an array, with scalar items typed via the
  same null/true/false/number inference TOON's decoder uses) while leaving the pre-existing
  `@attributes`/`#text` handling for all other XML content unchanged.

### Key Entities

- **Conversion Matrix Entry**: `{from: ext, to: ext, server: bool}` — the fixed client-side
  routing table (`CONV_MAP` + `imageTargets()`) determining which handler runs a given pair and
  whether it requires a network call.
- **Conversion Result**: either `{output: string}` (text, rendered inline + downloadable) or a
  binary `Blob` (server responses, or Canvas-produced image blobs).
- **TOON**: a plain-JS-value serialization format (comma-delimited, 2-space indent, tabular arrays
  for uniform arrays of flat objects) — the sixth node in the client-side structured-data cluster,
  encoded/decoded via the shared `static/toon.js` module (FR-012), not a locally-implemented copy.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every client-side conversion pair completes with zero network requests, verified by
  browser devtools network-tab inspection during manual testing.
- **SC-002**: An oversized upload (>20 MB) is rejected within the time it takes to read the
  `Content-Length` header — no meaningful processing time spent on a doomed request.
- **SC-003**: A PDF-rendering conversion never issues an outbound HTTP request for a resource
  referenced inside the converted document, verified by `_safe_url_fetcher`'s scheme allowlist.
- **SC-004**: All 11 documented formats (JSON, CSV, YAML, XML, TOON, TSV, XLSX, Markdown, HTML,
  DOCX, PDF) plus the undocumented image formats (PNG/JPG/GIF/BMP/WEBP/SVG/ICO) are reachable from
  the UI's format dropdowns with at least one valid target each.
- **SC-005**: JSON, CSV, TSV, YAML, XML, and TOON each reach all five of the others in one client-
  side conversion — up from XML being a one-way dead end (JSON→XML existed; nothing converted
  *from* XML except back to JSON) and TOON not existing at all, before this extension.

## Assumptions

- **Major spec/code discrepancy — image conversion is already shipped, not backlog**:
  `specs/SPEC.md` §13 "Backlog (unscheduled)" lists *"File Converter: image format conversion
  (PNG ↔ JPG ↔ WebP)"* as **unscheduled future work**. The actual code
  (`static/file-converter.html`: `imageTargets()`, `convertImage()`, `drawImageToCanvas()`,
  `handleCanvasBlob()`, plus `png`/`jpg`/`jpeg`/`gif`/`bmp`/`webp`/`svg`/`ico` entries in
  `CONV_MAP`) already implements this — and more broadly than the backlog item describes (7
  formats + Base64, not just PNG/JPG/WebP). **Recommend removing this line from SPEC.md §13 and
  adding image conversion as a documented capability in §4.12**, since it is not aspirational.
- **SPEC.md §4.12's client-side list is incomplete**: SPEC.md currently documents client-side
  support as "JSON ↔ YAML · JSON ↔ CSV · JSON → XML · YAML → JSON · Markdown → HTML" only. The
  code additionally supports client-side, with no server round-trip: JSON→TSV, CSV→JSON/TSV/YAML,
  TSV→CSV/JSON/YAML, YAML→CSV, XML→JSON, HTML→Markdown, HTML→plain-text, and the full image
  matrix (FR-009). This spec's Requirements section documents the fuller, verified set; SPEC.md
  §4.12 should be updated to match rather than treated as authoritative going forward.
- **No content-sniffing is a deliberate simplicity trade-off**, not an oversight: format
  detection by extension alone keeps the tool a thin client-side matrix lookup rather than a
  file-format-detection engine; a mislabeled extension is treated as user error.
- **`txt`→`md` passthrough is intentional** (Markdown is a syntactic superset of plain text — no
  transformation is needed for that direction to be meaningful).
- **SPEC.md §8's auth-model table omits File Converter entirely** (it lists Diff, JSON, YAML,
  Regex, Base64, Crypto, Cron as the no-auth group, but not File Converter, even though
  `routes/convert.py` has no `require_unlocked` call and behaves identically to that group).
  Treated here as a documentation omission to fix in SPEC.md §8 (add File Converter to the
  no-auth row), not a behavioral question — the code's no-auth behavior is unambiguous.
- **The XML array-field-name-loss bug fix (FR-013) is a behavior change for any existing
  JSON/CSV/TSV/YAML→XML conversion involving a named array field** — before this fix, such a
  field silently vanished from the XML output (its items became bare `<item>` siblings with no
  wrapper); after, it's correctly wrapped. Nothing that previously worked correctly changes
  output; only output that was silently wrong is now silently correct. No automated test
  previously locked in the buggy behavior, so this is treated as a bug fix, not a breaking
  behavior change requiring a deprecation path — consistent with how `016-data-linter` treated
  the identical bug found in its own (separately-implemented, now also-fixed) XML bridge.
- **This spec remains a retroactive/verified-against-code document** (see header) for everything
  except User Story 5 and FR-011/012/013, which were specified before implementation in the
  normal spec-first order, since they're genuinely new capability rather than documentation of
  already-shipped behavior.
