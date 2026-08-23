"""Unit tests for roadmap_utils.compute_completion — pure function, no DevDB/HTTP involved.

See specs/018-learning-roadmap/data-model.md ("Completion Computation") and
specs/018-learning-roadmap/tasks.md T003.
"""
from roadmap_utils import compute_completion


def _step(step_id, checklist):
    return {"id": step_id, "order": 1, "title": "t", "checklist": checklist}


def test_step_with_zero_checklist_items_is_zero_percent_not_nan():
    roadmap = {"id": "r", "steps": [_step("step-1", [])]}
    result = compute_completion(roadmap)
    assert result["steps"]["step-1"] == 0
    assert result["roadmap_pct"] == 0


def test_roadmap_with_zero_steps_is_zero_percent():
    roadmap = {"id": "r", "steps": []}
    result = compute_completion(roadmap)
    assert result["roadmap_pct"] == 0
    assert result["steps"] == {}


def test_roadmap_pct_is_unweighted_average_of_step_pcts():
    roadmap = {
        "id": "r",
        "steps": [
            _step("step-1", []),  # 0%
            _step("step-2", [{"done": True}, {"done": False}]),  # 50%
            _step("step-3", [{"done": True}, {"done": True}]),  # 100%
        ],
    }
    result = compute_completion(roadmap)
    assert result["steps"] == {"step-1": 0, "step-2": 50, "step-3": 100}
    assert result["roadmap_pct"] == 50


def test_step_completion_updates_when_item_flips_done():
    checklist = [
        {"id": "c1", "done": True},
        {"id": "c2", "done": True},
        {"id": "c3", "done": False},
        {"id": "c4", "done": False},
    ]
    before = compute_completion({"id": "r", "steps": [_step("step-1", checklist)]})
    assert before["steps"]["step-1"] == 50

    checklist[2]["done"] = True  # 3rd item flips to done
    after = compute_completion({"id": "r", "steps": [_step("step-1", checklist)]})
    assert after["steps"]["step-1"] == 75


def test_rounding_at_non_exact_fraction():
    # 1/3 done -> 33.33...% rounds to 33
    checklist = [{"done": True}, {"done": False}, {"done": False}]
    result = compute_completion({"id": "r", "steps": [_step("step-1", checklist)]})
    assert result["steps"]["step-1"] == 33


def test_rounding_at_exact_half_midpoint_rounds_up():
    # 1/8 done -> exactly 12.5%. Python's builtin round() uses round-half-to-even
    # (round(12.5) == 12), which would disagree with JS's Math.round(12.5) === 13.
    # data-model.md's documented policy is half-up, matching JS, on both sides.
    checklist = [{"done": True}] + [{"done": False}] * 7
    result = compute_completion({"id": "r", "steps": [_step("step-1", checklist)]})
    assert result["steps"]["step-1"] == 13


def test_roadmap_pct_rounds_up_at_exact_half_midpoint():
    # Two steps at 25% and 50% average to exactly 37.5% -> rounds up to 38.
    roadmap = {
        "id": "r",
        "steps": [
            _step("step-1", [{"done": True}] + [{"done": False}] * 3),   # 25%
            _step("step-2", [{"done": True}, {"done": False}]),          # 50%
        ],
    }
    result = compute_completion(roadmap)
    assert result["roadmap_pct"] == 38
