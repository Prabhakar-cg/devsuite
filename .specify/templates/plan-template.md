# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]

**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]

**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]

**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]

**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]

**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]

**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]

**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]

**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Confirm this feature upholds every applicable principle in `.specify/memory/constitution.md`.
Record PASS/violation for each; a violation requires an entry in Complexity Tracking with a
documented justification.

**Core principles (I–VII):** _map each to how the feature complies (or N/A)._

**Spec & security baseline** (enforced continuously; violations of NON-NEGOTIABLE
principles block merge):
- [ ] `specs/SPEC.md` is updated **in the same commit** as any behavior/API/UI change;
      no undocumented routes, stores, env vars, or security rules (Art. I).
- [ ] No new outbound network paths beyond the user-initiated CORS proxy and SSH/SFTP;
      no CDN assets — fonts and third-party JS self-hosted under `/static/` (Art. II).
- [ ] Vanilla HTML/CSS/JS, no frameworks or build tools; all persistence via DevDB —
      no SQLite/Postgres/Redis (Art. III).
- [ ] Backend never decrypts vault/SSH blobs; master password never transmitted or
      stored; API Tester cookie jar stays in-memory only (Art. IV).
- [ ] No `innerHTML` with untrusted data; document responses never carry
      `unsafe-eval`; no new inline `<script>` tags (Art. V).
- [ ] Changes to auth/CSRF/sessions/rate-limiting/PBKDF2/AES-GCM/WebSocket gate/CORS
      proxy land **with tests** per SPEC §10.2 (Art. VI).
- [ ] Release path bumps `deps.py` `APP_VERSION`, README badge, CHANGELOG heading,
      and SPEC §1.3 together; cache busting stays automatic via `_serve_html()` (Art. VII).
- [ ] Static-analysis gates stay green: SonarCloud, CodeQL, CodeRabbit, Snyk —
      Security Rating A, 0 unreviewed hotspots, 0 new violations (SPEC §10.3).

**New-tool / UI cross-cutting checklist** (from CLAUDE.md gotchas — each item cost
rework before; confirm the plan bakes them in up front):
- [ ] Tool count stays in sync across `routes/pages.py`, `static/tools.html`,
      `static/home.html`, README, and SPEC; `tools.html` static filter counts match the
      DOM that `updateFilterCounts()` recomputes.
- [ ] Any UMD bundle (`jszip.min.js`, `crypto-js.min.js`, …) loads **before**
      `require.min.js`; `tests/python/test_asset_order.py` still passes.
- [ ] Scripting/eval features route through `static/script-sandbox-worker.js` and its
      scoped CSP — never widen the document CSP; renames update `_SANDBOX_WORKER_PATH`
      and `tests/python/test_csp.py`.
- [ ] Touching `routes/ssh.py` preserves the pre-setup WebSocket carve-out
      (`_ws_require_session` gates only once a master password exists, SEC-14).
- [ ] Icons are stroke-based inline SVG — no emoji in UI chrome (SPEC §9.8/§9.9);
      design tokens come from `static/style.css`, themes via `static/theme.js`.
- [ ] New third-party JS requires updating SPEC §11 **and** `UPGRADE_PLAN.md`.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
