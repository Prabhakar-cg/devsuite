# DevSuite Constitution

> Source material: migrated from `CLAUDE.md` and `SPEC.md` §2/§7/§10/§12 on 2026-06-10.
> `SPEC.md` remains the detailed master specification; this constitution holds the
> non-negotiable principles that every spec, plan, and implementation must satisfy.

## Core Principles

### I. Spec First (NON-NEGOTIABLE)

`SPEC.md` is the single source of truth. Any change to behavior, API shape, UI, or
features updates the spec **before** implementation code. When spec and code disagree,
the discrepancy is flagged explicitly — never silently resolved. No undocumented
behavior: every route, endpoint, store, environment variable, auth contract, and
security rule must appear in `SPEC.md`, added in the same commit that introduces it.

### II. Local-Only, Offline-First

DevSuite lives on the user's machine. No cloud telemetry, no tracking, no external
data transmission for core features, no runtime CDN dependencies (fonts and all
third-party JS are self-hosted under `/static/`). The only sanctioned outbound
network paths are the user-initiated CORS proxy and SSH/SFTP connections, and both
must be labeled as not-strictly-offline in the UI and spec.

### III. Vanilla Stack, Single Store

Vanilla HTML/CSS/JS only — no frameworks (React, Vue, Svelte, Tailwind) and no build
tools. Backend is Python 3.10+ / FastAPI. All persistence goes through DevDB
(`.dsb` binary); no SQLite, PostgreSQL, Redis, or any external database.

### IV. Client-Side Encryption Boundary (NON-NEGOTIABLE)

Vault and SSH-profile blobs are encrypted in-browser. The backend is an opaque
store and **never** decrypts them. The master password is never transmitted,
never stored, and never written to `sessionStorage`/`localStorage`. The API Tester
cookie jar is in-memory only — never persisted to DevDB, `localStorage`, or disk.

### V. DOM and CSP Hardening

No `innerHTML` with untrusted data — dynamic content uses `createElement` +
`textContent`. CSP is enforced on every response; document responses must never
carry `unsafe-eval` (the script-sandbox worker is the single scoped exception, per
SPEC §5.10). Do not add new inline `<script>` tags (SEC-11 debt — do not worsen it).
No emoji in UI chrome; icons are stroke-based inline SVG (SPEC §9.8/§9.9).

### VI. Security Paths Require Tests (NON-NEGOTIABLE)

Any change to auth, CSRF, session tokens, rate limiting, PBKDF2, AES-GCM, the
WebSocket session gate, or the CORS proxy must land with a corresponding test in
`tests/python/` or `tests/javascript/`. The required coverage list is SPEC §10.2.

### VII. Versioning Discipline

On every release the version is bumped simultaneously in `deps.py` (`APP_VERSION`),
the `README.md` badge, the `CHANGELOG.md` heading, and `SPEC.md` §1.3. Changelog
follows Semantic Versioning with the section layout in SPEC §12.3. Cache busting is
automatic via `_serve_html()` — manual version query strings in HTML are forbidden.

## Additional Constraints

- Fonts load only via `@import '/static/libs/fonts.css'` — never from a CDN.
- New third-party JS libraries require updating `SPEC.md` §11 and `UPGRADE_PLAN.md`.
- The tool count (currently 12) is sourced from `routes/pages.py` + `static/tools.html`;
  README/SPEC/`tools.html`/`home.html` counts stay in sync.
- Design system rules (typography, color tokens, radii, motion, copy tone) are
  defined in SPEC §9 and are binding for all UI work.

## Development Workflow

- Spec-kit flow for new work: `/speckit-specify` → (optional `/speckit-clarify`) →
  `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Feature specs live in
  `specs/NNN-name/`; on completion their durable contracts are folded back into
  `SPEC.md` so it stays the single source of truth.
- Backend suite: `pytest tests/python/` (must pass). JS suite:
  `node tests/javascript/run.js` (zero dependencies). CI runs both via
  `.github/workflows/tests.yml`; run locally before claiming verification.
- No direct commits — propose the commit message and wait for approval.
- Static analysis gates: SonarCloud, CodeQL, CodeRabbit, Snyk. Target: Security
  Rating A, 0 unreviewed hotspots, 0 new violations (SPEC §10.3).

## Governance

This constitution supersedes ad-hoc practice. Amendments require updating this file,
`SPEC.md`, and `CLAUDE.md` together, with the change recorded in `CHANGELOG.md`.
All plans and code reviews verify compliance with the principles above; violations
of the NON-NEGOTIABLE principles block merge. Complexity beyond the vanilla-stack
baseline must be justified in the feature's plan.

**Version**: 1.0.0 | **Ratified**: 2026-06-10 | **Last Amended**: 2026-06-10
