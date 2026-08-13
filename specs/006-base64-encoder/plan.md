# Implementation Plan: Base64 Encoder / Decoder

**Branch**: `006-base64-encoder` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-base64-encoder/spec.md`

**Note**: This is a retroactive plan — the feature already shipped. It documents the as-built
architecture rather than proposing one.

## Summary

A single static page (`static/base64.html`) with an inline `<script>` implementing Base64
encode/decode (UTF-8 safe via `TextEncoder`/`TextDecoder`), a URL-safe mode toggle, a JWT
inspector (decode-only, no verification), and file/clipboard convenience actions. Zero backend
logic beyond serving the HTML (`GET /base64`).

## Technical Context

**Language/Version**: Vanilla JS (ES2017+: `TextEncoder`, `TextDecoder`, optional chaining not
required), served as a static asset — no build step (SPEC §2 "No frameworks").

**Primary Dependencies**: None beyond `static/theme.js` (theme toggle) and shared
`static/linter.css` (two-pane layout). No third-party JS library is used by this tool.

**Storage**: N/A — fully stateless, no DevDB store, no persistence of any kind.

**Testing**: None currently automated for this tool's logic (`tests/python/` and
`tests/javascript/` contain no base64.html-specific tests; `test_asset_order.py` only checks
`crypto-js.min.js`/`jszip.min.js` load order, unrelated). Manual validation only — see
[quickstart.md](quickstart.md).

**Target Platform**: Any modern browser reachable at `http://localhost:8000/base64`; no
platform-specific behavior.

**Project Type**: Static HTML/CSS/JS page served by the FastAPI backend (`routes/pages.py`).

**Performance Goals**: Encode/decode of typical clipboard-sized text (<1 MB) completes
synchronously with no perceptible delay; no explicit budget is enforced or needed.

**Constraints**: Offline-first (SPEC §1.1/§2) — zero network calls for any operation; no
`innerHTML` with untrusted content (SPEC §2, §7.7).

**Scale/Scope**: Single-page tool, one route, one HTML file, no backend endpoints.

## Constitution Check

*GATE: evaluated retroactively against `.specify/memory/constitution.md` Art. I–VII — **PASS**,
no violations found.*

**Core principles (I–VII):**

| Principle | Compliance |
|---|---|
| I Spec first | This spec is being added retroactively per the DevSuite spec-kit migration; going forward, changes to this tool update this spec.md first. |
| II Verify against source | This spec was written by reading `static/base64.html` directly; the one SPEC.md/§4.5 divergence found (JWT "verify server-side" UI copy) is flagged in spec.md FR-003 rather than silently resolved. |
| III No undocumented behavior | All behaviors in spec.md are sourced from the actual `<script>` block, not invented. |
| IV Security paths / client-side crypto | N/A — this tool performs no encryption; it is pure encoding, not a security-sensitive path per SPEC §10.2. |
| V DOM XSS hardening | JWT panels are set via `textContent`, not `innerHTML` (`static/base64.html:345-347`) — compliant with SPEC §7.7. |
| VI Security-critical tests | N/A — not a security-critical path (no auth/CSRF/session/PBKDF2/AES-GCM/rate-limit/CORS-proxy code here). |
| VII Version bump protocol | N/A to this spec-only change; standard bump protocol applies if base64.html behavior changes. |

**Spec & security baseline**:
- [x] `specs/SPEC.md` §4.5 already documents this tool at a summary level; this folder adds the
      detailed retroactive spec. No undocumented routes/stores/env vars — this tool has none.
- [x] No new outbound network paths — zero network calls of any kind.
- [x] Vanilla HTML/CSS/JS, no frameworks, no build tools.
- [x] N/A — no vault/SSH blob handling in this tool.
- [x] No `innerHTML` with untrusted data (verified: `textContent` used throughout).
- [x] N/A — no auth/CSRF/session/rate-limit/PBKDF2/AES-GCM/CORS-proxy code in this tool.
- [x] N/A to this documentation-only change; static-analysis gates unaffected.

**New-tool / UI cross-cutting checklist**: N/A — this is a pre-existing tool, not a new one; no
tool-count, asset-order, CSP, WebSocket, or icon changes are being made by this spec.

## Project Structure

### Documentation (this feature)

```text
specs/006-base64-encoder/
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
routes/pages.py            # GET /base64 → _serve_html("base64.html") (lines 55-58)
static/base64.html         # Page, inline <style>, and inline <script> (419 lines) — all logic here
static/linter.css          # Shared two-pane tool layout (also used by json/yaml/regex/crypto)
static/theme.js            # Shared theme manager (6 runtime themes)
```

**Structure Decision**: No dedicated JS file — all logic is inline in `base64.html`'s `<script>`
(an IIFE at line 196). This matches the module-to-file map in SPEC §3.4, which lists no separate
JS file for this tool. No change proposed; documented as-is.

## Complexity Tracking

No constitutional violations — table not required.
