# Phase 1 Data Model: Secret Vault

Two layers: the **opaque server-visible blob** (DevDB `vault` store) and the **decrypted
client-side entry model** (never persisted server-side). No relational schema — DevDB stores
arbitrary JSON per named store (SPEC §6).

## Server-visible: Vault Blob (`vault` DevDB store)

| Field | Type | Notes |
|---|---|---|
| `encrypted_blob` | `str` (hex) | AES-256-GCM ciphertext (v2) or CryptoJS AES-CBC string (v1) |
| `iv` | `str` (hex) | 96-bit GCM IV (v2) or 128-bit CBC IV (v1) |
| `salt` | `str` (hex) | PBKDF2 salt, shared by both key-derivation schemes |
| `version` | `int` | `2` = AES-GCM / domain-separated keys; absent or `1` = legacy AES-CBC |

## Server-visible: Master-Password Challenge (`app_prefs` DevDB store)

| Field | Type | Notes |
|---|---|---|
| `master_setup_done` | `bool` | Gates whether `/api/vault/migrate` is still reachable |
| `master_salt` | `str` (hex) | Same salt used for the vault blob |
| `master_verify_blob` | `str` | AES-encrypted known plaintext `"DEVSUITE_MASTER_OK"` |
| `master_verify_nonce` | `str` (hex) | v2 only — GCM nonce |
| `master_verify_iv` | `str` (hex) | v1 only — CBC IV |
| `challenge_version` | `int` | `1` or `2`; absence implies `1` |

## Client-only: Secret Entry (decrypted, in-memory array `vaultEntries`)

Common fields: `id` (base36 timestamp + random suffix, `genId()`), `type`, `title`, `modified`
(epoch ms), `subtitle` (cached display hint, recomputed via `subtitleFor()`).

| Type | Fields (beyond common) | Required |
|---|---|---|
| `password` | `username?, password, url?, notes?` | `password` |
| `token` | `service?, token, expiry?, environment?, notes?` | `token` |
| `ssh` | `host?, username?, private_key, passphrase?, notes?` | `private_key` |
| `api` | `service?, api_key, environment?, notes?` | `api_key` |
| `env` | `varname, value, notes?` | `varname`, `value` |
| `note` | `content` | `content` |

**State/derivation rules**: `vaultEntries` exists only between a successful unlock and the next
`lockVault()` call (explicit lock, auto-lock, or page reload) — it is never written to
`localStorage`/`sessionStorage`. Every mutation (add/edit/delete/duplicate) immediately calls
`persistVault()`, which re-encrypts the **entire** entry array as one GCM blob (no per-entry
diffing) and `POST`s it.

## Cryptographic key material (never persisted anywhere)

```
root  = PBKDF2-HMAC-SHA256(password, salt, 310_000 iterations) → 512 bits   [v2]
Kenc  = root[0:32]   — AES-256-GCM vault key, stays in the browser tab's memory only
Kauth = root[32:64]  — sent as key_hex to POST /api/auth/session

legacy: key = PBKDF2-HMAC-SHA1(password, salt, 50_000 iterations) → 256 bits   [v1]
        (single key, used both for AES-CBC vault encryption and server verification —
         this is exactly the weakness v2's domain separation fixes)
```

## JSON shapes over the wire

`GET/POST /api/vault` body/response: the Vault Blob table above, verbatim — the server performs
no transformation, so the wire shape equals the DevDB-store shape (contracts/http-api.md).
