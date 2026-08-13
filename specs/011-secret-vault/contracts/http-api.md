# Contract: HTTP API — Secret Vault

The Vault frontend (`static/vault.js`) is the sole client of these endpoints. All are
session-gated via `require_unlocked` except the two explicitly marked bootstrap/migration paths.
Full endpoint table also lives in `specs/SPEC.md` §5.2/§5.4 — this file adds request/response
shape detail specific to the Vault flow.

## `GET /api/vault/migrate`

No auth. Disabled (409) once `master_setup_done` is true.

```
200 → {encrypted_blob, iv, salt, version}   (or {encrypted_blob: ""} if vault store is empty)
409 → {detail: "Master password is configured — use /api/vault with a valid session."}
```

## `GET /api/auth/status`

No auth.

```
200 → {is_setup: bool, vault_has_data: bool}
```

## `GET /api/auth/challenge`

No auth. Rate-limited 5/min/IP.

```
200 → {salt, verify_blob, verify_iv, verify_nonce, challenge_version}
404 → {detail: "Master password not configured"}
429 → (rate limited)
```

`verify_iv` is populated for v1 challenges, `verify_nonce` for v2; the unused field is `""`.

## `POST /api/auth/setup`

No auth (bootstrap — CSRF-exempt).

Request (v2): `{salt, verify_blob, verify_nonce, challenge_version: 2}`
Request (v1): `{salt, verify_blob, verify_iv}` (challenge_version omitted → defaults to 1)

```
200 → {status: "ok"}
400 → {detail: "Missing required fields: ..."}
409 → {detail: "Master password already configured"}
```

## `POST /api/auth/session`

No prior session (bootstrap — CSRF-exempt). Rate-limited 5/min/IP.

Request: `{key_hex: string}` — `Kauth` (v2) or the single legacy key (v1), hex-encoded.

```
200 → {status: "ok", expires_in: 28800}
     Set-Cookie: ds_session=<token>; HttpOnly; SameSite=Strict; Max-Age=28800[; Secure]
     Set-Cookie: ds_csrf=<token>; SameSite=Strict; Max-Age=28800[; Secure]
400 → {detail: "Missing key_hex"}
401 → {detail: "Invalid master key"} | {detail: "Key verification failed"}
404 → {detail: "Master password not configured"}
429 → (rate limited)
```

## `GET /api/vault`

Requires `ds_session` cookie (`require_unlocked`).

```
200 → {encrypted_blob, iv, salt, version}   (or {encrypted_blob: ""} for a new vault)
401 → {detail: "..."}   (missing/expired session)
```

## `POST /api/vault`

Requires `ds_session` cookie + `X-CSRF-Token` header matching `ds_csrf`.

Request: `{encrypted_blob, iv, salt, version: 2}` (the entire re-encrypted vault, replacing the
prior blob — no partial/patch updates).

```
200 → {status: "ok"}
401 → {detail: "..."}
500 → {detail: "Failed to save vault"}
```

## `POST /api/auth/update-challenge`

Requires `ds_session` cookie. **Note**: this endpoint is shared with the DB Manager's
"Change Password" feature (§012-db-manager) — see spec.md Assumptions for the v1-downgrade
implication when invoked from that UI rather than from Vault itself (Vault has no in-tool
password-change control; changing the master password today is only possible via DB Manager).

```
200 → {status: "ok"}   — also clears ALL active sessions server-side (_sessions.clear())
400 → {detail: "Missing required fields: ..."}
401 → {detail: "..."}
404 → {detail: "Master password not yet configured"}
```

## `POST /api/auth/logout`

Requires `ds_session` cookie.

```
200 → {status: "ok"}   — clears ds_session + ds_csrf cookies, removes this session's hash only
```

## Compatibility rules

- All vault-related endpoints are additive/stable since v0.2.x; no breaking changes recorded.
- `challenge_version` is the sole discriminator for v1/v2 handling — any future v3 scheme should
  extend this field rather than overload `version`.
