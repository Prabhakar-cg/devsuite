# Phase 1 Data Model: Data Format Linter

No persistence. This tool has no DevDB store and no backend state — every entity below is
transient, in-memory JavaScript state scoped to the open browser tab and discarded on reload,
matching all three predecessors.

## Entities

### Active Tab *(planned `data-linter.html` inline script)*
| Field | Type | Notes |
|-------|------|-------|
| value | `'json' \| 'yaml' \| 'xml' \| 'toon'` | drives Monaco language mode, visible action buttons (via each button's `data-tabs` attribute, research.md R2), and which parser live validation/actions use |

### Parsed Value *(per-format, produced by each tab's own parse function)*
| Field | Type | Notes |
|-------|------|-------|
| ok | `boolean` | true if the active tab's parser succeeded |
| data / doc | format-specific | JSON tab: parsed JS value (`JSON.parse` result). YAML tab: `jsyaml.loadAll` result (object/array). XML tab: parsed `Document` (from `DOMParser`). TOON tab: `toonDecode()` result (plain JS value) |
| error / message | format-specific | JSON/YAML/TOON: the parser's thrown `Error`/`YAMLException`/decode error. XML: extracted `parsererror` text (`015-xml-linter` data-model.md R2) |

This is the same per-format shape each predecessor already had (`003-json-linter`/
`004-yaml-linter`/`015-xml-linter` data-model.md) — carried over unchanged, not unified into a
single cross-format type, per research.md R1. (Conversion, below, is the one place a unified
shape is used — deliberately, per research.md R6.)

### Canonical Value *(new — conversion hub, research.md R6)*
| Field | Type | Notes |
|-------|------|-------|
| — | plain JS `object \| array \| string \| number \| boolean \| null` | The shape every format's parser produces and every format's serializer consumes when converting. `toCanonicalValue(tab, raw)` produces it; `fromCanonicalValue(format, value)` consumes it. JSON/YAML already parse directly into this shape; XML goes through `xmlToJsonValue()` (research.md R7/R8); TOON goes through `toonDecode()`. |

### Input Document
The raw text in the input editor — a single Monaco model shared across all four tabs
(spec.md FR-002: tab switches never alter this text).

### Output Document
A separate, read-only Monaco model that the active tab's actions write into; reset to empty on
every tab switch (research.md R5) and every Clear.

### UI State (not modeled as objects, but tracked as DOM/closure state)
- `lastOutput` — the most recent output text, used by Copy Output.
- Status pill state — one of idle / valid / invalid, scoped to the active tab's last
  Parsed Value.

### Detected Format *(new — research.md R9/R10)*
| Field | Type | Notes |
|-------|------|-------|
| — | `'json' \| 'yaml' \| 'xml' \| 'toon' \| null` | Return value of `detectFormat(raw)`; consumed by `detectAndSwitch()`, which calls `setActiveTab()` only when it differs from the current Active Tab. Never persisted — recomputed fresh on every paste/Detect click, never on typing. |

## Error hierarchy

None — each tab surfaces its own underlying parser's error/message as-is, exactly as its
predecessor standalone tool did; no cross-format error type is introduced (research.md R1).

## No JSON envelope

This tool has no backend API surface beyond page serving (see
[contracts/http-api.md](contracts/http-api.md)), so there is no request/response envelope to
document.
