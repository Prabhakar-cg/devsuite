# Phase 1 Data Model: Command Palette

Both entities described here are in-memory, client-side, and ephemeral — no DevDB store,
no backend model, no persistence. This mirrors the spec's Key Entities section with
concrete field shapes for implementation.

## Destination

One navigable entry in the palette. Defined statically in `command-palette-data.js` as a
plain array — not fetched, not user-editable.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable short key, e.g. `"diff"`, `"folder-diff"`, `"vault"` — used for tests and as a DOM `data-` attribute, not shown to the user. |
| `name` | string | Display name shown in the list, e.g. `"Text Diff"`, `"Secret Vault"`. Matches the name on the corresponding `tools.html` card exactly. |
| `route` | string | Target URL, e.g. `"/diff"`, `"/diff?tab=folder-diff"`, `"/vault"`. Navigated to via `location.href = route` on selection. |
| `category` | string | One of: `dev`, `data`, `security`, `network`, `time`, or `nav` (for the two non-tool entries, Home and Tools Hub). Matches `tools.html`'s existing `data-category` values for the 15 tools. |
| `keywords` | string[] | Extra search terms beyond the name, e.g. ID Generator → `["uuid", "ulid", "cuid", "nanoid", "identifier"]`; Crypto Suite → `["jwt", "hash", "aes", "rsa", "hmac", "base64"]`. Authored by hand per spec SC-006. |
| `icon` | string (inline SVG markup) | The tool's existing stroke-SVG icon markup, copied from its `tools.html` card for visual consistency (spec: "reuse each tool's existing icon SVG markup ... rather than inventing new icon art"). |

The full 17-entry array (15 tools + Home + Tools Hub) is authored directly from the
verified list in `research.md` §6.

### Validation rules

- `route` must be a same-origin relative path (`/...`) — never an absolute URL to another
  origin (this is suite-internal navigation only, Constitution Art. II).
- `name` and `category` must be non-empty; `keywords` may be an empty array (not every
  entry needs extra keywords — e.g. "Text Diff" is unambiguous on its own).
- No two entries share an `id`.

## Palette Session (transient UI state)

Lives entirely inside `command-palette.js`'s closure/module state while the `<dialog>` is
open; discarded on close (spec FR-010 — no state carries over between openings).

| Field | Type | Notes |
|---|---|---|
| `query` | string | Current text in the search input. Reset to `""` on every open. |
| `filtered` | Destination[] | Result of `matchDestinations(query, DESTINATIONS)` — recomputed on every keystroke. |
| `highlightedIndex` | integer | Index into `filtered` currently highlighted via arrow keys. Reset to `0` on every open and whenever `filtered` changes (e.g. clamped if the list shrinks below the previous index). |
| `isOpen` | boolean | Whether the `<dialog>` is currently shown. Guards against a second open (spec FR-015). |

## `matchDestinations(query, list)` — the pure filter function

Lives in `command-palette-data.js`, alongside the `DESTINATIONS` array, so it is
node-testable without a browser or DOM (mirrors `static/ws-utils.js`'s
`normalizeWsUrl`/`parseProtocols` pattern).

**Signature**: `matchDestinations(query: string, list: Destination[]) -> Destination[]`

**Behavior**:
- Empty/whitespace-only `query` → returns `list` unchanged (full 17 entries), satisfying
  FR-004/FR-010.
- Non-empty `query` → case-insensitive substring match against `name`, `category`, and
  each entry in `keywords`; an entry is included if *any* of those fields contains the
  (lowercased) query as a substring (FR-005).
- No side effects, no DOM access, pure function of its two arguments — this is what makes
  it directly unit-testable in `tests/javascript/test_command_palette_data.js`.
