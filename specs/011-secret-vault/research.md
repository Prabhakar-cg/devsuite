# Phase 0 Research: Secret Vault

Retroactive record of the real technical decisions embedded in the shipped code, reconstructed
from `static/vault.js` comments and structure.

## R1 — Why WebCrypto AES-256-GCM + domain-separated keys (v2) instead of the original CryptoJS scheme (v1)

**Decision**: Derive a 512-bit PBKDF2-SHA256 root (310,000 iterations) and split it into `Kenc`
(vault encryption, browser-only) and `Kauth` (server session proof).

**Rationale** (from `vault.js` inline comment, lines ~70-77): the v1 scheme used a **single**
PBKDF2-derived key both to encrypt the vault client-side *and* to prove password knowledge to the
server (`key_hex` sent to `/api/auth/session` was the same key that decrypted the blob). A
compromised or logging-happy server could therefore reconstruct the vault decryption key from
what it was sent for authentication alone. Splitting the derived material into two
cryptographically independent halves closes that gap: even a fully malicious server that records
every `key_hex` it receives learns nothing that helps decrypt `Kenc`-encrypted ciphertext.

**Alternatives considered** (inferred from the two-scheme codebase, not documented explicitly):
- *Keep single-key scheme, just don't log it server-side*: rejected — "don't log it" is a
  procedural promise, not a cryptographic guarantee; domain separation is enforceable by
  construction.
- *Argon2id instead of PBKDF2*: tracked separately as open debt SEC-13 (SPEC §7.8); PBKDF2 was
  kept for v2 to avoid a WebCrypto-unsupported KDF (browsers do not natively implement Argon2)
  and the associated need for a WASM dependency, which would violate the no-CDN/self-hosted-only
  constraint without real benefit at the current threat model.
- *AES-CBC (unauthenticated) again for v2*: rejected in favor of AES-GCM, which is authenticated
  (detects ciphertext tampering) — CBC decrypt failures currently masquerade as "wrong password"
  (`decryptVault`'s catch-all), which GCM's built-in tag verification makes a more precise
  guarantee, not just a heuristic.

## R2 — Why auto-migrate v1 → v2 on unlock rather than a one-time forced migration screen

**Decision**: Migration happens transparently the first time a v1 vault is successfully unlocked
with the correct password (`_unlockVaultNormal`'s `blobVersion === 1` branch), not as a separate
forced step.

**Rationale**: The correct password is only provable by successfully decrypting the vault — so
"unlock" and "prove you can migrate safely" are the same event. A separate forced-migration
screen would just be the same unlock form again. Failure to complete the migration write
(`_registerSetupChallenge` / `persistVault`) is treated as non-fatal (caught, logged via
`console.warn`, retried on the next unlock) since the user's session is already usable in-memory
— refusing to let them use the vault because a background re-encrypt failed would be a worse
outcome than a v1 challenge lingering one more session.

## R3 — Why the migration-read endpoint (`/api/vault/migrate`) is unauthenticated

**Decision**: `GET /api/vault/migrate` requires no session cookie, but is permanently disabled
(HTTP 409) once `POST /api/auth/setup` has ever succeeded.

**Rationale** (from the route's docstring): this endpoint only exists to support installs where a
vault blob exists on disk but no challenge/session system was registered yet (pre-auth-system
installs, or a vault seeded before first setup). It is safe to leave unauthenticated because the
blob is still AES-encrypted — the server holds no key that could decrypt it — and it is
irreversibly closed the moment a master password is configured, so it cannot be used as a
standing bypass against an already-secured vault.

## R4 — Why clipboard auto-clear is 30 seconds, not shorter/longer/configurable

**Decision**: Fixed 30-second `setTimeout` clearing the clipboard to an empty string, restarted
on every new copy.

**Rationale**: Not documented in code comments; treated here as a UX default balancing "long
enough to paste into a target field" against "short enough that a shared/unattended machine
isn't exposed for long." No configurability exists — out of scope for this retroactive spec to
second-guess the exact constant, but flagged as a reasonable future enhancement (SPEC §13
Backlog already lists "Vault clipboard auto-clear (30-second countdown)" as delivered in v0.5.0
scope, confirming 30s was the deliberate target, not a placeholder).

## R5 — Why category is `env` (Env Secret) in code but SPEC.md says "Other"

Not a deliberate research decision — this is drift between SPEC.md prose and the shipped
`TYPE_META` object. Documented as a discrepancy in spec.md Assumptions, not re-litigated here.
