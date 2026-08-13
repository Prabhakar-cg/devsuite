# Phase 1 Data Model: File Format Converter

Stateless request/response tool — no persisted entities. The "model" here is the conversion
routing table and the request/response shapes.

## Conversion Matrix (`CONV_MAP`, client-side source of truth)

| From | To (client-side) | To (server-side) |
|---|---|---|
| `json` | csv, tsv, yaml, xml, toon | xlsx |
| `csv` | json, tsv, yaml, xml, toon | xlsx |
| `tsv` | csv, json, yaml, xml, toon | — |
| `yaml` | json, csv, tsv, xml, toon | — |
| `xml` | json, csv, tsv, yaml, toon | — |
| `toon` | json, csv, tsv, yaml, xml | — |
| `xlsx` | — | csv, json |
| `md`/`markdown` | html | pdf |
| `html` | md, txt | pdf |
| `pdf` | — | txt |
| `docx` | — | pdf, txt |
| `doc` | — | pdf |
| `txt` | md (passthrough) | — |
| `png`/`jpg`/`jpeg`/`gif`/`bmp`/`webp`/`svg`/`ico` | any other image format + base64 (via `imageTargets()`) | — |

Server-side pairs additionally require a matching branch in `routes/convert.py`'s
`convert_file()` dispatcher (`src_ext`/`target_format` if-chain) — the client `CONV_MAP` and the
server dispatcher are two independently maintained sources of truth for the same routing; they
must be kept in sync manually (no shared schema/codegen). `json`/`csv`/`tsv`/`yaml`/`xml`/`toon`
are now a fully-connected client-side cluster (FR-011) — every one of the six reaches the other
five in one conversion, all via the plain-JS-value shape each format's own parser/serializer
already produces or consumes (`JSON.parse`/`stringify`, `jsyaml.load`/`dump`, `Papa.parse` +
`jsonToCsv`, `jsonToXml`/`xmlToJson`, `Toon.encode`/`decode`).

### TOON codec (`static/toon.js`, shared with `specs/016-data-linter`)

Loaded as a `<script>` tag (browser global `Toon`), exposing `Toon.encode(value)`,
`Toon.decode(text)`, and two helpers reused by the XML bridge below and by
`016-data-linter`'s auto-detect: `Toon.looksLikeToonHeader(text)`, `Toon.inferScalarFromText(text)`.
Not vendored — a first-party implementation of a subset of the published spec; see
`specs/016-data-linter/spec.md` FR-011 for the exact scope (comma delimiter, 2-space indent, no
nested tabular field-groups).

### XML bridge (`jsonToXml`/`xmlToJson`, local to this file — not shared with `016-data-linter`'s
separately-implemented, independently-fixed copy)

`jsonToXml(value, tag)` wraps array values in their own `tag` element with repeated `<item>`
children so the field name survives serialization (FR-013) — fixed from a prior version that
dropped the tag for array values entirely. `xmlToJson(node)` decodes that convention back into a
real array on the way in (scalar items typed via `Toon.inferScalarFromText`), while every other
XML shape keeps the pre-existing `@attributes`/`{"#text": ...}` conventions for arbitrary/foreign
XML content unchanged.

## `Conversion Result` (client-side, `resultData`)

| Field | Type | Notes |
|---|---|---|
| `blob` | `Blob` | the output bytes |
| `text` | `string \| null` | populated for text outputs (enables Copy button); `null` for binary |
| `mimeType` | `string` | from `MIME` table or the server response's `Content-Type` |
| `ext` | `string` | target extension, used for the download filename |
| `objUrl` | `string` | (binary path only) `URL.createObjectURL(blob)`, revoked after use |

## `POST /api/convert` request (multipart form)

| Field | Type | Notes |
|---|---|---|
| `file` | file | the source file |
| `target_format` | string | lower-cased, stripped; matched against `src_ext` in the dispatcher |

## `POST /api/convert` response

A raw file `Response` with `Content-Disposition: attachment; filename="converted.<ext>"` and a
format-appropriate `media_type` — no JSON envelope (unlike most other DevSuite APIs), since the
payload IS the converted file.
