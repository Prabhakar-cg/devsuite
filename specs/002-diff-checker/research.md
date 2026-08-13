# Phase 0 Research: Diff Checker

Retroactive record of the technical decisions visible in the shipped implementation.

## R1 — Monaco's built-in diff editor instead of a custom diff algorithm

**Decision**: Use `monaco.editor.createDiffEditor` for both text-diff and folder-diff
rendering rather than shipping a bespoke diff/patch library.

**Rationale**: Monaco is already a required dependency (JSON/YAML/Regex all use it), so
reusing its diff editor avoids adding a second diffing library, and gives merge glyphs,
inline/side-by-side rendering, and syntax highlighting for free.

**Alternative rejected**: A dedicated JS diff library (e.g. `jsdiff`) would need custom
rendering and hunk-merge UI built from scratch, duplicating what Monaco already ships.

## R2 — Streamed, chunked upload validation

**Decision**: `_read_upload_stream` reads in 1 MB chunks, checks the first chunk's first
512 bytes for a null byte (binary heuristic), and aborts with HTTP 413 as soon as the
running total exceeds 50 MB — rather than buffering the whole file then checking.

**Rationale**: Avoids holding an oversized upload fully in memory before rejecting it;
bounds worst-case memory use to roughly one chunk beyond the 50 MB cap.

**Alternative rejected**: Read-then-check (simpler code, but a malicious or accidental
huge upload would be fully buffered before rejection).

## R3 — Folder diff via `webkitdirectory`, not a zip upload

**Decision**: Folder comparison uses `<input type="file" webkitdirectory directory
multiple>` to let the browser enumerate a local directory tree client-side, rather than
requiring the user to zip both folders and upload them.

**Rationale**: Keeps folder diffing fully offline/client-side (no data leaves the browser
at all for this mode, since there's no upload involved) and avoids a round trip through
`/upload` for potentially many files.

**Trade-off (documented in spec.md Edge Cases)**: `webkitdirectory` is a non-standard but
widely supported browser API; no fallback exists for browsers without it.

## R4 — Two upload size limits in the same codebase

**Decision**: `/upload` (this feature) allows 50 MB; `/api/convert` (File Converter,
`013-file-converter`) allows 20 MB. Documented explicitly rather than unified, since the
two tools have different practical file sizes (diffable text vs. convertible documents).

**Rationale (as documented in SPEC.md §4.12)**: kept as separate, intentional constants —
not treated as an inconsistency to fix.
