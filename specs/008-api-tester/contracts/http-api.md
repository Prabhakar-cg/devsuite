# Contract: HTTP API — `/api/proxy` and `/api/collections`

The API Tester's server surface is intentionally small: a CORS-bypass proxy and an opaque
JSON-blob store. Neither route interprets request/response *content* beyond what's needed for
SSRF safety (proxy) or auth gating (collections) — schema validation of collection item shapes is
entirely client-side.

## `POST /api/proxy` (`routes/proxy.py`)

Forwards an HTTP/HTTPS request server-side so the browser's CORS policy never applies.

**Request body** (`ProxyRequest` pydantic model):
```json
{ "url": "https://api.example.com/path", "method": "GET", "headers": {"X-Foo": "bar"}, "body": "raw string or null" }
```

**Response** (200, or the target's own status forwarded through):
```json
{
  "proxy_response": true,
  "status": 200,
  "headers": { "content-type": "application/json", "...": "..." },
  "set_cookie": ["session=abc; Path=/; HttpOnly", "csrf=xyz; Path=/"],
  "body": "raw response text (UTF-8, errors=replace)",
  "truncated": false
}
```

**Errors**:
| Status | Condition |
|---|---|
| 400 | Scheme not `http`/`https`; no hostname; DNS resolution failure |
| 403 | Target (or any redirect hop) resolves to loopback/link-local/multicast/reserved IP |
| 500 | Unhandled proxy failure (network error, etc.) |

**Security properties** (verified against source, not just SPEC.md prose):
- RFC-1918 LAN ranges (`10.x`, `192.168.x`, `172.16-31.x`) are **allowed** — deliberate, per
  `_check_ip_not_private`'s docstring: DevSuite is loopback-only and LAN API testing is first-class.
- Loopback, link-local (cloud metadata), multicast, and reserved ranges are blocked, both on the
  initial target and on every redirect hop (`_SSRFSafeRedirectHandler.redirect_request` calls
  `_resolve_target_ips` again before following).
- Hop-by-hop headers (`host`, `connection`, `origin`, `referer`, `accept-encoding`) are stripped
  before forwarding (`_filter_proxy_headers`) so the proxy doesn't leak DevSuite's own request
  context to the target.
- The outbound URL is rebuilt from parsed components (`urllib.parse.urlunparse`), not the raw
  input string, to prevent taint-flow from unvalidated user input into the actual request line.
- Response capped at 10 MB (`_MAX_PROXY_RESPONSE`); `truncated: true` set if the target sent more.
- Timeout: 15 s per attempt (`opener.open(..., timeout=15)`).
- Every `Set-Cookie` header is preserved individually as a list (`_collect_set_cookies` uses
  `headers.get_all`, not `dict()`) — required so the client cookie jar (contracts/frontend-modules.md)
  doesn't lose a second cookie to dict-collapse.

**Not required**: no auth/CSRF gate on this route — it has no side effects on DevSuite's own state
(nothing is written), only outbound HTTP calls scoped by the SSRF rules above.

## `GET /api/collections` / `POST /api/collections` (`routes/storage.py`)

Opaque JSON blob store backing the API Tester's saved requests + folder auth configs, in the DevDB
`collections` named store (SPEC §6.4).

**Auth**: both methods call `require_unlocked(request)` — a valid, unexpired `ds_session` is
required server-side. This is enforced independent of the frontend's `auth-guard.js` 8-hour cache;
a request forged without a valid session cookie is rejected regardless of what the UI shows.

### `GET /api/collections`
Returns the stored blob verbatim, or `{}` if the store has never been written:
```json
{ "items": [ { "name": "...", "method": "GET", "url": "...", "...": "..." } ], "folderAuths": { "path/to/folder": { "type": "bearer", "token": "..." } } }
```

### `POST /api/collections`
Request body: any JSON object (FastAPI-typed as `data: dict` — **no server-side schema
validation** of item shape; the backend is a pass-through store, matching the "opaque pass-through"
pattern used for `/api/vault` and `/api/ssh/profiles`). Persisted verbatim to the `collections`
DevDB store and immediately flushed to disk (`deps._db.save()`).

**Response** (200): `{"status": "ok"}` on success; 500 with a generic error detail on write failure.

**Errors**: 401 if the session is missing/expired (both methods); 500 on a DevDB write failure
(POST only).

## Out of scope for this contract (not backend endpoints)

- OAuth2 token fetch is a **client-side `fetch`/proxy call to the user-configured token URL**, not
  a DevSuite backend endpoint — no server route exists for it.
- Environments and History never touch the backend at all (`localStorage` only — see data-model.md).
- The script sandbox is a same-origin static asset (`GET /static/script-sandbox-worker.js`, served
  like any other static file with its own scoped CSP via `main.py`'s security-headers middleware
  path check) — there is no dedicated route handler for it beyond static file serving.
