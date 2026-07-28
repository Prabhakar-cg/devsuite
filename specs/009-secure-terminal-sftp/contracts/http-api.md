# Contract: HTTP/WebSocket API — Secure Terminal & SFTP

As-built contract, verified against `routes/ssh.py`, `routes/pages.py`, and `routes/storage.py`
(the latter for the `ssh_profiles` pass-through referenced but not owned by this module).

## Page routes

| Method | Route | Serves |
|---|---|---|
| `GET` | `/ssh` | `ssh-manager.html` (Terminal + SFTP sub-tabs) |
| `GET` | `/sftp` | `sftp-browser.html` (standalone SFTP deep link) |

## WebSocket endpoints (`routes/ssh.py`)

All three enforce, in order, before `websocket.accept()`:
1. `_ws_check_origin` — `Origin` header must equal an entry in `_ALLOWED_ORIGINS` or
   `http(s)://<Host-header-value>`; failure closes with code `1008`.
2. `_ws_require_session` — if `is_auth_configured()` is true, a valid `ds_session` cookie is
   required (SEC-14); failure closes with code `1008`, reason `"Authentication required"`.
   If no Master Password has ever been configured, this check passes unconditionally.

### `WS /api/ssh/terminal`

Client sends one JSON config message after connect:
```json
{"host": "...", "port": 22, "username": "...", "password": "...", "private_key": "..."}
```
Server flow: send `"Verifying host key..."` text → `_ensure_host_key` (may emit
`host_key_approval` and await `host_key_response`, 60 s timeout) → `asyncssh.connect(**kwargs)`
→ audit-log `SSH_CONNECT` (host, port, user) → spawn `conn.create_process(term_type='xterm-256color')`
and bridge stdout→WS text frames, WS text frames→stdin. A frame beginning `\x1b[resize;COLS;ROWSm`
is interpreted as a resize (`process.change_terminal_size`) instead of being written to stdin.
Any exception is sent back as a `"\r\nError: ...\r\n"` text frame before closing.

### `WS /api/ssh/dashboard`

Same config message shape as the terminal endpoint, plus optional `approved_fingerprint`. On
success sends `{"status": "connected"}`, then a `DashboardMetricsSample` JSON object
(data-model.md) roughly every 2 seconds until disconnect or a hard error (`{"error": "..."}`
then close).

### `WS /api/local/terminal`

No SSH involved. Client sends one JSON config message: `{"distro": "<name>"|null}`. If
`_PTY_AVAILABLE` is false, the socket is closed immediately (code `1008`) before reading any
config. Otherwise a PTY is forked (`pty.fork()`); the child execs the named WSL distro (validated
against `_DISTRO_NAME_RE`) or falls back to `$SHELL`/`/bin/bash`. Same resize-escape convention
as the SSH terminal, applied via `fcntl.ioctl(fd, termios.TIOCSWINSZ, ...)`.

## REST endpoints (`routes/ssh.py`)

### `POST /api/sftp/list`

Request body (`SFTPRequest`): `{host, port=22, username, password?, private_key?, path=".", approved_fingerprint?}`.

Response `200`: `{"files": [{"name", "is_dir", "size"}], "cwd": "<path>"}` (dirs first, then
case-insensitive name order).

Response `409`: `{"error": "host_key_approval_required", "host", "port", "fingerprint"}` — host
unknown and no matching `approved_fingerprint` supplied.

Response `500`: generic SFTP failure message (`_ERR_SFTP_FAILED`) — internal errors are not leaked.

### `POST /api/sftp/download`

Request body (`SFTPDownloadRequest`): same shape as list, plus required `path` (file, not dir).

Response `200`: `StreamingResponse`, `Content-Type: application/octet-stream`,
`Content-Disposition: attachment; filename*=UTF-8''<urlencoded-name>`, body streamed in 64 KB
chunks. Same `409`/`500` shapes as list.

### `POST /api/sftp/upload`

`multipart/form-data` fields: `host`, `username`, `remote_path`, `file` (required); `port=22`,
`password`, `private_key`, `approved_fingerprint` (optional).

Response `200`: `{"success": true, "path": "<remote_path>/<filename>"}`. Same `409`/`500` shapes.

### `GET /api/wsl/discover`

No auth gate (idempotent local enumeration only). Response `200`: `{"wsl_instances": [<name>, ...]}`
— always `[]` on any failure (subprocess error, non-Windows host, no WSL installed), never an
error status.

## Related endpoints owned elsewhere

- `GET /api/ssh/profiles` / `POST /api/ssh/profiles` — opaque `ssh_profiles` blob pass-through,
  implemented in `routes/storage.py`, documented in SPEC.md §5.4. Included here because this
  tool is its only consumer.

## Compatibility rules

- Resize-escape convention (`\x1b[resize;COLS;ROWSm`) is shared verbatim between the SSH
  terminal and local-terminal WebSocket paths — a frontend change to one must stay in sync with
  the other's regex (`^\x1b\[resize;(\d+);(\d+)m$` in `_apply_terminal_resize`).
- `known_hosts` approval state is shared across all three connect paths (terminal, dashboard,
  SFTP) via the same on-disk file — approving a host from one flow satisfies the others too.
