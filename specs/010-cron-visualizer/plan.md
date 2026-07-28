# Implementation Plan: Cron Visualizer

**Branch**: `010-cron-visualizer` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-cron-visualizer/spec.md`

**Note**: Retroactive plan — the feature already shipped. This document records the as-built
architecture, per the same convention as `specs/001-devsuite-baseline/spec.md`.

## Summary

A fully client-side cron expression parser/visualizer covering four dialects (Unix, Quartz, AWS
EventBridge, GitHub Actions). `static/cron.js` implements a `CronParser` (dialect-aware
tokenizer/validator), `CronDescriber` (natural-language rendering), a bidirectional Visual Field
Builder, a brute-force minute-iteration next-run-times search, a 28-day activity heatmap, a
dialect-scoped preset library, and YAML/JSON export — all with zero backend calls beyond the
initial `GET /cron` page load.

## Technical Context

**Language/Version**: Vanilla ES JavaScript (no build step, no framework — SPEC.md §2)

**Primary Dependencies**: None beyond DevSuite's shared `style.css`/`theme.js` — no cron
libraries, no external date libraries.

**Storage**: N/A — no persistence; the tool holds no state across reloads.

**Testing**: No automated test coverage exists for `static/cron.js` today (not in
`tests/javascript/`'s pure-module suite, which currently covers only `curl-codegen.js` and
`cookie-jar.js`). Validated manually — see quickstart.md.

**Target Platform**: Any modern browser; runs entirely client-side.

**Project Type**: Static page + pure client-side logic module, following DevSuite's
single-backend/vanilla-frontend architecture (SPEC.md §3.1).

**Performance Goals**: Live re-validation on keystroke (debounced) must feel instant; the
next-10-runs brute-force search and 28-day heatmap must complete without perceptible UI lag for
typical (non-pathological) expressions.

**Constraints**: Zero backend dependency (FR-010) — the page route (`GET /cron`) is the only
server involvement. No `innerHTML` with dynamic content (constitution Art. V / SPEC.md §7.7 —
the file's own header comment states this explicitly).

**Scale/Scope**: One HTML page, one JS module (~1,140 lines), one CSS file; four dialect
definitions; no backend route beyond the page.

## Constitution Check

*GATE: evaluated retroactively against `.specify/memory/constitution.md` — **PASS**, verified
against current source; no violations found.*

**Core principles (I–VII):**

| Principle | Compliance |
|---|---|
| I Spec first | This retroactive spec now documents shipped behavior; SPEC.md §4.9 already covered it pre-conversion. PASS |
| II Verify against source | Written by reading `static/cron.js` directly (dialect definitions, preset library, controller class) rather than paraphrasing SPEC.md. No discrepancies found. PASS |
| III No undocumented behavior | The only route (`GET /cron`) is documented in SPEC.md §5.1 and this spec's contracts/http-api.md. No stores, no env vars, no security rules apply to this tool. PASS |
| IV Security tests for auth/session paths | N/A — this tool has no auth, no session, no server-side state; nothing in SPEC.md §10.2's required-coverage list applies to it. N/A |
| V Version bump protocol | N/A to this documentation-only conversion — no code/version change. N/A |

**Spec & security baseline**:
- [x] `specs/SPEC.md` already documents this tool (§4.9) — this per-tool spec adds detail, not
      new undocumented surface.
- [x] No outbound network paths — fully client-side, no CORS proxy, no SSH.
- [x] Vanilla HTML/CSS/JS, no frameworks, no build tools; no persistence at all (simpler than
      the DevDB-only constraint — there's nothing to persist).
- [x] N/A — no vault/SSH blobs, no master password involvement.
- [x] `static/cron.js`'s own header comment states "all DOM mutations use createElement +
      textContent, never innerHTML with user data" — spot-checked against the render methods.
- [x] N/A — no auth/CSRF/session/rate-limiting/crypto/WebSocket/CORS-proxy code in this tool.
- [x] No release/version change involved in this documentation-only conversion.
- [ ] Static-analysis gates — not re-run as part of this documentation task; SPEC.md §10.4 lists
      `cron.js:528` as an open S3776 complexity finding, unrelated to this spec's scope.

**New-tool / UI cross-cutting checklist**: N/A — retroactive spec for an existing tool, not a new
one; tool-count sync, icon conventions, etc. were satisfied when it originally shipped and are
covered by SPEC.md §9/§14 already.

## Project Structure

### Documentation (this feature)

```text
specs/010-cron-visualizer/
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── http-api.md      # Trivial contract — page route only, no backend API
└── tasks.md
```

### Source Code (repository root)

```text
routes/pages.py            # GET /cron → cron.html (page route only)

static/
├── cron.html               # Layout: input, status pill, field builder, next-runs, heatmap, presets, export
├── cron.js                 # DIALECTS, PRESETS, CronParser, CronDescriber, CronVisualizer controller
└── cron.css                # Tool-scoped styling
```

**Structure Decision**: Simplest tool in DevSuite structurally — one page route with zero
backend logic; all behavior lives in a single self-contained client-side module, consistent with
other zero-backend tools (JSON/YAML/Regex linters).

## Complexity Tracking

No constitutional violations — table not required.
