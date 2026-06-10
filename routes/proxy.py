"""
routes/proxy.py — CORS bypass proxy for the Local API Tester (/api/proxy).
"""
import ipaddress
import socket
import urllib.error
import urllib.parse
import urllib.request

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from deps import _ALLOWED_ORIGINS, logger  # noqa: F401

router = APIRouter()


# ─── SSRF protection helpers ─────────────────────────────────────────────────

_HOP_BY_HOP_HEADERS = frozenset(("host", "connection", "origin", "referer", "accept-encoding"))
_MAX_PROXY_RESPONSE = 10 * 1024 * 1024  # 10 MB response cap


def _check_ip_not_private(ip_str: str) -> None:
    """Raise HTTPException 403 if the IP is loopback, link-local, multicast, or reserved.

    LAN / RFC-1918 private ranges (10.x.x.x, 192.168.x.x, 172.16-31.x.x) are
    intentionally allowed — DevSuite is a loopback-only local tool and testing
    LAN APIs through the CORS proxy is a first-class use case.

    We still block:
      - Loopback (127.x.x.x / ::1)  — prevents proxy-loop to local services
      - Link-local (169.254.x.x)     — cloud-metadata endpoints (AWS/GCP/Azure)
      - Multicast / IANA-reserved    — no legitimate target for an HTTP API
    """
    try:
        ip_obj = ipaddress.ip_address(ip_str)
        if (ip_obj.is_loopback or ip_obj.is_link_local
                or ip_obj.is_multicast or ip_obj.is_reserved):
            raise HTTPException(
                status_code=403,
                detail=f"Access to loopback, link-local, or reserved IP addresses is forbidden: {ip_str}",
            )
    except ValueError:
        pass  # intentionally ignored: non-IP strings (hostnames) are not checked here


def _filter_proxy_headers(headers: dict) -> dict:
    return {k: v for k, v in headers.items() if k.lower() not in _HOP_BY_HOP_HEADERS}


def _collect_set_cookies(headers) -> list[str]:
    """Every Set-Cookie header verbatim — ``dict(headers)`` collapses duplicates (SPEC §5.9).

    The client-side cookie jar (SPEC §4.7.5) needs each cookie individually;
    an API that sets a session cookie plus a CSRF cookie sends two Set-Cookie
    headers, and only one would survive the dict() conversion.
    """
    try:
        return headers.get_all("Set-Cookie") or []
    except AttributeError:
        return []


class _SSRFSafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Re-validate every redirect hop so a public URL cannot 3xx into a private/reserved IP.

    urllib follows redirects automatically; without this the initial-host SSRF
    check is trivially bypassed (e.g. a public host returning
    ``302 Location: http://169.254.169.254/`` to reach cloud metadata).
    """

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urllib.parse.urlparse(newurl)
        if parsed.scheme not in ("http", "https"):
            raise HTTPException(
                status_code=403,
                detail=f"Redirect to disallowed scheme '{parsed.scheme}' blocked",
            )
        if not parsed.hostname:
            raise HTTPException(status_code=400, detail="Redirect to a URL without a hostname blocked")
        _resolve_target_ips(parsed.hostname, parsed.port, parsed.scheme)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _execute_proxy_request(request_obj) -> dict:
    """Run a urllib request (redirects re-validated, response size-capped) and normalise it."""
    opener = urllib.request.build_opener(_SSRFSafeRedirectHandler())
    try:
        with opener.open(request_obj, timeout=15) as resp:  # nosec B310
            raw = resp.read(_MAX_PROXY_RESPONSE + 1)
            return {
                "proxy_response": True,
                "status": resp.status,
                "headers": dict(resp.headers),
                "set_cookie": _collect_set_cookies(resp.headers),
                "body": raw[:_MAX_PROXY_RESPONSE].decode("utf-8", errors="replace"),
                "truncated": len(raw) > _MAX_PROXY_RESPONSE,
            }
    except urllib.error.HTTPError as e:
        try:
            body = e.read(_MAX_PROXY_RESPONSE).decode("utf-8", errors="replace") if hasattr(e, "read") else ""
        except (OSError, ValueError):
            body = ""
        return {
            "proxy_response": True,
            "status": e.code,
            "headers": dict(e.headers),
            "set_cookie": _collect_set_cookies(e.headers),
            "body": body,
        }


def _resolve_target_ips(hostname: str, port: int | None, scheme: str) -> None:
    """Resolve hostname to IP addresses and reject any private/reserved ones."""
    try:
        addr_info = socket.getaddrinfo(
            hostname,
            port or (443 if scheme == 'https' else 80),
            socket.AF_UNSPEC,
            socket.SOCK_STREAM,
        )
    except (socket.gaierror, socket.herror) as e:
        raise HTTPException(status_code=400, detail=f"DNS resolution failed: {e}") from e
    for _, _, _, _, sockaddr in addr_info:
        _check_ip_not_private(sockaddr[0])


# ─── Request model ────────────────────────────────────────────────────────────

class ProxyRequest(BaseModel):
    """Request body for the /api/proxy endpoint."""

    url: str
    method: str = "GET"
    headers: dict = {}
    body: str | None = None


# ─── Route ────────────────────────────────────────────────────────────────────

@router.post(
    "/api/proxy",
    summary="Bypass CORS for API Tester",
    responses={
        400: {"description": "Invalid URL or DNS failure"},
        403: {"description": "Target IP is loopback, link-local, or reserved"},
        500: {"description": "Proxy request failed"},
    },
)
async def proxy_request(req: ProxyRequest):
    """Local CORS bypass proxy for the API tester. LAN/private IPs are permitted; loopback and link-local are not."""
    try:
        parsed = urllib.parse.urlparse(req.url)
        if parsed.scheme not in ('http', 'https'):
            raise HTTPException(status_code=400, detail="Only HTTP and HTTPS schemes are allowed")
        if not parsed.hostname:
            raise HTTPException(status_code=400, detail="Invalid URL: no hostname")
        _resolve_target_ips(parsed.hostname, parsed.port, parsed.scheme)

        req_body = req.body.encode('utf-8') if req.body else None
        safe_netloc = f"{parsed.hostname}:{parsed.port}" if parsed.port else parsed.hostname
        safe_url = urllib.parse.urlunparse((
            parsed.scheme, safe_netloc, parsed.path, parsed.params, parsed.query, parsed.fragment
        ))
        request_obj = urllib.request.Request(
            safe_url, data=req_body,
            headers=_filter_proxy_headers(req.headers),
            method=req.method.upper(),
        )
        return _execute_proxy_request(request_obj)
    except HTTPException:
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Proxy request failed: %s", e)
        raise HTTPException(status_code=500, detail="Proxy request failed") from e
