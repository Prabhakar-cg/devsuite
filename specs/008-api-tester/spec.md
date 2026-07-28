# Feature Specification: Local API Tester

**Feature Branch**: `008-api-tester`

**Created**: 2026-07-28

**Status**: Implemented (retroactive spec)

**Input**: Retroactive spec-kit conversion of DevSuite's flagship tool (SPEC.md §13: "the API Tester
is DevSuite's flagship — the one tool where the offline-first mission meets a proven market wedge
[Bruno/Postman]"). Source: `specs/SPEC.md` §4.7 (all subsections), §5.5, §5.9, §6.4, §7.8 SEC-6,
verified against `routes/pages.py`, `routes/storage.py`, `routes/proxy.py`,
`static/api-tester.{html,js,css}`, `static/api-client.js`, `static/script-sandbox-worker.js`,
`static/curl-codegen.js`, `static/cookie-jar.js`, `static/collection-utils.js`.

## Script sandbox fix (2026-07-28)

The initial retroactive-spec pass found pre-request/test script execution non-functional: the
worker's `'pre'`/`'test'` handlers both ended in a hard-coded
`throw new Error('Dynamic script text execution is disabled for security reasons.')`, and
`api-tester.js`'s `runScriptSandboxed()` never sent the `codeSig`/`authToken` the worker's
signature check required — so every run failed at that check regardless. Both were fixed the same
day: `static/api-tester.js` now generates a random per-worker-instance token on creation
(`crypto.randomUUID()`, sent via a `{kind: 'init'}` message) and HMAC-SHA256-signs each script with
it (`_signScript`, WebCrypto) before sending; `static/script-sandbox-worker.js` verifies the
signature and token, then actually executes the script via `new Function()` — legal only inside
this worker's scoped CSP (`script-src 'self' 'unsafe-eval'`, no DOM/cookies/network,
`connect-src 'none'`; document responses carry no `unsafe-eval` — SPEC §5.10, SEC-6). User Story 6
and SC-006 below describe this now-working behavior.

## Undocumented capabilities found in source (not previously in SPEC.md §4.7)

Per CLAUDE.md rule 3 ("No undocumented behavior... must be in `specs/SPEC.md`"), the following
real, shipped capabilities were found in `static/api-tester.js` with no corresponding SPEC.md
§4.7 text. They are documented here as part of this spec's user stories/requirements; folding them
back into `specs/SPEC.md` §4.7 is a follow-up (this fork's scope is limited to `specs/008-api-tester/`):

- **OAuth2 auth type** (`client_credentials` and `password`/resource-owner grants), with token
  fetch via direct request or CORS-proxy fallback, and reuse of a cached token in the Collection
  Runner (runner never opens interactive prompts — SPEC §4.7.2 only documents this OAuth2-reuse
  rule, not that OAuth2 exists as an auth type at all).
- **GraphQL body type** — dedicated query/variables Monaco panes, serialized as a JSON POST body.
- **Request History** — last 50 sent requests, kept in `localStorage` (`devsuite-api-history`), not
  DevDB. Click-to-reload into the editor.
- **Environments are stored in `localStorage`** (`devsuite-api-environments`,
  `devsuite-api-active-env`), not DevDB — only `collections` + `folderAuths` go through
  `/api/collections` into the DevDB `collections` store. SPEC.md §6.4 lists `collections` as the
  only API-Tester-owned DevDB store, which is accurate, but doesn't clarify that environments are
  browser-local (and thus **not portable across machines/exports** the way collections are).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send a REST request, directly or via the local CORS proxy (Priority: P1)

A developer testing a local or third-party API enters a URL and method, adds headers/query
params/a body, and sends the request. If the target would fail due to CORS, DevSuite routes it
through its own backend so the browser's CORS restrictions never block a legitimate local testing
session.

**Why this priority**: This is the tool's entire reason to exist — everything else (collections,
scripts, runner) is built around a single request/response round trip.

**Independent Test**: Send a GET/POST/PUT/DELETE/PATCH request to a same-origin or CORS-friendly
endpoint and confirm status/time/size/headers/body render; send a request to a cross-origin
endpoint with no CORS policy and confirm it still succeeds (proxied) rather than failing silently.

**Acceptance Scenarios**:

1. **Given** a same-origin or CORS-enabled target, **When** the user sends a bare GET, **Then** the
   request goes out directly (no proxy hop) and the response renders with status, timing, size,
   headers, and body.
2. **Given** a cross-origin target with no CORS policy and a request that will trigger a preflight
   (non-GET/HEAD/POST, an `Authorization` header, JSON `Content-Type`, or any non-safelisted
   header), **When** the user sends it, **Then** DevSuite skips the doomed direct attempt and
   routes through `/api/proxy` immediately (`ApiClient._willNeedPreflight`).
3. **Given** a cross-origin "simple" request (bare GET/HEAD or form POST, no custom headers),
   **When** the direct attempt fails, **Then** the client automatically retries once through the
   proxy and the response still renders, tagged as proxied (`resp-proxy-chip`).
4. **Given** a proxied response, **When** it renders, **Then** the response meta shows `<time> ms
   (proxy)` and a proxy banner, distinguishing it from a direct response.
5. **Given** the target IP resolves to loopback, link-local, multicast, or an IANA-reserved
   address, **When** the proxy is used, **Then** the backend returns HTTP 403 and the response
   panel shows the network error rather than silently succeeding (`routes/proxy.py`
   `_check_ip_not_private`).
6. **Given** a target redirects (3xx) toward a private/reserved IP, **When** the proxy follows the
   redirect, **Then** each hop is re-validated and the same-address-class block applies
   (`_SSRFSafeRedirectHandler`) — a public host cannot bounce the proxy into cloud metadata.

---

### User Story 2 - Organize requests into a collection with nested folders (Priority: P1)

A developer accumulates dozens of requests across a project and needs them organized the way their
file system or an IDE project tree would be — folders within folders, drag-to-reorder, rename,
duplicate, delete — without losing existing flat collections built before folders existed.

**Why this priority**: Without organization, "collection" is just an unsorted list; folder
management is what makes the tool usable past a handful of requests, and it's the single largest
subsystem in the codebase (`static/collection-utils.js` + ~800 lines of sidebar logic in
`api-tester.js`).

**Independent Test**: Save several requests into nested folder paths (`payments/v2/refunds`),
confirm the sidebar renders a collapsible tree with correct per-folder counts including nested
requests, then rename a folder and confirm every descendant request's path and any folder auth
config move with it.

**Acceptance Scenarios**:

1. **Given** the "Save Request" prompt, **When** the user types `payments/v2/refunds/Create`,
   **Then** the request is saved with `folder: "payments/v2/refunds"` and name `"Create"` — the
   **last** `/` splits name from folder path (`els.saveBtn` handler).
2. **Given** a legacy request with a single-segment `folder` value (pre-nesting), **When** the
   sidebar renders, **Then** it displays correctly with no migration step required
   (`buildFolderTree` treats any `/`-separated string uniformly).
3. **Given** a folder header, **When** the user opens its context menu, **Then** "Rename folder"
   cascades the path-prefix change to every descendant request **and** every matching
   `folderAuths` key (`CollectionUtils.renameFolder`); renaming onto an existing path merges into
   it.
4. **Given** a folder header, **When** the user chooses "Delete folder", **Then** a confirm shows
   the nested request count, and confirming removes the folder, all nested requests, and their
   `folderAuths` entries (`CollectionUtils.deleteFolder`).
5. **Given** a request row, **When** the user opens its context menu, **Then** Rename / Duplicate
   (deep copy, `(copy)` suffix, inserted after the original) / "Move to folder…" (prompt; empty
   input moves to top level) / Delete (confirm required) are all available.
6. **Given** a request row or folder header, **When** the user drags a request row and drops it on
   another request, a folder header, or empty sidebar space, **Then** it inserts before the target
   request (adopting its folder), appends into the dropped-on folder, or moves to top level,
   respectively (`CollectionUtils.moveItem`). Folders themselves are not draggable.
7. **Given** a request whose `auth.type` is `"inherit"`, **When** it is sent, **Then** DevSuite
   walks up the folder path (`resolveFolderAuth`) and applies the nearest ancestor folder's
   configured auth; the Auth tab shows which ancestor will apply (or that none is configured).

---

### User Story 3 - Import existing work from Postman, OpenAPI, or a curl command (Priority: P2)

A developer already has a Postman collection, an OpenAPI/Swagger spec, or a curl command from
documentation/Slack, and wants it usable in DevSuite immediately rather than re-entering every
field by hand.

**Why this priority**: Interop with the incumbent tools (Postman/Bruno) and with API docs (OpenAPI)
is what makes DevSuite adoptable without a migration cost — but it depends on the collection/folder
model (US2) already existing.

**Independent Test**: Import a Postman v2.x collection with nested folders and confirm hierarchy,
URL/query/headers/body/auth all translate correctly; import an OpenAPI 3.x JSON spec and confirm
one request per path×method with tag-based folders; paste a multi-line curl command with
continuations and confirm it populates the editor.

**Acceptance Scenarios**:

1. **Given** a file whose `info.schema` hostname is `schema.getpostman.com` or
   `www.getpostman.com`, **When** imported, **Then** it is parsed as Postman v2.x
   (`detectImportFormat`/`parsePostmanCollection`): nested `item` arrays become `/`-separated
   folder paths (a `/` inside one Postman folder **name** is replaced with `-` so it can't act as a
   separator), and URL/query/headers/body (raw JSON/text/GraphQL, urlencoded, form-data)/auth
   (bearer/basic/apikey) are translated.
2. **Given** a DevSuite-native export (`{items:[...]}` or a bare array), **When** imported, **Then**
   `preRequestScript`/`testsScript` fields are stripped for safety (import path explicitly omits
   them via destructuring).
3. **Given** an OpenAPI 3.x or Swagger 2.x JSON document, **When** imported via the OpenAPI modal,
   **Then** each path×method becomes one request, folder = first tag (or spec title as fallback),
   base URL resolved from `servers[0].url` (v3) or `schemes[0]://host+basePath` (v2), query/header
   parameters merged from path-item + operation level, and a JSON body example synthesized from
   the schema when no literal example is present (`buildSchemaExample`/`typeDefault`).
4. **Given** an existing non-empty collection, **When** any import completes, **Then** the user is
   asked to Replace all vs. Merge (add to existing) before the imported items are applied.
5. **Given** a curl command line (including `\`, `` ` ``, or `^` line continuations; `'…'`, `"…"`,
   and `$'…'` ANSI-C quoting), **When** pasted into "Paste cURL" and imported, **Then** method
   (`-X`), headers (`-H`), body (`-d`/`--data*`/`-F` form fields), basic auth (`-u`), inline cookies
   (`-b k=v`), URL query strings, and `-G` (query-string-as-GET) conversion are all parsed into the
   editor via `CurlCodegen.parseCurl`; unrecognized flags are silently ignored, not errors.
6. **Given** a resolved (variable-interpolated, auth-applied) current request, **When** the user
   opens the Code modal, **Then** cURL, JavaScript `fetch`, and HTTPie snippets are generated
   (`CurlCodegen.buildCurl/buildFetch/buildHttpie`), each with a one-click copy button.

---

### User Story 4 - Run a whole folder or collection unattended (Priority: P2)

A developer wants to smoke-test every request in a folder (or the entire collection) in one action,
see per-request pass/fail at a glance, and stop early if something looks wrong — without manually
clicking Send N times.

**Why this priority**: Turns a request collection into a lightweight regression suite; depends on
folders (US2) for scoping and on the request-execution path (US1) for each item.

**Independent Test**: Run a folder containing several requests with a mix of passing and failing
targets; confirm every item runs sequentially in sidebar order, per-row status/timing renders live,
the summary footer tallies requests/tests/wall time, and Stop halts after the in-flight request
completes.

**Acceptance Scenarios**:

1. **Given** a folder's "Run folder" button or the top-level "Run Collection" button, **When**
   clicked, **Then** all requests in that scope (including nested subfolders, via
   `collectTreeItems`) run sequentially in sidebar display order inside the runner modal.
2. **Given** a run in progress, **When** each request completes, **Then** its row updates from
   `pending` → `running…` → a final status (`<code> · <ms>`, colored ok/err) plus a `tests X/Y`
   badge if the item has test results.
3. **Given** an item's `preRequestScript`/`testsScript`, **When** run, **Then** the pipeline is
   pre-script → request (cookie jar applied) → test script, per request.
4. **Given** `ds.setVar` calls across a run, **Then** `runtimeVars` persist for the **whole run**
   (reset once at the start), unlike a single Send which resets them per-click — enabling request
   chaining across the run.
5. **Given** a run in progress, **When** the user clicks Stop, **Then** the in-flight request is
   allowed to finish and all remaining rows are marked `skipped`; the run does not abort mid-request.
6. **Given** an item whose auth is `oauth2`, **When** the runner executes it, **Then** it reuses an
   already-cached token if one was fetched via the Auth tab; otherwise it runs with `auth: {type:
   "none"}` — the runner never opens an interactive token-fetch prompt.
7. **Given** the run completes, **When** the summary renders, **Then** it shows `<done> of <total>
   requests in <secs>s`, aggregate tests-passed/failed, and a count of requests that errored.

---

### User Story 5 - Reuse values across requests with environments and variable interpolation (Priority: P2)

A developer switches between local/staging/prod targets by swapping one active environment rather
than editing every request's URL, headers, and body by hand, and can import an existing Postman
environment file instead of re-typing variables.

**Why this priority**: Cross-cutting convenience used by every other story (URL, headers, body, and
folder-auth fields all interpolate `{{var}}` tokens); ranked below the structural stories (US1/US2)
because it's an accelerant, not a precondition.

**Independent Test**: Create an environment with a `baseUrl` variable, reference `{{baseUrl}}/path`
in a request URL, switch environments, and confirm the resolved URL changes; import a Postman
environment export and confirm disabled variables are skipped and a same-name environment is
replaced in place.

**Acceptance Scenarios**:

1. **Given** `{{key}}` anywhere in URL, query params, headers, or body, **When** the request is
   built, **Then** `interpolate()` substitutes a matching `runtimeVars` value first, then the
   active environment's `vars[key]`, and leaves `{{key}}` untouched if neither exists.
2. **Given** the Environment Manager modal, **When** the user adds/edits/deletes an environment,
   **Then** changes persist to `localStorage` (`devsuite-api-environments`) — **not** DevDB, so
   environments are per-browser and are not included in collection export/import.
3. **Given** a file with `_postman_variable_scope: "environment"` or `{name, values:[{key,
   value, enabled}]}`, **When** imported, **Then** it is parsed as a Postman environment: disabled
   variables (`enabled === false`) are skipped, and an existing environment with the same `name` is
   replaced in place rather than duplicated.
4. **Given** a bare array `[{id, name, vars}]`, **When** imported, **Then** it is treated as
   DevSuite-native environments.

---

### User Story 6 - Assert and chain with pre-request and test scripts (Priority: P2)

A developer writes a small script that runs before a request (to compute a signature, set a
variable) or after the response (to assert a status code or a JSON field), using a constrained
`ds`/`console`/`test`/`expect` API, isolated from the page's DOM, cookies, and network.

**Why this priority**: This is the feature that makes DevSuite's collection runner a real
regression tool (parity with Postman/Bruno pre-request & test scripts).

**Independent Test**: Write a test script asserting `expect(ds.response.status).to.equal(200)`;
send a request; expect a passed-test row in the Console.

**Acceptance Scenarios**:

1. **Given** a pre-request script using `ds.setVar`/`ds.setEnvVar`, **When** the request runs,
   **Then** the variable is available via `{{key}}` interpolation in that same send.
2. **Given** a test script with `test(name, fn)` blocks using `expect(val).to.<matcher>(...)`
   (`equal`, `include`, `property`, `status`, `ok`, `above`, `below`, `a`), **When** the response
   arrives, **Then** each block's pass/fail renders in the Console with a summary badge
   (`passed/total`).
3. **Given** a script that runs longer than 10 seconds, **When** executed, **Then** the worker is
   terminated and lazily recreated on the next run, and the Console reports a timeout rather than
   freezing the UI (`SCRIPT_TIMEOUT_MS` in `api-tester.js`).
4. **Given** the worker's own HTTP response, **When** served, **Then** it carries a scoped CSP
   (`default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'`) distinct from every
   document response (which carries no `unsafe-eval`) — this isolation boundary is real and
   verified in `main.py`'s security-headers middleware and `tests/python/test_csp.py`, independent
   of the sandbox execution path.

---

### User Story 7 - Cookies flow automatically between requests, without ever touching disk (Priority: P3)

A developer testing a session-based API (login → authenticated calls) doesn't want to manually copy
a `Set-Cookie` value into a header on every subsequent request, but also doesn't want DevSuite to
silently persist session cookies to disk.

**Why this priority**: Convenience for a common flow (auth-cookie session testing), scoped
narrowly (proxied traffic only) and explicitly excluded from persistence as a security boundary.

**Independent Test**: Send a login request through the proxy that returns `Set-Cookie`; send a
follow-up request to the same domain and confirm the cookie is attached automatically; reload the
page and confirm the cookie jar is empty.

**Acceptance Scenarios**:

1. **Given** a **proxied** response with one or more `Set-Cookie` headers, **When** it returns,
   **Then** each is parsed (`CookieJar.parse`, RFC 6265 domain/path/expiry rules) and upserted into
   the in-memory jar; a direct (non-proxied) response's cookies are handled by the browser itself
   and are **not** captured (fetch cannot read `Set-Cookie`).
2. **Given** an outgoing request (Send or Runner) to a URL with matching jar cookies (domain suffix
   match, path prefix match, not expired, `Secure` only sent over https), **When** it is sent,
   **Then** a `Cookie` header is attached automatically — unless the request already sets one
   manually (`executeWithJar` checks for an existing `Cookie` header first).
3. **Given** the Cookies modal, **When** opened, **Then** cookies are listed grouped by domain
   (name, value, path, expiry) with per-cookie delete and a clear-all action.
4. **Given** any page reload, **When** the page re-initializes, **Then** the cookie jar is empty —
   it is a plain in-memory array (`const cookieJar = []`) with no DevDB/localStorage/disk write
   path anywhere in the codebase (verified: no `cookieJar` reference outside `api-tester.js`'s
   module scope).

---

### User Story 8 - Export and import a collection as a git-friendly zip (Priority: P3)

A team wants to commit their API collection to a git repo the way they would source code — one
file per request, readable diffs, no secrets baked into the file tree.

**Why this priority**: Enables a workflow DevSuite explicitly favors over live file-based
collections (SPEC.md §13 "Deliberate non-goals vs Bruno"); lower priority than the core flows since
it's an export/interop convenience, not a daily-use path.

**Independent Test**: Export a collection with 3 nested folders to zip; inspect that folder auth
configs are absent and each request is its own pretty-printed JSON file; import the same zip back
and confirm a round trip with no data loss.

**Acceptance Scenarios**:

1. **Given** a non-empty collection, **When** "Export as zip" runs, **Then** one pretty-printed
   JSON file per request is written into a directory tree mirroring folder paths, plus a
   `collection.meta.json` manifest (`{format: "devsuite-collection-zip", version: 1,
   exportedAt}`), built client-side with the vendored JSZip.
2. **Given** request/folder names containing filesystem-unsafe characters
   (`/ \ : * ? " < > |` or control chars), **When** exported, **Then** they are replaced with `-`
   (`sanitizeFileName`) and name collisions get a numeric suffix (`request (2).json`, …).
3. **Given** any exported zip, **When** inspected, **Then** `folderAuths` never appears anywhere in
   it — folder auth configs are deliberately excluded because the zip is meant to be committed to
   git and may otherwise leak tokens/passwords.
4. **Given** a `.zip` file selected via the existing collection-import control, **When** imported,
   **Then** every `*.json` entry except the manifest becomes a request whose folder path is the
   entry's directory path; if any imported request carries `preRequestScript`/`testsScript`, the
   user is asked whether to keep them (default path strips scripts) before merge/replace.

---

### Edge Cases

- **CSP boundary on `connect-src 'self'`**: because the document CSP restricts `connect-src` to
  `'self'`, a "simple" cross-origin request's direct-first attempt is, in practice, *always*
  blocked before it reaches the network — so the fallback-to-proxy path always fires. SPEC.md §4.7
  calls this out explicitly as "tracked as an open design decision, see §13 backlog" and this spec
  preserves that framing rather than treating it as resolved.
- **`useGet` / `-G` curl flag with existing query string**: `-G` reinterprets `-d` data parts as
  query params rather than body — verified against `_applyDataParts` in `curl-codegen.js`.
- **Postman folder name containing `/`**: replaced with `-` on import so it cannot be
  misinterpreted as a nested path separator.
- **Duplicate `Set-Cookie` headers on one proxied response** (e.g. a session cookie + a CSRF
  cookie): `routes/proxy.py`'s `_collect_set_cookies` uses `headers.get_all("Set-Cookie")`
  specifically because `dict(headers)` would collapse duplicates and silently drop one.
- **Environment not exported with a collection**: since environments live in `localStorage`, a
  collection zip/JSON export shared with a teammate carries no environment data — this is implicit
  in the storage split, not stated anywhere in the UI.
- **OAuth2 config change without re-fetch**: changing any OAuth2 field (URL, client ID/secret,
  scope, grant type, username/password) clears the cached token (`clearOAuth2Token` wired to every
  relevant `input`/`change` listener) so a stale token is never silently reused after edits.
- **Import replace vs. merge on an empty collection**: the replace/merge confirm dialog is only
  shown when `collections.length > 0`; importing into an empty collection always just adds.

## Requirements *(mandatory)*

### Functional Requirements

**Core request/response (US1)**

- **FR-001**: The system MUST support GET, POST, PUT, DELETE, PATCH with custom headers, query
  params, and body (JSON, form-data, raw text, GraphQL).
- **FR-002**: The system MUST route a cross-origin request that will trigger a CORS preflight
  through the local proxy immediately, and MUST fall back to the proxy on a failed direct attempt
  for cross-origin "simple" requests.
- **FR-003**: The proxy backend MUST reject requests whose target resolves to loopback,
  link-local, multicast, or IANA-reserved addresses (HTTP 403), including on every redirect hop,
  while permitting RFC-1918 LAN addresses.
- **FR-004**: The proxy response MUST preserve every `Set-Cookie` header individually (not
  collapsed) so the cookie jar can process each one.

**Collections & folders (US2)**

- **FR-005**: Requests MUST be persisted with a `/`-separated `folder` path; single-segment legacy
  values MUST remain valid with no migration step.
- **FR-006**: Renaming or deleting a folder MUST cascade to every descendant request's folder path
  and every matching `folderAuths` key.
- **FR-007**: A request with `auth.type: "inherit"` MUST resolve to the nearest ancestor folder's
  configured auth by walking up the folder path.
- **FR-008**: `/api/collections` (GET and POST) MUST enforce `require_unlocked` server-side —
  authorization is not solely a frontend (`auth-guard.js`) concern.

**Import/export & codegen (US3, US8)**

- **FR-009**: The system MUST auto-detect DevSuite-native vs. Postman v2.x collection JSON, and
  MUST strip scripts from DevSuite-native imports by default.
- **FR-010**: The system MUST import OpenAPI 3.x and Swagger 2.x JSON specs, producing one request
  per path×method with tag/title-derived folders.
- **FR-011**: The system MUST parse curl command lines (method, headers, data/form body, basic
  auth, inline cookies, query strings, `-G`) with unsupported flags ignored rather than erroring.
- **FR-012**: The system MUST generate cURL, `fetch`, and HTTPie snippets from the resolved
  (interpolated, auth-applied) current request.
- **FR-013**: Zip export MUST exclude `folderAuths` entirely and MUST sanitize file/folder names
  for filesystem safety with collision-safe numeric suffixes.

**Runner (US4)**

- **FR-014**: Running a folder or the whole collection MUST execute every included request
  sequentially in sidebar order, applying pre-request → request (with cookie jar) → test script
  per item, and MUST allow the user to stop after the in-flight request completes.
- **FR-015**: `runtimeVars` set during a run MUST persist across the whole run (not reset per
  item), distinct from a single Send which resets them.
- **FR-016**: OAuth2 items in the runner MUST reuse an already-fetched token or run unauthenticated
  — the runner MUST NOT open an interactive prompt.

**Environments & scripting (US5, US6)**

- **FR-017**: `{{key}}` tokens in URL/headers/query/body MUST resolve against `runtimeVars` first,
  then the active environment's vars, and MUST be left untouched if unresolved.
- **FR-018**: Postman environment import MUST skip variables with `enabled === false` and MUST
  replace an existing same-name environment in place.
- **FR-019**: Pre-request and test scripts MUST execute inside the dedicated Web Worker sandbox,
  never via `new Function()`/`eval` in the document context, and MUST be terminated after a
  10-second timeout. Each script MUST be HMAC-signed by the main thread under a random
  per-worker-instance token before being sent, and the worker MUST reject any script whose
  signature or token does not match.

**Cookies (US7)**

- **FR-020**: The cookie jar MUST be in-memory only for the page's lifetime — no DevDB,
  `localStorage`, or disk persistence path may exist for it.
- **FR-021**: Only cookies from **proxied** responses may be captured (direct-response
  `Set-Cookie` is inaccessible to `fetch` and MUST NOT be simulated or worked around).

### Key Entities

- **Collection Item**: one saved request — method, URL, query params, headers, auth config, body
  (typed by `bodyType`), optional GraphQL query/vars, optional folder path, optional
  pre-request/tests scripts, optional name.
- **Folder** *(implicit, derived)*: not a stored entity — a folder is any distinct prefix that
  appears in one or more items' `folder` paths; the sidebar tree is rebuilt from item paths on
  every render (`buildFolderTree`).
- **Folder Auth Config**: keyed by full folder path in `folderAuths`; not itself associated with
  any single request, resolved at send-time via ancestor walk.
- **Environment**: `{id, name, vars: {key: value}}`, browser-local (`localStorage`), independent of
  the DevDB-persisted collection.
- **Cookie Jar Entry**: `{name, value, domain, hostOnly, path, expires, secure}`, in-memory only.
- **Runtime Variables**: an ephemeral key/value map, reset per Send and reset-once-per-Run in the
  Runner; written by pre-request/test scripts via `ds.setVar`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can send a request to any reachable HTTP/HTTPS target — same-origin,
  CORS-friendly cross-origin, or CORS-hostile cross-origin — and get a rendered response without
  manually configuring a proxy or seeing a raw browser CORS error.
- **SC-002**: Renaming or deleting a folder with N nested requests updates all N requests' paths
  (and any folder-auth entries) in a single action, verified by `CollectionUtils`'s pure-function
  design (unit-testable independent of the DOM).
- **SC-003**: A Postman v2.x export with nested folders round-trips into DevSuite with the same
  folder hierarchy, and DevSuite's own zip export round-trips back into DevSuite with no data loss
  (scripts included only when the user opts in on import).
- **SC-004**: A collection run of N requests processes all N (even with failures/timeouts among
  them), and Stop always allows the in-flight request to finish before halting.
- **SC-005**: Cookies captured from proxied login responses are automatically attached to
  subsequent same-domain requests within the same page session, and are provably gone (empty jar)
  after any page reload.
- **SC-006**: A test script asserting a response field produces a pass/fail result in the Console.

## Assumptions

- **The CORS-routing "always proxies in practice" behavior is accepted as current-shipped
  behavior**, per SPEC.md §13's explicit backlog item — not treated as a bug to silently fix in
  this documentation pass.
- **The sandbox's signing token defends against a co-loaded/compromised third-party script, not
  against a fully-compromised main-thread context** — code capable of calling
  `_signScript`/`postMessage` directly (e.g. injected via an XSS in `api-tester.js` itself) already
  has the same execution power the sandbox grants; the boundary that matters against *that* threat
  is the worker's own scope (no DOM/cookies/network) and its `connect-src 'none'` CSP, not the
  signature check.
- **Environments and History are intentionally browser-local** (not cross-machine, not included in
  collection export) — treated here as an accepted design choice consistent with DevDB being
  reserved for data that must survive a `.dsb` export/import (collections, vault, ssh profiles),
  though SPEC.md does not currently state this distinction explicitly.
- **OAuth2 and GraphQL support are treated as already-shipped, stable capabilities** worth
  documenting fully here even though SPEC.md §4.7 predates them — not marked `NEEDS
  CLARIFICATION` since the code is unambiguous about their behavior.
