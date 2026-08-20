"""CSP split between documents and the script-sandbox worker (SPEC §5.10 / §10.2).

v0.3.0 removed ``unsafe-eval`` from document responses (SEC-6). The only
response allowed to carry it is /static/script-sandbox-worker.js, whose scoped
policy also denies all network (``connect-src 'none'``) and everything else
(``default-src 'none'``), so sandboxed API Tester scripts cannot reach the
DOM, cookies, or any host.
"""


def test_document_csp_has_no_unsafe_eval(client):
    r = client.get("/api-tester")
    assert r.status_code == 200
    csp = r.headers["content-security-policy"]
    assert "unsafe-eval" not in csp
    assert "script-src" in csp


def test_homepage_csp_has_no_unsafe_eval(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "unsafe-eval" not in r.headers["content-security-policy"]


def test_static_asset_csp_has_no_unsafe_eval(client):
    r = client.get("/static/api-tester.js")
    assert r.status_code == 200
    assert "unsafe-eval" not in r.headers["content-security-policy"]


def test_sandbox_worker_csp_is_scoped(client):
    r = client.get("/static/script-sandbox-worker.js")
    assert r.status_code == 200
    csp = r.headers["content-security-policy"]
    assert "'unsafe-eval'" in csp
    assert "default-src 'none'" in csp
    assert "connect-src 'none'" in csp


def test_document_csp_font_src_allows_data_uri(client):
    # Monaco's codicon icon font (Find/Replace widget, etc.) is embedded as a
    # data: URI inside editor.main.css, not a separate file — font-src must
    # allow data: or those icons render as tofu boxes. All self-hosted, so
    # this doesn't widen font-src to any remote origin.
    r = client.get("/notes")
    assert r.status_code == 200
    csp = r.headers["content-security-policy"]
    assert "font-src 'self' data:" in csp


def test_security_headers_present(client):
    r = client.get("/")
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-xss-protection"] == "0"
    assert r.headers["referrer-policy"] == "strict-origin-when-cross-origin"
