"""CSRF middleware: mutating requests need a matching X-CSRF-Token / ds_csrf pair.

Covers SPEC.md §7.3 / §10.2.
"""


def test_post_without_csrf_is_forbidden(client):
    r = client.post("/api/vault", json={"encrypted_blob": "x"})
    assert r.status_code == 403
    assert "CSRF" in r.json().get("error", "")


def test_post_with_mismatched_csrf_is_forbidden(client):
    r = client.post(
        "/api/vault",
        json={"encrypted_blob": "x"},
        headers={"Cookie": "ds_csrf=aaa", "X-CSRF-Token": "bbb"},
    )
    assert r.status_code == 403


def test_post_with_matching_csrf_passes_then_requires_session(client):
    # CSRF passes (cookie == header); route still rejects without a session → 401.
    r = client.post(
        "/api/vault",
        json={"encrypted_blob": "x"},
        headers={"Cookie": "ds_csrf=tok123", "X-CSRF-Token": "tok123"},
    )
    assert r.status_code == 401


def test_setup_endpoint_is_csrf_exempt(client):
    # /api/auth/setup predates any session/CSRF; missing fields → 400, not 403.
    r = client.post("/api/auth/setup", json={})
    assert r.status_code == 400
