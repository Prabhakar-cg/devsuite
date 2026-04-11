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
import time
import urllib.parse
import urllib.request
import urllib.error
import socket
import ipaddress
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, WebSocket, WebSocketDisconnect
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

_db = DevDB(_DB_PATH, password=os.environ.get("DEVDB_PASSWORD") or None)


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

# Maximum size for file uploads to /api/convert (20 MB)
MAX_UPLOAD_SIZE = 20 * 1024 * 1024

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


@app.get("/tools", response_class=HTMLResponse, summary="Serve DevSuite tools page")
def read_tools():
    """Serve the DevSuite tools dashboard (all tools grid)."""
    return _serve_html("tools.html")


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


@app.get("/file-converter", response_class=HTMLResponse, summary="Serve File Format Converter tool")
def read_file_converter_tool():
    """Serve the File Format Converter tool (JSON, CSV, YAML, XML, XLSX, Markdown, Images, PDF, DOCX)."""
    return _serve_html("file-converter.html")


@app.post("/api/convert", summary="Convert a file from one format to another (server-side)")
async def convert_file(request: Request, file: UploadFile = File(...), target_format: str = Form(...)):
    """
    Server-side file format conversion endpoint.

    Handles conversions that require Python libraries:
    - XLSX ↔ CSV / JSON
    - PDF → TXT
    - DOCX / DOC → PDF (requires LibreOffice)
    - Markdown → PDF (requires LibreOffice or weasyprint)
    - HTML → PDF (requires LibreOffice)
    """
    import tempfile, io

    target_format = target_format.lower().strip()
    original_name = (file.filename or "file").lower()
    src_ext = original_name.rsplit(".", 1)[-1] if "." in original_name else ""

    cl = request.headers.get("content-length")
    if cl:
        try:
            cl_int = int(cl)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Content-Length header")
        if cl_int < 0:
            raise HTTPException(status_code=400, detail="Invalid Content-Length header")
        if cl_int > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail=f"Upload too large (limit {MAX_UPLOAD_SIZE // 1024 // 1024} MB)")
    content = await file.read(MAX_UPLOAD_SIZE + 1)
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail=f"Upload too large (limit {MAX_UPLOAD_SIZE // 1024 // 1024} MB)")

    # ── XLSX → CSV / JSON ──────────────────────────────────────────────────
    if src_ext == "xlsx" and target_format in ("csv", "json"):
        try:
            import openpyxl
        except ImportError as e:
            raise HTTPException(status_code=503, detail="openpyxl is not installed. Run: pip install openpyxl") from e
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            raise HTTPException(status_code=400, detail="Spreadsheet is empty")
        headers = [str(h) if h is not None else "" for h in rows[0]]
        data = [dict(zip(headers, [str(v) if v is not None else "" for v in row])) for row in rows[1:]]

        if target_format == "csv":
            import csv as csv_mod
            buf = io.StringIO()
            writer = csv_mod.DictWriter(buf, fieldnames=headers)
            writer.writeheader()
            writer.writerows(data)
            return Response(content=buf.getvalue(), media_type="text/csv",
                            headers={"Content-Disposition": 'attachment; filename="converted.csv"'})
        else:
            return Response(content=json.dumps(data, indent=2), media_type="application/json",
                            headers={"Content-Disposition": 'attachment; filename="converted.json"'})

    # ── CSV → XLSX ─────────────────────────────────────────────────────────
    if src_ext == "csv" and target_format == "xlsx":
        try:
            import openpyxl
        except ImportError as e:
            raise HTTPException(status_code=503, detail="openpyxl is not installed. Run: pip install openpyxl") from e
        import csv as csv_mod
        text = content.decode("utf-8-sig", errors="replace")
        reader = csv_mod.reader(io.StringIO(text))
        rows = list(reader)
        wb = openpyxl.Workbook()
        ws = wb.active
        for row in rows:
            ws.append(row)
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return Response(content=buf.read(),
                        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        headers={"Content-Disposition": 'attachment; filename="converted.xlsx"'})

    # ── JSON → XLSX ────────────────────────────────────────────────────────
    if src_ext == "json" and target_format == "xlsx":
        try:
            import openpyxl
        except ImportError as e:
            raise HTTPException(status_code=503, detail="openpyxl is not installed. Run: pip install openpyxl") from e
        data = json.loads(content)
        if not isinstance(data, list):
            data = [data]
        wb = openpyxl.Workbook()
        ws = wb.active
        if data:
            headers = list(data[0].keys())
            ws.append(headers)
            for row in data:
                ws.append([str(row.get(h, "")) for h in headers])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return Response(content=buf.read(),
                        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        headers={"Content-Disposition": 'attachment; filename="converted.xlsx"'})

    # ── PDF → TXT ──────────────────────────────────────────────────────────
    if src_ext == "pdf" and target_format == "txt":
        try:
            import pypdf
        except ImportError as e:
            raise HTTPException(status_code=503, detail="pypdf is not installed. Run: pip install pypdf") from e
        reader = pypdf.PdfReader(io.BytesIO(content))
        pages_text = [page.extract_text() or "" for page in reader.pages]
        full_text = "\n\n".join(pages_text)
        return Response(content=full_text, media_type="text/plain",
                        headers={"Content-Disposition": 'attachment; filename="converted.txt"'})

    # ── DOCX → TXT ────────────────────────────────────────────────────────
    if src_ext == "docx" and target_format == "txt":
        try:
            import docx
        except ImportError as e:
            raise HTTPException(status_code=503, detail="python-docx is not installed. Run: pip install python-docx") from e
        doc = docx.Document(io.BytesIO(content))
        text = "\n".join(para.text for para in doc.paragraphs)
        return Response(content=text, media_type="text/plain",
                        headers={"Content-Disposition": 'attachment; filename="converted.txt"'})

    # ── Pure-Python PDF conversions: DOCX/DOC/HTML/MD → PDF ──────────────
    if target_format == "pdf" and src_ext in ("docx", "doc", "html", "htm", "md", "markdown"):
        try:
            import weasyprint
        except ImportError as e:
            raise HTTPException(status_code=503, detail="weasyprint is not installed. Run: pip install weasyprint") from e

        # Step 1: Get HTML content
        if src_ext in ("docx", "doc"):
            try:
                import mammoth
            except ImportError as e:
                raise HTTPException(status_code=503, detail="mammoth is not installed. Run: pip install mammoth") from e
            result = mammoth.convert_to_html(io.BytesIO(content))
            raw_html = result.value
        elif src_ext in ("md", "markdown"):
            import html as _html_mod
            try:
                import markdown as md_lib
                raw_html = md_lib.markdown(content.decode("utf-8", errors="replace"), extensions=["tables", "fenced_code"])
            except ImportError:
                # Fallback: wrap text in <pre>
                raw_html = "<pre>" + _html_mod.escape(content.decode("utf-8", errors="replace")) + "</pre>"
        else:  # html / htm
            raw_html = content.decode("utf-8", errors="replace")

        # Step 2: Wrap in a full HTML document with print-friendly CSS
        full_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body {{ font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.6;
          margin: 2cm; color: #111; }}
  h1,h2,h3,h4,h5,h6 {{ font-family: Arial, Helvetica, sans-serif; margin-top: 1.2em; }}
  h1 {{ font-size: 22pt; }} h2 {{ font-size: 17pt; }} h3 {{ font-size: 14pt; }}
  p {{ margin: 0.5em 0 0.8em; }}
  table {{ border-collapse: collapse; width: 100%; margin: 1em 0; }}
  th, td {{ border: 1px solid #ccc; padding: 6px 10px; text-align: left; }}
  th {{ background: #f0f0f0; font-weight: bold; }}
  pre, code {{ font-family: 'Courier New', monospace; font-size: 10pt;
               background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px; }}
  pre {{ padding: 0.8em; white-space: pre-wrap; word-break: break-word; }}
  img {{ max-width: 100%; height: auto; }}
  a {{ color: #1a56db; }}
  @page {{ margin: 2cm; }}
</style>
</head>
<body>{raw_html}</body>
</html>"""

        # Step 3: Render to PDF with a safe URL fetcher to prevent SSRF/LFI
        try:
            from weasyprint import default_url_fetcher as _default_url_fetcher
        except ImportError:
            _default_url_fetcher = None

        def _safe_url_fetcher(url: str):
            parsed = urllib.parse.urlparse(url)
            if parsed.scheme not in ('', 'data'):
                raise ValueError(
                    f"Blocked disallowed URL scheme '{parsed.scheme}' in PDF conversion: {url!r}"
                )
            if _default_url_fetcher is not None:
                return _default_url_fetcher(url)
            raise ValueError(f"No URL fetcher available for: {url!r}")

        pdf_bytes = weasyprint.HTML(string=full_html, url_fetcher=_safe_url_fetcher).write_pdf()

        return Response(content=pdf_bytes, media_type="application/pdf",
                        headers={"Content-Disposition": 'attachment; filename="converted.pdf"'})

    raise HTTPException(
        status_code=400,
        detail=f"Unsupported server-side conversion: {src_ext} → {target_format}"
    )


@app.get("/api/vault", summary="Get encrypted vault blob")
def get_vault(request: Request):
    """Return the raw encrypted vault blob from the DevDB 'vault' store.
    Backward-compatible shim — the server never decrypts vault contents.
    """
    require_unlocked(request)
    store = _db.get_store("vault")
    return store if store else {"encrypted_blob": ""}


@app.post("/api/vault", summary="Save encrypted vault blob")
def save_vault(data: dict, request: Request):
    """Persist the encrypted vault blob into the DevDB 'vault' store.
    Backward-compatible shim — the server never decrypts vault contents.
    """
    require_unlocked(request)
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
def get_ssh_profiles(request: Request):
    """Return the encrypted SSH profiles blob from the DevDB 'ssh_profiles' store.
    Backward-compatible shim — server never decrypts profile contents.
    """
    require_unlocked(request)
    store = _db.get_store("ssh_profiles")
    return store if store else {"encrypted_blob": ""}

@app.post("/api/ssh/profiles", summary="Save SSH Profiles")
def save_ssh_profiles(data: dict, request: Request):
    """Persist the encrypted SSH profiles blob into the DevDB 'ssh_profiles' store.
    Backward-compatible shim — server never decrypts profile contents.
    """
    require_unlocked(request)
    try:
        _db.set_store("ssh_profiles", data)
        _db.save()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ─── Server-side session store ───────────────────────────────────────────────
# Tokens are issued by /api/auth/session after the client verifies the
# master key, and are required by all DevDB endpoints.
_sessions: dict[str, float] = {}   # token → unix expiry
_SESSION_TTL = 8 * 3600            # 8 hours (matches auth-guard.js SESSION_MS)


def require_unlocked(request: Request) -> None:
    """Raise 401 if the request does not carry a valid server-side session token."""
    token = request.headers.get("X-Session-Token", "").strip()
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Session token required. Call POST /api/auth/session first.",
        )
    expiry = _sessions.get(token)
    if expiry is None or time.time() > expiry:
        _sessions.pop(token, None)
        raise HTTPException(status_code=401, detail="Session expired or invalid.")


# ─── DevDB Unified API ────────────────────────────────────────────────────────
# These endpoints expose the DevDB engine directly for the DB Manager UI
# and any future tools that want to read/write named stores.

_ALLOWED_STORES = {"vault", "collections", "ssh_profiles", "url_db", "app_prefs"}

# Only allow printable, non-shell-special characters for WSL distro names.
_DISTRO_NAME_RE = re.compile(r'^[A-Za-z0-9_.\-]+$')

@app.get("/api/db/meta", summary="Get DevDB metadata")
def db_meta(request: Request):
    """Return database metadata: path, file size, stores list, encryption status."""
    require_unlocked(request)
    m = _db.meta()
    return {
        "path":      str(_DB_PATH),
        "size":      _db.file_size(),
        "encrypted": _db.is_encrypted(),
        "stores":    _db.store_sizes(),
        "meta":      m,
    }

@app.get("/api/db/store/{name}", summary="Read a named DevDB store")
def db_get_store(name: str, request: Request):
    """Return the raw contents of the named store.  Restricted to known store names."""
    require_unlocked(request)
    if name not in _ALLOWED_STORES:
        raise HTTPException(status_code=400, detail=f"Unknown store: {name!r}")
    return _db.get_store(name)

@app.post("/api/db/store/{name}", summary="Write a named DevDB store")
def db_set_store(name: str, data: dict, request: Request):
    """Replace the named store with the supplied data and flush to disk."""
    global url_db
    require_unlocked(request)
    if name not in _ALLOWED_STORES:
        raise HTTPException(status_code=400, detail=f"Unknown store: {name!r}")
    try:
        _db.set_store(name, data)
        _db.save()
        if name == "url_db":
            url_db.clear()
            url_db.update(_db.get_store("url_db") or {})
        return {"status": "ok", "store": name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@app.get("/api/db/export", summary="Export full DevDB as a .dsb file")
def db_export(request: Request):
    """Stream the raw .dsb binary as a file download."""
    require_unlocked(request)
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
async def db_import(request: Request, file: UploadFile = File(...)):
    """Accept a .dsb upload and merge its stores into the running DevDB."""
    require_unlocked(request)
    MAX_IMPORT_SIZE = 50 * 1024 * 1024  # 50 MB
    try:
        raw = await file.read(MAX_IMPORT_SIZE + 1)
        if len(raw) > MAX_IMPORT_SIZE:
            raise HTTPException(status_code=413, detail="Import file too large (50 MB limit)")
        imported = DevDB.from_bytes(raw)  # parses & validates the binary format
        # Merge all stores from the imported file (skip unknown store names)
        url_db_updated = False
        for store_name in imported.list_stores():
            if store_name in _ALLOWED_STORES:
                _db.set_store(store_name, imported.get_store(store_name))
                if store_name == "url_db":
                    url_db_updated = True
        _db.save()
        if url_db_updated:
            global url_db
            url_db.clear()
            url_db.update(_db.get_store("url_db") or {})
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
    vault = _db.get_store("vault") or {}
    return {
        "is_setup":       bool(prefs.get("master_setup_done")),
        "vault_has_data": bool(vault.get("salt")),
    }


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
def auth_update_challenge(data: dict, request: Request):
    """Replace the verification challenge when the master password is changed.
    Expects: {salt, verify_blob, verify_iv}
    """
    require_unlocked(request)
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
    # Revoke all existing session tokens so old sessions cannot continue
    # after a master password rotation.
    _sessions.clear()
    return {"status": "ok"}


@app.post("/api/auth/session", summary="Exchange verified master key for a server-side session token")
def auth_session(data: dict):
    """Verify the PBKDF2-derived key (hex) against the stored challenge and issue a session token.

    The client sends {key_hex: <hex>} where key_hex is the AES key derived from
    the master password using PBKDF2-SHA1(50 000 iter, 32-byte output).  The server
    decrypts the stored verify_blob to confirm key correctness without ever seeing
    the plaintext password.  On success a session token valid for 8 hours is returned.
    """
    prefs = _db.get_store("app_prefs") or {}
    if not prefs.get("master_setup_done"):
        raise HTTPException(status_code=404, detail="Master password not configured")

    key_hex = str(data.get("key_hex", "")).strip()
    if not key_hex:
        raise HTTPException(status_code=400, detail="Missing key_hex")

    try:
        import base64 as _b64
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
        from cryptography.hazmat.backends import default_backend

        key        = bytes.fromhex(key_hex)
        verify_iv  = bytes.fromhex(prefs["master_verify_iv"])
        ciphertext = _b64.b64decode(prefs["master_verify_blob"])

        cipher = Cipher(algorithms.AES(key), modes.CBC(verify_iv), backend=default_backend())
        decryptor = cipher.decryptor()
        padded = decryptor.update(ciphertext) + decryptor.finalize()
        # Remove PKCS7 padding
        pad_len = padded[-1]
        if pad_len < 1 or pad_len > 16:
            raise ValueError("Invalid PKCS7 padding")
        plaintext = padded[:-pad_len].decode("utf-8", errors="strict")

        if plaintext != "DEVSUITE_MASTER_OK":
            raise HTTPException(status_code=401, detail="Invalid master key")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Key verification failed")

    token = secrets.token_urlsafe(32)
    _sessions[token] = time.time() + _SESSION_TTL
    return {"session_token": token, "expires_in": _SESSION_TTL}


async def _ensure_host_key(
    host: str,
    port: int,
    approve_host=None,
) -> str:
    """
    Ensures ~/.ssh/known_hosts exists and contains an entry for host:port.

    For a previously unseen host the function:
      1. Runs ssh-keyscan to fetch the server's public key.
      2. Computes its SHA-256 fingerprint via ``ssh-keygen -l -f -``.
      3. Calls ``await approve_host(host, port, fingerprint, key_line)`` if
         provided.  The callback must return True to accept the key.
      4. Appends the key to known_hosts only when approved.

    If *approve_host* is None the function raises HostKeyApprovalRequired so
    callers that do not supply a callback can convert it to an appropriate
    HTTP/WS response.

    Changed host keys are still rejected by asyncssh after this function
    returns the known_hosts path — that protection layer is unchanged.

    Returns the path to the known_hosts file.
    """
    known_hosts_path = os.path.expanduser("~/.ssh/known_hosts")
    ssh_dir = os.path.dirname(known_hosts_path)

    # Create ~/.ssh (mode 700) and known_hosts (mode 600) if absent
    os.makedirs(ssh_dir, mode=0o700, exist_ok=True)
    if not os.path.exists(known_hosts_path):
        with open(known_hosts_path, "w"):
            pass
        os.chmod(known_hosts_path, 0o600)

    # ssh-keygen -F checks whether host:port already has an entry
    lookup = f"[{host}]:{port}" if port != 22 else host
    check = await asyncio.create_subprocess_exec(
        "ssh-keygen", "-F", lookup, "-f", known_hosts_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    await check.wait()

    if check.returncode == 0:
        # Host already pinned — nothing to do
        return known_hosts_path

    # Host not yet known — fetch its public key
    proc = await asyncio.create_subprocess_exec(
        "ssh-keyscan", "-p", str(port), "-H", host,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
    except asyncio.TimeoutError:
        raise RuntimeError(f"ssh-keyscan timed out for {host}:{port}")

    if proc.returncode != 0 or not stdout.strip():
        raise RuntimeError(
            f"Could not retrieve host key for {host}:{port}. "
            "Is the host reachable?"
        )

    # Compute the SHA-256 fingerprint using ssh-keygen -l
    keygen = await asyncio.create_subprocess_exec(
        "ssh-keygen", "-l", "-f", "-",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        kg_out, _ = await asyncio.wait_for(keygen.communicate(input=stdout), timeout=10)
    except asyncio.TimeoutError:
        raise RuntimeError(f"ssh-keygen fingerprint timed out for {host}:{port}")

    # ssh-keygen -l output: "2048 SHA256:xxxx user@host (RSA)"
    # extract the "SHA256:xxxx" token
    fingerprint = ""
    for token in kg_out.decode(errors="replace").split():
        if token.startswith("SHA256:") or token.startswith("MD5:"):
            fingerprint = token
            break

    if approve_host is None:
        # No callback supplied — callers must handle HostKeyApprovalRequired
        raise HostKeyApprovalRequired(host, port, fingerprint)

    approved = await approve_host(host, port, fingerprint, stdout)
    if not approved:
        raise RuntimeError(
            f"Host key for {host}:{port} (fingerprint {fingerprint}) was rejected by the user."
        )

    with open(known_hosts_path, "ab") as fh:
        fh.write(stdout)

    return known_hosts_path


class HostKeyApprovalRequired(Exception):
    """Raised by _ensure_host_key when no approve_host callback is provided."""
    def __init__(self, host: str, port: int, fingerprint: str):
        super().__init__(f"Host key approval required for {host}:{port}")
        self.host = host
        self.port = port
        self.fingerprint = fingerprint


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
        
        # Ensure known_hosts exists and has an entry for this host.
        # For new hosts the fingerprint is sent to the browser for user approval.
        await websocket.send_text(f"Verifying host key for {host}:{port}...\r\n")

        async def _ws_approve_host(h: str, p: int, fingerprint: str, _key_line: bytes) -> bool:
            """Send a JSON approval request over the WebSocket and wait for the browser reply.

            This is called before asyncssh.connect(), so write_to_ssh is not yet
            running.  We receive the reply directly here with a 60-second timeout.
            """
            await websocket.send_json({
                "type": "host_key_approval",
                "host": h,
                "port": p,
                "fingerprint": fingerprint,
            })
            deadline = asyncio.get_event_loop().time() + 60
            while True:
                remaining = deadline - asyncio.get_event_loop().time()
                if remaining <= 0:
                    return False
                try:
                    raw = await asyncio.wait_for(websocket.receive_text(), timeout=remaining)
                except asyncio.TimeoutError:
                    return False
                try:
                    msg = json.loads(raw)
                    if msg.get("type") == "host_key_response":
                        return bool(msg.get("approve", False))
                except Exception as exc:
                    logger.debug("Ignored non-JSON message while waiting for host_key_response: %r — %s", raw, exc)

        try:
            known_hosts_path = await _ensure_host_key(host, port, approve_host=_ws_approve_host)
        except RuntimeError as exc:
            await websocket.send_text(f"\r\nHost key error: {exc}\r\n")
            await websocket.close()
            return

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
    approved_fingerprint: str | None = None

@app.post("/api/sftp/list", summary="List files via SFTP")
async def sftp_list(req: SFTPRequest):
    try:
        async def _sftp_approve(h: str, p: int, fingerprint: str, _key: bytes) -> bool:
            if req.approved_fingerprint and req.approved_fingerprint == fingerprint:
                return True
            raise HTTPException(
                status_code=409,
                detail={"error": "host_key_approval_required", "host": h, "port": p, "fingerprint": fingerprint},
            )

        known_hosts_path = await _ensure_host_key(req.host, req.port, approve_host=_sftp_approve)

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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

class SFTPDownloadRequest(BaseModel):
    host: str
    port: int = 22
    username: str
    password: str | None = None
    private_key: str | None = None
    path: str  # full remote file path
    approved_fingerprint: str | None = None

@app.post("/api/sftp/download", summary="Download a file via SFTP")
async def sftp_download(req: SFTPDownloadRequest):
    try:
        async def _sftp_approve(h: str, p: int, fingerprint: str, _key: bytes) -> bool:
            if req.approved_fingerprint and req.approved_fingerprint == fingerprint:
                return True
            raise HTTPException(
                status_code=409,
                detail={"error": "host_key_approval_required", "host": h, "port": p, "fingerprint": fingerprint},
            )

        known_hosts_path = await _ensure_host_key(req.host, req.port, approve_host=_sftp_approve)
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

        CHUNK_SIZE = 65536  # 64 KB

        async def _stream_file():
            async with asyncssh.connect(**connect_kwargs) as conn:
                async with conn.start_sftp_client() as sftp:
                    async with sftp.open(req.path, 'rb') as remote_file:
                        while True:
                            chunk = await remote_file.read(CHUNK_SIZE)
                            if not chunk:
                                break
                            yield chunk

        filename = req.path.rstrip('/').split('/')[-1]
        from starlette.responses import StreamingResponse
        return StreamingResponse(
            _stream_file(),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@app.post("/api/sftp/upload", summary="Upload a file via SFTP")
async def sftp_upload(
    host: str = Form(...),
    port: int = Form(22),
    username: str = Form(...),
    password: str | None = Form(None),
    private_key: str | None = Form(None),
    remote_path: str = Form(...),
    file: UploadFile = File(...),
    approved_fingerprint: str | None = Form(None),
):
    try:
        async def _sftp_approve(h: str, p: int, fingerprint: str, _key: bytes) -> bool:
            if approved_fingerprint and approved_fingerprint == fingerprint:
                return True
            raise HTTPException(
                status_code=409,
                detail={"error": "host_key_approval_required", "host": h, "port": p, "fingerprint": fingerprint},
            )

        known_hosts_path = await _ensure_host_key(host, port, approve_host=_sftp_approve)
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

        file_content = await file.read()
        remote_file_path = remote_path.rstrip('/') + '/' + file.filename

        async with asyncssh.connect(**connect_kwargs) as conn:
            async with conn.start_sftp_client() as sftp:
                async with sftp.open(remote_file_path, 'wb') as remote_file:
                    await remote_file.write(file_content)

        return {"success": True, "path": remote_file_path}
    except HTTPException:
        raise
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