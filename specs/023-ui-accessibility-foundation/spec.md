# Feature Specification: UI Accessibility & Design-System Foundation

**Feature Branch**: `023-ui-accessibility-foundation` (spec directory only; work proceeds on `develop` unless the user creates a branch)

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Bring the whole DevSuite UI to WCAG 2.1 AA and a consistent token-driven design system: visible keyboard focus, contrast-safe text, accessible dialogs, announced status messages, landmarks and skip links, responsive layouts usable at 200% zoom, a complete token set (radius, type scale, spacing), reduced-motion support, theme-aware scrollbars, and 44px touch targets."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keyboard and screen-reader users can operate every tool (Priority: P1)

A person who navigates by keyboard or screen reader opens any DevSuite page. They can always see which control has focus, skip straight to the main content, reach every control with Tab, open and close dialogs with the keyboard without losing their place, and hear confirmation or error messages when an action finishes.

**Why this priority**: These are the barriers that fully block a user (cannot see focus, trapped or lost in dialogs, silent failures). Fixing them delivers the most value and each is independently verifiable.

**Independent Test**: On any page, using only the keyboard: press Tab and confirm a visible focus indicator on every interactive control; activate the skip link and confirm focus lands in main content; open a dialog, confirm focus moves inside, Tab cycles within it, Esc closes it, and focus returns to the opener; trigger a toast and confirm a screen reader announces it.

**Acceptance Scenarios**:

1. **Given** any page in any of the 6 themes, **When** the user tabs through the page, **Then** every interactive control shows a focus indicator with at least 3:1 contrast against its surroundings.
2. **Given** a page load, **When** the user presses Tab once, **Then** a "Skip to main content" link appears and activating it moves focus to the main content region.
3. **Given** an open dialog (unlock, confirm, vault/SSH editors, etc.), **When** the user presses Tab repeatedly, **Then** focus stays inside the dialog; **When** they press Esc, **Then** the dialog closes and focus returns to the control that opened it.
4. **Given** a toast or async status message (saved, copied, error), **When** it appears, **Then** assistive technology announces it without moving focus; errors are announced assertively.

---

### User Story 2 - Text is readable for everyone in every theme (Priority: P1)

A person with low vision or in bright light reads secondary text, labels, statuses and placeholders in all six themes and finds them legible.

**Why this priority**: Failing contrast affects every page and every user with reduced vision; it is a single-source-of-truth fix in the token layer.

**Independent Test**: Compute contrast for each text token against each surface token in all 6 themes; every normal-size text pairing is at least 4.5:1 and every large-text/UI-component pairing at least 3:1.

**Acceptance Scenarios**:

1. **Given** the light/default theme, **When** muted text is rendered on the page background, **Then** its contrast is at least 4.5:1.
2. **Given** success and warning states, **When** they render as text on a light surface, **Then** they use text-safe variants that meet 4.5:1 (decorative fills may keep the brighter hues).
3. **Given** any of the 6 themes, **When** muted text, placeholders, links and status text render on their surfaces, **Then** all meet the required ratio.

---

### User Story 3 - The suite works on small screens and at 200% zoom (Priority: P2)

A person using a phone, a narrow window, or browser zoom at 200% can still read and use every page without losing content or scrolling in two dimensions for ordinary text.

**Why this priority**: Important for low-vision zoom users and small viewports, but the existing layout is desktop-first, so it is a larger change than P1 items.

**Independent Test**: Load each page at 320 CSS px width and at 200% zoom on a 1280px viewport; verify no content is clipped or unreachable and primary actions remain operable.

**Acceptance Scenarios**:

1. **Given** any page at 200% zoom, **When** the user scrolls, **Then** all content is reachable (the page does not trap content behind a fixed full-height, non-scrolling body).
2. **Given** a viewport 320px wide, **When** a tool page loads, **Then** its panels stack or scroll so every control is reachable and operable.
3. **Given** a touch device, **When** the user taps buttons, toggles, tabs and icon buttons, **Then** each target is at least 44x44 CSS px (or has equivalent spacing).

---

### User Story 4 - A consistent, token-driven look across tools and themes (Priority: P2)

A designer or contributor changes a theme or edits a token and every page updates consistently, with no hard-coded colors left behind and no undocumented aliases.

**Why this priority**: Underpins maintainability and theme correctness, and resolves the documented-vs-defined token discrepancy.

**Independent Test**: Switch through all 6 themes on Vault, Home, Linter, API Tester and the Diff tool; no element keeps a color that ignores the theme. Search the stylesheets for hard-coded hex colors outside the token-definition blocks.

**Acceptance Scenarios**:

1. **Given** SPEC §9.4 lists `--radius-xl` and `--radius-pill`, **When** the stylesheets are inspected, **Then** both tokens are defined and used instead of ad-hoc radius values for modals and pills/badges.
2. **Given** the shared type scale and spacing scale tokens, **When** font sizes and gaps are inspected, **Then** UI text uses scale tokens and no UI text is below 12px (code/terminal output excepted if documented).
3. **Given** the migrated stylesheets, **When** searched, **Then** hard-coded semantic hex colors (white-on-accent, status text) are tokenized; remaining literals are decorative (brand/tool-icon gradients, category badge hues), and unused legacy alias variables are removed (the remaining aliases are documented as the theme-override API).
4. **Given** any theme, **When** scrollbars render, **Then** their colors derive from theme tokens.

---

### User Story 5 - Motion respects user preferences (Priority: P3)

A person who has asked their OS to reduce motion sees no non-essential animation or transform transitions anywhere in the suite.

**Why this priority**: Important for vestibular sensitivity but low effort and low risk; ships independently.

**Independent Test**: Enable the OS "reduce motion" setting and navigate every page; hover lifts, slide-ins, spinners' non-essential animation and transitions are suppressed or reduced to opacity-only.

**Acceptance Scenarios**:

1. **Given** reduced-motion is enabled, **When** any page is used, **Then** transitions and animations are disabled or reduced to instant/opacity changes (cursor blink and essential progress indication excepted).

---

### Edge Cases

- Nested or stacked dialogs (a confirm opened from an editor): focus return must restore to the correct opener when each closes.
- Dialog opened before page content finished loading, or whose opener element was removed from the DOM: focus falls back to the main region.
- Toast storms (many rapid messages): announcements must not flood; messages queue or coalesce without losing errors.
- Hi-Contrast and Solarized themes: focus ring and text tokens must meet ratios on their own surfaces, not only on the default theme.
- Pages that embed Monaco, xterm or other third-party widgets (not restyled here): their internals are out of scope, but surrounding chrome and focus entry/exit must work.
- The command palette (022) already has its own dialog behavior: it must not regress, and any shared modal helper must not break its Esc/focus handling.
- Pre-unlock lock screens must satisfy the same requirements (skip link, focus, landmarks) without requiring authentication.
- Fixed-height tool layouts (editors, terminals) that currently rely on a non-scrolling body: moving to scrollable pages must not break editor/terminal sizing.

## Requirements *(mandatory)*

### Functional Requirements

**Keyboard focus**
- **FR-001**: Every interactive control on every page MUST show a visible focus indicator for keyboard focus with at least 3:1 contrast against adjacent colors, in all 6 themes.
- **FR-002**: The suite MUST NOT remove a control's focus indication without providing an equivalent replacement; a single shared focus style MUST apply by default.

**Contrast**
- **FR-003**: Normal-size text MUST meet 4.5:1 contrast and large text, icons and UI-component boundaries MUST meet 3:1, against their actual surfaces, in all 6 themes.
- **FR-004**: The design tokens MUST provide text-safe variants for muted, success, warning and danger text; the brighter hues remain available only for non-text fills.

**Dialogs**
- **FR-005**: The suite MUST provide one shared modal behavior that sets dialog semantics (role, modal flag, accessible name), moves focus into the dialog on open, keeps Tab focus inside, closes on Esc, and returns focus to the opener on close.
- **FR-006**: Every existing dialog/modal/lock-card overlay in the suite MUST adopt the shared behavior, without changing its content or data flow.

**Status announcements**
- **FR-007**: Toasts and asynchronous status/result messages MUST be announced to assistive technology without stealing focus; error messages MUST be announced assertively and all others politely.
- **FR-008**: Announcement text MUST be set as text content only (never as markup built from untrusted data).

**Landmarks & navigation**
- **FR-009**: Every page MUST expose a single main-content landmark and a first-in-tab-order "Skip to main content" link that targets it, including pre-unlock lock screens.
- **FR-010**: Pages with navigation regions MUST label them so multiple navigation regions are distinguishable.

**Responsive & zoom**
- **FR-011**: The suite MUST NOT rely on a globally non-scrolling, full-height page body; every page MUST remain fully reachable at 200% zoom and at 320 CSS px width without two-dimensional scrolling for ordinary content (code editors and data tables may scroll internally).
- **FR-012**: Every tool stylesheet MUST define layout behavior for narrow viewports so multi-panel layouts stack or become scrollable.
- **FR-013**: Interactive targets MUST be at least 44x44 CSS px, or have equivalent hit-area/spacing, on touch/coarse-pointer devices.

**Design tokens**
- **FR-014**: The token layer MUST define `--radius-xl` and `--radius-pill` (resolving the SPEC §9.4 documentation/code discrepancy) and use them for modals/lock cards and pills/badges/CTA buttons.
- **FR-015**: The token layer MUST define a type-scale set and a spacing-scale set; UI text MUST NOT be smaller than 12px (documented exceptions only).
- **FR-016** *(amended 2026-11-17, research R-06)*: Alias variables with zero usages MUST be removed. The remaining compatibility aliases are the documented theme-override API (`theme.js` overrides them per theme and several are the native Terminal Noir tokens), so renaming them is deferred to a follow-up that includes a rendered-browser verification pass. No rendered appearance may change except where required by FR-003/FR-004.
- **FR-017**: Hard-coded hex colors in the Vault, Home, Linter, API Tester stylesheets and the global stylesheet MUST be replaced with tokens, except documented exceptions (tool-icon gradients per SPEC §9.7).
- **FR-018**: Scrollbar colors MUST derive from theme tokens and re-theme with theme changes.

**Motion**
- **FR-019**: When the user's reduced-motion preference is set, the suite MUST suppress non-essential animation and transitions on every page.

**Governance & compatibility**
- **FR-020**: `specs/SPEC.md` §9 MUST be updated in the same commit series to document the focus, contrast, dialog, announcement, landmark, responsive, token and motion contracts, and the corrected radius tokens, and add an accessibility-testing subsection to §10.
- **FR-021**: The change MUST preserve all constitution constraints: vanilla stack, no new libraries, no CDN assets, no emoji in UI chrome, no untrusted-data markup injection, no new inline scripts, no CSP changes, and the existing asset-load-order guards.
- **FR-022**: Tests MUST cover the pure/automatable parts: token contrast ratios for all themes, presence of the shared focus and reduced-motion rules, landmark and skip-link presence on every served page, absence of hard-coded hex colors in migrated files, and removal of alias variables.

### Key Entities

- **Design token**: a named visual value (color, radius, type size, spacing, motion) defined once per theme and consumed everywhere; attributes: name, per-theme value, role (text/fill/border), contrast pairing.
- **Theme**: one of six runtime palettes; each must satisfy contrast requirements on its own surfaces.
- **Dialog**: any modal or overlay requiring input or acknowledgement; attributes: accessible name, opener, dismissibility.
- **Status message**: a transient or persistent result (toast, inline result); attributes: severity (info/success/error), announcement politeness.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of served pages pass an automated accessibility scan with zero serious or critical violations in each of the 6 themes.
- **SC-002**: 100% of text/background token pairings meet their required contrast ratio (4.5:1 normal, 3:1 large/UI) in all 6 themes.
- **SC-003**: A keyboard-only user can complete the primary action of every tool (including unlocking a vault and dismissing every dialog) without a mouse, and focus is always visible.
- **SC-004**: Every page is fully usable at 200% zoom and at 320 CSS px width with no clipped or unreachable content.
- **SC-005**: Zero hard-coded semantic hex colors (white-on-accent, status text, scrollbars) remain in the migrated stylesheets; only decorative gradient/badge hues remain; zero unused alias variables remain; remaining aliases are documented.
- **SC-006**: No UI text is smaller than 12px; all touch targets meet 44x44 CSS px on coarse-pointer devices.
- **SC-007**: With reduced motion enabled, zero non-essential animations or transitions run on any page.
- **SC-008**: The existing backend and JS test suites continue to pass, and no page regresses visually in the default theme beyond the intended contrast fixes.

## Assumptions

- The target standard is WCAG 2.1 Level AA; AAA criteria and WCAG 2.2-only criteria are out of scope.
- Third-party widget internals (Monaco editor, xterm terminal) are out of scope; their surrounding chrome and focus entry/exit are in scope.
- Text-safe color variants may differ slightly from today's shades; this deliberate visual change is accepted wherever required for contrast.
- The two design vocabularies (Terminal Noir, Apple Tool UI) are preserved; this feature does not merge them or redesign layouts beyond responsiveness.
- Tool-icon gradients (SPEC §9.7) are decorative and keep their hex values as a documented exception.
- Automated accessibility scanning will run in the existing headless-browser setup used for manual validation; it is not added to CI in this feature.
- The shared modal behavior and announcement region live in the existing shared client code; no new third-party dependency is introduced.
- Spec directory 023 is created without a new git branch; the user decides whether to branch.
