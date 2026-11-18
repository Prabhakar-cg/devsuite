# Feature Specification: Tool-Page Theming Unification

**Feature Branch**: `024-tool-page-theming` (spec directory only; work proceeds on `develop`)

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Fix the findings from the 023 browser verification: Hi-Contrast is not high contrast on tool pages, dark-default tool pages (Crypto, DevDB Manager) have mixed dark/light chrome, Home/Tools chips, badges and CTA fail contrast, and small polish items (command-palette hint spacing, residual grey text)."

## Background (verified in the 023 browser pass, 2026-11-17)

`specs/023-ui-accessibility-foundation/checklists/verification.md` recorded 706 remaining contrast failures across 18 pages × 6 themes, 290 of them in Hi-Contrast. Root cause: each tool page carries its own copy of the light palette (`linter.css`, `vault.css`, `cron.css`, `style.css` each redeclare ~30 identical tokens; `db-manager.css` and Crypto Suite carry separate dark palettes), while `theme.js` overrides only the legacy alias names (`--bg-main`, `--text-primary`, …). The tokens these pages actually read (`--bg`, `--bg-secondary`, `--text`, `--text-mid`, `--border`, …) are therefore never themed, so selecting a theme recolours only part of a page.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hi-Contrast is genuinely high contrast on every tool page (Priority: P1)

A person with low vision selects the Hi-Contrast theme and every tool page becomes a consistent black-background, white-text, strongly-outlined interface — no white cards, no grey-on-grey text.

**Why this priority**: Hi-Contrast exists for exactly this user; today it makes some pages worse (white cards with pale text on a black page).

**Independent Test**: Select Hi-Contrast, open each tool page, run the automated accessibility scan and a visual check: zero contrast violations and no light surfaces.

**Acceptance Scenarios**:

1. **Given** Hi-Contrast is selected, **When** any tool page loads, **Then** all page, card, header, toolbar and panel surfaces are dark and all text meets 7:1 (large text 4.5:1).
2. **Given** Hi-Contrast, **When** focusing any control, **Then** the focus ring and control borders are clearly visible (≥3:1, borders ≥4.5:1 against surface).
3. **Given** Hi-Contrast, **When** the theme is switched back to another theme, **Then** the page returns to that theme's look with no leftover styling.

---

### User Story 2 - Every theme recolours the whole tool page (Priority: P1)

A person selecting Light or iOS Glass sees the complete page — header, toolbar, cards, inputs, badges — in that theme, with all text legible.

**Why this priority**: Same root cause as Story 1; fixing it once in the shared token layer fixes all themes.

**Independent Test**: For each theme and each tool page, the automated scan reports no contrast violations and no element keeps the default light surface when the theme is dark.

**Acceptance Scenarios**:

1. **Given** any selectable theme, **When** a tool page renders, **Then** surfaces, text, borders, and status colors all come from that theme's tokens.
2. **Given** a tool whose own stylesheet declares a local palette, **When** a theme is active, **Then** the theme's values win over the local defaults.

---

### User Story 3 - Dark-default pages have consistent chrome (Priority: P2)

On Crypto Suite and DevDB Manager (which default to dark surfaces) the header, tabs, buttons and badges match the page instead of showing light-grey headers and white buttons on a dark page.

**Why this priority**: Visible polish defect; lower impact than readability.

**Independent Test**: Open Crypto Suite and DevDB Manager in the default theme; no header/button/badge uses a light surface on a dark page, and contrast scan is clean.

**Acceptance Scenarios**:

1. **Given** Crypto Suite in its default (dark) look, **When** it loads, **Then** the page header, tab bar, buttons and badges use dark-appropriate surfaces and text.
2. **Given** DevDB Manager, **When** it loads, **Then** muted and accent text meets contrast on every surface it uses.

---

### User Story 4 - Home and Tools pages pass contrast in every theme (Priority: P2)

Tag chips, "Live"/"Soon" badges, the "Report Issue" button, and active filter pills on Home and Tools are legible in all six themes.

**Why this priority**: These pages are the first impression and account for the largest single group of remaining failures (~174 chip nodes).

**Independent Test**: Scan `/` and `/tools` in all 6 themes: zero contrast violations.

**Acceptance Scenarios**:

1. **Given** any theme, **When** Home or Tools loads, **Then** chip, badge, CTA and filter-pill text meets 4.5:1 on its own background.
2. **Given** a "coming soon" card, **When** it renders, **Then** it is distinguishable as inactive without reducing text below the required contrast.

---

### User Story 5 - Small polish items (Priority: P3)

The command-palette hint reads "Ctrl K" with the keys visually separated; residual hard-coded greys on tool pages (empty-state icons, secondary spans, link accents) use theme tokens.

**Independent Test**: Visual check of the palette hint on Windows/Linux and macOS; scan clean for the residual items.

**Acceptance Scenarios**:

1. **Given** a non-macOS platform, **When** any page loads, **Then** the palette trigger shows "Ctrl" and "K" as separate key caps.
2. **Given** an empty-state icon or secondary text, **When** rendered in any theme, **Then** its contrast meets the required ratio.

### Edge Cases

- Pages that use only their own `:root` palette and never load `style.css` (linter, vault, cron, db-manager): theme overrides must still apply.
- Third-party widgets (Monaco, xterm): untouched; Monaco's theme already follows the selected theme.
- Theme switched at runtime (`devsuite-theme-changed`): the page must update without reload.
- Selecting Midnight/Ocean/Solarized on tool pages keeps today's behavior (the Noir look); this feature does not introduce new dark palettes for tool pages beyond the existing themes.
- High-contrast users with forced-colors mode: the theme must not fight OS forced colors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A single shared theme layer MUST define themed values for the canonical tool-page tokens (surfaces, text, borders, status hues, shadows, focus) for every theme that styles tool pages, applied by theme selector so it overrides any page-local default palette.
- **FR-002**: Hi-Contrast MUST render every tool page with dark surfaces, white/yellow text and accents meeting 7:1 (large text and UI boundaries 4.5:1), strong borders, and a clearly visible focus ring.
- **FR-003**: Light and iOS Glass themes MUST meet the 023 contrast matrix on the canonical tokens across all surfaces including tertiary and translucent surfaces.
- **FR-004**: Page-local palette copies in tool stylesheets MUST NOT be able to defeat a theme: the themed values win regardless of stylesheet load order.
- **FR-005**: Crypto Suite and DevDB Manager MUST render dark-consistent chrome in their default look (header, tabs, buttons, badges, muted/accent text).
- **FR-006**: Home and Tools tag chips, live/soon badges, header CTA, and active filter pills MUST meet 4.5:1 in all six themes; "coming soon" MUST be indicated without text dimming that violates contrast.
- **FR-007**: The command-palette keyboard hint MUST render as separate key caps with a visible gap.
- **FR-008**: Residual hard-coded greys/accents flagged in the verification record (empty-state icons, `span` secondary text, `.tool-accent`, `.line-badge`) MUST use theme tokens meeting contrast.
- **FR-009**: Tests MUST cover: the shared theme layer defines every canonical token for each themed variant; computed contrast matrix extended to the canonical tokens under Hi-Contrast/Light/iOS Glass; no tool stylesheet reintroduces a local palette that shadows a theme (guard).
- **FR-010**: SPEC §9 MUST document the shared theme layer and which token names are canonical per vocabulary, in the same commit series; no new libraries, no CSP change, no inline script, no emoji.

### Key Entities

- **Canonical tool token**: a named surface/text/border/status value that every tool page reads (`--bg`, `--bg-secondary`, `--bg-tertiary`, `--text`, `--text-mid`, `--text-muted`, `--border`, `--border-mid`, status hues and their text-safe variants, `--focus-ring`).
- **Theme layer**: the one place that assigns canonical tokens per theme.
- **Local palette**: a per-stylesheet default copy of canonical tokens (to be overridable, later removable).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Automated scan reports zero contrast violations on every tool page in Hi-Contrast, Light and iOS Glass.
- **SC-002**: Overall scan across 18 pages × 6 themes drops from 706 contrast nodes to under 25, with each remaining item listed and justified.
- **SC-003**: In Hi-Contrast, no tool page contains a light surface (verified by visual check of every page).
- **SC-004**: Crypto Suite and DevDB Manager have zero light-on-dark chrome mismatches in the default look.
- **SC-005**: `/` and `/tools` have zero contrast violations in all six themes.
- **SC-006**: Existing backend and JS suites continue to pass.

## Assumptions

- Midnight, Ocean and Solarized remain home/tools-only palettes; tool pages keep today's default look for them.
- Default tool-page look (Apple light, or each tool's own dark default for Crypto/DevDB) is preserved; this feature fixes theming, not layout.
- Removing page-local palette copies is deferred; this feature makes them harmless via higher-specificity theme overrides.
- Verification reuses the 023 headless-browser + axe procedure (dev-time only, not vendored).
