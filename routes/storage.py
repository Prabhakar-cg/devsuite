"""
routes/storage.py — DevDB-backed encrypted store endpoints.

Covers:
  GET/POST /api/vault          — Secret Vault blob
  GET/POST /api/collections    — API Tester collections
  GET/POST /api/ssh/profiles   — SSH session profiles
  GET/POST /api/notes          — Notes Workspace blob
"""
import deps
from fastapi import APIRouter, HTTPException, Request

from deps import _audit_log, logger, require_unlocked

router = APIRouter()


# ─── Vault ────────────────────────────────────────────────────────────────────

@router.get(
    "/api/vault",
    summary="Get encrypted vault blob",
    responses={401: {"description": "Session token missing or expired"}},
)
def get_vault(request: Request):
    """Return the raw encrypted vault blob from the DevDB 'vault' store.
    Backward-compatible shim — the server never decrypts vault contents.
    """
    require_unlocked(request)
    _audit_log("VAULT_ACCESS", ip=request.client.host if request.client else "unknown")
    store = deps._db.get_store("vault")
    return store if store else {"encrypted_blob": ""}


@router.post(
    "/api/vault",
    summary="Save encrypted vault blob",
    responses={
        401: {"description": "Session token missing or expired"},
        500: {"description": "Failed to save vault"},
    },
)
def save_vault(data: dict, request: Request):
    """Persist the encrypted vault blob into the DevDB 'vault' store.
    Backward-compatible shim — the server never decrypts vault contents.
    """
    require_unlocked(request)
    try:
        deps._db.set_store("vault", data)
        deps._db.save()
        return {"status": "ok"}
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to save vault: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save vault") from e


# ─── API Tester Collections ───────────────────────────────────────────────────

@router.get(
    "/api/collections",
    summary="Get API Tester Collections",
    responses={
        401: {"description": "Session token missing or expired"},
        500: {"description": "Failed to read collections"},
    },
)
def get_collections(request: Request):
    """Return API Tester collections from the DevDB 'collections' store.
    Backward-compatible shim for api-tester.js.
    """
    require_unlocked(request)
    store = deps._db.get_store("collections")
    return store if store else {}


@router.post(
    "/api/collections",
    summary="Save API Tester Collections",
    responses={
        401: {"description": "Session token missing or expired"},
        500: {"description": "Failed to save collections"},
    },
)
def save_collections(data: dict, request: Request):
    """Persist API Tester collections into the DevDB 'collections' store.
    Backward-compatible shim for api-tester.js.
    """
    require_unlocked(request)
    try:
        deps._db.set_store("collections", data)
        deps._db.save()
        return {"status": "ok"}
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to save collections: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save collections") from e


# ─── SSH Profiles ─────────────────────────────────────────────────────────────

@router.get(
    "/api/ssh/profiles",
    summary="Get SSH Profiles",
    responses={401: {"description": "Session token missing or expired"}},
)
def get_ssh_profiles(request: Request):
    """Return the encrypted SSH profiles blob from the DevDB 'ssh_profiles' store.
    Backward-compatible shim — server never decrypts profile contents.
    """
    require_unlocked(request)
    store = deps._db.get_store("ssh_profiles")
    return store if store else {"encrypted_blob": ""}


@router.post(
    "/api/ssh/profiles",
    summary="Save SSH Profiles",
    responses={
        401: {"description": "Session token missing or expired"},
        500: {"description": "Failed to save SSH profiles"},
    },
)
def save_ssh_profiles(data: dict, request: Request):
    """Persist the encrypted SSH profiles blob into the DevDB 'ssh_profiles' store.
    Backward-compatible shim — server never decrypts profile contents.
    """
    require_unlocked(request)
    try:
        deps._db.set_store("ssh_profiles", data)
        deps._db.save()
        return {"status": "ok"}
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to save SSH profiles: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save SSH profiles") from e


# ─── Notes Workspace ──────────────────────────────────────────────────────────

@router.get(
    "/api/notes",
    summary="Get encrypted notes blob",
    responses={401: {"description": "Session token missing or expired"}},
)
def get_notes(request: Request):
    """Return the raw encrypted notes blob from the DevDB 'notes' store.
    Backward-compatible shim — the server never decrypts notes contents.
    """
    require_unlocked(request)
    store = deps._db.get_store("notes")
    return store if store else {"encrypted_blob": ""}


@router.post(
    "/api/notes",
    summary="Save encrypted notes blob",
    responses={
        401: {"description": "Session token missing or expired"},
        500: {"description": "Failed to save notes"},
    },
)
def save_notes(data: dict, request: Request):
    """Persist the encrypted notes blob into the DevDB 'notes' store.
    Backward-compatible shim — the server never decrypts notes contents.
    """
    require_unlocked(request)
    try:
        deps._db.set_store("notes", data)
        deps._db.save()
        return {"status": "ok"}
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to save notes: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save notes") from e
