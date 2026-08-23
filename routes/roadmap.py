"""
routes/roadmap.py — Learning Roadmap API (/api/roadmaps*).

Unauthenticated tier (no require_unlocked) — roadmap content is not sensitive
(locked design decision, specs/018-learning-roadmap/spec.md). Structured CRUD
over the DevDB 'roadmaps' store, mirroring routes/storage.py's shape but with
server-side validation (duplicate/unknown-id rejection) instead of a raw blob
passthrough. Completion percentages are always computed on read via
roadmap_utils.compute_completion — never persisted (FR-013).

See specs/018-learning-roadmap/contracts/roadmap-api.md for the full contract.
"""
import re
from datetime import datetime, timezone

import deps
from fastapi import APIRouter, HTTPException

from deps import logger
from roadmap_utils import compute_completion

router = APIRouter()

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _store() -> dict:
    return deps._db.get_store("roadmaps") or {}


def _save(store: dict) -> None:
    deps._db.set_store("roadmaps", store)
    deps._db.save()


def _get_roadmap_or_404(store: dict, roadmap_id: str) -> dict:
    roadmap = store.get(roadmap_id)
    if roadmap is None:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    return roadmap


def _get_step_or_404(roadmap: dict, step_id: str) -> dict:
    for step in roadmap.get("steps") or []:
        if step["id"] == step_id:
            return step
    raise HTTPException(status_code=404, detail="Step not found")


def _validate_links(value, field_name: str) -> list[dict]:
    """Validate a course_links/documents replacement array (data-model.md Link shape):
    a list of objects, each with a non-empty title and a string url (may be empty).
    Raises 400 on anything else; a valid empty list is returned as-is (full clear)."""
    if not isinstance(value, list):
        raise HTTPException(status_code=400, detail=f"{field_name} must be a list")
    validated = []
    for entry in value:
        if not isinstance(entry, dict):
            raise HTTPException(status_code=400, detail=f"{field_name} entries must be objects")
        title = str(entry.get("title", "") or "").strip()
        if not title:
            raise HTTPException(
                status_code=400, detail=f"{field_name} entries require a non-empty title"
            )
        validated.append({"title": title, "url": str(entry.get("url", "") or "")})
    return validated


# ─── Roadmaps ─────────────────────────────────────────────────────────────────

@router.get("/api/roadmaps", summary="List all roadmaps with computed completion")
def list_roadmaps():
    store = _store()
    result = []
    for roadmap in store.values():
        pct = compute_completion(roadmap)["roadmap_pct"]
        result.append({
            "id": roadmap["id"],
            "title": roadmap["title"],
            "description": roadmap.get("description", ""),
            "completion_pct": pct,
            "created_at": roadmap.get("created_at"),
            "updated_at": roadmap.get("updated_at"),
        })
    return result


@router.get(
    "/api/roadmaps/{roadmap_id}",
    summary="Get full roadmap detail with per-step and overall completion",
    responses={404: {"description": "Roadmap not found"}},
)
def get_roadmap(roadmap_id: str):
    store = _store()
    roadmap = _get_roadmap_or_404(store, roadmap_id)
    completion = compute_completion(roadmap)

    steps = sorted(roadmap.get("steps") or [], key=lambda s: s["order"])
    detail = dict(roadmap)
    detail["steps"] = [
        {**step, "completion_pct": completion["steps"].get(step["id"], 0)}
        for step in steps
    ]
    detail["completion_pct"] = completion["roadmap_pct"]
    return detail


@router.post(
    "/api/roadmaps",
    status_code=201,
    summary="Create a roadmap",
    responses={
        400: {"description": "Invalid or missing id/title"},
        409: {"description": "Roadmap id already exists"},
        500: {"description": "Failed to save roadmap"},
    },
)
def create_roadmap(data: dict):
    roadmap_id = str(data.get("id", "")).strip()
    title = str(data.get("title", "")).strip()
    description = str(data.get("description", "") or "")

    if not roadmap_id or not _SLUG_RE.match(roadmap_id):
        raise HTTPException(status_code=400, detail="Invalid or missing roadmap id")
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")

    store = _store()
    if roadmap_id in store:
        raise HTTPException(status_code=409, detail="Roadmap id already exists")

    now = _now()
    roadmap = {
        "id": roadmap_id,
        "title": title,
        "description": description,
        "created_at": now,
        "updated_at": now,
        "steps": [],
    }
    store[roadmap_id] = roadmap
    try:
        _save(store)
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to save roadmap %r: %s", roadmap_id, e)
        raise HTTPException(status_code=500, detail="Failed to save roadmap") from e
    return roadmap


@router.put(
    "/api/roadmaps/{roadmap_id}",
    summary="Update a roadmap's title/description",
    responses={
        400: {"description": "Title provided but empty"},
        404: {"description": "Roadmap not found"},
        500: {"description": "Failed to save roadmap"},
    },
)
def update_roadmap(roadmap_id: str, data: dict):
    store = _store()
    roadmap = _get_roadmap_or_404(store, roadmap_id)

    if "title" in data:
        title = str(data["title"] or "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        roadmap["title"] = title
    if "description" in data:
        roadmap["description"] = str(data["description"] or "")

    roadmap["updated_at"] = _now()
    try:
        _save(store)
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to save roadmap %r: %s", roadmap_id, e)
        raise HTTPException(status_code=500, detail="Failed to save roadmap") from e
    return roadmap


@router.delete(
    "/api/roadmaps/{roadmap_id}",
    status_code=204,
    summary="Delete a roadmap",
    responses={
        404: {"description": "Roadmap not found"},
        500: {"description": "Failed to delete roadmap"},
    },
)
def delete_roadmap(roadmap_id: str):
    store = _store()
    _get_roadmap_or_404(store, roadmap_id)
    del store[roadmap_id]
    try:
        _save(store)
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to delete roadmap %r: %s", roadmap_id, e)
        raise HTTPException(status_code=500, detail="Failed to delete roadmap") from e
    return None


# ─── Steps ────────────────────────────────────────────────────────────────────

@router.patch(
    "/api/roadmaps/{roadmap_id}/steps/{step_id}",
    summary="Update a step's notes, course_links, and/or documents",
    responses={
        400: {"description": "course_links or documents is not a valid list of link entries"},
        404: {"description": "Roadmap or step not found"},
        500: {"description": "Failed to save step"},
    },
)
def update_step(roadmap_id: str, step_id: str, data: dict):
    store = _store()
    roadmap = _get_roadmap_or_404(store, roadmap_id)
    step = _get_step_or_404(roadmap, step_id)

    # Validate both fields before mutating anything, so a bad `documents` value
    # can't leave a partially-applied update (e.g. course_links saved, documents
    # rejected) — either the whole PATCH applies or none of it does.
    course_links = _validate_links(data["course_links"], "course_links") if "course_links" in data else None
    documents = _validate_links(data["documents"], "documents") if "documents" in data else None

    if "notes" in data:
        step["notes"] = str(data["notes"] or "")
    if course_links is not None:
        step["course_links"] = course_links
    if documents is not None:
        step["documents"] = documents

    roadmap["updated_at"] = _now()
    try:
        _save(store)
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to save roadmap %r step %r: %s", roadmap_id, step_id, e)
        raise HTTPException(status_code=500, detail="Failed to save step") from e

    completion = compute_completion(roadmap)
    return {**step, "completion_pct": completion["steps"].get(step_id, 0)}


@router.patch(
    "/api/roadmaps/{roadmap_id}/steps/{step_id}/checklist/{item_id}",
    summary="Set a checklist item's done state",
    responses={
        400: {"description": "'done' missing or not a boolean"},
        404: {"description": "Roadmap, step, or checklist item not found"},
        500: {"description": "Failed to save checklist item"},
    },
)
def toggle_checklist_item(roadmap_id: str, step_id: str, item_id: str, data: dict):
    if "done" not in data or not isinstance(data["done"], bool):
        raise HTTPException(status_code=400, detail="'done' (boolean) is required")

    store = _store()
    roadmap = _get_roadmap_or_404(store, roadmap_id)
    step = _get_step_or_404(roadmap, step_id)

    item = next((i for i in (step.get("checklist") or []) if i["id"] == item_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    item["done"] = data["done"]
    roadmap["updated_at"] = _now()
    try:
        _save(store)
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error(
            "Failed to save checklist toggle %r/%r/%r: %s", roadmap_id, step_id, item_id, e
        )
        raise HTTPException(status_code=500, detail="Failed to save checklist item") from e

    completion = compute_completion(roadmap)
    return {
        "item": item,
        "step_completion_pct": completion["steps"].get(step_id, 0),
        "roadmap_completion_pct": completion["roadmap_pct"],
    }
