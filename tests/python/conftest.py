"""Shared pytest fixtures for the DevSuite backend test suite.

Isolates every app-level test against a throwaway DevDB so the suite never
reads or writes the real ~/.devsuite/devdb.dsb.
"""
import sys
from pathlib import Path

import pytest

# Make the project root importable regardless of how pytest is invoked.
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import deps  # noqa: E402
import main  # noqa: E402
from devdb import DevDB  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture
def isolated_db(tmp_path, monkeypatch):
    """Repoint the app's module-level DevDB (and paths) at a temp directory."""
    db_path = tmp_path / "test.dsb"
    db = DevDB(db_path)
    db.open()
    # Patch deps module so all route handlers (which access deps._db) see the
    # isolated database.  Also patch main for test bodies that read main._db.
    monkeypatch.setattr(deps, "_db", db)
    monkeypatch.setattr(deps, "_DEVSUITE_DIR", tmp_path)
    monkeypatch.setattr(deps, "_AUDIT_LOG_PATH", tmp_path / "audit.log")
    monkeypatch.setattr(main, "_db", db)
    monkeypatch.setattr(main, "_DB_PATH", db_path)
    monkeypatch.setattr(main, "_DEVSUITE_DIR", tmp_path)
    monkeypatch.setattr(main, "_AUDIT_LOG_PATH", tmp_path / "audit.log")
    main._sessions.clear()
    # Reset the in-memory rate-limiter counters so each test starts from zero.
    # Without this, rate-limit stress tests contaminate subsequent tests that
    # call the same endpoints.
    try:
        main.limiter._storage.reset()
    except Exception:  # pylint: disable=broad-exception-caught
        pass
    yield db
    main._sessions.clear()


@pytest.fixture
def client(isolated_db):
    """TestClient without lifespan (so it can't reopen the real DB)."""
    return TestClient(main.app)
