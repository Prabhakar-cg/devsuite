"""
DevSuite — FastAPI Backend
---------------------------------
Serves the static frontend and provides a file upload endpoint.
Priority: All file reading happens client-side in JavaScript (FileReader API)
for maximum privacy. The /upload endpoint is a fallback for edge cases.
"""

import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

app = FastAPI(
    title="DevSuite",
    description="A private, locally-hosted diff checker with Monaco Editor.",
    version="2.0.0"
)

static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)

# Serve static assets (JS, CSS, images) from the /static route
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.middleware("http")
async def add_security_headers(request, call_next):
    """Add standard security headers to all responses."""
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
    """Serve the Base64 Encoder/Decoder tool."""
    html_path = os.path.join(static_dir, "base64.html")
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="base64.html not found.") from None


@app.post("/upload", summary="Upload a text file for diffing")
async def upload_file(file: UploadFile = File(...)):
    """
    Fallback endpoint: accepts a text file, validates it is not binary,
    and returns its decoded string content as JSON.
    Client-side JS is preferred for privacy; this is a safety net.
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
