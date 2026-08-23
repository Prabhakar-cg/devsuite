---
description: "Task list for Learning Roadmap (018)"
---

# Tasks: Learning Roadmap

**Input**: Design documents from `/specs/018-learning-roadmap/` (plan.md, spec.md, research.md,
data-model.md, contracts/roadmap-api.md, quickstart.md)

**Tests**: Included — Constitution Art. VI requires tests for the CSRF change, and this repo's
convention (`tests/python/test_*.py` per route module) is followed for the new routes/utils too.

**Organization**: Tasks are grouped by **milestone** (M1–M6), per the explicit instruction in
plan.md/spec.md that these are gated: implementation stops and checks in with the user after each
milestone completes, rather than continuing automatically through M6. Each milestone also carries
`[US#]` labels mapping to spec.md's user stories where applicable, so story-level independent
testability is still traceable within the milestone structure.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no unfinished dependency)
- **[US#]**: Which spec.md user story this task serves (US1 list/track, US2 checklist, US3
  notes/links, US4 create/manage) — omitted for tasks with no single-story mapping (data layer,
  seed, docs)

## Path Conventions

Single project (existing DevSuite monolith) — paths are repo-root-relative per plan.md's
Project Structure section.

---

## M1 — Data Layer (no routes)

**Purpose**: `compute_completion()` and the new DevDB store, fully unit-tested in isolation
before any HTTP surface exists. Satisfies FR-011/FR-012/FR-013.

**Independent Test**: `pytest tests/python/test_roadmap_utils.py -v` passes with no dependency on
`main.py`/`routes/`.

- [x] T001 [P] Add `"roadmaps"` to `_ALLOWED_STORES` in `deps.py`
- [x] T002 Create `roadmap_utils.py` at repo root with `compute_completion(roadmap: dict) -> dict`
      per `data-model.md`'s Completion Computation section: returns
      `{"roadmap_pct": int, "steps": {step_id: int}}`; step % = `round(100 * done/total)` or `0`
      if `total == 0`; roadmap % = `round(mean(step_pcts))` or `0` if the roadmap has no steps.
      Pure function — no DevDB/FastAPI imports.
- [x] T003 Create `tests/python/test_roadmap_utils.py` covering: a step with 0 checklist items →
      0% (not NaN/error); a roadmap with 0 steps → 0%; a roadmap with steps at 0%/50%/100% →
      unweighted-average roadmap % of 50 (spec.md US1 AC2); a step with 2/4 done → 75% after a
      third item flips to done (values only, no route call — this test calls `compute_completion`
      directly on hand-built dicts); rounding behavior at a non-exact fraction (e.g. 1/3).

**Checkpoint**: `pytest tests/python/test_roadmap_utils.py -v` green. **Stop here and check in
before starting M2.**

**Status: DONE** — `pytest tests/python/test_roadmap_utils.py -v` (5/5 passed) and full suite
`pytest tests/python/ -q` (59/59 passed, no regressions from the `deps.py` change).

---

## M2 — API + CSRF Prerequisite Fix

**Purpose**: The `/api/roadmaps*` HTTP surface from `contracts/roadmap-api.md`, plus the
cross-cutting fix (research.md item 1) that makes any unauthenticated-tier mutating route usable
at all. Satisfies FR-001–FR-010, FR-016, FR-019, FR-020 (page reachable).

**Independent Test**: `pytest tests/python/test_roadmap_api.py tests/python/test_csrf.py -v`
passes; `quickstart.md`'s curl smoke-test sequence (steps 1–5) succeeds against a running server
with no master password ever set.

### CSRF prerequisite fix

- [x] T004 In `main.py`, add CSRF-cookie-issuance-for-every-visitor: before/alongside the
      existing `csrf_middleware`, if an incoming request has no `ds_csrf` cookie, generate one via
      `secrets.token_urlsafe(32)` and set it on the outgoing response with the same
      `httponly=False, samesite="strict", secure=_HTTPS` flags `routes/auth.py`'s existing
      `set_cookie` call for `ds_csrf` uses (match flags exactly — do not diverge). Must not change
      behavior of `/api/auth/session`'s own (re)issuance. Reference research.md item 1 for the
      full rationale/decision.
      *(Implemented as `ensure_csrf_cookie` middleware, registered right before
      `csrf_middleware`; used `secrets.token_hex(32)` and `max_age=_SESSION_TTL` to exactly match
      `routes/auth.py`'s existing `ds_csrf` issuance — closer fidelity than the plan's
      `token_urlsafe` guess.)*
- [x] T005 Add to `tests/python/test_csrf.py`: a bare `GET /` (or any page route) with no cookies
      sent returns a `Set-Cookie: ds_csrf=...` header; a subsequent mutating request using that
      cookie value as both cookie and `X-CSRF-Token` header succeeds past the CSRF check (still
      401/404s downstream as appropriate, per existing test style
      `test_post_with_matching_csrf_passes_then_requires_session`); confirm
      `test_post_without_csrf_is_forbidden` and `test_post_with_mismatched_csrf_is_forbidden`
      still pass unchanged (regression guard — the fix must not weaken the pairing check).

### `routes/roadmap.py`

- [x] T006 Create `routes/roadmap.py` with a new `APIRouter()`, following the structural pattern
      of `routes/storage.py` (validated CRUD over a DevDB store) but with **no**
      `require_unlocked` dependency on any route (unauthenticated tier — research.md item 5).
      Import `roadmap_utils.compute_completion`.
- [x] T007 [US1] Implement `GET /api/roadmaps` — list summaries (`id`, `title`, `description`,
      `completion_pct`, `created_at`, `updated_at`) per `contracts/roadmap-api.md`, computing
      `completion_pct` via `compute_completion` per roadmap, never persisting it.
- [x] T008 [US1] Implement `GET /api/roadmaps/{id}` — full detail, steps sorted by `order` (not
      array position, per FR-014/research.md item 4), each step annotated with its own
      `completion_pct`, roadmap annotated with its overall `completion_pct`. 404 on unknown id.
- [x] T009 [US4] Implement `POST /api/roadmaps` — validate `id` against the slug pattern
      `^[a-z0-9][a-z0-9-]*$` and non-empty `title`; 400 on validation failure; 409 if `id` already
      exists in the store (FR-005); on success, set `created_at`/`updated_at` to current UTC
      ISO-8601, `steps: []`, write via `deps._db.set_store("roadmaps", ...)` +
      `deps._db.save()`, return 201 with the created record.
- [x] T010 [US4] Implement `PUT /api/roadmaps/{id}` — update `title`/`description` only (`id`,
      `created_at`, `steps` immutable via this route); 404 unknown id; 400 empty `title` after
      trim; bump `updated_at`.
- [x] T011 [US4] Implement `DELETE /api/roadmaps/{id}` — 204 on success, 404 unknown id, removes
      only that roadmap's entry from the store dict (FR-015 — no cross-roadmap effect).
- [x] T012 [US3] Implement `PATCH /api/roadmaps/{id}/steps/{step_id}` — update any subset of
      `notes`/`course_links`/`documents` present in the body; 404 unknown roadmap id or step id
      (FR-019); bump roadmap `updated_at`; return the updated step + its `completion_pct`.
- [x] T013 [US2] Implement `PATCH /api/roadmaps/{id}/steps/{step_id}/checklist/{item_id}` —
      require `done: bool` in body (400 if missing/wrong type — explicit set, not blind toggle,
      per contracts/roadmap-api.md's stale-retry rationale); 404 unknown roadmap/step/item id;
      persist; return `{"item": {...}, "step_completion_pct": int, "roadmap_completion_pct": int}`.
- [x] T014 Register the router in `main.py` (`app.include_router(roadmap.router)`) alongside the
      existing router includes.
- [x] T015 [P] In `routes/pages.py`, add `GET /roadmap` → `_serve_html("roadmap.html")` following
      the exact pattern of the adjacent `read_notes`/`read_file_converter` routes (unauthenticated
      tier — no session dependency). *(`roadmap.html` doesn't exist until M3, so this currently
      404s via `_serve_html`'s existing FileNotFoundError→404 handling — expected and harmless.)*

### Tests for `routes/roadmap.py`

- [x] T016 [P] Create `tests/python/test_roadmap_api.py` (uses the `client`/`isolated_db`
      fixtures from `conftest.py`). Cover, at minimum: `GET /api/roadmaps` empty list on a fresh
      store; full create→list→get→update→delete lifecycle happy path; `POST` with duplicate `id`
      → 409; `POST` with empty `title` → 400; `GET/PUT/DELETE` on unknown id → 404;
      `PATCH .../steps/{step_id}` on unknown roadmap or step id → 404; checklist toggle happy
      path recomputes and returns both `step_completion_pct` and `roadmap_completion_pct`
      correctly; checklist toggle on unknown item id → 404; checklist toggle missing `done` → 400;
      every mutating route call in these tests must include a valid CSRF pair (obtained via a
      preceding `GET` per T005's new cookie-issuance behavior) since these routes have no session
      gate to bypass CSRF with.

**Checkpoint**: `pytest tests/python/ -v` fully green (not just the new files — confirms the CSRF
fix didn't regress Vault/Notes/SSH tests). `quickstart.md`'s curl sequence succeeds manually.
**Stop here and check in before starting M3.**

**Status: DONE** — `pytest tests/python/ -q` (75/75 passed: 59 pre-existing + 5 roadmap_utils + 2
new CSRF cases + 14 roadmap API tests, zero regressions); `node tests/javascript/run.js`
(112/112 passed, unaffected). Manually confirmed via `TestClient` that the CSRF fix un-breaks the
three pre-existing endpoints (`/api/convert`, `/upload`, `/api/proxy`) using a cookie minted from
a bare `GET /`. `GET /roadmap` currently 404s (no `roadmap.html` yet) — expected until M3.

---

## M3 — UI: List + Detail (read-only)

**Purpose**: Render roadmaps and steps read-only; no mutations wired yet. Satisfies FR-002/FR-003
UI-side, SC-001, SC-006 (partially — tool tile itself lands in M6).

**Independent Test**: With a roadmap seeded manually via the M2 API (or ad hoc `POST`), loading
`/roadmap` shows it in the list with correct `completion_pct`; `/roadmap?id=<id>` shows its steps
in order with correct per-step `%`. No checkbox/edit interaction needs to work yet.

- [x] T017 [P] Create `static/roadmap.css` — reuse existing card/glassmorphic tokens from
      `static/style.css` (no new custom properties, per the locked design decision and Constitution
      Check); style: roadmap-card grid (list view), progress bar, step accordion/card shell
      (collapsible sections for Notes/Checklist/Course Links/Documents, styled empty/populated).
- [x] T018 [US1] Create `static/roadmap.html` — page shell (head/nav consistent with
      `static/data-linter.html`'s structure), a list-view container and a detail-view container,
      both initially empty, toggled by presence of `?id=` in the URL (mirrors
      `data-linter.html?tab=` routing style per plan.md). Loads `theme.js`, `components.js`,
      `roadmap.css`, `roadmap.js` in that order (no Monaco/RequireJS yet — deferred to M5, so no
      UMD-ordering concern at this milestone). *(Followed the `notes.html`/`app-header` shell
      pattern per plan.md's cross-cutting checklist rather than `data-linter.html`'s tab-strip
      layout, which doesn't fit a list↔detail tool — same token/class reuse either way.)*
- [x] T019 [US1] Create `static/roadmap.js` — on load, read `?id=` from `location.search`; if
      absent, `fetch('/api/roadmaps')` and render one card per roadmap (title, description,
      completion bar) via `document.createElement`/`textContent` only (Constitution Art. V — no
      `innerHTML`); if present, `fetch('/api/roadmaps/{id}')` and render the detail header
      (title/description/overall %) plus one card per step in `order`, each showing its title,
      description, and per-step % bar, with empty (not-yet-interactive) placeholders for the
      Notes/Checklist/Course Links/Documents sections. A 404 from the detail fetch shows a clear
      "roadmap not found" state rather than a blank page or a JS error (relates to FR-019/edge
      cases — deleted-roadmap-in-another-tab scenario).

**Checkpoint**: Load `/roadmap` and `/roadmap?id=<seeded-id>` in a browser (or via a quick manual
fetch check) and visually confirm correct, correctly-computed read-only rendering. **Stop here and
check in before starting M4.**

**Status: DONE** — Verified via `TestClient` against an isolated temp DB (not the real
`~/.devsuite/devdb.dsb` — an earlier ad hoc check accidentally wrote to the real file and was
cleaned up): `GET /roadmap` returns 200 with correctly fingerprinted asset URLs;
`GET /api/roadmaps/{id}` detail payload renders correctly into the DOM structure (notes,
checklist with done/not-done state, course links with a real URL rendered as `<a>`, a document
with an empty URL rendered as plain text per spec.md Edge Cases). `pytest tests/python/ -q`
75/75 still green (no backend changed this milestone); `test_asset_order.py` unaffected (no UMD
bundles added). `node --check static/roadmap.js` passes. No manual browser session was opened.

---

## M4 — Checklist Interactivity

**Purpose**: Wire up checklist toggling with optimistic UI + rollback on failure. Satisfies
FR-010, US2 fully (spec.md AC1–AC3), SC-002.

**Independent Test**: Toggling a checklist item updates displayed % within 500ms without a page
reload (US2 AC1); killing the server mid-toggle visibly reverts the checkbox and surfaces an error
(US2 AC2); the toggled state survives a reload once the request has actually succeeded (US2 AC3).

- [x] T020 [US2] In `static/roadmap.js`, render each step's checklist items as real checkboxes
      (still `createElement`/`textContent`, no `innerHTML`) once M3's placeholder is replaced;
      wire a `change` handler per item.
- [x] T021 [US2] Implement optimistic toggle in `static/roadmap.js`: on checkbox change,
      immediately flip its visual state and recompute-and-redraw the step's and roadmap's %
      client-side (mirroring `compute_completion`'s rule for immediate feedback — no round trip
      needed to redraw), then `PATCH /api/roadmaps/{id}/steps/{step_id}/checklist/{item_id}` with
      `{"done": <new state>}` and the CSRF header (via `DevSuite.csrfToken()`, matching the
      pattern in `static/notes.js`/`static/db-manager.js`); on a non-2xx/network failure, revert
      the checkbox and the recomputed %s to their prior values and surface an error via the
      existing toast utility in `components.js` (US2 AC2 — no silent wrong-state display); on
      success, reconcile displayed %s with the response's authoritative
      `step_completion_pct`/`roadmap_completion_pct` (in case of any drift from the optimistic
      client-side guess).

**Checkpoint**: Manually toggle items with the server running (confirm persistence across reload)
and with the server stopped mid-toggle (confirm visible revert + error, not a false-positive
checked state). **Stop here and check in before starting M5.**

**Status: DONE** — `computeStepPct`/`computeRoadmapPct` client-side helpers added, cross-checked
against `roadmap_utils.py`'s own test cases via `node -e` (0/0→0, 1/3→33, 3/4→75, mixed-average
roadmap→50 — all match). Checkbox is disabled for the duration of its own in-flight PATCH
(prevents a double-submit race on the same item, consistent with the API's explicit-set-not-
blind-toggle contract). Verified the API-side contract the rollback logic depends on via
`TestClient` against an isolated temp DB: toggle-true returns `step_completion_pct`/
`roadmap_completion_pct` correctly (50/50 on a 1-of-2-done step), and an unknown item id (the
failure path the JS `catch` block handles) returns 404 as expected. `pytest tests/python/ -q`
still 75/75 and `node tests/javascript/run.js` still 112/112 (M4 is frontend-only, no backend
touched). No live browser session was opened — full DOM interaction relies on the code review
above plus the verified API contract; flag if you'd like a manual browser pass before M5.

---

## M5 — Notes + Links/Documents Editing

**Purpose**: Full step content editing. Satisfies FR-009, US3 fully (spec.md AC1–AC3).

**Independent Test**: Editing notes, adding/removing a course link, and adding/removing a document
on one step all persist across reload and stay scoped to that step only (US3 AC2/AC3 — not
leaking into other steps).

- [x] T022 [US3] In `static/roadmap.js`, initialize a Monaco editor instance
      (`DevSuite.initMonaco(...)` from `components.js`, `language: 'markdown'`) per expanded step's
      Notes section, seeded with the step's current `notes` value; per research.md item 3, this is
      the plain-text edit/display surface — no separate rendered-HTML view, no `marked`/DOMPurify
      dependency added.
      *(Lazy per-step instance, created on that step's first expand via `renderNotesSection`'s
      `ensureEditor()`, called from the step-head click handler right after the `expanded` class
      is toggled — so Monaco mounts into an already-visible, correctly-sized host, matching
      `.roadmap-notes-host`'s fixed 200px height in `roadmap.css`.)*
- [x] T023 [US3] Wire notes save: on blur (or a debounce) of the Monaco instance,
      `PATCH /api/roadmaps/{id}/steps/{step_id}` with `{"notes": <editor value>}` + CSRF header;
      surface a save-failed toast on error (consistent with T021's error-handling pattern), and do
      not silently discard the user's in-editor text on failure (leave it editable, just flag the
      unsaved state).
      *(Blur-triggered via `onDidBlurEditorWidget`; a small status line under the editor shows
      "Saving…"/"Saved"/"Save failed — your change was not saved." — the editor content itself is
      never touched on failure, satisfying the no-silent-discard requirement.)*
- [x] T024 [P] [US3] In `static/roadmap.js`, implement add/edit/remove for `course_links`: a small
      inline form (title + URL text inputs, add button) per step, rendering existing links as
      `<a>` when `url` is non-empty and as plain text when empty (per spec.md Edge Cases — no
      `href=""` placeholders); each add/remove sends the full updated `course_links` array via the
      same step `PATCH` endpoint (matches the array-replace contract in
      `contracts/roadmap-api.md`).
      *(Scope note: "edit" is remove-then-re-add rather than a separate in-place-edit form — no
      dedicated edit UI was built. spec.md's US3 acceptance criteria (AC2/AC3) only exercise
      add/remove, and FR-009 only requires links to be updatable, not that in-place editing be a
      distinct interaction; remove+re-add reaches the same end state. Flagging in case a true
      inline-edit affordance is wanted before this ships.)*
- [x] T025 [P] [US3] Mirror T024 for `documents` (identical shape/behavior, separate array/field).
      *(Implemented as one shared `renderEditableLinks(step, roadmapId, fieldName, emptyLabel)`
      used for both `course_links` and `documents` — same reuse rationale as the CLAUDE.md
      "don't design for hypothetical future requirements" guidance: the two fields are identical
      in shape, so one parameterized function rather than two near-duplicate ones.)*

**Checkpoint**: Manually add notes + a course link + a document to one step, add a different set to
a second step, reload, and confirm each step shows only its own content (US3 AC2 cross-step
isolation check). **Stop here and check in before starting M6.**

**Status: DONE** — Verified the full API surface these features depend on via `TestClient`
against an isolated temp DB (not the real local one): notes save round-trips exact content
(including markdown syntax); course-link add and remove round-trip correctly including the
empty-URL placeholder case; and — the important one for US3 AC2/AC3 — a second step on the same
roadmap is provably untouched (empty notes/documents) after editing the first step's content,
confirming per-step isolation at the data layer. `pytest tests/python/ -q` 75/75, `node
tests/javascript/run.js` 112/112 (M5 is frontend-only). `node --check static/roadmap.js` passes.
No live browser session was opened — as with M3/M4, this relies on code review plus the verified
API contract rather than an interactive Monaco session; flag if a manual browser pass is wanted
before M6.

---

## M6 — Seed Data + Integration

**Purpose**: Ship the pre-populated AI/MLOps roadmap and make the tool discoverable, then fold the
feature's durable contracts back into `specs/SPEC.md` and bump the version, per Constitution
Art. I/VII. Satisfies FR-018, FR-020, SC-004, SC-006.

**Independent Test**: `python scripts/seed_roadmap.py` followed by `GET /api/roadmaps` shows
`ai-mlops-roadmap` with exactly 6 steps in the documented order, each at 0%; the tool is reachable
by clicking through from `/` and `/tools` with no prior knowledge of the `/roadmap` URL (SC-006).

- [x] T026 Create `scripts/seed_roadmap.py` — a standalone script (run via `python
      scripts/seed_roadmap.py`, opening the real `DevDB` at its default path like the app does,
      not the test fixture) that writes `ai-mlops-roadmap` into the `roadmaps` store with the six
      steps from spec.md FR-018 in order (`step-1`..`step-6`, titles/descriptions exactly as
      listed there), each with empty `checklist`/`notes`/`course_links`/`documents`; must be
      idempotent-safe against re-running (either skip if `ai-mlops-roadmap` already exists, or
      overwrite cleanly — pick the simpler of the two and note the choice in the script's
      docstring).
      *(Chose skip-if-exists — documented in the script's own docstring: seeding is a one-time
      bootstrap, not a re-sync, so a re-run never clobbers a user's in-progress checklist/notes.)*
- [x] T027 [P] Add a "Learning Roadmap" tile to `static/home.html`, matching the existing tile
      markup/icon-style convention already used there (stroke SVG icon, no emoji — Art. V).
      *(Added as a 7th entry in the `.features-grid` highlight reel — home.html has no
      comprehensive all-tools grid of its own (that's tools.html's job); also bumped the two
      "12 tools"/hero-stat-num references there to 13.)*
- [x] T028 [P] Add the 13th `tool-card` to `static/tools.html` (`href="/roadmap"`, appropriate
      `data-category`, icon, title, description, tag-chips) following the exact markup pattern of
      the existing `notes` card at the end of the grid; update the static filter-count `<span
      class="filter-count">` values to match what `updateFilterCounts()` will recompute at runtime
      (CLAUDE.md gotcha) — total 12→13 plus whichever category filter this card's `data-category`
      belongs to.
      *(`data-category="dev"`, emerald trending-up icon; filter-count spans updated all→13,
      dev→5. Also fixed two more stray "12 tools"/"12 powerful developer tools" strings on
      tools.html found via grep, not just the filter-count spans.)*
- [x] T029 Update `specs/SPEC.md`: add a row for Learning Roadmap to the §4 tool index; add the
      `/api/roadmaps*` routes to §5 (API surface); add the `roadmaps` store to §6 (storage); add a
      note to the relevant CSRF/security section (§7) documenting the cookie-issuance-for-every-
      visitor change from M2 and that it applies suite-wide, not just to this tool.
      *(Also updated: top-of-file version/spec-count blockquote, §1.3, §3.2 directory layout,
      §3.4 module-to-file map, §5.1 page routes, §10.2 required-coverage list, and §13 planned
      roadmap — inserted "v0.5.0 — Learning Roadmap" and retargeted the pre-existing "UX
      Foundation"/"Power User" placeholders to v0.6.0/v0.7.0, mirroring exactly how v0.4.0's
      Notes Workspace entry retargeted them before. §5.6 was a genuinely unused number (5.5
      Collections jumped straight to 5.7 File Operations) — filled it with the new Roadmap API
      section rather than disturbing existing §5.7+ numbering.)*
- [x] T030 Version bump per Constitution Art. VII: `APP_VERSION` in `deps.py`, the version badge in
      `README.md`, a new heading in `CHANGELOG.md`, and `specs/SPEC.md` §1.3 — all four in the same
      commit, per CLAUDE.md's version bump protocol.
      *(0.4.0 → 0.5.0. Also updated two other stray 0.4.0 references SPEC.md's own §13 history
      and closing line — found via repo-wide grep for "0.4.0" to catch anything the four-place
      rule doesn't explicitly enumerate.)*
- [x] T031 Run the full validation pass from `quickstart.md` (backend suite, `node
      tests/javascript/run.js`, and the manual frontend walkthrough steps 1–5) and confirm every
      spec.md Success Criterion (SC-001–SC-006) holds against the seeded roadmap.
      *(75/75 Python, 112/112 JS. Live-browser pass via Playwright against an isolated `HOME`:
      seed script produces 6 steps at 0%; `/tools` shows 13 active tool-cards including the new
      one; `/` shows the updated hero-stat and feature tile, both confirmed fully opacity:1
      after the page's existing scroll-reveal animation settles. Real local DevDB confirmed
      untouched throughout (`roadmaps: 0 entries` before and after).)*

**Checkpoint**: Feature complete end-to-end. This is the final milestone — no further check-in
gate after this one (M7, a second devops-roadmap, is explicitly out of scope per spec.md).

**Status: DONE.**

---

## Dependencies & Execution Order

- **M1 → M2**: M2's routes call `roadmap_utils.compute_completion` (T007/T008/T013 depend on
  T002) and read/write the `roadmaps` store (T001).
- **M2 → M3**: M3's `roadmap.js` fetches `/api/roadmaps` and `/api/roadmaps/{id}` (T019 depends on
  T007/T008), and needs a working CSRF-cookie flow for later milestones even though M3 itself only
  does GETs.
- **M3 → M4**: M4 replaces M3's static checklist placeholders with interactive ones (T020 depends
  on T019's rendering existing).
- **M3 → M5**: M5 replaces M3's static Notes/Links/Documents placeholders (T022/T024/T025 depend
  on T019).
- **M4, M5 → M6**: M6's seed data (T026) is independent of M3–M5 UI work and could technically run
  right after M2, but is sequenced last per the explicit milestone order in plan.md/spec.md — do
  not reorder ahead of user check-in gates without asking.
- Within M2: T004 (CSRF fix) has no dependency on T006–T015 but must land in the same milestone
  since T016's tests need it to obtain a valid CSRF pair; do T004/T005 before T016.

### Parallel Opportunities

- M1: T001 and T002 touch different files ([P]); T003 depends on T002 existing.
- M2: T015 (page route) is independent of the `routes/roadmap.py` work ([P]); T016 depends on all
  of T006–T014 being in place.
- M3: T017 (CSS) is independent of T018/T019 ([P]).
- M5: T024 and T025 are structurally identical work on disjoint fields ([P]).
- M6: T027 and T028 touch different files ([P]).

---

## Implementation Strategy

Follow the milestones in order, **M1 → M2 → M3 → M4 → M5 → M6**, stopping at each checkpoint
above to check in before continuing — this sequencing is the explicit, locked instruction from the
original feature request (plan.md Summary), not a suggestion. Do not skip ahead or batch multiple
milestones into one pass without the user confirming it's wanted.
