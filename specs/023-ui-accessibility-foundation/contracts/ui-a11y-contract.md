# UI Accessibility Contract

Durable contract; folds into `specs/SPEC.md` §9.12 on ship.

## 1. Injection (deps.py `_serve_html()`)

For every served HTML page, if not already present:
- `<link rel="stylesheet" href="/static/a11y.css">` immediately after `<head>` (before page CSS so page rules can still override layout, but `:focus-visible`/reduced-motion rules use low-specificity-safe `!important` only where noted).
- `<a class="ds-skip-link" href="#ds-main">Skip to main content</a>` immediately after `<body ...>`.
- `<script src="/static/a11y.js" defer></script>` before `</body>`, **before** `command-palette-data.js`.
- No inline script. Assets fingerprinted by the existing regex.

## 2. `DevSuite.a11y` (static/a11y.js)

```text
DevSuite.a11y.announce(message: string, politeness?: 'polite'|'assertive') -> void
DevSuite.a11y.dialog.register(root: Element, opts?: {dismissible?: boolean, closeSelector?: string}) -> void
```
- `announce` writes `textContent` into persistent hidden `role=status` / `role=alert` regions.
- Dialog behavior auto-registers elements matching the registry selectors (`dialog`, `.modal-overlay`, `.db-lock-overlay`, lock-card roots listed in tasks) and also exposes `register` for future tools.
- Behavior on show: `role="dialog"`, `aria-modal="true"`, accessible name; remember opener; focus first focusable else root (`tabindex=-1`); Tab/Shift+Tab wrap; Esc triggers `closeSelector` (default: first `[data-close],.modal-close,.btn-cancel,[aria-label~=Close]`) when `dismissible`; on hide restore focus to opener if still in DOM else `#ds-main`.
- Excluded: `.cpal-dialog` (Command Palette root).
- Never reads input `.value`, never logs, never writes storage.

## 3. Tokens (style.css `:root`, overridden in theme.js)

Radius: `--radius-xl:16px` `--radius:14px` `--radius-sm:10px` `--radius-xs:7px` `--radius-pill:980px`.
Type: `--text-xs:.75rem` `--text-sm:.8125rem` `--text-base:.875rem` `--text-md:1rem` `--text-lg:1.25rem` `--text-xl:1.5rem` `--text-2xl:2rem`. Minimum UI text is `--text-xs`.
Space (4px base): `--space-1:.25rem` `-2:.5rem` `-3:.75rem` `-4:1rem` `-5:1.25rem` `-6:1.5rem` `-8:2rem`.
Text-safe: `--text-muted` (≥4.5:1 on `--bg`, `--bg-secondary`), `--green-text`, `--amber-text`, `--red-text`, `--blue-text` (≥4.5:1 on their surfaces).
Focus: `--focus-ring` (≥3:1 vs. page and card surfaces, per theme).
Scrollbar: `--scrollbar-thumb`, `--scrollbar-thumb-hover`.

### Contrast pairing matrix (tested for all 6 themes)

| Foreground token | Surface tokens | Min ratio |
|---|---|---|
| `--text`/`--text-primary` | `--bg`, `--bg-secondary`, card surface | 4.5 |
| `--text-mid`/`--text-secondary` | same | 4.5 |
| `--text-muted` | same | 4.5 |
| `--green-text`, `--amber-text`, `--red-text`, `--blue-text` | same | 4.5 |
| `--focus-ring` | `--bg`, `--bg-secondary`, card surface | 3.0 |

## 4. CSS rules (a11y.css)

- `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }` applies to all focusable elements; `.ds-skip-link` visually hidden until focused.
- `@media (prefers-reduced-motion: reduce)` zeroes `animation-duration`, `transition-duration`, `scroll-behavior`, hover/press transforms (exceptions: `.ds-keep-motion` for essential progress; terminal cursor blink).
- `@media (pointer: coarse)` 44×44 minimum on buttons, `[role=button]`, `summary`, tab controls, icon buttons, form checkboxes/radios' labels.
- Scrollbars use `--scrollbar-*` tokens (webkit and `scrollbar-color`).
- `.ds-sr-only` utility; announcer regions use it.

## 5. Page requirements

- Exactly one `<main>` (or `role=main`) per page, including pre-unlock lock screens (the lock card's container).
- Navigation regions have distinct `aria-label`s.
- Narrow layout: below `900px` width, `html,body` become `height:auto; min-height:100dvh; overflow:auto`; multi-pane layouts stack.
- Toasts: `#toast-container` = `role="region" aria-label="Notifications"`; close control is a `<button aria-label="Dismiss notification">` with inline SVG (no ✕ glyph).

## 6. Alias layer (amended scope — see research R-06)

Only aliases with **zero uses** were deleted: `--bg-void --accent-dark --neu-raise --neu-flat --shadow-glow` (a test keeps them out).
The remaining `style.css` compatibility aliases (`--bg-main --bg-surface --bg-panel --text-primary --text-secondary --accent-* --glass-* --border-accent …`) are **retained and documented as the theme-override API**: `theme.js` overrides exactly these names per theme, and several of them (`--text-primary`, `--text-secondary`, `--border-accent`) are the *native* tokens of the Terminal Noir vocabulary in `home.css`. Renaming them is a ~280-site, two-vocabulary change that cannot be verified without a rendered browser pass; it is deferred to a follow-up feature that includes that pass.
