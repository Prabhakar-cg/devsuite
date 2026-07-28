# Phase 1 Data Model: File Format Converter

Stateless request/response tool — no persisted entities. The "model" here is the conversion
routing table and the request/response shapes.

## Conversion Matrix (`CONV_MAP`, client-side source of truth)

| From | To (client-side) | To (server-side) |
|---|---|---|
| `json` | csv, tsv, yaml, xml | xlsx |
| `csv` | json, tsv, yaml | xlsx |
| `tsv` | csv, json, yaml | — |
| `yaml` | json, csv | — |
| `xml` | json | — |
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
must be kept in sync manually (no shared schema/codegen).

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
