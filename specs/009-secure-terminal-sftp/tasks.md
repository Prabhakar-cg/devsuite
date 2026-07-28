# Tasks: Secure Terminal & SFTP

**Input**: Design documents from `/specs/009-secure-terminal-sftp/`

**Note**: Retroactive task log. The feature already shipped; every task below is marked `[X]`
and phrased as what was built, reconstructed from `routes/ssh.py`, `routes/pages.py`,
`static/ssh-manager.{html,js,css}`, `static/sftp-browser.{html,js,css}`, and
`tests/python/test_ws_auth.py`. This is not a forward execution plan.

**Tests**: PARTIAL — only the WS session gate (SEC-14) has automated tests; connect/host-key/SFTP
logic is manually validated (see quickstart.md Coverage note).

## Format: `[ID] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Add `asyncssh` to `requirements.txt`; register `routes/ssh.py` router in `main.py`
- [X] T002 Add page routes `GET /ssh` → `ssh-manager.html`, `GET /sftp` → `sftp-browser.html` in `routes/pages.py`

---

## Phase 2: Foundational (shared plumbing)

- [X] T003 Implement WebSocket origin check `_ws_check_origin` in `routes/ssh.py`
- [X] T004 Implement WebSocket session gate `_ws_require_session` (SEC-14 dormant-before-setup carve-out) in `routes/ssh.py`
- [X] T005 Implement known-hosts helpers (`_create_known_hosts`, `_append_known_hosts`, `_ssh_keyscan`, `_ssh_key_fingerprint`, `_ensure_host_key`, `HostKeyApprovalRequired`) in `routes/ssh.py`
- [X] T006 [P] Implement `_build_ssh_connect_kwargs` (password/private-key connect argument builder) in `routes/ssh.py`
- [X] T007 [P] Add `ssh_profiles` to `_ALLOWED_STORES` and wire `GET/POST /api/ssh/profiles` opaque pass-through in `routes/storage.py`
- [X] T008 [P] Client-side encrypt/decrypt helpers (`encryptData`/`decryptData` via CryptoJS) in `static/ssh-manager.js` and `static/sftp-browser.js`

**Checkpoint**: connect infrastructure + profile persistence ready

---

## Phase 3: User Story 1 - Terminal connect (Priority: P1) 🎯 MVP

- [X] T009 [US1] `WS /api/ssh/terminal` handler: config parse, host-key verify, `asyncssh.connect`, `SSH_CONNECT` audit log — `routes/ssh.py`
- [X] T010 [US1] Terminal I/O bridge (`_run_ssh_terminal_session`: stdout→WS, WS→stdin) + resize-escape handling (`_try_resize_ssh_process`) — `routes/ssh.py`
- [X] T011 [US1] Multi-tab terminal UI: tab open/switch/close, per-tab WebSocket + xterm.js instance — `static/ssh-manager.js` (`openTerminalTab`, `renderTabsHeader`, `switchTab`, `closeTab`)
- [X] T012 [P] [US1] Password + private-key auth mode UI in the server-profile modal — `static/ssh-manager.html`, `static/ssh-manager.js` (`openServerModal`)

**Checkpoint**: single/multi-session terminal usable

---

## Phase 4: User Story 2 - Host key verification (Priority: P1)

- [X] T013 [US2] Terminal WS host-key approval round-trip (`_terminal_ws_approve_host`, `_ws_wait_for_host_key_response`, 60 s timeout) — `routes/ssh.py`
- [X] T014 [P] [US2] SFTP REST host-key approval via HTTP 409 + `approved_fingerprint` retry (`_make_sftp_approve`) — `routes/ssh.py`
- [X] T015 [P] [US2] Dashboard WS host-key approval with fingerprint auto-approve shortcut (`_dashboard_ws_approve_host`) — `routes/ssh.py`

**Checkpoint**: no host is trusted without explicit fingerprint approval, on any call path

---

## Phase 5: User Story 3 - Encrypted profile persistence (Priority: P1)

- [X] T016 [US3] Profile save/load with Master Password encryption (`_applyMasterKey`, `loadProfilesBlob`, `saveProfilesBlob`) — `static/ssh-manager.js`
- [X] T017 [US3] Wrong-password / cross-password migration panel (`_showMigrationPanel`) — `static/ssh-manager.js`
- [X] T018 [P] [US3] No-Master-Password fallback (`plain_profiles`) with warning toast — `static/ssh-manager.js`

**Checkpoint**: profiles never stored server-decryptable; graceful no-password path preserved

---

## Phase 6: User Story 4 - SFTP browse/transfer (Priority: P2)

- [X] T019 [US4] `POST /api/sftp/list` (dirs-first, case-insensitive sort) — `routes/ssh.py`
- [X] T020 [P] [US4] `POST /api/sftp/download` (64 KB chunked `StreamingResponse`) — `routes/ssh.py`
- [X] T021 [P] [US4] `POST /api/sftp/upload` (multipart form) — `routes/ssh.py`
- [X] T022 [US4] SFTP grid view (file-type icons, breadcrumb nav, up/refresh/disconnect) — `static/ssh-manager.js` (sub-tab), `static/sftp-browser.js` (standalone), shared `ssh_profiles` store

**Checkpoint**: file browsing/transfer usable from both `/ssh` and standalone `/sftp`

---

## Phase 7: User Story 5 - Local terminal & WSL (Priority: P3)

- [X] T023 [US5] `WS /api/local/terminal`: PTY fork, `_PTY_AVAILABLE` platform gate, distro exec (`_exec_pty_child`) — `routes/ssh.py`
- [X] T024 [P] [US5] Distro-name validation before `os.execvp` (`_parse_distro_from_config`, `_DISTRO_NAME_RE`) — `routes/ssh.py`
- [X] T025 [P] [US5] `GET /api/wsl/discover` (parses `wsl.exe -l -q`, empty-list-on-failure) — `routes/ssh.py`

**Checkpoint**: local shell + WSL distro access available where the platform supports it

---

## Phase 8: User Story 6 - Live dashboard (Priority: P3)

- [X] T026 [US6] `WS /api/ssh/dashboard` + `_run_metrics_loop` (2 s poll of combined `/proc`+`df` script) — `routes/ssh.py`
- [X] T027 [P] [US6] Metrics parsers (`_parse_cpu_section`, `_parse_mem_section`, `_parse_disk_section`, `_parse_ssh_metrics`) — `routes/ssh.py`
- [X] T028 [US6] Dashboard gauge/chart rendering (`updateDashboardGauges`, `upsertChart`) — `static/ssh-manager.js`

**Checkpoint**: live remote metrics visible per connected host

---

## Phase 9: Security hardening

- [X] T029 Add `tests/python/test_ws_auth.py` covering the SEC-14 gate for all three WS endpoint types (via the dashboard endpoint) — pre-setup allowed, post-setup session-required, valid-session accepted

---

## Phase 10: Retroactive Documentation

- [X] T030 Author `specs/009-secure-terminal-sftp/{spec,plan,research,data-model,quickstart,tasks}.md` and `contracts/http-api.md` (2026-07-28), grounded in `routes/ssh.py`, `routes/pages.py`, `static/ssh-manager.js`, `static/sftp-browser.js`, and `tests/python/test_ws_auth.py` — no code changes made

---

## Dependencies & Execution Order (as originally built)

- Phase 2 (foundational) precedes all user stories — the connect/host-key/session-gate/profile
  helpers are shared by every story.
- US1 (terminal) and US2 (host-key verification) shipped together — a terminal is unusable
  without host-key trust.
- US3 (encrypted persistence) is independent of US1/US2 mechanically but ships alongside them
  since profiles are how a terminal connection gets its credentials in practice.
- US4 (SFTP) reuses US2's host-key infrastructure and the US3 profile store.
- US5 (local terminal) reuses only the WS gate plumbing from Phase 2 — no SSH/host-key
  dependency.
- US6 (dashboard) reuses the same connect+host-key path as US1.
