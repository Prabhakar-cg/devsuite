# Phase 0 Research: Learning Roadmap

## 1. CSRF cookie issuance for the unauthenticated tool tier

**Decision**: Mint the `ds_csrf` cookie for every visitor on their first request to the app,
not only after a successful `/api/auth/session` (master-password unlock). Concretely: a
lightweight check early in the middleware chain (or a dependency on the page routes) that, if
`request.cookies.get("ds_csrf")` is absent, generates a token via `secrets.token_urlsafe(32)`
(matching `routes/auth.py`'s existing token generation) and sets it via `response.set_cookie(...)`
with the same flags `routes/auth.py` already uses (`httponly=False`, `samesite="strict"`,
`secure=_HTTPS`). The existing `/api/auth/session` issuance path is left as-is (it still (re)sets
the cookie on unlock, which simply overwrites the same-named cookie with a freshly-scoped value —
harmless).

**Rationale**: Confirmed via `TestClient` that `/api/convert`, `/upload`, and `/api/proxy` — all
unauthenticated-tier, all mutating — currently 403 for any visitor who has never unlocked a
master password, because nothing ever sets `ds_csrf` for them. This is a pre-existing gap, not
something introduced by this feature, but Learning Roadmap's mutating routes
(`POST/PUT/PATCH/DELETE /api/roadmaps...`) would hit the identical wall if left unaddressed. The
double-submit-cookie pattern's security property (an attacker's cross-origin page can neither
read the victim's `ds_csrf` cookie nor get it attached to a forged request, because
`SameSite=strict` blocks the cookie on cross-site requests) does not depend on the cookie having
been minted specifically *after* authentication — it only depends on the cookie being
unguessable and the pairing check holding. Minting it unconditionally for every visitor is
standard practice for this pattern and does not weaken the protection Vault/SSH/Notes rely on;
those flows still additionally require a valid session for anything beyond the CSRF check
(`require_unlocked`), which is untouched.

**Alternatives considered**:
- *Scope the fix to Learning Roadmap only* (e.g. `GET /roadmap` sets the cookie for itself) —
  rejected: leaves the three pre-existing broken endpoints broken, and creates a second,
  narrower cookie-issuance code path alongside the general one, which is exactly the kind of
  inconsistency the constitution's security-baseline gate exists to prevent.
- *Gate roadmap mutations behind the master password* — rejected: directly reverses the spec's
  locked design decision that roadmap content is not sensitive and must not require unlocking
  the suite; would also leave the other three endpoints broken since it doesn't touch them.
- *Have the frontend generate its own CSRF token via `document.cookie` and send it as the header,
  entirely bypassing server issuance* — rejected: still a valid double-submit variant, but
  diverges from the existing `DevSuite.csrfToken()` helper's contract ("read the cookie the
  server wrote") that every other tool's JS already relies on; changing that contract has a much
  larger blast radius than fixing issuance server-side.

## 2. Storage: encrypted vs. plaintext DevDB store

**Decision**: The `roadmaps` DevDB store holds plain JSON (roadmap records as-is), not an
encrypted blob.

**Rationale**: Vault and Notes are encrypted client-side because their content is explicitly
sensitive and gated behind the master password; encryption there is meaningful because only an
unlocked session ever holds the derived key. Learning Roadmap has no master-password gate at
all (locked design decision — "roadmap content is not sensitive"), so there is no key material
to encrypt with, and introducing one purely to encrypt non-sensitive data would reintroduce the
exact friction (password prompt on every visit) the design decision explicitly rejects. DevDB
already supports storing plain per-store JSON (`get_store`/`set_store`) independent of the
container-level `.dsb` encryption, which is what every other unauthenticated-tier feature that
persists data would use, matching this store's own precedent.

**Alternatives considered**:
- *Encrypt anyway, with a fixed/derived-without-password key* — rejected: security theater
  (a key not gated by user secret provides no real confidentiality) and adds complexity with no
  benefit; also contradicts Art. IV's actual intent (encryption exists to protect a *secret*
  the backend must never see, not to obscure at-rest storage in general).

## 3. Step notes: markdown rendering vs. plain text in Monaco

**Decision**: Step notes are edited and stored as markdown text via a Monaco editor instance
(`DevSuite.initMonaco()`, `language: 'markdown'`), matching Notes Workspace's editor setup — but
unlike Notes Workspace, they are **not** additionally rendered to sanitized HTML for a "reading"
view in v1. The Monaco editor itself is the display surface.

**Rationale**: Notes Workspace needed a rendered HTML view (and therefore DOMPurify) because its
pages are the primary content surface of that tool. Learning Roadmap's notes are a secondary,
per-step annotation field; spec.md's FR-009 only requires notes to be editable and persisted, not
rendered as formatted HTML. Skipping HTML rendering entirely avoids introducing any new
sanitization surface (no new dependency, no XSS-review burden) while still giving the user a
familiar, syntax-aware markdown editing experience via the already-vendored Monaco. This can be
revisited in a future milestone (out of scope here) by reusing Notes Workspace's existing
DOMPurify + `marked` rendering path if a read-only rendered view is later wanted.

**Alternatives considered**:
- *Reuse Notes Workspace's `marked` + DOMPurify rendering for a read view* — rejected for v1:
  adds a second sanitization surface to review/test for a field the spec only requires be
  "editable and persisted," not "rendered." Revisitable later at zero schema cost (notes are
  already stored as markdown text either way).

## 4. Step identity and ordering

**Decision**: Steps are stored as a JSON array on the roadmap record (matches the schema in the
original request and spec.md's Key Entities), each carrying both an explicit `id` (slug, unique
within the roadmap) and an explicit `order` (integer). Route handlers sort by `order` before
returning/rendering; `PATCH` operations look up steps by `id`, never by array index.

**Rationale**: Directly satisfies FR-014 (explicit ordering independent of storage position) and
keeps step identity stable for anything that might reference a step id in the future (e.g. notes
cross-references), matching the ID-slug convention spec.md's Assumptions section calls out as
consistent with this repo's existing spec-kit ID conventions.

**Alternatives considered**: *Array index as identity* — rejected per the original request's
explicit rationale (reordering would silently break any reference into a step) and per FR-014.

## 5. Route module placement

**Decision**: New `routes/roadmap.py`, structurally mirroring `routes/storage.py` (simple
CRUD-shaped routes over a DevDB store, no session gate) rather than `routes/db.py` (raw
unrestricted store passthrough) or `routes/notes.py`-equivalent (session-gated blob storage).

**Rationale**: Learning Roadmap needs structured, validated operations (reject duplicate ids,
404 unknown roadmap/step/item, compute percentages on read) — a thin blob store (`db.py`'s
pattern) would push all of that validation into the frontend, which is inconsistent with how
every other structured-data tool (Vault entries, SSH profiles via `storage.py`) does it
server-side. No session gate is applied (`require_unlocked` is not used), matching the
locked "unauthenticated tier" decision — this is the one deliberate divergence from
`storage.py`'s existing routes, all of which currently sit behind `require_unlocked`.
