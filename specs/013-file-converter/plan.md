# Implementation Plan: File Format Converter

**Branch**: `013-file-converter` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-file-converter/spec.md`

**Note**: Retroactive plan for an already-shipped tool.

## Summary

A format-conversion tool at `/file-converter` split across two execution environments by
necessity, not preference: structured text formats (JSON/CSV/TSV/YAML/XML/Markdown/HTML/images)
convert entirely client-side using self-hosted JS libraries (`js-yaml`, `papaparse`, `marked`) or
native browser APIs (`DOMParser`, `Canvas`); binary/rich-document formats (XLSX, PDF, DOCX) route
through `POST /api/convert`, which delegates to server-side Python libraries
(`openpyxl`/`pypdf`/`python-docx`/`mammoth`/`weasyprint`) that have no practical browser
equivalent.

## Technical Context

**Language/Version**: Python 3.10+ (FastAPI, server-side conversions) / vanilla ES2020+
JavaScript (client-side conversions, inline in `file-converter.html`, no build step)

**Primary Dependencies**: Server: `openpyxl`, `pypdf`, `python-docx`, `mammoth`, `weasyprint`,
`markdown` (all optional-import-guarded, degrading to HTTP 503 if missing). Client: self-hosted
`js-yaml.min.js`, `papaparse.min.js`, `marked.min.js` (`static/libs/`) + native `DOMParser`/
`Canvas`/`FileReader` APIs.

**Storage**: N/A — stateless request/response; no DevDB store.

**Testing**: No dedicated automated test file exists for `routes/convert.py` or the client-side
conversion functions (see quickstart.md gap).

**Target Platform**: Any modern browser (Canvas/DOMParser support required for image and XML
conversions); server is `localhost`-only.

**Project Type**: Web tool within DevSuite's single-project layout.

**Performance Goals**: Bounded by the 20 MB upload cap; server-side conversions are synchronous
(no background job queue) — acceptable for a single-user local tool where conversions complete
in low seconds even for XLSX/PDF at that size ceiling.

**Constraints**: Server-side conversions MUST NOT fetch external network resources during PDF
rendering (SSRF surface via embedded `<img>`/link URLs) — enforced by `_safe_url_fetcher`'s
scheme allowlist (FR-008).

**Scale/Scope**: Single-file conversions only (no batch/zip-of-files mode); 10 SPEC-documented
formats + 7 image formats + Base64.

## Constitution Check

*GATE: evaluated retroactively — PASS on all core principles. This spec's primary contribution
is surfacing a significant SPEC.md documentation gap (image conversion already shipped but
listed as backlog), which is itself a violation of Art. I ("No undocumented behavior... every
route, endpoint... must be in specs/SPEC.md") that predates this retroactive spec and is called
out for correction. One test-coverage gap (Art. VI, the SSRF-block on PDF rendering) remains
open — see below.*

**Core principles (I–VII):**

| Principle | Compliance |
|---|---|
| I. Spec first / no undocumented behavior | **Gap found and flagged**: image conversion (a real, shipped capability spanning 7 formats + Base64) was undocumented in SPEC.md §4.12 and actively mis-documented as unscheduled backlog in §13. This retroactive spec corrects the record at the feature-folder level; **SPEC.md itself should be updated in the coordinating commit** that introduces this spec-kit restructure (see `specs/SPEC.md` §4.12 pointer + §13 backlog line). |
| II. Verify against source | Verified directly against `routes/convert.py` (full file) and the inline JS in `static/file-converter.html` (conversion matrix + all handler functions), not from SPEC.md prose alone — this is how the discrepancy was found. |
| III. No external DB | N/A — stateless tool, no persistence. |
| IV. Client-side encryption only | N/A — no secrets/encryption involved in this tool. |
| V. No `innerHTML` with untrusted data | **Verified PASS**: `showTextResult()` uses `resultBody.innerHTML` for the text-preview `<pre>` block, but the converted text is passed through `escHtml()` first (escapes `&<>"'`) — untrusted content never reaches the DOM unescaped. The HTML-target preview renders via a **sandboxed** `<iframe sandbox="">` (`srcdoc`, no `allow-scripts`), not `innerHTML`, so embedded `<script>` in converted HTML cannot execute. `showBinaryResult()`'s `innerHTML` branch is a static, non-interpolated string. |
| VI. Security paths ship with tests | The one clearly security-relevant path — `_safe_url_fetcher`'s SSRF-via-PDF-rendering block — has **no automated test**. Flagged as a gap (Art. VI is explicit about proxy/SSRF-adjacent paths needing tests; this is analogous to the CORS proxy's SSRF protections, which SPEC §10.2 does require tests for). |
| VII. Release path | N/A — no version-affecting change from writing this spec. |

**Spec & security baseline:**
- [x] `specs/SPEC.md` documents `/api/convert` (§5.7) and the format list (§4.12) — this spec
      adds the corrected, fuller behavioral detail; **flags that §4.12/§13 need a follow-up edit**
      to remove the stale "image conversion" backlog line (handled in the coordinating SPEC.md
      trim commit for this spec-kit restructure).
- [x] No new outbound network paths — server-side conversion reads only the uploaded file; the
      PDF-rendering path explicitly blocks outbound fetches (FR-008).
- [x] Vanilla HTML/CSS/JS + FastAPI; no new frameworks.
- [x] N/A — no vault/SSH blob handling in this tool.
- [x] No `innerHTML` with untrusted data — verified: `escHtml()` escapes converted text before
      any `innerHTML` interpolation; HTML previews use a sandboxed `<iframe srcdoc>` instead of
      `innerHTML` (see Art. V row above).
- [ ] Security-relevant paths ship with tests — **gap**: `_safe_url_fetcher`'s SSRF block has no
      test. Recommended follow-up, not fixed here.
- [x] Release path — N/A.
- [x] Static-analysis — `file-converter.html:1102` is a known SonarCloud complexity finding (SPEC
      §10.4, S3776) — pre-existing debt, not addressed by this spec.

**New-tool / UI cross-cutting checklist**: N/A — existing tool.

## Project Structure

### Documentation (this feature)

```text
specs/013-file-converter/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── http-api.md
├── tasks.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root, as-built)

```text
routes/
└── convert.py             # POST /api/convert — all server-side conversion handlers

static/
└── file-converter.html    # Markup + ALL client-side logic inline (CONV_MAP, per-format
                            # handlers, Canvas image conversion, drag-and-drop, download/copy)
                            # imports static/libs/{js-yaml,papaparse,marked}.min.js
```

**Structure Decision**: No structural change. Notably, this tool keeps its JS inline in the HTML
file rather than a separate `.js` file (unlike every other tool per SPEC §3.4's module map) —
documented as-is, not changed by this retroactive spec.

## Complexity Tracking

No constitutional violations requiring a Complexity Tracking justification — the two `[ ]`
unchecked baseline items above are flagged verification gaps for follow-up, not accepted
violations.
