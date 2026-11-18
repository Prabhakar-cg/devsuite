# Feature Specification: Bento Showcase (Home + Tools hub)

**Created**: 2026-11-17 | **Status**: Draft | **Branch**: spec dir only; work on `develop`

**Input**: User request after comparing DevSuite's Home with the composition of a large consumer-tech marketing page (flat colour-blocked mosaic tiles, generated pattern art, one bold headline, one pill CTA). Inspiration is **compositional only** — no third-party imagery, logos, or branding are used.

## Assessment (what the reference does, what DevSuite lacked)

| Reference trait | DevSuite before | This feature |
|---|---|---|
| Edge-to-edge mosaic of mixed-size flat tiles | Uniform bordered cards with glow | Bento grid (CSS grid) with mixed spans and thin gutters |
| Colour-blocked tiles, one cohesive palette | Small gradient icon chips only | Flat tiles tinted from the active theme's accents |
| Visuals carry the page (renders + pattern art) | No imagery at all | Generated, code-owned SVG art per tool + a pure pattern tile |
| One bold headline + one pill CTA, lots of space | Text-heavy hero + terminal mock | A statement tile with a single headline and pill CTA |

## User Stories

1. **P1 — A visitor sees what DevSuite is at a glance.** Home shows a bento showcase directly under the hero: six tool tiles (Text Diff, Data Linter, Secret Vault, API Tester, Secure Terminal, Cron Visualizer), one pattern tile, and a statement tile. Each tool tile is a link to its tool.
2. **P1 — The Tools hub opens with the same showcase** above the filterable catalog, so the catalog is unchanged and still the source of truth.
3. **P2 — It works in every theme, on every screen, for every user.** Tiles recolour with the six themes (dark and light), collapse to two columns on tablet and one on phone, are fully keyboard/screen-reader operable, honour reduced motion, and pass the contrast bar.

## Functional Requirements

- **FR-001**: A `Bento` section on `/` and `/tools` with 6 tool tiles + 1 decorative pattern tile + 1 statement tile; layout is CSS grid with mixed spans, 6px gutters, `--radius-xl` corners.
- **FR-002**: Each tool tile is an `<a>` to an existing route (`/diff`, `/data-linter`, `/vault`, `/api-tester`, `/ssh`, `/cron`) with an `aria-label` of "<Tool name> — <one-line purpose>" and a visible name caption; art is `aria-hidden`.
- **FR-003**: Art is generated from data in `static/bento-art.js` (shape descriptors → SVG via `createElementNS`; no `innerHTML`, no images, no network). With JS off, tiles still render as coloured, labelled links.
- **FR-004**: Tile colours derive from existing theme tokens (`--electric/--lime/--amber/--violet` mixed into `--surface-*`) via `color-mix`, so all six themes work without per-theme tables; no hard-coded hex (SPEC §9.12 token rules).
- **FR-005**: Caption/headline text contrast ≥ 4.5:1 in all six themes on every tile (axe verified).
- **FR-006**: Responsive: 12-col ≥ 1000px; 6-col 600–999px (pattern tile hidden); 1-col < 600px. No horizontal scroll at 320px.
- **FR-007**: Hover/focus art scale is the only motion; suppressed by the global reduced-motion rule; focus ring from the shared `:focus-visible` rule.
- **FR-008**: The statement tile contains one `h2` and one pill CTA (`Open all tools` → `/tools` on Home; `Browse the catalog` → `#tools` on Tools); the section has an `sr-only` heading.
- **FR-009**: Tests: art data well-formed (JS), tile hrefs resolve to real routes and exist in the command-palette destination list, aria rules, no inline script/`innerHTML`, assets exist; browser verification (axe 0 violations, screenshots in all themes + 360px).
- **FR-010**: SPEC §9.14 documents the pattern; CHANGELOG + version bump.

## Success Criteria

- **SC-001**: Home's first screen after the hero shows ≥ 6 visually distinct tool tiles without scrolling past one viewport height.
- **SC-002**: axe: 0 violations for `/` and `/tools` in all six themes; no layout overflow at 320px.
- **SC-003**: All tiles reachable and operable by keyboard; Enter opens the tool.
- **SC-004**: Existing suites pass; added tests cover FR-001…FR-009.

## Out of Scope

Third-party imagery/branding; photography; scroll-driven animation; changing individual tool pages; the filterable catalog (unchanged).
