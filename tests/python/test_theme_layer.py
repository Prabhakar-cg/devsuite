"""Tool-page theme layer guards (feature 024, SPEC §9.13)."""
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
import a11y_tokens as tok  # noqa: E402

STATIC = tok.STATIC
LAYER = (STATIC / "theme-layer.css").read_text()


def test_layer_injected_on_every_page():
    from deps import _serve_html
    for page in sorted(p.name for p in STATIC.glob("*.html")):
        html = _serve_html(page)
        assert len(re.findall(r'href="/static/theme-layer\.css\?v=[0-9a-f]{8}"', html)) == 1, page


@pytest.mark.parametrize("variant", ["high-contrast", "ios-glass", "vs"])
def test_layer_selector_outspecifies_root_palettes(variant):
    # html[data-theme="x"] = (0,1,1) beats a page-local :root = (0,1,0)
    assert f'html[data-theme="{variant}"]' in LAYER


def test_high_contrast_defines_every_canonical_token():
    block = tok.parse_vars(tok._block(LAYER, r'html\[data-theme="high-contrast"\]'))
    missing = [t for t in tok.CANONICAL_TOKENS if t not in block]
    assert missing == [], missing


def _check(variant, text_need):
    themes = tok.canonical_themes()
    vars_ = themes[variant]
    bad = []
    for fg, surfaces, need in tok.CANONICAL_MATRIX:
        if fg in ("--text", "--text-mid", "--text-muted"):
            need = max(need, text_need)
        f = tok.resolve(fg, vars_)
        for s in surfaces:
            sv = tok.resolve(s, vars_)
            r = tok.contrast(f, sv)
            if r < need:
                bad.append(f"{variant}: {fg} on {s} = {r:.2f} (need {need})")
    return bad


def test_hi_contrast_text_meets_7_to_1():
    assert _check("high-contrast", 7.0) == []


@pytest.mark.parametrize("variant", ["default", "ios-glass", "vs"])
def test_other_variants_meet_canonical_matrix(variant):
    assert _check(variant, 4.5) == []


def test_hi_contrast_filled_buttons_are_legible():
    v = tok.canonical_themes()["high-contrast"]
    assert tok.contrast(tok.resolve("--on-accent", v), tok.resolve("--blue", v)) >= 7.0


def test_tool_stylesheet_palettes_cannot_defeat_themes():
    """Local :root palettes are allowed (defaults) but must stay plain :root (not html[data-theme])."""
    for sheet in ("linter.css", "vault.css", "cron.css", "db-manager.css", "style.css"):
        css = (STATIC / sheet).read_text()
        assert not re.search(r'html\[data-theme="high-contrast"\]\s*\{[^}]*--bg:', css), sheet
