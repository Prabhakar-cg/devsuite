"""Route tests for /api/roadmaps* — unauthenticated tier, CSRF-protected CRUD + PATCH.

See specs/018-learning-roadmap/contracts/roadmap-api.md and tasks.md T016.
"""


def _csrf_headers(client):
    """Warm the ds_csrf cookie via a bare GET (per the M2 CSRF fix) and return headers."""
    r = client.get("/")
    csrf = r.cookies["ds_csrf"]
    return {"X-CSRF-Token": csrf}


def _create_roadmap(client, headers, roadmap_id="test-roadmap", title="Test Roadmap"):
    return client.post(
        "/api/roadmaps",
        json={"id": roadmap_id, "title": title, "description": "desc"},
        headers=headers,
    )


# ─── Roadmap CRUD ──────────────────────────────────────────────────────────────

def test_list_roadmaps_empty_on_fresh_store(client):
    r = client.get("/api/roadmaps")
    assert r.status_code == 200
    assert r.json() == []


def test_create_list_get_update_delete_lifecycle(client):
    headers = _csrf_headers(client)

    r = _create_roadmap(client, headers)
    assert r.status_code == 201
    body = r.json()
    assert body["id"] == "test-roadmap"
    assert body["title"] == "Test Roadmap"
    assert body["steps"] == []

    r = client.get("/api/roadmaps")
    assert r.status_code == 200
    listed = r.json()
    assert len(listed) == 1
    assert listed[0]["id"] == "test-roadmap"
    assert listed[0]["completion_pct"] == 0

    r = client.get("/api/roadmaps/test-roadmap")
    assert r.status_code == 200
    assert r.json()["completion_pct"] == 0

    r = client.put(
        "/api/roadmaps/test-roadmap",
        json={"title": "Renamed", "description": "new desc"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Renamed"
    assert r.json()["description"] == "new desc"

    r = client.delete("/api/roadmaps/test-roadmap", headers=headers)
    assert r.status_code == 204

    r = client.get("/api/roadmaps/test-roadmap")
    assert r.status_code == 404


def test_create_with_duplicate_id_is_rejected(client):
    headers = _csrf_headers(client)
    _create_roadmap(client, headers)
    r = _create_roadmap(client, headers)
    assert r.status_code == 409


def test_create_with_empty_title_is_rejected(client):
    headers = _csrf_headers(client)
    r = client.post(
        "/api/roadmaps", json={"id": "no-title", "title": ""}, headers=headers
    )
    assert r.status_code == 400


def test_create_with_invalid_id_is_rejected(client):
    headers = _csrf_headers(client)
    r = client.post(
        "/api/roadmaps", json={"id": "Not A Slug!", "title": "x"}, headers=headers
    )
    assert r.status_code == 400


def test_get_put_delete_unknown_roadmap_is_404(client):
    headers = _csrf_headers(client)
    assert client.get("/api/roadmaps/nope").status_code == 404
    assert client.put("/api/roadmaps/nope", json={"title": "x"}, headers=headers).status_code == 404
    assert client.delete("/api/roadmaps/nope", headers=headers).status_code == 404


def test_mutations_without_csrf_are_forbidden(client):
    r = client.post("/api/roadmaps", json={"id": "x", "title": "x"})
    assert r.status_code == 403


# ─── Step + checklist PATCH ────────────────────────────────────────────────────

def _create_roadmap_with_step(client, headers):
    _create_roadmap(client, headers)
    # Inject a step directly via the DevDB the isolated_db fixture already patched in.
    import deps
    roadmap = deps._db.get_store("roadmaps")["test-roadmap"]
    roadmap["steps"] = [{
        "id": "step-1",
        "order": 1,
        "title": "Step One",
        "description": "",
        "notes": "",
        "checklist": [
            {"id": "c1", "text": "item one", "done": False},
            {"id": "c2", "text": "item two", "done": False},
        ],
        "course_links": [],
        "documents": [],
    }]
    deps._db.set_store("roadmaps", deps._db.get_store("roadmaps"))
    deps._db.save()


def test_patch_step_updates_notes_and_links(client):
    headers = _csrf_headers(client)
    _create_roadmap_with_step(client, headers)

    r = client.patch(
        "/api/roadmaps/test-roadmap/steps/step-1",
        json={
            "notes": "some markdown",
            "course_links": [{"title": "Course", "url": "https://example.com"}],
            "documents": [{"title": "Doc", "url": ""}],
        },
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["notes"] == "some markdown"
    assert body["course_links"] == [{"title": "Course", "url": "https://example.com"}]
    assert body["documents"] == [{"title": "Doc", "url": ""}]
    assert body["completion_pct"] == 0


def test_patch_step_unknown_roadmap_is_404(client):
    headers = _csrf_headers(client)
    r = client.patch(
        "/api/roadmaps/nope/steps/step-1", json={"notes": "x"}, headers=headers
    )
    assert r.status_code == 404


def test_patch_step_unknown_step_is_404(client):
    headers = _csrf_headers(client)
    _create_roadmap(client, headers)
    r = client.patch(
        "/api/roadmaps/test-roadmap/steps/nope", json={"notes": "x"}, headers=headers
    )
    assert r.status_code == 404


def test_checklist_toggle_recomputes_step_and_roadmap_percentages(client):
    headers = _csrf_headers(client)
    _create_roadmap_with_step(client, headers)

    r = client.patch(
        "/api/roadmaps/test-roadmap/steps/step-1/checklist/c1",
        json={"done": True},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["item"]["done"] is True
    assert body["step_completion_pct"] == 50
    assert body["roadmap_completion_pct"] == 50

    # Toggle back off.
    r = client.patch(
        "/api/roadmaps/test-roadmap/steps/step-1/checklist/c1",
        json={"done": False},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["step_completion_pct"] == 0
    assert r.json()["roadmap_completion_pct"] == 0


def test_checklist_toggle_unknown_item_is_404(client):
    headers = _csrf_headers(client)
    _create_roadmap_with_step(client, headers)
    r = client.patch(
        "/api/roadmaps/test-roadmap/steps/step-1/checklist/nope",
        json={"done": True},
        headers=headers,
    )
    assert r.status_code == 404


def test_checklist_toggle_missing_done_is_400(client):
    headers = _csrf_headers(client)
    _create_roadmap_with_step(client, headers)
    r = client.patch(
        "/api/roadmaps/test-roadmap/steps/step-1/checklist/c1", json={}, headers=headers
    )
    assert r.status_code == 400


def test_checklist_toggle_non_boolean_done_is_400(client):
    headers = _csrf_headers(client)
    _create_roadmap_with_step(client, headers)
    r = client.patch(
        "/api/roadmaps/test-roadmap/steps/step-1/checklist/c1",
        json={"done": "yes"},
        headers=headers,
    )
    assert r.status_code == 400
