"""Bento showcase guards (feature 026, SPEC §9.14)."""
import re
from pathlib import Path

import pytest

STATIC = Path(__file__).resolve().parents[2] / "static"
PAGES = ["home.html", "tools.html"]
TOOL_TILES = {
    "/diff": "Text Diff", "/data-linter": "Data Linter", "/vault": "Secret Vault",
    "/api-tester": "API Tester", "/ssh": "Secure Terminal", "/cron": "Cron Visualizer",
}


def _bento(page: str) -> str:
    html = (STATIC / page).read_text()
    m = re.search(r'<section class="bento-section".*?</section>', html, re.S)
    assert m, f"{page}: no bento section"
    return m.group(0)


@pytest.mark.parametrize("page", PAGES)
def test_bento_has_six_tool_tiles_pattern_and_statement(page):
    b = _bento(page)
    assert len(re.findall(r'<a class="bento-tile t-[a-z]+"', b)) == 6
    assert b.count("t-pattern") == 1 and b.count("t-text") == 1
    assert re.search(r'<h2 id="bento-title" class="ds-sr-only">', b)
    assert 'aria-labelledby="bento-title"' in b


@pytest.mark.parametrize("page", PAGES)
def test_tool_tiles_link_to_real_routes_with_accessible_names(page):
    from routes import pages  # noqa: F401  (routes exist)
    b = _bento(page)
    routes = (STATIC.parent / "routes" / "pages.py").read_text()
    for href, name in TOOL_TILES.items():
        m = re.search(rf'<a class="bento-tile [^"]*" href="{re.escape(href)}" aria-label="([^"]+)"', b)
        assert m, f"{page}: missing tile for {href}"
        assert m.group(1).startswith(name + " —"), "aria-label must start with the visible name"
        assert f'"{href}"' in routes, f"{href} is not a real page route"
        assert f"<strong>{name}</strong>" in b, "visible caption must match the tool name"


@pytest.mark.parametrize("page", PAGES)
def test_tiles_are_in_the_command_palette_destination_list(page):
    data = (STATIC / "command-palette-data.js").read_text()
    for href in TOOL_TILES:
        assert f"'{href}'" in data or f'"{href}"' in data, href


@pytest.mark.parametrize("page", PAGES)
def test_art_svgs_are_decorative_and_markup_has_no_script_or_inline_style(page):
    b = _bento(page)
    arts = re.findall(r'<svg data-art="([a-z]+)"', b)
    assert sorted(arts) == ["api", "cron", "diff", "lint", "pattern", "terminal", "vault"]
    assert "<script" not in b and "style=" not in b and "innerHTML" not in b
    # the pattern tile is decorative: hidden from assistive tech entirely
    assert re.search(r'<div class="bento-tile t-pattern" aria-hidden="true">', b)


@pytest.mark.parametrize("page", PAGES)
def test_assets_are_linked_and_exist(page):
    html = (STATIC / page).read_text()
    assert '/static/bento.css' in html and '/static/bento-art.js' in html
    assert (STATIC / "bento.css").exists() and (STATIC / "bento-art.js").exists()


def test_bento_css_is_token_driven_and_responsive():
    css = (STATIC / "bento.css").read_text()
    body = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    assert not re.search(r"#[0-9a-fA-F]{3,8}\b", body.replace("#fff)", "")), "tiles must use theme tokens, not hex"
    assert "color-mix(" in css and "var(--electric)" in css
    assert "@media (max-width: 999px)" in css and "@media (max-width: 599px)" in css
    assert "overflow-x" not in css


def test_bento_js_uses_no_unsafe_dom_sinks():
    js = (STATIC / "bento-art.js").read_text()
    for sink in ("innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval(", "fetch(", "XMLHttpRequest"):
        assert sink not in js, sink


def test_pages_serve_bento_assets_after_injection(client):
    for route in ("/", "/tools"):
        html = client.get(route).text
        assert "bento.css" in html and "bento-art.js" in html and 'class="bento"' in html
