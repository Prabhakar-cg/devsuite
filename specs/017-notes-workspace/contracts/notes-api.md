# Contract: Notes Storage API

The only server surface this feature adds. Mirrors `GET/POST /api/vault`
(`routes/storage.py`) exactly — same auth, same shape, same semantics — so
that DevSuite's existing session/CSRF/rate-limiting behavior applies
unchanged. The backend never decrypts `encrypted_blob`; every field below
except `status`/`detail` is opaque ciphertext or metadata to it.

## `GET /api/notes`

Returns the current encrypted notes blob.

**Auth**: Requires a valid session (`require_unlocked` — `ds_session`
cookie or `X-Session-Token` header). Same as every other DevDB-backed store
endpoint.

**Response `200`**:

```json
{
  "encrypted_blob": "<hex ciphertext, or empty string if never saved>",
  "iv": "<hex, 12-byte IV>",
  "salt": "<hex, PBKDF2 salt>",
  "version": 2
}
```

If no notes have ever been saved, returns `{"encrypted_blob": ""}` (matching
`get_vault`'s empty-state shape) — the client treats this as "initialize an
empty NotesTree, generate a fresh salt on first save."

**Response `401`**: Session token missing or expired.

## `POST /api/notes`

Persists the encrypted notes blob, overwriting whatever was stored before.

**Auth**: Same as `GET` — `require_unlocked`, plus CSRF token header
(`X-CSRF-Token`) per DevSuite's existing session-cookie CSRF contract.

**Request body**:

```json
{
  "encrypted_blob": "<hex ciphertext>",
  "iv": "<hex, 12-byte IV>",
  "salt": "<hex, PBKDF2 salt>",
  "version": 2
}
```

**Response `200`**: `{"status": "ok"}`

**Response `401`**: Session token missing or expired.

**Response `500`**: `{"detail": "Failed to save notes"}` — DevDB write
failure (disk, corruption, etc.); mirrors `save_vault`'s error handling.

## Non-goals

- No endpoint reads or writes individual notebooks/sections/pages — the
  whole tree is always read/written as one blob (see `data-model.md` §4–5
  and `research.md` item 1). There is intentionally no
  `GET /api/notes/{pageId}`-style endpoint.
- No server-side search, link-resolution, or tag endpoint — all of that is
  client-side only (`research.md` item 6); the server has nothing to search
  since it never holds plaintext.

## Cross-cutting: `_ALLOWED_STORES`

`deps.py`'s `_ALLOWED_STORES` set (consulted by the generic DevDB Manager
browser, `routes/db.py`) must include `"notes"` so DB Manager can list this
store, and back it up/restore it, alongside `vault`/`collections`/
`ssh_profiles`/`app_prefs`. This is not a new endpoint — it's a one-line
addition making an *existing* generic endpoint aware of the new store name.
