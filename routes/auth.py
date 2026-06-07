"""
routes/auth.py — Master-password auth management (/api/auth/*, /api/vault/migrate).

Client-side password verification: the server stores a challenge blob (AES-encrypted
known plaintext).  The plaintext password never leaves the browser.
"""
import secrets
import time

import deps
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse

from deps import (
    _HTTPS,
    _SESSION_TTL,
    _audit_log,
    _hash_token,
    _sessions,
    limiter,
    require_unlocked,
)

router = APIRouter()


@router.get(
    "/api/vault/migrate",
    summary="Read vault blob for one-time migration (no auth required)",
    responses={
        409: {"description": "Master password already configured — use /api/vault instead"},
    },
)
def get_vault_migrate():
    """Return the encrypted vault blob without session auth.

    Only available when no master password has been configured yet (is_setup=false).
    Safe because the blob is AES-encrypted client-side; the server never holds the key.
    Once /api/auth/setup is called this endpoint is permanently disabled (returns 409).
    """
    prefs = deps._db.get_store("app_prefs") or {}
    if prefs.get("master_setup_done"):
        raise HTTPException(
            status_code=409,
            detail="Master password is configured — use /api/vault with a valid session.",
        )
    store = deps._db.get_store("vault")
    return store if store else {"encrypted_blob": ""}


@router.get(
    "/api/auth/status",
    summary="Check if master password is configured",
)
def auth_status():
    """Return whether the master encryption password has been set up."""
    prefs = deps._db.get_store("app_prefs") or {}
    vault = deps._db.get_store("vault") or {}
    return {
        "is_setup":       bool(prefs.get("master_setup_done")),
        "vault_has_data": bool(vault.get("salt")),
    }


@router.get(
    "/api/auth/challenge",
    summary="Get password verification challenge",
    responses={404: {"description": "Master password not configured"}},
)
@limiter.limit("5/minute")
def auth_challenge(request: Request):
    """Return the stored salt + encrypted-verify-blob for client-side password checking.

    v1 (legacy): returns verify_iv (AES-CBC with PBKDF2-SHA1/50k key).
    v2 (current): returns verify_nonce (AES-GCM with domain-separated Kauth from
                  PBKDF2-SHA256/310k → 512-bit split). challenge_version field
                  discriminates; absence implies 1.
    """
    prefs = deps._db.get_store("app_prefs") or {}
    if not prefs.get("master_setup_done"):
        raise HTTPException(status_code=404, detail="Master password not configured")
    return {
        "salt":              prefs.get("master_salt", ""),
        "verify_blob":       prefs.get("master_verify_blob", ""),
        "verify_iv":         prefs.get("master_verify_iv", ""),    # v1 only
        "verify_nonce":      prefs.get("master_verify_nonce", ""), # v2 only
        "challenge_version": prefs.get("challenge_version", 1),
    }


@router.post(
    "/api/auth/setup",
    summary="Initialize master password (first-time setup)",
    responses={
        400: {"description": "Missing required fields"},
        409: {"description": "Master password already configured"},
    },
)
def auth_setup(data: dict):
    """One-time setup: store the PBKDF2 salt and AES verification blob in app_prefs.

    v1: {salt, verify_blob, verify_iv}
    v2: {salt, verify_blob, verify_nonce, challenge_version: 2}
    """
    prefs = deps._db.get_store("app_prefs") or {}
    if prefs.get("master_setup_done"):
        raise HTTPException(status_code=409, detail="Master password already configured")

    salt              = str(data.get("salt",              "")).strip()
    verify_blob       = str(data.get("verify_blob",       "")).strip()
    challenge_version = int(data.get("challenge_version", 1))

    if challenge_version == 2:
        verify_nonce = str(data.get("verify_nonce", "")).strip()
        if not salt or not verify_blob or not verify_nonce:
            raise HTTPException(status_code=400,
                detail="Missing required fields: salt, verify_blob, verify_nonce")
        prefs.update({
            "master_setup_done":   True,
            "master_salt":         salt,
            "master_verify_blob":  verify_blob,
            "master_verify_nonce": verify_nonce,
            "master_verify_iv":    "",  # unused for v2
            "challenge_version":   2,
        })
    else:
        verify_iv = str(data.get("verify_iv", "")).strip()
        if not salt or not verify_blob or not verify_iv:
            raise HTTPException(status_code=400,
                detail="Missing required fields: salt, verify_blob, verify_iv")
        prefs.update({
            "master_setup_done":  True,
            "master_salt":        salt,
            "master_verify_blob": verify_blob,
            "master_verify_iv":   verify_iv,
            "challenge_version":  1,
        })

    deps._db.set_store("app_prefs", prefs)
    deps._db.save()
    return {"status": "ok"}


@router.post(
    "/api/auth/update-challenge",
    summary="Update master password challenge after password change",
    responses={
        400: {"description": "Missing required fields"},
        401: {"description": "Session token missing or expired"},
        404: {"description": "Master password not yet configured"},
    },
)
def auth_update_challenge(data: dict, request: Request):
    """Replace the verification challenge when the master password is changed.

    v1: {salt, verify_blob, verify_iv}
    v2: {salt, verify_blob, verify_nonce, challenge_version: 2}
    """
    require_unlocked(request)
    prefs = deps._db.get_store("app_prefs") or {}
    if not prefs.get("master_setup_done"):
        raise HTTPException(status_code=404, detail="Master password not yet configured")

    salt              = str(data.get("salt",              "")).strip()
    verify_blob       = str(data.get("verify_blob",       "")).strip()
    challenge_version = int(data.get("challenge_version", 1))

    if challenge_version == 2:
        verify_nonce = str(data.get("verify_nonce", "")).strip()
        if not salt or not verify_blob or not verify_nonce:
            raise HTTPException(status_code=400,
                detail="Missing required fields: salt, verify_blob, verify_nonce")
        prefs.update({
            "master_salt":         salt,
            "master_verify_blob":  verify_blob,
            "master_verify_nonce": verify_nonce,
            "master_verify_iv":    "",
            "challenge_version":   2,
        })
    else:
        verify_iv = str(data.get("verify_iv", "")).strip()
        if not salt or not verify_blob or not verify_iv:
            raise HTTPException(status_code=400,
                detail="Missing required fields: salt, verify_blob, verify_iv")
        prefs.update({
            "master_salt":        salt,
            "master_verify_blob": verify_blob,
            "master_verify_iv":   verify_iv,
            "challenge_version":  1,
        })
    deps._db.set_store("app_prefs", prefs)
    deps._db.save()
    # Revoke all existing sessions after a master-password rotation.
    _sessions.clear()
    return {"status": "ok"}


@router.post(
    "/api/auth/session",
    summary="Exchange verified master key for a server-side session token",
    responses={
        400: {"description": "Missing key_hex"},
        401: {"description": "Invalid master key or key verification failed"},
        404: {"description": "Master password not configured"},
        429: {"description": "Too many attempts — try again in 60 seconds"},
    },
)
@limiter.limit("5/minute")
def auth_session(request: Request, data: dict):  # pylint: disable=too-many-locals
    """Verify the PBKDF2-derived key (hex) against the stored challenge and issue a session token.

    v1: key_hex is the full AES key (PBKDF2-SHA1/50k) — legacy path for existing vaults.
    v2: key_hex is Kauth, the second 256-bit half of PBKDF2-SHA256/310k → 512-bit.
        Kenc (the first half, used for vault encryption) is never sent to the server.
    """
    prefs = deps._db.get_store("app_prefs") or {}
    if not prefs.get("master_setup_done"):
        raise HTTPException(status_code=404, detail="Master password not configured")

    key_hex = str(data.get("key_hex", "")).strip()
    if not key_hex:
        raise HTTPException(status_code=400, detail="Missing key_hex")

    challenge_version = prefs.get("challenge_version", 1)

    try:
        key_bytes = bytes.fromhex(key_hex)

        if challenge_version == 2:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # pylint: disable=import-outside-toplevel
            nonce      = bytes.fromhex(prefs["master_verify_nonce"])
            ciphertext = bytes.fromhex(prefs["master_verify_blob"])
            aesgcm     = AESGCM(key_bytes)
            plaintext  = aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8", errors="strict")
        else:
            import base64 as _b64  # pylint: disable=import-outside-toplevel
            from cryptography.hazmat.primitives.ciphers import (  # pylint: disable=import-outside-toplevel
                Cipher, algorithms, modes,
            )
            from cryptography.hazmat.backends import default_backend  # pylint: disable=import-outside-toplevel

            verify_iv  = bytes.fromhex(prefs["master_verify_iv"])
            ciphertext = _b64.b64decode(prefs["master_verify_blob"])

            cipher = Cipher(algorithms.AES(key_bytes), modes.CBC(verify_iv), backend=default_backend())  # NOSONAR
            decryptor = cipher.decryptor()
            padded    = decryptor.update(ciphertext) + decryptor.finalize()
            pad_len   = padded[-1]
            if pad_len < 1 or pad_len > 16:
                raise ValueError("Invalid PKCS7 padding")
            plaintext = padded[:-pad_len].decode("utf-8", errors="strict")

        if plaintext != "DEVSUITE_MASTER_OK":
            raise HTTPException(status_code=401, detail="Invalid master key")
    except HTTPException:
        raise
    except Exception as exc:  # pylint: disable=broad-exception-caught
        raise HTTPException(status_code=401, detail="Key verification failed") from exc

    token = secrets.token_urlsafe(32)
    _sessions[_hash_token(token)] = time.time() + _SESSION_TTL
    csrf_token = secrets.token_hex(32)
    client_ip = request.client.host if request.client else "unknown"
    _audit_log("AUTH_SESSION", ip=client_ip)

    response = JSONResponse({"status": "ok", "expires_in": _SESSION_TTL})
    response.set_cookie(  # NOSONAR — secure=_HTTPS is intentional: app runs over HTTP locally
        key="ds_session", value=token,
        httponly=True, samesite="strict", max_age=_SESSION_TTL, secure=_HTTPS,
    )
    response.set_cookie(  # NOSONAR — httponly=False is intentional (JS must read CSRF token)
        key="ds_csrf", value=csrf_token,
        httponly=False, samesite="strict", max_age=_SESSION_TTL, secure=_HTTPS,
    )
    return response


@router.post(
    "/api/auth/logout",
    summary="Invalidate the current server-side session",
)
def auth_logout(request: Request, response: Response):
    """Expire the ds_session and ds_csrf cookies and remove the session from the store."""
    token = request.cookies.get("ds_session")
    if token:
        _sessions.pop(_hash_token(token), None)
    client_ip = request.client.host if request.client else "unknown"
    _audit_log("AUTH_LOGOUT", ip=client_ip)
    response.delete_cookie(key="ds_session", path="/", samesite="strict")
    response.delete_cookie(key="ds_csrf",    path="/", samesite="strict")
    return {"status": "ok"}
