# Phase 0 Research: DevDB Manager

## R1 — Why always-ask auth instead of the shared 8-hour session cache

**Decision**: `db-manager.js` never imports `auth-guard.js`; `initLockScreen()` re-prompts on
every page load.

**Rationale**: Every other DevDB-backed tool (API Tester, SSH Terminal) caches an unlocked
session for 8 hours because their blast radius if left unlocked on a shared machine is "this
tool's data." DB Manager's blast radius is **the entire database** — export downloads everything,
import overwrites every store including `vault` and `ssh_profiles`. The always-ask model (shared
only with Vault) treats "can export/import everything" as equivalent in sensitivity to "can read
the Vault directly," which is a reasonable equivalence: DB Manager's export already contains the
Vault's encrypted contents.

**Alternatives considered** (inferred, not documented in code):
- *Reuse `auth-guard.js`'s 8h cache*: rejected implicitly — would mean a workstation left
  unlocked for up to 8 hours exposes a one-click full-database export.
- *Require re-entering the password only for export/import, cache for viewing*: not implemented;
  the simpler all-or-nothing model was chosen, consistent with Vault's own all-or-nothing lock
  screen.

## R2 — Why `renderStores()` uses `innerHTML` while Vault avoids it entirely

**Decision**: `db-manager.js`'s `renderStores()` builds each store card via a template-literal
`innerHTML` assignment (icon + label + size + count + optional lock badge).

**Rationale**: Every value interpolated is server-computed (formatted byte counts, static icon
markup, a label from a hardcoded `STORE_META` table) — none of it originates as free-form user
input the way a Vault entry's `title` or `notes` does. SPEC §7.7's rule targets *untrusted* data
specifically; this is judged compliant on that basis (see spec.md Assumptions), though flagged
in plan.md's Constitution Check with `[~]` rather than a clean pass, since it's a judgment call
rather than a mechanically-verifiable one.

## R3 — Why import merges per-store rather than replacing the whole database

**Decision**: `db_import` iterates `imported.list_stores()` and calls `deps._db.set_store()` per
name, rather than swapping the entire `DevDB` instance.

**Rationale**: A per-store merge means importing a `.dsb` that only contains, say, `collections`
(e.g. a teammate's exported collection set, re-packaged as a `.dsb`) does not wipe out the local
`vault`/`ssh_profiles`/`app_prefs` stores. This makes `.dsb` import safe to use for partial
restores, not just full-database disaster recovery — at the cost of the non-atomicity noted in
spec.md Assumptions.

## R4 — Why the DB file path is shown pre-authentication

**Decision**: `initLockScreen()` fetches `/api/db/meta` and displays `path` even before the user
enters the master password.

**Rationale**: A local filesystem path (e.g. `~/.devsuite/devdb.dsb`) is not secret — knowing
where the file lives grants no access without also having filesystem access to the machine
(which already implies far greater access than this UI could ever gate). Showing it pre-auth is
a debugging convenience with no meaningful security cost, unlike showing store *contents*, which
remain behind the lock screen.
