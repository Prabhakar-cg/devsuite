"""roadmap_utils.py — Pure completion-computation helpers for the Learning Roadmap tool.

No I/O, no FastAPI/DevDB imports — see specs/018-learning-roadmap/data-model.md
("Completion Computation") and specs/018-learning-roadmap/research.md item 2.
Percentages are always derived here, never persisted (SPEC FR-013).
"""
from __future__ import annotations

import math
from typing import Any


def _round_half_up(value: float) -> int:
    """Round-half-up (ties round toward +infinity) — the documented rounding
    policy for completion percentages (data-model.md "Completion Computation").

    Python's builtin round() uses round-half-to-even ("banker's rounding"), which
    diverges from JavaScript's Math.round (round-half-up) at exact .5 midpoints —
    e.g. round(12.5) == 12 in Python vs Math.round(12.5) === 13 in JS. static/
    roadmap-utils.js's computeStepPct/computeRoadmapPct must produce the same
    result as this function for the client's optimistic percentage to match the
    server's authoritative one at every midpoint, not just most of them.
    """
    return math.floor(value + 0.5)


def _step_completion_pct(step: dict[str, Any]) -> int:
    checklist = step.get("checklist") or []
    total = len(checklist)
    if total == 0:
        return 0
    done = sum(1 for item in checklist if item.get("done"))
    return _round_half_up(100 * done / total)


def compute_completion(roadmap: dict[str, Any]) -> dict[str, Any]:
    """Return {"roadmap_pct": int, "steps": {step_id: int}} for the given roadmap dict."""
    steps = roadmap.get("steps") or []
    step_pcts: dict[str, int] = {}
    for step in steps:
        step_pcts[step["id"]] = _step_completion_pct(step)

    if not step_pcts:
        roadmap_pct = 0
    else:
        roadmap_pct = _round_half_up(sum(step_pcts.values()) / len(step_pcts))

    return {"roadmap_pct": roadmap_pct, "steps": step_pcts}
