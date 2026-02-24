"""
DiffChecker.io — FastAPI Backend
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
    title="DiffChecker.io",
    description="A private, locally-hosted diff checker with Monaco Editor.",
    version="2.0.0"
)

static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)

# Serve static assets (JS, CSS, images) from the /static route
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/", response_class=HTMLResponse, summary="Serve frontend")
async def read_root():
    """Serve the main index.html SPA entry point."""
    html_path = os.path.join(static_dir, "index.html")
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="index.html not found. Run setup correctly.")


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
        raw_bytes = await file.read()
        # Check first 512 bytes for null bytes — strong indicator of binary data
        if b"\x00" in raw_bytes[:512]:
            raise HTTPException(
                status_code=400,
                detail=f'"{file.filename}" appears to be a binary file and cannot be diffed.'
            )
        # Decode, replacing unmappable chars to avoid crashing on imperfect UTF-8
        content = raw_bytes.decode("utf-8", errors="replace")
        return {"filename": file.filename, "content": content, "size_bytes": len(raw_bytes)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error processing file: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
