"""
test_missing_coverage.py — Additional endpoint and integration tests for DevSuite.

Covers endpoints not exercised by the existing test suite:
  - GET /tools, /api-tester, /vault, /db-manager, /file-converter  (HTML pages)
  - POST /api/proxy                 (CORS proxy — validation, SSRF guards)
  - POST /api/convert               (file format converter — unsupported path)
  - GET/POST /api/collections       (API Tester saved collections)
  - GET /api/auth/status            (master-password status when not configured)
  - GET /api/auth/challenge         (404 when not configured)
  - POST /api/auth/setup            (first-time master password creation)
  - POST /api/auth/session          (session token issuance)
  - GET  /api/db/meta               (DevDB metadata — auth required)
  - GET/POST /api/db/store/{name}   (store read/write — auth required)
  - GET  /api/db/export             (binary download — auth required)
  - POST /api/db/import             (binary upload — auth required)
  - Security headers                (present on every HTML endpoint)
"""

import pytest
from fastapi.testclient import TestClient

# conftest.py adds the project root to sys.path
from main import app, _sessions, _db  # noqa: E402


client = TestClient(app, raise_server_exceptions=False)

# ─── Helpers ────────────────────────────────────────────────────────────────


def _with_fresh_session(prefs_patch: dict | None = None):
    """
    Create a short-lived in-memory session token and register it so that
    endpoints guarded by require_unlocked() accept the request.
    Returns the token string.
    """
    import time
    import secrets as _secrets
    tok = _secrets.token_hex(16)
    _sessions[tok] = time.time() + 3600  # valid for 1 hour
    return tok


def _auth_headers(token: str) -> dict:
    return {"X-Session-Token": token}


# ─── Tool HTML Pages ─────────────────────────────────────────────────────────


class TestToolHtmlPages:
    """All tool pages must return 200 HTML with basic structure."""

    TOOL_PAGES = [
        "/tools",
        "/api-tester",
        "/vault",
        "/db-manager",
        "/file-converter",
    ]

    def test_all_tool_pages_return_200(self):
        for path in self.TOOL_PAGES:
            r = client.get(path)
            assert r.status_code == 200, f"{path} returned {r.status_code}"

    def test_all_tool_pages_return_html(self):
        for path in self.TOOL_PAGES:
            r = client.get(path)
            assert r.headers["content-type"].startswith("text/html"), path

    def test_all_tool_pages_have_doctype(self):
        for path in self.TOOL_PAGES:
            r = client.get(path)
            assert "<!DOCTYPE html>" in r.text or "<html" in r.text, path

    def test_tools_page_references_multiple_tools(self):
        r = client.get("/tools")
        assert r.status_code == 200
        # Should list several tool names
        text = r.text.lower()
        assert "json" in text or "diff" in text or "cron" in text

    def test_vault_page_references_vault(self):
        r = client.get("/vault")
        assert "vault" in r.text.lower() or "secret" in r.text.lower()

    def test_db_manager_page_references_database(self):
        r = client.get("/db-manager")
        text = r.text.lower()
        assert "db" in text or "database" in text or "store" in text

    def test_file_converter_page_references_convert(self):
        r = client.get("/file-converter")
        text = r.text.lower()
        assert "convert" in text or "format" in text

    def test_api_tester_page_references_api(self):
        r = client.get("/api-tester")
        text = r.text.lower()
        assert "api" in text or "request" in text


# ─── Security Headers ────────────────────────────────────────────────────────


class TestSecurityHeaders:
    """All HTML pages must carry the required security headers."""

    ENDPOINTS = [
        "/tools",
        "/api-tester",
        "/vault",
        "/db-manager",
        "/file-converter",
        "/",
        "/diff",
    ]

    def test_x_frame_options_deny(self):
        for path in self.ENDPOINTS:
            r = client.get(path)
            assert r.headers.get("x-frame-options") == "DENY", path

    def test_x_content_type_options_nosniff(self):
        for path in self.ENDPOINTS:
            r = client.get(path)
            assert r.headers.get("x-content-type-options") == "nosniff", path

    def test_content_security_policy_present(self):
        for path in self.ENDPOINTS:
            r = client.get(path)
            assert "content-security-policy" in r.headers, path


# ─── CORS Proxy ──────────────────────────────────────────────────────────────


class TestApiProxy:
    """Proxy endpoint must reject disallowed targets and invalid URLs."""

    def test_proxy_rejects_non_http_scheme(self):
        r = client.post("/api/proxy", json={"url": "ftp://example.com/file", "method": "GET"})
        assert r.status_code == 400
        assert "http" in r.json()["detail"].lower()

    def test_proxy_rejects_javascript_scheme(self):
        r = client.post("/api/proxy", json={"url": "javascript:alert(1)", "method": "GET"})
        assert r.status_code == 400

    def test_proxy_rejects_disallowed_host(self):
        r = client.post("/api/proxy", json={"url": "https://example.com/api", "method": "GET"})
        # example.com is NOT in the allowlist
        assert r.status_code == 400
        assert "not allowed" in r.json()["detail"].lower()

    def test_proxy_rejects_localhost(self):
        r = client.post("/api/proxy", json={"url": "http://localhost/secret", "method": "GET"})
        assert r.status_code == 400

    def test_proxy_rejects_internal_ip(self):
        r = client.post("/api/proxy", json={"url": "http://192.168.1.1/admin", "method": "GET"})
        assert r.status_code == 400

    def test_proxy_rejects_missing_url(self):
        # body without url field
        r = client.post("/api/proxy", json={"method": "GET"})
        # Either 422 (validation) or 400
        assert r.status_code in (400, 422)

    def test_proxy_requires_post(self):
        r = client.get("/api/proxy")
        assert r.status_code == 405


# ─── File Converter ──────────────────────────────────────────────────────────


class TestApiConvert:
    """Conversion endpoint validation."""

    def test_unsupported_conversion_returns_400(self):
        content = b"dummy content"
        r = client.post(
            "/api/convert",
            files={"file": ("test.txt", content, "text/plain")},
            data={"target_format": "xyz_unknown"},
        )
        assert r.status_code == 400
        detail = r.json()["detail"].lower()
        assert "unsupported" in detail or "conversion" in detail

    def test_missing_file_returns_422(self):
        r = client.post("/api/convert", data={"target_format": "pdf"})
        assert r.status_code == 422

    def test_missing_target_format_returns_422(self):
        r = client.post(
            "/api/convert",
            files={"file": ("test.txt", b"hello", "text/plain")},
        )
        assert r.status_code == 422

    def test_csv_to_json_conversion(self):
        """If openpyxl is installed, csv → xlsx works; otherwise 503 or 400 unsupported."""
        csv_content = b"name,age\nAlice,30\nBob,25"
        r = client.post(
            "/api/convert",
            files={"file": ("data.csv", csv_content, "text/csv")},
            data={"target_format": "xlsx"},
        )
        # Either succeeds (openpyxl present) or returns 400/503 (library missing or unsupported)
        assert r.status_code in (200, 400, 503)


# ─── API Tester Collections ──────────────────────────────────────────────────


class TestApiCollections:
    """GET/POST /api/collections backed by DevDB."""

    def test_get_collections_returns_200(self):
        r = client.get("/api/collections")
        assert r.status_code == 200

    def test_get_collections_returns_json(self):
        r = client.get("/api/collections")
        data = r.json()
        assert isinstance(data, dict)

    def test_get_collections_has_items_key(self):
        r = client.get("/api/collections")
        data = r.json()
        # Default empty state has {"items": []}
        assert "items" in data

    def test_post_collections_saves_and_round_trips(self):
        payload = {"items": [{"id": "col_1", "name": "Test", "requests": []}]}
        r = client.post("/api/collections", json=payload)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

        # Verify saved data can be read back
        r2 = client.get("/api/collections")
        data = r2.json()
        assert data.get("items") is not None

    def test_post_collections_requires_json_body(self):
        r = client.post("/api/collections", content=b"not json", headers={"Content-Type": "application/json"})
        assert r.status_code == 422


# ─── Auth Status & Challenge ─────────────────────────────────────────────────


class TestAuthStatus:
    """Auth status endpoint (no session required)."""

    def test_auth_status_returns_200(self):
        r = client.get("/api/auth/status")
        assert r.status_code == 200

    def test_auth_status_has_is_setup_field(self):
        r = client.get("/api/auth/status")
        data = r.json()
        assert "is_setup" in data

    def test_auth_status_has_vault_has_data_field(self):
        r = client.get("/api/auth/status")
        data = r.json()
        assert "vault_has_data" in data

    def test_auth_status_is_setup_is_bool(self):
        r = client.get("/api/auth/status")
        assert isinstance(r.json()["is_setup"], bool)


class TestAuthChallenge:
    """Auth challenge endpoint (no session required)."""

    def test_auth_challenge_404_when_not_configured(self):
        """If master password has never been set up, challenge returns 404."""
        prefs = _db.get_store("app_prefs") or {}
        if prefs.get("master_setup_done"):
            pytest.skip("Master password already configured in this environment")

        r = client.get("/api/auth/challenge")
        assert r.status_code == 404


# ─── Auth Setup & Session ────────────────────────────────────────────────────


class TestAuthSetupAndSession:
    """First-time setup + session issuance flow."""

    def test_auth_setup_validates_required_fields(self):
        """Missing required fields must return 400."""
        r = client.post("/api/auth/setup", json={"salt": "abc"})  # missing verify_blob/verify_iv
        # Either 400 (missing fields) or 409 (already set up) — both are correct
        assert r.status_code in (400, 409)

    def test_auth_setup_missing_body_returns_422(self):
        r = client.post("/api/auth/setup", content=b"", headers={"Content-Type": "application/json"})
        assert r.status_code == 422

    def test_auth_session_requires_key_hex(self):
        """Session endpoint with empty key_hex must return 400."""
        r = client.post("/api/auth/session", json={})
        # 400 (key_hex missing) or 404 (not configured yet)
        assert r.status_code in (400, 404)

    def test_auth_session_requires_post(self):
        r = client.get("/api/auth/session")
        assert r.status_code == 405


# ─── DevDB API (session-gated) ───────────────────────────────────────────────


class TestDevDbApi:
    """DevDB endpoints require a valid session token."""

    def test_db_meta_without_token_returns_401(self):
        r = client.get("/api/db/meta")
        assert r.status_code == 401

    def test_db_meta_with_invalid_token_returns_401(self):
        r = client.get("/api/db/meta", headers={"X-Session-Token": "invalid_garbage"})
        assert r.status_code == 401

    def test_db_meta_with_valid_token_returns_200(self):
        token = _with_fresh_session()
        r = client.get("/api/db/meta", headers=_auth_headers(token))
        assert r.status_code == 200

    def test_db_meta_response_structure(self):
        token = _with_fresh_session()
        r = client.get("/api/db/meta", headers=_auth_headers(token))
        data = r.json()
        assert "path" in data
        assert "size" in data
        assert "encrypted" in data
        assert "stores" in data

    def test_db_get_store_without_token_returns_401(self):
        r = client.get("/api/db/store/collections")
        assert r.status_code == 401

    def test_db_get_store_invalid_name_returns_400(self):
        token = _with_fresh_session()
        r = client.get("/api/db/store/nonexistent", headers=_auth_headers(token))
        assert r.status_code == 400
        assert "unknown" in r.json()["detail"].lower()

    def test_db_get_store_collections_returns_200(self):
        token = _with_fresh_session()
        r = client.get("/api/db/store/collections", headers=_auth_headers(token))
        assert r.status_code == 200

    def test_db_get_store_returns_dict(self):
        token = _with_fresh_session()
        r = client.get("/api/db/store/app_prefs", headers=_auth_headers(token))
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_db_set_store_without_token_returns_401(self):
        r = client.post("/api/db/store/collections", json={"items": []})
        assert r.status_code == 401

    def test_db_set_store_invalid_name_returns_400(self):
        token = _with_fresh_session()
        r = client.post("/api/db/store/secret_stuff", json={}, headers=_auth_headers(token))
        assert r.status_code == 400

    def test_db_set_store_collections_roundtrip(self):
        token = _with_fresh_session()
        payload = {"items": [{"id": "c1", "name": "pytest"}]}
        r = client.post("/api/db/store/collections", json=payload, headers=_auth_headers(token))
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

        r2 = client.get("/api/db/store/collections", headers=_auth_headers(token))
        assert r2.status_code == 200
        assert r2.json() == payload

    def test_db_export_without_token_returns_401(self):
        r = client.get("/api/db/export")
        assert r.status_code == 401

    def test_db_export_with_valid_token_returns_binary(self):
        token = _with_fresh_session()
        r = client.get("/api/db/export", headers=_auth_headers(token))
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/octet-stream"
        assert "devdb.dsb" in r.headers.get("content-disposition", "")
        # Should be non-empty binary content
        assert len(r.content) > 0

    def test_db_import_without_token_returns_401(self):
        r = client.post("/api/db/import", files={"file": ("test.dsb", b"data", "application/octet-stream")})
        assert r.status_code == 401

    def test_db_import_with_invalid_file_returns_400(self):
        token = _with_fresh_session()
        r = client.post(
            "/api/db/import",
            files={"file": ("bad.dsb", b"not a valid dsb file", "application/octet-stream")},
            headers=_auth_headers(token),
        )
        # Invalid binary format → 400
        assert r.status_code == 400

    def test_db_import_export_roundtrip(self):
        """Export the current database and re-import it — should succeed."""
        token = _with_fresh_session()

        # Export
        export_resp = client.get("/api/db/export", headers=_auth_headers(token))
        assert export_resp.status_code == 200
        raw_bytes = export_resp.content
        assert len(raw_bytes) > 0

        # Re-import
        import_resp = client.post(
            "/api/db/import",
            files={"file": ("devdb.dsb", raw_bytes, "application/octet-stream")},
            headers=_auth_headers(token),
        )
        assert import_resp.status_code == 200
        data = import_resp.json()
        assert data["status"] == "ok"
        assert isinstance(data["imported_stores"], list)


# ─── Vault API (session-gated) ───────────────────────────────────────────────


class TestVaultApi:
    """Vault GET/POST require a valid session token."""

    def test_get_vault_without_token_returns_401(self):
        r = client.get("/api/vault")
        assert r.status_code == 401

    def test_post_vault_without_token_returns_401(self):
        r = client.post("/api/vault", json={"encrypted_blob": "abc"})
        assert r.status_code == 401

    def test_get_vault_with_valid_token_returns_200(self):
        token = _with_fresh_session()
        r = client.get("/api/vault", headers=_auth_headers(token))
        assert r.status_code == 200

    def test_get_vault_returns_dict(self):
        token = _with_fresh_session()
        r = client.get("/api/vault", headers=_auth_headers(token))
        assert isinstance(r.json(), dict)

    def test_post_vault_saves_blob(self):
        token = _with_fresh_session()
        payload = {"encrypted_blob": "base64encodedblob", "iv": "someiv", "salt": "somesalt"}
        r = client.post("/api/vault", json=payload, headers=_auth_headers(token))
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_post_vault_roundtrip(self):
        """Data saved to vault can be retrieved."""
        token = _with_fresh_session()
        payload = {"encrypted_blob": "testblob123", "salt": "s", "iv": "i"}
        client.post("/api/vault", json=payload, headers=_auth_headers(token))
        r = client.get("/api/vault", headers=_auth_headers(token))
        assert r.json().get("encrypted_blob") == "testblob123"


# ─── Session Token Expiry ────────────────────────────────────────────────────


class TestSessionExpiry:
    """Expired session tokens must be rejected."""

    def test_expired_token_returns_401(self):
        import time
        import secrets as _secrets

        expired_tok = _secrets.token_hex(16)
        _sessions[expired_tok] = time.time() - 1  # already expired

        r = client.get("/api/db/meta", headers={"X-Session-Token": expired_tok})
        assert r.status_code == 401

    def test_missing_token_returns_401_with_detail(self):
        r = client.get("/api/db/meta")
        data = r.json()
        assert r.status_code == 401
        assert "detail" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
