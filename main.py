"""
DevSuite — FastAPI Backend
---------------------------------
Serves the static frontend and provides a file upload endpoint.
Priority: All file reading happens client-side in JavaScript (FileReader API)
for maximum privacy. The /upload endpoint is a fallback for edge cases.
"""

import os
import string
import secrets
import json
import urllib.parse
import urllib.request
import urllib.error
import socket
import ipaddress
from fastapi import FastAPI, UploadFile, File, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, RedirectResponse
import asyncio
import asyncssh
import stat
import pty
import fcntl
import struct
import termios
import subprocess
import re
from pydantic import BaseModel

app = FastAPI(
    title="DevSuite",
    description="A private, locally-hosted diff checker with Monaco Editor.",
    version="2.0.0"
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

# URL Shortener Database
DB_FILE = os.path.join(os.path.dirname(__file__), "url_db.json")

def load_db():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass
    return {}

def save_db(db):
    try:
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(db, f)
    except Exception:
        pass

url_db = load_db()

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
    # Strict Transport Security (HSTS)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
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


@app.get("/", response_class=HTMLResponse, summary="Serve DevSuite homepage")
def read_home():
    """Serve the DevSuite landing page."""
    html_path = os.path.join(static_dir, "home.html")
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="home.html not found.") from None


@app.get("/diff", response_class=HTMLResponse, summary="Serve diff tool")
def read_diff():
    """Serve the Text/Folder Diff tool."""
    html_path = os.path.join(static_dir, "index.html")
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="index.html not found.") from None


@app.get("/json", response_class=HTMLResponse, summary="Serve JSON linter tool")
def read_json_tool():
    """Serve the JSON Linter & Formatter tool."""
    html_path = os.path.join(static_dir, "json.html")
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="json.html not found.") from None


@app.get("/yaml", response_class=HTMLResponse, summary="Serve YAML linter tool")
def read_yaml_tool():
    """Serve the YAML Linter & Validator tool."""
    html_path = os.path.join(static_dir, "yaml.html")
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="yaml.html not found.") from None


@app.get("/regex", response_class=HTMLResponse, summary="Serve Regex Tester tool")
def read_regex_tool():
    """Serve the Regex Tester tool."""
    html_path = os.path.join(static_dir, "regex.html")
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="regex.html not found.") from None


@app.get("/base64", response_class=HTMLResponse, summary="Serve Base64 Encoder/Decoder tool")
def read_base64_tool():
    """
    Provide the HTML for the Base64 encoder/decoder tool page.
    
    Returns:
        html (str): Contents of the `base64.html` file.
    
    Raises:
        HTTPException: with status_code=404 if `base64.html` is not found.
    """
    html_path = os.path.join(static_dir, "base64.html")
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="base64.html not found.") from None


@app.get("/crypto", response_class=HTMLResponse, summary="Serve Crypto Suite tool")
def read_crypto_tool():
    """Serve the Crypto Suite tool (Hash, AES, RSA, HMAC)."""
    html_path = os.path.join(static_dir, "crypto.html")
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="crypto.html not found.") from None


@app.get("/url-shortener", response_class=HTMLResponse, summary="Serve URL Shortener tool")
def read_url_shortener_tool():
    """
    Return the URL Shortener HTML page from the static directory.
    
    Returns:
        html (str): Contents of "url-shortener.html".
    
    Raises:
        HTTPException: status_code 404 if "url-shortener.html" is not found.
    """
    html_path = os.path.join(static_dir, "url-shortener.html")
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="url-shortener.html not found.") from None

@app.get("/api-tester", response_class=HTMLResponse, summary="Serve Local API Tester tool")
def read_api_tester_tool():
    """Serve the API Tester tool."""
    html_path = os.path.join(static_dir, "api-tester.html")
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="api-tester.html not found.") from None


@app.get("/ssh", response_class=HTMLResponse, summary="Serve SSH & SFTP Manager tool")
def read_ssh_tool():
    """Serve the SSH & SFTP Manager tool."""
    html_path = os.path.join(static_dir, "ssh-manager.html")
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="ssh-manager.html not found.") from None


@app.get("/sftp", response_class=HTMLResponse, summary="Serve standalone SFTP Browser tool")
def read_sftp_tool():
    """Serve the standalone SFTP File Browser tool."""
    html_path = os.path.join(static_dir, "sftp-browser.html")
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="sftp-browser.html not found.") from None


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
    
    # Store in memory and persist
    url_db[short_id] = url
    save_db(url_db)
    
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
    """Reads saved collections from ~/.devsuite/collections.json"""
    col_path = os.path.join(os.path.expanduser("~"), ".devsuite", "collections.json")
    if os.path.exists(col_path):
        try:
            with open(col_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass
    return {"items": []}

@app.post("/api/collections", summary="Save API Tester Collections")
def save_collections(data: dict):
    """Writes collections to ~/.devsuite/collections.json"""
    devsuite_dir = os.path.join(os.path.expanduser("~"), ".devsuite")
    os.makedirs(devsuite_dir, exist_ok=True)
    col_path = os.path.join(devsuite_dir, "collections.json")
    try:
        with open(col_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
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
            body = e.read().decode('utf-8', errors='replace') if hasattr(e, 'read') and e.read else ""
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
    col_path = os.path.join(os.path.expanduser("~"), ".devsuite", "ssh_profiles.json")
    if os.path.exists(col_path):
        try:
            with open(col_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass
    return {"encrypted_blob": ""}

@app.post("/api/ssh/profiles", summary="Save SSH Profiles")
def save_ssh_profiles(data: dict):
    devsuite_dir = os.path.join(os.path.expanduser("~"), ".devsuite")
    os.makedirs(devsuite_dir, exist_ok=True)
    col_path = os.path.join(devsuite_dir, "ssh_profiles.json")
    try:
        with open(col_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@app.websocket("/api/ssh/terminal")
async def ssh_terminal(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_text()
        config = json.loads(data)
        host = config.get("host")
        port = int(config.get("port", 22))
        username = config.get("username")
        password = config.get("password")
        private_key = config.get("private_key")
        
        connect_kwargs = {
            "host": host,
            "port": port,
            "username": username,
            "known_hosts": None
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
                        pass
                
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
                        pass
                
                await asyncio.gather(read_from_ssh(), write_to_ssh())
    except Exception as e:
        try:
            await websocket.send_text(f"\r\nError: {e}\r\n")
            await websocket.close()
        except:
            pass

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
        connect_kwargs = {
            "host": req.host,
            "port": req.port,
            "username": req.username,
            "known_hosts": None
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

@app.websocket("/api/local/terminal")
async def local_terminal(websocket: WebSocket):
    await websocket.accept()
    
    config_raw = await websocket.receive_text()
    try:
        config = json.loads(config_raw)
        distro = config.get("distro")
    except:
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
                asyncio.create_task(websocket.send_text(data.decode("utf-8", errors="replace")))
            else:
                loop.remove_reader(fd)
                asyncio.create_task(websocket.close())
        except OSError:
            loop.remove_reader(fd)
            asyncio.create_task(websocket.close())

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
        print("local_terminal error:", e)
    finally:
        try:
            loop.remove_reader(fd)
            os.close(fd)
        except:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)