# Phase 1 Data Model: Cron Visualizer

No persistence — everything below is an in-memory, client-side model recomputed on each parse.
Shapes as observed in `static/cron.js`.

## Enumerations / static data

### Dialect id

`unix` | `quartz` | `aws` | `github`

### `DialectDefinition` *(one entry per dialect in `DIALECTS`)*

| Field | Type | Notes |
|---|---|---|
| `id` | `str` | matches the dialect key |
| `label` | `str` | display name |
| `fields` | `str[]` | e.g. `['minute','hour','dom','month','dow']` |
| `fieldLabels` | `str[]` | human labels, index-aligned with `fields` |
| `fieldRanges` | `{min:int, max:int}[]` | index-aligned with `fields` |
| `supportsQuestion` / `supportsL` / `supportsW` / `supportsHash` / `supportsYear` | `bool` | which special tokens/fields this dialect accepts |
| `example` | `str` | shown as placeholder guidance |
| `placeholder` | `str` | input placeholder text |

### `Preset` *(entries in `PRESETS[dialectId]`)*

| Field | Type | Notes |
|---|---|---|
| `label` | `str` | e.g. "Weekdays at 9 AM" |
| `expr` | `str` | the cron expression string |

## Runtime entities

### `ParsedExpression` *(produced by `CronParser.parse`)*

| Field | Type | Notes |
|---|---|---|
| `valid` | `bool` | overall validity |
| per-field parsed value | varies | structured representation of each field's tokens (values/ranges/steps/specials) for fields that parsed successfully |
| `error` | `{field, token, fieldName, message}` (when invalid) | field-attributed, not a generic string — surfaced verbatim as the invalid-status explanation |

### `NextRunTime` *(produced by the next-10-runs search)*

| Field | Notes |
|---|---|
| timestamp | one future matching minute, found by forward brute-force iteration |
| locale date/time | formatted for display |
| relative countdown | e.g. "in 42 minutes" |

### `HeatmapDay` *(one of the 28-Day Activity Heatmap's cells)*

| Field | Notes |
|---|---|
| date | one of the 28 rendered calendar days |
| intensity | relative run-frequency shading for that day |
| tooltip detail | shown on hover |

## State/derivation rules

- `ParsedExpression` is the single source of truth downstream: the status pill, description
  text, field-builder grid state, and (if valid) the next-runs/heatmap computations all derive
  from it — none of them re-parse the raw string independently.
- Editing the raw text field re-runs the parser (debounced); toggling a Field Builder cell
  rewrites only that field's segment of the raw text, then re-runs the same parser — there is no
  separate "grid state" that can drift from the text representation.
- `NextRunTime` and `HeatmapDay` computations are only attempted when `ParsedExpression.valid` is
  true; an invalid expression clears/hides both panels rather than showing stale results.
