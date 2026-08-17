"""GET/POST /api/notes — Notes Workspace encrypted blob storage.

Mirrors the existing /api/vault contract exactly (routes/storage.py):
the endpoint is session-gated and treats encrypted_blob/iv/salt/version as
opaque data — the server never decrypts it. See specs/017-notes-workspace/
contracts/notes-api.md.
"""
import os

import main


# ── Helpers (mirrors tests/python/test_vault_v2.py's v2 session setup) ────────

def _pbkdf2_sha256_512(password: str, salt_hex: str) -> bytes:
    import hashlib
    salt = bytes.fromhex(salt_hex)
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000, dklen=64)


def _aesgcm_encrypt(key: bytes, plaintext: bytes) -> tuple[str, str]:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, plaintext, None)
    return ct.hex(), nonce.hex()


def _authenticated_client(client, password="testpass"):
    """Set up a v2 master password and return a client with an active session."""
    salt_hex = os.urandom(16).hex()
    root = _pbkdf2_sha256_512(password, salt_hex)
    kauth = root[32:]
    verify_blob, nonce = _aesgcm_encrypt(kauth, b"DEVSUITE_MASTER_OK")
    r = client.post("/api/auth/setup", json={
        "salt": salt_hex,
        "verify_blob": verify_blob,
        "verify_nonce": nonce,
        "challenge_version": 2,
    })
    assert r.status_code == 200, f"setup failed: {r.json()}"
    r = client.post("/api/auth/session", json={"key_hex": kauth.hex()})
    assert r.status_code == 200, f"session failed: {r.json()}"
    return client


# ── Tests ───────────────────────────────────────────────────────────────────

def test_get_notes_without_session_is_401(client):
    r = client.get("/api/notes")
    assert r.status_code == 401


def test_post_notes_without_session_is_401(client):
    r = client.post("/api/notes", json={"encrypted_blob": "x"})
    assert r.status_code in (401, 403)  # 403 if CSRF check runs first


def test_post_notes_with_session_but_no_csrf_token_is_403(client):
    _authenticated_client(client)
    r = client.post("/api/notes", json={"encrypted_blob": "x"})
    assert r.status_code == 403


def test_post_notes_with_session_but_invalid_csrf_token_is_403(client):
    _authenticated_client(client)
    r = client.post("/api/notes", json={"encrypted_blob": "x"}, headers={"X-CSRF-Token": "not-the-real-token"})
    assert r.status_code == 403


def test_get_notes_with_no_prior_save_returns_empty_blob(client):
    _authenticated_client(client)
    r = client.get("/api/notes")
    assert r.status_code == 200
    assert r.json() == {"encrypted_blob": ""}


def test_post_then_get_notes_round_trips_the_opaque_blob(client):
    _authenticated_client(client)
    csrf = client.cookies.get("ds_csrf")
    payload = {
        "encrypted_blob": "deadbeef" * 8,
        "iv": "abcdef" * 4,
        "salt": "112233" * 4,
        "version": 2,
    }
    r = client.post("/api/notes", json=payload, headers={"X-CSRF-Token": csrf})
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}

    r = client.get("/api/notes")
    assert r.status_code == 200
    assert r.json() == payload


def test_post_notes_persists_across_requests(client):
    _authenticated_client(client)
    csrf = client.cookies.get("ds_csrf")
    first = {"encrypted_blob": "aaaa", "iv": "bbbb", "salt": "cccc", "version": 2}
    client.post("/api/notes", json=first, headers={"X-CSRF-Token": csrf})

    second = {"encrypted_blob": "dddd", "iv": "eeee", "salt": "ffff", "version": 2}
    r = client.post("/api/notes", json=second, headers={"X-CSRF-Token": csrf})
    assert r.status_code == 200

    r = client.get("/api/notes")
    assert r.json() == second  # overwritten, not merged/appended


def test_notes_store_is_isolated_from_vault_store(client):
    """The 'notes' DevDB store must be distinct from 'vault' — saving one must
    never leak into or overwrite the other."""
    _authenticated_client(client)
    csrf = client.cookies.get("ds_csrf")
    client.post("/api/notes", json={"encrypted_blob": "notes-data"}, headers={"X-CSRF-Token": csrf})
    client.post("/api/vault", json={"encrypted_blob": "vault-data"}, headers={"X-CSRF-Token": csrf})

    assert client.get("/api/notes").json()["encrypted_blob"] == "notes-data"
    assert client.get("/api/vault").json()["encrypted_blob"] == "vault-data"


def test_notes_store_name_is_in_allowed_stores():
    """DevDB Manager's generic store browser (routes/db.py) must recognize 'notes'."""
    import deps
    assert "notes" in deps._ALLOWED_STORES
