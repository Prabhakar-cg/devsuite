# Quickstart: Validating 023

## Automated (run locally; CI runs the same)

```bash
pytest tests/python/            # includes test_a11y.py, test_asset_order.py
node tests/javascript/run.js
```

Expected: all pass. `test_a11y.py` asserts: injection on every page route; one `<main>`; skip link first in body; contrast matrix for 6 themes; no hex outside token blocks in migrated files; no retired alias names; reduced-motion + focus-visible + coarse-pointer rules present; no bare `outline:none`.

## Manual (headless Chromium — see memory note `env_playwright_no_sudo`)

Only when asked to run the server (CLAUDE.md):

1. Start the app, open each page in each theme.
2. Keyboard: Tab through the page — focus ring visible; first Tab reveals "Skip to main content" and it jumps to main.
3. Dialogs: open unlock/confirm/editor dialogs — focus moves in, Tab wraps, Esc closes (except pre-unlock), focus returns.
4. Announcements: trigger a toast; confirm screen-reader/live-region text (inspect the hidden `role=status` / `role=alert` regions).
5. Zoom 200% and 320px width: no clipped/unreachable content.
6. OS reduce-motion on: no hover lifts/slide-ins.
7. Ad-hoc axe-core run in the browser (dev-time only; not vendored) — expect 0 serious/critical.
