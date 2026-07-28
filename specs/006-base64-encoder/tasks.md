# Tasks: Base64 Encoder / Decoder

**Input**: Design documents from `/specs/006-base64-encoder/`

**Tests**: NOT INCLUDED — this tool has no security-critical paths (SPEC §10.2) and no automated
coverage exists today; retroactive tasks reflect what actually shipped.

**Organization**: grouped by user story, mirroring spec.md. All tasks are marked `[X]` — this is
a retroactive record of already-completed work, not a forward plan.

## Format: `[ID] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Create `static/base64.html` with header/toolbar/two-pane layout on `static/linter.css`; wire `/static/theme.js` for theme support
- [X] T002 Register `GET /base64` route in `routes/pages.py` returning `_serve_html("base64.html")`

---

## Phase 2: Foundational

- [X] T003 Implement UTF-8-safe `encodeB64`/`decodeB64` helpers using `TextEncoder`/`TextDecoder` bridged through `btoa`/`atob` (`static/base64.html:281-299`)
- [X] T004 Wire status pill + inline error panel (`setStatus`, `showError`, `clearError`) for consistent feedback across all actions

**Checkpoint**: core encode/decode primitives ready

---

## Phase 3: User Story 1 - Encode / decode text as Base64 (Priority: P1) 🎯 MVP

- [X] T005 [US1] Wire `#btn-encode` / `#btn-decode` click handlers calling the Phase 2 helpers and rendering to the output panel (`static/base64.html:303-328`)
- [X] T006 [US1] Character-count badge updates live on input (`#char-count`)

**Checkpoint**: core encode/decode loop fully usable

---

## Phase 4: User Story 2 - URL-safe Base64 mode (Priority: P2)

- [X] T007 [US2] `#mode-std` / `#mode-url` toggle buttons flipping the `urlSafe` flag and re-labeling output status (`static/base64.html:355-370`)
- [X] T008 [US2] URL-safe substitution on encode (`+`→`-`, `/`→`_`, strip `=`) and defensive reversal on decode, including auto-detection of `-`/`_` even when standard mode is selected

**Checkpoint**: URL-safe workflows usable independently of standard mode

---

## Phase 5: User Story 3 - Inspect a JWT (Priority: P2)

- [X] T009 [US3] `#btn-decode-jwt` handler: split on `.`, Base64URL-decode header/payload, `JSON.stringify(…, null, 2)` into the three JWT panels (`static/base64.html:330-351`)
- [X] T010 [US3] JWT panel show/hide (`.jwt-section.visible`) and close button
- [X] T011 [US3] Toast-based error handling for malformed JWTs (not 3 parts, or non-JSON segments)

**Checkpoint**: JWT inspection usable independently

---

## Phase 6: User Story 4 - File and clipboard input (Priority: P3)

- [X] T012 [US4] Hidden `#file-input` + label wiring to load a file's text content into the input panel (`static/base64.html:395-411`)
- [X] T013 [US4] `#btn-paste` clipboard read, `#btn-swap` input/output exchange, `#btn-clear` full reset (also hides the JWT panel)
- [X] T014 [US4] Copy-to-clipboard button on the output panel with toast confirmation

**Checkpoint**: convenience actions complete

---

## Phase 7: Retroactive Documentation

- [X] T015 Author this spec-kit folder (`spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `quickstart.md`, `research.md`, `contracts/http-api.md`, `checklists/requirements.md`) on 2026-07-28 from `SPEC.md §4.5` and direct inspection of `static/base64.html` and `routes/pages.py`; flag the "verify server-side" JWT copy discrepancy (FR-003) rather than silently resolving it.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → user stories (US1 is the MVP; US2/US3/US4 each build on the Phase 2 helpers independently and could have shipped in any order).
- Phase 7 is documentation-only and depends on nothing else being correct first, but is sequenced last as it describes the finished state.
