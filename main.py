"""
DevSuite — FastAPI Backend  (v0.2.4)
-------------------------------------
Thin orchestrator: creates the FastAPI app, registers middleware, mounts
static files, and includes all route modules.

All shared state (DevDB, limiter, sessions, constants, helpers) lives in
deps.py.  Route implementations live in routes/*.py.

Test compatibility
------------------
Tests access shared objects via ``main.<name>`` because the ``from deps import``
and ``from routes.proxy import`` statements below create name bindings in this
module's namespace that point to the **same** objects defined in deps/routes.
Mutations like ``main._sessions.clear()`` or ``main.limiter._storage.reset()``
therefore affect the live objects used by every route handler.
"""

import os
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# ─── Shared state (re-exported for test compatibility) ───────────────────────
from deps import (
    APP_VERSION,
    _ALLOWED_ORIGINS,
    _AUDIT_LOG_PATH,   # noqa: F401 — referenced by conftest as main._AUDIT_LOG_PATH
    _DB_PATH,          # noqa: F401 — referenced by conftest as main._DB_PATH
    _DEV_MODE,
    _DEVSUITE_DIR,
    _HTTPS,
    _PTY_AVAILABLE,    # noqa: F401 — referenced by tests as main._PTY_AVAILABLE
    _audit_log,        # noqa: F401 — re-exported for import completeness
    _db,
    _hash_token,
    _sessions,
    limiter,
    logger,
    static_dir,
)

# ─── Route-module names re-exported for tests ───────────────────────────────
from routes.proxy import _SSRFSafeRedirectHandler, _check_ip_not_private  # noqa: F401

# ─── Router imports ──────────────────────────────────────────────────────────
from routes import auth, convert, db, pages, proxy, ssh, storage


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def _lifespan(_application: FastAPI):
    """Modern FastAPI lifespan: open DevDB and migrate legacy files on startup."""
    _DEVSUITE_DIR.mkdir(parents=True, exist_ok=True)
    try:
        _DEVSUITE_DIR.chmod(0o700)
    except OSError:
        pass  # best-effort — may be a no-op on Windows/non-POSIX

    _db.open()
    migrated = _db.__class__.migrate_legacy(_db, _DEVSUITE_DIR)
    if migrated:
        _db.save()
        logger.info("DevDB: migration complete, database saved to %s", _DEVSUITE_DIR / "devdb.dsb")
    else:
        logger.info("DevDB: opened (%d bytes)", _db.file_size())
    yield


# ─── App factory ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="DevSuite",
    description="A private, locally-hosted developer suite with encrypted unified storage.",
    version=APP_VERSION,
    lifespan=_lifespan,
    docs_url="/docs" if _DEV_MODE else None,
    redoc_url="/redoc" if _DEV_MODE else None,
)

# Rate-limiter — must be set on app.state before SlowAPIMiddleware is added.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middleware registration order matters: in Starlette each add_middleware call wraps
# the existing stack, so the LAST call becomes the OUTERMOST layer (first to handle
# a request). Registration order here is inner-first, outer-last.

# Innermost: rate-limiting — applied after CORS so preflight OPTIONS are not rate-limited.
app.add_middleware(SlowAPIMiddleware)


# ─── Security-headers middleware ──────────────────────────────────────────────

# Document policy: no unsafe-eval (SEC-6, closed v0.3.0). unsafe-inline remains
# tracked as SEC-11. blob: in script-src / worker-src is required by Monaco.
_DOCUMENT_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' blob:; "
    "worker-src 'self' blob:; "
    "style-src 'self' 'unsafe-inline'; "
    "font-src 'self'; "
    "img-src 'self' data:; "
    "connect-src 'self';"
)

# Scoped policy for the API Tester scripting sandbox (SPEC §4.7.1 / §5.10):
# a dedicated worker's CSP comes from its own response headers, so eval is
# permitted ONLY inside this worker — which also has no DOM and no network.
_SANDBOX_WORKER_PATH = "/static/script-sandbox-worker.js"
_SANDBOX_WORKER_CSP = (
    "default-src 'none'; "
    "script-src 'self' 'unsafe-eval'; "
    "connect-src 'none';"
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    """Attach a standard set of HTTP security headers to every outgoing response."""
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    # X-XSS-Protection is deprecated; set to "0" to avoid legacy browser quirks.
    response.headers["X-XSS-Protection"] = "0"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    is_sandbox_worker = request.url.path == _SANDBOX_WORKER_PATH
    response.headers["Content-Security-Policy"] = (
        _SANDBOX_WORKER_CSP if is_sandbox_worker else _DOCUMENT_CSP
    )
    return response


# Outermost: CORS — handles OPTIONS preflight before any other middleware runs.
# SEC-3: explicit allowlist; only the local DevSuite origin may make cross-origin requests.
# Must be last (outermost) so it processes requests before security-headers middleware.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)


# ─── CSRF middleware ──────────────────────────────────────────────────────────

# Auth endpoints that predate any session/CSRF token (exempt from CSRF check).
_CSRF_EXEMPT_PATHS = {"/api/auth/session", "/api/auth/setup"}


@app.middleware("http")
async def csrf_middleware(request, call_next):
    """Double-submit CSRF check on all mutating routes."""
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        if request.url.path not in _CSRF_EXEMPT_PATHS:
            csrf_header = request.headers.get("X-CSRF-Token", "")
            expected    = request.cookies.get("ds_csrf", "")
            if not csrf_header or not expected or not secrets.compare_digest(csrf_header, expected):
                return JSONResponse({"error": "CSRF validation failed"}, status_code=403)
    return await call_next(request)


# ─── Static files ─────────────────────────────────────────────────────────────

app.mount("/static", StaticFiles(directory=static_dir), name="static")


# ─── Routers ──────────────────────────────────────────────────────────────────

app.include_router(pages.router)
app.include_router(auth.router)
app.include_router(storage.router)
app.include_router(convert.router)
app.include_router(proxy.router)
app.include_router(db.router)
app.include_router(ssh.router)


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    _host = os.environ.get("HOST", "127.0.0.1")
    _port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host=_host, port=_port, reload=_DEV_MODE)
