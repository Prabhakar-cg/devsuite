# Quickstart — ID Generator (019)

## Run the tool

1. Start DevSuite: `./start.sh` (or `python -m uvicorn main:app --reload`).
2. Open `http://localhost:8000/id-generator` (also linked from `/tools` and the homepage).

## Verify by user story

**US1 — Generate**
- Select `UUID v4`, set count `10`, click **Generate** → 10 distinct `…-4…-[89ab]…` values.
- Switch to `ULID`, Generate → 26-char Crockford-base32 values.
- Generate again → the list is replaced, not appended.

**US2 — Copy**
- Click a row's copy control → that single id is on the clipboard; confirmation shows.
- Click **Copy all** → all ids on the clipboard, one per line.

**US3 — Entropy inspection**
- Select each type → entropy panel shows random-bit count (UUID v4 → 122 bits, ULID → 80 random +
  48-bit timestamp, etc.) and a sortability note for time-based types.
- Generate a ULID / UUID v7 and inspect a value → its embedded creation timestamp renders as a date.

**Edge cases**
- Count `0`, blank, `-3`, `abc`, or `5000` → inline error, nothing generated, prior batch intact.

## Run the tests

```bash
# JS unit tests for the pure generator module (zero-dependency runner)
node tests/javascript/run.js

# Python route/asset wiring
pytest tests/python/
```

## Files touched

- `static/id-generator.html`, `static/id-gen.js` (pure), `static/id-generator.js` (DOM controller),
  `static/id-generator.css`
- `routes/pages.py` (`GET /id-generator`)
- `static/tools.html`, `static/home.html` (tool card + counts → 14 / Dev 6)
- `deps.py`, `README.md`, `CHANGELOG.md`, `specs/SPEC.md` (version + tool inventory)
- `tests/javascript/test-id-gen.js` (+ registered in `run.js`)
