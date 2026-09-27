"""POST /api/auth/update-challenge — master-password rotation.

Backs BACKLOG SEC-8 (Vault "Change Master Password"). This endpoint pre-dated the
Vault's own change-password UI (it was built for DB Manager's password change) but
had no dedicated tests before this file — a rotation/session-revocation path is
exactly the kind of security-critical code CLAUDE.md rule 4 requires tests for.

Covers SPEC.md §7 (`/api/auth/update-challenge` table row + "revokes all active
sessions" note) and specs/011-secret-vault/spec.md US8/FR-019/FR-020.
"""
import hashlib
import os

import main


# ── Helpers (mirrors tests/python/test_vault_v2.py) ────────────────────────────

def _pbkdf2_sha256_512(password: str, salt_hex: str) -> bytes:
    salt = bytes.fromhex(salt_hex)
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000, dklen=64)


def _derive_keys_v2(password: str, salt_hex: str):
    root = _pbkdf2_sha256_512(password, salt_hex)
    return root[:32], root[32:]  # Kenc, Kauth


def _aesgcm_encrypt(key: bytes, plaintext: bytes) -> tuple[str, str]:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, plaintext, None)
    return ct.hex(), nonce.hex()


def _v2_challenge_payload(password: str, salt_hex: str) -> dict:
    _, Kauth = _derive_keys_v2(password, salt_hex)
    verify_blob, nonce = _aesgcm_encrypt(Kauth, b"DEVSUITE_MASTER_OK")
    return {
        "salt": salt_hex, "verify_blob": verify_blob,
        "verify_nonce": nonce, "challenge_version": 2,
    }


def _csrf_headers(client) -> dict:
    return {"X-CSRF-Token": client.cookies.get("ds_csrf", "")}


def _setup_and_login(client, password="orig-password"):
    """Register a v2 challenge and log in. Returns (salt_hex, Kenc, Kauth)."""
    salt_hex = os.urandom(16).hex()
    r = client.post("/api/auth/setup", json=_v2_challenge_payload(password, salt_hex))
    assert r.status_code == 200, r.json()
    Kenc, Kauth = _derive_keys_v2(password, salt_hex)
    r = client.post("/api/auth/session", json={"key_hex": Kauth.hex()})
    assert r.status_code == 200, r.json()
    return salt_hex, Kenc, Kauth


# ── Tests ──────────────────────────────────────────────────────────────────────

def test_update_challenge_requires_session(client):
    """A valid CSRF token but no session cookie — must be rejected (401), not just CSRF-blocked."""
    client.get("/vault")  # HTML page load — mints the ds_csrf cookie for this client
    salt_hex = os.urandom(16).hex()
    r = client.post(
        "/api/auth/update-challenge",
        json=_v2_challenge_payload("x", salt_hex),
        headers=_csrf_headers(client),
    )
    assert r.status_code == 401


def test_update_challenge_requires_setup(client):
    """A forged session token with no master password configured yet — still 404, not a rotation."""
    import time
    client.get("/vault")  # HTML page load — mints the ds_csrf cookie for this client
    token = "forged-token"
    main._sessions[main._hash_token(token)] = time.time() + 1000
    client.cookies.set("ds_session", token)
    salt_hex = os.urandom(16).hex()
    r = client.post(
        "/api/auth/update-challenge",
        json=_v2_challenge_payload("x", salt_hex),
        headers=_csrf_headers(client),
    )
    assert r.status_code == 404


def test_update_challenge_rejects_missing_fields(client):
    _setup_and_login(client)
    r = client.post(
        "/api/auth/update-challenge",
        json={"salt": "ab", "verify_blob": "cd", "challenge_version": 2},  # no verify_nonce
        headers=_csrf_headers(client),
    )
    assert r.status_code == 400


def test_update_challenge_rotates_and_revokes_old_session(client):
    """The core SEC-8 guarantee: rotating the challenge must invalidate the session
    used to request the rotation, and the new Kauth must be the only one that works."""
    _setup_and_login(client, password="old-password")

    new_salt = os.urandom(16).hex()
    _, new_Kauth = _derive_keys_v2("new-password", new_salt)
    r = client.post(
        "/api/auth/update-challenge",
        json=_v2_challenge_payload("new-password", new_salt),
        headers=_csrf_headers(client),
    )
    assert r.status_code == 200, r.json()

    # Old session cookie (still attached to the client) is now revoked server-side.
    r = client.get("/api/vault")
    assert r.status_code == 401

    # The challenge itself reflects the new salt/version.
    r = client.get("/api/auth/challenge")
    assert r.status_code == 200
    body = r.json()
    assert body["salt"] == new_salt
    assert body["challenge_version"] == 2

    # Old Kauth no longer authenticates.
    _, old_Kauth = _derive_keys_v2("old-password", new_salt)
    r = client.post("/api/auth/session", json={"key_hex": old_Kauth.hex()})
    assert r.status_code == 401

    # New Kauth does.
    r = client.post("/api/auth/session", json={"key_hex": new_Kauth.hex()})
    assert r.status_code == 200


def test_update_challenge_v1_shape_still_accepted(client):
    """DB Manager's password-change UI still POSTs the bare v1 shape (no
    challenge_version) — see specs/011-secret-vault/spec.md Assumptions
    ("cross-tool coupling"). Must keep defaulting to challenge_version 1."""
    _setup_and_login(client)
    r = client.post(
        "/api/auth/update-challenge",
        json={"salt": "ab" * 16, "verify_blob": "deadbeef", "verify_iv": "ff" * 16},
        headers=_csrf_headers(client),
    )
    assert r.status_code == 200
    prefs = main._db.get_store("app_prefs") or {}
    assert prefs.get("challenge_version") == 1
