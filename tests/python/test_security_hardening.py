"""Security hardening guards (specs/025-security-hardening, SPEC §7.9).

Covers SEC-15 (Host allowlist / DNS rebinding), SEC-16 (Origin validation),
SEC-17 (SFTP/WSL session gate), SEC-18 (proxy connect-time peer check),
SEC-19 (hardening headers), SEC-20 (archive limits), SEC-21 (session/audit hygiene).
"""
import io
import json
import socket
import time
import zipfile

import deps
import main
import pytest
from fastapi import HTTPException
from starlette.websockets import WebSocketDisconnect

from routes import convert, proxy


def _csrf(client):
    """Prime the double-submit cookie and return the matching header."""
    client.get("/")
    return {"X-CSRF-Token": client.cookies.get("ds_csrf")}


def _configure_master_password(db):
    db.set_store("app_prefs", {"master_setup_done": True})


# ── SEC-15: Host allowlist ───────────────────────────────────────────────────

@pytest.mark.parametrize("path", ["/", "/api/auth/status", "/static/a11y.css", "/vault"])
def test_foreign_host_is_rejected(client, path):
    r = client.get(path, headers={"host": "evil.example"})
    assert r.status_code == 400
    assert r.json() == {"error": "Invalid Host header"}


@pytest.mark.parametrize("host", ["localhost", "localhost:8000", "127.0.0.1:8001", "[::1]:8000", "testserver"])
def test_loopback_hosts_are_accepted(client, host):
    assert client.get("/api/auth/status", headers={"host": host}).status_code == 200


def test_rebinding_style_host_with_loopback_suffix_is_rejected(client):
    # attacker-controlled names that merely *contain* an allowed name
    for host in ("localhost.evil.example", "127.0.0.1.evil.example", "evil-localhost"):
        assert client.get("/", headers={"host": host}).status_code == 400, host


def test_allowed_hosts_env_extends_allowlist(monkeypatch):
    assert not deps.host_allowed("devbox.lan:8000")
    monkeypatch.setenv("DEVSUITE_ALLOWED_HOSTS", "devbox.lan, other.lan")
    assert deps.host_allowed("devbox.lan:8000") and deps.host_allowed("OTHER.LAN")
    assert not deps.host_allowed("evil.example")


@pytest.mark.parametrize("value,expected", [
    ("localhost:8000", "localhost"), ("[::1]:8000", "::1"), ("example.com", "example.com"),
    ("", ""), ("[::1", ""),
])
def test_hostname_parsing(value, expected):
    assert deps._hostname_of(value) == expected


# ── SEC-16: Origin validation ────────────────────────────────────────────────

def test_cross_origin_mutating_request_is_blocked(client):
    headers = {**_csrf(client), "origin": "http://evil.example"}
    r = client.post("/api/auth/logout", headers=headers)
    assert r.status_code == 403 and "Cross-origin" in r.json()["error"]


def test_null_origin_mutating_request_is_blocked(client):
    r = client.post("/api/auth/logout", headers={**_csrf(client), "origin": "null"})
    assert r.status_code == 403


def test_same_origin_mutating_request_is_allowed(client):
    r = client.post("/api/auth/logout", headers={**_csrf(client), "origin": "http://localhost:8000"})
    assert r.status_code == 200


def test_cross_origin_reads_are_not_origin_blocked(client):
    # GETs are not state-changing; CORS (not this guard) governs readability.
    assert client.get("/api/auth/status", headers={"origin": "http://evil.example"}).status_code == 200


def test_ws_origin_trust_is_not_derived_from_host_header(client):
    """Origin == http://<Host> used to pass; under DNS rebinding the attacker controls both."""
    headers = {"origin": "http://evil.example", "host": "evil.example"}
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/api/ssh/dashboard", headers=headers) as ws:
            ws.receive_json()


def test_ws_foreign_host_with_allowed_origin_is_rejected(client):
    headers = {"origin": "http://localhost:8000", "host": "evil.example"}
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/api/ssh/dashboard", headers=headers) as ws:
            ws.receive_json()


# ── SEC-17: SFTP / WSL session gate ──────────────────────────────────────────

_SFTP_BODY = {"host": "127.0.0.1", "port": 22, "username": "u", "password": "p", "path": "/"}


@pytest.mark.parametrize("method,path,kwargs", [
    ("post", "/api/sftp/list", {"json": _SFTP_BODY}),
    ("post", "/api/sftp/download", {"json": {**_SFTP_BODY, "remote_path": "/etc/hosts"}}),
    ("post", "/api/sftp/upload", {"data": {"host": "h", "username": "u", "remote_path": "/"},
                                    "files": {"file": ("a.txt", b"x")}}),
    ("get", "/api/wsl/discover", {}),
])
def test_sftp_and_wsl_require_session_once_configured(client, isolated_db, method, path, kwargs):
    _configure_master_password(isolated_db)
    r = getattr(client, method)(path, headers=_csrf(client), **kwargs)
    assert r.status_code == 401, (path, r.status_code, r.text[:120])


def test_gate_is_dormant_before_master_password_setup(isolated_db):
    class _Req:  # minimal Request double
        cookies = {}
        headers = {}
    deps.require_session_if_configured(_Req())  # must not raise


def test_gate_accepts_valid_session_cookie(client, isolated_db):
    _configure_master_password(isolated_db)
    token = "t-" + "x" * 20
    deps.register_session(token)
    client.cookies.set("ds_session", token)
    r = client.get("/api/wsl/discover")
    assert r.status_code == 200


# ── SEC-18: proxy peer validation ────────────────────────────────────────────

@pytest.mark.parametrize("ip", [
    "127.0.0.1", "127.1.2.3", "::1", "0.0.0.0", "::", "::ffff:127.0.0.1", "::ffff:169.254.169.254",
    "169.254.169.254", "224.0.0.1", "240.0.0.1", "fe80::1",
])
def test_forbidden_addresses(ip):
    assert proxy.ip_is_forbidden(ip), ip


@pytest.mark.parametrize("ip", ["10.0.0.5", "192.168.1.20", "172.16.0.9", "8.8.8.8", "2606:4700::1111", "example.com"])
def test_permitted_addresses(ip):
    assert not proxy.ip_is_forbidden(ip), ip


def test_connect_time_guard_blocks_loopback_even_if_precheck_was_bypassed():
    """Simulate a DNS-rebinding win: the pre-check is skipped, the socket still lands on loopback."""
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    try:
        port = srv.getsockname()[1]
        conn = proxy._GuardedHTTPConnection("127.0.0.1", port, timeout=3)
        with pytest.raises(HTTPException) as exc:
            conn.connect()
        assert exc.value.status_code == 403
    finally:
        srv.close()


def test_execute_proxy_request_never_sends_to_loopback(monkeypatch):
    received = []
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    srv.settimeout(0.5)
    try:
        port = srv.getsockname()[1]
        import urllib.request
        req = urllib.request.Request(f"http://127.0.0.1:{port}/secret")
        with pytest.raises(HTTPException) as exc:
            proxy._execute_proxy_request(req)
        assert exc.value.status_code == 403
        try:
            c, _ = srv.accept()  # the TCP handshake completes, but no HTTP bytes may arrive
            c.settimeout(0.3)
            try:
                received.append(c.recv(1024))
            except OSError:
                pass
            c.close()
        except OSError:
            pass
        assert not any(received), "request bytes reached a loopback service"
    finally:
        srv.close()


def test_proxy_ignores_environment_proxies(monkeypatch):
    monkeypatch.setenv("HTTP_PROXY", "http://127.0.0.1:3128")
    monkeypatch.setenv("http_proxy", "http://127.0.0.1:3128")
    import urllib.request
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), proxy._GuardedHTTPHandler())
    assert not any(isinstance(h, urllib.request.ProxyHandler) and h.proxies for h in opener.handlers)


# ── SEC-19: hardening headers ────────────────────────────────────────────────

def test_document_csp_has_framing_and_base_directives(client):
    csp = client.get("/").headers["content-security-policy"]
    for directive in ("frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'", "form-action 'self'"):
        assert directive in csp
    assert "unsafe-eval" not in csp


def test_ws_tester_csp_keeps_ws_connect_and_hardening(client):
    csp = client.get("/ws-tester").headers["content-security-policy"]
    assert "connect-src 'self' ws: wss:" in csp and "frame-ancestors 'none'" in csp


def test_sandbox_worker_policy_is_unchanged(client):
    csp = client.get("/static/script-sandbox-worker.js").headers["content-security-policy"]
    assert "unsafe-eval" in csp and "connect-src 'none'" in csp


def test_common_hardening_headers_on_every_response(client):
    h = client.get("/").headers
    assert h["cross-origin-opener-policy"] == "same-origin"
    assert h["cross-origin-resource-policy"] == "same-origin"
    assert "camera=()" in h["permissions-policy"] and "microphone=()" in h["permissions-policy"]
    assert h["x-frame-options"] == "DENY"


def test_api_responses_are_not_cacheable(client):
    assert client.get("/api/auth/status").headers["cache-control"] == "no-store"


def test_static_assets_are_not_forced_no_store(client):
    assert client.get("/static/a11y.css").headers.get("cache-control") != "no-store"


# ── SEC-20: archive limits ───────────────────────────────────────────────────

def _zip_bytes(entries: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in entries.items():
            zf.writestr(name, data)
    return buf.getvalue()


def test_archive_within_limits_passes():
    convert._check_archive_limits(_zip_bytes({"a.xml": b"<x/>"}))


def test_non_zip_bytes_are_left_to_the_parser():
    convert._check_archive_limits(b"\xd0\xcf\x11\xe0 legacy .doc")


def test_archive_total_uncompressed_size_is_capped(monkeypatch):
    monkeypatch.setattr(convert, "MAX_ARCHIVE_UNCOMPRESSED", 1000)
    bomb = _zip_bytes({"big.xml": b"A" * 5000})  # compresses to a few dozen bytes
    assert len(bomb) < 200
    with pytest.raises(HTTPException) as exc:
        convert._check_archive_limits(bomb)
    assert exc.value.status_code == 413


def test_archive_entry_count_is_capped(monkeypatch):
    monkeypatch.setattr(convert, "MAX_ARCHIVE_ENTRIES", 2)
    with pytest.raises(HTTPException) as exc:
        convert._check_archive_limits(_zip_bytes({f"{i}.xml": b"x" for i in range(3)}))
    assert exc.value.status_code == 413


def test_convert_endpoint_rejects_archive_bomb(client, monkeypatch):
    monkeypatch.setattr(convert, "MAX_ARCHIVE_UNCOMPRESSED", 1000)
    bomb = _zip_bytes({"xl/sheet.xml": b"A" * 5000})
    r = client.post("/api/convert", headers=_csrf(client),
                    files={"file": ("book.xlsx", bomb)}, data={"target_format": "csv"})
    assert r.status_code == 413


# ── SEC-21: session & audit hygiene ──────────────────────────────────────────

def test_register_session_evicts_expired_entries():
    deps._sessions["stale"] = time.time() - 10
    deps.register_session("fresh-token")
    assert "stale" not in deps._sessions
    assert deps._hash_token("fresh-token") in deps._sessions


def test_session_table_is_capped(monkeypatch):
    monkeypatch.setattr(deps, "_MAX_SESSIONS", 3)
    for i in range(6):
        deps.register_session(f"tok-{i}")
    assert len(deps._sessions) <= 3
    assert deps._hash_token("tok-5") in deps._sessions  # newest survives


def test_failed_unlock_is_audit_logged_without_the_key(client, isolated_db, tmp_path):
    isolated_db.set_store("app_prefs", {
        "master_setup_done": True, "challenge_version": 2,
        "master_verify_nonce": "00" * 12, "master_verify_blob": "00" * 32, "master_salt": "ab",
    })
    secret = "ab" * 32
    r = client.post("/api/auth/session", json={"key_hex": secret})
    assert r.status_code == 401
    log = (tmp_path / "audit.log").read_text()
    events = [json.loads(line)["event"] for line in log.splitlines()]
    assert "AUTH_FAIL" in events
    assert secret not in log


def test_setup_endpoint_is_rate_limited(client):
    codes = [client.post("/api/auth/setup", json={}).status_code for _ in range(12)]
    assert codes[0] == 400 and 429 in codes
