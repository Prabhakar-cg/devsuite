# Feature Specification: DevSuite Baseline (as-built v0.3.0)

**Feature Branch**: `001-devsuite-baseline`

**Created**: 2026-06-10

**Status**: Implemented (baseline conversion of the existing system)

**Input**: Migration of the pre-spec-kit master specification (`specs/SPEC.md` v0.3.0) into
the spec-kit structure. This document is the requirements-level baseline; **detailed
behavioral, API, storage, and design contracts remain in `specs/SPEC.md`** (referenced by
section throughout). New features get their own `specs/NNN-name/` directory via
`/speckit-specify`; durable contracts fold back into `specs/SPEC.md` on completion.

**Superseded (2026-07-28)**: each of the 12 tools named in User Story 1 below now has its own
retroactive spec-kit folder (`specs/002-diff-checker` … `specs/013-file-converter`) with the full
spec/plan/tasks/research/data-model/quickstart/contracts/checklists set. This document remains
the historical whole-system baseline; for tool-specific behavior, requirements, or task history,
use the tool's own folder instead. `specs/SPEC.md` §4 is the index.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Offline developer toolbox (Priority: P1)

A developer runs DevSuite locally (`localhost:8000`) and uses 12 tools — Diff, JSON
Linter, YAML Linter, Regex Tester, Base64/JWT, Crypto Suite, API Tester, SSH
Terminal, SFTP Browser, Cron Visualizer, Secret Vault, DevDB Manager, File
Converter — without any data leaving the machine for core features.

**Why this priority**: This is the product mission ("the toolkit that stays on your
machine"); every other story depends on the suite being locally served and offline-first.

**Independent Test**: Start the server with networking to external hosts blocked;
every tool except the CORS proxy and SSH/SFTP remains fully functional.

**Acceptance Scenarios**:

1. **Given** a fresh install, **When** the user opens `/tools`, **Then** 12 tool cards
   render with no CDN requests (fonts, JS, and editor assets load from `/static/`).
2. **Given** any tool page response, **When** headers are inspected, **Then** the
   security headers of SPEC §5.10 are present and the document CSP contains no
   `unsafe-eval`.

---

### User Story 2 - API Tester as daily driver (Priority: P1)

A developer builds, organizes, and runs HTTP request collections: nested folders,
environments, Postman/OpenAPI/cURL import, git-friendly zip export, a collection
runner with pre-request/test scripts in a sandboxed Web Worker, a session-scoped
cookie jar, and a local CORS proxy for cross-origin calls. (Detail: SPEC §4.7.)

**Why this priority**: Strategic flagship per SPEC §13 — the offline-first mission
meets the Bruno/Postman market wedge.

**Independent Test**: Import a Postman collection, run a folder via the runner, and
verify per-request test results and variable chaining without any cloud service.

**Acceptance Scenarios**:

1. **Given** a script that loops forever, **When** it runs, **Then** the sandbox
   worker is terminated at 10 s and the UI stays responsive (SPEC §4.7.1).
2. **Given** a proxied response with multiple `Set-Cookie` headers, **When** the next
   matching request is sent, **Then** the in-memory cookie jar attaches the cookies
   and never persists them (SPEC §4.7.5).
3. **Given** a proxy request targeting loopback or a cloud-metadata address, **When**
   it is dispatched (including via redirect), **Then** the server rejects it with
   HTTP 403 (SPEC §5.9).

---

### User Story 3 - Encrypted secrets and SSH workflows (Priority: P2)

A developer stores secrets in the Vault and SSH profiles in the SSH manager. Both
are encrypted in the browser with a master password; the backend stores opaque
blobs. Sessions are 8-hour cookie-based; Vault and DevDB Manager always re-prompt.

**Why this priority**: Highest-trust surface; correctness here is a security
property, but the suite is useful without it.

**Independent Test**: Create a vault entry, inspect server storage (`devdb.dsb` and
`/api/vault` traffic) and confirm only ciphertext is present; restart the browser
and confirm the master password is required again.

**Acceptance Scenarios**:

1. **Given** a configured master password, **When** a WebSocket connects without a
   valid `ds_session` cookie, **Then** it is closed with code 1008 before accept
   (SPEC §5.8, SEC-14).
2. **Given** a v1 (legacy) vault, **When** the user unlocks it, **Then** it is
   migrated in-browser to the v2 domain-separated key scheme (SPEC §7.5).
3. **Given** 6 auth attempts within 60 s from one IP, **When** the 6th arrives,
   **Then** the server returns HTTP 429 (SPEC §7.4).

---

### Edge Cases

- Pre-setup state: before a master password exists, WebSocket endpoints are
  deliberately open to preserve the no-password local-terminal flow (SPEC §5.8).
- UMD bundle ordering: `jszip.min.js` / `crypto-js.min.js` must load before
  `require.min.js` or RequireJS throws "Mismatched anonymous define()"
  (guarded by `tests/python/test_asset_order.py`).
- Uploads over limits (20 MB convert, 50 MB diff) are rejected by the backend.
- Unknown SSH host keys require explicit in-browser fingerprint approval within
  60 s (SPEC §5.8).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST serve all 12 tools from `localhost` with zero runtime CDN
  dependencies (SPEC §2, §3).
- **FR-002**: System MUST persist all data through DevDB (`.dsb` binary, SPEC §6);
  REST access is restricted to the allowed stores `vault`, `ssh_profiles`,
  `collections`, `app_prefs`.
- **FR-003**: Backend MUST treat vault and SSH-profile blobs as opaque ciphertext —
  no server-side decryption ever (SPEC §5.4, §7.5).
- **FR-004**: All mutating HTTP requests MUST carry a valid `X-CSRF-Token` matching
  the `ds_csrf` cookie, except the bootstrap endpoints `/api/auth/setup` and
  `/api/auth/session` (SPEC §7.3).
- **FR-005**: Session tokens MUST be stored server-side only as BLAKE2b-32 digests;
  cookies are `HttpOnly; SameSite=Strict; max_age=28800` (SPEC §7.2).
- **FR-006**: The CORS proxy MUST block loopback, link-local, multicast, and
  reserved targets — re-validating every redirect hop — while allowing LAN ranges
  (SPEC §5.9).
- **FR-007**: API Tester user scripts MUST execute only inside the dedicated
  sandbox worker with its scoped CSP, with a 10 s timeout (SPEC §4.7.1, §5.10).
- **FR-008**: Security-relevant events MUST be appended to the JSON-lines audit log
  with no secret values (SPEC §7.6).
- **FR-009**: Every release MUST bump the version simultaneously in `deps.py`,
  `README.md`, `CHANGELOG.md`, and `specs/SPEC.md` §1.3 (Constitution VII, SPEC §12).
- **FR-010**: All UI MUST follow the SPEC §9 design system (dual vocabulary, fixed
  fonts, semantic color tokens, no emoji in chrome, stroke-based SVG icons).

### Key Entities

- **DevDB store**: named JSON document inside the single `.dsb` file; plain or
  AES-256-GCM encrypted at rest (SPEC §6).
- **Vault blob / SSH-profiles blob**: client-encrypted ciphertext; keys derived
  from the master password via the v2 domain-separated PBKDF2 scheme (SPEC §7.5).
- **Collection**: API Tester request tree with `/`-separated folder paths, folder
  auth inheritance, and per-request scripts (SPEC §4.7.4).
- **Session**: 8-hour server-side entry mapping token digest → expiry, delivered
  as `ds_session` + `ds_csrf` cookie pair (SPEC §7.2–7.3).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `pytest tests/python/` passes (41 tests) covering every SPEC §10.2
  security-critical path; `node tests/javascript/run.js` passes for the pure modules.
- **SC-002**: With external networking disabled, all tools except the CORS proxy
  and SSH/SFTP work end-to-end.
- **SC-003**: No document response contains `unsafe-eval` in its CSP; only
  `/static/script-sandbox-worker.js` carries the scoped worker policy.
- **SC-004**: Static-analysis quality gate: Security Rating A, 0 unreviewed
  hotspots, 0 new violations (SPEC §10.3; known open findings tracked in §10.4).

## Assumptions

- DevSuite is a single-user, loopback-bound tool; multi-user and remote hosting
  are out of scope (`HOST` defaults to `127.0.0.1`).
- Browser/e2e (Playwright) coverage is deferred to v1.0.0 (SPEC §10.1).
- Known security debt is tracked, not hidden: SEC-11 (`unsafe-inline` → nonces,
  P2), SEC-12 (localhost HTTPS, P3), SEC-13 (Argon2id, P3), SEC-3 (CORS
  allowlist, XS) — see SPEC §7.8.
- The roadmap (SPEC §13) defines the next feature specs; each new item should be
  started with `/speckit-specify` rather than edited directly into this baseline.
