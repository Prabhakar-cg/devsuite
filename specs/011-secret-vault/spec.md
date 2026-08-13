# Feature Specification: Secret Vault

**Feature Branch**: `011-secret-vault`

**Created**: 2026-07-28

**Status**: Implemented (retroactive spec)

**Input**: Retroactive documentation of the already-shipped Secret Vault tool (`/vault`), written
from `specs/SPEC.md` §4.10 / §5.2 / §5.4 / §6.4 / §7 and verification against `routes/auth.py`,
`routes/storage.py`, `static/vault.js`, `static/vault.html`, `static/vault.css`,
`static/components.js`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a master password and store a secret (Priority: P1)

A developer opens `/vault` for the first time. There is no master password yet, so they are
prompted to create one. Once created, they can add a secret (e.g. an API key) and it is saved.

**Why this priority**: Without this flow the tool has no reason to exist — it is the entire
onboarding path.

**Independent Test**: On a fresh DevDB (no `app_prefs.master_setup_done`), visiting `/vault`
shows the "create master password" form; submitting a password ≥ 8 characters (with matching
confirmation) creates the vault, unlocks it, and shows an empty secret list.

**Acceptance Scenarios**:

1. **Given** a fresh install, **When** the user opens `/vault`, **Then** the lock screen shows
   "Welcome to DevSuite! Create a master password…" with a confirm-password field.
2. **Given** the user enters two different values in Password/Confirm, **When** they submit,
   **Then** the error "Passwords do not match." is shown and no request is sent.
3. **Given** the user enters a password under 8 characters, **When** they submit, **Then** the
   error "Master password must be at least 8 characters." is shown.
4. **Given** valid matching passwords ≥ 8 chars, **When** the user submits, **Then**
   `POST /api/auth/setup` (challenge_version 2) and an initial empty `POST /api/vault` both
   succeed, the vault unlocks, and a "Vault created and unlocked ✓" toast appears.

---

### User Story 2 - Unlock and manage secrets across categories (Priority: P1)

A returning user enters their master password to unlock the vault, then adds, views, edits, and
deletes secrets across the six supported categories.

**Why this priority**: This is the tool's daily-use core loop.

**Independent Test**: With a vault already set up, entering the correct password unlocks it and
shows previously saved entries; entering a wrong password shows "Incorrect master password."
without unlocking.

**Acceptance Scenarios**:

1. **Given** an existing vault, **When** the user enters the correct master password, **Then**
   `GET /api/auth/challenge` → key derivation → `POST /api/auth/session` → `GET /api/vault` →
   client-side decrypt succeeds and the entry list renders.
2. **Given** the "New Secret" button, **When** the user picks a category (Password, Token, SSH
   Key, API Key, Env Secret, or Secure Note) and fills the required field(s), **Then** the entry
   is saved via `POST /api/vault` and appears at the top of the list.
3. **Given** an existing entry, **When** the user clicks Edit, changes a field, and saves,
   **Then** the entry is updated in place (matched by `id`) and re-persisted.
4. **Given** an existing entry, **When** the user clicks Delete and confirms, **Then** the entry
   is removed from the list and the vault is re-persisted.
5. **Given** an existing entry, **When** the user clicks Duplicate, **Then** a copy is inserted
   with `title + " (copy)"` and a new `id`.
6. **Given** each category's required field is left empty (e.g. Password's `password`, Token's
   `token`, SSH's `private_key`, API's `api_key`, Env's `varname`+`value`, Note's `content`),
   **When** the user tries to save, **Then** a toast names the missing field and nothing is sent.

---

### User Story 3 - Reveal, copy, and auto-clear secret values (Priority: P2)

A user viewing a secret's detail panel reveals a hidden field, copies it to the clipboard, and
the clipboard is cleared automatically after 30 seconds so it isn't left exposed.

**Why this priority**: Secrets exist to be used elsewhere; safe copy/reveal is the payoff moment,
and the auto-clear is a concrete anti-shoulder-surfing / anti-clipboard-leak guarantee.

**Independent Test**: Open a Password entry, click the reveal (eye) icon on the Password field —
it shows plaintext; click Copy — a toast reads "Password copied — cleared in 30s"; after 30s the
clipboard contains an empty string.

**Acceptance Scenarios**:

1. **Given** a secret field marked `secret: true`, **When** the user clicks the reveal button,
   **Then** the masked `••••••••••••` text is replaced by the real value; clicking again re-masks
   it.
2. **Given** any field's copy button, **When** clicked, **Then** `navigator.clipboard.writeText`
   is called with the raw value and a countdown toast is shown.
3. **Given** a value was copied, **When** 30 seconds elapse without a newer copy, **Then** the
   clipboard is overwritten with an empty string; copying a second value before 30s resets the
   timer (only the latest copy's timer fires).
4. **Given** a Password entry's `url` field, **When** the user clicks it, **Then** the URL opens
   in a new tab only if its scheme is `http`/`https` (scheme-validated via `new URL()` before
   `window.open`).

---

### User Story 4 - Filter and search secrets (Priority: P2)

A user with many secrets narrows the list by category or by typing a search term.

**Why this priority**: Usability at scale — without it the vault degrades as entries accumulate.

**Independent Test**: With entries across multiple categories, clicking a sidebar filter (e.g.
"SSH Keys") shows only that category with a live count; typing in the search box filters by
title/subtitle substring, case-insensitively.

**Acceptance Scenarios**:

1. **Given** the sidebar category filters (All, Password, Token, SSH Key, API Key, Env Secret,
   Secure Note), **When** one is clicked, **Then** only matching entries render and the sidebar
   badge counts stay accurate.
2. **Given** a search query, **When** typed, **Then** entries are filtered by case-insensitive
   substring match against `title` and the computed `subtitle`, and the selection is cleared.
3. **Given** no entries match, **When** the list is empty due to a search, **Then** an empty
   state reads `No results for "<query>"`; when empty with no search, it reads "No secrets yet."

---

### User Story 5 - Client-side-only encryption (zero-knowledge server) (Priority: P1)

The system guarantees the backend never has access to plaintext secrets or to the key that
decrypts them, satisfying the product's "stays on your machine" / zero-trust-of-server mission.

**Why this priority**: This is the constitutional guarantee (Art. IV) that makes the Vault
trustworthy; every other story depends on this holding.

**Independent Test**: Inspect `routes/auth.py` and `routes/storage.py` — confirm no vault
plaintext or `Kenc` ever appears server-side; only `Kauth` (a value that cannot decrypt the
vault) is sent for session verification.

**Acceptance Scenarios**:

1. **Given** the v2 scheme, **When** a master password is entered, **Then** the browser derives
   a 512-bit root via PBKDF2-HMAC-SHA256/310,000 iterations and splits it into `Kenc` (first 256
   bits, vault AES-256-GCM key, never transmitted) and `Kauth` (second 256 bits, sent as
   `key_hex` to `/api/auth/session`).
2. **Given** a compromised server that logs every `key_hex` value, **When** an attacker tries to
   decrypt a captured vault blob with it, **Then** decryption fails — `Kauth ≠ Kenc`.
3. **Given** `GET /api/vault` / `POST /api/vault`, **When** inspected, **Then** the handlers only
   read/write the opaque `encrypted_blob`/`iv`/`salt`/`version` fields via `deps._db.get_store` /
   `set_store` — no decryption call exists in the Python path.

---

### User Story 6 - Legacy vault migration (v1 → v2) (Priority: P3)

A vault created before the v2 domain-separated-key scheme existed is transparently upgraded to
v2 the first time its owner unlocks it, without losing any data.

**Why this priority**: Backward compatibility for existing installs; lower priority than the
day-to-day flows because it fires at most once per install.

**Independent Test**: Seed `app_prefs` with a v1 challenge (`challenge_version` absent) and a
`vault` store with a v1 (`version` absent → 1) CBC-encrypted blob; unlock with the correct
password and confirm the vault re-persists as `version: 2` GCM ciphertext with a v2 challenge,
while the decrypted entries are unchanged.

**Acceptance Scenarios**:

1. **Given** a v1 challenge + v1 vault blob, **When** the correct password is entered, **Then**
   `_unlockVaultNormal` decrypts with the legacy CryptoJS PBKDF2-SHA1/50k path, shows a
   "Upgrading vault encryption — please wait…" toast, re-derives v2 keys, calls
   `_registerSetupChallenge` (new v2 challenge) and `persistVault()` (re-encrypts as GCM), then
   toasts "Vault upgraded to AES-256-GCM ✓".
2. **Given** a vault exists but no challenge was ever registered (pre-challenge-era install),
   **When** the user enters their password, **Then** `_unlockSetupMigration` reads the blob via
   the unauthenticated `GET /api/vault/migrate` endpoint, verifies the password by attempting
   decryption, and proceeds through the same upgrade path.
3. **Given** migration fails after decrypt succeeds (e.g. a transient `/api/auth/setup` error),
   **When** this happens, **Then** the vault is still usable in-memory for the session (the
   entries decrypted successfully) and the upgrade silently retries on the next unlock — this is
   non-fatal by design (see Assumptions).
4. **Given** `master_setup_done` is already `true`, **When** `GET /api/vault/migrate` is called,
   **Then** the server returns HTTP 409 (migration endpoint is permanently disabled post-setup).

---

### User Story 7 - Export and restore an encrypted backup (Priority: P2)

A user wants a portable, disaster-recovery copy of their vault — independent of whole-DevDB
backups — that they can save externally and restore later, whether into the same install or a
fresh one protected by the same (or a different) master password.

**Why this priority**: Losing the DevDB file (disk failure, accidental deletion, machine
migration) currently means losing every secret with no recovery path; this closes that gap
without weakening the zero-knowledge guarantee (US5).

**Independent Test**: With an unlocked vault containing entries, click "Backup" — a `.json` file
downloads containing AES-256-GCM ciphertext (no plaintext). Click "Restore", pick that file,
enter the master password it was encrypted with, confirm — the vault's entries are replaced with
the backup's decrypted contents and re-persisted.

**Acceptance Scenarios**:

1. **Given** an unlocked vault, **When** the user clicks "Backup", **Then** the client
   re-encrypts the current in-memory `vaultEntries` with the session's `masterKenc` (no server
   round-trip) and downloads `devsuite-vault-backup-<date>.json` containing
   `{app: "devsuite-vault-backup", backup_version: 1, exported_at, vault: {encrypted_blob, iv,
   salt, version: 2}}`.
2. **Given** the downloaded file, **When** inspected, **Then** it contains no plaintext secret
   data — only opaque ciphertext plus the salt/IV needed to re-derive the key from a password.
3. **Given** an unlocked vault, **When** the user clicks "Restore" and selects a file, **Then** a
   modal asks for the master password the backup was encrypted with and warns that continuing
   replaces every entry currently in the vault.
4. **Given** the correct backup password, **When** the user confirms, **Then** the client derives
   `Kenc` from that password + the backup's embedded salt (WebCrypto PBKDF2-SHA256/310k, matching
   US5), decrypts the backup's ciphertext, replaces `vaultEntries`, and calls `persistVault()` —
   which re-encrypts under the *current* session's `masterKenc` and saves via the existing
   `POST /api/vault`. A backup restored under a different current master password is therefore
   transparently re-encrypted to match it.
5. **Given** an incorrect backup password or a corrupted/foreign file, **When** the user confirms,
   **Then** decryption fails and the modal shows "Incorrect backup password, or the file is
   corrupted." without altering the current vault.
6. **Given** a file that isn't a DevSuite vault backup (wrong `app` field, or missing
   `vault.encrypted_blob`/`iv`/`salt`), **When** selected, **Then** the modal shows "Not a valid
   DevSuite vault backup file." and the Restore button stays disabled.
7. **Given** the vault is locked, **When** the page renders, **Then** the Backup/Restore controls
   are unreachable — they sit in the header behind the always-on lock overlay (US1/FR-001), so
   restoring requires unlocking first; there is no pre-setup restore path in this version (see
   Assumptions).

---

### Edge Cases

- **Auto-lock after inactivity**: if the page is hidden (tab switched/minimized) for more than 5
  minutes while unlocked (v1 `masterKey` set), the vault auto-locks and clears in-memory key
  material on visibility return — **note**: `onVisibilityChange` only checks `masterKey` (the v1
  variable), not `masterKenc`; see Assumptions for whether this is a real gap.
- **Session expiry mid-use**: a 401 from `/api/vault` mid-session is surfaced as "Session could
  not be established — please reload and try again." rather than a silent failure.
- **Rate limiting**: `/api/auth/challenge` and `/api/auth/session` are limited to 5 requests/min
  per IP; a 6th attempt returns 429, surfaced as "Too many attempts — please wait a minute…".
- **Empty password removal via DB Manager**: `routes/auth.py`'s `update-challenge` endpoint is
  also reachable from the DB Manager's "Change Password" flow (§012), which writes **v1-only**
  challenge fields — see Assumptions for the cross-tool implication.
- **XSS hardening**: all entry fields render via `textContent`/`createElement`, never
  `innerHTML`, with one narrow exception (`modEl.innerHTML` for a static, non-user-data SVG
  clock icon and reveal/copy button SVGs) — consistent with SPEC §7.7.
- **URL field click-through**: non-`http(s)` schemes (e.g. `javascript:`) are silently ignored,
  not opened.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST show a lock screen on every visit to `/vault` — there is no
  session-cached bypass (unlike the API Tester / SSH Terminal, SPEC §8).
- **FR-002**: The system MUST support first-time master-password creation (min. 8 characters,
  confirmation match required) when no password is configured.
- **FR-003**: The system MUST derive all cryptographic keys client-side from the master password
  and never transmit the password itself.
- **FR-004**: The system MUST use the v2 domain-separated key scheme (PBKDF2-HMAC-SHA256,
  310,000 iterations → 512-bit root → `Kenc`/`Kauth` halves) for all new vaults and upgrades.
- **FR-005**: The system MUST encrypt the vault contents with AES-256-GCM using `Kenc`, and MUST
  send only `Kauth` to the server for session verification.
- **FR-006**: The backend MUST treat vault blobs as opaque — `routes/storage.py`'s `/api/vault`
  handlers perform no decryption.
- **FR-007**: Users MUST be able to create, read, update, and delete secret entries across six
  categories: Password, Token, SSH Key, API Key, Env Secret, Secure Note.
- **FR-008**: Each category MUST enforce its required field(s) client-side before allowing a save
  (Password→password, Token→token, SSH→private_key, API→api_key, Env→varname+value,
  Note→content).
- **FR-009**: The system MUST support duplicate and delete (with confirmation) per entry.
- **FR-010**: Secret-valued fields MUST render masked by default with an explicit reveal toggle
  per field.
- **FR-011**: Copying a value to the clipboard MUST show a 30-second countdown notice and MUST
  clear the clipboard automatically after 30 seconds.
- **FR-012**: Users MUST be able to filter the entry list by category and by a live text search
  over title/subtitle.
- **FR-013**: The system MUST auto-lock (clear in-memory keys, show the lock screen) after the
  page has been hidden for more than 5 minutes.
- **FR-014**: The system MUST detect and transparently migrate legacy v1 vaults (CryptoJS
  PBKDF2-SHA1/50k, AES-CBC) to the v2 scheme on next successful unlock, without data loss.
- **FR-015**: The one-time migration-read endpoint (`GET /api/vault/migrate`) MUST become
  permanently unavailable (HTTP 409) once `POST /api/auth/setup` has been called.
- **FR-016**: All dynamic secret content MUST render via `textContent`/`createElement`, never
  `innerHTML` with untrusted data (SPEC §7.7).
- **FR-017**: An unlocked vault MUST be able to export a JSON backup file containing only
  AES-256-GCM ciphertext plus its salt/IV — never plaintext secrets — built entirely client-side
  with no new server endpoint (reuses the existing opaque `POST /api/vault` shape).
- **FR-018**: An unlocked vault MUST be able to restore from such a backup file by deriving the
  decryption key from a user-supplied password and the backup's embedded salt (same v2 KDF as
  US5/FR-004), then re-persist the recovered entries under the current session's key via the
  existing `POST /api/vault`. An incorrect password or malformed file MUST leave the current
  vault unchanged.

### Key Entities

- **Secret Entry**: `{id, type, title, modified, ...type-specific fields}` — decrypted,
  in-memory-only on the client. Type-specific fields: Password
  (`username?, password, url?, notes?`), Token (`service?, token, expiry?, environment?, notes?`),
  SSH Key (`host?, username?, private_key, passphrase?, notes?`), API Key
  (`service?, api_key, environment?, notes?`), Env Secret (`varname, value, notes?`), Secure Note
  (`content`).
- **Vault Blob** (server-visible, opaque): `{encrypted_blob, iv, salt, version}` stored in the
  DevDB `vault` store (SPEC §6.4); `version: 2` = AES-256-GCM, absent/`1` = legacy AES-CBC.
- **Master-Password Challenge** (in `app_prefs`): `{master_setup_done, master_salt,
  master_verify_blob, master_verify_nonce (v2) | master_verify_iv (v1), challenge_version}`.
- **Backup File**: `{app: "devsuite-vault-backup", backup_version, exported_at, vault:
  {encrypted_blob, iv, salt, version}}` — a plaintext JSON envelope around a still-encrypted,
  opaque vault blob; decryptable only with the master password used at export time. Downloaded
  client-side, never uploaded anywhere by the app itself.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from "no vault" to "first secret saved" in under 60 seconds of
  interaction (create password → unlock → New Secret → save).
- **SC-002**: 100% of vault plaintext and the `Kenc` key never appear in any server-side log,
  request body, or response body — verified by `tests/python/test_vault_v2.py` asserting the
  server only ever handles `Kauth`.
- **SC-003**: Every one of the 6 secret categories can be created, edited, and deleted without a
  page reload.
- **SC-004**: A copied secret is unrecoverable from the clipboard within 31 seconds of the copy
  action (30s timer + execution slack).
- **SC-005**: A v1 vault unlocks correctly and is re-encrypted as v2 on the very next unlock,
  with zero entries lost (byte-for-byte JSON round-trip of the decrypted array).
- **SC-006**: A vault backup exported from one install restores into any DevSuite install (same
  or different current master password) with zero entries lost — a byte-for-byte JSON round-trip
  of the entries array — provided the correct backup password is supplied.

## Assumptions

- **"Other" category named in SPEC.md §4.10 does not exist in code** — the implemented
  categories are Password, Token, SSH Key, API Key, **Env Secret**, Secure Note (`TYPE_META` in
  `static/vault.js:36-43`). "Env Secret" is not mentioned in SPEC.md §4.10 at all. **This is a
  spec/code discrepancy** (CLAUDE.md rule 2): SPEC.md should be corrected to list the six actual
  categories rather than a generic "Other" that has no corresponding type key, form fields, or
  icon in the implementation.
- **Auto-lock's `masterKey`-only check is presumed intentional for v1-compat, not a v2 gap**: the
  visibility-change handler (`onVisibilityChange`) tests `if (masterKey)` — the legacy v1
  variable — before auto-locking. Because `lockVault()` unconditionally clears both `masterKey`
  and `masterKenc`/`masterKauth` regardless of which path is set, and a v2-unlocked session never
  populates `masterKey`, **a v2-only session's auto-lock does not currently fire** (the condition
  is always false once fully migrated to v2). This looks like a latent bug introduced when v2 was
  added on top of v1 code; flagged here as a discrepancy between the documented behavior ("Lock
  screen on every visit" + implied session hygiene) and observed code, not fixed in this
  retroactive spec.
- **Cross-tool coupling with DB Manager's password-change flow**: `routes/auth.py`'s
  `/api/auth/update-challenge` is shared between Vault's own (nonexistent — Vault has no
  in-tool "change password" UI) and DB Manager's `savePassword()` (`static/db-manager.js`),
  which only ever sends `{salt, verify_blob, verify_iv}` (v1 shape, no `challenge_version`,
  defaulting server-side to `1`). Changing the master password via DB Manager therefore
  **downgrades an existing v2 vault's challenge to v1**, though the vault's *ciphertext* stays
  GCM/v2 until the next unlock's auto-migration re-registers a v2 challenge. See `specs/012-db-manager/spec.md` Assumptions for the DB-Manager-side note.
- Non-fatal migration-retry design (US6 scenario 3) is treated as intentional: the code comment
  says "Non-fatal: vault is decrypted in memory; migration can retry on next unlock" — this spec
  takes that at face value rather than flagging it as a defect.
- **No pre-setup restore path (US7)**: the Backup/Restore header controls sit behind the
  always-on lock overlay (FR-001), and restore reuses `persistVault()` / `encryptVaultGCM()`,
  which require an active `masterKenc`. Restoring a backup into a wiped/fresh install therefore
  requires completing normal master-password setup first, then restoring from the unlocked
  vault — there is no "restore during onboarding" shortcut. This is an intentional v1 scope
  boundary for the feature, not a defect.
