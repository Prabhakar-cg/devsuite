# Quickstart & Validation: Base64 Encoder / Decoder

How to exercise this tool manually. There is no automated test suite covering this tool's logic
today (see Coverage note below) — validation is manual until a browser/e2e suite lands (SPEC
§10.1 lists Playwright e2e as a v1.0.0 deliverable).

## Setup

```bash
# from repo root, with the server running (not started by this doc — ask before running it)
open http://localhost:8000/base64
```

## Functional validation (maps to spec user stories)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| US1 | round-trip UTF-8 | Type `héllo 👋 world`, click Encode, then Decode the result | Output matches the original exactly |
| US1 | invalid Base64 | Paste `not-valid-base64!!!`, click Decode | Inline error panel, no crash |
| US2 | URL-safe mode | Switch to URL-safe, encode text that would contain `+`/`/` in standard Base64 | Output has no `+`, `/`, or `=` |
| US2 | URL-safe decode | With URL-safe output from above, click Decode | Original text recovered |
| US3 | JWT inspect | Paste a real 3-part JWT (e.g. from jwt.io's example token), click JWT | Header/payload shown as pretty JSON; signature segment shown as raw text |
| US3 | malformed JWT | Paste `not.a.jwt.token` (4 parts) or a 1-part string, click JWT | Toast error, no crash |
| US4 | file input | Choose a small `.txt` file via the file picker | Its contents appear in the input panel |
| US4 | swap | Produce an output, click Swap | Input and output panels exchange contents |

## Coverage note

`tests/python/` and `tests/javascript/` contain no tests specific to `base64.html`'s encode/decode/
JWT logic. `tests/python/test_asset_order.py` only verifies UMD load order for
`crypto-js.min.js`/`jszip.min.js` and is unrelated to this tool (Base64 loads no third-party JS
at all). Manual validation via the table above is the only current coverage.

## Acceptance gates

- Every scenario in the table above passes when exercised manually in a Chromium-based browser.
- No network request fires during any operation (verify via browser devtools Network tab —
  the only request should be the initial page/asset load).
- No `innerHTML` assignment with user-controlled content (verified by source inspection, SPEC
  §7.7) — a future regression here would be a security-relevant finding, not just a style issue.
