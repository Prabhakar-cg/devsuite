# Quickstart & Validation: Secure Terminal & SFTP

Manual validation steps (no dedicated automated suite exists for this tool's connect/transfer
logic — see Coverage note below).

## Setup

```bash
pytest tests/python/test_ws_auth.py -v   # only automated coverage for this tool
```

Start the app per the repo's normal `start.sh`/`start.ps1` (not run here — CLAUDE.md: don't
start the server without being asked).

## Functional validation (maps to spec user stories)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| US1 | Terminal connect | Open `/ssh`, add a profile for a reachable SSH host (password auth), open a terminal tab | Live shell output streams in; typed commands execute remotely |
| US1 | Multiple tabs | Open two profiles as separate tabs | Each has its own xterm.js instance and WebSocket; input/output don't cross-talk |
| US2 | Host key approval | Connect to a host never seen before (fresh `known_hosts`) | A fingerprint approval prompt appears before the shell starts; approving proceeds, rejecting aborts |
| US2 | Re-connect, no re-prompt | Reconnect to the same host | No approval prompt (already pinned) |
| US3 | Encrypted profile persistence | With a Master Password set, save a profile, then `GET /api/ssh/profiles` directly | Response body is ciphertext, not readable JSON |
| US3 | No-password fallback | With no Master Password ever configured, save a profile | Saved via `plain_profiles`; a warning toast is shown |
| US4 | SFTP browse/download/upload | Open the SFTP sub-tab (or `/sftp`), navigate a directory, download a file, upload a file | Grid lists entries dirs-first; download matches remote bytes; uploaded file appears on next listing |
| US5 | Local terminal | On Linux/macOS, open a Local Terminal tab | Shell prompt appears with no host/credential step |
| US5 | WSL discovery | On a WSL-capable Windows host, request `GET /api/wsl/discover` | Installed distro names are listed |
| US6 | Dashboard metrics | Open the dashboard for a connected host | CPU/RAM/swap/disk/uptime values update roughly every 2 s and track real remote state |

## Deterministic validation (automated)

```bash
pytest tests/python/test_ws_auth.py -v
```

Covers, via the dashboard endpoint (cheapest gate-only target — closes/accepts without forking a
shell or opening an SSH connection):
- `test_ws_allowed_before_setup` — no Master Password configured → socket accepted.
- `test_ws_rejected_without_session_when_configured` — Master Password configured, no session →
  `WebSocketDisconnect` (gate closes with 1008).
- `test_ws_allowed_with_valid_session` — Master Password configured, valid `ds_session` → socket
  accepted.

## Coverage note

There is **no automated coverage** today for: host-key verification/approval flow
(`_ensure_host_key` and its three callback variants), SSH terminal I/O bridging, SFTP
list/download/upload, WSL discovery parsing, or the dashboard metrics parser
(`_parse_cpu_section`/`_parse_mem_section`/`_parse_disk_section`). All of these were validated
manually against the table above at the time of the original implementation. This is a
documented gap, not a claim of test coverage that doesn't exist (CLAUDE.md rule 2).

## Acceptance gates

- The WS session gate (SEC-14) test suite stays green — it is the one security-critical path
  this tool owns per SPEC.md §10.2.
- Manual golden-path table above passes before claiming a change to this tool "verified."
