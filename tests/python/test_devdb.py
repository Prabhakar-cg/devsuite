"""DevDB engine: AES-256-GCM round-trip, tamper detection, plain-mode checksum.

Covers SPEC.md §10.2 — "AES-GCM roundtrip" and integrity guarantees.
"""
import pytest

from devdb import DevDB


def test_encrypted_roundtrip(tmp_path):
    db = DevDB(tmp_path / "a.dsb", password="hunter2")
    db.open()
    db.set_store("vault", {"encrypted_blob": "abc", "iv": "00"})
    restored = DevDB.from_bytes(db.export_bytes(), password="hunter2")
    assert restored.get_store("vault") == {"encrypted_blob": "abc", "iv": "00"}


def test_wrong_password_fails(tmp_path):
    db = DevDB(tmp_path / "b.dsb", password="right")
    db.open()
    db.set_store("s", {"k": 1})
    raw = db.export_bytes()
    with pytest.raises(ValueError):
        DevDB.from_bytes(raw, password="wrong")


def test_tamper_detected_encrypted(tmp_path):
    db = DevDB(tmp_path / "c.dsb", password="pw")
    db.open()
    db.set_store("s", {"k": 1})
    raw = bytearray(db.export_bytes())
    raw[-1] ^= 0xFF  # corrupt the GCM auth tag
    with pytest.raises(ValueError):
        DevDB.from_bytes(bytes(raw), password="pw")


def test_plain_mode_checksum_roundtrip_and_tamper(tmp_path):
    db = DevDB(tmp_path / "d.dsb")  # no password → plain mode + BLAKE2b checksum
    db.open()
    db.set_store("s", {"k": "v"})
    raw = bytearray(db.export_bytes())
    assert DevDB.from_bytes(bytes(raw)).get_store("s") == {"k": "v"}
    raw[-1] ^= 0xFF  # corrupt the payload
    with pytest.raises(ValueError):
        DevDB.from_bytes(bytes(raw))


def test_save_then_reload_from_disk(tmp_path):
    path = tmp_path / "e.dsb"
    db = DevDB(path, password="x")
    db.open()
    db.set_store("app_prefs", {"master_setup_done": True})
    db.save()
    reopened = DevDB(path, password="x")
    reopened.open()
    assert reopened.get_store("app_prefs") == {"master_setup_done": True}


def test_invalid_magic_rejected():
    with pytest.raises(ValueError):
        DevDB.from_bytes(b"NOTADSDB" + b"\x00" * 100)
