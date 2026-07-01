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


def test_vault_page_loads_components_before_vault_script(client):
    """Regression: vault.js calls DevSuite.csrfToken() (defined in components.js)
    on the master-password setup path. If components.js is missing or loads after
    vault.js, setting a vault password throws "DevSuite is not defined" and the
    setup fails silently (regression shipped briefly during v0.3.0).

    Rule: components.js must appear before vault.js on the Vault page.
    """
    r = client.get("/vault")
    assert r.status_code == 200
    order = _script_order(r.text)
    assert "/static/components.js" in order, (
        "/vault: components.js not loaded — DevSuite is undefined, so setting a "
        "vault password throws 'DevSuite is not defined'"
    )
    assert order.index("/static/components.js") < order.index("/static/vault.js"), (
        "/vault: components.js must load before vault.js (defines DevSuite.csrfToken)"
    )
