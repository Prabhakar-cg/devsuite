# Verification Record: 023 UI Accessibility Foundation

**Date**: 2026-11-17 | **Method**: headless Chromium (Playwright) + axe-core 4.11 (dev-time only, not vendored), isolated server on :8001 with a throwaway HOME. 18 pages × 6 themes (108 combos), WCAG 2.0/2.1 A + AA rules.

## Results

| Check | Before fixes | After fixes |
|---|---|---|
| axe `critical` violations | 2 (File Converter: unlabeled file input + 2 selects) | **0** |
| axe violations other than `color-contrast` | 0 | **0** (landmarks, ARIA, labels, names all pass) |
| axe `color-contrast` nodes | 350 on default theme alone | 706 across all themes (see below) — 31 of 108 page/theme combos fully clean |
| Skip link, `<main>`, focus ring | n/a | Verified rendered (Vault lock card: dialog helper moved focus to the password field, ring visible) |

## Fixed during the pass (not caught by the static matrix)

- Four tool stylesheets (`linter`, `vault`, `cron`, `db-manager`) re-declared their own `--text-muted`, bypassing the `style.css` fix.
- The Hi-Contrast and Light tool themes never defined `--bg-tertiary`, so it fell back to light grey under white text (1.2:1).
- Palette fallback color, `heatmap-*` text, Auth-guard card muted/link text, the `coming-soon` card dimming (opacity 0.45), and `--green-text` on tertiary surfaces.
- Test matrix widened to `--bg-tertiary` and `--surface-2/3` so these cannot regress.

## Open findings (not fixed)

1. **Hi-Contrast theme is not high contrast on tool pages** (290 of 706 nodes): the body goes black but cards, headers and toolbars stay white/light-grey with grey text (seen on Cron, Data Linter). Needs the theme to set `--bg`, `--bg-secondary`, `--text`, `--text-mid` for tool pages, not only the alias layer.
2. **Mixed dark/light chrome on dark themes** (e.g. Crypto Suite): dark body, light-grey header, white buttons.
3. Home/Tools: `.tag-chip` text (174 nodes, 4.4:1 on a 4.5 bar) and `.badge-live` / `.badge-soon` hues need per-theme text-safe variants; `.header-cta` and active filter pills are white on `#3b82f6` (3.7:1) and need a darker solid or dark text.
4. Residual hard-coded greys in tool pages (`span` #a1a1a3 on white, empty-state icons #dededf, `.tool-accent` #0071e3 on grey).
5. The palette trigger reads "CtrlK" (no space between keys).
6. Emoji in Crypto/Vault/SFTP render as empty boxes where no emoji font is installed (SPEC §9.8 debt).

Not yet run: keyboard-only walkthrough of every dialog, 200% zoom and 320px layout screenshots, reduced-motion emulation.
