"""roadmap_utils.py — Pure completion-computation helpers for the Learning Roadmap tool.

No I/O, no FastAPI/DevDB imports — see specs/018-learning-roadmap/data-model.md
("Completion Computation") and specs/018-learning-roadmap/research.md item 2.
Percentages are always derived here, never persisted (SPEC FR-013).
"""
from __future__ import annotations

from typing import Any


def _step_completion_pct(step: dict[str, Any]) -> int:
    checklist = step.get("checklist") or []
    total = len(checklist)
    if total == 0:
        return 0
    done = sum(1 for item in checklist if item.get("done"))
    return round(100 * done / total)


def compute_completion(roadmap: dict[str, Any]) -> dict[str, Any]:
    """Return {"roadmap_pct": int, "steps": {step_id: int}} for the given roadmap dict."""
    steps = roadmap.get("steps") or []
    step_pcts: dict[str, int] = {}
    for step in steps:
        step_pcts[step["id"]] = _step_completion_pct(step)

    if not step_pcts:
        roadmap_pct = 0
    else:
        roadmap_pct = round(sum(step_pcts.values()) / len(step_pcts))

    return {"roadmap_pct": roadmap_pct, "steps": step_pcts}
