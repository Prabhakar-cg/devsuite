"""
test_devdb.py — Unit tests for the DevDB engine.

Tests:
  1. Round-trip write/read (plaintext mode)
  2. Round-trip write/read (encrypted mode)
  3. Tamper detection (plaintext — BLAKE2b mismatch)
  4. Tamper detection (encrypted — GCM tag mismatch)
  5. Wrong password → ValueError
  6. Magic byte validation
  7. Store CRUD (get / set / delete / list)
  8. Migration from legacy JSON files
  9. export_bytes / from_bytes round-trip
 10. Atomic write (temp file replaced, no partial state)
"""

import json
import os
import struct
import tempfile
from pathlib import Path

import pytest

from devdb import DevDB, MAGIC, HEADER_SIZE, FLAG_ENCRYPTED


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def tmp_db_path(tmp_path: Path) -> Path:
    return tmp_path / "test.dsb"


def make_db(path: Path, password: str | None = None, stores: dict | None = None) -> DevDB:
    db = DevDB(path, password=password)
    db.open()
    if stores:
        for name, data in stores.items():
            db.set_store(name, data)
    db.save()
    return db


# ── 1. Plaintext round-trip ───────────────────────────────────────────────────

def test_plaintext_roundtrip(tmp_db_path):
    data = {"items": [{"id": 1, "name": "test"}]}
    db = make_db(tmp_db_path, stores={"collections": data})

    db2 = DevDB(tmp_db_path)
    db2.open()
    assert db2.get_store("collections") == data, "Plaintext round-trip failed"


# ── 2. Encrypted round-trip ───────────────────────────────────────────────────

def test_encrypted_roundtrip(tmp_db_path):
    data = {"encrypted_blob": "abc123", "iv": "deadbeef", "salt": "cafebabe"}
    db = make_db(tmp_db_path, password="hunter2", stores={"vault": data})

    db2 = DevDB(tmp_db_path, password="hunter2")
    db2.open()
    assert db2.get_store("vault") == data, "Encrypted round-trip failed"


# ── 3. Tamper detection — plaintext (BLAKE2b checksum) ────────────────────────

def test_tamper_plaintext(tmp_db_path):
    make_db(tmp_db_path, stores={"url_db": {"abc": "https://example.com"}})

    raw = bytearray(tmp_db_path.read_bytes())
    # Flip a byte in the payload region (after header + 32-byte checksum)
    raw[HEADER_SIZE + 32 + 5] ^= 0xFF
    tmp_db_path.write_bytes(bytes(raw))

    db2 = DevDB(tmp_db_path)
    with pytest.raises(ValueError, match="integrity check failed"):
        db2.open()


# ── 4. Tamper detection — encrypted (GCM auth tag) ────────────────────────────

def test_tamper_encrypted(tmp_db_path):
    make_db(tmp_db_path, password="s3cr3t", stores={"vault": {"blob": "secret"}})

    raw = bytearray(tmp_db_path.read_bytes())
    # Flip a byte well inside the ciphertext
    raw[HEADER_SIZE + 20] ^= 0x01
    tmp_db_path.write_bytes(bytes(raw))

    db2 = DevDB(tmp_db_path, password="s3cr3t")
    with pytest.raises(ValueError, match="decryption failed"):
        db2.open()


# ── 5. Wrong password ─────────────────────────────────────────────────────────

def test_wrong_password(tmp_db_path):
    make_db(tmp_db_path, password="correct", stores={"vault": {"x": 1}})

    db2 = DevDB(tmp_db_path, password="wrong")
    with pytest.raises(ValueError, match="decryption failed"):
        db2.open()


# ── 6. Missing password for encrypted file ────────────────────────────────────

def test_missing_password(tmp_db_path):
    make_db(tmp_db_path, password="pw", stores={"vault": {"x": 1}})

    db2 = DevDB(tmp_db_path)   # no password
    with pytest.raises(ValueError, match="no password"):
        db2.open()


# ── 7. Invalid magic bytes ─────────────────────────────────────────────────────

def test_bad_magic(tmp_db_path):
    make_db(tmp_db_path, stores={"x": {"a": 1}})
    raw = bytearray(tmp_db_path.read_bytes())
    raw[:4] = b"XXXX"
    tmp_db_path.write_bytes(bytes(raw))

    db2 = DevDB(tmp_db_path)
    with pytest.raises(ValueError, match="invalid magic bytes"):
        db2.open()


# ── 8. Store CRUD ─────────────────────────────────────────────────────────────

def test_store_crud(tmp_db_path):
    db = DevDB(tmp_db_path)
    db.open()

    # set & get
    db.set_store("collections", {"items": [1, 2, 3]})
    assert db.get_store("collections") == {"items": [1, 2, 3]}

    # missing store returns {}
    assert db.get_store("nonexistent") == {}

    # list
    assert "collections" in db.list_stores()

    # delete
    assert db.delete_store("collections") is True
    assert "collections" not in db.list_stores()
    assert db.delete_store("collections") is False  # already gone


# ── 9. Migration from legacy files ────────────────────────────────────────────

def test_migration(tmp_path: Path):
    # Write legacy JSON files
    legacy_collections = {"items": [{"name": "Legacy Collection"}]}
    legacy_vault        = {"encrypted_blob": "old-blob", "iv": "old-iv", "salt": "old-salt"}

    (tmp_path / "collections.json").write_text(json.dumps(legacy_collections))
    (tmp_path / "vault.json").write_text(json.dumps(legacy_vault))

    db_path = tmp_path / "devdb.dsb"
    db = DevDB(db_path)
    db.open()

    migrated = DevDB.migrate_legacy(db, tmp_path)
    assert migrated is True

    db.save()

    # Legacy files should now be backed up
    assert (tmp_path / "collections.json.bak").exists()
    assert (tmp_path / "vault.json.bak").exists()
    assert not (tmp_path / "collections.json").exists()

    # Data should be in DevDB
    db2 = DevDB(db_path)
    db2.open()
    assert db2.get_store("collections") == legacy_collections
    assert db2.get_store("vault") == legacy_vault


# ── 10. export_bytes / from_bytes ─────────────────────────────────────────────

def test_export_import_bytes(tmp_db_path):
    data = {"items": ["exported", "correctly"]}
    db = make_db(tmp_db_path, stores={"collections": data})

    raw = db.export_bytes()
    assert raw[:4] == MAGIC, "Exported bytes missing magic"

    db2 = DevDB.from_bytes(raw)
    assert db2.get_store("collections") == data


def test_export_import_encrypted_bytes(tmp_db_path):
    data = {"encrypted_blob": "enc-data"}
    db = make_db(tmp_db_path, password="pw", stores={"vault": data})

    raw = db.export_bytes()

    db2 = DevDB.from_bytes(raw, password="pw")
    assert db2.get_store("vault") == data


# ── 11. Atomic write ──────────────────────────────────────────────────────────

def test_atomic_write_no_partial_state(tmp_db_path):
    """Saving should not leave a .tmp file behind."""
    db = make_db(tmp_db_path, stores={"url_db": {"k": "v"}})

    tmp_files = list(tmp_db_path.parent.glob("*.tmp"))
    assert not tmp_files, f"Temp files left behind: {tmp_files}"
    assert tmp_db_path.exists()


# ── 12. File grows on repeated writes (nonce is fresh) ────────────────────────

def test_encrypted_nonce_changes(tmp_db_path):
    """Each save of an encrypted DB should use a fresh nonce (file contents change)."""
    make_db(tmp_db_path, password="pw", stores={"x": {"n": 1}})
    raw1 = tmp_db_path.read_bytes()

    db2 = DevDB(tmp_db_path, password="pw")
    db2.open()
    db2.set_store("x", {"n": 1})   # same data
    db2.save()
    raw2 = tmp_db_path.read_bytes()

    # Nonces live at offset 52..64 in the header
    nonce1 = raw1[52:64]
    nonce2 = raw2[52:64]
    assert nonce1 != nonce2, "Nonce should be randomly regenerated on every write"


# ── 13. store_sizes() ─────────────────────────────────────────────────────────

def test_store_sizes(tmp_db_path):
    db = make_db(tmp_db_path, stores={"collections": {"items": list(range(100))}})
    sizes = db.store_sizes()
    assert "collections" in sizes
    assert sizes["collections"]["bytes"] > 0
    assert sizes["collections"]["count"] == 100
