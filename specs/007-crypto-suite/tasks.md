# Tasks: Crypto Suite

**Input**: Design documents from `/specs/007-crypto-suite/`

**Tests**: NOT INCLUDED — no security-critical path per SPEC §10.2 triggers a test requirement,
and no automated tests exist today. Retroactive tasks reflect what actually shipped.

**Organization**: grouped by user story (tab), mirroring spec.md. All tasks are `[X]` — a
retroactive record, not a forward plan.

## Format: `[ID] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Create `static/crypto.html` with tab bar (`#crypto-tabs`) and six tab panels on shared `linter.css` chrome
- [X] T002 Register `GET /crypto` route in `routes/pages.py` returning `_serve_html("crypto.html")`
- [X] T003 Load `crypto-js.min.js` before `require.min.js` per the UMD-ordering constraint (CLAUDE.md gotcha, guarded by `tests/python/test_asset_order.py`)

---

## Phase 2: Foundational

- [X] T004 Tab-switch wiring: `.crypto-tab` click handlers toggle `.active` class and show/hide the matching panel (`static/crypto.html:642+`)
- [X] T005 Shared `toast()` helper for consistent success/warning/error feedback across all six tabs

**Checkpoint**: tab shell ready for per-tab logic

---

## Phase 3: User Story 1 - Hash Generator (Priority: P1) 🎯 MVP

- [X] T006 [US1] `sha(algo, str)` helper wrapping `crypto.subtle.digest` for SHA-1/256/512 (`static/crypto.html:671-674`)
- [X] T007 [US1] `#hash-run-btn` handler: run SHA-256/512/1 in parallel via `Promise.all` + `CryptoJS.MD5` for MD5, render four labeled results with copy buttons and strength notes (`static/crypto.html:680-700`)
- [X] T008 [US1] `#hash-clear-btn` resets the results panel to its empty-state prompt

**Checkpoint**: hashing usable standalone

---

## Phase 4: User Story 2 - AES Encrypt / Decrypt (Priority: P1)

- [X] T009 [US2] AES mode select (`#aes-mode`: CBC, CTR only — no ECB, see spec.md discrepancy note)
- [X] T010 [US2] `#aes-encrypt-btn` / `#aes-decrypt-btn` handlers using `CryptoJS.AES.encrypt/decrypt` with mode-appropriate padding (Pkcs7 for CBC, NoPadding for CTR) (`static/crypto.html:783-825`)
- [X] T011 [US2] Explicit empty-result error on decrypt (wrong key/corrupted ciphertext never reported as blank success)

**Checkpoint**: AES round-trip usable standalone

---

## Phase 5: User Story 3 - RSA Keygen + Encrypt/Decrypt (Priority: P2)

- [X] T012 [US3] `arrayBufferToPem()` DER→PEM formatter (`static/crypto.html:861-864`)
- [X] T013 [US3] `#rsa-gen-btn` handler: `crypto.subtle.generateKey` RSA-OAEP (2048/4096, SHA-256), export SPKI/PKCS8 to PEM, enable encrypt/decrypt buttons only after success (`static/crypto.html:866-894`)
- [X] T014 [US3] RSA-OAEP encrypt/decrypt handlers against the session-held `rsaKeyPair` (`static/crypto.html:922,937`)

**Checkpoint**: RSA round-trip usable standalone

---

## Phase 6: User Story 4 - HMAC Sign & Verify (Priority: P2)

- [X] T015 [US4] `hmacKey(secret, algo)` helper importing a raw HMAC key (`static/crypto.html:954-961`)
- [X] T016 [US4] `#hmac-sign-btn` handler producing a hex signature via `crypto.subtle.sign` (`static/crypto.html:963-976`)
- [X] T017 [US4] `#hmac-verify-btn` handler rendering a VALID/INVALID banner via `crypto.subtle.verify` (`static/crypto.html:989-999`)

**Checkpoint**: HMAC sign/verify usable standalone

---

## Phase 7: User Story 5 - Base64 tab (Priority: P3)

- [X] T018 [US5] Independent `encodeB64`/`decodeB64`/`encodeBuffer`/`decodeB64ToBytes` implementation on this tab (`static/crypto.html:1029-1086`) — not shared code with `static/base64.html`
- [X] T019 [US5] File-to-buffer support enabling binary file Base64 encoding (`encodeBuffer`), a capability the standalone Base64 tool lacks

**Checkpoint**: in-context Base64 usable without leaving the Crypto Suite

---

## Phase 8: User Story 6 - JWT Inspector with verification (Priority: P2)

- [X] T020 [US6] `b64urlStr`/`b64urlBytes` decode helpers (`static/crypto.html:1202-1212`)
- [X] T021 [US6] `buildClaimsBar()` rendering algorithm/expiry/other standard claims with an EXPIRED badge when applicable (`static/crypto.html:1237-1267`)
- [X] T022 [US6] `decodeJwt()` live-decode on every keystroke (header/payload pretty-printed, signature segment shown raw) (`static/crypto.html:1269-1284`)
- [X] T023 [US6] `#jwt-verify-btn` handler: HS256/384/512 via `crypto.subtle.verify('HMAC', ...)`, RS256 via PEM-import + `RSASSA-PKCS1-v1_5` verify, fail-closed for any other `alg` (`static/crypto.html:1310-1349`)

**Checkpoint**: full JWT decode + verify usable standalone

---

## Phase 9: Retroactive Documentation

- [X] T024 Author this spec-kit folder (`spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `quickstart.md`, `research.md`, `contracts/http-api.md`, `checklists/requirements.md`) on 2026-07-28 from `SPEC.md §4.6` and direct inspection of `static/crypto.html` and `routes/pages.py`; flag the tab-count and AES-mode discrepancies (spec.md header + FR-002) rather than silently resolving them. **Follow-up recommended**: update `specs/SPEC.md` §4.6 to list all six tabs — out of scope for this fork (owned by the coordinator's SPEC.md trim pass).

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → the six tab user stories, which are fully independent of each other (no
  shared state between tabs beyond the page shell) and could have shipped/be modified in any
  order.
- Phase 9 is documentation-only, sequenced last as it describes the finished state.
