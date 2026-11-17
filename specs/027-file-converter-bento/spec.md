# Feature Specification: File Converter — Bento Redesign

**Created**: 2026-11-17 | **Status**: Draft | **Extends**: `specs/013-file-converter` (this is a presentation redesign; conversion behavior is unchanged)

**Input**: User screenshot of the current converter (sparse centered text, tiny chips) with the request to redesign it using the richer bento visual language introduced in `specs/026-bento-showcase`.

## Problems in the current UI

- The drop target is a faint dashed box with a thin icon; the page reads as empty.
- From/To selectors and Convert sit in a floating row with no grouping.
- "Supported conversions" is tiny monospaced chips in four unlabelled columns; the "yellow = needs server" legend is hard to read.

## User Stories

1. **P1 — The primary action is obvious.** A large colour-tinted drop tile with generated artwork (a document turning into another) and one clear instruction; dragging a file over it gives strong feedback; after choosing a file its name and size appear in the tile's footer.
2. **P1 — Choosing formats and converting is one grouped step.** A "Convert" panel beside the drop tile holds From → To selectors and a full-width pill Convert button plus Reset.
3. **P2 — Supported conversions are browsable.** Four category tiles (Data, Spreadsheet, Documents, Images), each with its own hue and small artwork, containing legible chips; server-side conversions are marked consistently and the legend is readable.
4. **P2 — Works everywhere.** All six themes, 12→6→1 column responsive, keyboard operable, reduced-motion safe, axe-clean.

## Functional Requirements

- **FR-001**: All existing element ids and the JS-toggled classes (`drag-over`, `has-file`, `loading`) are preserved; no change to conversion logic, endpoints, or limits.
- **FR-002**: Layout: bento grid (`.cv-grid`) with drop tile (7 cols) + convert panel (5 cols); result area full width; four category tiles below; stacked on narrow screens.
- **FR-003**: Artwork reuses the generated-SVG renderer (`bento-art.js`) with new pictures `convert`, `sheet`, `doc`, `image` (decorative, `aria-hidden`); no images/network/HTML-string injection.
- **FR-004**: Colours come only from theme tokens via `color-mix()` (no hex in the new stylesheet); text contrast ≥ 4.5:1 in all six themes.
- **FR-005**: Server-required chips are visually distinct (amber tint **and** a text/shape cue, not colour alone) and the legend explains it.
- **FR-006**: Tests: art data (JS), markup/ids/asset checks (Python), browser verification (axe ×6 themes, screenshots, a real conversion still works, 320px no overflow).

## Success Criteria

- **SC-001**: Axe 0 violations on `/file-converter` in all six themes.
- **SC-002**: A JSON→YAML conversion through the redesigned page produces the same output as before.
- **SC-003**: Existing suites pass.
