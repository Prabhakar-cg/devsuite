# Feature Specification: Tool Pages — Bento Skin

**Created**: 2026-11-17 | **Status**: Draft | **Builds on**: 026 (bento showcase), 027 (File Converter redesign), 023/024 (a11y + theme layer)

**Input**: "Redesign the other tool pages the same way." (After the File Converter redesign.)

## Approach

The tools have very different shells (Monaco editor splits, card dashboards, a terminal, three-pane lists). Bespoke layouts for 15 pages would be fragile, so this feature delivers **one shared skin** that gives every tool the bento language without changing any layout engine, plus per-page hues and generated empty-state art.

| Bento trait | Applied how |
|---|---|
| Flat tinted tiles, no borders, 6px gutters, `--radius-xl` | One scoped stylesheet (`toolskin.css`, injected like `a11y.css`) restyles each tool's panes/cards/toolbars/sidebars; gaps come from container padding/gap only, so flex/height logic and Monaco/xterm sizing are untouched |
| Per-tool colour identity | `<body data-tool="…">` sets `--tk-hue` from theme tokens (SPEC §9.7 hues); tiles are `color-mix(hue 11% into surface)` |
| Generated art instead of emoji/blank states | New pictures (`regex`, `encode`, `ids`, `pulse`) + reuse (`lint`, `vault`, `doc`, `convert`) in empty states and lock screens |
| Pill controls | Buttons/selects/badges use `--radius-pill` / larger radii |

## User Stories

1. **P1 — Every tool feels like part of the same product** as Home/Tools/Converter: tinted tiles, consistent gutters, pill controls, a hue per tool.
2. **P1 — Nothing breaks.** All tools behave exactly as before (editors resize correctly, terminal/dashboard fit, dialogs work).
3. **P2 — Empty and locked states are designed**, not blank/emoji (SPEC §9.8): generated art + one clear instruction.
4. **P2 — Works in all six themes**, keyboard/screen-reader operable, axe-clean, reduced-motion safe, no overflow at 320px.

## Functional Requirements

- **FR-001**: `static/toolskin.css` is injected into every page by `_serve_html()` (with `bento.css` and `bento-art.js`), and styles only elements under `[data-tool]`; pages without the attribute (Home, Tools, DevDB's own dashboard chrome) are unaffected.
- **FR-002**: Each of the 14 skinned pages (diff, data-linter, regex, base64, crypto, api-tester, ssh, sftp, cron, vault, notes, roadmap, id-generator, ws-tester) declares `<body data-tool="…">`; File Converter keeps its dedicated 027 layout and DevDB Manager keeps its existing dark dashboard cards.
- **FR-003**: Skin changes use only gap/padding/background/radius/border — never `display`, `position`, `flex`, `height`/`width` of layout containers — so existing layout logic is preserved.
- **FR-004**: Colours only from theme tokens via `color-mix()` (no hex in the new stylesheet); text contrast ≥ 4.5:1 in all six themes.
- **FR-005**: Emoji/glyph empty-state icons are replaced by generated art (`<svg data-art>`, `aria-hidden`); art names must exist in `bento-art.js`.
- **FR-006**: Lock screens (auth-guard card, Vault, SFTP, DevDB) share one restyled tile card.
- **FR-007**: Tests: markup/asset/token guards (Python), art data (JS); browser verification: all pages screenshot-reviewed, axe ×6 themes, editors' Monaco size equals host size, no new console errors, 320px overflow.

## Success Criteria

- **SC-001**: axe 0 violations on all 14 skinned pages in all six themes (locked and, where reachable, unlocked states).
- **SC-002**: Monaco editors fill their panes (editor rect ≈ host rect) on Linter, Regex, Base64 and Diff.
- **SC-003**: Existing suites pass; smoke test shows no new console/page errors.

## Out of Scope

Rewriting individual page layouts; DevDB Manager visuals (already card-based); new functionality.
