# Contract: HTTP API — File Format Converter

Single endpoint. No auth required (this tool has no DevDB-backed state and no sensitive data
path — SPEC §8 lists it among the no-auth tools implicitly by omission... actually §8 does not
list File Converter at all; see spec.md/plan.md discrepancy notes — treated here as consistent
with the no-auth group since `routes/convert.py` has no `require_unlocked` call).

## `POST /api/convert`

Multipart form:

| Field | Type | Notes |
|---|---|---|
| `file` | file | source file, ≤ 20 MB (`MAX_UPLOAD_SIZE`) |
| `target_format` | string (form field) | lower-cased server-side; must pair with the source
  extension per the server dispatcher (see data-model.md's matrix) |

### Responses

```
200 → <raw converted file bytes>
      Content-Type: <format-appropriate media type>
      Content-Disposition: attachment; filename="converted.<ext>"

400 → {detail: "Invalid Content-Length header"}
      {detail: "Spreadsheet is empty"}
      {detail: "JSON must be an array of objects for XLSX conversion"}
      {detail: "Unsupported server-side conversion: <src> → <target>"}

413 → {detail: "Upload too large (limit 20 MB)"}

503 → {detail: "<library> is not installed. Run: pip install <library>"}
```

### Supported server-side pairs (as dispatched in `convert_file()`)

| Source ext | Target format | Handler |
|---|---|---|
| `xlsx` | `csv`, `json` | `_conv_xlsx_to_csv_json` |
| `csv` | `xlsx` | `_conv_csv_to_xlsx` |
| `json` | `xlsx` | `_conv_json_to_xlsx` |
| `pdf` | `txt` | `_conv_pdf_to_txt` |
| `docx` | `txt` | `_conv_docx_to_txt` |
| `docx`, `doc`, `html`, `htm`, `md`, `markdown` | `pdf` | `_conv_any_to_pdf` |

Any pair not in this table returns HTTP 400, even if the client-side `CONV_MAP` would (in error)
offer it — the two tables are independently maintained (see data-model.md).

## Compatibility rules

- Adding a new server-side conversion pair requires updating **both** this dispatcher and the
  client `CONV_MAP` in `static/file-converter.html` — there is no shared schema between them.
- The 20 MB cap (`MAX_UPLOAD_SIZE` in `deps.py`) is shared with no other endpoint at that exact
  value — the `/upload` text-diff endpoint (SPEC §5.7) uses a separate 50 MB constant.
