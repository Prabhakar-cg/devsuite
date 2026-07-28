# Contract: HTTP API — DevDB Manager

All endpoints require `require_unlocked` (valid `ds_session` cookie) except where noted. Base
table also in `specs/SPEC.md` §5.3 — this file adds request/response shapes.

## `GET /api/db/meta`

```
200 → {path: str, size: int, encrypted: bool,
       stores: {[name: str]: {bytes: int, count: int|null}},
       meta: {created, modified, app, version}}
401 → {detail: "..."}
```

## `GET /api/db/store/{name}`

`name` MUST be one of `_ALLOWED_STORES` (`vault`, `collections`, `ssh_profiles`, `app_prefs`).

```
200 → <raw store JSON — shape owned by that store's feature, opaque here>
400 → {detail: "Unknown store: '<name>'"}
401 → {detail: "..."}
```

## `POST /api/db/store/{name}`

Request body: the full replacement JSON for that store (no partial-patch semantics).

```
200 → {status: "ok", store: "<name>"}
400 → {detail: "Unknown store: '<name>'"}
401 → {detail: "..."}
500 → {detail: "Failed to write store"}
```

## `GET /api/db/export`

```
200 → application/octet-stream, Content-Disposition: attachment; filename="devdb.dsb"
      body = deps._db.export_bytes()  (see specs/SPEC.md §6.2 for the .dsb binary layout)
401 → {detail: "..."}
500 → {detail: "Failed to export database"}
```

## `POST /api/db/import`

Multipart form, field `file` (`.dsb` binary). Server caps the read at 50 MB + 1 byte to detect
oversized uploads without buffering unbounded data.

```
200 → {status: "ok", imported_stores: string[]}
400 → {detail: "<DevDB.from_bytes ValueError message>"}   — malformed .dsb
401 → {detail: "..."}
413 → {detail: "Import file too large (50 MB limit)"}
500 → {detail: "Failed to import database"}
```

**Merge semantics**: only store names present in **both** the uploaded file and
`_ALLOWED_STORES` are written; stores in the running database but absent from the uploaded file
are left untouched (this is a merge, not a replace).

## Shared endpoints used by this tool but owned by Vault's contract

`GET /api/auth/status`, `GET /api/auth/challenge`, `POST /api/auth/session`,
`POST /api/auth/update-challenge` — see `specs/011-secret-vault/contracts/http-api.md` for full
shapes. This tool's `attemptUnlock()`/`savePassword()` are additional **callers** of those
endpoints, not additional route definitions.

## Compatibility rules

- `_ALLOWED_STORES` is the enforcement boundary for both read (`GET /api/db/store/{name}`) and
  write/import — adding a new named store anywhere in DevSuite requires adding it here too, or
  DB Manager will not display or import it (silently excluded from `imported_stores`, not an
  error).
