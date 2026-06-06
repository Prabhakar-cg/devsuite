"""CORS proxy SSRF protection.

Covers SPEC.md §5.9 / §10.2 — private/reserved IPs blocked, schemes restricted,
and (the previously-missing protection) redirects re-validated so a public host
cannot 3xx into a private/reserved IP such as the cloud-metadata endpoint.
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


def test_redirect_handler_blocks_private_target():
    handler = main._SSRFSafeRedirectHandler()
    with pytest.raises(HTTPException) as exc:
        handler.redirect_request(None, None, 302, "Found", {}, "http://169.254.169.254/")
    assert exc.value.status_code == 403


def test_redirect_handler_blocks_disallowed_scheme():
    handler = main._SSRFSafeRedirectHandler()
    with pytest.raises(HTTPException):
        handler.redirect_request(None, None, 302, "Found", {}, "file:///etc/passwd")
