"""
DevSuite — FastAPI Backend  (v2.2.0)
---------------------------------
Serves the static frontend and provides REST/WebSocket APIs for all tools.

Persistence
-----------
All data is stored through the DevDB engine in a single KeePass-style
binary file at ~/.devsuite/devdb.dsb.  The server never decrypts the
client-side AES-encrypted blobs inside the vault/ssh_profiles stores."""

import os
import string
import secrets
import json
import urllib.parse
import urllib.request
import urllib.error
import socket
import ipaddress
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, RedirectResponse, Response
import asyncio
import asyncssh
import stat
import sys
import logging
import subprocess
import re
from pydantic import BaseModel
from devdb import DevDB

# PTY support is Linux/macOS only — import conditionally so the module loads on Windows.
_PTY_AVAILABLE = False
if sys.platform != 'win32':
    try:
        import pty
        import fcntl
        import struct
        import termios
        _PTY_AVAILABLE = True
    except ImportError:
        pass

logger = logging.getLogger("devsuite")

# ─── DevDB — Unified Encrypted Database ────────────────────────────────────────
_DEVSUITE_DIR  = Path.home() / ".devsuite"
_DB_PATH       = _DEVSUITE_DIR / "devdb.dsb"
_LEGACY_URL_DB = Path(__file__).parent / "url_db.json"   # in-repo legacy file

_db = DevDB(_DB_PATH)


@asynccontextmanager
async def _lifespan(application: FastAPI):
    """Modern FastAPI lifespan: open DevDB, migrate legacy files, seed url_db cache."""
    global url_db
    _db.open()
    migrated = DevDB.migrate_legacy(_db, _DEVSUITE_DIR, _LEGACY_URL_DB)
    if migrated:
        _db.save()
        logger.info("DevDB: migration complete, database saved to %s", _DB_PATH)
    else:
        logger.info("DevDB: opened %s (%d bytes)", _DB_PATH, _db.file_size())
    url_db.update(_db.get_store("url_db"))
    yield  # app is running
    # (cleanup goes here if needed in future)


app = FastAPI(
    title="DevSuite",
    description="A private, locally-hosted developer suite with encrypted unified storage.",
    version="2.2.0",
    lifespan=_lifespan,
)

# Allowlist of hostnames that the /api/proxy endpoint is permitted to contact.
# Adjust this set to match the APIs you intend to test via the proxy.
ALLOWED_PROXY_HOSTS = {
    # Example public APIs:
    "api.github.com",
    "jsonplaceholder.typicode.com",
    "httpbin.org",
}

static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)

# Serve static assets (JS, CSS, images) from the /static route
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# ─── URL Shortener helpers (backed by DevDB 'url_db' store) ────────────────────
def _load_url_db() -> dict:
    """Load the url_db store from DevDB (falls back to empty dict)."""
    return _db.get_store("url_db")

def _save_url_db(data: dict) -> None:
    """Persist the url_db store to DevDB."""
    _db.set_store("url_db", data)
    _db.save()

# In-memory cache for the URL shortener (populated at startup via _startup_devdb)
# This proxy ensures the rest of the shortener code has the dict in scope.
url_db: dict = {}

class ShortenRequest(BaseModel):
    url: str


@app.middleware("http")
async def add_security_headers(request, call_next):
    """
    Attach a standard set of HTTP security headers to every outgoing response.
    
    Designed for use as FastAPI HTTP middleware: invokes the downstream handler and augments the returned response with headers that mitigate clickjacking, MIME-type sniffing, some XSS vectors, enforce HSTS, and provide a restrictive Content Security Policy.
    
    Parameters:
        request: The incoming ASGI/Starlette request object.
        call_next: A callable that accepts the request and returns a response from the downstream route/handler.
    
    Returns:
        The downstream response with the security headers added.
    """
    response = await call_next(request)
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    # Prevent MIME-type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Basic XSS protection for older browsers
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Content Security Policy (allows local assets and CDN resources used in the app)
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; "
        "worker-src 'self' blob:; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self';"
    )
    response.headers["Content-Security-Policy"] = csp
    return response


def _serve_html(filename: str) -> str:
    """Read and return an HTML file from the static directory."""
    html_path = os.path.join(static_dir, filename)
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"{filename} not found.") from None


@app.get("/", response_class=HTMLResponse, summary="Serve DevSuite homepage")
def read_home():
    """Serve the DevSuite landing page."""
    return _serve_html("home.html")


@app.get("/diff", response_class=HTMLResponse, summary="Serve diff tool")
def read_diff():
    """Serve the Text/Folder Diff tool."""
    return _serve_html("index.html")


@app.get("/json", response_class=HTMLResponse, summary="Serve JSON linter tool")
def read_json_tool():
    """Serve the JSON Linter & Formatter tool."""
    return _serve_html("json.html")


@app.get("/yaml", response_class=HTMLResponse, summary="Serve YAML linter tool")
def read_yaml_tool():
    """Serve the YAML Linter & Validator tool."""
    return _serve_html("yaml.html")


@app.get("/regex", response_class=HTMLResponse, summary="Serve Regex Tester tool")
def read_regex_tool():
    """Serve the Regex Tester tool."""
    return _serve_html("regex.html")


@app.get("/base64", response_class=HTMLResponse, summary="Serve Base64 Encoder/Decoder tool")
def read_base64_tool():
    """Serve the Base64 Encoder/Decoder tool."""
    return _serve_html("base64.html")


@app.get("/crypto", response_class=HTMLResponse, summary="Serve Crypto Suite tool")
def read_crypto_tool():
    """Serve the Crypto Suite tool (Hash, AES, RSA, HMAC)."""
    return _serve_html("crypto.html")


@app.get("/url-shortener", response_class=HTMLResponse, summary="Serve URL Shortener tool")
def read_url_shortener_tool():
    """Serve the Link & QR Studio tool."""
    return _serve_html("url-shortener.html")


@app.get("/api-tester", response_class=HTMLResponse, summary="Serve Local API Tester tool")
def read_api_tester_tool():
    """Serve the API Tester tool."""
    return _serve_html("api-tester.html")


@app.get("/ssh", response_class=HTMLResponse, summary="Serve SSH & SFTP Manager tool")
def read_ssh_tool():
    """Serve the SSH & SFTP Manager tool."""
    return _serve_html("ssh-manager.html")


@app.get("/sftp", response_class=HTMLResponse, summary="Serve standalone SFTP Browser tool")
def read_sftp_tool():
    """Serve the standalone SFTP File Browser tool."""
    return _serve_html("sftp-browser.html")


@app.get("/cron", response_class=HTMLResponse, summary="Serve Cron Visualizer tool")
def read_cron_tool():
    """Serve the Cron Visualizer tool (Unix, Quartz, AWS EventBridge, GitHub Actions)."""
    return _serve_html("cron.html")


@app.get("/vault", response_class=HTMLResponse, summary="Serve Secret Vault tool")
def read_vault_tool():
    """Serve the Secret Vault tool (KeePass-style encrypted secrets manager)."""
    return _serve_html("vault.html")


@app.get("/db-manager", response_class=HTMLResponse, summary="Serve DevDB Manager tool")
def read_db_manager_tool():
    """Serve the DevDB Manager tool (unified encrypted database viewer and manager)."""
    return _serve_html("db-manager.html")


@app.get("/formatter", response_class=HTMLResponse, summary="Serve Code Formatter tool")
def read_formatter_tool():
    """Serve the Code Formatter tool (JS, TS, CSS, HTML, Markdown, GraphQL via Prettier)."""
    return _serve_html("formatter.html")


@app.get("/api/vault", summary="Get encrypted vault blob")
def get_vault():
    """Return the raw encrypted vault blob from the DevDB 'vault' store.
    Backward-compatible shim — the server never decrypts vault contents.
    """
    store = _db.get_store("vault")
    return store if store else {"encrypted_blob": ""}


@app.post("/api/vault", summary="Save encrypted vault blob")
def save_vault(data: dict):
    """Persist the encrypted vault blob into the DevDB 'vault' store.
    Backward-compatible shim — the server never decrypts vault contents.
    """
    try:
        _db.set_store("vault", data)
        _db.save()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/shorten", summary="Create a short URL")
def shorten_url(req: ShortenRequest, request: Request):
    """
    Create and store a 6-character short identifier for the provided URL and return the short link and original URL.
    
    The input URL is trimmed of surrounding whitespace; if it lacks an HTTP scheme, `https://` is prepended. A random 6-character alphanumeric `short_id` is generated, stored in the in-memory datastore, and used to build the redirectable short URL from `request.base_url`.
    
    Parameters:
        req (ShortenRequest): Request model containing the `url` to shorten.
        request (Request): FastAPI request used to derive the application's base URL.
    
    Returns:
        dict: {
            "short_id": str — the generated 6-character identifier,
            "short_url": str — the full short URL that redirects to the original,
            "original_url": str — the normalized original URL stored for this id
        }
    """
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")
        
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url
        
    parsed = urllib.parse.urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Invalid URL format")

    alphabet = string.ascii_letters + string.digits
    for _ in range(10):
        short_id = "".join(secrets.choice(alphabet) for _ in range(6))
        if short_id not in url_db:
            break
    else:
        raise HTTPException(status_code=500, detail="Failed to generate unique short ID")
    
    # Store in memory and persist to DevDB
    url_db[short_id] = url
    _save_url_db(url_db)
    
    # Return the full short URL
    base_url = str(request.base_url).rstrip("/")
    short_url = f"{base_url}/r/{short_id}"
    return {"short_id": short_id, "short_url": short_url, "original_url": url}


@app.get("/r/{short_id}", summary="Redirect to original URL")
def redirect_short_url(short_id: str):
    """
    Redirects a short identifier to the stored original URL.
    
    Returns:
        RedirectResponse: A 302 redirect response to the original URL.
    
    Raises:
        HTTPException: If the provided `short_id` does not exist (status code 404).
    """
    if short_id in url_db:
        return RedirectResponse(url=url_db[short_id], status_code=302)
    raise HTTPException(status_code=404, detail="Short URL not found.")


@app.post("/upload", summary="Upload a text file for diffing")
async def upload_file(file: UploadFile = File(...)):
    """
    Accepts an uploaded text file, validates it is not binary and within size limits, and returns its decoded text and metadata.
    
    Parameters:
        file (UploadFile): The uploaded file to inspect and decode.
    
    Returns:
        dict: A mapping with keys:
            - "filename": the original filename.
            - "content": the file decoded as a UTF-8 string (invalid bytes replaced).
            - "size_bytes": the raw byte length of the uploaded file.
    
    Raises:
        HTTPException: Raised with status code 400 if the Content-Type indicates a binary media type
            or if a null byte is detected in the initial chunk (file appears binary).
        HTTPException: Raised with status code 413 if the uploaded file exceeds 50MB.
        HTTPException: Raised with status code 500 for unexpected server-side errors while processing the file.
    """
    # Reject obviously binary MIME types immediately
    binary_mimes = ("image/", "video/", "audio/", "application/pdf",
                    "application/zip", "application/octet-stream")
    if file.content_type and any(file.content_type.startswith(b) for b in binary_mimes):
        raise HTTPException(
            status_code=400,
            detail=f"Only text-based files are supported. Received: {file.content_type}"
        )

    try:
        MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024
        chunk_size = 1024 * 1024
        raw_bytes = bytearray()
        null_byte_detected = False
        
        while chunk := await file.read(chunk_size):
            if not null_byte_detected and not raw_bytes and len(chunk) > 0:
                if b"\x00" in chunk[:512]:
                    null_byte_detected = True
            raw_bytes.extend(chunk)
            if len(raw_bytes) > MAX_UPLOAD_SIZE_BYTES:
                raise HTTPException(status_code=413, detail="File too large. Exceeds 50MB limit.")

        if null_byte_detected:
            raise HTTPException(
                status_code=400,
                detail=f'"{file.filename}" appears to be a binary file and cannot be diffed.'
            )

        content = raw_bytes.decode("utf-8", errors="replace")
        return {"filename": file.filename, "content": content, "size_bytes": len(raw_bytes)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Server error processing file") from e


@app.get("/api/collections", summary="Get API Tester Collections")
def get_collections():
    """Read saved collections from the DevDB 'collections' store.
    Backward-compatible shim for api-tester.js.
    """
    store = _db.get_store("collections")
    return store if store else {"items": []}

@app.post("/api/collections", summary="Save API Tester Collections")
def save_collections(data: dict):
    """Persist collections into the DevDB 'collections' store.
    Backward-compatible shim for api-tester.js.
    """
    try:
        _db.set_store("collections", data)
        _db.save()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


class ProxyRequest(BaseModel):
    url: str
    method: str = "GET"
    headers: dict = {}
    body: str | None = None

@app.post("/api/proxy", summary="Bypass CORS for API Tester")
async def proxy_request(req: ProxyRequest):
    """Provides a local CORS bypass proxy using urllib for the API tester tool."""
    try:
        # Parse and validate the URL scheme
        parsed = urllib.parse.urlparse(req.url)
        if parsed.scheme not in ('http', 'https'):
            raise HTTPException(status_code=400, detail="Only HTTP and HTTPS schemes are allowed")

        if not parsed.hostname:
            raise HTTPException(status_code=400, detail="Invalid URL: no hostname")

        # Enforce hostname allowlist to prevent full SSRF to arbitrary targets.
        if parsed.hostname not in ALLOWED_PROXY_HOSTS:
            raise HTTPException(status_code=400, detail="Target host is not allowed")

        # Resolve hostname and check for private/reserved IP addresses
        try:
            addr_info = socket.getaddrinfo(
                parsed.hostname,
                parsed.port or (443 if parsed.scheme == 'https' else 80),
                socket.AF_UNSPEC,
                socket.SOCK_STREAM,
            )
        except (socket.gaierror, socket.herror) as e:
            raise HTTPException(status_code=400, detail=f"DNS resolution failed: {e}")

        for family, socktype, proto, canonname, sockaddr in addr_info:
            ip_str = sockaddr[0]
            try:
                ip_obj = ipaddress.ip_address(ip_str)
                # Reject loopback, private, link-local, multicast, and reserved addresses
                if ip_obj.is_loopback or ip_obj.is_private or ip_obj.is_link_local or ip_obj.is_multicast or ip_obj.is_reserved:
                    raise HTTPException(status_code=403, detail=f"Access to private/reserved IP addresses is forbidden: {ip_str}")
                # Special check for cloud metadata endpoint
                if ip_str.startswith("169.254."):
                    raise HTTPException(status_code=403, detail="Access to cloud metadata endpoints is forbidden")
            except ValueError:
                # Not a valid IP address, skip
                pass

        req_body = req.body.encode('utf-8') if req.body else None

        headers_to_pass = {}
        for k, v in req.headers.items():
            if k.lower() not in ("host", "connection", "origin", "referer", "accept-encoding"):
                headers_to_pass[k] = v

        # Reconstruct the URL using the validated components to clear CodeQL dataflow taint.
        # We fetch the exact hostname from our allowlist rather than reusing the tainted string.
        safe_host = next(h for h in ALLOWED_PROXY_HOSTS if h == parsed.hostname)
        safe_netloc = f"{safe_host}:{parsed.port}" if parsed.port else safe_host

        safe_url = urllib.parse.urlunparse((
            parsed.scheme,
            safe_netloc,
            parsed.path,
            parsed.params,
            parsed.query,
            parsed.fragment
        ))

        request = urllib.request.Request(safe_url, data=req_body, headers=headers_to_pass, method=req.method.upper())
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                body = response.read().decode('utf-8', errors='replace')
                return {
                    "proxy_response": True,
                    "status": response.status,
                    "headers": dict(response.headers),
                    "body": body
                }
        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode('utf-8', errors='replace') if hasattr(e, 'read') else ""
            except Exception:
                body = ""
            return {
                "proxy_response": True,
                "status": e.code,
                "headers": dict(e.headers),
                "body": body
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/ssh/profiles", summary="Get SSH Profiles")
def get_ssh_profiles():
    """Return the encrypted SSH profiles blob from the DevDB 'ssh_profiles' store.
    Backward-compatible shim — server never decrypts profile contents.
    """
    store = _db.get_store("ssh_profiles")
    return store if store else {"encrypted_blob": ""}

@app.post("/api/ssh/profiles", summary="Save SSH Profiles")
def save_ssh_profiles(data: dict):
    """Persist the encrypted SSH profiles blob into the DevDB 'ssh_profiles' store.
    Backward-compatible shim — server never decrypts profile contents.
    """
    try:
        _db.set_store("ssh_profiles", data)
        _db.save()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ─── DevDB Unified API ────────────────────────────────────────────────────────
# These endpoints expose the DevDB engine directly for the DB Manager UI
# and any future tools that want to read/write named stores.

_ALLOWED_STORES = {"vault", "collections", "ssh_profiles", "url_db", "app_prefs"}

# Only allow printable, non-shell-special characters for WSL distro names.
_DISTRO_NAME_RE = re.compile(r'^[A-Za-z0-9_.\-]+$')

@app.get("/api/db/meta", summary="Get DevDB metadata")
def db_meta():
    """Return database metadata: path, file size, stores list, encryption status."""
    m = _db.meta()
    return {
        "path":      str(_DB_PATH),
        "size":      _db.file_size(),
        "encrypted": _db.is_encrypted(),
        "stores":    _db.store_sizes(),
        "meta":      m,
    }

@app.get("/api/db/store/{name}", summary="Read a named DevDB store")
def db_get_store(name: str):
    """Return the raw contents of the named store.  Restricted to known store names."""
    if name not in _ALLOWED_STORES:
        raise HTTPException(status_code=400, detail=f"Unknown store: {name!r}")
    return _db.get_store(name)

@app.post("/api/db/store/{name}", summary="Write a named DevDB store")
def db_set_store(name: str, data: dict):
    """Replace the named store with the supplied data and flush to disk."""
    if name not in _ALLOWED_STORES:
        raise HTTPException(status_code=400, detail=f"Unknown store: {name!r}")
    try:
        _db.set_store(name, data)
        _db.save()
        return {"status": "ok", "store": name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@app.get("/api/db/export", summary="Export full DevDB as a .dsb file")
def db_export():
    """Stream the raw .dsb binary as a file download."""
    try:
        raw = _db.export_bytes()
        return Response(
            content=raw,
            media_type="application/octet-stream",
            headers={"Content-Disposition": 'attachment; filename="devdb.dsb"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@app.post("/api/db/import", summary="Import a .dsb file into DevDB")
async def db_import(file: UploadFile = File(...)):
    """Accept a .dsb upload and merge its stores into the running DevDB."""
    MAX_IMPORT_SIZE = 50 * 1024 * 1024  # 50 MB
    try:
        raw = await file.read(MAX_IMPORT_SIZE + 1)
        if len(raw) > MAX_IMPORT_SIZE:
            raise HTTPException(status_code=413, detail="Import file too large (50 MB limit)")
        imported = DevDB.from_bytes(raw)  # parses & validates the binary format
        # Merge all stores from the imported file (skip unknown store names)
        for store_name in imported.list_stores():
            if store_name in _ALLOWED_STORES:
                _db.set_store(store_name, imported.get_store(store_name))
        _db.save()
        return {"status": "ok", "imported_stores": imported.list_stores()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

# ─── Auth — Master Password Management ──────────────────────────────────────
# Client-side password verification: server stores a challenge blob (AES-encrypted
# known plaintext).  The plaintext password never leaves the browser.

@app.get("/api/auth/status", summary="Check if master password is configured")
def auth_status():
    """Return whether the master encryption password has been set up."""
    prefs = _db.get_store("app_prefs") or {}
    return {"is_setup": bool(prefs.get("master_setup_done"))}


@app.get("/api/auth/challenge", summary="Get password verification challenge")
def auth_challenge():
    """Return the stored salt + encrypted-verify-blob for client-side password checking."""
    prefs = _db.get_store("app_prefs") or {}
    if not prefs.get("master_setup_done"):
        raise HTTPException(status_code=404, detail="Master password not configured")
    return {
        "salt":        prefs.get("master_salt", ""),
        "verify_blob": prefs.get("master_verify_blob", ""),
        "verify_iv":   prefs.get("master_verify_iv", ""),
    }


@app.post("/api/auth/setup", summary="Initialize master password (first-time setup)")
def auth_setup(data: dict):
    """One-time setup: store the PBKDF2 salt and AES verification blob in app_prefs.
    Called by vault.js after the user sets their master password for the first time.
    Expects: {salt, verify_blob, verify_iv}
    """
    prefs = _db.get_store("app_prefs") or {}
    if prefs.get("master_setup_done"):
        raise HTTPException(status_code=409, detail="Master password already configured")

    salt        = str(data.get("salt",        "")).strip()
    verify_blob = str(data.get("verify_blob", "")).strip()
    verify_iv   = str(data.get("verify_iv",   "")).strip()

    if not salt or not verify_blob or not verify_iv:
        raise HTTPException(status_code=400, detail="Missing required fields: salt, verify_blob, verify_iv")

    prefs.update({
        "master_setup_done":  True,
        "master_salt":        salt,
        "master_verify_blob": verify_blob,
        "master_verify_iv":   verify_iv,
    })
    _db.set_store("app_prefs", prefs)
    _db.save()
    return {"status": "ok"}


@app.post("/api/auth/update-challenge", summary="Update master password challenge after password change")
def auth_update_challenge(data: dict):
    """Replace the verification challenge when the master password is changed.
    Expects: {salt, verify_blob, verify_iv}
    """
    prefs = _db.get_store("app_prefs") or {}
    if not prefs.get("master_setup_done"):
        raise HTTPException(status_code=404, detail="Master password not yet configured")

    salt        = str(data.get("salt",        "")).strip()
    verify_blob = str(data.get("verify_blob", "")).strip()
    verify_iv   = str(data.get("verify_iv",   "")).strip()

    if not salt or not verify_blob or not verify_iv:
        raise HTTPException(status_code=400, detail="Missing required fields: salt, verify_blob, verify_iv")

    prefs.update({
        "master_salt":        salt,
        "master_verify_blob": verify_blob,
        "master_verify_iv":   verify_iv,
    })
    _db.set_store("app_prefs", prefs)
    _db.save()
    return {"status": "ok"}


@app.websocket("/api/ssh/terminal")
async def ssh_terminal(websocket: WebSocket):
    # Validate Origin header — reject missing AND disallowed origins
    origin = websocket.headers.get("origin", "")
    allowed_origins = ["http://localhost:8000", "http://127.0.0.1:8000"]
    if not origin:
        await websocket.close(code=1008, reason="Origin header required")
        return
    if origin not in allowed_origins:
        await websocket.close(code=1008, reason="Origin not allowed")
        return

    await websocket.accept()
    try:
        data = await websocket.receive_text()
        config = json.loads(data)
        host = config.get("host")
        port = int(config.get("port", 22))
        username = config.get("username")
        password = config.get("password")
        private_key = config.get("private_key")
        
        # Load system known_hosts for host key verification
        known_hosts_paths = [
            os.path.expanduser("~/.ssh/known_hosts"),
            "/etc/ssh/ssh_known_hosts"
        ]
        known_hosts_path = None
        for path in known_hosts_paths:
            if os.path.exists(path):
                known_hosts_path = path
                break

        # Fail-closed: never silently disable host-key verification
        if known_hosts_path is None:
            raise ValueError(
                "No known_hosts file found. Add the server's host key to "
                "~/.ssh/known_hosts before connecting."
            )

        connect_kwargs = {
            "host": host,
            "port": port,
            "username": username,
            "known_hosts": known_hosts_path
        }
        if password:
            connect_kwargs["password"] = password
        if private_key:
            connect_kwargs["client_keys"] = [asyncssh.import_private_key(private_key)]
            
        async with asyncssh.connect(**connect_kwargs) as conn:
            # We must use create_process with a PTY to get interactive shell
            async with conn.create_process(term_type='xterm-256color') as process:
                
                async def read_from_ssh():
                    try:
                        while True:
                            data = await process.stdout.read(4096)
                            if not data:
                                break
                            # asyncssh reads string by default, we send text
                            await websocket.send_text(str(data))
                    except Exception:
                        logger.debug("read_from_ssh: stream ended or error", exc_info=True)
                
                async def write_to_ssh():
                    try:
                        while True:
                            data = await websocket.receive_text()
                            if data.startswith("\x1b[resize;"):
                                parts = data.split(";")
                                if len(parts) == 3:
                                    try:
                                        cols, rows = int(parts[1]), int(parts[2].strip("m"))
                                        process.change_terminal_size(cols, rows, 0, 0)
                                    except Exception:
                                        pass
                                continue
                            process.stdin.write(data)
                    except WebSocketDisconnect:
                        process.terminate()
                    except Exception:
                        logger.debug("write_to_ssh: error writing to SSH process", exc_info=True)
                
                await asyncio.gather(read_from_ssh(), write_to_ssh())
    except Exception as e:
        try:
            await websocket.send_text(f"\r\nError: {e}\r\n")
            await websocket.close()
        except Exception:
            logger.debug("ssh_terminal: failed to send error message to client", exc_info=True)

class SFTPRequest(BaseModel):
    host: str
    port: int = 22
    username: str
    password: str | None = None
    private_key: str | None = None
    path: str = "."

@app.post("/api/sftp/list", summary="List files via SFTP")
async def sftp_list(req: SFTPRequest):
    try:
        # Load system known_hosts for host key verification
        known_hosts_paths = [
            os.path.expanduser("~/.ssh/known_hosts"),
            "/etc/ssh/ssh_known_hosts"
        ]
        known_hosts_path = None
        for path in known_hosts_paths:
            if os.path.exists(path):
                known_hosts_path = path
                break

        # Fail-closed: never silently disable host-key verification
        if known_hosts_path is None:
            raise HTTPException(
                status_code=412,
                detail="No known_hosts file found. Add the server's host key to "
                       "~/.ssh/known_hosts before connecting."
            )

        connect_kwargs = {
            "host": req.host,
            "port": req.port,
            "username": req.username,
            "known_hosts": known_hosts_path
        }
        if req.password:
            connect_kwargs["password"] = req.password
        if req.private_key:
            connect_kwargs["client_keys"] = [asyncssh.import_private_key(req.private_key)]
            
        async with asyncssh.connect(**connect_kwargs) as conn:
            sftp = await conn.start_sftp_client()
            async with sftp:
                files = await sftp.readdir(req.path)
                result = []
                for f in files:
                    if f.filename in ('.', '..'): continue
                    attrs = f.attrs
                    is_dir = stat.S_ISDIR(attrs.permissions) if attrs.permissions else False
                    result.append({
                        "name": f.filename,
                        "is_dir": is_dir,
                        "size": attrs.size,
                    })
                result.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))
                return {"files": result, "cwd": req.path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@app.get("/api/wsl/discover", summary="Discover local WSL instances")
async def wsl_discover():
    try:
        out = subprocess.check_output(["wsl.exe", "-l", "-q"], stderr=subprocess.STDOUT)
        text = out.decode("utf-16le") if b"\x00" in out else out.decode("utf-8", errors="replace")
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return {"wsl_instances": lines}
    except Exception as e:
        return {"wsl_instances": []}


# Module-level set to hold references to fire-and-forget tasks so they
# are not garbage-collected before completion.
_pending_tasks: set = set()

def _tracked_task(coro):
    """Schedule a coroutine as an asyncio task, retaining a reference until done."""
    task = asyncio.create_task(coro)
    _pending_tasks.add(task)
    task.add_done_callback(_pending_tasks.discard)
    return task

@app.websocket("/api/local/terminal")
async def local_terminal(websocket: WebSocket):
    # Validate Origin header — reject missing AND disallowed origins
    origin = websocket.headers.get("origin", "")
    allowed_origins = ["http://localhost:8000", "http://127.0.0.1:8000"]
    if not origin:
        await websocket.close(code=1008, reason="Origin header required")
        return
    if origin not in allowed_origins:
        await websocket.close(code=1008, reason="Origin not allowed")
        return

    if not _PTY_AVAILABLE:
        await websocket.close(code=1008, reason="Local terminal is not supported on this platform")
        return

    await websocket.accept()

    config_raw = await websocket.receive_text()
    try:
        config = json.loads(config_raw)
        distro = config.get("distro")
        # Reject distro names containing shell metacharacters or path separators.
        if distro and not _DISTRO_NAME_RE.match(distro):
            logger.warning("local_terminal: rejected invalid distro name %r", distro)
            distro = None
    except Exception:
        logger.debug("local_terminal: failed to parse config JSON, proceeding with distro=None")
        distro = None
        
    pid, fd = pty.fork()
    if pid == 0:
        current_distro = os.environ.get("WSL_DISTRO_NAME", "")
        if distro and distro != current_distro:
            # Note: wsl.exe across PTY interop might hang in certain builds, 
            # but we allow it for cross-distro attempts.
            os.execvp("wsl.exe", ["wsl.exe", "-d", distro])
        else:
            shell = os.environ.get("SHELL", "/bin/bash")
            os.execvp(shell, [shell])

    loop = asyncio.get_running_loop()
    
    def on_pty_read():
        try:
            data = os.read(fd, 8192)
            if data:
                _tracked_task(websocket.send_text(data.decode("utf-8", errors="replace")))
            else:
                loop.remove_reader(fd)
                _tracked_task(websocket.close())
        except OSError:
            loop.remove_reader(fd)
            _tracked_task(websocket.close())

    loop.add_reader(fd, on_pty_read)
    
    resize_pattern = re.compile(r"^\x1b\[resize;(\d+);(\d+)m$")

    try:
        while True:
            data = await websocket.receive_text()
            match = resize_pattern.match(data)
            if match:
                cols = int(match.group(1))
                rows = int(match.group(2))
                winsize = struct.pack("HHHH", rows, cols, 0, 0)
                fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
            else:
                os.write(fd, data.encode("utf-8"))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("local_terminal: unexpected error: %s", e)
    finally:
        try:
            loop.remove_reader(fd)
            os.close(fd)
        except Exception:
            logger.debug("local_terminal: error during cleanup", exc_info=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)