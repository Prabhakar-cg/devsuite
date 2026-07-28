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

## Automated coverage that exists today

None specific to this tool. `pytest tests/python/` covers unrelated security-critical paths
(SPEC §10.2); no test file references `routes/convert.py` or exercises `/api/convert`.

## Coverage gaps (honest accounting)

- **No automated tests for `routes/convert.py`** at all — not the format dispatch logic, not the
  upload-size enforcement, not (most importantly) the `_safe_url_fetcher` SSRF block. Given the
  SSRF-block's security relevance (research.md R2), this is the highest-priority gap of the three
  tools in this batch (011/012/013) to close with a real test.
- **No JS test coverage** for any client-side conversion function (`convertJsonText`,
  `xmlToJson`, `htmlToMarkdown`, `convertImage`, etc.) — all are pure functions with no DOM
  dependency (aside from `convertImage`'s Canvas use) and would be straightforward to add to
  `tests/javascript/` alongside `curl-codegen.js`/`cookie-jar.js`/`collection-utils.js`.

## Acceptance gates

- Every FR in spec.md is exercised by at least one manual scenario above.
- SC-003 (SSRF block) currently has **no automated gate** — recommend adding
  `tests/python/test_convert_ssrf.py` asserting `_safe_url_fetcher` raises for `http://`/`https://`/
  `file://` URLs and passes through for `data:`/empty, before treating SC-003 as continuously
  verified rather than a one-time manual check.
