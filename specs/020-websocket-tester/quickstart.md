# Quickstart — WebSocket Tester (020)

## Run the tool

1. Start DevSuite: `./start.sh` (or `python -m uvicorn main:app --reload`).
2. Open `http://localhost:8000/ws-tester` (also linked from `/tools` and the homepage).

## Verify by user story

**US1 — Connect / lifecycle**
- Enter a reachable echo endpoint, e.g. `wss://ws.postman-echo.com/raw` or `wss://echo.websocket.org`,
  click **Connect** → status goes Connecting → Open; the log records the open event with a timestamp.
- Click **Disconnect** → status Closed with code/reason logged.
- Enter `wss://10.255.255.1` (unreachable) → status Error/Closed, failure logged, tab stays alive.

**US2 — Send / receive**
- With the echo endpoint open, type `hello`, **Send** → a "sent" entry appears, followed by a
  "received" echo entry, correctly ordered and timestamped.
- Toggle JSON mode, send `{"a":1}` → sent entry shows pretty-printed JSON; the echoed reply is also
  detected as JSON and pretty-printed.
- Try **Send** while disconnected → refused with a clear message, nothing logged as sent.

**US3 — Subprotocols / recent**
- Enter a subprotocol (e.g. `graphql-ws`) and connect → negotiated subprotocol shown once open.
- Disconnect, reload → the endpoint appears in **Recent**; selecting it restores the URL/subprotocols.
- **Clear recent** → list empties and stays empty after reload.

**Edge cases**
- Blank URL or `http://…` / `javascript:…` → inline rejection, no connection attempt.
- Receive a binary frame → shown as `binary (N bytes)` with a preview, not `[object Blob]`.

## Verify the CSP override

```bash
# The /ws-tester page must allow ws:/wss:, every other page must not.
curl -sI http://localhost:8000/ws-tester | grep -i content-security-policy   # connect-src ... ws: wss:
curl -sI http://localhost:8000/          | grep -i content-security-policy   # connect-src 'self'
```

## Run the tests

```bash
node tests/javascript/run.js     # ws-utils.js unit tests
pytest tests/python/             # includes /ws-tester CSP + route assertions
```

## Files touched

- `static/ws-tester.html`, `static/ws-utils.js` (pure), `static/ws-tester.js` (controller), `static/ws-tester.css`
- `main.py` (scoped `/ws-tester` CSP branch), `routes/pages.py` (`GET /ws-tester`)
- `static/tools.html`, `static/home.html` (tool card + counts → 15 / Network 2)
- `deps.py`, `README.md`, `CHANGELOG.md`, `specs/SPEC.md` (version + tool inventory + CSP note)
- `tests/javascript/test_ws_utils.js` (+ registered in `run.js`), `tests/python/test_csp.py` (+ cases)
