# Implementation Plan: Tool-Page Theming Unification

**Spec**: [spec.md](./spec.md) | **Date**: 2026-11-17 | **Branch**: spec dir only; work on `develop`

## Summary

Add one shared theme layer, `static/theme-layer.css`, injected into every page by `deps.py::_serve_html()` (same pattern as 022/023). It assigns the **canonical tool-page tokens** per theme using `html[data-theme="…"]` selectors, whose specificity beats every page-local `:root` palette, so load order no longer matters (research R-01). Hi-Contrast gets a real dark/white/yellow palette (with `--on-accent: #000`), Light and iOS Glass get the canonical tokens they were missing. Crypto/DevDB dark-default chrome, Home/Tools chip/badge/CTA contrast, and small polish items are fixed in their own stylesheets. Verification repeats the 023 axe pass.

## Technical Context

**Language**: vanilla CSS/JS; Python only for the `_serve_html()` injection + tests. **Deps**: none new. **Storage**: none (reuses the existing `devsuite-theme` localStorage key). **Testing**: `pytest` (extend `tests/python/a11y_tokens.py`/`test_a11y.py`, new `test_theme_layer.py`), `node tests/javascript/run.js`, manual axe + screenshots (dev-time).
**Constraints**: Constitution III/V (no frameworks, no innerHTML, no inline script, no CSP change), no emoji, 023 contracts preserved.

## Constitution Check

- I Spec First — PASS: spec + SPEC §9.13 (theme layer) before code.
- II Offline — PASS: same-origin CSS only.
- III Vanilla/Single store — PASS.
- IV Encryption boundary — N/A (no crypto touched; Vault/lock screens restyled only).
- V DOM/CSP — PASS: CSS only, no inline script.
- VI Security paths tests — N/A (no security path changed).
- VII Versioning — PASS: bump 0.12.0 → 0.13.0 across 4 places at ship.
- Cross-cutting: tool count unchanged (15); asset-order guard extended; no emoji.

No violations.

## Structure

```text
deps.py                       # + inject theme-layer.css
static/theme-layer.css        # NEW — canonical tokens per theme (high-contrast, ios-glass, vs)
static/theme.js               # drop now-redundant tool-page alias overrides only where layer supersedes (kept if still read)
static/{home,tools?}.css      # chip/badge/CTA/filter pill contrast; coming-soon treatment
static/{linter,db-manager}.css, static/crypto.html  # dark-default chrome
static/command-palette.js/.css# key-cap spacing
tests/python/test_theme_layer.py   # NEW
specs/SPEC.md §9.13, CHANGELOG, version
```
