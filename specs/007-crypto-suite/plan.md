# Implementation Plan: Crypto Suite

**Branch**: `007-crypto-suite` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-crypto-suite/spec.md`

**Note**: This is a retroactive plan documenting the as-built architecture, not a proposal.

## Summary

A single static page (`static/crypto.html`, 1358 lines) with six tabs — Hash, AES, RSA, HMAC,
Base64, JWT Inspector — each backed by inline `<script>` functions. Cryptographic primitives are
sourced from two places: native **WebCrypto** (`crypto.subtle`) for SHA-1/256/512 digests, RSA-
OAEP keygen/encrypt/decrypt, and HMAC sign/verify/JWT-verify; and the vendored **CryptoJS**
(`crypto-js.min.js`) for MD5 (not available in WebCrypto) and AES encrypt/decrypt. All operations
run entirely client-side; the backend serves only the static page.

## Technical Context

**Language/Version**: Vanilla JS (ES2017+, async/await, `crypto.subtle`), no build step.

**Primary Dependencies**: `crypto-js.min.js` (vendored, `static/`) for MD5 and AES; native
`window.crypto.subtle` (WebCrypto, no dependency) for everything else; shared `linter.css` /
`theme.js`.

**Storage**: N/A — fully stateless. RSA keypairs live only in a page-scoped JS variable
(`rsaKeyPair`) for the session; nothing is persisted to DevDB or disk.

**Testing**: None automated for this tool's cryptographic logic. `tests/python/test_asset_order.py`
covers only the UMD-load-order hazard for `crypto-js.min.js` (must load before `require.min.js`
per CLAUDE.md gotchas), not correctness of any crypto operation. Manual validation only — see
[quickstart.md](quickstart.md).

**Target Platform**: Any modern browser with WebCrypto support, at `http://localhost:8000/crypto`.

**Performance Goals**: All operations (hash/AES/RSA-2048-or-4096 keygen/HMAC/JWT-verify)
complete well under a second for typical inputs; no explicit budget enforced.

**Constraints**: Offline-first (SPEC §1.1/§2) — zero network calls; no `innerHTML` with untrusted
content (verified: results are built via `document.createElement`/`textContent`, e.g.
`static/crypto.html:697-700` badge construction).

**Scale/Scope**: Single page, one route, six tabs, no backend endpoints, no DevDB store.

## Constitution Check

*GATE: evaluated retroactively against `.specify/memory/constitution.md` Art. I–VII — **PASS**
with one documentation debt noted below (not a code violation).*

**Core principles (I–VII):**

| Principle | Compliance |
|---|---|
| I Spec first | Retroactive migration; this spec now exists. **Debt**: SPEC.md §4.6 must be updated to list all six tabs (Base64, JWT) — tracked as a follow-up in the SPEC.md trim done alongside this spec-kit migration, not a code change. |
| II Verify against source | This spec was written by reading `static/crypto.html` directly; two discrepancies found (SPEC §4.6 tab count, AES ECB-mode mismatch) and flagged explicitly in spec.md rather than silently resolved. |
| III No undocumented behavior | Closing the gap found under Art. I is the point of this spec — all six tabs are now documented here even though SPEC.md's summary still needs its follow-up update. |
| IV Client-side crypto boundary | All key material (AES passphrases, RSA keypairs, HMAC secrets, JWT verify keys) stays in the browser; nothing is POSTed to the server — same boundary principle SPEC §7.5 applies to the Vault, applied here by the tool's own design even though this tool predates/is separate from the Vault. |
| V DOM XSS hardening | Verified: hash results and badges are built via `document.createElement` + `textContent`/`className`, not `innerHTML`, for all dynamic/untrusted content. |
| VI Security-critical tests | N/A per SPEC §10.2's defined list (auth/CSRF/session/rate-limit/PBKDF2/AES-GCM/CORS-proxy) — this tool's AES/RSA/HMAC are a general-purpose sandbox, not one of DevSuite's own security-critical paths, so no test-gate applies. Recommended (not required) for a future iteration: unit tests for round-trip correctness. |
| VII Version bump protocol | N/A to this spec-only change. |

**Spec & security baseline**:
- [x] `specs/SPEC.md` §4.6 currently under-documents this tool (4 of 6 tabs) — this retroactive
      spec.md is the authoritative detail; a follow-up SPEC.md edit (tracked outside this fork's
      scope) should expand §4.6 to match.
- [x] No new outbound network paths — zero network calls.
- [x] Vanilla HTML/CSS/JS, no frameworks/build tools.
- [x] N/A — no vault/SSH blob handling in this tool (it is a general crypto sandbox, not
      integrated with the Secret Vault).
- [x] No `innerHTML` with untrusted data (verified throughout).
- [x] N/A — no auth/CSRF/session/rate-limit/PBKDF2/AES-GCM/CORS-proxy code in this tool; its own
      AES/RSA/HMAC use is a general playground, distinct from DevSuite's own security-critical
      paths (SPEC §10.2), so no test requirement is triggered.
- [x] N/A to this documentation-only change.

**New-tool / UI cross-cutting checklist**: N/A — pre-existing tool, no tool-count, asset-order,
CSP, WebSocket, or icon changes made by this spec. (The existing `crypto-js.min.js` UMD-before-
`require.min.js` ordering rule already applies and is unaffected.)

## Project Structure

### Documentation (this feature)

```text
specs/007-crypto-suite/
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── http-api.md
├── checklists/
│   └── requirements.md
└── spec.md
```

### Source Code (repository root)

```text
routes/pages.py            # GET /crypto → _serve_html("crypto.html") (lines 61-64)
static/crypto.html         # Page, tab bar, six tab panels, inline <script> (1358 lines) — all logic here
static/linter.css          # Shared two-pane-style tool chrome
static/crypto-js.min.js    # Vendored — MD5 + AES (must load before require.min.js, CLAUDE.md gotcha)
static/theme.js            # Shared theme manager
```

**Structure Decision**: Single-file tool matching the pattern used by Base64/Regex (no dedicated
`.js` file); all six tabs' logic lives in one inline `<script>` block. No change proposed.

## Complexity Tracking

No constitutional violations — table not required. (The SPEC.md §4.6 under-documentation is a
docs debt, not a Constitution Check violation of the shipped code.)
