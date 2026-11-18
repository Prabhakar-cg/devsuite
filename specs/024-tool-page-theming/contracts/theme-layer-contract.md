# Theme Layer Contract (folds into SPEC §9.13)

- File: `static/theme-layer.css`, injected by `_serve_html()` first in `<head>` (before `a11y.css`); never linked from a page.
- Selectors: `html[data-theme="high-contrast" | "ios-glass" | "vs"]`.
- Canonical tokens defined per theme: `--bg --bg-secondary --bg-tertiary --text --text-mid --text-muted --border --border-mid --blue --blue-hover --blue-subtle --blue-text --green --green-mid --green-text --green-subtle --red --red-mid --red-text --red-subtle --amber --amber-mid --amber-text --amber-subtle --on-accent --focus-ring --scrollbar-thumb --scrollbar-thumb-hover --shadow-xs --shadow-sm --shadow-md`.
- Contrast: Hi-Contrast text ≥7:1 (large/UI ≥4.5:1); Light/iOS Glass per 023 matrix.
- Local `:root` palettes in tool stylesheets remain as defaults and are overridden by the layer.
- Guard: a test fails if a themed token is missing for any themed variant.
