# Phase 1 Data Model: Diff Checker

No persistence layer — this feature has no DevDB store and nothing survives a page reload.
All state below is in-memory JavaScript state in `static/app.js`.

## Entities

### Diff Panel *(in-memory — `static/app.js`)*
| Field | Type | Notes |
|-------|------|-------|
| `content` | `string` | current panel text (Monaco model value) |
| `lineCount` | `number` | derived via `countLines()`, updated on every keystroke |
| `sourceFilename` | `string \| null` | set when populated via `/upload`; null when pasted directly |

### Upload Response *(server → client, `POST /upload`)*
| Field | Type | Notes |
|-------|------|-------|
| `filename` | `string` | original uploaded filename |
| `content` | `string` | UTF-8 decoded content (`errors="replace"`) |
| `size_bytes` | `int` | raw byte length before decoding |

### Diff Stats *(derived, re-computed on every compare/merge)*
| Field | Type | Notes |
|-------|------|-------|
| `additions` | `number` | summed from Monaco's line-change model, `static/app.js:452-473` |
| `deletions` | `number` | same |
| `hunks` | `number` | number of discrete change blocks (labeled "changes"/"hunks" in the UI) |

### Folder Tree Node *(folder-diff mode only)*
| Field | Type | Notes |
|-------|------|-------|
| `path` | `string` | relative file/dir path, `localeCompare()`-sorted for display |
| `status` | `"added" \| "removed" \| "modified" \| "unchanged"` | propagated bottom-up through directory nodes via `propagateFolderStatuses()` |
| `children` | `FolderTreeNode[]` | present for directory nodes |

## Notes

- No enumerations, no error hierarchy, no JSON envelope — this is a browser-only feature
  aside from the one plain-JSON `/upload` response above.
- Nothing here is written to DevDB; `007-crypto-suite`/`011-secret-vault`/etc. are the
  tools with real persisted entities.
