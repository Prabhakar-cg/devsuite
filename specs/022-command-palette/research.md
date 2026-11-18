# Phase 0 Research: Command Palette

All items below were resolved by reading the actual current source (not assumed), per
this project's "verify against source" rule. No `NEEDS CLARIFICATION` markers remained
after spec validation, so this phase is confirmation/decision-recording, not open
discovery.

## 1. Injection point: `deps.py::_serve_html()`

**Decision**: Extend `_serve_html()` to inject, in order:
1. `<link rel="stylesheet" href="/static/command-palette.css">` — inserted the same way
   the existing favicon tag is (`html.replace('<head>', ...)`), immediately after it.
2. `<script src="/static/command-palette-data.js" defer></script>` then
   `<script src="/static/command-palette.js" defer></script>` — inserted via
   `html.replace('</body>', ..., 1)`, i.e. appended after every existing page script.

Both insertions happen **before** the existing `_STATIC_ASSET_RE.sub(...)` call, so the
new references get the same automatic content-hash cache-busting as every other asset
with no special-casing.

**Rationale**: This is the existing, established pattern (`_serve_html()` already does
exactly this for the favicon `<link>`) — reusing it means zero edits to any of the 18
static HTML files, and any future 16th tool page gets the palette automatically.

**Alternatives considered**:
- Adding `<script>`/`<link>` tags to all 18 HTML files individually — rejected: 18-file
  diff for a suite-wide concern, and any future tool page would need to remember to add
  it (exactly the kind of manual-sync debt CLAUDE.md's gotchas list already warns about
  for tool counts).
- Piggybacking the bootstrap onto `static/theme.js` (loaded on 17 of 18 pages already) —
  rejected: mixes an unrelated concern into the theming module, and still misses
  `db-manager.html`, which doesn't load `theme.js`. The `_serve_html()` injection covers
  all 18 pages uniformly including that one.

## 2. Pre-existing Ctrl/Cmd+K conflict: `static/notes.js`

**Finding**: `static/notes.js` (around its `DOMContentLoaded` wiring) already has:
```js
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearchModal(); }
    ...
});
```
This opens Notes Workspace's own in-page "search notes" modal on Ctrl/Cmd+K. A second,
independent `document`-level keydown listener for the command palette would not be
suppressed by this existing listener's `preventDefault()` (which only prevents the
browser's own default action, not other JS listeners), so without a deliberate decision
both the notes search modal and the command palette would try to open simultaneously on
`/notes` — a broken, confusing double-open.

Grepping the rest of `static/*.js` for other `ctrlKey`/`metaKey` + `k`/`K` combinations
found no other conflicts — this is the only page with a pre-existing Ctrl/Cmd+K binding.

**Decision**: `command-palette.js` maintains a small, explicit exemption list of routes
with their own pre-existing Ctrl/Cmd+K binding — currently just `/notes` — and skips
attaching the *keyboard* shortcut on an exact match of `location.pathname` against that
list. The visible header trigger button (FR-002/US3) is **not** exempted and still opens
the palette by click on every page, including `/notes` — only the keyboard shortcut
defers to the page's existing binding there.

**Rationale**: Deterministic and simple to reason about and test — no dependency on
listener-attachment order or `e.defaultPrevented` timing tricks between two independently
loaded scripts, and zero risk of regressing Notes Workspace's existing search feature.
Self-contained in the new module; no edit to `notes.js` needed.

**Alternatives considered**:
- Checking `e.defaultPrevented` inside the palette's handler and backing off if another
  handler already consumed the key — rejected: only works if the palette's listener
  fires *after* `notes.js`'s, which depends on script load/attachment order that isn't
  guaranteed deterministic across browsers or future script-tag reordering, and is much
  harder to unit test.
- Renaming/removing Notes Workspace's own Ctrl+K binding — rejected: out of scope
  (regresses an existing, working feature) and not requested by the spec.

## 3. Content-Security-Policy impact

**Finding**: `main.py`'s document CSP (`_DOCUMENT_CSP`) already includes
`script-src 'self' 'unsafe-inline' blob:;` (the `'unsafe-inline'` presence is pre-existing
tracked debt, SEC-11 — not something this feature touches or worsens). Same-origin
external scripts and stylesheets are always permitted under `'self'` with no directive
change needed.

**Decision**: No CSP changes required. The two new `<script src="/static/...">` tags and
the one `<link rel="stylesheet" href="/static/...">` tag are same-origin static files,
already covered by the existing document CSP on every page (including the scoped
`_SANDBOX_WORKER_PATH` and `_WS_TESTER_CSP` variants, which only widen `connect-src`/
`script-src` for their own specific paths and don't restrict `/static/*.js`/`.css`
elsewhere).

## 4. Native `<dialog>` for the palette shell

**Finding**: `static/api-tester.html` already uses native `<dialog>` for six modals; its
close-on-backdrop-click pattern (`static/api-tester.js`) is:
```js
els.envModal.addEventListener('click', (e) => { if (e.target === els.envModal) closeEnvModal(); });
```
(A click on the `<dialog>` element's own padding/backdrop area — not on its content —
has `e.target === dialog`; a click on content inside it does not, since the click target
is the inner element.)

**Decision**: `command-palette.js` reuses this exact pattern for its own `<dialog>`, and
uses `dialog.showModal()` / `dialog.close()` for open/close — native `showModal()` already
provides the focus-trapping and `Escape`-to-close behavior FR-016/FR-009 require, with no
custom focus-trap JS needed.

**Rationale**: Consistent with the codebase's own established (if only half-adopted)
modern-modal pattern; satisfies FR-009/FR-016 "for free" via the platform rather than
hand-rolled JS, which is also the direction flagged as a general suite improvement in
this session's earlier UI review (`vault.js`/`ssh-manager.js`/`notes.js`/
`sftp-browser.js` still hand-roll `.modal-overlay` divs — this feature doesn't fix those,
but doesn't add a fifth hand-rolled instance either).

## 5. `test_asset_order.py` regression risk

**Finding**: The existing test's `_script_order()` helper extracts every
`<script src="...">` tag (regex `<script src="([^"?]+)`) from a page's rendered HTML and
asserts specific *relative* orderings (UMD bundles before `require.min.js` on `/api-tester`
and `/diff`; `components.js` before `vault.js` on `/vault`). It does not assert an
exhaustive/exact list of scripts or their count.

**Decision**: Injecting the two new script tags immediately before `</body>` — i.e. after
every existing script tag already present in each page — cannot change the relative order
of any pair of *pre-existing* tags, so none of `test_asset_order.py`'s current assertions
can break. Confirmed by re-running the full existing suite after implementation (task in
`tasks.md`), not assumed from reading alone.

## 6. Destination data source of truth

**Finding**: `static/tools.html`'s 15 `tool-card` anchors and `routes/pages.py`'s route
list were both read directly (not guessed) to build the 17-entry destination list in the
spec (15 tools + Home + Tools Hub, `/base64` deliberately excluded — see spec Assumptions).

**Decision**: `command-palette-data.js`'s `DESTINATIONS` array is authored by hand from
that verified list, not generated/scraped from `tools.html` at build or runtime (no build
step exists to do so, and runtime-scraping the Tools Hub's DOM from every other page would
mean the palette silently breaks if `tools.html`'s markup shape ever changes). This makes
`command-palette-data.js` a **third** manually-synced copy of the tool list, alongside
`routes/pages.py` + `static/tools.html` (already tracked as a sync point in
`.specify/memory/constitution.md`'s "Additional Constraints"). Flagged for the ship-time
documentation task to extend that existing sync-point note to mention this file too.
