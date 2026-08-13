# Quickstart & Validation: Local API Tester

Manual validation steps per user story, plus an honest accounting of what's actually
automated-tested today vs. what requires clicking through the UI.

## Setup

```bash
python main.py            # or start.sh / start.ps1 — serves on localhost:8000
# open http://localhost:8000/api-tester
```

No master password is required to *use* the tool without saving — `/api/collections` is
auth-gated (`require_unlocked`), so saving/loading collections requires the 8-hour session
(`auth-guard.js`) to be unlocked first, same as any DevDB-backed tool.

## Functional validation (maps to spec.md user stories)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| US1 | Direct request | Send a GET to `https://httpbin.org/get` (or any CORS-friendly target) | Response renders directly, no proxy chip |
| US1 | Preflight-triggering cross-origin | Send a PUT with a JSON body to a third-party API with no CORS policy | Request routes through `/api/proxy` immediately; response tagged "(proxy)" |
| US1 | SSRF block | POST to `/api/proxy` with `{"url":"http://169.254.169.254/"}` (curl, not the UI) | HTTP 403 |
| US2 | Nested folder save | Save a request as `a/b/c/MyRequest` | Sidebar shows collapsible `a > b > c` tree with `MyRequest` inside |
| US2 | Folder rename cascade | Rename folder `a/b` to `a/x` | All requests under `a/b/*` move to `a/x/*`; any folder-auth entries move too |
| US3 | Postman import | Import a Postman v2.x export with 2+ nested folders | Hierarchy, headers, body, auth all appear correctly in DevSuite |
| US3 | curl paste | Paste `curl -X POST https://api.example.com/x -H "Authorization: Bearer t" -d '{"a":1}'` into Code → Paste cURL | Method, header, JSON body populate the editor |
| US4 | Collection runner | Click "Run Collection" on a multi-request collection | Runner modal shows sequential per-row status; summary tallies at the end |
| US5 | Environment interpolation | Create env with `baseUrl`, use `{{baseUrl}}/get` as the URL, switch envs | Resolved URL changes with the active environment |
| US6 | Test script | Write `test("x", () => expect(1).to.equal(1))`, send | Console shows a passed-test row (`✓ x`) under a "── Tests ──" section |
| US7 | Cookie jar | Send a login request through the proxy that sets a cookie, then a follow-up request to the same domain | Second request carries the `Cookie` header automatically; Cookies modal lists it |
| US7 | Jar clears on reload | Reload the page after capturing a cookie | Cookies modal shows empty |
| US8 | Zip export/import | Export a multi-folder collection as zip, inspect the archive, re-import it | One JSON file per request in matching folders; `folderAuths` absent from the archive; round-trips cleanly |

## Automated test coverage (actual, verified against `tests/`)

```bash
node tests/javascript/run.js       # runs test_curl_codegen.js, test_cookie_jar.js, test_collection_utils.js
pytest tests/python/test_proxy_ssrf.py tests/python/test_proxy_cookies.py
```

- **`curl-codegen.js`** — covered by `tests/javascript/test_curl_codegen.js` (parse + snippet
  generation).
- **`cookie-jar.js`** — covered by `tests/javascript/test_cookie_jar.js` (parse, domain/path
  match, expiry).
- **`collection-utils.js`** — covered by `tests/javascript/test_collection_utils.js` (rename
  cascade, delete, move). `CLAUDE.md`'s "Running Tests" section now lists this file too (fixed
  2026-07-28, alongside the script-sandbox bug).
- **`/api/proxy` SSRF blocking + redirect re-validation** — `tests/python/test_proxy_ssrf.py`.
- **`/api/proxy` Set-Cookie passthrough (list, not collapsed)** — `tests/python/test_proxy_cookies.py`.

**Not covered by any automated test** (verified by absence, not just omission from CLAUDE.md):
- `api-tester.js` itself — no DOM/browser test harness exists yet (SPEC §10.1: Playwright/e2e is a
  v1.0.0 deliverable), so folder rendering, drag-and-drop, the runner loop, OAuth2 token fetch,
  Postman/OpenAPI parsing (the parsing *functions* are inline in `api-tester.js`, not factored into
  a pure module like the other three, so they inherit zero coverage even though they're logically
  pure), and the entire scripting UI wiring are all manually-verified-only.
- `script-sandbox-worker.js` — no test asserts the sign-and-execute contract; a regression here
  (like the one this fork found and fixed 2026-07-28) would not be caught by CI.
- `/api/collections` — no dedicated `require_unlocked` test scoped to this route specifically
  (general auth-gate coverage exists for the auth system itself, per SPEC §10.2, but not a
  collections-specific request/response shape test).

## Acceptance gates

- Every SC in spec.md (SC-001 through SC-006) is demonstrably true today.
- `node tests/javascript/run.js` passes for all three pure modules.
- `pytest tests/python/test_proxy_ssrf.py tests/python/test_proxy_cookies.py` passes.
