# Phase 1 Data Model: Secure Terminal & SFTP

No relational schema — persistence is a single opaque DevDB store plus system files. Concrete
shapes below are as observed in `routes/ssh.py`, `routes/storage.py` (pass-through), and
`static/ssh-manager.js`.

## Persisted entities

### `ssh_profiles` DevDB store *(SPEC.md §6.4)*

Opaque, server-never-decrypts blob. Two representations depending on whether a Master Password
is configured:

| Key | Type | Notes |
|---|---|---|
| `encrypted_blob` | `str` | `CryptoJS.AES.encrypt(JSON.stringify(profiles), masterPassword)` ciphertext string — present when a Master Password exists |
| `plain_profiles` | `str` (JSON) | Unencrypted fallback JSON when no Master Password has ever been configured (R5) |

**Decrypted client-side shape** (`SshProfile`, not persisted directly — only its encrypted form
is):

| Field | Type | Notes |
|---|---|---|
| `id` | `str` (uuid v4) | `uuidv4()` generated client-side |
| `name` | `str` | Display label |
| `host` | `str` | |
| `port` | `int` | default 22 |
| `username` | `str` | |
| `password` | `str \| null` | mutually exclusive-ish with `private_key` |
| `private_key` | `str \| null` | PEM text |
| `group` | `str \| null` | sidebar grouping folder |

### `~/.ssh/known_hosts` *(system file, not DevDB)*

Standard OpenSSH known-hosts format; one line per pinned `host`/`[host]:port` entry. Created with
mode `0600` on first use (`_create_known_hosts`); appended to via `_append_known_hosts` only
after explicit user approval.

## Runtime (non-persisted) entities

### `TerminalTab` *(client-side, `static/ssh-manager.js`)*

| Field | Notes |
|---|---|
| tab id | unique per open session |
| associated profile | which `SshProfile` this tab connects with |
| WebSocket | `/api/ssh/terminal` connection for this tab |
| xterm.js instance | independent rendering surface per tab |

### `DashboardMetricsSample` *(pushed over `/api/ssh/dashboard`, `routes/ssh.py: _parse_ssh_metrics`)*

| Field | Type | Notes |
|---|---|---|
| `type` | `"metrics"` | |
| `cpu` | `float` (0–100) | delta-computed from consecutive `/proc/stat` reads |
| `ram_pct` / `ram_total_mb` / `ram_used_mb` | `float` | from `/proc/meminfo` |
| `swap_pct` / `swap_total_mb` / `swap_used_mb` | `float` | from `/proc/meminfo` |
| `disks` | `list[{mount, total_mb, used_mb, pct}]` | from `df -m`, pseudo-filesystems filtered out |
| `uptime` | `float` seconds | from `/proc/uptime` |

### `SftpDirectoryEntry` *(returned by `POST /api/sftp/list`)*

| Field | Type | Notes |
|---|---|---|
| `name` | `str` | |
| `is_dir` | `bool` | derived from `stat.S_ISDIR(attrs.permissions)` |
| `size` | `int` | bytes |

Response envelope: `{files: SftpDirectoryEntry[], cwd: str}`.

## Error / approval shapes

### Host-key approval (WebSocket, sent to client)

```json
{"type": "host_key_approval", "host": "...", "port": 22, "fingerprint": "SHA256:..."}
```

Expected reply: `{"type": "host_key_response", "approve": true|false}`.

### Host-key approval required (SFTP REST, HTTP 409 body)

```json
{"error": "host_key_approval_required", "host": "...", "port": 22, "fingerprint": "SHA256:..."}
```

## State/derivation rules

- A profile's persisted form is *always* the encrypted (or plain-fallback) blob — the decrypted
  `SshProfile[]` array exists only in browser memory after `_applyMasterKey`.
- `known_hosts` membership is checked (`ssh-keygen -F`) before every connection attempt on every
  call site; approval only happens once per `host:port`, after which all three flows (terminal,
  dashboard, SFTP) skip the prompt.
- Dashboard `cpu` is stateful across polls (`prev_idle`/`prev_total` carried between iterations
  of `_run_metrics_loop`) — a single poll in isolation cannot recompute it.
