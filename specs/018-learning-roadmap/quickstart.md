# Quickstart: Learning Roadmap

## Prerequisites

- Repo checked out, Python deps installed (`pip install -r requirements.txt`), no master
  password needs to be set up — this tool is unauthenticated tier.

## Backend validation (M1–M2)

```bash
pytest tests/python/test_roadmap_utils.py -v      # compute_completion pure-function unit tests
pytest tests/python/test_roadmap_api.py -v         # /api/roadmaps* route tests incl. CSRF/404/409
pytest tests/python/test_csrf.py -v                # cookie-issuance-for-everyone regression cases
pytest tests/python/ -v                             # full backend suite must stay green
```

Manual API smoke test (server running, `./start.sh`):

```bash
# 1. Cold visitor gets a CSRF cookie on first GET, no auth needed
curl -i http://localhost:8000/roadmap | grep -i set-cookie

# 2. List (empty until seeded)
curl http://localhost:8000/api/roadmaps

# 3. Create, using the cookie from step 1 as both cookie and header
CSRF=<value from step 1>
curl -X POST http://localhost:8000/api/roadmaps \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" -b "ds_csrf=$CSRF" \
  -d '{"id":"test-roadmap","title":"Test","description":"smoke test"}'

# 4. Duplicate id is rejected
curl -i -X POST http://localhost:8000/api/roadmaps \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" -b "ds_csrf=$CSRF" \
  -d '{"id":"test-roadmap","title":"Dup"}'   # expect 409

# 5. Clean up
curl -X DELETE http://localhost:8000/api/roadmaps/test-roadmap \
  -H "X-CSRF-Token: $CSRF" -b "ds_csrf=$CSRF"
```

## Seed data (M6)

```bash
python scripts/seed_roadmap.py
curl http://localhost:8000/api/roadmaps | python -m json.tool   # expect ai-mlops-roadmap, 6 steps, 0%
```

## Frontend validation (M3–M5)

1. Start the app, visit `/roadmap` with no `?id=` — expect the roadmap list view with the seeded
   card showing 0% (the seeded checklist items exist but start unchecked).
2. Click into the seeded roadmap (`/roadmap?id=ai-mlops-roadmap`) — expect all 6 steps in the
   documented order, each showing 0%, each with a populated checklist, curated `course_links`,
   and a `documents` entry linking to that step's original guide at `/roadmap/docs?doc=<slug>`
   (opens `roadmap-doc-viewer.html`, which fetches and renders `static/roadmap-docs/<slug>.md`).
3. Open a step's checklist section, add/check an item — expect the step and header percentages to
   update immediately (US2 AC1), and to still be correct after a page reload (US2 AC3).
4. Disconnect network (or stop the server) mid-toggle — expect the checkbox to visibly revert and
   a toast/error to appear (US2 AC2), not a silently-wrong checked state.
5. Open a step's Notes section, type markdown, navigate away and back — expect the notes to have
   persisted (US3 AC1). Add a course link and a document link with a title but empty URL — expect
   it to render as non-clickable text, not a broken `<a href="">` (spec.md Edge Cases).

## Full-suite gate before considering the feature done

```bash
pytest tests/python/                 # all tests, not just the new ones
node tests/javascript/run.js
```
