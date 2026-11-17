# Plan: Bento Showcase (026)

Constitution: I spec-first ✔ · II offline ✔ (no assets/CDN) · III vanilla ✔ · V no innerHTML/inline script ✔ (SVG via createElementNS; external JS file) · VII version bump 0.15.0.

Files: `static/bento-art.js` (UMD: `ART` data + `buildShapes`, DOM `renderAll`), `static/bento.css` (layout, tile palettes via color-mix, art classes), markup in `static/home.html` and `static/tools.html` (link + script tags added), `tests/javascript/test_bento_art.js`, `tests/python/test_bento.py`, SPEC §9.14, CHANGELOG/version.

Tile palette: `--tile: color-mix(in srgb, var(--X) 26%, var(--surface-2))` with X ∈ {electric, lime, amber, violet} (+ mixes); art strokes/fills use `--art-1..4` set per tile from the same accents and `--text-primary`.
