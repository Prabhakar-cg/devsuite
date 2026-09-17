# Data Model — ID Generator (019)

This tool persists nothing. All "entities" below are transient, in-memory, client-side values —
there is no DevDB store, no schema, no migration, and no server-side representation. This document
captures their shape only so the UI controller and the pure module agree on contracts.

## Entity: IdType (static, per-type facts)

The pure module exposes a table keyed by type id. Purely descriptive; never mutated.

| field            | type    | notes                                                                 |
|------------------|---------|-----------------------------------------------------------------------|
| `id`             | string  | `"uuid4" \| "uuid7" \| "ulid" \| "cuid2" \| "nanoid"`                 |
| `label`          | string  | Display name, e.g. `"UUID v4"`                                        |
| `totalBits`      | number  | Total bit length (128 for UUIDs/ULID; N/A-ish for text ids)          |
| `randomBits`     | number  | Bits of randomness (uuid4 → 122, uuid7 → 74, ulid → 80, nanoid → ~126)|
| `timeBits`       | number  | Size of embedded timestamp in bits (uuid7 → 48, ulid → 48, else 0)    |
| `timeSortable`   | boolean | Whether lexicographic order ≈ creation order (uuid7, ulid → true)     |
| `decodesTime`    | boolean | Whether a generated value's timestamp can be decoded (uuid7, ulid)    |
| `blurb`          | string  | One-line human description for the entropy panel                     |

### Concrete values

| type    | totalBits | randomBits | timeBits | timeSortable | decodesTime |
|---------|-----------|------------|----------|--------------|-------------|
| uuid4   | 128       | 122        | 0        | false        | false       |
| uuid7   | 128       | 74         | 48       | true         | true        |
| ulid    | 128       | 80         | 48       | true         | true        |
| cuid2   | ~124\*    | ~120\*     | 0        | false        | false       |
| nanoid  | 126       | 126        | 0        | false        | false       |

\* CUID2 is a base36 string of default length 24; its bit figures are approximate usable-entropy
estimates, reported as "~" in the UI, not exact power-of-two field widths.

## Entity: GeneratedBatch (transient)

Produced by one Generate action; replaced wholesale on the next (FR-003, US1 scenario 3).

| field    | type       | notes                                              |
|----------|------------|----------------------------------------------------|
| `typeId` | string     | The `IdType.id` the batch was generated as         |
| `values` | string[]   | Ordered generated identifiers; length = user count |

Never stored (FR-014). Held only in a JS variable for the lifetime of the page/redraw.

## Entity: EntropyReport (derived, display-only)

Computed from the selected `IdType` on selection change; no independent state. Drives the entropy
panel: total bits, random bits, timestamp component + meaning, and the sortability note (FR-010).

## Entity: DecodedTimestamp (derived, on demand)

For a single time-based value (uuid7/ulid), the module decodes the embedded 48-bit ms timestamp and
returns `{ ms: number, iso: string }` for human-readable display (FR-013). Undefined for types with
`decodesTime === false`.

## Validation rules (enforced in the DOM controller before calling the module)

- `count` must be an integer `1 ≤ count ≤ 1000` (FR-002, FR-011, FR-012). Blank / non-numeric /
  `≤ 0` / `> 1000` → inline error, no generation, prior batch untouched.
- Secure-randomness precondition: if `crypto.getRandomValues` is unavailable, block generation with
  a clear message (FR-005 edge case).
