# Data Model: UI Accessibility & Design-System Foundation

No persisted data. These are the in-page and token structures the feature defines.

## Design token (CSS custom property)

| Field | Description |
|---|---|
| name | `--kebab-case`, defined once in `:root` (light default) and overridden per theme in `theme.js` |
| role | `text` · `fill` · `border` · `focus` · `radius` · `type` · `space` · `motion` · `scrim` |
| pairing | for `text`/`focus`/`border` roles: the surface token(s) it is verified against |
| required ratio | 4.5 (normal text) · 3.0 (large text, icons, focus ring, UI borders) |

**Rule**: a `text` token must satisfy its required ratio against every surface in its pairing list in all 6 themes.

## Theme (6)

`noir` (default) · `midnight` · `ocean` · `solarized` · `light` (`vs`) · `high-contrast`.
Each defines the full text/surface/focus token set; the contrast test iterates this list.

## Dialog (runtime, `a11y.js`)

| Field | Description |
|---|---|
| root | dialog element (`<dialog>` or overlay `div`) |
| name | `aria-labelledby` (existing heading) or `aria-label` |
| opener | element focused when the dialog became visible (focus-return target) |
| dismissible | boolean; pre-unlock lock screens are `false` (Esc ignored) |
| state | `hidden → visible → hidden` (observer-driven; helper never forces visibility) |

State stack: nested dialogs keep a LIFO stack of openers.

## Status message (runtime)

| Field | Description |
|---|---|
| text | plain string, set via `textContent` |
| politeness | `polite` (info/success/warning) · `assertive` (error) |
| coalescing | identical consecutive text re-announced after a short clear; queue capped |
