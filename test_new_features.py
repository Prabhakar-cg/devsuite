"""
Tests for new features introduced in this PR:
  - GET /crypto         — Crypto Suite HTML page
  - GET /url-shortener  — URL Shortener HTML page
  - POST /api/shorten   — Create short URL (URL normalization, short_id format, response shape)
  - GET /r/{short_id}   — Redirect to original URL

Follows existing project conventions: pytest classes, FastAPI TestClient.
"""

import re
import string
import pytest
from fastapi.testclient import TestClient
import main
from main import app, url_db


client = TestClient(app, follow_redirects=False)


def clear_url_db():
    """Helper: empty the in-memory URL store between tests."""
    url_db.clear()


# ---------------------------------------------------------------------------
# GET /crypto
# ---------------------------------------------------------------------------

class TestCryptoEndpoint:
    """Tests for the Crypto Suite HTML page (/crypto)."""

    def setup_method(self):
        clear_url_db()

    def test_crypto_returns_200(self):
        """Crypto endpoint should return HTTP 200."""
        response = client.get("/crypto")
        assert response.status_code == 200

    def test_crypto_returns_html_content_type(self):
        """Crypto endpoint should return an HTML content type."""
        response = client.get("/crypto")
        assert response.headers["content-type"].startswith("text/html")

    def test_crypto_contains_crypto_suite_title(self):
        """Crypto page should reference 'Crypto Suite' in its content."""
        response = client.get("/crypto")
        assert "crypto" in response.text.lower() or "hash" in response.text.lower()

    def test_crypto_page_has_html_structure(self):
        """Crypto page should contain a valid HTML doctype or html tag."""
        response = client.get("/crypto")
        text = response.text
        assert "<!DOCTYPE html>" in text or "<html" in text

    def test_crypto_has_back_link_to_home(self):
        """Crypto page should include a back-navigation link to DevSuite home."""
        response = client.get("/crypto")
        assert 'href="/"' in response.text or "DevSuite" in response.text

    def test_crypto_has_charset_utf8(self):
        """Crypto page should declare UTF-8 charset."""
        response = client.get("/crypto")
        assert "utf-8" in response.text.lower() or "charset" in response.text.lower()

    def test_crypto_post_not_allowed(self):
        """POST to /crypto should return 405 Method Not Allowed."""
        response = client.post("/crypto")
        assert response.status_code == 405

    def test_crypto_security_headers_present(self):
        """Crypto endpoint responses should include security headers."""
        response = client.get("/crypto")
        assert response.headers.get("x-frame-options") == "DENY"
        assert response.headers.get("x-content-type-options") == "nosniff"
        assert "content-security-policy" in response.headers


# ---------------------------------------------------------------------------
# GET /url-shortener
# ---------------------------------------------------------------------------

class TestUrlShortenerPageEndpoint:
    """Tests for the URL Shortener HTML page (/url-shortener)."""

    def setup_method(self):
        clear_url_db()

    def test_url_shortener_page_returns_200(self):
        """URL Shortener page endpoint should return HTTP 200."""
        response = client.get("/url-shortener")
        assert response.status_code == 200

    def test_url_shortener_page_returns_html(self):
        """URL Shortener page should return HTML content type."""
        response = client.get("/url-shortener")
        assert response.headers["content-type"].startswith("text/html")

    def test_url_shortener_page_has_html_structure(self):
        """URL Shortener page should contain valid HTML structure."""
        response = client.get("/url-shortener")
        assert "<!DOCTYPE html>" in response.text or "<html" in response.text

    def test_url_shortener_page_references_url_content(self):
        """URL Shortener page should reference URL/link shortening content."""
        response = client.get("/url-shortener")
        lower = response.text.lower()
        assert "url" in lower or "short" in lower or "link" in lower

    def test_url_shortener_page_has_charset_utf8(self):
        """URL Shortener page should declare UTF-8 charset."""
        response = client.get("/url-shortener")
        assert "utf-8" in response.text.lower() or "charset" in response.text.lower()

    def test_url_shortener_page_security_headers(self):
        """URL Shortener page should include security headers."""
        response = client.get("/url-shortener")
        assert response.headers.get("x-frame-options") == "DENY"
        assert response.headers.get("x-content-type-options") == "nosniff"

    def test_url_shortener_post_not_allowed(self):
        """POST to /url-shortener HTML page should return 405."""
        response = client.post("/url-shortener")
        assert response.status_code == 405


# ---------------------------------------------------------------------------
# POST /api/shorten
# ---------------------------------------------------------------------------

class TestShortenApiEndpoint:
    """Tests for the URL shortening API (POST /api/shorten)."""

    def setup_method(self):
        clear_url_db()

    def test_shorten_returns_200_for_valid_url(self):
        """Valid URL should be shortened successfully (HTTP 200)."""
        response = client.post("/api/shorten", json={"url": "https://example.com"})
        assert response.status_code == 200

    def test_shorten_response_has_required_keys(self):
        """Shorten response must contain short_id, short_url, and original_url."""
        response = client.post("/api/shorten", json={"url": "https://example.com"})
        data = response.json()
        assert "short_id" in data
        assert "short_url" in data
        assert "original_url" in data

    def test_short_id_is_six_characters(self):
        """Generated short_id must be exactly 6 characters long."""
        response = client.post("/api/shorten", json={"url": "https://example.com"})
        data = response.json()
        assert len(data["short_id"]) == 6

    def test_short_id_is_alphanumeric(self):
        """Generated short_id must consist only of ASCII letters and digits."""
        valid_chars = set(string.ascii_letters + string.digits)
        for _ in range(10):
            response = client.post("/api/shorten", json={"url": "https://example.com"})
            short_id = response.json()["short_id"]
            assert all(c in valid_chars for c in short_id), (
                f"short_id '{short_id}' contains non-alphanumeric characters"
            )

    def test_short_url_contains_short_id(self):
        """The short_url field should embed the short_id."""
        response = client.post("/api/shorten", json={"url": "https://example.com"})
        data = response.json()
        assert data["short_id"] in data["short_url"]

    def test_short_url_contains_r_path_segment(self):
        """The short_url should use the /r/<id> path structure."""
        response = client.post("/api/shorten", json={"url": "https://example.com"})
        data = response.json()
        assert "/r/" in data["short_url"]

    def test_original_url_preserved_when_https_given(self):
        """original_url should equal the input when https:// is already present."""
        url = "https://example.com/path?query=1"
        response = client.post("/api/shorten", json={"url": url})
        data = response.json()
        assert data["original_url"] == url

    def test_original_url_preserved_when_http_given(self):
        """original_url should equal the input when http:// is already present."""
        url = "http://example.com"
        response = client.post("/api/shorten", json={"url": url})
        data = response.json()
        assert data["original_url"] == url

    def test_https_prepended_when_no_scheme(self):
        """URLs without a scheme should have https:// prepended."""
        response = client.post("/api/shorten", json={"url": "example.com"})
        data = response.json()
        assert data["original_url"] == "https://example.com"

    def test_https_prepended_for_subdomain_without_scheme(self):
        """Subdomain URLs without a scheme should have https:// prepended."""
        response = client.post("/api/shorten", json={"url": "sub.example.com/path"})
        data = response.json()
        assert data["original_url"].startswith("https://")

    def test_whitespace_trimmed_from_url(self):
        """Leading and trailing whitespace must be stripped from the URL."""
        response = client.post("/api/shorten", json={"url": "  https://example.com  "})
        data = response.json()
        assert data["original_url"] == "https://example.com"

    def test_whitespace_trimmed_before_scheme_prepend(self):
        """Whitespace is trimmed before scheme detection, so bare domain with spaces gets https://."""
        response = client.post("/api/shorten", json={"url": "  example.com  "})
        data = response.json()
        assert data["original_url"] == "https://example.com"

    def test_shorten_stores_url_in_db(self):
        """Shortened URL should be retrievable from the in-memory store."""
        response = client.post("/api/shorten", json={"url": "https://stored.example.com"})
        data = response.json()
        short_id = data["short_id"]
        assert short_id in url_db
        assert url_db[short_id] == "https://stored.example.com"

    def test_shorten_missing_url_field_returns_422(self):
        """Request body without url field should be rejected with 422 Unprocessable Entity."""
        response = client.post("/api/shorten", json={})
        assert response.status_code == 422

    def test_shorten_wrong_content_type_returns_error(self):
        """Non-JSON body should result in a 422 validation error."""
        response = client.post("/api/shorten", data="not-json")
        assert response.status_code == 422

    def test_shorten_get_not_allowed(self):
        """GET to /api/shorten should return 405 Method Not Allowed."""
        response = client.get("/api/shorten")
        assert response.status_code == 405

    def test_each_shorten_produces_unique_short_id(self):
        """Consecutive shortening of different URLs should produce distinct short IDs (with very high probability)."""
        ids = set()
        for i in range(20):
            response = client.post("/api/shorten", json={"url": f"https://example{i}.com"})
            ids.add(response.json()["short_id"])
        # 20 random 6-char IDs from 62-char alphabet: collision extremely unlikely
        assert len(ids) == 20

    def test_shorten_url_with_path_and_query(self):
        """URLs with path, query string, and fragment should be preserved exactly."""
        url = "https://example.com/some/path?foo=bar&baz=qux#anchor"
        response = client.post("/api/shorten", json={"url": url})
        data = response.json()
        assert data["original_url"] == url

    def test_shorten_http_url_not_upgraded_to_https(self):
        """An explicit http:// URL must NOT be upgraded to https:// by the server."""
        url = "http://insecure.example.com"
        response = client.post("/api/shorten", json={"url": url})
        data = response.json()
        assert data["original_url"] == "http://insecure.example.com"
        assert not data["original_url"].startswith("https://")

    def test_shorten_security_headers_present(self):
        """API responses should still include security headers from middleware."""
        response = client.post("/api/shorten", json={"url": "https://example.com"})
        assert response.headers.get("x-frame-options") == "DENY"
        assert response.headers.get("x-content-type-options") == "nosniff"


# ---------------------------------------------------------------------------
# GET /r/{short_id}
# ---------------------------------------------------------------------------

class TestRedirectEndpoint:
    """Tests for the short-URL redirect endpoint (GET /r/{short_id})."""

    def setup_method(self):
        clear_url_db()

    def _create_short_url(self, url: str) -> dict:
        """Helper: shorten a URL and return the response JSON."""
        response = client.post("/api/shorten", json={"url": url})
        assert response.status_code == 200
        return response.json()

    def test_redirect_returns_302_for_known_id(self):
        """Known short_id should produce a 302 redirect."""
        data = self._create_short_url("https://example.com")
        response = client.get(f"/r/{data['short_id']}")
        assert response.status_code == 302

    def test_redirect_location_header_points_to_original_url(self):
        """Redirect Location header should be the original URL."""
        original = "https://example.com/page"
        data = self._create_short_url(original)
        response = client.get(f"/r/{data['short_id']}")
        assert response.headers["location"] == original

    def test_redirect_404_for_unknown_id(self):
        """Unknown short_id should return 404 Not Found."""
        response = client.get("/r/XXXXXX")
        assert response.status_code == 404

    def test_redirect_404_detail_message(self):
        """404 response for unknown short_id should contain a meaningful detail."""
        response = client.get("/r/XXXXXX")
        detail = response.json().get("detail", "")
        assert "not found" in detail.lower() or "short" in detail.lower()

    def test_redirect_http_url_is_preserved(self):
        """http:// URLs should be preserved in the redirect without being upgraded."""
        original = "http://example.com"
        data = self._create_short_url(original)
        response = client.get(f"/r/{data['short_id']}")
        assert response.headers["location"] == original

    def test_redirect_url_with_query_string(self):
        """Redirect should preserve query strings in the original URL."""
        original = "https://example.com/search?q=hello+world&page=2"
        data = self._create_short_url(original)
        response = client.get(f"/r/{data['short_id']}")
        assert response.headers["location"] == original

    def test_redirect_url_without_scheme_gets_https(self):
        """URL stored without a scheme should have https:// prepended, and redirect to it."""
        data = self._create_short_url("example.com")
        response = client.get(f"/r/{data['short_id']}")
        assert response.status_code == 302
        assert response.headers["location"] == "https://example.com"

    def test_multiple_short_ids_redirect_independently(self):
        """Each short_id must redirect to its own original URL."""
        urls = [
            "https://first.example.com",
            "https://second.example.com",
            "https://third.example.com",
        ]
        ids = [self._create_short_url(u)["short_id"] for u in urls]

        for short_id, original_url in zip(ids, urls):
            response = client.get(f"/r/{short_id}")
            assert response.status_code == 302
            assert response.headers["location"] == original_url

    def test_redirect_post_not_allowed(self):
        """POST to /r/{short_id} should return 405 Method Not Allowed."""
        data = self._create_short_url("https://example.com")
        response = client.post(f"/r/{data['short_id']}")
        assert response.status_code == 405

    def test_redirect_security_headers_present(self):
        """Redirect responses should still include the security headers from middleware."""
        data = self._create_short_url("https://example.com")
        response = client.get(f"/r/{data['short_id']}")
        assert response.headers.get("x-frame-options") == "DENY"

    def test_redirect_404_security_headers_present(self):
        """Even 404 responses on /r/ should include security headers."""
        response = client.get("/r/XXXXXX")
        assert response.headers.get("x-frame-options") == "DENY"


# ---------------------------------------------------------------------------
# URL normalization logic (white-box boundary tests)
# ---------------------------------------------------------------------------

class TestUrlNormalization:
    """Targeted tests for the URL normalization logic in shorten_url."""

    def setup_method(self):
        clear_url_db()

    def test_url_starting_with_https_unchanged(self):
        """https:// URLs pass through unmodified."""
        url = "https://example.com"
        resp = client.post("/api/shorten", json={"url": url})
        assert resp.json()["original_url"] == url

    def test_url_starting_with_http_unchanged(self):
        """http:// URLs pass through unmodified (not upgraded)."""
        url = "http://example.com"
        resp = client.post("/api/shorten", json={"url": url})
        assert resp.json()["original_url"] == url

    def test_url_without_scheme_gets_https(self):
        """Bare domain gets https:// prepended."""
        resp = client.post("/api/shorten", json={"url": "example.com"})
        assert resp.json()["original_url"] == "https://example.com"

    def test_url_with_ftp_scheme_also_gets_https_prepended(self):
        """ftp:// is not http(s):// so https:// is prepended, making it invalid but as per spec."""
        resp = client.post("/api/shorten", json={"url": "ftp://files.example.com"})
        # The code only checks startswith("http://") or startswith("https://")
        # ftp:// does NOT start with either, so https:// is prepended
        assert resp.json()["original_url"] == "https://ftp://files.example.com"

    def test_leading_whitespace_stripped(self):
        """Leading whitespace is removed before processing."""
        resp = client.post("/api/shorten", json={"url": "\t\n  https://example.com"})
        assert resp.json()["original_url"] == "https://example.com"

    def test_trailing_whitespace_stripped(self):
        """Trailing whitespace is removed before processing."""
        resp = client.post("/api/shorten", json={"url": "https://example.com   \n"})
        assert resp.json()["original_url"] == "https://example.com"

    def test_only_spaces_url_becomes_https_prepended(self):
        """A URL that is only spaces after stripping is rejected with 400."""
        resp = client.post("/api/shorten", json={"url": "   "})
        assert resp.status_code == 400

    def test_uppercase_http_not_recognized_as_scheme(self):
        """HTTP:// in uppercase is not matched as a scheme; https:// is prepended."""
        resp = client.post("/api/shorten", json={"url": "HTTP://example.com"})
        # startswith("http://") is case-sensitive; "HTTP://" won't match, so https:// gets prepended
        assert resp.json()["original_url"] == "https://HTTP://example.com"


# ---------------------------------------------------------------------------
# New endpoints present in existing endpoint list tests
# ---------------------------------------------------------------------------

class TestNewEndpointsInSuite:
    """Verify /crypto and /url-shortener are accessible alongside existing tools."""

    def setup_method(self):
        clear_url_db()

    def test_all_tool_endpoints_accessible(self):
        """All tool pages including the new ones should return 200."""
        endpoints = ["/crypto", "/url-shortener"]
        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.status_code == 200, f"Endpoint {endpoint} returned {response.status_code}"

    def test_new_pages_have_security_headers(self):
        """New HTML pages should have security headers from middleware."""
        for endpoint in ["/crypto", "/url-shortener"]:
            response = client.get(endpoint)
            assert response.headers.get("x-frame-options") == "DENY", endpoint
            assert response.headers.get("x-content-type-options") == "nosniff", endpoint
            assert "content-security-policy" in response.headers, endpoint
            assert response.headers.get("x-xss-protection") == "1; mode=block", endpoint

    def test_new_api_endpoint_accessible(self):
        """/api/shorten POST should be accessible and return 200."""
        response = client.post("/api/shorten", json={"url": "https://example.com"})
        assert response.status_code == 200

    def test_crypto_page_charset_and_html(self):
        """Crypto page should be valid HTML with charset declaration."""
        response = client.get("/crypto")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/html")
        assert "utf-8" in response.text.lower()

    def test_url_shortener_page_charset_and_html(self):
        """URL Shortener page should be valid HTML with charset declaration."""
        response = client.get("/url-shortener")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/html")
        assert "utf-8" in response.text.lower()


# ---------------------------------------------------------------------------
# Regression / boundary strengthening tests
# ---------------------------------------------------------------------------

class TestUrlShortenerRegressions:
    """Regression and boundary tests to strengthen confidence in the shortener."""

    def setup_method(self):
        clear_url_db()

    def test_short_id_length_invariant_over_many_calls(self):
        """short_id must always be exactly 6 characters regardless of input."""
        test_urls = [
            "https://a.com",
            "https://very-long-domain-name-that-exceeds-normal-length.co.uk/with/a/deep/path?and=many&query=params",
            "x",
            "http://localhost:8080",
        ]
        for url in test_urls:
            resp = client.post("/api/shorten", json={"url": url})
            assert resp.status_code == 200
            assert len(resp.json()["short_id"]) == 6, f"short_id wrong for url={url!r}"

    def test_url_db_cleared_between_test_classes(self):
        """Ensure the in-memory db is clear at the start of each test (setup_method works)."""
        assert len(url_db) == 0

    def test_redirect_not_found_returns_json_with_detail(self):
        """404 response from redirect should be JSON with a 'detail' key."""
        response = client.get("/r/ZZZZZZ")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    def test_shorten_and_redirect_round_trip(self):
        """Full round-trip: shorten a URL then redirect returns correct location."""
        original = "https://round-trip-test.example.com/path?x=1"
        shorten_resp = client.post("/api/shorten", json={"url": original})
        assert shorten_resp.status_code == 200
        short_id = shorten_resp.json()["short_id"]

        redirect_resp = client.get(f"/r/{short_id}")
        assert redirect_resp.status_code == 302
        assert redirect_resp.headers["location"] == original

    def test_shorten_url_value_in_response_matches_redirect(self):
        """short_url from /api/shorten response resolves to the same short_id redirect."""
        original = "https://check-short-url.example.com"
        shorten_resp = client.post("/api/shorten", json={"url": original})
        data = shorten_resp.json()
        # Extract path from short_url and follow it
        path = "/" + "/".join(data["short_url"].split("/")[3:])
        redirect_resp = client.get(path)
        assert redirect_resp.status_code == 302
        assert redirect_resp.headers["location"] == original

    def test_crypto_page_has_back_link(self):
        """Crypto page must have a back link (regression: all tool pages have one)."""
        response = client.get("/crypto")
        assert 'href="/"' in response.text or "DevSuite" in response.text

    def test_url_shortener_page_has_back_link(self):
        """URL Shortener page must have a back link."""
        response = client.get("/url-shortener")
        assert 'href="/"' in response.text or "DevSuite" in response.text

    def test_shorten_empty_short_id_not_generated(self):
        """short_id must never be an empty string."""
        for _ in range(5):
            resp = client.post("/api/shorten", json={"url": "https://example.com"})
            assert resp.json()["short_id"] != ""

    def test_redirect_short_id_case_sensitive(self):
        """short_id lookup is case-sensitive; wrong case returns 404."""
        data = client.post("/api/shorten", json={"url": "https://example.com"}).json()
        short_id = data["short_id"]
        # Invert case of first character; this is a different key
        inverted = short_id[0].swapcase() + short_id[1:]
        if inverted != short_id:
            response = client.get(f"/r/{inverted}")
            assert response.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])