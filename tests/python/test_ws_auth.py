"""Tests for WebSocket session gating (SEC-14).

The SSH/dashboard/local-terminal WebSockets must require a valid ds_session
once a master password is configured, while still allowing the no-password
flow before first-time setup.  The dashboard endpoint is used here because it
closes/accepts at the gate without forking a shell or opening an SSH connection.
"""
import time

import main
import pytest
from starlette.websockets import WebSocketDisconnect

_DASHBOARD = "/api/ssh/dashboard"
_ORIGIN = {"origin": "http://testserver"}


def _configure_master_password(db):
    db.set_store("app_prefs", {"master_setup_done": True})


def test_ws_allowed_before_setup(client):
    """Before any master password exists, the gate must let the socket through."""
    with client.websocket_connect(_DASHBOARD, headers=_ORIGIN):
        pass  # context enters => connection accepted (server now awaits config)


def test_ws_rejected_without_session_when_configured(client, isolated_db):
    """Once configured, a session-less connect must be closed by the gate."""
    _configure_master_password(isolated_db)
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(_DASHBOARD, headers=_ORIGIN) as ws:
            ws.receive_json()


def test_ws_allowed_with_valid_session(client, isolated_db):
    """Once configured, a valid ds_session cookie must be accepted by the gate."""
    _configure_master_password(isolated_db)
    token = "valid-session-token"
    main._sessions[main._hash_token(token)] = time.time() + 3600
    client.cookies.set("ds_session", token)
    with client.websocket_connect(_DASHBOARD, headers=_ORIGIN):
        pass  # context enters => gate passed and connection accepted
