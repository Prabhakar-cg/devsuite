# Tasks: DevDB Manager

**Input**: Design documents from `/specs/012-db-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Engine-level coverage exists (`test_devdb.py`); HTTP-layer coverage for `routes/db.py`
does not — see plan.md Constitution Check. Tasks below reconstruct the shipped implementation.

## Format: `[ID] [Story] Description`

## Path Conventions

Single project: `routes/`, `static/` at repo root.

---

## Phase 1: Setup

- [X] T001 Register `/db-manager` route in `routes/pages.py`; create
      `static/db-manager.html`/`.css`

---

## Phase 2: Foundational

- [X] T002 Implement `routes/db.py`: `GET /api/db/meta`, `GET/POST /api/db/store/{name}`
      (validated against `_ALLOWED_STORES`), gated by `require_unlocked`
- [X] T003 [P] Implement `STORE_META` display metadata (icon/label/locked/desc per store name) in
      `db-manager.js`
- [X] T004 [P] Implement inline stroke-SVG icon constants (`ICON_LOCK`, `ICON_BRACES`,
      `ICON_TERMINAL`, `ICON_SLIDERS`) — no emoji, per SPEC §9.8

**Checkpoint**: metadata plumbing ready

---

## Phase 3: User Story 1 - Inspect database health (P1) 🎯 MVP

- [X] T005 [US1] Implement `loadMeta()`/`renderFileBanner()`/`renderStores()`/
      `updateEncryptionBadge()`
- [X] T006 [US1] Implement `storeEntryCount()` lock-vs-count branching for encrypted stores
- [X] T007 [US1] Implement 30s auto-refresh (`setInterval(loadMeta, 30_000)`) + manual
      `doRefresh()`

**Checkpoint**: read-only inspection fully usable

---

## Phase 4: User Story 2 - Export and import the database (P1)

- [X] T008 [US2] Implement `GET /api/db/export` streaming the raw `.dsb` via `export_bytes()`
- [X] T009 [US2] Implement `doExport()` client download flow (`Blob` → object URL → `<a download>`)
- [X] T010 [US2] Implement `POST /api/db/import`: 50 MB cap via `file.read(max+1)`, `DevDB.from_bytes`,
      per-store `_ALLOWED_STORES` filtering, single `save()`
- [X] T011 [US2] Implement `setupImport()` client flow: `.dsb`-extension pre-check, progress bar,
      error surfacing from response `detail`

**Checkpoint**: full backup/restore loop working

---

## Phase 5: User Story 3 - Browse individual store contents (P2)

- [X] T012 [US3] `GET /api/db/store/{name}` returns raw store JSON (already covered by T002;
      this phase is the "use it standalone" acceptance, no additional UI beyond the About panel
      cross-reference)

**Checkpoint**: debugging aid available via direct API call

---

## Phase 6: User Story 4 - Always-ask authentication (P1)

- [X] T013 [US4] Implement `initLockScreen()`: DB path preview pre-auth, `is_setup` branch
      (lock form vs. "not set up" notice) — deliberately does **not** import/use `auth-guard.js`
- [X] T014 [US4] Implement `attemptUnlock()`: challenge fetch → PBKDF2 → AES-CBC verify-blob
      decrypt → session exchange
- [X] T015 [US4] Implement 401-triggers-relock handling in `loadMeta()`

**Checkpoint**: always-ask model verified distinct from `auth-guard.js` tools

---

## Phase 7: User Story 5 - Change or remove master password (P3)

- [X] T016 [US5] Implement password modal (`openPasswordModal`/`closePasswordModal`)
- [X] T017 [US5] Implement `savePassword()`: v1-shape challenge computation + POST to
      `/api/auth/update-challenge` — **note**: see spec.md Assumptions for the v1-only-shape
      cross-tool discrepancy with Vault's v2 scheme; not changed by this retroactive spec

**Checkpoint**: password lifecycle manageable from this tool

---

## Phase 8: Polish & Cross-Cutting

- [X] T018 [P] About/format panel toggle (`setupAboutPanel`)
- [X] T019 Retroactive documentation: this spec-kit folder authored 2026-07-28 from
      `specs/SPEC.md` §4.11/§5.3/§6 plus direct source inspection of `routes/db.py`,
      `static/db-manager.js`
- [ ] T020 **Recommended follow-up (not part of this retroactive spec)**: add
      `tests/python/test_db_routes.py` covering auth-gating, unknown-store 400s, and the 50 MB
      import cap at the HTTP layer, per the Art. VI gap noted in plan.md
- [ ] T021 **Recommended follow-up (not part of this retroactive spec)**: update
      `savePassword()` in `db-manager.js` to emit a v2-shaped `challenge_version: 2` challenge
      (mirroring `vault.js`'s `_registerSetupChallenge`) to close the v1-downgrade window
      described in spec.md Assumptions

---

## Dependencies & Execution Order

- Setup → Foundational → US1 (MVP) → US2 → US3 (trivial, reuses T002) → US4 → US5 → Polish.
- T020/T021 are intentionally left unchecked — they are gaps this retroactive spec surfaces, not
  work it performed.

## Implementation Strategy

Retroactive record, not a forward plan. Future changes should branch a new numbered spec.
