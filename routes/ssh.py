"""
routes/ssh.py — SSH terminal, SFTP, WSL discovery, and SSH dashboard WebSocket.

Routes:
  WS  /api/ssh/terminal     — interactive SSH terminal
  WS  /api/ssh/dashboard    — real-time SSH metrics dashboard
  WS  /api/local/terminal   — local PTY terminal (Linux/macOS)
  POST /api/sftp/list        — list remote directory via SFTP
  POST /api/sftp/download    — download remote file via SFTP
  POST /api/sftp/upload      — upload file to remote path via SFTP
  GET  /api/wsl/discover     — enumerate installed WSL distros
"""
import asyncio
import json
import os
import re
import stat
import struct
import urllib.parse

import asyncssh
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from starlette.responses import StreamingResponse
from typing import Annotated

from deps import (
    _ALLOWED_ORIGINS,
    _DISTRO_NAME_RE,
    _ERR_ORIGIN_NOT_ALLOWED,
    _ERR_ORIGIN_REQUIRED,
    _ERR_SFTP_FAILED,
    _MIME_OCTET_STREAM,
    _PTY_AVAILABLE,
    _RE_NON_DIGIT,
    _WSL_EXE,
    _audit_log,
    fcntl,
    logger,
    pty,
    termios,
)

router = APIRouter()


# ─── Known-hosts helpers ──────────────────────────────────────────────────────

def _create_known_hosts(path: str) -> None:
    """Create an empty known_hosts file with mode 600."""
    with open(path, "w", encoding="utf-8") as _fh:
        pass  # intentionally empty
    os.chmod(path, 0o600)


def _append_known_hosts(path: str, data: bytes) -> None:
    """Append a host-key entry to the known_hosts file."""
    with open(path, "ab") as fh:
        fh.write(data)


async def _ssh_keyscan(host: str, port: int) -> bytes:
    """Fetch the public key blob for host:port via ssh-keyscan."""
    proc = await asyncio.create_subprocess_exec(
        "ssh-keyscan", "-p", str(port), "-H", host,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
    except asyncio.TimeoutError as exc:
        raise RuntimeError(f"ssh-keyscan timed out for {host}:{port}") from exc
    if proc.returncode != 0 or not stdout.strip():
        raise RuntimeError(
            f"Could not retrieve host key for {host}:{port}. Is the host reachable?"
        )
    return stdout


async def _ssh_key_fingerprint(key_data: bytes, host: str, port: int) -> str:
    """Return the SHA-256 (or MD5) fingerprint string for a raw ssh-keyscan blob."""
    keygen = await asyncio.create_subprocess_exec(
        "ssh-keygen", "-l", "-f", "-",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        kg_out, _ = await asyncio.wait_for(keygen.communicate(input=key_data), timeout=10)
    except asyncio.TimeoutError as exc:
        raise RuntimeError(f"ssh-keygen fingerprint timed out for {host}:{port}") from exc
    for token in kg_out.decode(errors="replace").split():
        if token.startswith("SHA256:") or token.startswith("MD5:"):
            return token
    return ""


async def _ensure_host_key(
    host: str,
    port: int,
    approve_host=None,
) -> str:
    """Ensure ~/.ssh/known_hosts exists and contains a pinned entry for host:port."""
    known_hosts_path = os.path.expanduser("~/.ssh/known_hosts")
    ssh_dir = os.path.dirname(known_hosts_path)

    os.makedirs(ssh_dir, mode=0o700, exist_ok=True)
    if not os.path.exists(known_hosts_path):
        await asyncio.to_thread(_create_known_hosts, known_hosts_path)

    lookup = f"[{host}]:{port}" if port != 22 else host
    check = await asyncio.create_subprocess_exec(
        "ssh-keygen", "-F", lookup, "-f", known_hosts_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    await check.wait()
    if check.returncode == 0:
        return known_hosts_path

    key_data = await _ssh_keyscan(host, port)
    fingerprint = await _ssh_key_fingerprint(key_data, host, port)

    if approve_host is None:
        raise HostKeyApprovalRequired(host, port, fingerprint)

    approved = await approve_host(host, port, fingerprint, key_data)
    if not approved:
        raise RuntimeError(
            f"Host key for {host}:{port} (fingerprint {fingerprint}) was rejected by the user."
        )

    await asyncio.to_thread(_append_known_hosts, known_hosts_path, key_data)
    return known_hosts_path


class HostKeyApprovalRequired(Exception):
    """Raised by _ensure_host_key when no approve_host callback is provided."""
    def __init__(self, host: str, port: int, fingerprint: str):
        super().__init__(f"Host key approval required for {host}:{port}")
        self.host = host
        self.port = port
        self.fingerprint = fingerprint


# ─── WebSocket helpers ────────────────────────────────────────────────────────

async def _ws_check_origin(websocket: WebSocket) -> bool:
    """Return True if origin is valid; close the socket and return False otherwise."""
    origin = websocket.headers.get("origin", "")
    host   = websocket.headers.get("host", "")
    if not origin:
        await websocket.close(code=1008, reason=_ERR_ORIGIN_REQUIRED)
        return False
    allowed = origin in _ALLOWED_ORIGINS or (
        bool(host) and origin in (f"http://{host}", f"https://{host}")
    )
    if not allowed:
        await websocket.close(code=1008, reason=_ERR_ORIGIN_NOT_ALLOWED)
        return False
    return True


def _build_ssh_connect_kwargs(
    host: str,
    port: int,
    username: str,
    password: str | None,
    private_key: str | None,
    known_hosts_path: str,
) -> dict:
    """Build the keyword arguments dict for asyncssh.connect()."""
    kwargs: dict = {"host": host, "port": port, "username": username, "known_hosts": known_hosts_path}
    if password:
        kwargs["password"] = password
    if private_key:
        kwargs["client_keys"] = [asyncssh.import_private_key(private_key)]
    return kwargs


# ─── SSH Terminal WebSocket ───────────────────────────────────────────────────

async def _ws_wait_for_host_key_response(websocket: WebSocket) -> bool:
    """Wait for a host_key_response message over *websocket*."""
    while True:
        try:
            raw = await websocket.receive_text()
        except asyncio.TimeoutError:
            return False
        try:
            msg = json.loads(raw)
            if msg.get("type") == "host_key_response":
                return bool(msg.get("approve", False))
        except (json.JSONDecodeError, AttributeError) as exc:
            logger.debug(
                "Ignored non-JSON message while waiting for host_key_response (len=%d) — %s",
                len(raw), exc,
            )


async def _terminal_ws_approve_host(
    websocket: WebSocket,
    h: str,
    p: int,
    fingerprint: str,
    _key_line: bytes,
) -> bool:
    """Send a host-key approval request over *websocket* and await the browser reply."""
    await websocket.send_json({
        "type": "host_key_approval",
        "host": h,
        "port": p,
        "fingerprint": fingerprint,
    })
    async with asyncio.timeout(60):
        return await _ws_wait_for_host_key_response(websocket)


def _try_resize_ssh_process(process, data: str) -> bool:
    """Apply terminal resize if *data* is a resize escape; return True if handled."""
    if not data.startswith("\x1b[resize;"):
        return False
    parts = data.split(";")
    if len(parts) == 3:
        try:
            cols, rows = int(parts[1]), int(parts[2].strip("m"))
            process.change_terminal_size(cols, rows, 0, 0)
        except Exception:  # pylint: disable=broad-exception-caught
            logger.debug("Terminal resize failed (ignored)", exc_info=True)
    return True


async def _run_ssh_terminal_session(websocket: WebSocket, conn) -> None:
    """Run the interactive SSH terminal I/O loop over an established connection."""
    async with conn.create_process(term_type='xterm-256color') as process:

        async def read_from_ssh():
            try:
                while data := await process.stdout.read(4096):
                    await websocket.send_text(str(data))
            except Exception:  # pylint: disable=broad-exception-caught
                logger.debug("read_from_ssh: stream ended or error", exc_info=True)

        async def write_to_ssh():
            try:
                while True:
                    data = await websocket.receive_text()
                    if _try_resize_ssh_process(process, data):
                        continue
                    process.stdin.write(data)
            except WebSocketDisconnect:
                process.terminate()
            except Exception:  # pylint: disable=broad-exception-caught
                logger.debug("write_to_ssh: error writing to SSH process", exc_info=True)

        await asyncio.gather(read_from_ssh(), write_to_ssh())


@router.websocket("/api/ssh/terminal")
async def ssh_terminal(websocket: WebSocket):
    """WebSocket endpoint: interactive SSH terminal session."""
    if not await _ws_check_origin(websocket):
        return

    await websocket.accept()
    try:
        data = await websocket.receive_text()
        config = json.loads(data)
        ssh_host    = config.get("host")
        port        = int(config.get("port", 22))
        username    = config.get("username")
        password    = config.get("password")
        private_key = config.get("private_key")

        await websocket.send_text(f"Verifying host key for {ssh_host}:{port}...\r\n")

        async def _ws_approve_host(h: str, p: int, fingerprint: str, _key_line: bytes) -> bool:
            return await _terminal_ws_approve_host(websocket, h, p, fingerprint, _key_line)

        try:
            known_hosts_path = await _ensure_host_key(ssh_host, port, approve_host=_ws_approve_host)
        except RuntimeError as exc:
            await websocket.send_text(f"\r\nHost key error: {exc}\r\n")
            await websocket.close()
            return

        connect_kwargs = _build_ssh_connect_kwargs(
            ssh_host, port, username, password, private_key, known_hosts_path
        )
        async with asyncssh.connect(**connect_kwargs) as conn:
            _audit_log("SSH_CONNECT", host=ssh_host, port=port, user=username or "unknown")
            await _run_ssh_terminal_session(websocket, conn)
    except Exception as e:  # pylint: disable=broad-exception-caught
        try:
            await websocket.send_text(f"\r\nError: {e}\r\n")
            await websocket.close()
        except Exception:  # pylint: disable=broad-exception-caught
            logger.debug("ssh_terminal: failed to send error message to client", exc_info=True)


# ─── SFTP ─────────────────────────────────────────────────────────────────────

class SFTPRequest(BaseModel):
    """Request body for the /api/sftp/list endpoint."""

    host: str
    port: int = 22
    username: str
    password: str | None = None
    private_key: str | None = None
    path: str = "."
    approved_fingerprint: str | None = None


class SFTPDownloadRequest(BaseModel):
    """Request body for the /api/sftp/download endpoint."""

    host: str
    port: int = 22
    username: str
    password: str | None = None
    private_key: str | None = None
    path: str
    approved_fingerprint: str | None = None


def _make_sftp_approve(approved_fingerprint: str | None):
    """Return an SFTP host-key approval callback that auto-approves a known fingerprint."""
    async def _approve(h: str, p: int, fingerprint: str, _key: bytes) -> bool:  # NOSONAR
        if approved_fingerprint and approved_fingerprint == fingerprint:
            return True
        raise HTTPException(
            status_code=409,
            detail={
                "error": "host_key_approval_required",
                "host": h, "port": p, "fingerprint": fingerprint,
            },
        )
    return _approve


@router.post(
    "/api/sftp/list",
    summary="List files via SFTP",
    responses={
        409: {"description": "Host key approval required"},
        500: {"description": _ERR_SFTP_FAILED},
    },
)
async def sftp_list(req: SFTPRequest):
    """List files in a directory on a remote host via SFTP."""
    try:
        known_hosts_path = await _ensure_host_key(
            req.host, req.port, approve_host=_make_sftp_approve(req.approved_fingerprint)
        )
        connect_kwargs = _build_ssh_connect_kwargs(
            req.host, req.port, req.username, req.password, req.private_key, known_hosts_path
        )
        async with asyncssh.connect(**connect_kwargs) as conn:
            sftp = await conn.start_sftp_client()
            async with sftp:
                files = await sftp.readdir(req.path)
                result = []
                for f in files:
                    if f.filename in ('.', '..'):
                        continue
                    attrs = f.attrs
                    is_dir = stat.S_ISDIR(attrs.permissions) if attrs.permissions else False
                    result.append({
                        "name":   f.filename,
                        "is_dir": is_dir,
                        "size":   attrs.size,
                    })
                result.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))
                return {"files": result, "cwd": req.path}
    except HTTPException:
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("SFTP list error: %s", e)
        raise HTTPException(status_code=500, detail=_ERR_SFTP_FAILED) from e


@router.post(
    "/api/sftp/download",
    summary="Download a file via SFTP",
    responses={
        409: {"description": "Host key approval required"},
        500: {"description": _ERR_SFTP_FAILED},
    },
)
async def sftp_download(req: SFTPDownloadRequest):
    """Stream a file download from a remote host via SFTP."""
    try:
        known_hosts_path = await _ensure_host_key(
            req.host, req.port, approve_host=_make_sftp_approve(req.approved_fingerprint)
        )
        connect_kwargs = _build_ssh_connect_kwargs(
            req.host, req.port, req.username, req.password, req.private_key, known_hosts_path
        )
        chunk_size = 65536  # 64 KB

        async def _stream_file():
            async with asyncssh.connect(**connect_kwargs) as conn:
                async with conn.start_sftp_client() as sftp:
                    async with sftp.open(req.path, 'rb') as remote_file:
                        while True:
                            chunk = await remote_file.read(chunk_size)
                            if not chunk:
                                break
                            yield chunk

        filename = req.path.rstrip('/').split('/')[-1]
        safe_filename = urllib.parse.quote(filename, safe='')
        return StreamingResponse(
            _stream_file(),
            media_type=_MIME_OCTET_STREAM,
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{safe_filename}"},
        )
    except HTTPException:
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("SFTP download error for %s: %s", req.host[:50], e)
        raise HTTPException(status_code=500, detail=_ERR_SFTP_FAILED) from e


@router.post(
    "/api/sftp/upload",
    summary="Upload a file via SFTP",
    responses={
        409: {"description": "Host key approval required"},
        500: {"description": _ERR_SFTP_FAILED},
    },
)
async def sftp_upload(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    host: Annotated[str, Form(...)],
    username: Annotated[str, Form(...)],
    remote_path: Annotated[str, Form(...)],
    file: Annotated[UploadFile, File(...)],
    port: Annotated[int, Form()] = 22,
    password: Annotated[str | None, Form()] = None,
    private_key: Annotated[str | None, Form()] = None,
    approved_fingerprint: Annotated[str | None, Form()] = None,
):
    """Upload a file to a remote host via SFTP."""
    try:
        known_hosts_path = await _ensure_host_key(
            host, port, approve_host=_make_sftp_approve(approved_fingerprint)
        )
        connect_kwargs = _build_ssh_connect_kwargs(
            host, port, username, password, private_key, known_hosts_path
        )
        file_content = await file.read()
        remote_file_path = remote_path.rstrip('/') + '/' + file.filename

        async with asyncssh.connect(**connect_kwargs) as conn:
            async with conn.start_sftp_client() as sftp:
                async with sftp.open(remote_file_path, 'wb') as remote_file:
                    await remote_file.write(file_content)

        return {"success": True, "path": remote_file_path}
    except HTTPException:
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("SFTP upload error for %s: %s", host[:50], e)
        raise HTTPException(status_code=500, detail=_ERR_SFTP_FAILED) from e


# ─── WSL Discovery ───────────────────────────────────────────────────────────

@router.get("/api/wsl/discover", summary="Discover local WSL instances")
async def wsl_discover():
    """Discover locally-installed WSL instances by running wsl.exe."""
    try:
        process = await asyncio.create_subprocess_exec(
            _WSL_EXE, "-l", "-q",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        out, _ = await process.communicate()
        text = out.decode("utf-16le") if b"\x00" in out else out.decode("utf-8", errors="replace")
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return {"wsl_instances": lines}
    except Exception:  # pylint: disable=broad-exception-caught
        return {"wsl_instances": []}


# ─── SSH Dashboard WebSocket ─────────────────────────────────────────────────

# Module-level set to hold references to fire-and-forget tasks.
_pending_tasks: set = set()


def _tracked_task(coro):
    """Schedule a coroutine as an asyncio task, retaining a reference until done."""
    task = asyncio.create_task(coro)
    _pending_tasks.add(task)
    task.add_done_callback(_pending_tasks.discard)
    return task


def _parse_cpu_section(cpu_line: str, prev_idle: int, prev_total: int) -> tuple:
    """Parse the first line of /proc/stat and return (cpu_usage_float, new_idle, new_total)."""
    cpu_usage = 0
    idle, total = prev_idle, prev_total
    if cpu_line.startswith('cpu '):
        vals = [int(v) for v in cpu_line.split()[1:]]
        idle = vals[3] + vals[4]
        total = sum(vals)
        if prev_total > 0:
            diff_idle = idle - prev_idle
            diff_total = total - prev_total
            cpu_usage = (
                (1000 * (diff_total - diff_idle) / diff_total + 5) / 10
                if diff_total > 0 else 0
            )
    return cpu_usage, idle, total


def _parse_mem_section(mem_text: str) -> tuple:
    """Parse /proc/meminfo excerpt and return (total_kb, avail_kb, swap_total_kb, swap_free_kb)."""
    mem_total, mem_avail, swap_total, swap_free = 1, 0, 0, 0
    for line in mem_text.strip().split('\n'):
        if 'MemTotal' in line:
            mem_total = int(re.sub(_RE_NON_DIGIT, '', line))
        elif 'MemAvailable' in line:
            mem_avail = int(re.sub(_RE_NON_DIGIT, '', line))
        elif 'SwapTotal' in line:
            swap_total = int(re.sub(_RE_NON_DIGIT, '', line))
        elif 'SwapFree' in line:
            swap_free = int(re.sub(_RE_NON_DIGIT, '', line))
    return mem_total, mem_avail, swap_total, swap_free


def _parse_disk_section(disk_text: str) -> list:
    """Parse ``df -m`` output and return a list of disk dicts."""
    disks = []
    _skip_fs = ('tmpfs', 'devtmpfs', 'overlay', 'shm')
    for d_line in disk_text.strip().split('\n'):
        tokens = d_line.strip().split()
        if len(tokens) < 6:
            continue
        fs = tokens[0]
        if fs in _skip_fs or fs.startswith('/dev/loop') or fs.startswith('squashfs'):
            continue
        try:
            disk_total = int(tokens[1])
            disk_used  = int(tokens[2])
            disk_usage = (disk_used / disk_total) * 100 if disk_total > 0 else 0
            disks.append({"mount": tokens[5], "total_mb": disk_total, "used_mb": disk_used, "pct": disk_usage})
        except ValueError:
            pass
    return disks


def _parse_ssh_metrics(parts: list, prev_idle: int, prev_total: int) -> tuple:
    """Parse the four-section script output into a metrics payload."""
    cpu_usage, prev_idle, prev_total = _parse_cpu_section(parts[0].strip(), prev_idle, prev_total)
    mem_total, mem_avail, swap_total, swap_free = _parse_mem_section(parts[1])
    disks = _parse_disk_section(parts[2])
    uptime_sec = float(parts[3].strip() or "0")
    ram_usage  = (mem_total - mem_avail) / mem_total * 100 if mem_total > 0 else 0
    swap_usage = (swap_total - swap_free) / swap_total * 100 if swap_total > 0 else 0
    payload = {
        "type":        "metrics",
        "cpu":         min(max(cpu_usage, 0), 100),
        "ram_pct":     ram_usage,
        "ram_total_mb": mem_total / 1024,
        "ram_used_mb":  (mem_total - mem_avail) / 1024,
        "swap_pct":    swap_usage,
        "swap_total_mb": swap_total / 1024,
        "swap_used_mb":  (swap_total - swap_free) / 1024,
        "disks":       disks,
        "uptime":      uptime_sec,
    }
    return payload, prev_idle, prev_total


async def _run_metrics_loop(websocket: WebSocket, conn) -> None:
    """Poll SSH server metrics every 2 s and push them over *websocket*."""
    script = (
        "cat /proc/stat | head -n 1; echo '---'; "
        "cat /proc/meminfo | grep -E '^(MemTotal|MemAvailable|SwapTotal|SwapFree):'; echo '---'; "
        "df -m | awk 'NR>1 {print $1, $2, $3, $4, $5, $6}'; echo '---'; "
        "cat /proc/uptime | awk '{print $1}'"
    )
    await websocket.send_json({"status": "connected"})
    prev_idle = 0
    prev_total = 0
    while True:
        try:
            res = await asyncio.wait_for(conn.run(script), timeout=5.0)
            if res.exit_status == 0:
                parts = res.stdout.strip().split('---')
                if len(parts) == 4:
                    payload, prev_idle, prev_total = _parse_ssh_metrics(parts, prev_idle, prev_total)
                    await websocket.send_json(payload)
            await asyncio.sleep(2)
        except asyncio.TimeoutError:
            continue
        except Exception as e:  # pylint: disable=broad-exception-caught
            logger.debug("ssh_dashboard iteration error: %s", e)
            break


async def _dashboard_ws_approve_host(
    websocket: WebSocket,
    approved_fingerprint: str | None,
    h: str,
    p: int,
    fingerprint: str,
    _key: bytes,
) -> bool:
    """Approve a dashboard host key: auto-approve known fingerprint or prompt the browser."""
    if approved_fingerprint and approved_fingerprint == fingerprint:
        return True
    await websocket.send_json({
        "type": "host_key_approval",
        "host": h,
        "port": p,
        "fingerprint": fingerprint,
    })
    async with asyncio.timeout(60):
        return await _ws_wait_for_host_key_response(websocket)


async def _ssh_dashboard_connect(websocket: WebSocket, config: dict) -> None:
    """Parse config, verify host key, connect and start the metrics loop."""
    ssh_host            = config.get("host")
    port                = int(config.get("port", 22))
    username            = config.get("username")
    password            = config.get("password")
    private_key         = config.get("private_key")
    approved_fingerprint = config.get("approved_fingerprint")

    async def _ws_approve_host(h: str, p: int, fingerprint: str, _key: bytes) -> bool:
        return await _dashboard_ws_approve_host(websocket, approved_fingerprint, h, p, fingerprint, _key)

    try:
        known_hosts_path = await _ensure_host_key(ssh_host, port, approve_host=_ws_approve_host)
    except RuntimeError as exc:
        await websocket.send_json({"error": str(exc)})
        await websocket.close()
        return
    except Exception as e:  # pylint: disable=broad-exception-caught
        await websocket.send_json({"error": f"Host verification failed: {e}"})
        await websocket.close()
        return

    connect_kwargs = _build_ssh_connect_kwargs(
        ssh_host, port, username, password, private_key, known_hosts_path
    )
    try:
        async with asyncssh.connect(**connect_kwargs) as conn:
            await _run_metrics_loop(websocket, conn)
    except WebSocketDisconnect:
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        await websocket.send_json({"error": f"SSH connection error: {e}"})
        await websocket.close()


@router.websocket("/api/ssh/dashboard")
async def ssh_dashboard(websocket: WebSocket):
    """WebSocket endpoint: real-time SSH server metrics dashboard."""
    if not await _ws_check_origin(websocket):
        return

    await websocket.accept()
    try:
        data = await websocket.receive_text()
        config = json.loads(data)
        await _ssh_dashboard_connect(websocket, config)
    except WebSocketDisconnect:
        pass
    except Exception as e:  # pylint: disable=broad-exception-caught
        try:
            await websocket.send_json({"error": f"Connection lost: {e}"})
            await websocket.close()
        except Exception:  # pylint: disable=broad-exception-caught
            logger.debug("ssh_dashboard: failed to close websocket after error", exc_info=True)


# ─── Local PTY Terminal WebSocket ─────────────────────────────────────────────

def _make_pty_read_handler(fd: int, loop, websocket: WebSocket):
    """Return a callback that reads from *fd* and forwards data over *websocket*."""
    def on_pty_read():
        try:
            data = os.read(fd, 8192)
            if data:
                _tracked_task(websocket.send_text(data.decode("utf-8", errors="replace")))
            else:
                loop.remove_reader(fd)
                _tracked_task(websocket.close())
        except OSError:
            loop.remove_reader(fd)
            _tracked_task(websocket.close())
    return on_pty_read


def _apply_terminal_resize(fd: int, data: str, resize_pattern) -> bool:
    """Apply a terminal resize if *data* matches the resize escape sequence."""
    match = resize_pattern.match(data)
    if not match:
        return False
    cols = int(match.group(1))
    rows = int(match.group(2))
    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
    return True


def _parse_distro_from_config(config_raw: str) -> str | None:
    """Parse and validate the distro name from a JSON config string."""
    try:
        config = json.loads(config_raw)
        distro = config.get("distro")
        if distro and not _DISTRO_NAME_RE.match(distro):
            logger.warning("local_terminal: rejected invalid distro name %r", distro)
            return None
        return distro
    except Exception:  # pylint: disable=broad-exception-caught
        logger.debug("local_terminal: failed to parse config JSON, proceeding with distro=None")
        return None


def _exec_pty_child(distro: str | None) -> None:  # pragma: no cover — runs in forked child
    """Replace the child process image with the appropriate shell or WSL distro."""
    current_distro = os.environ.get("WSL_DISTRO_NAME", "")
    if distro and distro != current_distro:
        os.execvp(_WSL_EXE, [_WSL_EXE, "-d", distro])  # nosec B606
    else:
        shell = os.environ.get("SHELL", "/bin/bash")
        os.execvp(shell, [shell])  # nosec B606


async def _run_local_pty_loop(websocket: WebSocket, fd: int) -> None:
    """Run the PTY read/write loop until the WebSocket disconnects."""
    loop = asyncio.get_running_loop()
    loop.add_reader(fd, _make_pty_read_handler(fd, loop, websocket))
    resize_pattern = re.compile(r"^\x1b\[resize;(\d+);(\d+)m$")
    try:
        while True:
            data = await websocket.receive_text()
            if not _apply_terminal_resize(fd, data, resize_pattern):
                os.write(fd, data.encode("utf-8"))
    except WebSocketDisconnect:
        pass
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("local_terminal: unexpected error: %s", e)
    finally:
        try:
            loop.remove_reader(fd)
            os.close(fd)
        except Exception:  # pylint: disable=broad-exception-caught
            logger.debug("local_terminal: error during cleanup", exc_info=True)


@router.websocket("/api/local/terminal")
async def local_terminal(websocket: WebSocket):
    """WebSocket endpoint: local PTY terminal (Linux/macOS only)."""
    if not await _ws_check_origin(websocket):
        return

    if not _PTY_AVAILABLE:
        await websocket.close(code=1008, reason="Local terminal is not supported on this platform")
        return

    await websocket.accept()

    config_raw = await websocket.receive_text()
    distro = _parse_distro_from_config(config_raw)

    pid, fd = pty.fork()
    if pid == 0:
        _exec_pty_child(distro)

    await _run_local_pty_loop(websocket, fd)
