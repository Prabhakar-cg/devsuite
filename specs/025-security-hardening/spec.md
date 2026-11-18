# Feature Specification: Security Hardening (Independent Assessment, 2026-11-17)

**Created**: 2026-11-17 | **Status**: Draft | **Branch**: spec dir only; work on `develop`

**Input**: Independent third-party-style security review of the backend and frontend (code review of `main.py`, `deps.py`, `routes/*`, `devdb.py`; `pip-audit`; `bandit`; frontend DOM-sink review).

## Assessment Summary

| Area | Result |
|---|---|
| Dependency CVEs (`pip-audit -r requirements.txt`) | **0 known vulnerabilities** |
| Static analysis (`bandit`, all backend) | **0 findings** (High/Med/Low = 0) |
| Frontend DOM sinks | Safe: `innerHTML` only with constants/ints or DOMPurify-sanitised markdown |
| Crypto design (client-side AES-GCM, domain-separated Kenc/Kauth) | Sound; KDF cost is below current guidance (see Out of Scope) |
| Findings requiring change | **7** (below) |

### Findings

- **SEC-15 (High) — DNS-rebinding exposure.** No `Host` header validation. A hostile web page that rebinds its DNS to 127.0.0.1 becomes *same-origin* with the app, so CORS and the double-submit CSRF cookie (which the attacker's origin receives for itself) both pass. Reachable: the unauthenticated tier, `/api/proxy` (LAN SSRF), and — before a master password exists — the **local PTY terminal**.
- **SEC-16 (High) — WebSocket origin check trusts the attacker-controlled `Host` header** (`origin == http://<Host>`), which defeats the check under rebinding. HTTP mutating requests perform no Origin check at all.
- **SEC-17 (High) — SFTP/WSL endpoints are not session-gated.** `/api/sftp/list|download|upload` and `/api/wsl/discover` act as an SSH/SFTP client for any caller even after a master password is configured (the three WebSockets are gated by SEC-14; these HTTP endpoints were missed).
- **SEC-18 (Medium) — Proxy SSRF filter has gaps.** Resolve-then-connect is racy (DNS rebinding between check and connect); IPv4-mapped IPv6 (`::ffff:127.0.0.1`) and the unspecified address (`0.0.0.0`/`::`, which reaches localhost on Linux) are not rejected.
- **SEC-19 (Medium) — Missing browser hardening headers.** CSP lacks `frame-ancestors`, `base-uri`, `object-src`, `form-action`; no `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`; API responses (encrypted vault/notes blobs, DB metadata) are cacheable.
- **SEC-20 (Medium) — Archive bombs.** `.docx`/`.xlsx` conversion hands user-supplied ZIPs to parsers with no uncompressed-size/ratio limit (20 MB upload cap only bounds the compressed size).
- **SEC-21 (Low) — Session/audit hygiene.** Expired sessions are only evicted on lookup (unbounded growth); failed unlock attempts are not audit-logged; `/api/auth/setup` is not rate limited.

## Requirements

- **FR-001** (SEC-15): Every HTTP and WebSocket request MUST be rejected unless its `Host` hostname is in the allowlist (`localhost`, `127.0.0.1`, `::1`, plus `DEVSUITE_ALLOWED_HOSTS`, comma-separated, for users who deliberately bind another interface). Rejected HTTP requests get `400`.
- **FR-002** (SEC-16): Mutating HTTP requests (POST/PUT/PATCH/DELETE) carrying an `Origin` header MUST have an allowlisted origin hostname, else `403`. WebSocket origin validation MUST use the same allowlist and MUST NOT derive trust from the `Host` header.
- **FR-003** (SEC-17): `/api/sftp/list`, `/api/sftp/download`, `/api/sftp/upload` and `/api/wsl/discover` MUST require a valid session whenever a master password is configured (same dormant-until-setup carve-out as SEC-14).
- **FR-004** (SEC-18): The proxy MUST validate the connected peer address at connect time (before sending any request bytes) for the initial request and every redirect, and MUST reject loopback, link-local, multicast, reserved, unspecified, and IPv4-mapped forms of those.
- **FR-005** (SEC-19): Document responses MUST add `frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'` to the CSP (sandbox-worker policy unchanged); all responses add `Permissions-Policy` (camera/mic/geolocation/payment/usb denied), `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`; `/api/*` responses add `Cache-Control: no-store`.
- **FR-006** (SEC-20): `.docx`/`.xlsx` conversion MUST reject archives whose total uncompressed size exceeds a cap (default 200 MB) or whose entry count exceeds a cap, with HTTP 413, before parsing.
- **FR-007** (SEC-21): The session store MUST evict expired entries when issuing a session and cap its size; failed session verification MUST write an `AUTH_FAIL` audit event (ip only, never the key); `/api/auth/setup` MUST be rate limited.
- **FR-008**: Each fix lands with tests (Constitution Art. VI); `SPEC.md` §5/§7/§10 updated in the same commit series; no behavior change for normal localhost use.

## Success Criteria

- **SC-001**: A request with a foreign `Host` (e.g. `evil.example`) returns 400 on every route; a cross-origin mutating request returns 403; both covered by tests.
- **SC-002**: SFTP/WSL endpoints return 401 without a session once a master password exists, and still work before setup.
- **SC-003**: A hostname resolving to 127.0.0.1, 0.0.0.0, `::ffff:127.0.0.1` or link-local is refused by the proxy even if the pre-check was bypassed (connect-time guard tested).
- **SC-004**: Existing suites still pass; `pip-audit` and `bandit` remain clean.

## Out of Scope / Recommended Follow-ups

- **KDF cost**: master-password PBKDF2-SHA256 at 310,000 iterations is below the current 600,000 recommendation, and the unauthenticated `/api/auth/challenge` (5/min) enables offline guessing. Raising it (or Argon2id, SEC-13) needs a vault re-encryption migration and an end-to-end crypto test harness — tracked in BACKLOG, not changed blindly here.
- **CSP `unsafe-inline`** (SEC-11) needs the remaining inline scripts moved first.
- **Localhost HTTPS** (SEC-12).
