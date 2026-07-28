# Phase 0 Research: JSON Linter & Formatter

Retroactive record of technical decisions visible in the shipped implementation.

## R1 — Separate read-only output pane instead of in-place editing

**Decision**: Format/Minify/Sort/Convert write into a distinct read-only `outputModel`
rather than replacing the input editor's content in place.

**Rationale (inferred from behavior)**: keeps the user's original input always recoverable
without needing an undo stack, and lets the tool show a labeled, format-specific view
("Minified", "Sorted Keys", "YAML (Converted)") side-by-side with the source — closer to a
"preview" workflow than a "mutate in place" one. This is the direct explanation for why the
pre-migration SPEC.md's undo-stack requirement (§4.2) doesn't apply to the actual design —
see spec.md Assumptions.

**Alternative rejected**: in-place replacement with a manual undo stack (as the old SPEC.md
prose described) — would require extra state management for a problem the two-pane design
avoids structurally.

## R2 — 600ms debounce for live validation

**Decision**: `liveValidate()` runs 600ms after the last keystroke (`clearTimeout` +
`setTimeout` pattern), not on every keystroke.

**Rationale**: `JSON.parse` on a large document on every keystroke would be wasteful and
could visibly lag typing; 600ms is long enough to avoid re-parsing mid-keystroke-burst,
short enough to feel live.

## R3 — Reusing `js-yaml` for the YAML conversion instead of a bespoke serializer

**Decision**: The YAML conversion action calls the same `js-yaml` library
(`static/libs/js-yaml.min.js`) that the YAML Linter (`004-yaml-linter`) uses for parsing.

**Rationale**: One vendored YAML library serves both tools' YAML needs (parse in
`004-yaml-linter`, dump here) — avoids a second YAML dependency for a single conversion
button.
