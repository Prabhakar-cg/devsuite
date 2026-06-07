"""
routes/db.py — DevDB Unified API (/api/db/*).

Exposes the DevDB engine for the DB Manager UI and any tool that needs
to read/write named stores directly.
"""
from typing import Annotated

import deps
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import Response

from deps import (
    _ALLOWED_STORES,
    _DB_PATH,
    _MIME_OCTET_STREAM,
    logger,
    require_unlocked,
)
from devdb import DevDB

router = APIRouter()


@router.get(
    "/api/db/meta",
    summary="Get DevDB metadata",
    responses={401: {"description": "Session token missing or expired"}},
)
def db_meta(request: Request):
    """Return database metadata: path, file size, stores list, encryption status."""
    require_unlocked(request)
    m = deps._db.meta()
    return {
        "path":      str(_DB_PATH),
        "size":      deps._db.file_size(),
        "encrypted": deps._db.is_encrypted(),
        "stores":    deps._db.store_sizes(),
        "meta":      m,
    }


@router.get(
    "/api/db/store/{name}",
    summary="Read a named DevDB store",
    responses={
        400: {"description": "Unknown store name"},
        401: {"description": "Session token missing or expired"},
    },
)
def db_get_store(name: str, request: Request):
    """Return the raw contents of the named store.  Restricted to known store names."""
    require_unlocked(request)
    if name not in _ALLOWED_STORES:
        raise HTTPException(status_code=400, detail=f"Unknown store: {name!r}")
    return deps._db.get_store(name)


@router.post(
    "/api/db/store/{name}",
    summary="Write a named DevDB store",
    responses={
        400: {"description": "Unknown store name"},
        401: {"description": "Session token missing or expired"},
        500: {"description": "Failed to write store"},
    },
)
def db_set_store(name: str, data: dict, request: Request):
    """Replace the named store with the supplied data and flush to disk."""
    require_unlocked(request)
    if name not in _ALLOWED_STORES:
        raise HTTPException(status_code=400, detail=f"Unknown store: {name!r}")
    try:
        deps._db.set_store(name, data)
        deps._db.save()
        return {"status": "ok", "store": name}
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to write store %r: %s", name, e)
        raise HTTPException(status_code=500, detail="Failed to write store") from e


@router.get(
    "/api/db/export",
    summary="Export full DevDB as a .dsb file",
    responses={
        401: {"description": "Session token missing or expired"},
        500: {"description": "Failed to export database"},
    },
)
def db_export(request: Request):
    """Stream the raw .dsb binary as a file download."""
    require_unlocked(request)
    try:
        raw = deps._db.export_bytes()
        return Response(
            content=raw,
            media_type=_MIME_OCTET_STREAM,
            headers={"Content-Disposition": 'attachment; filename="devdb.dsb"'},
        )
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to export DevDB: %s", e)
        raise HTTPException(status_code=500, detail="Failed to export database") from e


@router.post(
    "/api/db/import",
    summary="Import a .dsb file into DevDB",
    responses={
        400: {"description": "Invalid .dsb format"},
        401: {"description": "Session token missing or expired"},
        413: {"description": "Import file too large (50 MB limit)"},
        500: {"description": "Failed to import database"},
    },
)
async def db_import(request: Request, file: Annotated[UploadFile, File(...)]):
    """Accept a .dsb upload and merge its stores into the running DevDB."""
    require_unlocked(request)
    max_import_size = 50 * 1024 * 1024  # 50 MB
    try:
        raw = await file.read(max_import_size + 1)
        if len(raw) > max_import_size:
            raise HTTPException(status_code=413, detail="Import file too large (50 MB limit)")
        imported = DevDB.from_bytes(raw)
        for store_name in imported.list_stores():
            if store_name in _ALLOWED_STORES:
                deps._db.set_store(store_name, imported.get_store(store_name))
        deps._db.save()
        return {"status": "ok", "imported_stores": imported.list_stores()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to import DevDB: %s", e)
        raise HTTPException(status_code=500, detail="Failed to import database") from e
