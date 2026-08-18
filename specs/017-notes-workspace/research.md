# Phase 0 Research: Notes Workspace

All items below were resolved by reading the existing codebase rather than
guessing — DevSuite already has working, in-repo precedent for every piece
this feature needs. No item required external research; "alternatives
considered" reflects other in-repo patterns that were rejected in favor of
the one chosen.

## 1. Storage & encryption model

**Decision**: Add one new DevDB store, `"notes"`, holding a single encrypted
JSON blob shaped exactly like the existing `vault` store: `{encrypted_blob,
iv, salt, version: 2}`. Backend endpoints are a byte-for-byte mirror of
`GET/POST /api/vault` (`routes/storage.py`): `GET/POST /api/notes`, gated by
`require_unlocked`, calling `deps._db.get_store("notes")` /
`deps._db.set_store("notes", data)` — the server never sees plaintext.

**Rationale**: This is the exact pattern already used by Vault, API Tester
Collections, and SSH Profiles (`routes/storage.py`) — zero new backend
concepts, and it satisfies FR-021/FR-022 (encrypted, master-password gated,
matching Vault) by construction. `deps.py`'s `_ALLOWED_STORES` allowlist
(used by the generic DB Manager store browser, `routes/db.py`) must add
`"notes"` so DevDB Manager can list/backup/restore it like every other store
— this is required by Constitution Art. III ("all persistence goes through
DevDB") being genuinely honored end-to-end, not just for the write path.

**Alternatives considered**: A dedicated multi-key DevDB layout (one store
per notebook, or per page) was rejected — DevDB stores are coarse-grained
key→JSON blobs (`devdb.py`'s `get_store`/`set_store`), and every existing
encrypted feature (Vault, SSH profiles, Collections) already treats "all of
this feature's data" as one blob re-encrypted whole on every save. Splitting
notes across many stores would need a store-per-page scheme with no
established backup/restore/migration story, for no benefit at this scale
(SC-005 only requires responsiveness up to 500 pages, comfortably one JSON
document).

## 2. Client-side encryption scheme

**Decision**: Reuse Vault's **v2** WebCrypto scheme exactly
(`static/vault.js`, `_deriveMasterKeysV2`): PBKDF2-HMAC-SHA256 @ 310,000
iterations deriving a 512-bit root, split into `Kenc` (AES-256-GCM, notes
encryption, never leaves the browser) and `Kauth` (server session
authentication). Notes generates and stores its own random salt (alongside
its blob, like Vault does) — a different salt per store, deriving a
different `Kenc` per store even from the same password, exactly as Vault and
a hypothetical second encrypted store are already designed to coexist.

**Rationale**: This is DevSuite's current best-practice encryption scheme,
already in production for Vault. SSH Manager's profile encryption
(`static/ssh-manager.js`) still uses the older CryptoJS `AES.encrypt(str,
pwd)` path (a pre-v2 scheme, kept only for SSH's own backward compatibility)
— that is legacy, not the pattern to copy for a brand-new feature.

**Alternatives considered**: Copying SSH Manager's older CryptoJS scheme —
rejected, since Vault's v2 scheme is the codebase's own stated "current
scheme" (`vault.js` comment, line 70) and is objectively stronger
(SHA-256/310k vs SHA-1/50k).

## 3. Unlock UI / session integration

**Decision**: Use `static/auth-guard.js`'s existing `AuthGuard.init('Notes
Workspace')` for the unlock screen and 8-hour session, exactly as SSH
Manager and API Tester already do — not Vault's bespoke lock-overlay markup.
`AuthGuard.init()` resolves with the plaintext master password (held only in
an in-memory module variable, never `localStorage`/`sessionStorage`, per
Constitution Art. IV) when a master password is configured, or `null` when
none is set up yet (mirrors the "no master password configured" carve-out
SSH Manager already handles).

**Rationale**: `auth-guard.js` is the newer, shared, already-tested
component for this exact "gate a tool behind the shared master password"
need; reusing it avoids duplicating ~150 lines of bespoke lock-overlay HTML/
CSS/JS that Vault owns for its own historical reasons. Notes still performs
its *own* Kenc derivation + AES-GCM encrypt/decrypt locally (research item 2)
using the password `AuthGuard.init()` hands back — `auth-guard.js` only
establishes the server session (`Kauth`) and UI, it does not touch note
content encryption.

**Alternatives considered**: Duplicating Vault's own lock-overlay component —
rejected as needless duplication now that `auth-guard.js` exists and is
already proven across two tools.

## 4. Editor component (Notepad++-equivalent)

**Decision**: Reuse the already-vendored Monaco Editor (`static/libs/vs/`,
loaded via `static/libs/require.min.js`) in Markdown mode. The Markdown
language chunk is already vendored
(`static/libs/vs/markdown-C_rD0bIw.js`), so this adds **zero** new
third-party JavaScript. Monaco's built-in find/replace widget
(`Ctrl+F`/`Ctrl+H`) satisfies FR-017 directly; its own syntax highlighting
satisfies FR-005.

**Rationale**: Monaco is DevSuite's established code-editor component
(already used by API Tester, Diff Checker, Data Format Linter per
`SPEC.md §11.3`); the Markdown chunk being already present means this is a
same-day integration, not a new dependency to vet, vendor, and add to
`SPEC.md §11`/`UPGRADE_PLAN.md`.

**Alternatives considered**: A plain `<textarea>` with a lightweight custom
highlighter — rejected: throws away find/replace, undo/redo, and bracket/
list continuation behavior Monaco provides for free, for no real savings
(the dependency is already paid for elsewhere in the app).

## 5. Markdown preview rendering — sanitization gap

**Decision**: Reuse the already-vendored `marked.min.js` (v18.0.9, currently
used by File Converter) to render Markdown → HTML for the live/split
preview, but **vendor DOMPurify** (new dependency) to sanitize `marked`'s
output before it is ever inserted into the DOM. This is a genuinely new
third-party JS addition and must be recorded in `SPEC.md §11.3` and
`UPGRADE_PLAN.md` per the Constitution's "Additional Constraints", and
loaded in `notes.html`'s `<head>` **before** `require.min.js` — DOMPurify
ships a UMD build, and CLAUDE.md's asset-order gotcha (`jszip.min.js`/
`crypto-js.min.js` must precede RequireJS or "Mismatched anonymous define()"
kills every button on the page) applies to it exactly as it does to the
existing UMD bundles. `tests/python/test_asset_order.py` needs a new
assertion covering `/notes` and DOMPurify.

**Rationale**: `marked` v18 has no built-in sanitizer (the old `sanitize`
option was removed years ago; the project's own docs now recommend pairing
with DOMPurify) and nothing in the current codebase sanitizes its output —
File Converter's existing use never had to consider this because it never
existed as user-authored content that gets *re-rendered as live HTML on
every future page view*. Notes is exactly that: user types Markdown once,
and it is rendered to HTML **every time the page is reopened** — a classic
stored-XSS surface (`<img src=x onerror=...>` written into a page,
re-executing on every future open) unless the HTML is sanitized before
insertion. Constitution Art. V ("No `innerHTML` with untrusted data") makes
this a hard requirement, not a nice-to-have, and Notes' body content is
squarely "untrusted data" (it becomes untrusted the moment it can contain
raw HTML/script via Markdown's inline-HTML passthrough).

**Alternatives considered**: (a) Manually regex-stripping `<script>` tags —
rejected, well-known to be incomplete/bypassable (event handler attributes,
`javascript:` URLs, etc.). (b) Rendering preview via `textContent` only
(no HTML formatting) — rejected, defeats the entire point of a Markdown
preview pane (FR expects headings/lists/code blocks/emphasis to render
visually). (c) Configuring `marked` to disable raw HTML passthrough
(`marked.use({ ..., renderer })` overrides) — rejected as the sole
defense: still leaves Markdown-native vectors (`[x](javascript:alert(1))`
links, malformed attribute injection in edge-case parsing bugs) unhandled;
DOMPurify is the purpose-built, actively maintained tool for exactly this
job and is what `marked`'s own documentation now recommends.

## 6. Wiki-links, backlinks, tags, and search

**Decision**: All computed **client-side**, in-memory, over the already-
decrypted notes tree after unlock — never sent to or computed by the
backend (which never holds plaintext). On every tree mutation (page saved,
renamed, or deleted), rebuild a lightweight in-memory index: `title → pageId`
(for O(1) case-insensitive/trimmed link resolution — FR-008/FR-013), and
`pageId → Set<sourcePageId>` (the backlinks map — FR-010), derived by
scanning each page's Markdown body for `[[...]]` occurrences via a single
regex pass. Tags are extracted the same way via a `#word` regex pass over
each page's body (FR-014/FR-015). Full-text search (FR-016) is a linear
scan of in-memory page bodies for the workspace sizes in scope (up to ~500
pages per SC-005) — no separate search index/service, consistent with
Constitution Art. III (no external database) and the encryption boundary
(nothing to index server-side).

**Rationale**: The workspace scale target (SC-003/SC-005: 500 pages) is well
within what a synchronous in-memory scan handles in well under the stated
time budgets on any machine capable of running a browser tab — there is no
performance case for a persisted index at this scale, and building one would
either require server-side plaintext access (violates the encryption
boundary) or a second client-side persistence layer (violates "single
store").

**Alternatives considered**: A server-side search endpoint over stored notes
— rejected outright, requires backend plaintext access, a direct
Constitution Art. IV violation.

## 7. Autosave strategy

**Decision**: Debounce writes — after each edit, wait 800ms of inactivity,
then re-encrypt the whole notes tree and `POST /api/notes` (same
whole-blob-per-save pattern Vault and SSH profiles already use for their own
edits). A trailing save also fires on tab/page close and on explicit tab
switch, so no edit is lost to the debounce window.

**Rationale**: Matches FR-006 (no explicit save action) while avoiding a
network round-trip (and a full tree re-encryption) on every keystroke. No
existing shared debounce helper exists in the codebase
(`static/cron.js`/`static/xterm.js` each have their own local one for
unrelated purposes) — Notes adds a small local debounce function rather than
extracting a shared utility, consistent with the project's existing
per-tool-file convention (no shared "utils" module pattern currently exists
across tools).

## 8. Route, navigation, and tool-count integration

**Decision**: New route `GET /notes` in `routes/pages.py` serving
`static/notes.html`, following the exact pattern of every existing tool
route (`_serve_html("notes.html")`). Add a card to `static/tools.html`, sync
the tool count (11 → 12) across `static/tools.html`'s static filter counts,
`static/home.html`, `README.md`, and `SPEC.md §4`, per CLAUDE.md's explicit
"Gotchas" list and Constitution "Additional Constraints".

**Rationale**: This is a plain mechanical checklist item already documented
by the project for exactly this situation ("keep tool counts in sync when
adding or removing a tool") — no new decision required, just execution
discipline captured here so `/speckit-tasks` doesn't drop it.
