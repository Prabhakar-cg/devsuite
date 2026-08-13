# Contract: HTTP API — Diff Checker

## `GET /diff`

Serves `static/index.html` via `_serve_html()` (cache-busted CSS/JS URLs, favicon
injection — see SPEC.md §3.3). No query parameters affect server behavior; `?tab=folder-
diff` is a client-side-only read by `static/app.js` to select the initial tab.

No auth required (SPEC.md §8).

## `POST /upload`

Text file upload for either diff panel. Defined in `routes/pages.py`.

**Request**: `multipart/form-data`, single field `file` (`UploadFile`).

**Response 200** (`application/json`):

```json
{
  "filename": "example.txt",
  "content": "...decoded UTF-8 text (errors=\"replace\")...",
  "size_bytes": 1234
}
```

**Response 400** — binary content rejected, one of:
- `Content-Type` starts with `image/`, `video/`, `audio/`, `application/pdf`,
  `application/zip`, or `application/octet-stream`:
  `{"detail": "Only text-based files are supported. Received: <content-type>"}`
- A null byte was found in the first 512 bytes of the first 1 MB chunk:
  `{"detail": "\"<filename>\" appears to be a binary file and cannot be diffed."}`

**Response 413** — file exceeds 50 MB, raised mid-stream by `_read_upload_stream`:
`{"detail": "File too large. Exceeds 50MB limit."}`

**Response 500** — unexpected server error while reading/decoding:
`{"detail": "Server error processing file"}`

**Compatibility rule**: this is a same-origin, unauthenticated, single-purpose endpoint. Any
change to its response shape or limits must update this contract and SPEC.md §5.7 in the
same commit (constitution Art. I).
