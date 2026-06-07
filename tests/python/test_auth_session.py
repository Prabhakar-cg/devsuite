"""Server-side session tokens and auth rate limiting.

Covers SPEC.md §7.2 / §7.4 / §10.2 — only the BLAKE2b hash of a token is stored,
and the auth challenge endpoint is rate limited.
"""
import time

import main


def test_session_validates_and_raw_token_not_stored(client):
    token = "raw-token-abc123"
    main._sessions[main._hash_token(token)] = time.time() + 1000
    r = client.get("/api/db/meta", headers={"Cookie": f"ds_session={token}"})
    assert r.status_code == 200
    # Invariant: the raw token is never a key in the session store — only its hash.
    assert token not in main._sessions
    assert main._hash_token(token) in main._sessions


def test_missing_session_is_rejected(client):
    assert client.get("/api/db/meta").status_code == 401


def test_expired_session_is_rejected(client):
    token = "expired-token"
    main._sessions[main._hash_token(token)] = time.time() - 10
    r = client.get("/api/db/meta", headers={"Cookie": f"ds_session={token}"})
    assert r.status_code == 401
    # Expired entry is purged on access.
    assert main._hash_token(token) not in main._sessions


def test_auth_challenge_is_rate_limited(client):
    statuses = [client.get("/api/auth/challenge").status_code for _ in range(12)]
    assert 429 in statuses
