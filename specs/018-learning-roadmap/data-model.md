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
| `url` | string | May be empty string (placeholder link, per spec.md Edge Cases). Not validated as a well-formed URL server-side; rendered as non-clickable text client-side when empty. |

The seeded roadmap's `documents` entries are relative URLs of the form
`/roadmap/docs?doc=<slug>&title=<url-encoded title>` — a step's own original reference guide,
authored to `static/roadmap-docs/<slug>.md` and rendered read-only by `roadmap-doc-viewer.html`
(contracts/roadmap-api.md). `course_links` entries are absolute `https://` URLs to external
resources instead. Both shapes are ordinary `Link` records to the client; there is no field-level
distinction between "internal doc" and "external course" beyond which array they live in.

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

- Step completion = `round_half_up(100 * done_count / total_count)` if `total_count > 0`, else `0`
  (never divide by zero, never emit `NaN`).
- Roadmap completion = `round_half_up(mean(step_completions))` if the roadmap has ≥1 step, else `0`
  (a roadmap with zero steps is 0%, not an error — spec.md Edge Cases).
- **Rounding policy**: ties round up (half-up, `floor(x + 0.5)`), matching JavaScript's
  `Math.round`. This is deliberate, not the language default: Python's builtin `round()` uses
  round-half-to-even and disagrees with `Math.round` at exact `.5` midpoints (e.g. a step with 1
  of 8 checklist items done is exactly 12.5% — `round(12.5) == 12` in Python vs
  `Math.round(12.5) === 13` in JS). `roadmap_utils._round_half_up` and
  `static/roadmap-utils.js`'s `computeStepPct`/`computeRoadmapPct` both implement this same
  half-up rule so the client's optimistic percentage always matches the server's authoritative
  one, including at midpoints.
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

Shape only — see `scripts/seed_roadmap.py` for the real seeded content (each step actually ships
15+ checklist items and several `course_links`/one `documents` entry, per FR-018).

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
      "checklist": [
        {"id": "item-1-1", "text": "Tokenize the same paragraph with tiktoken cl100k_base, o200k_base, and the Llama 3 tokenizer...", "done": false}
      ],
      "course_links": [
        {"title": "Stanford CS336: Language Modeling from Scratch", "url": "https://cs336.stanford.edu/"}
      ],
      "documents": [
        {"title": "ML/LLM systems fundamentals — DevSuite Guide", "url": "/roadmap/docs?doc=step-1-ml-llm-fundamentals&title=ML%2FLLM%20systems%20fundamentals"}
      ]
    }
  ]
}
```
