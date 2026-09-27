# Quickstart — Command Palette (022)

## Run the tool

1. Start DevSuite: `./start.sh` (or `python -m uvicorn main:app --reload`).
2. Open any page — e.g. `http://localhost:8000/regex`.

## Verify by user story

**US1 — Jump to any tool from anywhere via keyboard**
- On any page, press Cmd+K (macOS) / Ctrl+K (other platforms) → the palette opens
  centered, input focused, all 17 destinations listed, first one highlighted.
- Press Down/Up a few times → highlight moves and wraps at the ends.
- Press Enter on a highlighted entry → browser navigates to that entry's route.
- Press Escape instead → palette closes, no navigation, page underneath unchanged.
- Visit `/vault` (or any tool) **before** entering the master password (fresh install /
  locked state) → Cmd/Ctrl+K still opens the palette and can navigate away.
- Open the palette, press Cmd/Ctrl+K again while it's open → no second overlapping
  palette appears.

**US2 — Narrow the list by typing**
- Open the palette, type `uuid` → only "ID Generator" remains (keyword match, not a name
  match), highlighted.
- Type something matching nothing (e.g. `zzzzz`) → an explicit "no matches" state shows,
  not a blank list.
- Clear the input → the full 17-entry list reappears.
- Type `jwt` → "Crypto Suite" appears via its keyword list.
- With a filtered list, press arrow keys → highlight only ever lands on a visible
  (filtered) entry.

**US3 — Discover and open via a visible trigger**
- On any page, without touching the keyboard, find the small header control → click it →
  palette opens identically to the shortcut path.
- Check the control doesn't visually collide with existing header controls (theme picker,
  back link, status pill) on a couple of different page layouts (e.g. `home.html`'s
  marketing nav vs. a tool page's compact `.tool-header`).

**Edge cases**
- On `/notes` specifically: Ctrl/Cmd+K still opens Notes Workspace's own "search notes"
  modal (pre-existing behavior, intentionally preserved — see `research.md` §2); the
  palette's *header trigger button* still opens the palette by click on that page.
- Click inside a Monaco editor (e.g. on `/diff` or `/notes`) then press Cmd/Ctrl+K → the
  palette still opens (not swallowed by the editor).
- Click the palette's backdrop (outside the panel) → closes without navigating, same as
  Escape.
- Switch through a few of the suite's 6 runtime themes (theme picker) with the palette
  open → it stays legible in each. Visit `/db-manager` (the one page without the theme
  system) → the palette still renders legibly there too.

## Verify the injected markup

```bash
# Every page must carry the CSS link + the two deferred scripts, each cache-busted.
curl -fsD - http://localhost:8000/regex -o /dev/null | grep -i content-security-policy
curl -s http://localhost:8000/regex | grep -o 'command-palette[a-z-]*\.\(css\|js\)?v=[a-f0-9]\{8\}'
# Expect three lines: command-palette.css?v=..., command-palette-data.js?v=..., command-palette.js?v=...
```

## Run the tests

```bash
node tests/javascript/run.js     # includes matchDestinations() unit tests
pytest tests/python/             # includes the new injection test + full existing suite
                                  # (confirms test_asset_order.py / test_csp.py are unaffected)
```

## Files touched

- `static/command-palette-data.js` (pure, new), `static/command-palette.js` (DOM
  controller, new), `static/command-palette.css` (new)
- `deps.py` (`_serve_html()` injection)
- `specs/SPEC.md` (§9.11 new subsection, §3.2 module-to-file map row)
- `tests/javascript/test_command_palette_data.js` (new, + registered in `run.js`),
  `tests/python/test_command_palette_injection.py` (new)
