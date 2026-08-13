# Phase 0 Research: Secure Terminal & SFTP

Retroactive research notes — technical decisions as found in the shipped code, with rationale
reconstructed from source comments, SPEC.md, and the surrounding architecture. Not a forward
alternatives-evaluation; these are "why it is built this way" notes.

## R1 — `asyncssh` over shelling out to the system `ssh` binary

The backend uses the pure-Python `asyncssh` library (`routes/ssh.py`) rather than spawning an
`ssh` subprocess. This gives structured, async-native connect/exec/SFTP APIs that integrate
directly with FastAPI's event loop and avoids PTY-wrangling a subprocess for interactive
terminal I/O. It also keeps the dependency footprint pure-Python (`requirements.txt`), matching
the rest of the backend's dependency style.

## R2 — Trust-on-first-use host verification via the system `known_hosts`, not a custom store

Rather than maintaining its own list of trusted host keys, DevSuite shells out to the standard
`ssh-keyscan` / `ssh-keygen` tools and reads/writes `~/.ssh/known_hosts` directly
(`_ensure_host_key`, `_create_known_hosts`, `_append_known_hosts`). This reuses the exact trust
model every other SSH client on the machine already uses — a host approved once in DevSuite is
trusted by the CLI `ssh` too, and vice versa — rather than inventing a parallel, DevSuite-only
trust store that could drift from the system's.

## R3 — Callback-based host-key approval, shared across three call sites

`_ensure_host_key(host, port, approve_host=...)` takes an `approve_host` async callback rather
than hard-coding a transport. Each call site (terminal WS, dashboard WS, SFTP REST) supplies its
own callback: the two WebSocket flows send a `host_key_approval` message and await a
`host_key_response` on the same socket (`_terminal_ws_approve_host`,
`_dashboard_ws_approve_host`); the stateless SFTP REST flow instead raises HTTP 409 with the
fingerprint and expects the client to retry with `approved_fingerprint` once approved
(`_make_sftp_approve`). One verification routine, three transport-appropriate approval UIs —
avoids duplicating the keyscan/fingerprint logic three times.

## R4 — SSH profile encryption reuses the Master Password as a CryptoJS passphrase, not the vault's WebCrypto scheme

`static/ssh-manager.js` (`encryptData`/`decryptData`) calls `CryptoJS.AES.encrypt(str, pwd)`
directly with the Master Password as the passphrase. This is a simpler, single-key scheme than
the vault's domain-separated PBKDF2 → `{Kenc, Kauth}` WebCrypto AES-GCM design (SPEC.md §7.5).
SPEC.md explicitly calls this out ("SSH profile blobs use CryptoJS AES-256 (separate key scheme,
see SSH Manager)") rather than treating it as an oversight — the two subsystems were built at
different times with different key-derivation approaches, and unifying them would be a breaking
migration for existing encrypted profile blobs, not a bug fix.

## R5 — Graceful no-password fallback (`plain_profiles`) instead of blocking usage

If no Master Password has ever been configured, profile save/load falls back to an unencrypted
`plain_profiles` path with a warning toast, rather than refusing to let the user save a profile
at all. This mirrors the same "dormant before setup" philosophy as the WS session gate (SEC-14,
R6 below) — DevSuite is usable standalone without ever setting up a vault, and SSH profiles
shouldn't be the exception that forces setup.

## R6 — WebSocket auth gate is dormant until a Master Password exists (SEC-14)

`_ws_require_session` returns `True` unconditionally when `is_auth_configured()` is false. This
was a deliberate carve-out (documented in SPEC.md §7.8 as "✅ Resolved (v0.2.4)" and in CLAUDE.md
Gotchas) to preserve a no-password local-terminal flow: a user who has never touched the Vault
should still be able to open a local shell or connect to a test SSH server without being forced
through master-password setup first. Once a password exists, the same three endpoints require a
valid `ds_session` cookie, closing the socket with code 1008 pre-`accept()` otherwise —
verified by `tests/python/test_ws_auth.py`.

## R7 — Origin check precedes the session check, both precede `accept()`

`_ws_check_origin` runs before `_ws_require_session`, and both run before `websocket.accept()`
on all three endpoints. Rejecting on origin first is cheaper (no session/cookie lookup needed)
and closes off cross-site WebSocket hijacking attempts before any auth-adjacent logic executes.

## R8 — SFTP downloads stream in fixed 64 KB chunks

`sftp_download` yields from an async generator reading 64 KB at a time from the remote file
handle into a `StreamingResponse`, rather than reading the whole file into memory first. This
keeps memory use bounded regardless of remote file size — consistent with the general backend
posture of capping/streaming large payloads seen elsewhere (e.g. the 20 MB/50 MB upload limits
in §5.7).

## R9 — Local terminal distro name validated before `os.execvp`

`_parse_distro_from_config` checks the client-supplied WSL distro name against `_DISTRO_NAME_RE`
before it ever reaches `os.execvp(_WSL_EXE, [_WSL_EXE, "-d", distro])`. Because `execvp` replaces
the forked child's process image directly (not via a shell), this isn't classic shell-injection
exposure, but validating the name still prevents a malformed/unexpected argument from being
handed to `wsl.exe`.
