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


def test_bare_get_with_no_cookies_is_issued_a_csrf_cookie(client):
    # Unauthenticated-tier tools have no master-password session to derive ds_csrf
    # from — a plain page load must mint one so their mutating routes are reachable
    # at all. See specs/018-learning-roadmap/research.md item 1.
    r = client.get("/")
    assert "ds_csrf" in r.cookies
    assert len(r.cookies["ds_csrf"]) > 0


def test_static_asset_request_does_not_issue_a_csrf_cookie(client):
    # ds_csrf is minted only for HTML document responses (main.py's
    # ensure_csrf_cookie checks Content-Type, not path) — a static asset request
    # must not mint it, even on a visitor's very first request to the server.
    r = client.get("/static/style.css")
    assert r.status_code == 200
    assert "ds_csrf" not in r.cookies


def test_csrf_cookie_from_bare_get_authorizes_a_mutating_request(client):
    r = client.get("/")
    csrf = r.cookies["ds_csrf"]
    # Reuse the cookie the GET minted as both the cookie and the header; CSRF passes
    # (route then rejects for lack of a session, same as the matching-pair case above).
    r2 = client.post(
        "/api/vault",
        json={"encrypted_blob": "x"},
        headers={"X-CSRF-Token": csrf},
    )
    assert r2.status_code == 401
