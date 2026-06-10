"""Proxy Set-Cookie passthrough (SPEC §5.9 / §10.2).

``dict(resp.headers)`` collapses duplicate header names, so a target that sets
multiple cookies (session + CSRF, for example) would lose all but one. The
proxy response therefore carries a ``set_cookie`` list with every Set-Cookie
header verbatim for the client-side cookie jar (SPEC §4.7.5).
"""
from email.message import Message

from routes.proxy import _collect_set_cookies


def test_collect_set_cookies_preserves_duplicates():
    headers = Message()
    headers["Set-Cookie"] = "session=abc123; Path=/; HttpOnly"
    headers["Set-Cookie"] = "csrf=xyz789; Path=/"
    headers["Content-Type"] = "application/json"
    assert _collect_set_cookies(headers) == [
        "session=abc123; Path=/; HttpOnly",
        "csrf=xyz789; Path=/",
    ]


def test_collect_set_cookies_empty_when_absent():
    headers = Message()
    headers["Content-Type"] = "text/html"
    assert _collect_set_cookies(headers) == []


def test_collect_set_cookies_tolerates_plain_dict():
    # Defensive: a mapping without get_all() must not crash the proxy.
    assert _collect_set_cookies({"Set-Cookie": "a=1"}) == []
