# Contract: Markup Injected by `_serve_html()`

This project has no new REST/WS endpoint for this feature (Technical Context: no backend
API). The contract that matters instead is the exact markup `deps.py::_serve_html()`
injects into every HTML response — this is what `tests/python/test_command_palette_injection.py`
asserts against, and what any future maintainer editing `_serve_html()` must preserve.

## Guarantee

For **every** page served through `_serve_html()` (i.e. every current and future
`routes/pages.py` route), the returned HTML:

1. Contains exactly one
   `<link rel="stylesheet" href="/static/command-palette.css?v=XXXXXXXX">` tag, inserted
   immediately after the favicon tag(s) in `<head>`.
2. Contains exactly one
   `<script src="/static/command-palette-data.js?v=XXXXXXXX" defer></script>` tag,
   followed immediately by exactly one
   `<script src="/static/command-palette.js?v=XXXXXXXX" defer></script>` tag — in that
   order (the DOM controller depends on the data module's globals existing) — inserted
   immediately before `</body>`.
3. The `?v=XXXXXXXX` suffix on all three tags is the same 8-character content-hash
   fingerprint scheme `_asset_fingerprint()` already produces for every other
   `/static/*.css`/`.js` reference on the page (Constitution Art. VII: cache-busting stays
   automatic, no manual version string).
4. No pre-existing `<script src="...">` tag on the page changes its position relative to
   any other pre-existing `<script src="...">` tag (regression guard for
   `tests/python/test_asset_order.py`).

## Non-guarantees (explicitly out of scope)

- No guarantee about markup *inside* `command-palette.js`'s own runtime-created `<dialog>`
  element — that's client-side DOM the browser builds at runtime, not something
  `_serve_html()` emits, and not something a Python test can assert on.
- No guarantee this injection happens for HTML **not** served through `_serve_html()`
  (there is none currently — every page route in `routes/pages.py` uses it).
