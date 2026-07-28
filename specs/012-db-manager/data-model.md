# Phase 1 Data Model: DevDB Manager

This tool has no data model of its own beyond a read/write UI over the shared DevDB engine (SPEC
§6). Shapes below are the HTTP-visible views, not new persisted entities.

## `DB Meta` (`GET /api/db/meta` response)

| Field | Type | Source |
|---|---|---|
| `path` | `str` | `_DB_PATH` constant |
| `size` | `int` (bytes) | `deps._db.file_size()` |
| `encrypted` | `bool` | `deps._db.is_encrypted()` |
| `stores` | `dict[str, {bytes: int, count: int\|None}]` | `deps._db.store_sizes()` |
| `meta` | `dict` | `deps._db.meta()` — `created`, `modified`, `app`, `version` timestamps |

## `Store Card` (client-derived, not a wire shape)

Built by joining `STORE_META` (static, in `db-manager.js`) with the `stores` map above:

| Field | Type | Notes |
|---|---|---|
| `name` | `str` | one of `vault`, `collections`, `ssh_profiles`, `app_prefs` |
| `icon` | inline SVG string | static per-store, author-authored |
| `label` | `str` | display name |
| `locked` | `bool` | `true` for `vault`/`ssh_profiles` — suppresses entry-count display |
| `desc` | `str` | one-line description |
| `bytes` | `int \| null` | from `stores[name].bytes`; `null` → card shows "Empty" |
| `count` | `int \| "🔒" \| null` | `storeEntryCount()`: lock marker for locked stores, else the
  raw count, else `null` → displayed as `—` |

## `Import Result` (`POST /api/db/import` response)

| Field | Type |
|---|---|
| `status` | `"ok"` |
| `imported_stores` | `string[]` — names actually merged (subset of the uploaded file's stores,
  filtered to `_ALLOWED_STORES`) |

## Underlying entity this tool manages (owned by `devdb.py`, not this feature)

The `.dsb` file itself — see `specs/SPEC.md` §6.2 for the exact binary header/payload layout.
This spec deliberately does not re-document the byte format; it documents the *UI contract* over
it.
