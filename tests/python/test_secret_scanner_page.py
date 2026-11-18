"""Secret Scanner page guards (feature 021): route, injection-safe markup, no network/storage, wiring."""
import re
from pathlib import Path

STATIC = Path(__file__).resolve().parents[2] / "static"
HTML = (STATIC / "secret-scanner.html").read_text()
UI = (STATIC / "secret-scanner-ui.js").read_text()
ENGINE = (STATIC / "secret-scanner.js").read_text()


def test_route_serves_the_page_without_authentication(client):
    r = client.get("/secret-scanner")
    assert r.status_code == 200 and "Secret Scanner" in r.text
    assert 'class="ds-skip-link"' in r.text and 'data-tool="secret-scanner"' in r.text


def test_page_is_a_tool_with_one_main_and_labelled_controls():
    assert len(re.findall(r"<main\b", HTML)) == 1
    assert 'for="ss-input"' in HTML and 'id="ss-input"' in HTML
    assert 'aria-live="polite"' in HTML  # summary announced to screen readers
    assert "<script" in HTML and not re.search(r"<script(?![^>]*\bsrc=)", HTML), "no inline scripts"


def test_ui_and_engine_use_no_network_storage_or_markup_sinks():
    for src, name in ((UI, "ui"), (ENGINE, "engine")):
        for bad in ("innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval(", "new Function",
                    "fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "localStorage", "sessionStorage", "indexedDB"):
            assert bad not in src, f"{name} must not use {bad}"


def test_ui_renders_findings_with_text_apis_only():
    assert "textContent" in UI and "createElement" in UI
    assert "replaceChildren" in UI


def test_scanner_is_listed_everywhere_a_tool_must_be():
    tools = (STATIC / "tools.html").read_text()
    assert 'href="/secret-scanner"' in tools and 'data-category="security"' in tools
    assert "'/secret-scanner'" in (STATIC / "command-palette-data.js").read_text()
    pages = (STATIC.parent / "routes" / "pages.py").read_text()
    assert '"/secret-scanner"' in pages


def test_tool_counts_are_consistent_at_sixteen():
    tools = (STATIC / "tools.html").read_text()
    live = len(re.findall(r'class="tool-card active-tool"', tools))
    assert live == 16, live
    assert re.search(r'data-filter="all"\s*>All\s*<span class="filter-count">16</span>', tools)
    assert re.search(r'data-filter="security">Security <span class="filter-count">4</span>', tools)
    home = (STATIC / "home.html").read_text()
    assert "16 production-grade developer tools" in home and '<span class="hero-stat-num">16</span>' in home
    assert "(currently 16)" in (STATIC.parent / ".specify" / "memory" / "constitution.md").read_text()


def test_skin_covers_the_scanner_tiles():
    css = (STATIC / "toolskin.css").read_text()
    for sel in (".ss-input-tile", ".ss-results-tile", ".ss-fix-tile"):
        assert css.count(sel) >= 2, sel  # main group + Hi-Contrast outline group
    assert '[data-tool="secret-scanner"]' in css
