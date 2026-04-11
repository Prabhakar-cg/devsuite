"""
DevSuite Unified Database Engine — devdb.py
==========================================
KeePass-style encrypted binary container for all DevSuite persistent data.

File: ~/.devsuite/devdb.dsb

Binary Layout
─────────────
  HEADER (64 bytes, fixed)
    magic        4s   = b"DSDB"
    version      H    = 1
    flags        H    = 0 | FLAG_ENCRYPTED(1)
    kdf          8s   = b"pbkdf2\\x00\\x00" or zeros
    iterations   I    = 200_000 or 0
    salt         32s  = random or zeros
    nonce        12s  = random or zeros

  PAYLOAD BLOCK (variable)
    Plain mode  (flags & 1 == 0):
      [32 bytes BLAKE2b checksum of payload] + [JSON bytes]
    Encrypted mode (flags & 1 == 1):
      [AESGCM output = ciphertext || 16-byte GCM auth tag]

Security
────────
  Cipher  : AES-256-GCM (authenticated encryption)
  KDF     : PBKDF2-HMAC-SHA256, 200 000 iterations
  Salt    : 256-bit (32 bytes), random per-write
  Nonce   : 96-bit  (12 bytes), random per-write
  Integrity (plain mode): BLAKE2b-256 checksum
  Integrity (enc  mode) : GCM authentication tag (16 bytes)

Dependencies: cryptography (already in requirements.txt)
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import struct
import tempfile
import threading
import time
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger("devsuite.devdb")

# ─── Format Constants ──────────────────────────────────────────────────────────
MAGIC              = b"DSDB"
VERSION            = 1
FLAG_ENCRYPTED     = 0x0001

KDF_PBKDF2         = b"pbkdf2\x00\x00"   # 8 bytes, null-padded
KDF_NONE           = b"\x00" * 8

DEFAULT_ITERATIONS = 200_000
SALT_SIZE          = 32    # 256-bit
NONCE_SIZE         = 12    # 96-bit (AES-GCM)
BLAKE2_SIZE        = 32    # 256-bit BLAKE2b digest

# Header: !4sHH8sI32s12s  →  4+2+2+8+4+32+12 = 64 bytes
HEADER_FMT  = "!4sHH8sI32s12s"
HEADER_SIZE = struct.calcsize(HEADER_FMT)
assert HEADER_SIZE == 64, f"Header size mismatch: {HEADER_SIZE}"


# ─── Helpers ────────────────────────────────────────────────────────────────────

def _ts() -> int:
    """Current Unix timestamp in milliseconds."""
    return int(time.time() * 1000)


def _derive_key(password: str, salt: bytes, iterations: int) -> bytes:
    """Derive a 32-byte (256-bit) AES key via PBKDF2-HMAC-SHA256."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=iterations,
    )
    return kdf.derive(password.encode("utf-8"))


def _blake2b(data: bytes) -> bytes:
    """32-byte BLAKE2b-256 digest for integrity checking."""
    return hashlib.blake2b(data, digest_size=BLAKE2_SIZE).digest()


# ─── DevDB Class ────────────────────────────────────────────────────────────────

class DevDB:
    """
    KeePass-style binary database container for DevSuite.

    Thread-safe via an internal threading.Lock.  All reads go through
    ``open()``; all writes are atomic (temp-file + os.replace).

    Stores are arbitrary JSON-serialisable dict objects accessed by name.
    The vault and ssh_profiles stores contain *client-side* encrypted blobs
    (never inspected by this engine); only the outer .dsb container is
    optionally server-side encrypted (controlled by ``password``).

    Quick start (no server-side encryption — default):
        db = DevDB(Path("~/.devsuite/devdb.dsb").expanduser())
        db.open()
        db.set_store("url_db", {"abc123": "https://example.com"})
        db.save()

    With optional server-side encryption:
        db = DevDB(path, password="supersecret")
        db.open()
    """

    def __init__(self, path: Path, password: str | None = None) -> None:
        self._path     = Path(path)
        self._password = password
        self._stores:  dict[str, Any] = {}
        self._meta:    dict[str, Any] = {}
        self._lock     = threading.Lock()

    # ── Public API ──────────────────────────────────────────────────────────────

    def open(self) -> None:
        """Read + decrypt the database from disk.  Safe to call multiple times."""
        with self._lock:
            if not self._path.exists():
                self._stores = {}
                self._meta   = {
                    "created":  _ts(),
                    "modified": _ts(),
                    "app":      "DevSuite",
                    "version":  VERSION,
                }
                return
            self._load()

    def save(self) -> None:
        """Encrypt + atomically write the database to disk."""
        with self._lock:
            self._write()

    def get_store(self, name: str) -> dict:
        """Return a shallow copy of the named store, or {} if absent."""
        with self._lock:
            return dict(self._stores.get(name, {}))

    def set_store(self, name: str, data: dict) -> None:
        """Replace (or create) the named store with *data*."""
        with self._lock:
            self._stores[name] = data
            self._meta["modified"] = _ts()

    def delete_store(self, name: str) -> bool:
        """Remove a store.  Returns True if it existed."""
        with self._lock:
            existed = name in self._stores
            self._stores.pop(name, None)
            if existed:
                self._meta["modified"] = _ts()
            return existed

    def list_stores(self) -> list[str]:
        """Return names of all stores currently in the database."""
        with self._lock:
            return list(self._stores.keys())

    def store_sizes(self) -> dict[str, int]:
        """Return approximate JSON byte-length of each store (for the manager UI)."""
        with self._lock:
            return {
                name: len(json.dumps(data, separators=(",", ":")))
                for name, data in self._stores.items()
            }

    def meta(self) -> dict:
        """Return database metadata (created, modified, version, app)."""
        with self._lock:
            return dict(self._meta)

    def is_encrypted(self) -> bool:
        """True if a server-side encryption password is set."""
        return self._password is not None

    def change_password(self, new_password: str | None) -> None:
        """Set, change, or remove (None) the server-side encryption password."""
        with self._lock:
            self._password = new_password
            self._meta["modified"] = _ts()

    def file_size(self) -> int:
        """Return the current on-disk file size in bytes, or 0 if absent."""
        try:
            return self._path.stat().st_size
        except FileNotFoundError:
            return 0

    def export_bytes(self) -> bytes:
        """
        Serialise the current in-memory state to raw .dsb bytes without
        writing to disk.  Used by the export endpoint.
        """
        with self._lock:
            return self._build_file_bytes()

    @classmethod
    def from_bytes(cls, raw: bytes, password: str | None = None) -> "DevDB":
        """
        Deserialise a .dsb byte payload into a new DevDB instance (no disk I/O).
        Used by the import endpoint.
        """
        inst = cls(path=Path("/dev/null"), password=password)
        inst._parse(raw)
        return inst

    # ── Migration ───────────────────────────────────────────────────────────────

    @staticmethod
    def migrate_legacy(db: "DevDB", db_dir: Path, url_db_path: Path | None = None) -> bool:
        """
        One-time migration from legacy plain/encrypted JSON files into DevDB stores.

        Migrates (if present and not already in DevDB):
          vault.json        → "vault" store
          collections.json  → "collections" store
          ssh_profiles.json → "ssh_profiles" store
          url_db.json (beside main.py) → "url_db" store

        Each migrated file is renamed to *.json.bak so migration is not
        repeated on subsequent starts.

        Returns True if any data was migrated.
        """
        migrated = False

        _legacy_files = [
            (db_dir / "vault.json",        "vault"),
            (db_dir / "collections.json",  "collections"),
            (db_dir / "ssh_profiles.json", "ssh_profiles"),
        ]
        if url_db_path:
            _legacy_files.append((url_db_path, "url_db"))

        for legacy_path, store_name in _legacy_files:
            # Skip if store already exists in DevDB (idempotent)
            if store_name in db.list_stores():
                continue
            if not legacy_path.exists():
                continue
            try:
                with open(legacy_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                db.set_store(store_name, data)
                backup = legacy_path.with_suffix(".json.bak")
                legacy_path.rename(backup)
                migrated = True
                logger.info(
                    "DevDB migration: %s → store '%s' (original backed up as %s)",
                    legacy_path.name, store_name, backup.name,
                )
            except Exception as exc:
                logger.warning(
                    "DevDB migration: failed to migrate %s: %s",
                    legacy_path.name, exc,
                )

        return migrated

    # ── Internal ────────────────────────────────────────────────────────────────

    def _load(self) -> None:
        """Parse + decrypt raw file bytes into self._meta / self._stores."""
        raw = self._path.read_bytes()
        self._parse(raw)

    def _parse(self, raw: bytes) -> None:
        """Parse raw .dsb bytes (shared by _load and from_bytes)."""
        if len(raw) < HEADER_SIZE:
            raise ValueError("DevDB: file is too small to be valid")

        magic, version, flags, _kdf, iterations, salt, nonce = struct.unpack_from(
            HEADER_FMT, raw, 0
        )

        if magic != MAGIC:
            raise ValueError(
                f"DevDB: invalid magic bytes {magic!r} — not a .dsb file"
            )
        if version > VERSION:
            raise ValueError(
                f"DevDB: unsupported format version {version} "
                f"(this build supports up to {VERSION})"
            )

        body      = raw[HEADER_SIZE:]
        encrypted = bool(flags & FLAG_ENCRYPTED)

        if encrypted:
            # AESGCM.encrypt output = ciphertext ‖ tag (tag is last 16 bytes)
            # AESGCM.decrypt expects the same layout
            if not self._password:
                raise ValueError(
                    "DevDB: database is encrypted but no password was supplied"
                )
            key = _derive_key(self._password, salt, iterations)
            aes = AESGCM(key)
            try:
                payload_bytes = aes.decrypt(nonce, body, None)
            except InvalidTag:
                raise ValueError(
                    "DevDB: decryption failed — wrong password or tampered file"
                ) from None
        else:
            # Plain mode: body = BLAKE2b(32) ‖ JSON
            if len(body) < BLAKE2_SIZE:
                raise ValueError("DevDB: plaintext body too short for checksum")
            stored_checksum = body[:BLAKE2_SIZE]
            payload_bytes   = body[BLAKE2_SIZE:]
            if _blake2b(payload_bytes) != stored_checksum:
                raise ValueError(
                    "DevDB: integrity check failed — file may be corrupted or tampered"
                )

        try:
            db_obj = json.loads(payload_bytes.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise ValueError(f"DevDB: payload is not valid JSON: {exc}") from exc

        self._meta   = db_obj.get("meta",   {})
        self._stores = db_obj.get("stores", {})

    def _build_file_bytes(self) -> bytes:
        """Serialise current state to raw .dsb bytes (called inside lock)."""
        db_obj = {
            "meta":   self._meta,
            "stores": self._stores,
        }
        payload_bytes = json.dumps(db_obj, separators=(",", ":"), default=str).encode("utf-8")

        if self._password:
            salt       = os.urandom(SALT_SIZE)
            nonce      = os.urandom(NONCE_SIZE)
            iterations = DEFAULT_ITERATIONS
            key        = _derive_key(self._password, salt, iterations)
            aes        = AESGCM(key)
            # Returns ciphertext ‖ GCM-tag
            body       = aes.encrypt(nonce, payload_bytes, None)
            flags      = FLAG_ENCRYPTED
            kdf_field  = KDF_PBKDF2
        else:
            salt       = bytes(SALT_SIZE)
            nonce      = bytes(NONCE_SIZE)
            iterations = 0
            checksum   = _blake2b(payload_bytes)
            body       = checksum + payload_bytes
            flags      = 0
            kdf_field  = KDF_NONE

        header = struct.pack(
            HEADER_FMT,
            MAGIC, VERSION, flags, kdf_field, iterations, salt, nonce,
        )
        return header + body

    def _write(self) -> None:
        """Atomically write current state to disk (called inside lock)."""
        self._path.parent.mkdir(parents=True, exist_ok=True)
        file_bytes = self._build_file_bytes()

        # Write to a sibling temp file then atomically replace
        fd, tmp_path = tempfile.mkstemp(dir=self._path.parent, suffix=".tmp")
        try:
            os.write(fd, file_bytes)
            os.fsync(fd)
        finally:
            os.close(fd)
        os.replace(tmp_path, self._path)
        logger.debug("DevDB: saved %d bytes to %s", len(file_bytes), self._path)
