# API Contract: `/api/roadmaps`

All routes live in `routes/roadmap.py`, unauthenticated tier (no `require_unlocked`). All
mutating routes (`POST`/`PUT`/`PATCH`/`DELETE`) require the standard double-submit CSRF pair
(`X-CSRF-Token` header == `ds_csrf` cookie) enforced by the existing global middleware in
`main.py` — after the research.md item 1 fix, every visitor has this cookie from their first
request, so no separate unlock step is needed before mutating.

## `GET /api/roadmaps`

List all roadmaps, summary shape (no step detail).

**200**:
```jsonc
[
  { "id": "ai-mlops-roadmap", "title": "...", "description": "...", "completion_pct": 33,
    "created_at": "...", "updated_at": "..." }
]
```

## `GET /api/roadmaps/{id}`

Full roadmap detail, steps in `order`, each step carrying its own `completion_pct`.

**200**: roadmap record (data-model.md shape) + `completion_pct` on the roadmap and on each step.

**404**: `{ "error": "Roadmap not found" }` — unknown `id`.

## `POST /api/roadmaps`

Create a roadmap. Body: `{ "id": "...", "title": "...", "description": "..." }` (`id` required,
`description` optional). Steps start as `[]`.

**201**: the created roadmap record.

**400**: missing/empty `title`, or invalid `id` (fails the slug pattern).

**409**: `id` already exists.

## `PUT /api/roadmaps/{id}`

Update `title` and/or `description`. Body: `{ "title"?: "...", "description"?: "..." }`.
`id`, `created_at`, `steps` are not modifiable via this route.

**200**: the updated roadmap record.

**404**: unknown `id`.

**400**: `title` provided but empty after trimming.

## `DELETE /api/roadmaps/{id}`

**204**: no body.

**404**: unknown `id`.

## `PATCH /api/roadmaps/{id}/steps/{step_id}`

Update a step's `notes`, `course_links`, and/or `documents` (any subset). Body:
`{ "notes"?: "...", "course_links"?: [{"title","url"}], "documents"?: [{"title","url"}] }`.
`id`, `order`, `title`, `description`, `checklist` are not modifiable via this route (checklist
items are toggled individually — see next route; title/description/order editing is out of scope
for v1's UI per spec.md Assumptions, though the field-level PATCH shape leaves room to extend
this body later without a breaking change).

**200**: the updated step, with its `completion_pct`.

**404**: unknown roadmap `id` or `step_id`.

## `PATCH /api/roadmaps/{id}/steps/{step_id}/checklist/{item_id}`

Toggle (or explicitly set) one checklist item's `done` state. Body: `{ "done": true }` (required
— explicit set, not a blind toggle, so a stale optimistic-UI retry can't flip state twice).

**200**: `{ "item": {"id","text","done"}, "step_completion_pct": 75, "roadmap_completion_pct": 50 }`
— returns both recomputed percentages so the client can update list-view and detail-view display
from one response without a second round-trip.

**404**: unknown roadmap `id`, `step_id`, or `item_id`.

**400**: `done` missing or not a boolean.
