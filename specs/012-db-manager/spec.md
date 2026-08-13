# Feature Specification: DevDB Manager

**Feature Branch**: `012-db-manager`

**Created**: 2026-07-28

**Status**: Implemented (retroactive spec)

**Input**: Retroactive documentation of the already-shipped DevDB Manager tool (`/db-manager`),
written from `specs/SPEC.md` §4.11 / §5.3 / §6 and verification against `routes/db.py`,
`static/db-manager.js`, `static/db-manager.html`, `static/db-manager.css`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspect database health at a glance (Priority: P1)

An operator wants to know, at a glance, where the DevDB file lives, how big it is, whether it's
encrypted, and how much data each internal store holds — without opening a hex editor.

**Why this priority**: This is the tool's entire reason to exist — DevDB is otherwise an opaque
binary file with no other UI.

**Independent Test**: Unlock the manager and confirm the file path, size, encryption badge, and
per-store cards (Vault, Collections, SSH Profiles, App Preferences) all render with real values
from `GET /api/db/meta`.

**Acceptance Scenarios**:

1. **Given** an authenticated session, **When** `/db-manager` loads, **Then** the banner shows
   `path`, human-formatted `size` (B/KB/MB), `created`/`modified` timestamps, and a
   `v<meta.version>` tag.
2. **Given** the same load, **When** rendered, **Then** each of the four known stores (`vault`,
   `collections`, `ssh_profiles`, `app_prefs`) shows as a card with its size and, for
   non-encrypted stores, an entry count; encrypted stores (`vault`, `ssh_profiles`) show a lock
   icon **instead of** a count (their contents are opaque even in size-response form).
3. **Given** the database is currently password-protected, **When** the banner renders, **Then**
   the encryption badge reads "Server-Encrypted"; otherwise "Integrity-Checked".
4. **Given** the page has been open, **When** 30 seconds elapse, **Then** the metadata silently
   auto-refreshes (`setInterval(loadMeta, 30_000)`).

---

### User Story 2 - Export and import the entire database (Priority: P1)

An operator backs up the whole DevDB as a single `.dsb` file, and can restore/merge one back in.

**Why this priority**: Backup/restore is the primary operational function beyond passive
inspection — DevDB has no other backup mechanism.

**Independent Test**: Click Export — a `devdb-backup-<date>.dsb` file downloads; click Import
with a valid `.dsb` — its stores are merged into the running database and the banner refreshes.

**Acceptance Scenarios**:

1. **Given** the Export button, **When** clicked, **Then** `GET /api/db/export` streams the raw
   `.dsb` bytes and the browser downloads `devdb-backup-YYYY-MM-DD.dsb`.
2. **Given** a valid `.dsb` file selected via Import, **When** uploaded, **Then**
   `POST /api/db/import` parses it, merges only stores whose names are in `_ALLOWED_STORES` into
   the live database, saves, and reports `imported_stores` in a success toast.
3. **Given** a non-`.dsb` file is selected, **When** the file picker changes, **Then** the upload
   is rejected client-side with "Only .dsb files can be imported" before any request is sent.
4. **Given** an import file over 50 MB, **When** uploaded, **Then** the server rejects it with
   HTTP 413 before fully buffering it (`file.read(max_import_size + 1)` cap).
5. **Given** an invalid `.dsb` (bad magic/corrupt), **When** imported, **Then** the server returns
   HTTP 400 with a descriptive detail message, and the existing database is left untouched (the
   parse failure happens before any `set_store` call).

---

### User Story 3 - Browse individual store contents (Priority: P2)

An operator wants to see the raw JSON of a specific non-encrypted store (e.g. `collections`) to
debug data without going through the owning tool's UI.

**Why this priority**: Debugging aid — lower priority than backup/restore because it's a
read-only convenience, not a data-safety feature.

**Independent Test**: `GET /api/db/store/collections` returns the raw JSON currently held; a
request for an unknown store name is rejected.

**Acceptance Scenarios**:

1. **Given** a known store name (`vault`, `collections`, `ssh_profiles`, `app_prefs`), **When**
   `GET /api/db/store/{name}` is called, **Then** the raw store JSON is returned as-is (even for
   the two encrypted stores — the *ciphertext blob* is returned, not decrypted contents).
2. **Given** an unknown store name, **When** requested (`GET` or `POST`), **Then** the server
   responds HTTP 400 `"Unknown store: '<name>'"`.

---

### User Story 4 - Always-ask authentication (no session caching) (Priority: P1)

Unlike the API Tester or SSH Terminal (which cache the unlocked session for 8 hours,
`auth-guard.js`), DevDB Manager re-prompts for the master password on **every** page load,
because it can export/import the entire database — including every other tool's encrypted data.

**Why this priority**: This is a deliberate, security-motivated deviation from the rest of the
suite's auth model (SPEC §8) and is load-bearing for how much trust this tool is given.

**Independent Test**: Unlock the manager, reload the page — the lock screen reappears (no
`auth-guard.js` 8-hour cache is used); a session that has expired mid-use (401 from
`/api/db/meta`) re-locks the UI in place.

**Acceptance Scenarios**:

1. **Given** any prior successful unlock, **When** the page is reloaded, **Then** the lock
   overlay is shown again — `db-manager.js` does not load or use `auth-guard.js`.
2. **Given** no master password has ever been configured, **When** `/db-manager` loads, **Then**
   a "not set up" notice is shown instead of a password field, and no unlock attempt is possible.
3. **Given** an authenticated session that expires while the page is open, **When** the next
   `_authFetch('/api/db/meta')` returns 401, **Then** `_authenticated` is cleared, the lock
   overlay reappears, and a "Session expired. Please unlock again." toast is shown.

---

### User Story 5 - Change or remove the master password (Priority: P3)

An operator rotates the master password (or removes it entirely) from within DevDB Manager.

**Why this priority**: Infrequent administrative action; not part of the daily workflow.

**Independent Test**: Submit matching new passwords via the password modal — the challenge is
replaced and all existing sessions are invalidated; submitting an empty password removes
encryption of the *challenge* (does not itself re-encrypt other stores).

**Acceptance Scenarios**:

1. **Given** matching new-password fields, **When** submitted, **Then** a fresh salt is
   generated, a v1-format `{salt, verify_blob, verify_iv}` challenge is computed client-side with
   CryptoJS PBKDF2 (50,000 iterations) and POSTed to `/api/auth/update-challenge`.
2. **Given** mismatched password fields, **When** submitted, **Then** "Passwords do not match."
   is shown and nothing is sent.
3. **Given** the update succeeds, **When** the response returns, **Then** all active sessions are
   invalidated server-side (`_sessions.clear()` in `routes/auth.py`) — the operator must
   re-authenticate, including in the current tab.

---

### Edge Cases

- **Locked stores never leak size-implied secrets beyond byte count**: `vault`/`ssh_profiles`
  cards show a lock icon instead of an entry count (`storeEntryCount()` special-cases these two
  names), but their **byte size** is still shown — a deliberate, minor metadata exposure judged
  acceptable (ciphertext length is not considered sensitive here).
- **Refresh button** manually re-triggers `loadMeta()` independent of the 30s auto-refresh timer.
- **Import merge is per-store, not atomic across the whole import**: if store A imports
  successfully and store B's `set_store` call were to fail mid-loop, A's write would already be
  applied — see Assumptions.
- **DB path display is intentionally not treated as sensitive**: it is shown on the lock screen
  itself, before authentication, because it is a local filesystem path with no secret value.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST require master-password authentication on **every** page load of
  `/db-manager`, with no cross-page or cross-reload session cache (distinct from
  `auth-guard.js`'s 8-hour cache used elsewhere, SPEC §8).
- **FR-002**: The system MUST display, once authenticated: database file path, size, creation and
  modification timestamps, format version, and encryption status.
- **FR-003**: The system MUST list each `_ALLOWED_STORES` entry (`vault`, `collections`,
  `ssh_profiles`, `app_prefs`) with its byte size, and an entry count for non-encrypted stores
  only.
- **FR-004**: Users MUST be able to export the entire database as a downloadable `.dsb` file via
  `GET /api/db/export`.
- **FR-005**: Users MUST be able to import a `.dsb` file via `POST /api/db/import`; only files
  ≤ 50 MB are accepted; only stores present in `_ALLOWED_STORES` are merged into the live
  database.
- **FR-006**: Import MUST reject non-`.dsb` files client-side before any network request, and
  MUST reject malformed `.dsb` content server-side with HTTP 400.
- **FR-007**: Users MUST be able to read the raw JSON of any allowed store via
  `GET /api/db/store/{name}`; unknown store names MUST return HTTP 400.
- **FR-008**: The system MUST auto-refresh displayed metadata every 30 seconds while
  authenticated, and MUST support a manual Refresh action.
- **FR-009**: Users MUST be able to set, change, or remove the master password from this tool;
  changing it MUST invalidate all existing server-side sessions.
- **FR-010**: A 401 response from any authenticated call MUST re-lock the UI in place (clear
  `_authenticated`, show the lock overlay) rather than fail silently.
- **FR-011**: All dynamic content (store cards, banner) MUST be built via safe DOM APIs or
  `innerHTML` assignment of **author-controlled, non-user-data** strings only (store metadata
  values like size/path are server-computed, not raw user input) — see research.md R2 for why
  this differs from Vault's stricter `textContent`-only rule.

### Key Entities

- **DB Meta** (response of `GET /api/db/meta`): `{path, size, encrypted, stores: {name:
  {bytes, count|null}}, meta: {created, modified, app, version}}`.
- **Store Card** (client-derived from DB Meta + `STORE_META`): `{name, icon, label, locked,
  desc, bytes, count|null}`.
- **Import Result**: `{status: "ok", imported_stores: string[]}`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can determine database size, encryption status, and per-store
  breakdown within one authenticated page load, with no additional clicks.
- **SC-002**: A full export → import round-trip on the same machine restores all four store
  contents byte-for-byte (verified at the storage-engine level by
  `tests/python/test_devdb.py::test_save_then_reload_from_disk` and the encrypted-roundtrip
  tests, which exercise the same `DevDB.from_bytes`/`export_bytes` machinery this tool calls).
- **SC-003**: 100% of unlock attempts happen fresh per page load — zero session persistence
  across reloads (this is the tool's defining security property vs. the rest of the suite).
- **SC-004**: An oversized (>50 MB) or malformed import is rejected without ever partially
  corrupting the live database (parse-then-apply ordering in `routes/db.py::db_import`).

## Assumptions

- **Import is not transactionally atomic across stores**: `db_import` loops
  `for store_name in imported.list_stores(): deps._db.set_store(...)` and calls `deps._db.save()`
  once at the end. If the process crashed mid-loop (extremely unlikely — no I/O happens inside
  the loop itself, only in-memory dict mutation, with the single `save()` call being the only
  disk write), stores processed earlier in iteration order would be applied and later ones
  would not, until the crash. Treated as a theoretical edge case, not a practical one, since the
  loop body has no I/O or exception-prone operation per iteration.
- **Password-change writes only the v1 challenge shape** (`savePassword()` in `db-manager.js`
  sends `{salt, verify_blob, verify_iv}` with no `challenge_version`, which `routes/auth.py`
  defaults to `1`). **This is a real cross-tool discrepancy**: if a vault was previously upgraded
  to the v2 domain-separated-key scheme (`specs/011-secret-vault/spec.md` US6), changing the
  password via DB Manager silently downgrades the *authentication challenge* back to v1 — the
  vault's ciphertext itself remains v2/GCM until the next Vault unlock re-triggers its own
  auto-migration path (which re-registers a v2 challenge). Net effect: a brief window (until next
  Vault unlock) where the challenge is v1-shaped but the blob is v2-shaped; `_unlockVaultNormal`
  handles this combination correctly (it branches on the *vault blob's* version, not the
  challenge's), so no data-loss or lockout occurs, but it is worth fixing DB Manager to emit v2
  challenges to avoid the inconsistency window entirely. Flagged, not fixed, in this
  documentation-only spec.
- **`innerHTML` use in `renderStores()`** (`static/db-manager.js`) interpolates only
  server-computed values (`m.icon`, `m.label`, formatted byte counts, entry counts) — never a
  value that originated as free-form user input — so it is treated as compliant with the "no
  `innerHTML` with **untrusted** data" rule (SPEC §7.7), distinct from Vault's stricter
  all-`textContent` approach where entry titles/notes *are* user input.
