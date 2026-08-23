# Data Model: Learning Roadmap

DevDB store name: **`roadmaps`**. Shape: a dict keyed by roadmap id → roadmap record (same
top-level shape convention as every other DevDB store — `devdb.get_store("roadmaps")` returns
`{ "<id>": {...roadmap...}, ... }`).

## Roadmap

| Field | Type | Notes |
|---|---|---|
| `id` | string (slug) | Primary key, matches the dict key it's stored under. Immutable after creation (FR-004/FR-005). Validated on create: `^[a-z0-9][a-z0-9-]*$`, non-empty, not already present in the store. |
| `title` | string | Required, non-empty. Editable (FR-006). |
| `description` | string | Optional, defaults to `""`. Editable (FR-006). |
| `created_at` | ISO-8601 UTC string | Set once at creation, never changed. |
| `updated_at` | ISO-8601 UTC string | Updated on any mutation to the roadmap or any of its steps. |
| `steps` | array of **Step** | Ordered by each step's `order` field, not array position (FR-014). |

Computed, never stored (FR-013): `completion_pct` (int 0–100) — see Completion Computation below.

## Step

| Field | Type | Notes |
|---|---|---|
| `id` | string (slug) | Unique within the parent roadmap only (not globally). Set at step creation, immutable. |
| `order` | integer | Explicit sort key (FR-014). |
| `title` | string | Required, non-empty. |
| `description` | string | Optional, defaults to `""`. |
| `notes` | string | Markdown text. Defaults to `""`. Edited via Monaco (research.md item 3) — stored as plain text, not rendered/sanitized server-side. |
| `checklist` | array of **Checklist Item** | Order matches array order (no separate ordering field needed — checklist items are not independently referenced). |
| `course_links` | array of **Link** | |
| `documents` | array of **Link** | |

Computed, never stored (FR-011): `completion_pct` (int 0–100).

## Checklist Item

| Field | Type | Notes |
|---|---|---|
| `id` | string (slug) | Unique within the parent step only. |
| `text` | string | Required, non-empty. |
| `done` | boolean | Defaults to `false`. Sole input to the step's `completion_pct`. |

## Link (shared shape for `course_links` and `documents`)

| Field | Type | Notes |
|---|---|---|
| `title` | string | Required, non-empty. |
| `url` | string | May be empty string (placeholder link, per spec.md Edge Cases — e.g. seed data ships a document with a title and no URL yet). Not validated as a well-formed URL server-side; rendered as non-clickable text client-side when empty. |

## Completion Computation (`roadmap_utils.compute_completion`)

Pure function, no I/O, no DevDB access — takes a roadmap dict, returns:

```jsonc
{
  "roadmap_pct": 50,              // int 0-100
  "steps": {
    "step-1": 100,
    "step-2": 0,
    "step-3": 50
  }
}
```

Rules (FR-011, FR-012, spec.md Edge Cases):

- Step completion = `round(100 * done_count / total_count)` if `total_count > 0`, else `0`
  (never divide by zero, never emit `NaN`).
- Roadmap completion = `round(mean(step_completions))` if the roadmap has ≥1 step, else `0`
  (a roadmap with zero steps is 0%, not an error — spec.md Edge Cases).
- Every step counts equally regardless of its checklist length (locked design decision:
  "equal weight — steps are not weighted differently in v1").
- This function is called fresh on every `GET /api/roadmaps` (per-roadmap `roadmap_pct` only, for
  the list view) and every `GET /api/roadmaps/{id}` (full breakdown, for the detail view) — the
  result is never written back into the stored record (FR-013).

## Validation / Error Rules (drive route behavior — see `contracts/roadmap-api.md`)

- Creating a roadmap whose `id` already exists in the store → reject (FR-005).
- Any operation (`PUT`/`DELETE`/`PATCH`/checklist-toggle) referencing a roadmap id, step id, or
  checklist-item id that does not exist in the store → reject with a clear error, not a silent
  no-op and not implicit creation of new state (FR-019).
- `title` (roadmap or step) and checklist-item `text` must be non-empty after trimming.

## Example Record

```json
{
  "id": "ai-mlops-roadmap",
  "title": "AI/MLOps & Agentic AI Infrastructure",
  "description": "Learning path from platform/DevOps into MLOps and agentic AI infra.",
  "created_at": "2026-08-23T00:00:00Z",
  "updated_at": "2026-08-23T00:00:00Z",
  "steps": [
    {
      "id": "step-1",
      "order": 1,
      "title": "ML/LLM systems fundamentals",
      "description": "Model training vs. inference, tokens, embeddings, quantization, GPU memory math, LLM request lifecycle.",
      "notes": "",
      "checklist": [],
      "course_links": [],
      "documents": []
    }
  ]
}
```
