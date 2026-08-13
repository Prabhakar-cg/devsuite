# Quickstart & Validation: Secret Vault

How to exercise `/vault` manually and what automated coverage already exists.

## Setup

```bash
python main.py          # or ./start.sh — serves on http://127.0.0.1:8000
```

Open `http://127.0.0.1:8000/vault` in a browser.

## Manual validation (maps to spec user stories)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| US1 | First-time setup | Fresh DevDB → open `/vault` | "Create Master Password" form; password <8 chars or mismatched confirm is rejected client-side |
| US1 | Vault created | Submit valid password twice | Toast "Vault created and unlocked ✓"; empty entry list |
| US2 | Unlock | Reload page, enter correct password | Entry list (if any) renders after decrypt |
| US2 | Wrong password | Enter incorrect password | "❌ Incorrect password — cannot decrypt vault." or "Incorrect master password." depending on path |
| US2 | Add each category | New Secret → pick each of the 6 types → fill required field → Save | Entry appears at top of list, categorized correctly |
| US2 | Edit / Duplicate / Delete | Use detail-panel buttons | List and DevDB `vault` store update accordingly |
| US3 | Reveal + copy | Open a Password entry, click eye icon, click copy | Value shown in plaintext; toast "Password copied — cleared in 30s" |
| US3 | Clipboard clears | Copy a value, wait 31s, paste elsewhere | Paste yields nothing (clipboard was overwritten with `""`) |
| US4 | Filter | Click a sidebar category (e.g. "Env Secrets") | Only that type shown, count badge matches |
| US4 | Search | Type a substring of a title | List narrows; clearing search restores full list |
| US5 | Zero-knowledge check | `curl -s localhost:8000/api/vault -H "Cookie: ds_session=..."` (after auth) | Response contains only `encrypted_blob`/`iv`/`salt`/`version` — no plaintext, ever |
| US6 | v1→v2 migration | Seed a v1 vault (see `tests/python/test_vault_v2.py` fixtures for shape), unlock with correct password | Toast sequence: "Upgrading vault encryption…" → "Vault upgraded to AES-256-GCM ✓"; `version` field becomes `2` |
| Edge | Rate limit | Submit 6 wrong-password attempts within 60s | 6th shows "Too many attempts — please wait a minute and try again." |
| Edge | Auto-lock | Unlock, switch tabs (hide page) for >5 min, return | Vault re-locks — **only verified for the legacy v1 unlock path**; see spec.md Assumptions for the v2-session gap |

## Automated coverage that exists today

```bash
pytest tests/python/test_vault_v2.py       # v1/v2 challenge setup + session accept/reject
pytest tests/python/test_auth_session.py   # token hashing, expiry, rate limiting
pytest tests/python/test_devdb.py          # AES-256-GCM roundtrip at the storage-engine layer
pytest tests/python/test_csrf.py           # mutating requests require X-CSRF-Token
```

## Coverage gaps (honest accounting, not a to-do list for this spec)

- **No JavaScript unit tests exist for `vault.js`** — the pure crypto helpers
  (`_deriveMasterKeysV2`, `encryptVaultGCM`/`decryptVaultGCM`, `filteredEntries`,
  `subtitleFor`) are all unit-testable (no DOM dependency) but are not currently in
  `tests/javascript/`, unlike `curl-codegen.js`/`cookie-jar.js`/`collection-utils.js`. SPEC §10.1
  notes browser/e2e coverage generally remains a v1.0.0 deliverable.
- **The auto-lock v2 gap (research.md R-adjacent, spec.md Assumptions) has no regression test**
  either confirming or denying the behavior — a future test asserting "a v2-unlocked vault
  auto-locks after 5 minutes hidden" would either pass (disproving the concern) or fail
  (confirming it), and should be added before relying on this spec's Assumption.

## Acceptance gates

- Every FR in spec.md is exercised by at least one manual scenario above.
- SC-002 (no plaintext/`Kenc` server-side) is enforced by `test_vault_v2.py`'s assertion that
  `/api/auth/session` accepts `Kauth` and rejects `Kenc` (`test_v2_session_rejects_kenc`).
