# Quickstart & Validation: File Format Converter

## Setup

```bash
python main.py          # serves on http://127.0.0.1:8000
```

Open `http://127.0.0.1:8000/file-converter`.

## Manual validation (maps to spec user stories)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| US1 | JSON→CSV | Drop a `.json` array-of-objects file, select CSV, Convert | Inline CSV preview, no network request (check devtools Network tab) |
| US1 | CSV→YAML | Drop a `.csv`, select YAML | `jsyaml.dump()` output, client-side |
| US1 | Malformed input | Drop invalid JSON, attempt conversion | Toast "Conversion failed: ..." with the parse error |
| US2 | XLSX→CSV | Drop a `.xlsx`, select CSV | `POST /api/convert` fires; CSV downloads |
| US2 | PDF→TXT | Drop a `.pdf`, select TXT | Extracted text returned |
| US2 | Markdown→PDF | Drop a `.md`, select PDF | Rendered PDF downloads |
| US2 | Missing library | Uninstall `weasyprint`, retry MD→PDF | HTTP 503 with "weasyprint is not installed. Run: pip install weasyprint" |
| US3 | Oversized upload | Attempt to convert a file >20 MB | HTTP 413 |
| US3 | Bad Content-Length | `curl -X POST /api/convert -H "Content-Length: -1" ...` | HTTP 400 "Invalid Content-Length header" |
| US4 | PNG→WEBP | Drop a `.png`, select WEBP | Canvas re-encode, no network request |
| US4 | PNG→Base64 | Drop a `.png`, select "Base64 (Data URL)" | Data-URL text output with Copy button |
| US5 | JSON→TOON | Drop a `.json` array of objects, select TOON | Tabular `items[N]{fields}:` form for uniform arrays, no network request |
| US5 | TOON→JSON round trip | Take the TOON output above, save as `.toon`, drop it back in, select JSON | Reproduces the original array |
| US5 | Malformed TOON | Drop `.toon` text with a tabular header declaring more rows than present, attempt conversion | Toast "Conversion failed: Declared N tabular row(s) but only found M" |
| — | XML matrix completion | Drop a `.yaml` file, select XML; then drop that XML output back in, select YAML | Reproduces the original YAML structure (previously YAML→XML didn't exist at all) |
| — | Named-array field survives XML | Convert `{"roles":["admin","ops"]}` (as `.json`) to XML, then that XML back to JSON | `roles` field name and array both survive (previously the field silently vanished — the bug fixed by FR-013) |

## Automated coverage that exists today

`tests/javascript/test_toon.js` (run via `node tests/javascript/run.js`) covers the shared
`static/toon.js` codec this tool's TOON conversions depend on — round-trip encode/decode,
malformed-input rejection, and the spec's own canonical examples. Otherwise: none specific to
this tool. `pytest tests/python/` covers unrelated security-critical paths (SPEC §10.2); no test
file references `routes/convert.py` or exercises `/api/convert`.

## Coverage gaps (honest accounting)

- **No automated tests for `routes/convert.py`** at all — not the format dispatch logic, not the
  upload-size enforcement, not (most importantly) the `_safe_url_fetcher` SSRF block. Given the
  SSRF-block's security relevance (research.md R2), this is the highest-priority gap of the three
  tools in this batch (011/012/013) to close with a real test.
- **No JS test coverage** for any client-side conversion function *local to this file*
  (`convertJsonText`, `xmlToJson`, `htmlToMarkdown`, `convertImage`, etc.) — all are pure
  functions with no DOM dependency (aside from `convertImage`'s Canvas use and `xmlToJson`'s
  `DOMParser` use) and would be straightforward to add to `tests/javascript/` alongside
  `curl-codegen.js`/`cookie-jar.js`/`collection-utils.js`. The one exception is the TOON codec
  (`Toon.encode`/`Toon.decode`, shared with `016-data-linter`), which now has real coverage via
  `tests/javascript/test_toon.js` since it lives in its own requireable module — this gap is
  about the functions still inline in `file-converter.html` itself, not TOON.

## Acceptance gates

- Every FR in spec.md is exercised by at least one manual scenario above.
- SC-003 (SSRF block) currently has **no automated gate** — recommend adding
  `tests/python/test_convert_ssrf.py` asserting `_safe_url_fetcher` raises for `http://`/`https://`/
  `file://` URLs and passes through for `data:`/empty, before treating SC-003 as continuously
  verified rather than a one-time manual check.
