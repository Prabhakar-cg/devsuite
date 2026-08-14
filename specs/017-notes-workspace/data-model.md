# Phase 1 Data Model: Notes Workspace

All entities below live inside **one** JSON document — the decrypted body of
the `notes` DevDB store's blob (see `research.md` item 1). There is no
server-side schema; the backend only ever stores/returns the opaque envelope
in §5. Everything in §1–4 exists solely in-browser, in memory, after unlock.

## 1. Notebook

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Stable identifier; never reused. |
| `name` | string | Display name. Non-empty. |
| `sectionOrder` | string[] | Ordered list of `Section.id` — defines display/drag-reorder order (FR-002). |
| `createdAt` / `updatedAt` | number (epoch ms) | For sorting and diagnostics only; not shown as a primary UX element. |

Deleting a notebook cascades to all its sections and their pages (edge case:
requires confirmation naming the page count that will be removed, FR-per
Edge Cases section of spec.md).

## 2. Section

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | |
| `notebookId` | string | Parent `Notebook.id`. |
| `name` | string | Non-empty. |
| `pageOrder` | string[] | Ordered list of `Page.id` within this section (FR-003, drag-reorder). |
| `createdAt` / `updatedAt` | number | |

## 3. Page

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | |
| `sectionId` | string | Parent `Section.id`. |
| `title` | string | **Unique across the entire workspace**, case-insensitive/trimmed (FR-013). Validated on create/rename. |
| `body` | string | Raw Markdown source. This is the single field the editor reads/writes. |
| `createdAt` / `updatedAt` | number | |

`tags` and `outgoingLinks` are **not** stored fields — they are derived at
load time (and after every edit) by scanning `body`, per `research.md` item
6. Storing them redundantly would risk drifting out of sync with the text;
deriving them keeps `body` the single source of truth.

### Derived: Tag index (in-memory only)

Built once per tree load/mutation: `Map<tagName, Set<pageId>>`, populated by
scanning every page's `body` for `#word` tokens (FR-014/FR-015). Not
persisted — rebuilt from `body` text on every load.

### Derived: Wiki-link index (in-memory only)

Built the same way, from `[[Page Title]]` tokens in `body`:

- `titleIndex: Map<normalizedTitle, pageId>` — normalized = lowercased +
  trimmed, used to resolve links and enforce FR-013's uniqueness rule.
- `backlinks: Map<pageId, Array<{ fromPageId, snippet }>>` — the inverse
  view rendered by the backlinks panel (FR-010). `snippet` is a short
  substring of `body` around the matched `[[...]]` occurrence, computed at
  render time.

An **unresolved** link is simply a `[[Title]]` token whose normalized title
has no entry in `titleIndex`. No separate "unresolved link" record is
stored — resolution status is always computed live from current page
titles, which is what makes rename (FR-011) and delete (FR-012) "just work"
without any migration step: the moment a page's title changes or disappears,
every link's resolved/unresolved status is naturally recomputed on next
index rebuild.

## 4. NotesTree (the whole document)

The actual JSON structure that gets `JSON.stringify`'d and AES-GCM-encrypted
as one blob:

```json
{
  "version": 1,
  "notebooks": { "<notebookId>": { "...Notebook fields..." } },
  "sections":  { "<sectionId>":  { "...Section fields..." } },
  "pages":     { "<pageId>":     { "...Page fields..." } }
}
```

Flat maps keyed by id (not nested arrays) so that renaming/updating a single
page does not require walking/rebuilding the whole notebook→section→page
tree — order is carried separately via `Notebook.sectionOrder` /
`Section.pageOrder`. This `version` is the **tree schema** version (starts
at 1, independent of the encryption envelope's `version: 2` in §5, which
describes the crypto scheme).

**Validation rules** (enforced client-side before any save):

- `Page.title` non-empty, unique workspace-wide (case-insensitive/trimmed).
- `Notebook.name` / `Section.name` non-empty.
- `sectionOrder` / `pageOrder` must exactly match the set of child ids that
  actually exist (no dangling/missing ids) — recomputed defensively on
  every load in case of a partial write.

## 5. Encrypted storage envelope (DevDB `notes` store)

What the server actually sees via `GET/POST /api/notes` — identical shape to
the existing `vault` store:

| Field | Type | Notes |
|---|---|---|
| `encrypted_blob` | string (hex) | AES-256-GCM ciphertext of the JSON in §4. |
| `iv` | string (hex, 24 chars / 12 bytes) | Fresh random IV generated on every save. |
| `salt` | string (hex) | Generated once, on first save; persisted thereafter and reused for every subsequent PBKDF2 derivation of this store's `Kenc`. |
| `version` | number | `2` — the encryption scheme version (`research.md` item 2), not the tree schema version. |

## State / lifecycle notes

- **No draft/unsaved state.** Per FR-006 and `research.md` item 7, the tree
  in memory is always the source of truth for the UI; the debounced save is
  a background sync to DevDB, not a distinct "committed" state the user
  waits on.
- **Rename propagation** (FR-011) is a pure function over §4: find every
  page whose `body` contains `[[OldTitle]]` (case-insensitive/trimmed
  match) and replace with `[[NewTitle]]`, then persist. This touches
  multiple `Page.body` values in the same save, still within one whole-tree
  blob write.
- **Delete** (FR-012) removes the `Page` entry and its id from its parent
  `Section.pageOrder`; it does **not** touch other pages' `body` text —
  their `[[...]]` tokens simply become unresolved per the derivation rule
  above.
