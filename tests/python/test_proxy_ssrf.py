"""CORS proxy SSRF protection.

Covers SPEC.md §5.9 / §10.2 — loopback/link-local/reserved IPs blocked, schemes
restricted, and redirects re-validated so a remote host cannot 3xx into a loopback
or cloud-metadata address.  LAN / RFC-1918 ranges are intentionally *allowed*
(DevSuite is a local tool; testing 10.x.x.x APIs is a first-class use case).
"""
import pytest
from fastapi import HTTPException

import main

_CSRF = {"Cookie": "ds_csrf=t", "X-CSRF-Token": "t"}


def test_proxy_blocks_loopback(client):
    r = client.post("/api/proxy", json={"url": "http://127.0.0.1:9/"}, headers=_CSRF)
    assert r.status_code == 403


def test_proxy_blocks_non_http_scheme(client):
    r = client.post("/api/proxy", json={"url": "file:///etc/passwd"}, headers=_CSRF)
    assert r.status_code == 400


def test_proxy_requires_csrf(client):
    # No CSRF token → blocked by middleware before any network logic.
    r = client.post("/api/proxy", json={"url": "http://example.com/"})
    assert r.status_code == 403


def test_check_ip_blocks_link_local_metadata():
    with pytest.raises(HTTPException) as exc:
        main._check_ip_not_private("169.254.169.254")
    assert exc.value.status_code == 403


def test_check_ip_allows_public():
    main._check_ip_not_private("8.8.8.8")  # must not raise


def test_check_ip_allows_private_lan():
    """LAN addresses must be allowed — local-tool use case (SPEC.md §5.9)."""
    main._check_ip_not_private("10.0.0.1")       # RFC-1918 class A
    main._check_ip_not_private("192.168.1.100")  # RFC-1918 class C
    main._check_ip_not_private("172.16.0.1")     # RFC-1918 class B


def test_redirect_handler_blocks_private_target():
    handler = main._SSRFSafeRedirectHandler()
    with pytest.raises(HTTPException) as exc:
        handler.redirect_request(None, None, 302, "Found", {}, "http://169.254.169.254/")
    assert exc.value.status_code == 403


def test_redirect_handler_blocks_disallowed_scheme():
    handler = main._SSRFSafeRedirectHandler()
    with pytest.raises(HTTPException):
        handler.redirect_request(None, None, 302, "Found", {}, "file:///etc/passwd")
