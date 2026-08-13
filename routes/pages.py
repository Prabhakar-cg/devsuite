"""
routes/pages.py — Static HTML page routes + text-file upload for diff tool.
"""
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import HTMLResponse

from deps import (
    _MIME_OCTET_STREAM,
    _serve_html,
)

router = APIRouter()


# ─── Static HTML pages ────────────────────────────────────────────────────────

@router.get("/", response_class=HTMLResponse, summary="Serve DevSuite homepage")
def read_home():
    """Serve the DevSuite landing page."""
    return _serve_html("home.html")


@router.get("/tools", response_class=HTMLResponse, summary="Serve DevSuite tools page")
def read_tools():
    """Serve the DevSuite tools dashboard (all tools grid)."""
    return _serve_html("tools.html")


@router.get("/diff", response_class=HTMLResponse, summary="Serve diff tool")
def read_diff():
    """Serve the Text/Folder Diff tool."""
    return _serve_html("index.html")


@router.get("/data-linter", response_class=HTMLResponse, summary="Serve Data Format Linter tool")
@router.get("/json", response_class=HTMLResponse, summary="Serve Data Format Linter tool (JSON tab)")
@router.get("/yaml", response_class=HTMLResponse, summary="Serve Data Format Linter tool (YAML tab)")
@router.get("/xml", response_class=HTMLResponse, summary="Serve Data Format Linter tool (XML tab)")
def read_data_linter_tool():
    """Serve the Data Format Linter tool (JSON/YAML/XML tabs).

    Four routes serve the same file; the client resolves the initial active
    tab from `location.pathname` / `?tab=` (specs/016-data-linter research.md R3).
    """
    return _serve_html("data-linter.html")


@router.get("/regex", response_class=HTMLResponse, summary="Serve Regex Tester tool")
def read_regex_tool():
    """Serve the Regex Tester tool."""
    return _serve_html("regex.html")


@router.get("/base64", response_class=HTMLResponse, summary="Serve Base64 Encoder/Decoder tool")
def read_base64_tool():
    """Serve the Base64 Encoder/Decoder tool."""
    return _serve_html("base64.html")


@router.get("/crypto", response_class=HTMLResponse, summary="Serve Crypto Suite tool")
def read_crypto_tool():
    """Serve the Crypto Suite tool (Hash, AES, RSA, HMAC)."""
    return _serve_html("crypto.html")


@router.get("/api-tester", response_class=HTMLResponse, summary="Serve Local API Tester tool")
def read_api_tester_tool():
    """Serve the API Tester tool."""
    return _serve_html("api-tester.html")


@router.get("/ssh", response_class=HTMLResponse, summary="Serve SSH & SFTP Manager tool")
def read_ssh_tool():
    """Serve the SSH & SFTP Manager tool."""
    return _serve_html("ssh-manager.html")


@router.get("/sftp", response_class=HTMLResponse, summary="Serve standalone SFTP Browser tool")
def read_sftp_tool():
    """Serve the standalone SFTP File Browser tool."""
    return _serve_html("sftp-browser.html")


@router.get("/cron", response_class=HTMLResponse, summary="Serve Cron Visualizer tool")
def read_cron_tool():
    """Serve the Cron Visualizer tool."""
    return _serve_html("cron.html")


@router.get("/vault", response_class=HTMLResponse, summary="Serve Secret Vault tool")
def read_vault_tool():
    """Serve the Secret Vault tool."""
    return _serve_html("vault.html")


@router.get("/db-manager", response_class=HTMLResponse, summary="Serve DevDB Manager tool")
def read_db_manager_tool():
    """Serve the DevDB Manager tool."""
    return _serve_html("db-manager.html")


@router.get("/file-converter", response_class=HTMLResponse, summary="Serve File Format Converter tool")
def read_file_converter_tool():
    """Serve the File Format Converter tool."""
    return _serve_html("file-converter.html")


# ─── Text file upload for diff tool ──────────────────────────────────────────

async def _read_upload_stream(file: UploadFile, max_size: int) -> tuple[bytearray, bool]:
    """Read file in 1 MB chunks; detect null bytes in the first chunk; enforce size limit."""
    raw_bytes = bytearray()
    null_detected = False
    chunk_size = 1024 * 1024
    while chunk := await file.read(chunk_size):
        if not null_detected and not raw_bytes and b"\x00" in chunk[:512]:
            null_detected = True
        raw_bytes.extend(chunk)
        if len(raw_bytes) > max_size:
            raise HTTPException(status_code=413, detail="File too large. Exceeds 50MB limit.")
    return raw_bytes, null_detected


@router.post(
    "/upload",
    summary="Upload a text file for diffing",
    responses={
        400: {"description": "Binary file or invalid content type"},
        413: {"description": "File too large (50 MB limit)"},
        500: {"description": "Server error processing file"},
    },
)
async def upload_file(file: Annotated[UploadFile, File(...)]):
    """Accept an uploaded text file and return its content and metadata."""
    binary_mimes = ("image/", "video/", "audio/", "application/pdf",
                    "application/zip", _MIME_OCTET_STREAM)
    if file.content_type and any(file.content_type.startswith(b) for b in binary_mimes):
        raise HTTPException(
            status_code=400,
            detail=f"Only text-based files are supported. Received: {file.content_type}"
        )
    try:
        raw_bytes, null_detected = await _read_upload_stream(file, 50 * 1024 * 1024)
        if null_detected:
            raise HTTPException(
                status_code=400,
                detail=f'"{file.filename}" appears to be a binary file and cannot be diffed.'
            )
        content = raw_bytes.decode("utf-8", errors="replace")
        return {"filename": file.filename, "content": content, "size_bytes": len(raw_bytes)}
    except HTTPException:
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        raise HTTPException(status_code=500, detail="Server error processing file") from e
