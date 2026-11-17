# Tasks: Security Hardening (025)

- [x] T001 SPEC §7.9 "Network-boundary hardening" + §7.4/§7.6 updates; BACKLOG SEC-15..21 rows
- [x] T002 deps.py allowlist helpers + `require_session_if_configured` + session eviction/cap
- [x] T003 main.py host/origin guard + hardened headers
- [x] T004 routes/ssh.py WS origin via allowlist; session gate on SFTP/WSL endpoints
- [x] T005 routes/proxy.py connect-time peer guard + IP classifier
- [x] T006 routes/convert.py archive limits
- [x] T007 routes/auth.py AUTH_FAIL audit + setup rate limit
- [x] T008 conftest + tests/python/test_security_hardening.py; run all suites; pip-audit + bandit re-run
- [x] T009 CI: add pip-audit step (BACKLOG SEC-1)
- [x] T010 CHANGELOG 0.14.0 + version bump (4 places); propose commit
