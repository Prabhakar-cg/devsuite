# Tasks: Local API Tester

**Input**: Design documents from `specs/008-api-tester/`

**Tests**: partial — three pure JS modules have dedicated unit tests; the SSRF/cookie-passthrough
security paths on `/api/proxy` have Python tests; `api-tester.js`, `script-sandbox-worker.js`, and
`/api/collections` do not (see quickstart.md's coverage accounting).

**Organization**: grouped by user story from spec.md. **All tasks below are marked `[X]` because
this is a retroactive spec for an already-shipped feature** — they describe what was built, not
what remains to be built. This file exists so the spec-kit tooling (`/speckit-analyze`,
`/speckit-converge`) has a task inventory to diff future changes against.

## Format: `[ID] [Story] Description`

## Phase 1: Foundational plumbing

- [X] T001 `POST /api/proxy` — SSRF-guarded CORS bypass proxy (`routes/proxy.py`), incl. redirect
      re-validation (`_SSRFSafeRedirectHandler`) and per-Set-Cookie-header preservation
- [X] T002 `GET/POST /api/collections` — DevDB-backed opaque store with server-side
      `require_unlocked` auth gate (`routes/storage.py`)
- [X] T003 `ApiClient` fetch wrapper (`static/api-client.js`) — header/body building, smart
      CORS-preflight prediction and direct→proxy fallback, proxy-wrapper response decoding

## Phase 2: User Story 1 — Send a REST request, directly or via proxy (P1)

- [X] T004 [US1] Request builder UI (method/URL/params/headers/body tabs incl. JSON/form-data/
      text/GraphQL) in `static/api-tester.html` + `static/api-tester.js`
- [X] T005 [US1] Response rendering (status/time/size/headers/body, proxy chip + banner) —
      `renderResponse`, `_renderResponseBody`, `_renderResponseHeaders`
- [X] T006 [US1] Monaco integration for request/response JSON/GraphQL panes (RequireJS-loaded,
      theme-synced via `devsuite-theme-changed`)

## Phase 3: User Story 2 — Nested folders & sidebar management (P1)

- [X] T007 [US2] `collection-utils.js` pure module: path normalize, rename cascade, delete, move
- [X] T008 [US2] Folder tree rendering + counts (`buildFolderTree`, `countTreeItems`,
      `createFolderElement`) with collapse/expand
- [X] T009 [US2] Request/folder context menus (rename/duplicate/move/delete; rename/delete folder)
- [X] T010 [US2] Drag-and-drop reorder/move (request↔request, request→folder, request→top-level)
- [X] T011 [US2] Folder auth modal + `resolveFolderAuth` ancestor-walk inheritance

## Phase 4: User Story 3 — Import/export interop (P2)

- [X] T012 [US3] `curl-codegen.js` pure module: tokenizer, `parseCurl`, `buildCurl/Fetch/Httpie`
- [X] T013 [US3] Postman v2.x collection import (`detectImportFormat`, `parsePostmanCollection`,
      `parsePostmanRequest` + URL/body/auth sub-parsers) — inline in `api-tester.js`, not factored
      into a pure module (see contracts/frontend-modules.md's "Non-contracts" note)
- [X] T014 [US3] Postman environment import (`parseEnvImport`) with disabled-var skip + same-name
      replace
- [X] T015 [US3] OpenAPI 3.x / Swagger 2.x import (`parseOpenApiSpec`, `mergeParameters`,
      `extractRequestBody`, `buildSchemaExample`)
- [X] T016 [US3] Code modal: cURL/fetch/HTTPie snippet generation + curl paste-to-import

## Phase 5: User Story 4 — Collection runner (P2)

- [X] T017 [US4] Runner modal UI + per-row status lifecycle (`_createRunnerRow`)
- [X] T018 [US4] `runCollectionItems`/`_runOneItem` sequential execution loop with Stop-after-current
- [X] T019 [US4] Run-scoped `runtimeVars` persistence (reset once per run, not per item) for
      request chaining
- [X] T020 [US4] OAuth2 cached-token reuse in runner (no interactive prompts)

## Phase 6: User Story 5 — Environments & interpolation (P2)

- [X] T021 [US5] Environment CRUD modal, `localStorage`-backed (`devsuite-api-environments`)
- [X] T022 [US5] `interpolate`/`interpolateObj` — `{{key}}` resolution (runtimeVars → env vars →
      passthrough)
- [X] T023 [US5] OAuth2 token fetch (`fetchOAuth2Token`, client_credentials + password grants,
      direct-then-proxy-fallback)

## Phase 7: User Story 6 — Script sandbox (P2)

- [X] T024 [US6] `script-sandbox-worker.js`: Worker isolation, scoped CSP response header
      (`main.py` path check + `tests/python/test_csp.py`), `MAX_SCRIPT_LENGTH` +
      `BLOCKED_SCRIPT_PATTERNS` static checks, HMAC `verifySignedScript` signature check
- [X] T025 [US6] `runScriptSandboxed` orchestration in `api-tester.js`: postMessage protocol,
      10s timeout + worker recreation, mutation application back into `runtimeVars`/env vars
- [X] T026 [US6] Wire the signed-execution path (found missing during the initial retroactive-spec
      pass 2026-07-28, fixed same day): `api-tester.js` generates a random per-worker-instance
      token on worker creation (`{kind: 'init', token}`) and HMAC-SHA256-signs each script under it
      (`_signScript`) before sending `codeSig`/`authToken`; `script-sandbox-worker.js` verifies both
      and then executes the script via `new Function()`, legal only inside its own
      `unsafe-eval`-scoped CSP response.

## Phase 8: User Story 7 — Cookie jar (P3)

- [X] T027 [US7] `cookie-jar.js` pure module: parse/upsert/match/prune
- [X] T028 [US7] `executeWithJar` wiring: attach matching cookies pre-send, capture `Set-Cookie`
      from proxied responses post-send (used by both single-Send and Runner paths)
- [X] T029 [US7] Cookies modal: per-domain listing, per-cookie delete, clear-all

## Phase 9: User Story 8 — Git-friendly zip export/import (P3)

- [X] T030 [US8] Zip export (`btnExportZip` handler): one JSON file per request mirroring folder
      paths, `collection.meta.json` manifest, filename sanitization + collision suffixes,
      `folderAuths` deliberately excluded
- [X] T031 [US8] Zip import (`importCollectionsZip`): per-entry folder-path derivation from archive
      path, script-retention confirm prompt, replace/merge confirm

## Phase 10: Retroactive Documentation

- [X] T032 Author `specs/008-api-tester/{spec,plan,tasks,data-model,quickstart,research}.md` and
      `contracts/{http-api,frontend-modules}.md` from `specs/SPEC.md` §4.7 + direct source
      inspection (2026-07-28); flag the script-sandbox execution gap and the OAuth2/GraphQL/History
      documentation gap discovered during inspection rather than silently omitting them.

---

## Dependencies & Execution Order (as observed, not prescriptive)

Phase 1 (backend + client) underlies every user story. US2 (folders) is a prerequisite for parts of
US3 (Postman folder import), US4 (folder-scoped runs), and US8 (folder-mirrored zip paths). US6's
script sandbox depends on Phase 1's Worker file existing but is otherwise independent of US2–US5.
