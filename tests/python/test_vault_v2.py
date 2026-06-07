"""v2 challenge (AES-256-GCM / Kauth domain-separation) setup and verification.

SPEC.md §7.5 / §4.1 fix: the server must NEVER receive Kenc (the vault
encryption key).  v2 sends only Kauth — the second 256 bits of a
PBKDF2-SHA256/310k → 512-bit root split.

These tests verify:
  - v2 challenge setup is persisted correctly (challenge_version == 2)
  - /api/auth/session accepts Kauth and issues a session (AES-GCM verify path)
  - /api/auth/session rejects a wrong key (Kenc instead of Kauth, or junk)
  - v1 CBC path still works (backward compat — old vaults don't break)
  - /api/auth/challenge returns challenge_version in the response
"""
import hashlib
import os
import secrets
import struct

import pytest

import main


# ── Helpers ────────────────────────────────────────────────────────────────────

def _pbkdf2_sha256_512(password: str, salt_hex: str) -> bytes:
    """Mirrors the browser's WebCrypto PBKDF2-SHA256/310k → 512-bit derivation."""
    salt = bytes.fromhex(salt_hex)
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000, dklen=64)


def _derive_keys_v2(password: str, salt_hex: str):
    root   = _pbkdf2_sha256_512(password, salt_hex)
    Kenc   = root[:32]   # vault encryption — never sent to server
    Kauth  = root[32:]   # server auth key — this is what key_hex carries
    return Kenc, Kauth


def _aesgcm_encrypt(key: bytes, plaintext: bytes) -> tuple[str, str]:
    """Return (ciphertext_hex, nonce_hex) for AES-256-GCM."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce  = os.urandom(12)
    ct     = AESGCM(key).encrypt(nonce, plaintext, None)
    return ct.hex(), nonce.hex()


def _setup_v2_challenge(client, password="testpass"):
    """Register a v2 challenge and return (salt_hex, Kenc, Kauth)."""
    salt_hex           = os.urandom(16).hex()
    Kenc, Kauth        = _derive_keys_v2(password, salt_hex)
    verify_blob, nonce = _aesgcm_encrypt(Kauth, b"DEVSUITE_MASTER_OK")
    r = client.post("/api/auth/setup", json={
        "salt":              salt_hex,
        "verify_blob":       verify_blob,
        "verify_nonce":      nonce,
        "challenge_version": 2,
    })
    assert r.status_code == 200, f"setup failed: {r.json()}"
    return salt_hex, Kenc, Kauth


# ── Tests ──────────────────────────────────────────────────────────────────────

def test_v2_challenge_setup_stores_version(client):
    """POST /api/auth/setup with challenge_version=2 must persist challenge_version=2."""
    _setup_v2_challenge(client)
    prefs = main._db.get_store("app_prefs") or {}
    assert prefs.get("challenge_version") == 2
    assert prefs.get("master_verify_nonce")  # must be stored
    assert prefs.get("master_verify_iv") == ""  # v1 IV must be cleared


def test_v2_challenge_endpoint_returns_version(client):
    """GET /api/auth/challenge must echo challenge_version and verify_nonce."""
    salt_hex, _, _ = _setup_v2_challenge(client)
    r = client.get("/api/auth/challenge")
    assert r.status_code == 200
    body = r.json()
    assert body["challenge_version"] == 2
    assert body["verify_nonce"]
    assert body["salt"] == salt_hex


def test_v2_session_accepts_kauth(client):
    """POST /api/auth/session must succeed when key_hex carries Kauth (not Kenc)."""
    _, Kenc, Kauth = _setup_v2_challenge(client)
    r = client.post("/api/auth/session", json={"key_hex": Kauth.hex()})
    assert r.status_code == 200, f"session rejected Kauth: {r.json()}"


def test_v2_session_rejects_kenc(client):
    """POST /api/auth/session must REJECT Kenc — the vault key must never unlock a session."""
    _, Kenc, Kauth = _setup_v2_challenge(client)
    r = client.post("/api/auth/session", json={"key_hex": Kenc.hex()})
    assert r.status_code == 401, "server accepted Kenc as a valid auth key — domain separation broken!"


def test_v2_session_rejects_wrong_key(client):
    """POST /api/auth/session must reject a random 32-byte key."""
    _setup_v2_challenge(client)
    r = client.post("/api/auth/session", json={"key_hex": secrets.token_hex(32)})
    assert r.status_code == 401


def test_v1_session_still_works(client):
    """v1 CBC challenge (challenge_version=1) must still pass for backward compatibility."""
    import base64 as _b64
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.backends import default_backend

    password  = "oldpassword"
    salt_hex  = os.urandom(16).hex()
    salt      = bytes.fromhex(salt_hex)
    # Simulate CryptoJS PBKDF2-SHA1/50k
    key_bytes = hashlib.pbkdf2_hmac("sha1", password.encode(), salt, 50_000, dklen=32)
    iv        = os.urandom(16)
    plain     = b"DEVSUITE_MASTER_OK"
    # PKCS7-pad to 16-byte block
    pad_len   = 16 - len(plain) % 16
    padded    = plain + bytes([pad_len] * pad_len)
    cipher    = Cipher(algorithms.AES(key_bytes), modes.CBC(iv), backend=default_backend())
    ct        = cipher.encryptor().update(padded) + cipher.encryptor().finalize()

    # Re-derive encryptor (consumed above)
    cipher  = Cipher(algorithms.AES(key_bytes), modes.CBC(iv), backend=default_backend())
    enc     = cipher.encryptor()
    ct      = enc.update(padded) + enc.finalize()

    r = client.post("/api/auth/setup", json={
        "salt":              salt_hex,
        "verify_blob":       _b64.b64encode(ct).decode(),
        "verify_iv":         iv.hex(),
        "challenge_version": 1,
    })
    assert r.status_code == 200

    r = client.post("/api/auth/session", json={"key_hex": key_bytes.hex()})
    assert r.status_code == 200, f"v1 session rejected: {r.json()}"
