# Research: Local API Tester (as-built decisions)

Retroactive record of the real architectural decisions found in source — not a forward-looking
alternatives-evaluation, since the feature already shipped. Each entry: what was chosen, why
(inferred from code comments + surrounding constraints), and what the rejected/obvious alternative
would have cost.

## R1 — Web Worker sandbox instead of `new Function()` or an `<iframe>`

**Chosen**: user scripts execute inside a dedicated `Worker('/static/script-sandbox-worker.js')`.

**Why**: a Worker has no DOM, no `document.cookie`, and (via the worker's own scoped CSP,
`connect-src 'none'`) no network reach — three attack surfaces closed structurally rather than by
convention. It also lets the worker's HTTP response carry its own CSP with `unsafe-eval` while the
document response carries none (SEC-6), satisfying "no eval anywhere reachable from the page" as a
literal, testable HTTP-header property (`tests/python/test_csp.py`) rather than a code-review rule.

**Rejected alternative — `new Function()` in the main thread**: would require `unsafe-eval` on the
*document* CSP, defeating the entire point of the split; also gives the script direct DOM/cookie
access unless manually stripped.

**Rejected alternative — sandboxed `<iframe>`**: still same-process, still reachable by
`postMessage` racing, and CSP `sandbox` attributes are harder to audit than a Worker's structural
lack of `window`/`document` globals.

**Gap found and fixed (2026-07-28)**: at initial retroactive-spec time, the worker's actual eval
call had been replaced with a hard `throw`, and the client never sent the `codeSig`/`authToken` the
worker's signature check expected. The isolation *boundary* (Worker + scoped CSP) was real and
enforced; the *execution* inside it was dead code — reading like an in-progress security hardening
pass (adding HMAC script-signing) that removed the direct-eval path before wiring a replacement,
and shipped in that intermediate state. Fixed same-day: `api-tester.js` now generates a random
per-worker-instance token on worker creation and HMAC-SHA256-signs each script under it before
sending; the worker verifies signature + token, then executes via `new Function()` — legal only
inside its own `unsafe-eval`-scoped CSP response, per the isolation boundary this entry already
describes.

## R2 — Cookie jar: in-memory array, never persisted

**Chosen**: `const cookieJar = []` at module scope in `api-tester.js`; no store, no serialization
path anywhere.

**Why** (per CLAUDE.md's explicit gotcha and SPEC §4.7.5): session cookies captured from arbitrary
third-party APIs the user is testing are exactly the kind of secret DevSuite's "offline-first,
nothing persists without the user asking" posture should not silently write to disk. Scoping it to
page lifetime means a reload is a clean slate — no cleanup UI needed, no "forgot cookies were still
here from last week" surprise.

**Rejected alternative — DevDB store like `collections`**: would need its own encryption story
(cookies can carry session tokens) and a retention/expiry policy; the in-memory choice sidesteps
both by making persistence simply not exist.

## R3 — Smart CORS routing: preflight-prediction heuristic instead of always-proxy or always-direct

**Chosen**: `ApiClient._willNeedPreflight()` predicts, from method/headers/content-type, whether a
cross-origin request would trigger a CORS preflight, and skips straight to the proxy for those;
"simple" requests try direct first and fall back to the proxy on failure.

**Why**: always-proxy would add a needless server hop (and server-side timeout ceiling) for
same-origin/CORS-friendly targets; always-direct-first would mean every non-simple cross-origin
request eats one guaranteed-failing round trip (visible in DevTools as a CORS error) before falling
back. The heuristic trades a small amount of prediction complexity for avoiding both costs in the
common cases.

**Known current limitation** (SPEC §4.7, §13 backlog item #10, preserved verbatim in spec.md's
Edge Cases): the document's `connect-src 'self'` CSP directive blocks the "try direct first" fetch
for cross-origin targets regardless of the preflight prediction, so in practice the fallback path
always fires for cross-origin "simple" requests too. The heuristic is architecturally sound but its
main-thread direct-attempt branch is currently unreachable for cross-origin targets — a known,
already-tracked gap, not a new finding.

## R4 — Postman/OpenAPI import: format auto-detection instead of a user-selected dropdown

**Chosen**: `detectImportFormat()` sniffs the uploaded JSON's shape (`info.schema` hostname for
Postman; `Array.isArray(data) || data.items` for DevSuite-native) rather than asking the user to
pick a format.

**Why**: reduces one interaction step for the common case (drag in a Postman export, it just
works) and matches the "no build step, minimal UI ceremony" tone of the rest of the suite. The
OpenAPI path is a separate explicit modal (paste/upload spec text) rather than folded into the same
auto-detect flow — plausibly because OpenAPI specs and Postman collections/DevSuite exports don't
share a natural single "import" affordance (OpenAPI produces N new items from a schema, not a
literal collection file to merge).

## R5 — Folder hierarchy as a flat `/`-separated string, not a nested object tree

**Chosen**: `item.folder = "payments/v2/refunds"` (a string on the flat `collections` array),
with the visual tree (`buildFolderTree()`) rebuilt from scratch on every render.

**Why**: keeps the persisted shape (and the DevDB payload) trivially flat and diff-friendly (matters
for the git-friendly zip export, US8) and makes "legacy single-segment folder values remain valid,
no migration" (SPEC §4.7.4) true for free — a single string field has no schema to migrate. The
cost is O(n) tree rebuild on every sidebar re-render, judged acceptable at the tool's practical
scale (hundreds, not tens of thousands, of requests — see plan.md Scale/Scope).

## R6 — `collection-utils.js`/`cookie-jar.js`/`curl-codegen.js` factored out as pure, dual-exported modules

**Chosen**: three logic-heavy subsystems live in standalone files with no DOM access, exporting via
the `(root, factory)` UMD-lite pattern (`module.exports` in Node, `globalThis.X` in the browser) so
the exact same code is both what ships to the browser and what `tests/javascript/run.js` exercises.

**Why**: DevSuite has no build step or bundler (Art. III), so "unit-testable" for browser code
specifically means "loadable unmodified by plain Node" — this pattern is the mechanism that makes
that possible without a transpile step, and it's the reason these three modules (and no others in
`api-tester.js`) have real automated coverage.
