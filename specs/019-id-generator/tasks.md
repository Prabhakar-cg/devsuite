---
description: "Task list for ID Generator (feature 019)"
---

# Tasks: ID Generator

**Input**: Design documents from `/specs/019-id-generator/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md (no contracts/ — client-only tool)

**Tests**: JS unit tests ARE included — the plan commits to extending the DX-10 pure-module test
suite for the generator core. Python tests cover route/asset wiring only.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (generate), US2 (copy), US3 (entropy/decode)

## Path Conventions

Web app (FastAPI + vanilla static). Frontend under `static/`, backend route in `routes/pages.py`,
tests under `tests/`.

---

## Phase 1: Setup

- [ ] T001 Create `static/id-gen.js` skeleton — pure, DOM-free module with the dual-export footer
  (`module.exports` + global) matching `static/curl-codegen.js`; export empty `ID_TYPES`,
  `generate(typeId, count, opts)`, `decodeTimestamp(typeId, value)` stubs.
- [ ] T002 [P] Create `static/id-generator.css` with tool-scoped styles built only on existing
  design tokens (no new colors); no emoji (SPEC §9.8/§9.9).

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: The `ID_TYPES` facts table + secure-random helpers block every user story.

- [ ] T003 In `static/id-gen.js`, implement the `ID_TYPES` facts table per `data-model.md`
  (uuid4/uuid7/ulid/cuid2/nanoid: label, totalBits, randomBits, timeBits, timeSortable,
  decodesTime, blurb).
- [ ] T004 In `static/id-gen.js`, implement `randomBytes(n)` on `crypto.getRandomValues` with an
  injectable crypto handle (for Node tests), throwing a clear error when unavailable (FR-005).

**Checkpoint**: facts table + CSPRNG helper ready.

---

## Phase 3: User Story 1 — Generate a batch (Priority: P1) 🎯 MVP

**Goal**: Produce exactly N valid identifiers of the selected type.

**Independent Test**: Select UUID v4, count 10, Generate → 10 distinct valid v4 strings.

### Implementation

- [ ] T005 [P] [US1] Implement `genUuid4()` (RFC 9562 §5.4) in `static/id-gen.js`.
- [ ] T006 [P] [US1] Implement `genUuid7()` (48-bit ms ts + version/variant + random) in `static/id-gen.js`.
- [ ] T007 [P] [US1] Implement `genUlid()` (Crockford base32, 48-bit ts + 80 random) in `static/id-gen.js`.
- [ ] T008 [P] [US1] Implement `genNanoid()` (21 chars, URL-safe alphabet, unbiased masking) in `static/id-gen.js`.
- [ ] T009 [US1] Implement `genCuid2()` using `CryptoJS.SHA3({outputLength:512})` + multi-source
  entropy (time, session fingerprint, counter, random bytes) in `static/id-gen.js`; `CryptoJS`
  handle injectable for tests.
- [ ] T010 [US1] Implement `generate(typeId, count)` dispatch returning `{typeId, values}`;
  guarantees batch distinctness for random types (FR-006) and rejects bad `typeId`.
- [ ] T011 [US1] Build `static/id-generator.html` — shared header/nav/theme (model on `base64.html`),
  type selector, count input (default 10), Generate button, results list container, entropy panel
  container; load order: `crypto-js.min.js` (UMD) then `id-gen.js` then `id-generator.js`, all
  `defer`; no inline `<script>` (Art. V).
- [ ] T012 [US1] Build `static/id-generator.js` DOM controller: validate count (1–1000, FR-011/12),
  call `generate()`, render each value via `createElement`+`textContent` (FR-017), replace prior
  batch (US1 scenario 3), show inline error leaving prior batch intact on invalid input.

**Checkpoint**: US1 fully usable — generate valid batches of every type.

---

## Phase 4: User Story 2 — Copy (Priority: P2)

**Goal**: One-click copy of a single id and of the whole batch.

**Independent Test**: With a batch on screen, per-row copy → that id on clipboard; Copy all →
all ids newline-joined.

### Implementation

- [ ] T013 [US2] Add a per-row copy control in `static/id-generator.js` using
  `navigator.clipboard.writeText`; visible confirmation on success, distinct failure message on
  rejection/absence (FR-007, FR-009).
- [ ] T014 [US2] Add a "Copy all" control that joins the batch with newlines in display order
  (FR-008), reusing the same success/failure feedback.

**Checkpoint**: US1 + US2 both work.

---

## Phase 5: User Story 3 — Entropy inspection & timestamp decode (Priority: P3)

**Goal**: Per-type entropy facts always visible; decode embedded timestamps for uuid7/ulid.

**Independent Test**: Select each type → correct random-bit facts; generate a ULID/UUID v7 and
inspect → decoded creation date.

### Implementation

- [ ] T015 [P] [US3] Implement `decodeTimestamp(typeId, value)` in `static/id-gen.js` for uuid7
  (first 48 bits) and ulid (base32 first 10 chars) → `{ms, iso}`; `undefined` otherwise (FR-013).
- [ ] T016 [US3] Render the entropy panel from `ID_TYPES[selected]` in `static/id-generator.js`,
  updating immediately on type change even before Generate (FR-010, edge case). Show total/random
  bits, timestamp component + meaning, and the sortability note.
- [ ] T017 [US3] For time-based types, add a per-row "decoded time" affordance that calls
  `decodeTimestamp` and shows the human-readable date (US3 scenario 3).

**Checkpoint**: all three stories independently functional.

---

## Phase 6: Tests

- [ ] T018 [P] Write `tests/javascript/test-id-gen.js`: format-conformance regex/structural checks
  for all five types (SC-002), 1000-id distinctness for random types (SC-003), `ID_TYPES` random-bit
  facts (SC-005), and uuid7/ulid `decodeTimestamp` round-trip within the same ms (SC-006). Inject
  Node `webcrypto` and `require('crypto-js')`/vendored bundle for the module's crypto handles.
- [ ] T019 Register `test-id-gen.js` in `tests/javascript/run.js` and confirm `node tests/javascript/run.js` passes.
- [ ] T020 [P] Extend `tests/python/` (e.g. a route test) to assert `GET /id-generator` returns 200
  HTML and that `test_asset_order.py` still passes with `crypto-js.min.js` before any RequireJS use
  (no RequireJS on this page, but keep the asset-order suite green).

---

## Phase 7: Integration & Release (Cross-Cutting)

- [ ] T021 Register the route in `routes/pages.py`: `@router.get("/id-generator")` → `_serve_html("id-generator.html")`.
- [ ] T022 Add the ID Generator tool card to `static/tools.html` (category `dev`, stroke-SVG icon)
  and bump the static filter counts (`All 13→14`, `Dev 5→6`) to match what `updateFilterCounts()`
  recomputes; add to the popular rail if appropriate.
- [ ] T023 Add/refresh the tool reference and any tool count on `static/home.html`.
- [ ] T024 Bump version together (Art. VII): `APP_VERSION` in `deps.py`, README badge, new
  `CHANGELOG.md` heading, and `specs/SPEC.md` §1.3; add the tool row + tool-count to `specs/SPEC.md`.
- [ ] T025 Run `pytest tests/python/` and `node tests/javascript/run.js`; run `quickstart.md`
  verification against a live server. Fix anything red before claiming done.

---

## Dependencies & Execution Order

- **Setup (P1)** → **Foundational (P2, blocks all stories)** → **US1 (P3)** → US2 (P4) → US3 (P5).
- US1 generator functions T005–T008 are `[P]` (independent additions to the same module — serialize
  the actual edits, but they have no logical dependency); T009 (cuid2) and T010 (dispatch) depend on
  the facts table (T003) and CSPRNG helper (T004).
- **Tests (P6)** depend on the module being implemented (through P5).
- **Integration & Release (P7)** last — after the tool works and tests pass.

## Implementation Strategy

MVP = Phases 1–3 (a working generator for all five types). US2 and US3 layer copy and entropy on top
without breaking US1. Release (P7) is deliberately last so the version bump and tool-count sync land
in the same change as the finished, tested tool (Spec-First, Art. I & VII).
