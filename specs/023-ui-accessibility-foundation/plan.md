# Implementation Plan: UI Accessibility & Design-System Foundation

**Branch**: `023-ui-accessibility-foundation` (spec dir only; work on `develop`) | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-ui-accessibility-foundation/spec.md`

## Summary

Make every DevSuite page WCAG 2.1 AA and fully token-driven. The approach reuses the injection
pattern the Command Palette (022, SPEC §9.11) already established: `deps.py::_serve_html()`
injects one new stylesheet (`a11y.css`) and one new script (`a11y.js`) plus a skip-link anchor
into every served page, so the cross-cutting behaviors (focus ring, reduced motion, skip link,
live-region announcer, shared dialog behavior, 44px coarse-pointer targets) land on all 19 pages
with zero per-page edits. Per-file work covers what cannot be injected: contrast-safe token
values in `style.css`/`theme.js`, `<main>` landmarks on 8 pages, narrow-viewport breakpoints in 7
stylesheets, a type/spacing/radius token set, hex→token migration in 5 stylesheets, and the
mechanical rename that retires the legacy alias variables (including their per-theme overrides
in `theme.js`). No new libraries, no CSP change, no new inline script.

## Technical Context

**Language/Version**: Python 3.10+ (only `deps.py` injection + tests); vanilla ES2021+ JS and CSS

**Primary Dependencies**: none new. Existing: FastAPI, `static/theme.js`, `static/components.js`, `static/toast.css`

**Storage**: N/A (no DevDB change, no new store, no localStorage key beyond existing theme key)

**Testing**: `pytest tests/python/` (new `test_a11y.py`: injection, skip link, landmarks, token contrast for all 6 themes, no-hex lint, alias removal, reduced-motion rule, focus rule). `node tests/javascript/run.js` (new pure-function tests for contrast math and focus-trap order helpers extracted into a pure module if warranted). Headless-Chromium axe pass is a manual verification step (quickstart.md), not CI.

**Target Platform**: Local self-hosted web app; evergreen Chromium/Firefox/Safari

**Project Type**: Single-project web app (existing monolith)

**Performance Goals**: Injected CSS/JS < 10 KB combined gzipped-equivalent; no layout shift from the skip link (visually hidden until focused); dialog open adds no perceptible delay (<16 ms)

**Constraints**: Constitution Art. III (vanilla, no build), Art. V (no innerHTML w/ untrusted data, no new inline scripts, no CSP change), no emoji (existing `toast-close` uses a ✕ glyph — replaced with inline SVG), asset-order guard (`test_asset_order.py`) must keep passing, must not regress the Command Palette's own dialog handling

**Scale/Scope**: 19 HTML pages, 16 tool/shared stylesheets, `theme.js` (6 themes), `components.js`, `toast.css`, `deps.py`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — still PASS.*

**Core principles (I–VII):**

- **I. Spec First** — PASS. `spec.md` precedes code; `SPEC.md` §9 gains new subsections (§9.12 Accessibility contract, token tables, corrected §9.4) and §10 an a11y-testing subsection **before** implementation tasks that depend on them (task T-spec-first gates Phase 3+). The §9.4 radius discrepancy is flagged explicitly (research.md R-03) rather than silently resolved.
- **II. Local-Only, Offline-First** — PASS. No network paths added; no CDN.
- **III. Vanilla Stack, Single Store** — PASS. Plain CSS/JS only; no storage.
- **IV. Client-Side Encryption Boundary** — PASS/N-A. Vault/SSH dialogs get focus/ARIA behavior only; no change to key handling, no password written anywhere. The helper must never read or log input values.
- **V. DOM and CSP Hardening** — PASS. Announcer and dialog helper use `textContent`/attribute setters only. Injected assets are same-origin files; **no inline script** (skip link is an anchor, not a script). No CSP edit. Replaces the one emoji-like glyph in toasts with inline SVG (net improvement).
- **VI. Security Paths Require Tests** — PASS. No auth/CSRF/session/PBKDF2/AES-GCM/WS-gate/proxy code changes. The unlock dialogs are touched at the *presentation* layer only; tests assert unlock flows' DOM contracts (ids) are unchanged and the lock screens render the skip link pre-auth.
- **VII. Versioning Discipline** — PASS. One version bump at ship (deps.py, README badge, CHANGELOG heading, SPEC §1.3) — minor bump (UI-visible contrast/layout change). Cache-busting via `_serve_html()` fingerprints; no manual `?v=`.

**Spec & security baseline:**
- [x] `specs/SPEC.md` updated in the same commit series as shipped behavior (§9, §10, §3 file map, §1.3).
- [x] No new outbound network paths; no CDN assets.
- [x] Vanilla HTML/CSS/JS; no persistence added.
- [x] No Vault/SSH-blob/cookie-jar logic touched.
- [x] No `innerHTML` with untrusted data; no document CSP change; no new inline `<script>`.
- [x] No auth/session/rate-limit/crypto/WS-gate/proxy change (tests still added for DOM-contract preservation).
- [x] Version bump at ship across all four locations.
- [x] Static-analysis gates: plain DOM APIs; no `eval`; no new patterns that trip SonarCloud/CodeQL.

**New-tool / UI cross-cutting checklist:**
- [x] Tool count unchanged (15) — this is cross-cutting chrome, not a tool (like the palette).
- [x] UMD/RequireJS order unchanged: `a11y.js` is injected with `defer` before `</body>` and is not a UMD bundle; `test_asset_order.py` extended to assert it.
- [x] No scripting/eval feature; `script-sandbox-worker.js` and its scoped CSP untouched.
- [x] `routes/ssh.py` not touched.
- [x] Icons stroke-based inline SVG; no emoji; design tokens from `style.css`; theming via `theme.js`.
- [x] No third-party JS — SPEC §11 / `UPGRADE_PLAN.md` N/A.

No violations — Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/023-ui-accessibility-foundation/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-a11y-contract.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
devsuite/
├── deps.py                      # + inject a11y.css, a11y.js, skip-link anchor in _serve_html()
├── static/
│   ├── a11y.css                 # NEW — focus ring, skip link, reduced motion, coarse-pointer targets, sr-only, scrollbar tokens
│   ├── a11y.js                  # NEW — DevSuite.a11y: announce(), dialog behavior, main-id wiring
│   ├── style.css                # tokens: radius-xl/pill, type scale, spacing, text-safe colors; remove html/body overflow:hidden at narrow widths; alias retirement; hex→token
│   ├── theme.js                 # per-theme contrast-safe values; focus-ring token per theme; alias renames
│   ├── toast.css / components.js# role=status/alert, SVG close icon, reduced motion
│   ├── {vault,home,linter,api-tester}.css   # hex→token, breakpoints
│   ├── {notes,roadmap,sftp-browser,ssh-manager}.css # breakpoints
│   └── *.html (8 pages)         # <main> landmark: api-tester, home, notes, sftp-browser, ssh-manager, tools, vault, (db-manager lock screen)
├── tests/python/test_a11y.py            # NEW
├── tests/python/test_asset_order.py     # + a11y assets order assertions
├── tests/javascript/                    # + contrast-utils tests if pure module extracted
└── specs/SPEC.md                        # §9.4 fix, §9.12 new, §10 a11y testing, §3 file map, §1.3 version
```

**Structure Decision**: Same cross-cutting injection pattern as 022 (SPEC §9.11) — new pages
inherit everything automatically. Per-page edits are limited to landmark tags and to stylesheets
that need breakpoints/tokens.

## Complexity Tracking

*No violations — table intentionally empty.*
