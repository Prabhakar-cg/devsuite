# Implementation Plan: DevDB Manager

**Branch**: `012-db-manager` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-db-manager/spec.md`

**Note**: Retroactive plan for an already-shipped tool.

## Summary

An admin console at `/db-manager` exposing the DevDB storage engine (`devdb.py`) for inspection,
export, and import, plus master-password lifecycle management. Deliberately uses an always-ask
auth model (no 8-hour session cache) because it is the one tool that can read/export/replace
every other tool's persisted data in one action.

## Technical Context

**Language/Version**: Python 3.10+ (FastAPI) / vanilla JS

**Primary Dependencies**: FastAPI (`UploadFile`, streaming `Response`), the existing `DevDB`
class (`devdb.py`) for `.dsb` parsing/serialization; CryptoJS (client, password-change challenge
computation only)

**Storage**: The DevDB engine itself — this tool is a direct UI over `devdb.py`'s public API
(`meta()`, `store_sizes()`, `export_bytes()`, `DevDB.from_bytes()`, `file_size()`,
`is_encrypted()`), not a consumer of one named store the way other tools are.

**Testing**: No `routes/db.py`-specific test file exists; coverage is indirect via
`tests/python/test_devdb.py` (engine-level export/import/roundtrip) and
`tests/python/test_auth_session.py` (the shared session-gate mechanism `require_unlocked` also
protects these routes). See quickstart.md for the gap.

**Target Platform**: Any modern browser; server is `localhost`-only.

**Project Type**: Web tool within DevSuite's single-project layout.

**Performance Goals**: Export/import must handle the full `.dsb` file (bounded by the 50 MB
import cap) without streaming chunking — acceptable given DevDB is a single local config/secrets
store, not a bulk-data database.

**Constraints**: Import MUST only touch `_ALLOWED_STORES` names (prevents an imported `.dsb` from
injecting arbitrary store names into the running database); MUST enforce the 50 MB cap before
full deserialization.

**Scale/Scope**: Single `.dsb` file, four named stores; no pagination or filtering needed at
current scale.

## Constitution Check

*GATE: evaluated retroactively — PASS, with one documented cross-tool discrepancy (not
introduced by this spec; see spec.md Assumptions).*

**Core principles (I–VII):**

| Principle | Compliance |
|---|---|
| I. Spec first | Retroactive — closing the documentation gap now; future changes to `/db-manager` must update this spec first. |
| II. Verify against source | Verified against `routes/db.py` and `static/db-manager.js` directly; the v1-challenge discrepancy (US5) was found this way, not assumed from SPEC.md prose. |
| III. No undocumented behavior | `/api/db/*` routes and the four store names are already in SPEC.md §5.3/§6.4; this spec adds behavior-level detail. |
| IV. Backend never decrypts opaque blobs | N/A directly (DB Manager doesn't touch vault plaintext), but it **does** touch the vault's *ciphertext blob* wholesale during export/import/store-view — confirmed `routes/db.py` never attempts to parse or decrypt `vault`/`ssh_profiles` contents, treating them as opaque bytes like every other store. |
| V. No `innerHTML` with untrusted data | The one `innerHTML` use (`renderStores`) interpolates only server-computed metadata, never raw user input — see spec.md Assumptions for the explicit reasoning distinguishing this from a violation. |
| VI. Security paths ship with tests | Partial: the underlying DevDB engine operations (`export_bytes`/`from_bytes`) are tested in `test_devdb.py`; the HTTP layer (`routes/db.py`) itself has no dedicated test file — flagged as a coverage gap in quickstart.md, not remediated here. |
| VII. Version bump protocol | N/A — no version-affecting change from writing this spec. |

**Spec & security baseline:**
- [x] `specs/SPEC.md` already documents `/api/db/*` (§5.3) and the four store names (§6.4).
- [x] No new outbound network paths.
- [x] Vanilla HTML/CSS/JS; persistence is DevDB-only (this tool *is* the DevDB admin surface).
- [x] Backend never decrypts vault/SSH blobs — confirmed for the import/export/store-read paths
      too (they move bytes, not plaintext).
- [~] No `innerHTML` with untrusted data — compliant per the "server-computed, not user-supplied"
      reading in spec.md Assumptions; flagged with `[~]` rather than `[x]` because it is a judgment
      call worth a reviewer's eyes, not a clean-cut pass like Vault's all-`textContent` approach.
- [ ] Security-path test coverage — **gap**: no `tests/python/test_db_routes.py`-equivalent
      exists for `routes/db.py`'s auth-gating, 50 MB cap, or unknown-store-name rejection at the
      HTTP layer (only the underlying engine is tested). Recorded here rather than silently
      passed, per Art. VI.
- [x] Release path — N/A.
- [x] Static-analysis — a previously BLOCKER-severity Sonar finding (`db-manager.js:188` implicit
      global `_serverToken`, S2703) is noted in SPEC §10.4 as **resolved**, no longer present.

**New-tool / UI cross-cutting checklist**: N/A — existing tool, no new-tool changes.

## Project Structure

### Documentation (this feature)

```text
specs/012-db-manager/
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
└── db.py                 # /api/db/meta, /store/{name}, /export, /import

static/
├── db-manager.html         # Lock screen + manager UI markup
├── db-manager.js           # All logic: lock/unlock, meta rendering, export/import, password
└── db-manager.css          # Styling

devdb.py                    # Storage engine this tool is a UI over (shared with all DevDB tools)
```

**Structure Decision**: No structural change — fits the existing flat layout.

## Complexity Tracking

No constitutional violations requiring justification. The `[~]` and `[ ]` items above are
recorded gaps/judgment calls, not violations requiring a Complexity Tracking entry (they are
pre-existing conditions being surfaced by this retroactive spec, not new complexity being
introduced).
