"""
DevSuite — Shared dependencies
-------------------------------
Central module for singletons, constants, and helper functions shared across
all route modules.  Route files MUST import from here; they must NOT import
from main.py to avoid circular imports.

Tests may access these via ``main.<name>`` because main.py re-exports them with
``from deps import <name>``, which creates name bindings in main's namespace
pointing to the same objects defined here.
"""

import hashlib
import json
import logging
import os
import re
import struct  # noqa: F401 — used by ssh.py local terminal resize
import time
import urllib.parse  # noqa: F401 — used by proxy.py / sftp download
import urllib.request  # noqa: F401 — used by proxy.py
from pathlib import Path

from fastapi import HTTPException, Request
from fastapi.responses import Response  # noqa: F401 — used by convert.py
from slowapi import Limiter
from slowapi.util import get_remote_address

from devdb import DevDB

# ─── PTY support (Linux/macOS only) ──────────────────────────────────────────
pty = None  # pylint: disable=invalid-name
fcntl = None  # pylint: disable=invalid-name
termios = None  # pylint: disable=invalid-name
_pty_available = False
try:
    import pty  # type: ignore[assignment]  # noqa: F401 — re-exported to routes/ssh.py
    import fcntl  # type: ignore[assignment]  # noqa: F401
    import termios  # type: ignore[assignment]  # noqa: F401
    _pty_available = True
except ImportError:
    pass
_PTY_AVAILABLE = _pty_available  # compatibility alias for tests referencing main._PTY_AVAILABLE

logger = logging.getLogger("devsuite")

# ─── App version and run-mode flags ──────────────────────────────────────────
APP_VERSION = "0.19.0"
_DEV_MODE   = os.getenv("DEVSUITE_DEV",   "0") == "1"
_HTTPS      = os.getenv("DEVSUITE_HTTPS", "0") == "1"

# ─── DevDB ────────────────────────────────────────────────────────────────────
_DEVSUITE_DIR = Path.home() / ".devsuite"
_DB_PATH      = _DEVSUITE_DIR / "devdb.dsb"
_db           = DevDB(_DB_PATH, password=os.environ.get("DEVDB_PASSWORD") or None)

# ─── Rate limiter ─────────────────────────────────────────────────────────────
# Registered on app.state in main.py after app creation.
limiter = Limiter(key_func=get_remote_address)

# ─── Shared string constants ──────────────────────────────────────────────────
_ALLOWED_ORIGINS        = ["http://localhost:8000", "http://127.0.0.1:8000"]  # NOSONAR
_ERR_ORIGIN_REQUIRED    = "Origin header required"
_ERR_ORIGIN_NOT_ALLOWED = "Origin not allowed"
_ERR_SFTP_FAILED        = "SFTP operation failed"
_OPENPYXL_MISSING       = "openpyxl is not installed. Run: pip install openpyxl"
_MIME_OCTET_STREAM      = "application/octet-stream"
_RE_NON_DIGIT           = r'\D'
_WSL_EXE                = "wsl.exe"

# ─── Host / Origin allowlist (SEC-15 / SEC-16, specs/025-security-hardening) ───
# DevSuite is a loopback tool. Validating the Host header defeats DNS rebinding
# (a hostile page whose DNS flips to 127.0.0.1 would otherwise be same-origin, so
# CORS and the double-submit CSRF cookie both pass). Users who deliberately bind
# another interface add its hostname via DEVSUITE_ALLOWED_HOSTS (comma-separated).
_LOOPBACK_HOSTNAMES = frozenset({"localhost", "127.0.0.1", "::1"})


def allowed_hosts() -> frozenset:
    """Allowlisted hostnames (port-agnostic), read from the environment each call."""
    extra = {h.strip().lower() for h in os.getenv("DEVSUITE_ALLOWED_HOSTS", "").split(",") if h.strip()}
    return _LOOPBACK_HOSTNAMES | extra


def _hostname_of(host_header: str) -> str:
    """Hostname from a Host header value (strips port; understands [::1]:8000)."""
    value = (host_header or "").strip().lower()
    if value.startswith("["):
        return value[1:value.find("]")] if "]" in value else ""
    return value.rsplit(":", 1)[0] if value.count(":") == 1 else value


def host_allowed(host_header: str) -> bool:
    """True if the request's Host header names an allowlisted hostname."""
    name = _hostname_of(host_header)
    return bool(name) and name in allowed_hosts()


def origin_allowed(origin: str) -> bool:
    """True if an Origin header (scheme://host[:port]) names an allowlisted hostname."""
    if not origin or origin == "null":
        return False
    parsed = urllib.parse.urlparse(origin)
    return parsed.scheme in ("http", "https") and bool(parsed.hostname) and parsed.hostname.lower() in allowed_hosts()


# ─── Static file serving ─────────────────────────────────────────────────────
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)

MAX_UPLOAD_SIZE  = 20 * 1024 * 1024
_XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

_STATIC_ASSET_RE = re.compile(r'(/static/[^"\'?]+\.(?:css|js))(?:\?v=[^"\']*)?')
_FAVICON_TAG = (
    '<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">\n'
    '    <link rel="icon" href="/static/favicon.svg" sizes="any">'
)
# Command Palette (feature 022): injected on every page, never linked from any
# static/*.html file directly — see specs/022-command-palette/contracts/injected-markup.md.
_COMMAND_PALETTE_CSS_TAG = '<link rel="stylesheet" href="/static/command-palette.css">'
_COMMAND_PALETTE_SCRIPT_TAGS = (
    '<script src="/static/command-palette-data.js" defer></script>\n'
    '<script src="/static/command-palette.js" defer></script>'
)
# Accessibility foundation (feature 023, SPEC §9.12): injected on every page, never
# linked from any static/*.html file directly. Skip link targets #ds-main, which
# static/a11y.js assigns to the page's <main> landmark.
_A11Y_CSS_TAG = '<link rel="stylesheet" href="/static/a11y.css">'
# Tool-page theme layer (feature 024, SPEC §9.13): canonical tokens per theme, injected on every page.
_THEME_LAYER_CSS_TAG = '<link rel="stylesheet" href="/static/theme-layer.css">'
# Tool-page bento skin (feature 028, SPEC §9.15): toolskin.css styles only [data-tool] pages;
# bento.css supplies the shared art-colour classes; bento-art.js renders <svg data-art>.
_BENTO_CSS_TAG = '<link rel="stylesheet" href="/static/bento.css">'
_TOOLSKIN_CSS_TAG = '<link rel="stylesheet" href="/static/toolskin.css">'
_BENTO_ART_SCRIPT_TAG = '<script src="/static/bento-art.js" defer></script>'
_A11Y_SKIP_LINK = '<a class="ds-skip-link" href="#ds-main">Skip to main content</a>'
_A11Y_SCRIPT_TAG = '<script src="/static/a11y.js" defer></script>'
_BODY_OPEN_RE = re.compile(r'<body\b[^>]*>', re.IGNORECASE)


def _asset_fingerprint(static_path: str) -> str:
    """Return an 8-char MD5 of the file's content, falling back to APP_VERSION."""
    file_path = os.path.join(static_dir, static_path.removeprefix('/static/'))
    try:
        with open(file_path, 'rb') as f:
            return hashlib.md5(f.read(), usedforsecurity=False).hexdigest()[:8]
    except OSError:
        return APP_VERSION


def _insert_before_closing_body(html: str, tags: str) -> str:
    """Insert *tags* before the document's FINAL ``</body>``.

    ``str.replace(..., 1)`` hit the first occurrence, which for file-converter.html is a
    ``</body>`` inside a JavaScript template literal — the injected ``<script>`` tags landed
    inside the string and broke the page's whole script (every button dead).
    """
    head, sep, tail = html.rpartition('</body>')
    return f'{head}{tags}\n{sep}{tail}' if sep else html


def _serve_html(filename: str) -> str:
    """Read an HTML file, inject favicon + per-file content-hash versions into asset URLs."""
    html_path = os.path.join(static_dir, filename)
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            html = f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"{filename} not found.") from None  # NOSONAR
    if 'favicon' not in html:
        html = html.replace('<head>', f'<head>\n    {_FAVICON_TAG}', 1)
    if '/static/a11y.css' not in html:
        html = html.replace('<head>', f'<head>\n    {_A11Y_CSS_TAG}', 1)
    if '/static/toolskin.css' not in html:
        html = html.replace('<head>', f'<head>\n    {_TOOLSKIN_CSS_TAG}', 1)
    if '/static/bento.css' not in html:
        html = html.replace('<head>', f'<head>\n    {_BENTO_CSS_TAG}', 1)
    if '/static/theme-layer.css' not in html:
        html = html.replace('<head>', f'<head>\n    {_THEME_LAYER_CSS_TAG}', 1)
    if 'ds-skip-link' not in html:
        html = _BODY_OPEN_RE.sub(lambda m: f'{m.group(0)}\n{_A11Y_SKIP_LINK}', html, count=1)
    if '/static/a11y.js' not in html and '</body>' in html:
        html = _insert_before_closing_body(html, _A11Y_SCRIPT_TAG)
    if '/static/bento-art.js' not in html and '</body>' in html:
        html = _insert_before_closing_body(html, _BENTO_ART_SCRIPT_TAG)
    if 'command-palette.css' not in html:
        html = html.replace('<head>', f'<head>\n    {_COMMAND_PALETTE_CSS_TAG}', 1)
    if 'command-palette.js' not in html and '</body>' in html:
        html = _insert_before_closing_body(html, _COMMAND_PALETTE_SCRIPT_TAGS)
    return _STATIC_ASSET_RE.sub(lambda m: f'{m.group(1)}?v={_asset_fingerprint(m.group(1))}', html)


# ─── Audit log ───────────────────────────────────────────────────────────────
_AUDIT_LOG_PATH = _DEVSUITE_DIR / "audit.log"


def _audit_log(event: str, **details) -> None:
    """Append a JSON line to ~/.devsuite/audit.log.  Never logs secret values."""
    try:
        record = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "event": event}
        record.update({k: str(v) for k, v in details.items()})
        _DEVSUITE_DIR.mkdir(parents=True, exist_ok=True)
        first_write = not _AUDIT_LOG_PATH.exists()
        with open(_AUDIT_LOG_PATH, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record) + "\n")
        if first_write:
            try:
                os.chmod(_AUDIT_LOG_PATH, 0o600)
            except OSError:
                pass  # best-effort — non-POSIX systems
    except OSError:
        logger.warning("audit: failed to write log entry for %s", event)


# ─── Server-side session store ───────────────────────────────────────────────
# Tokens are issued by /api/auth/session after the client verifies the master key.
_sessions: dict[str, float] = {}   # BLAKE2b(token) hex → unix expiry
_SESSION_TTL = 8 * 3600            # 8 hours (matches auth-guard.js SESSION_MS)


def _hash_token(token: str) -> str:
    return hashlib.blake2b(token.encode(), digest_size=32).hexdigest()


_MAX_SESSIONS = 100  # defence in depth: sessions are per unlock, 100 is far beyond real use


def _evict_expired_sessions(now: float | None = None) -> None:
    now = time.time() if now is None else now
    for key in [k for k, exp in _sessions.items() if exp <= now]:
        _sessions.pop(key, None)


def register_session(token: str) -> None:
    """Store a new session, evicting expired entries and capping the table (SEC-21)."""
    _evict_expired_sessions()
    while len(_sessions) >= _MAX_SESSIONS:
        _sessions.pop(min(_sessions, key=_sessions.get), None)  # drop the soonest-to-expire
    _sessions[_hash_token(token)] = time.time() + _SESSION_TTL


def is_session_valid(token: str) -> bool:
    """Return True if *token* maps to a live (non-expired) server-side session.

    Expired entries are evicted as a side effect.  Shared by the HTTP
    ``require_unlocked`` dependency and the WebSocket session gate.
    """
    token = (token or "").strip()
    if not token:
        return False
    token_hash = _hash_token(token)
    expiry = _sessions.get(token_hash)
    if expiry is None or time.time() > expiry:
        _sessions.pop(token_hash, None)
        return False
    return True


def is_auth_configured() -> bool:
    """Return True once a master password has been set up (auth is active)."""
    prefs = _db.get_store("app_prefs") or {}
    return bool(prefs.get("master_setup_done"))


def require_unlocked(request: Request) -> None:
    """Raise 401 if the request does not carry a valid server-side session token."""
    token = request.cookies.get("ds_session", "").strip()
    if not token:
        token = request.headers.get("X-Session-Token", "").strip()
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Session token required. Call POST /api/auth/session first.",
        )
    if not is_session_valid(token):
        raise HTTPException(status_code=401, detail="Session expired or invalid.")


def require_session_if_configured(request: Request) -> None:
    """Session gate for endpoints that must also work before any master password exists.

    Mirrors the WebSocket carve-out (SEC-14): dormant until a master password is
    configured, then a valid session is mandatory (SEC-17).
    """
    if is_auth_configured():
        require_unlocked(request)


# ─── Shared DevDB / validation constants ─────────────────────────────────────
_ALLOWED_STORES = {"vault", "collections", "ssh_profiles", "app_prefs", "notes", "roadmaps"}
# Only allow printable, non-shell-special characters for WSL distro names.
_DISTRO_NAME_RE = re.compile(r'^[A-Za-z0-9_.\-]+$')
