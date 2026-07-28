# Tasks: Secret Vault

**Input**: Design documents from `/specs/011-secret-vault/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Server-side security paths already covered (`test_vault_v2.py`, `test_auth_session.py`,
`test_devdb.py`). All tasks below are marked complete — they describe the already-shipped
implementation, reconstructed from source for spec-kit traceability.

## Format: `[ID] [Story] Description`

## Path Conventions

Single project: `routes/`, `static/` at repo root (per plan.md structure).

---

## Phase 1: Setup

- [X] T001 Add `vault` and `app_prefs` to `_ALLOWED_STORES` in `deps.py` (shared with DB Manager)
- [X] T002 Create `static/vault.html` (lock overlay + manager shell), `static/vault.css`,
      register `/vault` route in `routes/pages.py`

---

## Phase 2: Foundational

- [X] T003 Implement `routes/auth.py`: `/api/auth/status`, `/api/auth/challenge` (rate-limited
      5/min), `/api/auth/setup`, `/api/auth/session` (rate-limited 5/min, issues `ds_session` +
      `ds_csrf` cookies), `/api/auth/update-challenge`, `/api/auth/logout`
- [X] T004 Implement `routes/storage.py` vault block: `GET`/`POST /api/vault` as an opaque
      pass-through gated by `require_unlocked`
- [X] T005 [P] Implement `require_unlocked` session-cookie check + BLAKE2b token hashing in
      `deps.py`
- [X] T006 [P] Implement `components.js` `DevSuite.csrfToken()` shared helper

**Checkpoint**: auth + storage plumbing ready — vault UI can build on it

---

## Phase 3: User Story 1 - Create master password and store first secret (P1) 🎯 MVP

- [X] T007 [US1] Implement `initVaultMode()` in `vault.js`: detect `is_setup`/`vault_has_data`
      via `/api/auth/status`, switch lock-screen copy for first-run vs. migration
- [X] T008 [US1] Implement `_unlockSetupNewVault()`: validate password (`_validateSetupPassword`),
      derive v2 keys, `_registerSetupChallenge`, persist initial empty vault
- [X] T009 [US1] Implement `openModal`/`saveModal`/`buildEntryFromModal` for first secret creation

**Checkpoint**: fresh install → first secret saved, working end to end

---

## Phase 4: User Story 2 - Unlock and manage secrets across categories (P1)

- [X] T010 [US2] Implement `_unlockVaultNormal()`: challenge → session → vault fetch → decrypt
- [X] T011 [US2] Implement per-category modal field sets (`switchFieldSet`, `_modalPassword`,
      `_modalToken`, `_modalSsh`, `_modalApi`, `_modalEnv`, `_modalNote`) with required-field
      validation
- [X] T012 [US2] Implement `duplicateEntry`, `deleteEntry` (confirm-gated), `persistVault`

**Checkpoint**: full CRUD across all 6 categories

---

## Phase 5: User Story 3 - Reveal, copy, clipboard auto-clear (P2)

- [X] T013 [US3] Implement `addFieldRow` reveal toggle (`toggleReveal`) with masked-by-default
      rendering
- [X] T014 [US3] Implement `copyToClipboard` with 30s auto-clear timer
- [X] T015 [US3] Implement scheme-validated URL click-through for Password entries' `url` field

**Checkpoint**: safe reveal/copy loop complete

---

## Phase 6: User Story 4 - Filter and search (P2)

- [X] T016 [US4] Implement sidebar category filters + live counts (`renderCounts`)
- [X] T017 [US4] Implement `filteredEntries()` search over title/subtitle, empty-state messaging

**Checkpoint**: usable at scale

---

## Phase 7: User Story 5 - Client-side-only encryption guarantee (P1)

- [X] T018 [US5] Implement `_deriveMasterKeysV2` (PBKDF2-SHA256/310k → Kenc/Kauth split)
- [X] T019 [US5] Implement `encryptVaultGCM`/`decryptVaultGCM` (AES-256-GCM via WebCrypto)
- [X] T020 [US5] Verify (by inspection, `test_vault_v2.py`) that only `Kauth` ever reaches
      `/api/auth/session`, never `Kenc`

**Checkpoint**: zero-knowledge-server guarantee holds

---

## Phase 8: User Story 6 - Legacy v1 → v2 migration (P3)

- [X] T021 [US6] Implement legacy v1 helpers (`deriveKey`, `encryptVault`, `decryptVault`,
      CryptoJS PBKDF2-SHA1/50k) retained for migration reads only
- [X] T022 [US6] Implement `_unlockSetupMigration()` (pre-challenge vaults via
      `/api/vault/migrate`) and the in-`_unlockVaultNormal` auto-upgrade path
- [X] T023 [US6] Implement `/api/vault/migrate` 409-after-setup guard in `routes/auth.py`

**Checkpoint**: existing v1 installs upgrade transparently

---

## Phase 9: Polish & Cross-Cutting

- [X] T024 [P] Auto-lock after 5 min hidden (`startAutoLock`/`onVisibilityChange`) — see
      spec.md Assumptions for the documented v2-session gap
- [X] T025 [P] XSS hardening pass: `textContent`/`createElement` everywhere except static SVG
      markup (SPEC §7.7)
- [X] T026 Retroactive documentation: this spec-kit folder authored 2026-07-28 from
      `specs/SPEC.md` §4.10/§5.2/§5.4/§6.4/§7 plus direct source inspection of `routes/auth.py`,
      `routes/storage.py`, `static/vault.js`

---

## Dependencies & Execution Order

- Setup → Foundational → US1 (MVP) → US2 → US3/US4/US5/US6 (independent of each other, all
  depend on US1+US2 existing) → Polish.

## Implementation Strategy

This is a retroactive record, not a forward plan — all phases are already shipped. Future work
on the Vault should branch a new numbered spec (e.g. a `014-` folder) rather than editing this
one, per the spec-kit convention in `CLAUDE.md`.
