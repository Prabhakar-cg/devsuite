# Tasks: Tool-Page Theming Unification

## Phase 1: Spec first
- [x] T001 Add SPEC §9.13 "Tool-page theme layer" from `contracts/theme-layer-contract.md`; file-map row; §10.5 note in `specs/SPEC.md`
## Phase 2: Foundation
- [x] T002 Create `static/theme-layer.css` with Hi-Contrast, iOS Glass and Light canonical-token blocks
- [x] T003 Inject `theme-layer.css` in `deps.py::_serve_html()` (first in `<head>`, idempotent) and extend `tests/python/test_a11y.py` injection test
- [x] T004 Extend `tests/python/a11y_tokens.py` to parse `theme-layer.css`; add canonical-token matrix (`--bg*` vs `--text*`, `--blue-text` etc., ≥7:1 for Hi-Contrast)
- [x] T005 `tests/python/test_theme_layer.py`: every themed variant defines every contract token; Hi-Contrast ≥7:1; guard that layer selectors out-specify `:root`
## Phase 3: US1/US2 Hi-Contrast, Light, iOS Glass
- [x] T006 [US1] Browser pass: Hi-Contrast on all tool pages; list remaining light surfaces and hard-coded colors
- [x] T007 [US1] Fix remaining hard-coded surfaces in tool stylesheets (tokenize) found in T006
- [x] T008 [US2] Browser pass for Light and iOS Glass; fix residuals
## Phase 4: US3 dark-default chrome
- [x] T009 [US3] Crypto Suite: dark canonical tokens for header/tabs/buttons/badges in `static/crypto.html` (page scope)
- [x] T010 [US3] DevDB Manager: muted/accent contrast and consistent chrome in `static/db-manager.css`
## Phase 5: US4 Home/Tools
- [x] T011 [US4] `--electric-solid` for filled controls (header CTA, active filter pill) per theme in `static/home.css`, `static/theme.js`
- [x] T012 [US4] Theme-aware tag-chip and live/soon badge text in `static/home.css`
## Phase 6: US5 polish
- [x] T013 [US5] Palette hint key caps in `static/command-palette.js` + `static/command-palette.css`
- [x] T014 [US5] Residual greys (empty-state icons, `span` secondary text, `.tool-accent`, `.line-badge`) tokenized
## Phase 7: Release
- [x] T015 Re-run full axe + screenshots; write `checklists/verification.md`
- [x] T016 Run both test suites; CHANGELOG 0.13.0; version bump in `deps.py`, README badge, CHANGELOG heading, SPEC §1.3
- [x] T017 Propose commit message (no direct commits)
