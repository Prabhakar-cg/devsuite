"""Script load-order regression guard for pages mixing UMD bundles with RequireJS.

UMD bundles (JSZip, CryptoJS) register as anonymous AMD modules when
``define.amd`` already exists instead of setting their global. RequireJS then
throws "Mismatched anonymous define()" on the page's next ``require()`` call,
which kills the whole tool script before any event listener attaches — every
button on the page goes dead (regression shipped briefly during v0.3.0).

Rule: on any page that loads require.min.js, all UMD bundles must appear
BEFORE it.
"""
import re


def _script_order(html: str) -> list[str]:
    return re.findall(r'<script src="([^"?]+)', html)


def _assert_umd_before_require(html: str, page: str):
    order = _script_order(html)
    require_idx = order.index("/static/libs/require.min.js")
    for umd in ("/static/libs/jszip.min.js", "/static/crypto-js.min.js"):
        if umd in order:
            assert order.index(umd) < require_idx, (
                f"{page}: {umd} loads after require.min.js — UMD bundles register "
                "as anonymous AMD modules and break the page (see module docstring)"
            )


def test_api_tester_umd_bundles_load_before_requirejs(client):
    r = client.get("/api-tester")
    assert r.status_code == 200
    _assert_umd_before_require(r.text, "/api-tester")


def test_diff_page_umd_bundles_load_before_requirejs(client):
    r = client.get("/diff")
    assert r.status_code == 200
    _assert_umd_before_require(r.text, "/diff")
