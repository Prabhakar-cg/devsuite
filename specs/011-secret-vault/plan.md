# Implementation Plan: Secret Vault

**Branch**: `011-secret-vault` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-secret-vault/spec.md`

**Note**: Retroactive plan — the Vault shipped before spec-kit adoption. This document records
the as-built architecture and verifies it against the constitution, rather than proposing new
work.

## Summary

A KeePass-style encrypted secret manager served at `/vault`. All cryptography (key derivation,
AES-256-GCM encryption/decryption) runs client-side in `static/vault.js` via the WebCrypto API
(v2 scheme) with a CryptoJS-based legacy path retained only for reading/migrating pre-existing
v1 vaults. The backend (`routes/auth.py`, `routes/storage.py`) is a session-gated opaque blob
store: it authenticates the user via a domain-separated `Kauth` value and stores/returns the
`vault` DevDB blob without ever seeing plaintext or the decryption key `Kenc`.

## Technical Context

**Language/Version**: Python 3.10+ (FastAPI backend) / vanilla ES2020+ JavaScript (frontend, no
build step)

**Primary Dependencies**: FastAPI + `cryptography` (AESGCM, for server-side challenge
verification only) on the backend; WebCrypto API (native browser) + CryptoJS v4.2.0 (self-hosted,
legacy v1 path only) on the frontend

**Storage**: DevDB `vault` store (opaque ciphertext blob) + DevDB `app_prefs` store (challenge
metadata) — SPEC §6.4

**Testing**: `tests/python/test_vault_v2.py` (challenge setup/session accept-reject for v1 and
v2), `tests/python/test_auth_session.py` (session token hashing, rate limiting, expiry),
`tests/python/test_devdb.py` (underlying AES-256-GCM roundtrip at the storage-engine level). No
frontend/JS test coverage exists for `vault.js` itself (see quickstart.md).

**Target Platform**: Any modern browser with WebCrypto support (all evergreen browsers); server
is `localhost`-only per DevSuite's mission

**Project Type**: Web tool within the existing single-project DevSuite layout (no separate
frontend/backend projects — see SPEC §3.2)

**Performance Goals**: Unlock (challenge fetch → key derivation → session → vault fetch →
decrypt) completes in well under 1s on commodity hardware; PBKDF2 at 310,000 iterations is the
dominant cost and is intentionally slow (brute-force resistance), not a UX target to optimize.

**Constraints**: Backend must never receive plaintext or `Kenc` (Art. IV, non-negotiable); no
`innerHTML` with untrusted data (Art. V); vault blob persists only via DevDB (Art. III).

**Scale/Scope**: Single-user local tool; entry counts are expected in the tens–low hundreds, not
requiring pagination or indexing beyond in-memory array filtering.

## Constitution Check

*GATE: evaluated retroactively against `.specify/memory/constitution.md` — PASS, with one
documented pre-existing discrepancy noted below (not introduced by this spec).*

**Core principles (I–VII):**

| Principle | Compliance |
|---|---|
| I. Spec first | Retroactive — this spec is being written now to close the gap; going forward, changes to `/vault` must update this spec before code (and fold durable contracts back into `specs/SPEC.md`). |
| II. Verify against source | Verified: `TYPE_META` in `vault.js` diverges from SPEC.md §4.10's category list — flagged explicitly in spec.md Assumptions rather than silently reconciled. |
| III. No undocumented behavior | The `vault` DevDB store, `/api/vault`, `/api/auth/*`, and `/api/vault/migrate` are all documented in SPEC.md §5.2/§5.4/§6.4 already; this spec adds the behavioral detail SPEC.md intentionally keeps terse. |
| IV. Security paths have tests | `test_vault_v2.py` + `test_auth_session.py` cover the server-side challenge/session paths (SPEC §10.2). No client-side (`vault.js`) unit tests exist — flagged as a gap in quickstart.md, consistent with SPEC §10.1's note that browser/e2e coverage is still a v1.0.0 deliverable. |
| V. No undocumented behavior (routes) | N/A — no new routes. |

**Spec & security baseline:**
- [x] `specs/SPEC.md` already documents this tool's routes/store/security rules (§4.10, §5.2,
      §5.4, §6.4, §7) — this folder adds detail, doesn't introduce new undocumented surface.
- [x] No new outbound network paths — Vault makes no outbound requests beyond the DevSuite
      backend itself.
- [x] Vanilla HTML/CSS/JS, no frameworks; persistence is DevDB-only (`vault` + `app_prefs`
      stores).
- [x] **Backend never decrypts vault blobs** (Art. IV) — verified: `routes/storage.py`'s
      `get_vault`/`save_vault` only call `deps._db.get_store`/`set_store`; `routes/auth.py`'s
      session verification uses `Kauth`, which cannot decrypt `Kenc`-encrypted ciphertext.
- [x] No `innerHTML` with untrusted data — the one `innerHTML` use in `vault.js` (`modEl`) is a
      static, author-authored SVG string with no interpolated user data; all secret values render
      via `textContent`.
- [x] Changes to auth/CSRF/sessions/PBKDF2/AES-GCM ship with tests — pre-existing coverage in
      `test_vault_v2.py`, `test_auth_session.py`, `test_devdb.py`, `test_csrf.py` satisfies this
      for the current surface.
- [x] Release path (version bump protocol) — N/A, no version-affecting change from writing this
      spec.
- [x] Static-analysis gates — `vault.js:236` is a known SonarCloud complexity finding (SPEC
      §10.4, S3776, CRITICAL) — pre-existing debt, not addressed by this spec.

**New-tool / UI cross-cutting checklist**: N/A — Vault is an existing tool; no new tool being
added. The checklist items (tool-count sync, UMD load order, sandbox CSP, WS auth carve-out, SVG
iconography, third-party JS registration) were already satisfied at ship time and remain true.

## Project Structure

### Documentation (this feature)

```text
specs/011-secret-vault/
├── plan.md              # This file
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
├── auth.py              # /api/auth/status,challenge,setup,session,update-challenge,logout
│                         # + /api/vault/migrate (pre-setup only)
└── storage.py            # /api/vault GET/POST (opaque blob pass-through)

static/
├── vault.html            # Lock screen + manager UI markup
├── vault.js               # All crypto, state, CRUD, rendering (this feature's core)
├── vault.css               # Vault-specific styling
└── components.js           # DevSuite.csrfToken() (shared with all DevDB-backed tools)
```

**Structure Decision**: No structural change — Vault already fits DevSuite's flat
routes/+static/ layout with one dedicated route file section (`routes/auth.py` +
`routes/storage.py`'s vault block) and one dedicated frontend module (`vault.js`). No new
directories are introduced by this retroactive spec.

## Complexity Tracking

No constitutional violations — table not required. (The `vault.js:236` complexity finding is a
SonarCloud code-quality item tracked in SPEC §10.4, not a constitutional violation.)
