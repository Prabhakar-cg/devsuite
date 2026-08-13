# Quickstart & Validation: DevDB Manager

## Setup

```bash
python main.py          # serves on http://127.0.0.1:8000
```

Open `http://127.0.0.1:8000/db-manager`.

## Manual validation (maps to spec user stories)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| US1 | Inspect | Unlock → observe banner + store cards | Path/size/timestamps/version render; `vault`/`ssh_profiles` show a lock icon instead of a count |
| US1 | Auto-refresh | Leave page open 30s | Values silently refresh (no visible loading state) |
| US2 | Export | Click Export | `devdb-backup-<YYYY-MM-DD>.dsb` downloads |
| US2 | Import valid | Click Import, choose a previously exported `.dsb` | Progress bar animates; toast "Imported N stores from …" |
| US2 | Import wrong extension | Select a `.json` file | Client-side rejection, "Only .dsb files can be imported", no request sent |
| US2 | Import oversized | Attempt to import a >50 MB file | HTTP 413 surfaced via toast |
| US3 | Store view | `curl -s localhost:8000/api/db/store/collections -H "Cookie: ds_session=..."` | Raw JSON of the `collections` store |
| US3 | Unknown store | `curl -s localhost:8000/api/db/store/nope ...` | HTTP 400 `"Unknown store: 'nope'"` |
| US4 | Always-ask | Unlock, reload page | Lock screen reappears (no session-cache bypass) |
| US4 | Not set up | On a DB with no master password configured | "not set up" notice instead of a password field |
| US4 | Session expiry mid-use | Manually expire/delete the session server-side, then wait for the 30s auto-refresh | UI re-locks with "Session expired. Please unlock again." |
| US5 | Change password | Open password modal, submit matching new passwords | Success toast; old sessions invalidated (confirm by needing to re-unlock) |
| US5 | Mismatch | Submit non-matching passwords | "Passwords do not match." shown client-side |

## Automated coverage that exists today

```bash
pytest tests/python/test_devdb.py          # engine-level export_bytes/from_bytes/roundtrip
pytest tests/python/test_auth_session.py   # shared require_unlocked session gate
```

## Coverage gaps (honest accounting)

- **No dedicated `routes/db.py` HTTP-layer test file exists.** The engine functions it calls are
  tested; the route wiring itself (auth gate on all four endpoints, the `_ALLOWED_STORES` 400
  rejection, the 413 oversized-import path, the per-store merge-not-atomic-swap behavior) is not
  directly asserted by any test today. Recommended follow-up: `tests/python/test_db_routes.py`.
- **No JS test coverage** for `db-manager.js` (lock-screen state machine, `renderStores`
  formatting, import progress flow) — consistent with SPEC §10.1's note that only the three pure
  modules (`curl-codegen.js`, `cookie-jar.js`, `collection-utils.js`) currently have JS unit
  tests.

## Acceptance gates

- Every FR in spec.md is exercised by at least one manual scenario above.
- SC-002 (export→import round-trip fidelity) is backed by `test_devdb.py`'s
  `test_save_then_reload_from_disk` and encrypted-roundtrip tests at the engine layer that
  `routes/db.py`'s export/import thinly wrap.
