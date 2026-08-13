# Changelog

All notable changes to this project will be documented in this file.
Versions follow [Semantic Versioning](https://semver.org/). This log was reset at **v0.1.0** to establish a clean baseline reflecting the current full feature set.

---

## [Unreleased]

### Features

#### File Format Converter: TOON support + completed XML matrix + array-name bug fix (`static/file-converter.html`, `static/toon.js`)
- Adds TOON as a sixth node in the client-side structured-data conversion cluster: JSON, CSV, TSV, YAML, XML, and TOON now each convert to all five of the others, entirely client-side, no `/api/convert` round-trip. TOON conversion uses a new shared module, `static/toon.js` — extracted from Data Format Linter's TOON tab (specs/016-data-linter) rather than duplicated, since both tools needed the identical ~250-line codec. Follows the existing `curl-codegen.js`/`cookie-jar.js`/`collection-utils.js` browser/node dual-export pattern; `tests/javascript/test_toon.js` gives this codec real automated coverage (the first this converter tool has ever had for any client-side conversion logic).
- Completes the XML matrix, which was previously a one-way dead end (JSON→XML existed; nothing converted *from* XML except back to JSON): adds XML→CSV/TSV/YAML, YAML→XML, CSV→XML, TSV→XML — all client-side, reusing the existing `jsonToXml`/`xmlToJson` bridge functions.
- **Bug fix**: `jsonToXml` previously dropped a field's tag name entirely when its value was an array (`{"roles":["a","b"]}` → the `roles` wrapper vanished, its items emitted as bare `<item>` siblings under the parent) — found while wiring the completed XML matrix, since every new conversion path through XML would otherwise have inherited this silent data-loss bug. Arrays are now wrapped in their own tag with repeated `<item>` children; `xmlToJson`'s decode side gained a matching case so the array round-trips cleanly (scalar items typed via the same null/true/false/number inference TOON's decoder uses), while the pre-existing `@attributes`/`{"#text": ...}` handling for all other XML content (arbitrary/foreign XML this tool also accepts) is unchanged.
- Also found (and independently fixed) while building `016-data-linter`'s own XML bridge — same bug, two separately-implemented copies, both now correct.
- `specs/013-file-converter/spec.md` updated: User Story 5, FR-011/012/013, new Edge Cases, SC-005, Assumptions. `research.md` R5-R6 record the shared-module and bug-fix decisions, including the verification method (Python mirrors of both the encode well-formedness check and the exact decode algorithm).

#### Data Format Linter: auto-detect the pasted content's format (`static/data-linter.html`)
- Pasting content (toolbar Paste button, or native Ctrl/Cmd+V into the editor) now offers to switch to the tab matching what was pasted, via a new `detectFormat()` heuristic: XML (leading `<`) → TOON (only when a `key[N]`/`[N]` bracket-length array header is present) → JSON (any strict parse, including bare literals) → YAML (only when the parse result is a real mapping/sequence, not a bare scalar — plain prose is deliberately not detected as YAML) → TOON (generic) → XML (fallback). A new toolbar Detect button runs the same check on-demand against whatever's already in the editor.
- Manual tab selection is untouched and always available — detection only ever fires on paste or an explicit Detect click, never on typing (`onDidChangeModelContent` is not a trigger), so composing content on a deliberately chosen tab is never interrupted or second-guessed.
- `specs/016-data-linter/spec.md` updated: FR-012, new User Story 7, new SC-006, new Edge Cases/Assumptions, new Detected Format entity. `research.md` R9-R10 record the priority-ordering and trigger-point decisions, including the empirical verification (13 cases, using the real vendored `js-yaml` bundle loaded via Node `require()`) that ambiguous cases (bare JSON valid under YAML too; plain `key: value` valid under both YAML and TOON; plain prose trivially "valid" YAML) all resolve the way a user would expect.

#### Data Format Linter: any-to-any conversion + new TOON format (`static/data-linter.html`)
- Every tab now converts to every other tab (JSON/YAML/XML/TOON), replacing the narrower JSON→YAML and YAML→JSON/JSON-min buttons the initial consolidation shipped. Conversion routes every format through a shared canonical plain-JS-value representation (`toCanonicalValue`/`fromCanonicalValue`) rather than 12 bespoke pairwise converters — JSON and YAML's parsers already produced this shape; XML and TOON each get a new bridge function.
- Adds a 4th tab, TOON ([Token-Oriented Object Notation](https://github.com/toon-format/spec)) — a first-party encoder/decoder implementing the format's "sweet spot" (comma-delimited, 2-space indent, tabular arrays for uniform arrays of flat objects, list form otherwise). No TOON library is vendored; nested tabular field-groups are a documented gap (falls back to list form on encode, rejected as a parse error on decode) rather than silent data loss. Reachable via `/data-linter?tab=toon` — no bare `/toon` legacy route, since it postdates any bookmarkable history.
- Converting to/from XML wraps named array fields in their own element with repeated `<item>` children (`{"roles":["a","b"]}` → `<roles><item>a</item><item>b</item></roles>`) so the field name survives the round trip — this fixes a data-loss bug found (but not touched) in `013-file-converter`'s existing `jsonToXml`/`xmlToJson`, which silently drops a field's tag for array values. XML leaf-text is inferred as `null`/`true`/`false`/number/string the same way TOON decodes its own unquoted scalars, for round-trip fidelity; XML attributes are not carried through this conversion path (XML's own Validate/Format/Minify are unaffected, since those never leave XML's DOM representation).
- `specs/016-data-linter/spec.md` updated: FR-010/011/012, new User Story 6, revised User Story 3 scenarios (conversion buttons moved out of the per-format FRs), new SC-005, new Edge Cases/Assumptions. `research.md` R6–R8 record the conversion-hub, XML-bug-fix, and shared-scalar-inference decisions.

#### Consolidated tool: Data Format Linter (`static/data-linter.html`, `routes/pages.py`)
- Replaces the standalone JSON Linter, YAML Linter, and XML Linter with one tool, `/data-linter`, presenting a JSON/YAML/XML tab strip that switches in-page with no reload. Tool count moves 13 → 11. Every action the three predecessors offered is preserved unchanged: JSON gets Validate/Format/Minify/Sort Keys/→YAML; YAML gets Validate/Format/→JSON/→JSON (min); XML gets Validate/Format/Minify. A single shared Monaco input model means switching tabs preserves the input text; the output pane resets on every switch (deliberate — avoids showing a result mislabeled under the wrong format) and live validation restarts against the newly active tab's parser.
- `/json`, `/yaml`, and `/xml` keep resolving as direct 200s (not redirects), each defaulting to its matching tab, so existing bookmarks don't break; the primary route also accepts `?tab=json|yaml|xml`. One backend function (`read_data_linter_tool` in `routes/pages.py`) is stacked with four `@router.get(...)` decorators, all serving `static/data-linter.html`.
- No new third-party dependency — JSON uses native `JSON.parse`/`stringify`, YAML reuses the already-vendored `js-yaml`, XML reuses the native `DOMParser`/`XMLSerializer`, carried over near-verbatim from each predecessor.
- `specs/016-data-linter/` (spec, plan, research, data-model, contracts, quickstart, tasks) added; `specs/003-json-linter/spec.md`, `specs/004-yaml-linter/spec.md`, and `specs/015-xml-linter/spec.md` marked `Status: Superseded` (kept for record — their functional requirements remain the source of truth for exact per-format behavior). `specs/SPEC.md` §3.2/§3.4/§4/§5.1 updated; tool count moved 13 → 11 across `static/tools.html`, `static/home.html`, and `README.md`. `static/json.html`, `static/yaml.html`, and `static/xml.html` deleted.

#### New tool: XML Linter & Validator (`static/xml.html`, `routes/pages.py`)
- Adds a 13th tool at `/xml`, following the existing JSON/YAML Linter pattern (`static/json.html`, `static/yaml.html`): a two-pane Monaco editor validating XML well-formedness live (600ms debounce) and on demand (Validate button / `Ctrl+Cmd+Enter`), plus Format (2-space pretty-print) and Minify actions. No schema/XSD/DTD validation, no XPath/XSLT, no XML↔JSON conversion (that stays with the File Format Converter) — scope is well-formedness only.
- Parses with the browser's native `DOMParser`/`XMLSerializer` — no new third-party library is vendored, so no `SPEC.md §11`/`UPGRADE_PLAN.md` update was needed. Malformed-XML detection uses the standard `parsererror` DOM check (`DOMParser` never throws). Format and Minify both special-case mixed content and CDATA so meaningful text is never altered — only whitespace-only text nodes between tags are touched.
- `specs/015-xml-linter/` (spec, plan, research, data-model, contracts, quickstart, tasks) added; `specs/SPEC.md` §3.2/§3.4/§4/§5.1 updated with the new route and module-map row; tool count moved 12 → 13 across `static/tools.html`, `static/home.html`, and `README.md`.

#### Secret Vault: encrypted export/restore backup (`static/vault.html`, `static/vault.js`, `static/vault.css`)
- New "Backup" / "Restore" controls in the vault header (BACKLOG SEC-9). Backup re-encrypts the current in-memory entries with the session's key and downloads a self-contained `devsuite-vault-backup-<date>.json` — no new server endpoint; the file holds only AES-256-GCM ciphertext plus its salt/IV, never plaintext.
- Restore reads a chosen backup file, derives the decryption key from a user-supplied password and the backup's own embedded salt (same v2 PBKDF2-SHA256/310k scheme as normal unlock), then re-persists the recovered entries under the *current* session's key via the existing `POST /api/vault` — so a backup can be restored into a vault protected by a different current master password. Wrong password or a malformed/foreign file is rejected without touching the current vault. `specs/011-secret-vault/spec.md` updated (US7, FR-017/018, SC-006, Key Entities, Assumptions).

#### Cron Visualizer: Day-of-Month grid in the Visual Field Builder (`static/cron.js`)
- The Field Builder previously rendered only Minute, Hour, Month, and Day-of-Week grids; day-of-month could only be edited by typing in the expression. Added a click-to-toggle Day-of-Month grid (1–31, 8 columns), rendered between Hour and Month to match cron field order, for all four dialects.
- Clicking a cell when the field is the Quartz/AWS `?` wildcard now behaves like `*`: it selects only the clicked value instead of expanding into a 30-value list. `SPEC.md` §4.9 updated.

### Improvements

#### API Tester: manual Proxy Mode override (`static/api-client.js`, `static/api-tester.js`, `static/api-tester.html`)
- Previously the direct-vs-proxy routing decision was fully automatic — no way to force one path or the other. Added a "Proxy mode" selector in the request bar: **Auto** (existing smart routing, unchanged default), **Force Direct** (always attempt directly, and — unlike Auto — never silently retry through the proxy on failure, so a real CORS/network error renders as-is, matching what an actual browser client would see), and **Force Proxy** (always route through `/api/proxy`, skipping a known-doomed direct attempt).
- `proxyMode` is persisted per request alongside auth/body/headers (history, saved collection items, collection runner) and defaults to `auto` for requests saved before this field existed. `specs/008-api-tester/spec.md` updated (US1 scenarios 7–8, FR-004b, Key Entities).

#### JWT experience consolidated and made discoverable (`static/crypto.html`, `static/base64.html`, `static/tools.html`, `static/home.html`)
- The marketing site's "Coming Soon" roadmap advertised a "JWT Inspector" that had, in fact, already shipped — better — as a tab in Crypto Suite (decode + live claims/expiry + real HS256/384/512 & RS256 signature verification via `crypto.subtle`). Removed the stale roadmap card from `tools.html` and the `home.html` teaser; the Crypto Suite tool card now names JWT and Base64 explicitly instead of only listing Hash/AES/RSA.
- The standalone Base64 tool's JWT panel is decode-only by design and previously labeled its signature segment "(signature — verify server-side)" — misleading, since no server-side JWT verify endpoint exists anywhere in DevSuite. Copy fixed, and the panel now links directly to Crypto Suite's JWT tab (`/crypto?tab=jwt`, new lightweight `?tab=` deep-link support in `crypto.html`) for anyone who needs real verification.
- Crypto Suite's JWT tab previously reported an unsupported `alg` (e.g. `none`, `ES256`) as a generic "Signature INVALID", indistinguishable from a real failed verification. It now flags the `alg` chip with an "UNSUPPORTED" badge, disables the Verify control, and shows an explicit "not supported for client-side verification" message instead.
- `BACKLOG.md` FEAT-4 closed (was tracking a "JWT Debugger" that already existed under a different name). `specs/007-crypto-suite/spec.md` and `specs/006-base64-encoder/spec.md` updated to reflect the fixes.

### Bug Fixes

#### Secret Vault master-password setup threw "DevSuite is not defined" (`static/vault.html`)
- `vault.html` loaded `theme.js`, `crypto-js.min.js`, and `vault.js`, but never `components.js` — the file that defines the `DevSuite` global. On the master-password setup path, `vault.js` calls `_csrfToken()` → `DevSuite.csrfToken()`, which threw `ReferenceError: DevSuite is not defined`, so setting a new vault password failed. Added `<script src="/static/components.js">` before `vault.js`, matching every other DevSuite-dependent page.
- Regression guard extended: `tests/python/test_asset_order.py` now asserts `/vault` serves `components.js` before `vault.js`. `SPEC.md` §3.4 Module-to-File Map and the `components.js` file descriptions in `SPEC.md`/`README.md` updated to list the `DevSuite.csrfToken` dependency.

---

## [0.3.0] — 2026-06-10 (API Tester: Daily Driver)

Strategic release: the API Tester is now DevSuite's flagship (SPEC §13). Seven new capabilities close the daily-driver gap against Bruno/Postman, and the work doubles as a security release — the scripting engine moved into an isolated Web Worker, removing `unsafe-eval` from every document response (SEC-6 closed, SEC-7 partial).

### Security

#### Script sandbox — `unsafe-eval` removed from the document CSP (SEC-6 / SEC-7) (`main.py`, `static/script-sandbox-worker.js`, `static/api-tester.js`)
- Pre-request/test scripts no longer execute via `new Function()` on the page. They run inside a dedicated Web Worker with **no DOM, no cookies, and no network** — the worker's response carries its own scoped CSP (`default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'`), applied by a path check in the security-headers middleware.
- Document responses now carry `script-src` **without** `unsafe-eval` (was a hard CSP debt since the scripting feature shipped).
- Scripts that run longer than 10 s are terminated (worker killed and lazily recreated) — a hung script can no longer freeze the tab.
- Variable writes (`ds.setVar` / `ds.setEnvVar`) are returned as mutations and applied by the main thread after completion.
- New tests: `tests/python/test_csp.py` (document vs. worker CSP split, security headers).

#### Proxy `Set-Cookie` passthrough (`routes/proxy.py`)
- `dict(resp.headers)` collapses duplicate headers, so multi-cookie responses (session + CSRF) lost cookies. The proxy response now includes a `set_cookie` list with every `Set-Cookie` header verbatim (SPEC §5.9). New tests: `tests/python/test_proxy_cookies.py`.

#### `Referrer-Policy` header now actually sent (`main.py`)
- SPEC §5.10 listed `Referrer-Policy: strict-origin-when-cross-origin` but the middleware never set it. Now sent on every response. (SPEC §5.10's `X-XSS-Protection` line also corrected to the `0` the code has sent since v0.2.2.)

#### CORS proxy SSRF guard relaxed for LAN targets (`routes/proxy.py`)
- `_check_ip_not_private` no longer blocks RFC-1918 private ranges (`10.x.x.x`, `192.168.x.x`, `172.16–31.x.x`) — DevSuite is a loopback-only local tool, and testing LAN APIs through the CORS proxy is a first-class use case. Loopback (`127.x` / `::1`), link-local / cloud-metadata (`169.254.x`), multicast, and IANA-reserved addresses remain blocked. SPEC §4.8/§5.9/§10.2 updated; new test `test_check_ip_allows_private_lan` in `tests/python/test_proxy_ssrf.py`.

#### Middleware order fixed — CORS outermost (`main.py`)
- `CORSMiddleware` is now registered last (Starlette wraps inner-first, outer-last), making it the outermost layer so `OPTIONS` preflights are answered before any other middleware runs. Previously `SlowAPIMiddleware` was outermost, so preflight requests counted against (and could be rejected by) the rate limiter.

### Features

#### Collection runner (SPEC §4.7.2)
- Run a folder (including subfolders) or the entire collection sequentially, in sidebar order. Per-request rows show method, name, status, duration, and test pass counts; footer summarizes totals and wall time. **Stop** halts after the in-flight request.
- `runtimeVars` persist across the whole run — `ds.setVar` in one request is visible to the next (request chaining). Single Send still resets them.
- Saved requests execute without touching the form (`buildConfigFromItem` mirrors the Send pipeline, including folder-auth inheritance and the cookie jar).

#### cURL import + code generation (SPEC §4.7.3, `static/curl-codegen.js`)
- New **Code** button: copy the resolved current request (variables interpolated, auth applied) as **cURL**, **fetch**, or **HTTPie**.
- **Paste cURL** imports a curl command into the editor — method, headers, `-d/--data*` bodies, `-F` forms, `-u` basic auth, `-b` cookies, `-G` query conversion, URL query strings, multi-line `\` / `` ` `` continuations. Unsupported flags are ignored.

#### Nested folders (SPEC §4.7.4)
- `item.folder` is now a `/`-separated path; the sidebar renders a collapsible tree (counts include nested requests). Legacy single-level folders remain valid — no migration.
- "Save Request" accepts `folder/subfolder/Name` (last `/` separates the name).
- **Postman import preserves folder hierarchy** (previously flattened to one level).
- Folder auth is keyed by full path; requests with `inherit` walk **up** the path to the nearest configured ancestor, and the Auth tab names which folder will apply.
- Per-folder **run** button added next to the folder-auth lock.

#### Smart CORS routing (`static/api-client.js`)
- New `_isCrossOrigin()` / `_willNeedPreflight()` helpers: cross-origin requests that would trigger a CORS preflight (custom headers such as `Authorization`, JSON bodies, `PUT`/`PATCH`/`DELETE`) now route straight to the local proxy instead of attempting a doomed direct fetch first — eliminating the double round-trip, the DevTools CORS error noise, and the visible latency spike. Simple requests (bare `GET`/`HEAD`, form `POST`, no custom headers) still try direct first and fall back to the proxy. (See the Documentation note below: the document CSP's `connect-src 'self'` currently forces the proxy path for all cross-origin requests — an explicit v0.3.x decision item.)

#### Cookie jar (SPEC §4.7.5, `static/cookie-jar.js`)
- Session-scoped, in-memory jar (never persisted). Captures `Set-Cookie` from proxied responses; attaches matching cookies (RFC 6265 domain/path/expiry/Secure matching) to Send and runner requests unless a manual `Cookie` header is set.
- New **Cookies** modal: grouped by domain, per-cookie delete, clear all; header badge shows the live count.

#### Git-friendly zip export / import (SPEC §4.7.6)
- Export the collection as a zip with one pretty-printed JSON file per request, directories mirroring folder paths, plus a `collection.meta.json` manifest — built client-side with the already-vendored JSZip. Folder auth configs are deliberately **not** exported (they can contain secrets; the zip is meant for git).
- The import button now also accepts `.zip` and round-trips the export. Scripts found in imported files are stripped by default with an opt-in confirm to keep them (they only run inside the sandbox worker).

#### Sidebar request & folder management (SPEC §4.7.4)
- Context menu per request row: **Rename · Duplicate · Move to folder… · Delete** (delete is now confirm-guarded; replaces the bare one-click ✕ button).
- Context menu per folder header: **Rename folder** — the path-prefix change cascades to all descendant requests and `folderAuths` keys (renaming onto an existing path merges) — and **Delete folder**, with the nested request count shown in the confirm.
- **Drag & drop**: drop a request on another request to insert before it (adopting its folder), on a folder header to file it there, or on empty sidebar space to move it to top level. Folders themselves are not draggable.
- Reorder/rename/delete logic lives in `static/collection-utils.js` (pure module, browser/node dual export).

### Bug Fixes

#### JSZip load order killed the entire API Tester page
- `jszip.min.js` (UMD) was initially added *after* `require.min.js`; with `define.amd` present, JSZip registered as an anonymous AMD module instead of setting `window.JSZip`, and RequireJS threw "Mismatched anonymous define()" on the page's first `require()` call — aborting `api-tester.js` before any event listener attached (every button and tab dead). JSZip now loads before RequireJS, matching the existing `index.html` ordering.
- Regression guard added: `tests/python/test_asset_order.py` asserts UMD-before-RequireJS script order on `/api-tester` and `/diff`.

### Frontend
- API Tester header: **Cookies** button with count badge; request bar: **Code** button; sidebar: run-all and zip-export icon buttons (stroke SVG, per design system).
- Script tab labels now state that scripts are sandboxed (no page or network access).
- Inherit-auth helper text de-emoji'd (DX-9) and now names the ancestor folder providing auth.
- Tool version chip bumped to V3.0.

### Internal / Code Quality
- **JS unit test suite bootstrapped** (`tests/javascript/run.js`, zero dependencies, node) — 41 tests covering `curl-codegen.js`, `cookie-jar.js`, and `collection-utils.js`. These modules use a browser/node dual export and contain no DOM access.
- `escHtml()` dead code removed from `api-tester.js`.
- Backend suite grown from 31 to 39 tests.
- **Sonar minor sweep:** `parseInt` → `Number.parseInt` in `auth-guard.js` / `vault.js` (S7773); inverted `!currentItemFolder` block and `NOSONAR` on idiomatic guard clauses (S7735) and the intentional fall-through `catch` (S2486) in `api-tester.js`.
- `SONAR_FINDINGS.md` deleted; replaced by a fresh SonarCloud scan report in `sonarfindings.md`; `.sonarcloud.properties` updated.

### Documentation
- `SPEC.md`: §4.7 expanded with §4.7.1–§4.7.6 behavioral specs; §5.9 proxy response shape; §5.10 CSP split; §13 roadmap reframed — v0.3.0 is "API Tester: Daily Driver", UX Foundation moved to v0.4.0, Power User to v0.5.0, new v0.3.x follow-ups section (masked env secrets, `connect-src` decision, mock server).
- `CLAUDE.md`: gotchas updated (CSP split, in-memory cookie jar); JS test suite documented.
- Known limitation documented in SPEC §4.7: the document CSP's `connect-src 'self'` blocks the direct cross-origin attempt of "smart CORS routing", so cross-origin requests effectively always use the proxy. Resolving this (relax CSP vs. simplify the client) is an explicit v0.3.x decision item.

---

## [0.2.4] — 2026-06-10 (maintenance: decommission URL shortener, close WS auth gap, DX)

Follow-up to the 2026-06-06/06-10 reviews (`claudefeedback.md §12`). One tool removed, the last open security item closed, and several developer-experience and documentation-accuracy fixes.

### Removed
- **Link & QR Studio (URL shortener)** — decommissioned. Removed the (already-absent) tool from all documentation, deleted the vendored `static/bwip-js-min.js` barcode library, dropped the `url_db` legacy-migration path from `devdb.py`, and removed `url_db` from the DevDB Manager store list. The tool was no longer wired up; this removes the dangling references. `tools.html`, `README.md`, and `SPEC.md` now consistently describe **12 tools**.

### Security
- **WebSocket session gating (SEC-14):** `/api/ssh/terminal`, `/api/ssh/dashboard`, and `/api/local/terminal` now validate the `ds_session` cookie during the handshake when a master password is configured. The no-master-password local-terminal flow is preserved (open until setup). Closes the last carried-over P2 item.

### Frontend
- **Tools hub:** filter counts (`All`, `Dev`, `Network`, …) are now computed from the DOM instead of hardcoded — they had drifted to `13/5/2` while 12 tools shipped.
- **AuthGuard lock screen:** emoji chrome replaced with stroke-based inline SVG icons, per design system (SPEC §9.8/§9.9).
- **DevDB Manager:** removed all emoji from `db-manager.html` + `db-manager.js` (store icons, action-card icons, status badges, section titles) in favour of stroke-based SVG; toast/error copy de-emoji'd and made actionable.

### Internal / DX
- **CI:** added `.github/workflows/tests.yml` — runs `pytest tests/python/` on push/PR.
- **Run scripts:** `start.sh` / `start.ps1` now honour `$PORT` / `$HOST` and only enable `--reload` when `DEVSUITE_DEV=1` (matching `python main.py`).
- **`.env.example`:** added `DEVDB_PASSWORD`, `PORT`, `HOST`; corrected the `DEVSUITE_DEV` description (it toggles `/docs`, `/redoc`, and reload — not rate limits or logging).

### Documentation
- `SPEC.md`: corrected File Converter upload limit (50 MB → 20 MB), documented the `unsafe-eval` CSP dependency, added SEC-14, closed the §4 numbering gap (now 4.1–4.12), refreshed the version footer.
- `README.md`: project structure now reflects the `deps.py` + `routes/` split.

---

## [0.2.3] — 2026-06-07 (patch: Sonar code-quality sweep)

P3 refactoring release. All P3 items from the 2026-06-06 review are resolved (except the browser JS test suite, which requires new infrastructure). No behavior changes — pure structure, copy, and security-hygiene improvements.

### Refactoring

#### `main.py` split into `deps.py` + `routes/` package
- `main.py` was 2 083 lines mixing HTTP middleware, auth, file-conversion, DevDB REST, CORS proxy, SSH/SFTP/WebSocket, and metrics parsing.
- **`deps.py`** (new) — all shared singletons and helpers: `DevDB` instance, rate limiter, `_sessions` dict, constants (`_ALLOWED_ORIGINS`, `_ALLOWED_STORES`, …), `require_unlocked`, `_hash_token`, `_audit_log`, `_serve_html`, `_asset_fingerprint`. Route modules import from here; no circular imports.
- **`routes/`** package (new) — 7 `APIRouter` modules:
  - `routes/pages.py` — 15 HTML page GET routes + `/upload`
  - `routes/auth.py` — `/api/auth/*`, `/api/vault/migrate`
  - `routes/storage.py` — `/api/vault`, `/api/collections`, `/api/ssh/profiles`
  - `routes/convert.py` — `/api/convert` (all `_conv_*` helpers) + JSON→XLSX scalar-array bug fix (was 500, now 400)
  - `routes/proxy.py` — `/api/proxy` (SSRF helpers)
  - `routes/db.py` — `/api/db/*`
  - `routes/ssh.py` — SSH terminal WS, SFTP, WSL discovery, SSH dashboard WS, local PTY terminal WS
- `main.py` is now ~145 lines: app factory, middleware registration, `app.include_router()` calls, `__main__` entry point.
- **Test compatibility preserved:** `main._sessions`, `main.limiter`, `main._db`, `main._hash_token`, `main._check_ip_not_private`, `main._SSRFSafeRedirectHandler` are all re-exported from `main.py`; `conftest.py` updated to patch `deps._db` so route handlers (which access `deps._db`) see the isolated test database.
- All 27 existing tests pass without modification.

### Front-end

#### Monaco error banner copy fix (`static/components.js`)
- Banner previously said "CDN could not be reached" — Monaco is self-hosted, CDN is never used. Updated to: "Editor unavailable — Monaco could not be loaded from local assets (/static/libs). Check the browser console for details."

#### Centralized CSRF token helper (`static/components.js`, `vault.js`, `auth-guard.js`, `devdb-client.js`, `db-manager.js`)
- `_csrfToken()` was duplicated in four files (vault.js, auth-guard.js, devdb-client.js, db-manager.js), each with the same cookie-parsing logic.
- **Canonical implementation** added to `components.js` as `DevSuite.csrfToken()` — loaded on every page.
- All four per-file copies now delegate: `return DevSuite.csrfToken()`.

#### `innerHTML` sweep — user-data sites converted to DOM methods
- Audited all 71 `innerHTML` assignments in the JS codebase; triaged into: clears-only (safe), static strings (safe), static SVG (safe), and **user-data** (must convert).
- **`vault.js`** — `renderList()` empty state, entry list items, `addFieldRow()` (label/value/reveal/copy), `addNotesRow()`: all converted to `createElement`/`textContent`. Removed `_fieldDisplayVal()` helper (no longer needed).
- **`ssh-manager.js`** — `_buildServerItem()` (name, edit/delete buttons), `_buildGroupDiv()` header (toggle/icon/name spans), SFTP + Dashboard sidebar items (extracted `_buildSftpSessItem()` shared helper), tab strip (`renderTabsHeader`), disk widget: all converted.
- **`sftp-browser.js`** — session sidebar item converted.
- **`app.js`** — `FEATURE_ICONS`/`FEATURE_NAMES` static lookups annotated as safe (`// static SVG only`, `// static strings only`).
- **`db-manager.js`** — already used `textContent` throughout; `_csrfToken` delegation applied.

### Security

#### SEC-3 CORS allowlist registered (`main.py`)
- `_ALLOWED_ORIGINS` constant existed but `CORSMiddleware` was never added to the app. Now registered: `allow_origins=_ALLOWED_ORIGINS`, `allow_credentials=True`, explicit methods + headers. Resolves spec drift D-6.

### Sonar code-quality sweep (`api-tester.js`, `api-tester.html`, `style.css`)

Addresses all code-level findings from the 2026-05-09 SonarCloud scan. Gate is now blocked only by 3 unreviewed security hotspots (UI-only action required in SonarCloud).

#### S3776 — Cognitive complexity (CRITICAL ×2)
- `expect()` (old line 698): replaced 8 sequential `if`-statements in a Proxy `get` trap with a `handlers` lookup dict. Complexity 20 → ~3.
- `buildRequestConfig()` (old line 1079): extracted `_resolveAuthConfig(config)` and `_applyBodyConfig(config, bodyType)` helpers. Complexity ~17 → ~2 per function.

#### S1121 — Assignment in expression (MAJOR)
- `el.style.cssText = v` extracted from ternary into explicit `if/else` block in `createElement` helper.

#### S6582 — Optional chaining (MAJOR ×4)
- `preReqEditor?.setValue()`, `testsEditor?.setValue()`, `graphqlQueryEditor?.setValue()`, `graphqlVarsEditor?.setValue()` — `&&`-guard pattern replaced with `?.`.

#### S3800 — Inconsistent return type (MAJOR)
- `interpolate()` now always returns `String` — added `String(str ?? '')` fallback for non-string input.

#### S7927 — Accessible name vs visible label (MAJOR, `api-tester.html`)
- `aria-label="Fetch OAuth2 access token"` → `"Fetch Token — OAuth2 access token"` (now contains the visible button text "Fetch Token" as required by WCAG 2.5.3).

#### S6825 — `aria-hidden` on focusable elements (MAJOR ×3, `api-tester.html`)
- `aria-hidden="true"` removed from `#import-collections-file`, `#import-env-file`, `#openapi-file-input` hidden file inputs.
- `tabindex="-1"` added to remove them from tab order without needing `aria-hidden`.

#### S7735 — Negated conditions (MINOR ×6)
- `renderConsole`: inverted `if (!all.length)` → `if (all.length) { render } else { empty state }`.
- `renderHistory`: inverted `if (!history.length)` → `if (history.length) { forEach } else { empty li }` (also switches empty-state from `innerHTML` to `createElement`).
- `updateInheritInfo`: inverted `if (!fa || fa.type === 'none')` → `if (fa && fa.type !== 'none')`.
- `renderCollections` init guard, save-handler `!raw` guard, import `!file`/`!imported.length` guards: `// NOSONAR` applied (idiomatic guard clauses; inversion would increase nesting without clarity benefit).

#### S7924 — CSS color contrast (MINOR ×10, `style.css`)
- `/* NOSONAR */` applied to `.status-live`, `.status-beta`, `.status-error`, `.m-get`, `.m-post`, `.m-put`, `.m-delete`, `.m-patch`, `.ver-stable`, `.ver-canary`, `.diff-add`, `.diff-del`.
- Root cause: Sonar treats `rgba(R,G,B,0.08–0.12)` backgrounds as fully opaque when computing contrast ratios, producing false failures. Actual contrast against the rendered surface (near-white/near-dark) passes the 4.5:1 requirement.

#### CSRF centralization
- `getCsrfToken()` in `api-tester.js` refactored to delegate to `globalThis.DevSuite?.csrfToken?.()` — eliminates the last per-file duplicate (P3 centralization).

---

## [0.2.2] — 2026-06-07

Security hardening release. No new user-facing features. Restores the zero-knowledge vault guarantee, strengthens client crypto, and closes all remaining P0–P2 security findings from the 2026-06-06 review.

### Security

#### Vault zero-knowledge — domain-separated encryption + auth keys (`vault.js`, `auth-guard.js`, `main.py`)
- **P0 §4.1 fix:** The server previously received `key_hex` = the vault's AES encryption key (derived by `CryptoJS.PBKDF2`) on every unlock. This broke the "zero-knowledge" claim in SPEC §2/§7.5 — a compromised server could decrypt the vault.
- Introduced **v2 key derivation**: `WebCrypto PBKDF2-HMAC-SHA256 @ 310 000 iter → 512-bit root`. First 256 bits = `Kenc` (vault encryption, never leaves browser); second 256 bits = `Kauth` (server auth, sent as `key_hex`). `Kenc ≠ Kauth` by construction; knowing `Kauth` cannot recover `Kenc`.
- **Vault encryption upgraded to WebCrypto AES-256-GCM** (§4.3 fix): authenticated encryption replaces the previous AES-256-CBC with no MAC. GCM detects ciphertext tampering; CBC with JSON parse errors was not authentication.
- **KDF strengthened** (§4.4 fix): PBKDF2-HMAC-SHA256 @ 310 000 iterations replaces PBKDF2-HMAC-SHA1 @ 50 000. This raises the offline brute-force bar significantly and aligns with OWASP 2023 guidance.
- **Versioned blob format**: blobs now carry `version: 2` (v1 = old CBC/SHA-1 scheme, no field / absent). Old vaults are automatically migrated to v2 on first unlock: decrypted with v1 key, re-encrypted with `Kenc`/GCM, new `challenge_version: 2` challenge registered with `Kauth`.
- **Server**: `POST /api/auth/setup` and `POST /api/auth/update-challenge` now accept `challenge_version` + `verify_nonce` (v2) alongside existing `verify_iv` (v1). `POST /api/auth/session` verifies with AES-256-GCM (v2) or AES-CBC (v1) based on stored `challenge_version`. `GET /api/auth/challenge` returns `challenge_version` + `verify_nonce`.
- **`auth-guard.js`** updated to handle v2 challenges (`_verify` dispatches on `challenge_version`; derives `Kauth` via WebCrypto and never sends `Kenc`).

#### Master password / key no longer stored in `sessionStorage` (`auth-guard.js`)
- **P2 §4.6 fix:** `devsuite_session_cred` (password) and `devsuite_key_hex` were written to `sessionStorage`, making them readable by any same-origin XSS. Both are now held exclusively in **module-level in-memory variables** (`_sessionPwd`, `_sessionKeyHex`) — cleared on page unload. Re-prompting on page navigation is the correct, safer default (the Vault already used this model).

#### `auth-guard.js` overlay rebuilt with DOM methods (no `innerHTML` for dynamic content)
- `_buildOverlay` used template-literal `innerHTML` with `${toolName}` / `${toolIcon}` interpolation. Both are static call-site literals today but represent an injection vector for future dynamic callers. Rebuilt with `createElement` + `textContent` throughout, matching SPEC §2 / CLAUDE.md rule 4.

#### `X-XSS-Protection` header set to `0` (`main.py`)
- Changed from `1; mode=block` to `0`. The header is deprecated in all major browsers; `mode=block` can introduce quirks in legacy browsers. Modern XSS protection relies on CSP.

#### SFTP download filename header injection fixed (`main.py`)
- `sftp_download` put the raw remote filename directly into `Content-Disposition: attachment; filename="..."`. A filename containing CR/LF/double-quotes could inject arbitrary response headers. Now RFC 5987-encoded: `filename*=UTF-8''<pct-encoded>`.

#### `~/.devsuite/` directory and audit log permissions hardened (`main.py`)
- On startup `_DEVSUITE_DIR.chmod(0o700)` — locks the data directory to the owning user on POSIX systems.
- `audit.log` receives `chmod 600` on its first write — prevents world-readable audit data.

#### Dead code removed: `169.254.x.x` redundant branch (`main.py`)
- The `if ip_str.startswith("169.254."):` branch in `_check_ip_not_private` was unreachable — `ip_obj.is_link_local` already covers the entire `169.254.0.0/16` range and raises first. Replaced with a clarifying comment.

#### `hashlib.md5` security flag (`main.py`)
- Added `usedforsecurity=False` to the `hashlib.md5` call used for asset cache-busting fingerprints, suppressing false-positive security scanner alerts.

#### CORS Proxy SSRF — redirect & response hardening (`main.py`)
- The `/api/proxy` SSRF guard validated only the initial target IP, but `urllib` followed 3xx redirects automatically — so a public host could redirect into a private/reserved address (e.g. `http://169.254.169.254/` cloud metadata). Redirects now route through `_SSRFSafeRedirectHandler`, which re-validates every hop's resolved IP and scheme before following. Proxied responses are capped at 10 MB to prevent memory exhaustion.

#### WebSocket origin-check hardening (`main.py`)
- `_ws_check_origin` previously accepted any scheme ending in `//<host>` and silently allowed **all** origins when the `Host` header was absent. It now requires an allowlisted origin or an exact `http(s)://<host>` match.

#### Secret Vault — removed inline `onclick` injection vector (`static/vault.js`)
- Field copy/reveal buttons were built as inline `onclick` strings that interpolated the secret value via `encodeURIComponent`, which does not escape single quotes — a value containing `'` could break out into the attribute/JS context. Buttons are now wired with `addEventListener` (value read from a closure), matching the safe pattern already used by the URL opener.

### Tests

#### v2 vault challenge test suite (`tests/python/test_vault_v2.py`)
- 6 new tests verifying: v2 challenge setup stores correct prefs; challenge endpoint returns `challenge_version` + `verify_nonce`; `POST /api/auth/session` accepts `Kauth` and **rejects `Kenc`** (domain separation enforced); rejects random keys; v1 CBC path still passes (backward compat). Rate-limiter storage now reset between tests in `conftest.py` to prevent cross-test contamination.

#### Added Python backend test suite (`tests/python/`)
- New `pytest` suite covering the security-critical paths in SPEC §10.2: DevDB AES-256-GCM round-trip + tamper / wrong-password detection and plain-mode checksum; CORS-proxy SSRF (loopback / scheme / redirect-to-private blocked); CSRF enforcement (missing or mismatched token → 403; bootstrap endpoints exempt); session-token hashing (raw token never stored, expiry purged on access); and auth-challenge rate limiting (429). 21 tests, all passing.

### CI / DevX

#### CodeQL Workflow Fix (`.github/workflows/codeql.yml`)
- **Replaced broken hand-rolled implementation** with the standard `github/codeql-action` composite actions.
- Previous workflow manually cloned the repo, downloaded the CodeQL CLI bundle from a non-existent URL (`codeql-bundle-linux64.zip` — bundle naming changed to `codeql-bundle-linux-amd64.tar.gz` and requires a versioned release tag, not `latest`), created the database, and uploaded SARIF manually — all of which broke at the "Install CodeQL CLI" step (exit code 128).
- Now uses `actions/checkout@v4` → `github/codeql-action/init@v3` → `github/codeql-action/analyze@v3`, which handles CLI download, database creation, and SARIF upload internally. Analysis matrices unchanged: `javascript-typescript` and `python`, both `build-mode: none`.

### Build / Tooling

#### `__main__` now honours `HOST` / `PORT` env vars; `reload=True` gated to dev mode (`main.py`)
- `uvicorn.run(...)` hardcoded `host="127.0.0.1"`, `port=8000`, `reload=True` regardless of environment, contradicting `SPEC.md §14.2`. Now reads `HOST` / `PORT` from env (defaults unchanged); `reload` is only `True` when `DEVSUITE_DEV=1`. Fixes spec drift D-3.

#### Spec drift resolved (`SPEC.md`)
- **D-2:** Updated §4.7 to document that `/api/collections` IS auth-gated server-side (code was already correct; spec was wrong).
- **D-4:** Fixed docstring on line 2 of `main.py` still reading `v0.2.0` despite `APP_VERSION = "0.2.1"`.
- **D-5:** Removed stale SonarCloud blocker note for `_serverToken` implicit global — no longer present in `db-manager.js`.

#### Removed vestigial TypeScript / Node build path (`start.sh`, `start.ps1`, `static/api-client.ts`)
- Deleted `static/api-client.ts`. The shipping `static/api-client.js` is the canonical, hand-maintained source loaded by `api-tester.html`; the `.ts` had drifted out of sync and was **missing the CSRF-token injection on proxy requests** that the `.js` performs — so recompiling it (as the old README instructed) would have regressed security.
- Removed the Node.js / npm prerequisite check and the global-`typescript` install prompt from `start.sh` and `start.ps1`. DevSuite has no build step; **Python is the only runtime requirement**. The setup scripts no longer force a Node toolchain to run the app, matching the "no build tools" constraint in `SPEC.md §2`.

---

## [0.2.1] — 2026-05-09

Security and quality fixes. No new user-facing features.

### Security

#### `/api/collections` Authentication (`main.py`)
- Added `require_unlocked` guard to `GET /api/collections` and `POST /api/collections` — these endpoints now require a valid server-side session token, matching the protection already applied to `/api/vault` and `/api/ssh/profiles`.

### Bug Fixes

#### OAuth2 Proxy Body Parsing (`static/api-tester.js`)
- Fixed `proxyData.body?.access_token` returning `undefined` in the CORS-fallback path — `/api/proxy` returns `body` as a string, not a parsed object. The token-fetch flow now JSON-parses the body string before extracting `access_token` or error fields.

#### OpenAPI File Picker (`static/api-tester.html`)
- Restricted the `accept` attribute on the OpenAPI file picker to `.json` only; the parser is JSON-only so accepting `.yaml`/`.yml` was misleading.

### Quality

#### Collection Import Safety (`static/api-tester.js`)
- Cancel on the import dialog now aborts the import instead of silently performing a replace-all.
- `preRequestScript` and `testsScript` fields are stripped from imported items; executable scripts from untrusted sources require manual re-entry.

#### DOM Safety (`static/api-tester.js`)
- Replaced `innerHTML` usage in `createFolderElement` with explicit `createElement`/`textContent` calls, per project constraint (CLAUDE.md §4).

#### OAuth2 Token Invalidation (`static/api-tester.js`)
- `oauth2Token` is now cleared when any OAuth2 configuration field changes or when a saved item with an OAuth2 auth config is restored, preventing stale token reuse across different configurations.

#### `parseOpenApiSpec` Refactor (`static/api-tester.js`)
- Extracted `resolveBaseUrl`, `mergeParameters`, and `extractRequestBody` helpers so the main loop is a thin coordinator; resolves Sonar cognitive-complexity findings.

---

## [0.2.0] — 2026-04-22

Security hardening release. No new user-facing features — all changes harden the authentication, session, and transport layers as planned in the v0.2.0 milestone.

### Security

#### Session Token Hashing (`main.py`)
- **BLAKE2b digest storage**: Raw session tokens are no longer stored in the server-side `_sessions` dict. Only a BLAKE2b-32 hex digest is stored as the key. A process-memory dump or heap snapshot no longer yields usable tokens.
- New `_hash_token(token: str) -> str` helper centralises the hashing.

#### HttpOnly Cookie for Session Token (`main.py`)
- `POST /api/auth/session` no longer returns `session_token` in the response body.
- The server now sets a `ds_session` cookie (`HttpOnly; SameSite=Strict; max_age=28800`). JavaScript cannot read or exfiltrate it; DOM-based XSS on any tool page cannot steal it.
- `require_unlocked()` reads from `ds_session` cookie first, with a `X-Session-Token` header fallback for backward compatibility.

#### CSRF Protection Middleware (`main.py`)
- New `csrf_middleware` rejects all `POST / PUT / DELETE / PATCH` requests that lack a matching `X-CSRF-Token` header.
- The header value is compared against the `ds_csrf` cookie using `secrets.compare_digest` (constant-time, timing-safe).
- Exempt paths: `/api/auth/session` and `/api/auth/setup` (bootstrap endpoints that predate any session).
- A non-HttpOnly `ds_csrf` cookie (same TTL as `ds_session`) is issued alongside it; frontend JavaScript reads and forwards it.

#### Rate Limiting (`main.py`, `requirements.txt`)
- Added `slowapi>=0.1.9` dependency.
- `GET /api/auth/challenge` and `POST /api/auth/session` capped at **5 requests / 60 s per IP** via `SlowAPIMiddleware` (registered as the outermost ASGI layer). A 6th attempt within the window returns HTTP 429.

#### Audit Logging (`main.py`)
- New append-only `~/.devsuite/audit.log` written by `_audit_log(event, **details)`.
- Format: `<ISO-8601-UTC>  <EVENT>  key=value ...` — human-readable, grep-friendly.
- Events: `AUTH_SESSION` (client IP on every successful unlock), `VAULT_ACCESS` (client IP on vault read), `SSH_CONNECT` (host, port, username on terminal connect).
- Secret values are never written to the log.

#### Developer-Mode Swagger UI (`main.py`)
- `/docs` (Swagger UI) and `/redoc` are **disabled by default** to avoid exposing the API schema in production.
- Set `DEVSUITE_DEV=1` in the environment to enable them.

### Frontend

Six session-management modules migrated from `X-Session-Token` header / `devsuite_server_token` sessionStorage to the cookie-based CSRF pattern:

| File | Change |
|---|---|
| `auth-guard.js` | `_acquireServerSession` no longer reads or stores a token from the response body; the session is fully cookie-managed. |
| `devdb-client.js` | `_sessionToken()` removed; `_csrfToken()` reads `ds_csrf` from `document.cookie`; all fetch calls send `X-CSRF-Token`. |
| `vault.js` | `_serverToken()` → `_csrfToken()`; `_authHeaders()` emits `X-CSRF-Token` instead of `X-Session-Token`. |
| `sftp-browser.js` | `_sessionHeaders()` rewritten to read `ds_csrf` cookie. |
| `ssh-manager.js` | `_sessionHeaders()` rewritten to read `ds_csrf` cookie. |
| `db-manager.js` | `_authHeaders()` rewritten; lock-screen no longer reads `session_token` from response body; `_serverToken` state removed. |

### Dependencies

| Package | Change |
|---|---|
| `slowapi` | Added `>=0.1.9` |

---

## [0.1.3] — 2026-04-19

Code quality hardening pass — no behaviour changes. All changes reduce SonarCloud cognitive complexity violations and remove static-analysis warnings.

### Internal / Code Quality

#### `main.py`
- **Cognitive complexity (S3776)**: Extracted `_ssh_keyscan(host, port)` and `_ssh_key_fingerprint(key_data, host, port)` from `_ensure_host_key`, reducing its complexity from 71 to ~5.
- **SFTP deduplication**: Added `_make_sftp_approve(fingerprint)` factory to replace three identical inline `_sftp_approve` closures in `sftp_list`, `sftp_download`, and `sftp_upload`.
- **Cognitive complexity (S3776)**: Extracted `_source_to_html(src_ext, content)` from `_conv_any_to_pdf`; `_read_upload_stream(file, max_size)` from `upload_file`; `_resolve_target_ips(hostname, port, scheme)` from `proxy_request`.
- **Empty except blocks (S108)**: Replaced silent `pass` in `_try_resize_ssh_process` and `ssh_dashboard` with `logger.debug()` calls.
- **IndentationError fix**: Corrected indentation of `return await _ws_wait_for_host_key_response(websocket)` to sit inside the `async with asyncio.timeout(60):` block.

#### `devdb.py`
- **Cognitive complexity (S3776)**: Extracted `_cleanup_temp_file(fd, tmp_path)` module-level helper from the `_write` method's `BaseException` cleanup block.

#### `scripts/check_updates.py`
- **Cognitive complexity (S3776)**: Refactored `_update_js_file` (complexity was 30, limit 15) by extracting five helpers — `_discard_bak`, `_restore_bak`, `_try_cdn_sources`, `_extract_member_from_tarball`, and `_try_tarball_download` — leaving `_update_js_file` as a thin orchestrator (~5 complexity).

#### `static/style.css`
- **Duplicate selector (S4666)**: Removed redundant `.editor-host { flex: 1; }` at line 769; the full rule at line 400 already covers this.

---

## [0.1.2] — 2026-04-18

Code quality and security hardening pass — no behaviour changes. All changes address SonarQube static-analysis rule violations to reduce cognitive complexity, close security-tool findings, improve code clarity, and align with modern JS/Python idioms.

### Internal / Code Quality

#### `main.py`
- **Cognitive complexity (S3776)**: Extracted `_dashboard_ws_approve_host`, `_ssh_dashboard_connect`, `_parse_distro_from_config`, `_exec_pty_child`, and `_run_local_pty_loop` helpers from `ssh_dashboard` and `local_terminal` WebSocket handlers to bring each function within the complexity budget.
- **OpenAPI response codes**: Added `responses={...}` annotations to all API endpoints that were missing documented error codes (401, 400, 404, 413, 500).
- **`_ws_wait_for_host_key_response`**: Extracted the host-key approval polling loop from the inline closure into a named top-level coroutine.

#### `devdb.py`
- **Cognitive complexity (S3776)**: Extracted `_decrypt_body`, `_verify_plain_body`, and `_load_db_obj` as private helpers from `_parse`; each helper has a single responsibility and a clear docstring.

#### `static/app.js`
- **Module-level hoisting (S7721)**: Hoisted `countLines`, `isBinaryFile`, `formatFileDate`, `formatSize`, `getLanguageFromPath`, `allFileStatuses`, `collectFilePaths`, and `propagateFolderStatuses` out of `DOMContentLoaded` to module scope.
- **Merge-arrow helpers**: Extracted `_mergeToRightPureDeletion`, `_mergeToRightPureInsertion`, `_mergeToLeftPureDeletion`, `_mergeToLeftPureInsertion`, and `handleMergeClick` from the inline merge-click handler to reduce cognitive complexity.
- Removed unused local variable assignments (`statsBar`, `fileTreeEl`, `changedFilesCount`, `activeFilePath`).

#### `static/api-client.js` / `api-client.ts`
- Extracted `_bodyToString`, `_decodeProxyResponse`, `_buildProxyOptions`, and `_parseResponse` helpers from `execute`; the main `execute` method is now a thin coordinator.
- `String.fromCharCode` → `String.fromCodePoint`; `charCodeAt` → `codePointAt` (S2302 / safer Unicode handling).

#### `static/api-tester.js`
- Extracted `buildRequestConfig` and `renderResponse` from the `btnSend` click handler.
- Extracted `resolveMonacoTheme` helper to eliminate duplicated theme-resolution logic.
- `window.*` → `globalThis.*`; `btn.getAttribute('data-target')` → `btn.dataset.target`.

#### `static/cron.js`
- Extracted `_parseSpecialTokens`, `_parseResolvedToken`, `_parseWeekdayW`, and `_parseSingleNumber` from the monolithic `_parseToken` method.
- `parseInt` → `Number.parseInt`; `isNaN` → `Number.isNaN`; `replace(regex, …)` → `replaceAll(string, …)` throughout.

#### `static/ssh-manager.js`
- `window.location` → `globalThis.location`; `parseInt` → `Number.parseInt`; `keys[keys.length - 1]` → `keys.at(-1)`; null-safe `ws?.readyState` checks.
- Inline comment cleaned up for `sftpConn` / `dashConn` state variables.

#### `static/regex.html`
- Extracted `buildGroupChip` helper; hoisted `buildRegex` to module scope.
- `window.MonacoEnvironment` → `globalThis.MonacoEnvironment`.
- Removed unused `matchEmpty` variable reference.
- Fixed group-chip text colour for light themes (`#6ee7b7` → `#059669` for WCAG contrast compliance).

#### `static/base64.html`
- `window.MonacoEnvironment` → `globalThis.MonacoEnvironment`.
- `String.fromCharCode` → `String.fromCodePoint`; `charCodeAt` → `codePointAt`.
- `replace(regex, …)` → `replaceAll(string, …)` for URL-safe Base64 substitutions.
- Removed unused `outputEditor` variable.

#### `start.sh`
- Extracted repeated string literals (`'python'`, `'unknown'`, `'Windows'`) into `readonly` constants (S1192).
- `[ … ]` → `[[ … ]]` for all conditionals; `[ -eq ]` → `[[ -eq ]]`.
- Added `>&2` redirect on the error message in `run_as_root`.

#### `static/json.html` / `static/yaml.html` (D-5 a11y progress)
- Added `aria-label` to `<header>`, back-link `<a>`, and every toolbar `<button>`.
- `aria-hidden="true"` on all decorative SVG icons and separator `<div>`s.
- `role="toolbar"` + `aria-label` on action toolbars.
- `role="status"` + `aria-live="polite"` + `aria-atomic="true"` on status pills.
- `aria-live="polite"` / `aria-atomic="true"` on live character and line-count badges.
- `role="alert"` + `aria-live="assertive"` on error panels.
- `role="textbox"` + `aria-label` + `aria-multiline="true"` on Monaco editor host divs.
- `role="region"` + `aria-label` + `aria-live="polite"` on output editor containers.
- `id="input-editor-label"` anchor added to JSON input pane header for future `aria-labelledby` wiring.

#### `static/base64.html` (D-5 a11y progress)
- Added `aria-label` to `<header>` and back-link `<a>`; `aria-hidden="true"` on decorative SVG icons.
- `aria-live="polite"` + `aria-atomic="true"` on the char-count badge.

#### `static/regex.html` (D-5 a11y progress)
- Flag toggle buttons now sync `aria-pressed="true"/"false"` on every click, enabling screen readers to announce the pressed state correctly.

---

---

## [0.1.1] — 2026-04-15

Bugfix release. No new features; all changes address correctness, accessibility, and code-quality issues identified after the v0.1.0 baseline.

### Bug Fixes

#### Secret Vault (`vault.js`)
- **New-vault setup regression** — after `POST /api/auth/setup` succeeds, a server session is now acquired immediately and the initial vault-salt save (which previously failed because no session existed yet) is retried. Without this fix a newly created vault could not persist its salt on first save.

#### Diff Checker (`app.js`)
- **Monaco theme not applied on load** — replaced direct `themeSelect.value` access with a `getMonacoTheme()` helper that falls back to `localStorage['devsuite-theme']` when `themeSelect` is `null`, preventing the editor from rendering in the wrong theme during initialisation.
- **Patch generation silent no-op** — patch loop conditions (`&& oE > 0` / `&& mE > 0`) were inside the loop body, making loop iterations with no lines silently skip. Moved to `if`-guards around each loop.
- **Folder tree sort non-deterministic** — file-path sort now uses `localeCompare()` for consistent locale-aware ordering across platforms.

#### Folder Diff (`index.html`)
- **Folder input blocked inside hidden parent** — browsers silently block `input.click()` when the input lives inside a `display:none` ancestor. Both folder `<input type="file">` elements are now hoisted outside the collapsible setup wrapper.
- **Accessibility** — folder-picker trigger elements converted from `<button onclick="input.click()">` to `<label for="...">`, enabling native browser association and keyboard activation without JavaScript.

#### SFTP Browser / SSH Manager (`sftp-browser.js`, `ssh-manager.js`)
- **Group name sort non-deterministic** — SSH session group names now sort with `localeCompare()` for consistent Unicode-aware ordering.

#### `start.sh`
- **Unsupported package manager silent fall-through** — the `case` statement now has a `*)` wildcard that prints a clear error message and exits with code `1` instead of silently continuing.

### Internal / Code Quality

- **`main.py`** — imports reorganised alphabetically; shared string constants extracted (`_ALLOWED_ORIGINS`, `_ERR_ORIGIN_REQUIRED`, `_ERR_ORIGIN_NOT_ALLOWED`, `_ERR_SFTP_FAILED`, etc.); `# pylint: disable` annotations added to complex route handlers; unused `application` parameter in lifespan renamed to `_application`; PTY module globals renamed `_pty_available` (snake_case) for consistency.
- **`devdb.py`** — `BaseException` catch block annotated with `# NOSONAR` to suppress false-positive static-analysis warning; clarifying comment added.
- **SonarQube** — `sonar-project.properties` added to project root for SonarQube/SonarCloud analysis.
- **Tests** — test files reorganised under `tests/python/` and `tests/javascript/`; JavaScript test suite now includes a `FormData` no-op stub for the devdb-client tests.

---

## [0.1.0] — 2026-04-12

This is the **baseline release** — a comprehensive snapshot of all features, tools, and infrastructure present in DevSuite at this version. Future releases will document incremental changes against this baseline.

### Tools

#### Diff Checker (`/diff`)
- Side-by-side and Inline comparison modes via Monaco Editor.
- Merge arrows to copy individual hunks left→right or right→left.
- Keyboard shortcut `Ctrl/Cmd+Enter` to compare; `Escape` to reset.
- Paste from Clipboard button per panel; Copy Panel Content button.
- Live Diff Stats Bar with additions, removals, and hunk count.
- Export diff as `.patch` file or copy unified diff to clipboard.
- Line count badges per panel, updated on every keystroke.
- **Folder Diff** tab — compare entire directory trees; filter chips (All / Modified / Added / Removed); file upload support; deep-link via `/diff?tab=folder-diff`.

#### JSON Linter & Formatter (`/json`)
- Real-time JSON validation with exact line/column error pointers.
- Pretty-print, minify, and sort keys alphabetically.
- Monaco Editor integration with syntax highlighting.

#### YAML Linter & Validator (`/yaml`)
- YAML parsing and validation powered by `js-yaml` (CDN).
- Format clean YAML or convert directly to JSON with one click.
- Useful for Kubernetes, Docker Compose, and GitHub Actions configs.

#### Regex Tester (`/regex`)
- Real-time match highlighting inside Monaco Editor.
- Group capture and named group display panel.
- `g`, `i`, `m`, `s` flag toggles.

#### Base64 Encoder / Decoder (`/base64`)
- Encode/decode strings with full UTF-8 support.
- URL-safe mode.
- JWT decoding panel — splits header, payload, and signature; pretty-prints JSON.

#### Crypto Suite (`/crypto`)
- **Hash Generator** — MD5, SHA-1, SHA-256, SHA-512 with per-hash copy buttons.
- **AES Encrypt/Decrypt** — CBC, ECB, CTR mode selection via CryptoJS (self-hosted).
- **RSA Key Pair** — generate 2048/4096-bit keypairs; in-browser encrypt/decrypt.
- **HMAC Sign & Verify** — SHA-256 and SHA-512 with a visual OK/INVALID banner.
- All operations fully offline via self-hosted `crypto-js.min.js` (v4.2.0).

#### Link & QR Studio (`/url-shortener`)
- Local URL shortener generating short `/r/<id>` redirect links.
- QR Code and Code128 Barcode generated for every shortened link (using the original URL).
- PNG download for both QR Code and Barcode.
- Recent links panel backed by `localStorage`.
- Short link IDs are collision-safe (up to 10 retries for uniqueness).
- Persistence via DevDB (`url_db` store); survives server restarts.

#### Local API Tester (`/api-tester`)
- Full REST client — GET, POST, PUT, DELETE, PATCH, custom headers and body.
- Request Collections with folder organization.
- Local CORS proxy (`/api/proxy`) to bypass browser CORS restrictions.
- Persistent collections saved in DevDB (`collections` store).
- 8-hour session auth via `auth-guard.js`.

#### Secure Terminal & SFTP (`/ssh`)
- Multi-tab SSH client — parallel sessions to different hosts, each in its own xterm.js tab.
- Password and Private Key (PEM) authentication.
- Session profiles stored in DevDB (`ssh_profiles` store); encrypted client-side with a Master Password.
- Tree-style sidebar with collapsible group folders and quick-search/filter.
- Inline Delete icon on sidebar items — no modal required.
- Terminal resize events propagated to the remote PTY.
- **SFTP Browser** sub-tab — browse, navigate, and inspect remote filesystems; grid view with type icons, sizes, up/back navigation, refresh, and disconnect.
- **WSL / Local Terminal** — auto-discovers installed WSL distributions; spawns local PTY shells.
- **Standalone SFTP Browser** (`/sftp`) — direct deep-link to the SFTP Browser without opening the terminal.

#### Cron Visualizer (`/cron`)
- 4 dialect support: Unix/Linux (5-field), Quartz/Spring (6–7-field, with `?`, `L`, `W`, `#`), AWS EventBridge (6-field with year), GitHub Actions (with inline YAML context).
- Live expression parser with per-field tokenization, colour-coded field chips, and a ✓/✗ status pill.
- Human-readable description (e.g., *"Every 15 minutes, between 9:00 AM and 5:00 PM, Monday through Friday"*).
- Visual Field Builder — click-to-toggle grids for Minute (0–59), Hour (0–23), Month, Day-of-Week; bidirectionally synced with the text input.
- Next 10 Run Times panel — brute-force minute-iteration scheduler; shows locale date, time, and relative countdown.
- 28-Day Activity Heatmap — CSS grid calendar with teal intensity shading; hover tooltip per day.
- Preset Library — curated common expressions per dialect (Unix, Quartz, AWS, GitHub), click-to-load.
- Export — copy raw expression, GitHub Actions / Kubernetes CronJob YAML, or AWS EventBridge JSON.

#### Secret Vault (`/vault`)
- KeePass-style encrypted secret manager for tokens, passwords, SSH keys, and API credentials.
- AES-256 client-side encryption via CryptoJS — the server never sees plaintext.
- Lock screen on every visit; Master Password is never stored anywhere.
- CRUD interface — add, view (reveal/hide), copy to clipboard, edit, and delete entries.
- Categories: Token, Password, SSH Key, API Key, Note, Other.
- Persistence via DevDB (`vault` store).

#### DevDB Manager (`/db-manager`)
- Unified encrypted database inspector for all DevDB stores.
- Shows store names, approximate sizes, and database metadata (created, modified timestamps).
- Export / Import — download or upload the full `.dsb` database file.
- Store viewer — browse raw JSON content of any named store.
- Auth-gated with always-ask Master Password lock screen.

#### File Format Converter (`/file-converter`)
- Multi-format conversion engine supporting: JSON, CSV, YAML, XML, TSV, XLSX, Markdown, HTML, DOCX, and PDF.
- **Client-side** (in-browser): JSON ↔ YAML, JSON ↔ CSV, JSON → XML, YAML → JSON, Markdown → HTML.
- **Server-side** (Python): XLSX ↔ CSV/JSON, PDF → TXT, DOCX → TXT, DOCX/HTML/Markdown → PDF (via WeasyPrint).
- Drag-and-drop upload zone or file picker.
- Output displayed inline with a download button.

---

### Backend & Infrastructure

#### FastAPI Application (`main.py`)
- Single-file backend serving all routes, WebSocket terminals, SFTP API, DevDB REST API, and CORS proxy.
- HTTP Security Middleware on every response: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Content-Security-Policy`, `Referrer-Policy`.
- Lifespan event (`@asynccontextmanager`) opens DevDB, runs legacy migration, and seeds the URL cache on startup.
- Routes: `/`, `/diff`, `/json`, `/yaml`, `/regex`, `/base64`, `/crypto`, `/url-shortener`, `/api-tester`, `/ssh`, `/sftp`, `/cron`, `/vault`, `/db-manager`, `/file-converter`.
- Static assets served from `/static/` via `StaticFiles`.
- File upload endpoint (`POST /upload`) — validates binary content, enforces 50MB limit.
- CORS proxy (`POST /api/proxy`) — forwards requests to an explicit allowlist of remote hosts.
- URL shortener API (`POST /api/shorten`, `GET /r/{short_id}`) — backed by DevDB.
- Collections API (`GET/POST /api/collections`) — backward-compatible shim for API Tester.
- Vault API (`GET/POST /api/vault`) — opaque blob pass-through; server never decrypts.
- SSH Profiles API (`GET/POST /api/ssh/profiles`) — opaque blob pass-through.
- DevDB REST API (`GET/POST /api/db/store/{name}`, `GET /api/db/meta`, `GET /api/db/export`, `POST /api/db/import`).
- Auth endpoints (`GET /api/auth/status`, `GET /api/auth/challenge`, `POST /api/auth/setup`, `POST /api/auth/update-challenge`).
- WebSocket SSH terminal (`/api/ssh/terminal`) — asyncssh-based with PTY resize support.
- WebSocket local terminal (`/api/local/terminal`) — spawns PTY shells for WSL distros and local bash.
- SFTP REST API (`POST /api/sftp/list`, `POST /api/sftp/download`, `POST /api/sftp/upload`).
- WSL discovery (`GET /api/wsl/discover`).
- File conversion endpoint (`POST /api/convert`) — delegates to openpyxl, pypdf, python-docx, mammoth, weasyprint.

#### DevDB Storage Engine (`devdb.py`)
- KeePass-style binary container (`.dsb`) for all DevSuite persistent data.
- **Header**: 64-byte fixed layout — magic (`DSDB`), version, flags, KDF, iterations, salt (256-bit), nonce (96-bit).
- **Plain mode**: BLAKE2b-256 checksum prepended to JSON payload.
- **Encrypted mode**: AES-256-GCM with PBKDF2-HMAC-SHA256 (200k iterations, 256-bit salt).
- Thread-safe via `threading.Lock`; atomic writes via temp-file + `os.replace`.
- Public API: `open()`, `save()`, `get_store()`, `set_store()`, `delete_store()`, `list_stores()`, `store_sizes()`, `meta()`, `export_bytes()`, `from_bytes()`, `change_password()`.
- **Legacy migration**: `migrate_legacy()` automatically imports old `vault.json`, `collections.json`, `ssh_profiles.json`, and `url_db.json` into DevDB on first startup.

#### Shared Frontend Modules
- `theme.js` — global theme manager (Dark, Light, High Contrast, Frosted Glass); fires `devsuite-theme-changed` custom event.
- `components.js` — `DevSuite.toast(msg, type, ms)` notification utility; `DevSuite.initMonaco(callback)` loader helper.
- `auth-guard.js` — 8-hour session authentication for DevDB-backed tools; caches verified Master Password in `sessionStorage`; shows a re-authentication modal on expiry.
- `devdb-client.js` — thin fetch wrapper around `/api/db/*`; provides `DevDB.getStore()`, `DevDB.setStore()`, `DevDB.getMeta()`.

---

### UI / Design System
- Glassmorphic UI with `backdrop-filter: blur`, dynamic gradients, and ambient glow effects.
- Neumorphic buttons and form elements (`--neu-raise`, `--neu-press` CSS variables).
- 4 themes: Midnight Dark (`vs-dark`), Clean Light (`vs`), High Contrast (`hc-black`), Frosted Glass (`ios-glass`).
- JetBrains Mono for code panels; Inter for UI text.
- Consistent tool header pattern across all 13 tools (back-link, icon, name, theme switcher).
- Shared toast notification system.

---

### Security Posture
- DOM XSS hardened — all dynamic content via `document.createElement()` + `textContent`; no untrusted `innerHTML`.
- Self-hosted libraries — `crypto-js.min.js` (v4.2.0), `bwip-js-min.js` (v3.4.1) served from `/static/`.
- HTTP Security Headers on all responses.
- URL validation — shortener backend validates scheme + host before storage.
- Client-side encryption — vault and SSH profiles encrypted in-browser; backend is an opaque store.
- Collision-safe short IDs — generator retries up to 10 times.
- 8-hour session tokens — Master Password cached in `sessionStorage`, not `localStorage`.
