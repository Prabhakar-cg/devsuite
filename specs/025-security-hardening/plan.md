# Implementation Plan: Security Hardening (025)

**Spec**: [spec.md](./spec.md)

## Approach

All fixes are small, local, and behavior-preserving for normal localhost use.

| Req | Change | Files |
|---|---|---|
| FR-001/002 | `deps.py`: allowlist helpers (`allowed_hosts()`, `host_allowed()`, `origin_allowed()`), env `DEVSUITE_ALLOWED_HOSTS`. `main.py`: outermost `host_and_origin_guard` HTTP middleware (Host → 400, mutating Origin → 403). `routes/ssh.py::_ws_check_origin`: use `origin_allowed`; also reject disallowed Host. | `deps.py`, `main.py`, `routes/ssh.py` |
| FR-003 | `deps.require_session_if_configured(request)`; call from the 4 endpoints. | `deps.py`, `routes/ssh.py` |
| FR-004 | `routes/proxy.py`: pure `ip_is_forbidden(ip)` (mapped/unspecified aware), and `_GuardedHTTPConnection/_GuardedHTTPSConnection` that verify `sock.getpeername()` right after connect; handlers installed in the opener (redirects included). | `routes/proxy.py` |
| FR-005 | `main.py` security-headers middleware. | `main.py` |
| FR-006 | `routes/convert.py::_check_archive_limits` for docx/xlsx. | `routes/convert.py` |
| FR-007 | `deps.py` session eviction/cap; `routes/auth.py` `AUTH_FAIL` audit + setup rate limit. | `deps.py`, `routes/auth.py` |

Tests: new `tests/python/test_security_hardening.py`; `conftest.py` sets `DEVSUITE_ALLOWED_HOSTS=testserver` before importing the app (TestClient uses Host `testserver`).

## Constitution Check

I Spec first ✔ (this folder + SPEC §7.9). II Offline ✔ (no new network). III Vanilla/single store ✔. IV Encryption boundary ✔ (untouched; Kenc/Kauth unchanged). V DOM/CSP ✔ (CSP only tightened; no new inline script). VI Security paths tested ✔ (new test file). VII Version: bump 0.13.0 → 0.14.0 at ship.
