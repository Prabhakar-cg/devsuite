# Tasks: UI Accessibility & Design-System Foundation

**Input**: `specs/023-ui-accessibility-foundation/` (spec, plan, research, data-model, contracts/ui-a11y-contract.md, quickstart)

**Format**: `- [ ] T### [P?] [US#?] Description with file path` — `[P]` = parallelizable (different files).

**Tests**: Requested (Constitution Art. VI spirit + spec FR-022). Written in `tests/python/test_a11y.py`.

---

## Phase 1: Spec first (blocking — Constitution Art. I)

- [x] T001 Update `specs/SPEC.md` §9.4: define `--radius-xl`/`--radius-pill` as implemented; record the discrepancy as closed (research R-03)
- [x] T002 Add `specs/SPEC.md` §9.12 "Accessibility & Design-Token Contract" from `contracts/ui-a11y-contract.md` (injection, `DevSuite.a11y`, tokens, contrast matrix, page requirements, retired alias names)
- [x] T003 [P] Add `specs/SPEC.md` §10 a11y-testing subsection (automated checks + manual axe run) and §3 file-map rows for `static/a11y.css`, `static/a11y.js`, `tests/python/test_a11y.py`

## Phase 2: Foundational (blocks all stories)

- [x] T004 Create `static/a11y.css` skeleton: `.ds-sr-only`, `.ds-skip-link` (hidden until focused), `:focus-visible` ring, reduced-motion block, `(pointer:coarse)` 44px block, scrollbar token rules
- [x] T005 Create `static/a11y.js` skeleton exposing `DevSuite.a11y` (`announce`, `dialog.register`), `#ds-main` wiring; no inline script, `textContent` only
- [x] T006 Inject `a11y.css`, `a11y.js`, and skip-link anchor in `deps.py::_serve_html()` (CSS first in `<head>`, anchor after `<body>`, script before palette scripts, idempotent)
- [x] T007 Add tokens to `static/style.css` `:root`: `--radius-xl`, `--radius-pill`, type scale, spacing scale, `--focus-ring`, text-safe colors, scrollbar tokens, `--blue-glow`, `--blue-border`, `--shadow-inset`, `--surface-glass-*`
- [x] T008 Write `tests/python/test_a11y.py` scaffold + helpers: contrast-ratio function, theme token loader (parses `:root` in `style.css` and theme blocks in `static/theme.js`)
- [x] T009 Extend `tests/python/test_asset_order.py`: `a11y.js` injected before palette scripts, `a11y.css` present on all page routes

## Phase 3: US1 — Keyboard & screen-reader operability (P1)

**Independent test**: keyboard-only pass on any page (quickstart steps 2–4).

- [x] T010 [US1] Implement skip-link target + `<main>` discovery in `static/a11y.js` (assign `id="ds-main"`, `tabindex="-1"`)
- [x] T011 [P] [US1] Add `<main>` landmark to `static/api-tester.html`, `static/home.html`, `static/notes.html`, `static/sftp-browser.html`, `static/ssh-manager.html`, `static/tools.html`, `static/vault.html`, `static/db-manager.html` (convert primary container tag; keep ids/classes)
- [x] T012 [P] [US1] Give multiple `<nav>` regions distinct `aria-label` in `static/api-tester.html`, `static/home.html`, `static/tools.html`, `static/roadmap-doc-viewer.html`
- [x] T013 [US1] Implement announcer (polite + assertive regions, repeat re-announce, queue cap) in `static/a11y.js`
- [x] T014 [US1] Update `DevSuite.toast` in `static/components.js`: call `announce`, replace `✕` glyph with inline-SVG `<button aria-label="Dismiss notification">`; container `role="region" aria-label="Notifications"` set by `a11y.js`
- [x] T015 [P] [US1] Migrate inline toast functions in `static/base64.html`, `static/regex.html`, `static/crypto.html` to call `DevSuite.toast`/`announce` (net reduction of inline script, no additions)
- [x] T016 [P] [US1] Remove duplicate `aria-live` on `#toast-container` in `static/db-manager.html` (avoid double announcement)
- [x] T017 [US1] Implement shared dialog behavior in `static/a11y.js` (registry selectors, MutationObserver, role/aria-modal/name, focus move, Tab trap, Esc via close control, focus return, nested stack, non-dismissible lock screens, palette exclusion)
- [x] T018 [P] [US1] Mark dialog roots/close controls with `data-close`/accessible names where missing: `static/vault.html`, `static/ssh-manager.html`, `static/db-manager.html`, `static/api-tester.html`, `static/notes.html`, `static/sftp-browser.html`, `static/roadmap.html`
- [x] T019 [US1] Audit and fix every bare `outline:none/0` across `static/*.css` (keep only where a ≥3:1 `:focus-visible` replacement exists)
- [x] T020 [US1] Per-theme `--focus-ring` values in `static/theme.js` (≥3:1 vs each theme's surfaces)
- [x] T021 [US1] Tests in `tests/python/test_a11y.py`: skip link first in body on every page route; exactly one `<main>`; no bare `outline:none`; focus rule present; `toast.css`/`components.js` has no `✕`; lock screens (vault, ssh, db-manager) render skip link unauthenticated

## Phase 4: US2 — Legible text in every theme (P1)

**Independent test**: contrast matrix test passes for 6 themes.

- [x] T022 [US2] Compute failing pairs for all themes with the T008 helper; record in `research.md` appendix
- [x] T023 [US2] Fix `static/style.css` `:root`: darken `--text-muted`; add/use `--green-text`/`--amber-text`/`--red-text`/`--blue-text`
- [x] T024 [US2] Fix per-theme text tokens in `static/theme.js` for Noir, Midnight, Ocean, Solarized, Light, Hi-Contrast until matrix passes
- [x] T025 [P] [US2] Switch text usages of bright success/warning/danger hues to text-safe tokens in `static/toast.css`, `static/vault.css`, `static/linter.css`, `static/api-tester.css`, `static/cron.css`, `static/db-manager.css`
- [x] T026 [US2] Test: contrast matrix (contract §3) for all 6 themes in `tests/python/test_a11y.py`

## Phase 5: US3 — Responsive & zoom (P2)

**Independent test**: 320px and 200% zoom pass (quickstart step 5).

- [x] T027 [US3] `static/style.css`: ≤900px breakpoint — `html,body{height:auto;min-height:100dvh;overflow:auto}`, stack shared panes
- [x] T028 [P] [US3] Add narrow-viewport stacking rules in `static/api-tester.css`, `static/linter.css`, `static/notes.css`, `static/roadmap.css`, `static/sftp-browser.css`, `static/ssh-manager.css`
- [x] T029 [P] [US3] Verify/adjust existing breakpoints in `static/home.css`, `static/cron.css`, `static/db-manager.css`, `static/vault.css`, `static/id-generator.css`, `static/ws-tester.css`, `static/roadmap-doc-viewer.css`
- [x] T030 [US3] Coarse-pointer 44px rules finalized in `static/a11y.css`; fix icon-button sizes in tool CSS where they override
- [x] T031 [US3] Raise sub-12px UI font sizes to `--text-xs` and map remaining sizes to the type scale across `static/*.css` (excluding `xterm.css`, terminal output)
- [x] T032 [US3] Tests: every non-vendor stylesheet except `toast.css` contains an `@media` rule; a11y.css contains pointer:coarse block; no `font-size` below 0.75rem outside allowlist

## Phase 6: US4 — Token-driven consistency (P2)

**Independent test**: hex lint + alias lint pass; 6-theme smoke on Vault/Home/Linter/API Tester/Diff.

- [x] T033 [P] [US4] Replace hex colors with tokens in `static/vault.css`
- [x] T034 [P] [US4] Replace hex colors with tokens in `static/home.css`
- [x] T035 [P] [US4] Replace hex colors with tokens in `static/linter.css`
- [x] T036 [P] [US4] Replace hex colors with tokens in `static/api-tester.css`
- [x] T037 [US4] Replace hex colors in `static/style.css` outside `:root` (incl. scrollbar → tokens)
- [x] T038 [US4] Apply `--radius-xl`/`--radius-pill` to modals, lock cards, pills/badges, CTA buttons across `static/*.css`
- [x] T039 [US4] Delete the five zero-use aliases from `static/style.css` and `static/theme.js`. **Full alias rename deferred (research R-06)** — needs a rendered-browser pass; tracked as follow-up
- [x] T040 [US4] Tests: white/semantic hex lint per file; unused-alias lint across `static/`

## Phase 7: US5 — Reduced motion (P3)

- [x] T041 [US5] Finalize reduced-motion rules in `static/a11y.css` (animations, transitions, transforms, smooth scroll); keep cursor blink and `.ds-keep-motion`
- [x] T042 [P] [US5] Checked: remaining `!important` animation rules in `theme.js`/`home.css`/`toast.css` are `animation: none` (already reduced); the global reduced-motion block wins ties because it is `!important` and loaded first
- [x] T043 [US5] Test: reduced-motion block present and covers `animation`/`transition`/`transform`

## Phase 8: Polish & release

- [x] T044 Run `pytest tests/python/` and `node tests/javascript/run.js`; fix regressions
- [x] T045 With user approval to run the server: headless-Chromium smoke + ad-hoc axe across all pages and 6 themes (quickstart manual steps); record results in `specs/023-ui-accessibility-foundation/checklists/verification.md`
- [x] T046 Update docs per Constitution: `README.md`, `CHANGELOG.md` (section layout per SPEC §12.3), amend constitution Additional Constraints (a11y.css/js injection note) and `CLAUDE.md` Gotchas
- [x] T047 Version bump (minor) simultaneously in `deps.py` `APP_VERSION`, `README.md` badge, `CHANGELOG.md` heading, `specs/SPEC.md` §1.3
- [ ] T048 Propose commit message(s); wait for approval (no direct commits)

## Dependencies

- Phase 1 → Phase 2 → everything. T008 gates T022/T026/T040 tests.
- US1 and US2 independent after Phase 2. US3 depends on T004 (a11y.css). US4's T039 (alias retirement) depends on T033–T038 and **must run last among CSS tasks**. US5 depends on T004.
- T017 depends on T010, T013; T018 can run in parallel with T017.

## Parallel examples

- After Phase 2: T011, T012, T015, T016, T018, T025 are file-disjoint.
- US4: T033–T036 in parallel (four different stylesheets).

## Implementation strategy

MVP = Phases 1–4 (US1 + US2): all P1 blockers. Then US3 → US4 (alias retirement last, T039) → US5 → polish. Each phase leaves the suite green.
