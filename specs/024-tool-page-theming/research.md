# Research: Tool-Page Theming Unification

## R-01 — Why themes don't reach tool pages (verified)
`linter.css`, `vault.css`, `cron.css`, `style.css` each declare the same ~30 canonical tokens in `:root`; `db-manager.css` and Crypto have separate dark palettes. `theme.js` overrides alias names only. **Decision**: a theme layer using `html[data-theme="X"]` selectors (specificity 0,1,1 > `:root` 0,1,0) — wins regardless of order and without deleting the local copies. **Alternative rejected**: deleting the local palettes (touches every page; no visual verification without per-page review; do later).

## R-02 — Which themes apply to tool pages
`applyThemeDOM` only sets `data-theme` for `ios-glass`, `hc-black` (→ `high-contrast`) and `vs`; other themes clear it (default look). Layer covers exactly those three; Midnight/Ocean/Solarized stay home-only (spec assumption).

## R-03 — Hi-Contrast palette
Surfaces `#000/#0a0a0a/#141414`; text `#fff/#f0f0f0/#c8c8c8` (≥7:1); borders 55–80% white; accent `--blue:#6cb6ff` with `--on-accent:#000` (10:1) so filled buttons stay legible; status hues bright (`#5dff7a`, `#ff7b72`, `#ffd60a`); focus ring `#ffd60a`; shadows none. All values verified by computed matrix (target ≥7:1 text).

## R-04 — Dark-default pages
Crypto sets dark `--cs-*` surfaces but its header/buttons come from `linter.css` (light tokens). Fix by giving Crypto/DevDB their dark values for the *canonical* tokens inside their own scope (page-local `:root` under a body class), not by new theme ids.

## R-05 — Home/Tools
Chips use `--text-muted` on `--surface-3`; badges use accent hues on tinted fills; header CTA and active filter pill are white on `#3b82f6` (3.7:1). **Decision**: add `--electric-solid` (≥4.5:1 with white) for filled controls; theme-aware badge text tokens; replace `.coming-soon` opacity dimming with dashed border + "Soon" badge (done partially in 023).

## R-06 — Palette hint
Trigger shows `CtrlK`; render as two `<kbd>` key caps separated by gap (DOM, `createElement`).
