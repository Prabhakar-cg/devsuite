# Research: UI Accessibility & Design-System Foundation

All items resolved; no NEEDS CLARIFICATION remain.

## R-01 — Delivery mechanism for cross-cutting behavior
- **Decision**: Inject `a11y.css`, `a11y.js` and a skip-link anchor from `deps.py::_serve_html()`, exactly as feature 022 injects the palette.
- **Rationale**: One edit reaches all 19 pages and every future page; proven pattern (SPEC §9.11); fingerprinted for cache-busting; no inline script so CSP is untouched.
- **Alternatives**: Edit every HTML file (19 edits, drift-prone); put it in `style.css`/`components.js` (not all pages load both — `db-manager.html` loads neither).

## R-02 — Dialog behavior: helper vs. native `<dialog>`
- **Decision**: `a11y.js` provides a shared behavior applied to both native `<dialog>` elements (api-tester, db-manager) and `div`-based overlays (`.modal-overlay`, `.db-lock-overlay`, vault/ssh lock cards). It observes visibility changes (open attribute, `display`, class) with one `MutationObserver`, then: sets `role="dialog"`/`aria-modal="true"`/accessible name (from existing heading via `aria-labelledby`, else `aria-label`), saves `document.activeElement`, focuses first focusable (or the dialog), traps Tab/Shift+Tab, closes via the existing close control on Esc (never forcibly hides), and restores focus on hide.
- **Rationale**: Existing dialogs are toggled by tool-specific code; observing visibility avoids rewriting every tool script and avoids changing data flow.
- **Alternatives**: Convert all overlays to `<dialog>.showModal()` (invasive, touches security-sensitive unlock flows, violates "no behavior change"); per-tool trap code (duplication).
- **Guard**: Esc must call the dialog's existing close/cancel control; lock screens that cannot be dismissed (pre-unlock) are marked non-dismissible and Esc is ignored. Never read/log input values. The Command Palette is excluded via its own root attribute (it already manages focus).

## R-03 — Radius token discrepancy (flag, don't silently pick)
- **Finding**: SPEC §9.4 documents `--radius-xl` (16px) and `--radius-pill` (980px); neither is defined in any stylesheet. Code defines only `--radius` (14), `--radius-sm` (10), `--radius-xs` (7).
- **Decision**: Treat SPEC §9.4 as the intended contract; define both tokens in `style.css` and migrate ad-hoc 16px/980px/999px usages. Update §9.4 to record the implemented values and that this closes the discrepancy.

## R-04 — Contrast values
- **Finding** (computed against white `#ffffff`): `--text-muted #86868b` ≈ 3.5:1; `--green #28cd41` ≈ 2.1:1; `--amber #ff9f0a` ≈ 2.1:1; `--red #ff3b30` ≈ 3.6:1. Existing `--green-mid #1a9c2a` ≈ 3.5:1 and `--amber-mid #b45309` ≈ 5.0:1 (toast text colors).
- **Decision**: Add text-safe tokens (`--text-muted` → ≥4.5:1, e.g. `#6e6e73`; `--green-text`, `--amber-text`, `--red-text` ≥4.5:1 on their surfaces) and use them wherever those hues render as text; fills keep bright hues. Verify every text/surface pairing for all 6 themes with a computed test (not eyeballed) — the pairing list is the contract in `contracts/ui-a11y-contract.md`.
- **Dark themes**: `theme.js` sets `--text-muted` per theme (e.g. `#a0a0a0` on `#000` high-contrast is fine ~8:1; Noir/Midnight/Ocean/Solarized need computing — Solarized base `#586e75`-class values commonly fail 4.5:1).

## R-05 — Responsive strategy for the app shell
- **Finding**: `html, body { height:100%; overflow:hidden; display:flex; flex-direction:column }` makes tool pages fixed-viewport app shells (editor panes flex to fill). Seven stylesheets have no `@media` rules.
- **Decision**: Keep the fixed-viewport shell on wide viewports (editors/terminals need it). Below a breakpoint (≤ 900px width, which is also what 200% zoom on a 1280px screen produces) switch `html, body` to `height:auto; min-height:100dvh; overflow:auto` and let multi-pane layouts stack (`flex-direction:column`, panes get a `min-height`). One shared pattern in `style.css`; tool stylesheets add their own stacking rules.
- **Rationale**: Satisfies WCAG 1.4.4/1.4.10 without rewriting the editor layouts for desktop; zoom users get the stacked layout automatically.
- **Alternatives**: Remove overflow:hidden globally (breaks Monaco/xterm sizing on desktop).

## R-06 — Alias layer retirement (scope warning)
- **Finding**: The "backward-compat aliases" (`--bg-main`, `--bg-surface`, `--text-primary`, `--text-secondary`, `--glass-*`, `--accent-*`, `--border-accent`, …) are **not dead**: ~280 `var()` uses across ~11 files, and `theme.js` *redefines* these exact names per theme (they are the de-facto theming API for dark themes). Unused today: `--bg-void`(0 uses), `--accent-dark`, `--neu-raise`, `--neu-flat`, `--shadow-glow`.
- **Decision**: Do it as the **last** phase, mechanically and verifiably: (1) delete the 5 unused aliases; (2) pick canonical names (document the mapping in contract), rename usages in CSS/HTML/JS and in `theme.js` overrides in one scripted pass; (3) a test fails if any retired name reappears; (4) visual smoke across 6 themes. Because it is high-blast-radius and does not affect users directly, it ships behind its own task group so P1/P2 value is not held hostage to it.
- **Spec impact**: FR-016 stands; sequencing is the mitigation.

## R-07 — Announcements
- **Decision**: `a11y.js` creates two persistent visually-hidden live regions (`role="status"` polite, `role="alert"` assertive) and exposes `DevSuite.a11y.announce(msg, 'polite'|'assertive')`. `DevSuite.toast` calls it (error → assertive). Existing `#toast-container` gets `role="region"` + label but is not itself live (avoids double announcement). Messages set via `textContent`; same-text repeats are cleared/re-set on a short timer so repeats re-announce; a small queue prevents floods.
- **Note**: `base64.html`, `regex.html`, `crypto.html` define their own inline toast functions — they are migrated to `DevSuite.toast` or call `announce()` (inline scripts are not *added*, existing ones are simplified).

## R-08 — Focus ring
- **Decision**: A `--focus-ring` token per theme (≥3:1 vs. that theme's surfaces) and one global rule `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px }`. Existing `outline:none` rules are audited: where a custom `:focus` style exists and is ≥3:1 it stays and additionally gets `:focus-visible`; otherwise the stripped outline is removed. Mouse focus stays quiet (`:focus-visible` semantics).

## R-09 — Landmarks and skip link
- **Decision**: `_serve_html()` inserts `<a class="ds-skip-link" href="#ds-main">Skip to main content</a>` after `<body>`. `a11y.js` finds the page's `<main>` (or `[role=main]`), assigns `id="ds-main"` if absent and `tabindex="-1"` so the jump moves focus. The 8 pages lacking `<main>` get the tag on their existing primary container. Lock screens: the lock card container is the main landmark target.
- **Alternatives**: Skip link in each HTML (drift).

## R-10 — Type scale, spacing, 12px floor
- **Finding**: ~14 distinct font sizes; ~45 declarations below 12px (0.6–0.75rem).
- **Decision**: Tokens `--text-xs 0.75rem(12px) · --text-sm 0.8125rem · --text-base 0.875rem · --text-md 1rem · --text-lg 1.25rem · --text-xl 1.5rem · --text-2xl 2rem`; spacing `--space-1..8` on a 4px base. Sub-12px sizes are raised to `--text-xs`. Dense terminal/monospace output and the SSH terminal (xterm) keep configured sizes (documented exception). Migration is by nearest-token mapping, not pixel-perfect.

## R-11 — Hardcoded hex colors
- **Decision**: Replace in `vault.css` (76), `home.css` (59), `style.css` (52), `api-tester.css` (33), `linter.css` (33) with tokens; add tokens where no semantic token exists (e.g. `--scrollbar-thumb`, `--scrollbar-thumb-hover`, overlay scrims). Exceptions allowed and enumerated: tool icon gradients (§9.7), `xterm.css` (vendor), `command-palette.css` fallback hexes (documented two-level fallback chain, SPEC §9.11). A pytest lint enforces "hex only inside `:root`/theme blocks or allowlisted selectors" per file.

## R-12 — Touch targets
- **Decision**: `@media (pointer: coarse)` sets `min-height/min-width: 44px` on buttons, tabs, icon buttons, checkboxes' labels, links in lists; fine-pointer desktop density is unchanged (dev tool; dense UI is intentional).

## R-13 — Testing approach
- **Decision**: pytest for deterministic checks (injection, skip-link presence on all routes, `<main>` count==1 per page, token contrast math for all themes computed from `theme.js` + `style.css` token values, hex lint, alias lint, reduced-motion rule present, no `outline:none` without sibling focus style, asset order). Manual headless-Chromium + axe-core run documented in quickstart (axe is dev-time only, fetched ad hoc, **not vendored or committed**, so SPEC §11 is untouched).
