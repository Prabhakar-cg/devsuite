# Feature Specification: Secure Terminal & SFTP

**Feature Branch**: `009-secure-terminal-sftp`

**Created**: 2026-07-28

**Status**: Implemented (retroactive spec)

**Input**: Retroactive spec-kit conversion of the already-shipped Secure Terminal & SFTP tool
(`/ssh`, `/sftp`) documented at `specs/SPEC.md` §4.8, §5.1, §5.8, §6.4, §7.8 (SEC-14). Authored
from source inspection of `routes/ssh.py`, `routes/pages.py`, `static/ssh-manager.{html,js,css}`,
`static/sftp-browser.{html,js,css}` — not a forward-looking plan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect and run commands in a remote SSH terminal (Priority: P1)

A developer opens `/ssh`, picks or creates a saved server profile (host, port, username,
password or private key), and opens an interactive terminal session rendered with xterm.js.
Multiple servers can be open at once, each in its own tab.

**Why this priority**: This is the tool's core value — a terminal client without leaving the
browser or installing a separate SSH app.

**Independent Test**: Connect to a reachable SSH host with a password profile; type a command;
confirm output streams back live; open a second tab to a different host and confirm both
sessions run independently.

**Acceptance Scenarios**:

1. **Given** a saved profile with valid password credentials, **When** the user opens a
   terminal tab for it, **Then** an SSH connection is established and the remote shell's output
   streams into an xterm.js instance in real time.
2. **Given** a profile configured with a PEM private key instead of a password, **When** the
   user connects, **Then** `asyncssh.import_private_key` is used for authentication instead of
   a password.
3. **Given** two profiles, **When** the user opens both as tabs, **Then** each runs in its own
   `WebSocket` (`/api/ssh/terminal`) and its own xterm.js instance, independently resizable.
4. **Given** an open terminal tab, **When** the user resizes the browser/tab, **Then** a resize
   escape sequence (`\x1b[resize;COLS;ROWSm`) is sent over the socket and the remote PTY's
   window size is updated via `process.change_terminal_size`.

---

### User Story 2 - First-contact host key verification (Priority: P1)

The first time a user connects to a given host:port, DevSuite has no record of its SSH host key.
The user must be shown the key's fingerprint and explicitly approve it before any credentials are
sent, matching the trust-on-first-use model of a normal SSH client.

**Why this priority**: Skipping host-key verification would silently accept MITM'd connections;
this is a security-load-bearing behavior, not a convenience feature.

**Independent Test**: Connect to a host never seen before; confirm a `host_key_approval` message
(with SHA-256/MD5 fingerprint) arrives before the connection proceeds, and that a
`host_key_response` reply is required before the shell starts. Reconnecting to the same host
afterwards must not re-prompt.

**Acceptance Scenarios**:

1. **Given** a host with no entry in `~/.ssh/known_hosts`, **When** the user connects (terminal,
   dashboard, or SFTP), **Then** the server runs `ssh-keyscan` to fetch the key, `ssh-keygen -l`
   to compute its fingerprint, and surfaces `{type: "host_key_approval", host, port,
   fingerprint}` to the client before authenticating.
2. **Given** the terminal/dashboard WebSocket flow, **When** the approval prompt is shown,
   **Then** the server waits up to 60 seconds for `{type: "host_key_response", approve: bool}`;
   a `false`/timeout aborts the connection without appending to `known_hosts`.
3. **Given** the SFTP REST flow (no persistent socket), **When** the host is unknown and no
   `approved_fingerprint` was supplied, **Then** the request fails with HTTP 409
   `host_key_approval_required` carrying the fingerprint, and the client is expected to retry
   with `approved_fingerprint` set once the user confirms.
4. **Given** a host already pinned in `known_hosts` (checked via `ssh-keygen -F`), **When** the
   user reconnects, **Then** no approval prompt occurs and the connection proceeds directly.

---

### User Story 3 - Encrypted, persisted server profiles (Priority: P1)

A user's SSH server profiles (host, port, username, saved password or key) are saved so they
don't need to be re-entered every session, but the credentials must not be readable by anyone
without the DevSuite Master Password.

**Why this priority**: Persisting plaintext SSH credentials server-side would be a critical data
exposure; this is what makes the "always-ask-nothing-plaintext" model viable.

**Independent Test**: Save a profile with a password; inspect the `ssh_profiles` DevDB store via
`GET /api/ssh/profiles` and confirm the payload is opaque ciphertext, not JSON containing the
password; reload the page, unlock with the correct Master Password, and confirm the profile
list and its credentials are recovered.

**Acceptance Scenarios**:

1. **Given** the user has a DevSuite Master Password configured, **When** they save an SSH
   profile, **Then** the profile list is serialized to JSON and encrypted client-side with
   `CryptoJS.AES.encrypt(json, masterPassword)` before `POST /api/ssh/profiles`.
2. **Given** a saved encrypted blob, **When** `GET /api/ssh/profiles` is called, **Then** the
   backend returns the ciphertext unchanged (`encrypted_blob`) — it is never decrypted
   server-side.
3. **Given** the user unlocks with the correct Master Password, **When** the page loads,
   **Then** `decryptData(blob, pwd)` recovers the profile list; an incorrect password (or a blob
   encrypted under a different, older password) triggers a one-time migration panel rather than
   silently failing.
4. **Given** no Master Password has ever been configured, **When** the user saves a profile,
   **Then** the app falls back to storing the profile list unencrypted (`plain_profiles`) and
   shows a warning toast — this preserves usability for the no-password/local-only flow.

---

### User Story 4 - Browse and transfer files over SFTP (Priority: P2)

A developer inspects and moves files on a remote host: navigate directories in a grid view,
download a file, or upload a local file to a remote path — either from within the SSH tool's
SFTP sub-tab or from the standalone `/sftp` deep link.

**Why this priority**: File transfer is the second half of "remote server access" after the
terminal; it depends on the same profile/host-key infrastructure as US1–US3.

**Independent Test**: Connect an SFTP session to a reachable host; list a directory; download a
file and confirm its bytes match the remote file; upload a local file and confirm it appears on
next listing.

**Acceptance Scenarios**:

1. **Given** a connected SFTP session, **When** the user opens a directory, **Then**
   `POST /api/sftp/list` returns entries (name, is_dir, size) sorted directories-first then
   case-insensitively by name, and the grid view renders file-type icons per entry.
2. **Given** a file selected in the grid, **When** the user downloads it, **Then**
   `POST /api/sftp/download` streams the file in 64 KB chunks with a
   `Content-Disposition: attachment` header carrying a URL-encoded filename.
3. **Given** a local file picked for upload, **When** the user uploads it, **Then**
   `POST /api/sftp/upload` (multipart form) writes it to `remote_path/filename` and the next
   directory listing shows it.
4. **Given** the user navigates via `/sftp` directly (not through `/ssh`), **Then** the same
   profile store (`ssh_profiles`) and SFTP endpoints are used — the standalone browser is not a
   separate data silo.

---

### User Story 5 - Local terminal and WSL distro access (Priority: P3)

On Linux/macOS, a user opens a local shell (their own machine, not a remote SSH host) directly
in the browser; on Windows-with-WSL, DevSuite discovers installed WSL distributions and can open
a shell inside a chosen one.

**Why this priority**: Convenience feature — reuses the terminal UI for local work — but is not
required for the tool's primary remote-access value, hence P3.

**Independent Test**: On a supported platform, open the "Local Terminal" tab and confirm a shell
prompt appears without any host/credentials step; on a WSL-capable host, confirm
`GET /api/wsl/discover` lists installed distros and connecting to one spawns a shell inside it.

**Acceptance Scenarios**:

1. **Given** a Linux/macOS host, **When** the user opens a local terminal tab, **Then**
   `/api/local/terminal` forks a PTY (`pty.fork()`) running `$SHELL` (default `/bin/bash`) with
   no SSH handshake or credentials involved.
2. **Given** Windows is not supported for this feature, **When** `_PTY_AVAILABLE` is false,
   **Then** the socket is closed (code 1008, "Local terminal is not supported on this
   platform") instead of attempting a fork.
3. **Given** WSL distributions are installed, **When** the client requests `/api/wsl/discover`,
   **Then** the server runs `wsl.exe -l -q` and returns the parsed distro names (empty list on
   any failure, never an error).
4. **Given** a distro name is supplied in the local-terminal config, **When** it is validated
   against `_DISTRO_NAME_RE`, **Then** an invalid name is rejected (treated as "no distro" /
   default shell) rather than passed unsanitized to `os.execvp`.
5. **Given** a fresh environment with no WSL distros installed (or a non-Windows host), **When**
   the sidebar loads, **Then** it shows no "WSL Environments" group at all — "Local Terminal" is
   listed under its own "Local" group instead, since it is a plain local shell, not a WSL
   feature, and is always available regardless of WSL.
6. **Given** the sidebar, **When** the user clicks the "Detect WSL" control next to "User
   sessions", **Then** `GET /api/wsl/discover` is re-run on demand (not only once at page load)
   and a toast reports how many distros were found, so a distro installed after the page loaded
   becomes reachable without a full reload.

---

### User Story 6 - Live SSH server metrics dashboard (Priority: P3)

While connected, a user can see a lightweight live dashboard (CPU, RAM, swap, disk, uptime) for
the remote host, polled without installing any agent on the remote side.

**Why this priority**: A nice-to-have observability layer on top of the same connection
infrastructure; not required for core terminal/SFTP value.

**Independent Test**: Open the dashboard for a connected host; confirm metrics update
approximately every 2 seconds and reflect real `/proc` values on the remote host.

**Acceptance Scenarios**:

1. **Given** an established SSH connection, **When** the dashboard WebSocket
   (`/api/ssh/dashboard`) is open, **Then** the server runs a single combined remote script
   (`/proc/stat`, `/proc/meminfo`, `df -m`, `/proc/uptime`) every 2 seconds and pushes a parsed
   JSON payload (`cpu`, `ram_pct`, `swap_pct`, `disks[]`, `uptime`).
2. **Given** repeated polls, **When** CPU usage is computed, **Then** it is derived from the
   delta between consecutive `/proc/stat` samples (not a single instantaneous reading).
3. **Given** a poll that times out or errors, **When** it is transient, **Then** the loop
   continues on the next 2-second tick rather than tearing down the socket; only a hard failure
   closes it with an error payload.

---

### Edge Cases

- **Origin mismatch**: any of the three WebSocket endpoints reject a request whose `Origin`
  header doesn't match `_ALLOWED_ORIGINS` or `http(s)://<Host>` — closed with code 1008 before
  any session/host-key logic runs.
- **Host key rejected by the user**: the connection is aborted with a `RuntimeError` naming the
  fingerprint; nothing is appended to `known_hosts`.
- **`ssh-keyscan` unreachable/timeout**: raises a `RuntimeError` surfaced to the client as a
  terminal error line or dashboard `error` payload — never a raw traceback.
- **SFTP host-key approval loop**: because SFTP is stateless REST (no open socket to prompt
  over), an unknown host always yields HTTP 409 first; the client must re-issue the same request
  with `approved_fingerprint` after the user confirms out-of-band.
- **Master Password changed after profiles were saved**: decrypting with the new password fails
  distinctly from "no profiles exist," triggering the migration panel (prompt for the old
  password) rather than silently discarding data.
- **Windows without WSL, or any non-Windows host**: `/api/wsl/discover` returns
  `{"wsl_instances": []}` rather than erroring; the sidebar renders no "WSL Environments" group
  in that case (previously it always showed one containing a hardcoded "Local Terminal" entry,
  implying WSL was present even when it wasn't). Local terminal availability itself is a separate
  concern — unavailable when `_PTY_AVAILABLE` is false (native Windows).
- **Terminal resize during active output**: resize escapes are detected and stripped from the
  input stream before being written to the PTY/SSH stdin, so they never leak into the shell as
  literal characters.

## Requirements *(mandatory)*

### Functional Requirements

**Connectivity & auth**

- **FR-001**: The system MUST support SSH authentication via password or PEM private key per
  profile.
- **FR-002**: The system MUST support multiple concurrent terminal sessions, each as an
  independent WebSocket + xterm.js instance.
- **FR-003**: The system MUST verify the remote host's SSH key against a local `known_hosts`
  file before authenticating, using `ssh-keyscan` + `ssh-keygen -F`/`-l`, and MUST require
  explicit user approval (fingerprint shown) for any host not already pinned.
- **FR-004**: All three WebSocket endpoints (`/api/ssh/terminal`, `/api/ssh/dashboard`,
  `/api/local/terminal`) MUST validate the `Origin` header before `accept()`.
- **FR-005**: All three WebSocket endpoints MUST require a valid `ds_session` cookie once a
  Master Password is configured (SEC-14), and MUST allow unauthenticated connects only while no
  Master Password has ever been set up.

**Persistence**

- **FR-006**: SSH server profiles MUST be persisted in the DevDB `ssh_profiles` store as an
  opaque blob; the backend MUST NOT decrypt or inspect its contents.
- **FR-007**: When a Master Password is configured, profiles MUST be encrypted client-side
  (`CryptoJS.AES.encrypt`) before every write and decrypted client-side after every read.
- **FR-008**: When no Master Password is configured, the system MUST still allow saving
  profiles (unencrypted, `plain_profiles`) so the tool is usable standalone, with a visible
  warning to the user.
- **FR-009**: A profile blob that fails to decrypt under the current Master Password MUST
  trigger a migration flow (prompt for the old password, re-encrypt under the new one) rather
  than silently discarding the stored profiles.

**SFTP**

- **FR-010**: The system MUST support listing, downloading, and uploading files on a remote host
  over SFTP, reusing the same profile/host-key infrastructure as the terminal.
- **FR-011**: Directory listings MUST sort directories before files, then case-insensitively by
  name.
- **FR-012**: Downloads MUST stream (not buffer the whole file in memory) in fixed-size chunks.
- **FR-013**: The SFTP tool MUST be reachable both from within `/ssh` (sub-tab) and as a
  standalone page at `/sftp`.

**Local terminal / WSL**

- **FR-014**: On Linux/macOS, the system MUST support opening a local shell via PTY fork with no
  SSH handshake.
- **FR-015**: On platforms where local PTY is unavailable (Windows), the local-terminal
  WebSocket MUST close with an explanatory reason rather than attempting to fork.
- **FR-016**: The system MUST discover installed WSL distributions (`wsl.exe -l -q`) and allow
  opening a local shell inside a named distro, with the distro name validated against an
  allowlist pattern before being passed to process execution.
- **FR-016a**: The sidebar MUST NOT display a "WSL Environments" group unless `/api/wsl/discover`
  actually returned at least one distro; "Local Terminal" (the plain-shell feature from FR-014)
  MUST be listed under its own group, never implied to be a WSL environment.
- **FR-016b**: The system MUST provide a manual "Detect WSL" control that re-runs
  `/api/wsl/discover` on demand, so a distro installed after the page loaded becomes reachable
  without a full reload.

**Dashboard**

- **FR-017**: The system MUST provide a live metrics dashboard (CPU %, RAM, swap, disk usage per
  mount, uptime) for a connected SSH host, polled at a fixed ~2-second interval over the same
  WebSocket-gated, host-key-verified connection model as the terminal.

### Key Entities

- **SSH Profile**: host, port, username, auth mode (password or private key material), display
  group/label — stored client-side pre-encryption; server sees only ciphertext (or plaintext
  only in the no-password fallback).
- **Known-hosts Entry**: one pinned host-key line in `~/.ssh/known_hosts`, keyed by
  `host` or `[host]:port` (non-default port).
- **Terminal Tab**: one active WebSocket + xterm.js instance + associated SSH/local connection;
  independent lifecycle from other tabs.
- **SFTP Directory Listing**: ordered set of `{name, is_dir, size}` entries for the current
  remote path.
- **Dashboard Metrics Sample**: one polled snapshot — `cpu`, `ram_pct`/`ram_total_mb`/
  `ram_used_mb`, `swap_pct`/totals, `disks[]` (`mount`, `total_mb`, `used_mb`, `pct`), `uptime`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can connect to a reachable SSH host and see live shell output within a few
  seconds of opening a terminal tab, with no separate SSH client installed.
- **SC-002**: No SSH credential (password or private key) or profile data is ever observable in
  plaintext server-side storage when a Master Password is configured — verified by inspecting
  the raw `ssh_profiles` DevDB store contents.
- **SC-003**: Every unknown host requires an explicit, fingerprint-visible approval before any
  authentication attempt — verified for both the WebSocket (terminal/dashboard) and REST (SFTP)
  paths.
- **SC-004**: All three WebSocket endpoints reject session-less connections once a Master
  Password exists, and accept them beforehand — verified by `tests/python/test_ws_auth.py`.
- **SC-005**: SFTP downloads of large remote files do not require buffering the full file in
  server memory (streamed in 64 KB chunks).

## Assumptions

- **Not strictly offline**: SSH/SFTP actions transmit data to the target host by design (SPEC.md
  §4.8 "Network notice") — this is a deliberate exception to DevSuite's offline-first mission for
  a tool whose entire purpose is talking to remote hosts.
- **`known_hosts` is the single system-wide trust store** (`~/.ssh/known_hosts`), shared with any
  other SSH client on the machine — approving a host in DevSuite also trusts it for the user's
  regular `ssh` CLI, and vice versa.
- **SSH profile encryption reuses the Master Password directly as a passphrase** via
  `CryptoJS.AES.encrypt(json, password)` — a different, simpler key scheme than the vault's
  domain-separated WebCrypto AES-GCM scheme (SPEC.md §7.5); this is an intentional
  per-subsystem choice, not an oversight, and is called out explicitly in SPEC.md §7.5.
- **Local terminal is Linux/macOS only**; Windows users without WSL have no local-terminal
  option — WSL distro access is the Windows path instead.
- **Host-key approval has no visible timeout UI on the SFTP REST path** — the 409 + retry pattern
  assumes the calling frontend code (not verified in this spec's scope) handles the approval
  prompt and retry; this spec documents the backend contract only.
