# Tasks: File Format Converter

**Input**: Design documents from `/specs/013-file-converter/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: No dedicated test file exists for `routes/convert.py` or the client-side conversion
functions — see quickstart.md. Tasks below reconstruct the shipped implementation.

## Format: `[ID] [Story] Description`

## Path Conventions

Single project: `routes/`, `static/` at repo root.

---

## Phase 1: Setup

- [X] T001 Register `/file-converter` route in `routes/pages.py`; create
      `static/file-converter.html` (markup + all logic inline, per as-built structure)
- [X] T002 [P] Vendor `js-yaml.min.js`, `papaparse.min.js`, `marked.min.js` under `static/libs/`

---

## Phase 2: Foundational

- [X] T003 Define `CONV_MAP` (client-side conversion routing table, `from → [{label, value,
      server}]`) and the `MIME` lookup table
- [X] T004 [P] Implement drop-zone + file-picker wiring (`setFile`, `clearFile`,
      `updateToOptions`, `checkReady`)
- [X] T005 [P] Implement `MAX_UPLOAD_SIZE` (20 MB) in `deps.py`, shared with `/api/convert`

**Checkpoint**: file selection + format-pair discovery working

---

## Phase 3: User Story 1 - Client-side structured-data conversion (P1) 🎯 MVP

- [X] T006 [US1] Implement `convertJsonText()` (→ CSV/TSV/YAML/XML)
- [X] T007 [P] [US1] Implement `convertCsvText()`/`convertTsvText()` (Papa.parse-based, → the
      other delimited format/JSON/YAML)
- [X] T008 [P] [US1] Implement `convertYamlText()` (jsyaml-based, → JSON/CSV)
- [X] T009 [P] [US1] Implement `convertXmlText()` + `xmlToJson()` (DOMParser-based, → JSON)
- [X] T010 [US1] Implement `convertInBrowser()` dispatcher + `showTextResult()` rendering
      (escaped `innerHTML` for previews, sandboxed iframe for HTML output)
- [X] T011 [US1] Implement `jsonToCsv()`/`jsonToXml()` hand-rolled serializers

**Checkpoint**: all structured-data client-side conversions working, zero network calls

---

## Phase 4: User Story 2 - Server-side document conversion (P1)

- [X] T012 [US2] Implement `POST /api/convert` route skeleton in `routes/convert.py`:
      content-length pre-check, read-cap enforcement, extension-based dispatch
- [X] T013 [P] [US2] Implement `_conv_xlsx_to_csv_json()` / `_conv_csv_to_xlsx()` /
      `_conv_json_to_xlsx()` (openpyxl, 503-guarded)
- [X] T014 [P] [US2] Implement `_conv_pdf_to_txt()` (pypdf, 503-guarded)
- [X] T015 [P] [US2] Implement `_conv_docx_to_txt()` (python-docx, 503-guarded)
- [X] T016 [US2] Implement `_source_to_html()` (mammoth for DOCX, `markdown` lib for MD, raw
      passthrough for HTML) and `_conv_any_to_pdf()` (weasyprint + `_safe_url_fetcher` SSRF
      block)
- [X] T017 [US2] Implement `convertViaServer()` client-side multipart upload + response handling

**Checkpoint**: XLSX/PDF/DOCX conversions working via the server

---

## Phase 5: User Story 3 - Upload limits (P2)

- [X] T018 [US3] Implement `_check_content_length_header()` (400 on invalid, 413 on oversized)
- [X] T019 [US3] Implement the hard `file.read(MAX_UPLOAD_SIZE + 1)` read-cap fallback

**Checkpoint**: oversized/malformed uploads rejected cheaply

---

## Phase 6: User Story 4 - Client-side image conversion (P2)

- [X] T020 [US4] Implement `imageTargets()` (target-list generation excluding same-format and
      identity GIF→GIF)
- [X] T021 [US4] Implement `convertImage()` / `drawImageToCanvas()` / `handleCanvasBlob()`
      (Canvas-based re-encode, incl. Base64/Data-URL target)
- [X] T022 [US4] Wire `png`/`jpg`/`jpeg`/`gif`/`bmp`/`webp`/`svg`/`ico` into `CONV_MAP` via
      `imageTargets()`

**Checkpoint**: full image-format matrix working client-side

---

## Phase 7: Polish & Cross-Cutting

- [X] T023 [P] Implement `htmlToMarkdown()` + `_walkInlineTag`/`_walkBlockTag`/`walkHtmlNode`/
      `htmlTableToMarkdown` (HTML→Markdown, undocumented in SPEC.md §4.12 prior to this spec)
- [X] T024 [P] Implement `escHtml()` and apply it before every `innerHTML` interpolation of
      converted (untrusted) text
- [X] T025 Retroactive documentation: this spec-kit folder authored 2026-07-28 from
      `specs/SPEC.md` §4.12/§5.7 plus direct source inspection of `routes/convert.py` and
      `static/file-converter.html`; **surfaced that SPEC.md §13 lists image conversion as
      unscheduled backlog when it is already fully implemented** — corrected in the coordinating
      SPEC.md trim commit for this spec-kit restructure
- [ ] T026 **Recommended follow-up (not part of this retroactive spec)**: add a test asserting
      `_safe_url_fetcher` blocks non-`data:`/non-empty URL schemes during PDF rendering (Art. VI
      gap noted in plan.md)

---

## Dependencies & Execution Order

- Setup → Foundational → US1 (MVP) → US2 → US3 → US4 → Polish. US1–US4 are largely
  file-disjoint (client-side text handlers vs. server Python handlers vs. Canvas image code) and
  could have been built in parallel.

## Implementation Strategy

Retroactive record, not a forward plan. Future changes should branch a new numbered spec.
