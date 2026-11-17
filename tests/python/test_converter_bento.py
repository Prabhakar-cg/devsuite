"""File Converter bento redesign guards (feature 027)."""
import re
from pathlib import Path

STATIC = Path(__file__).resolve().parents[2] / "static"
HTML = (STATIC / "file-converter.html").read_text()
CSS = (STATIC / "converter.css").read_text()

# Every id the converter script (or tests) relies on must survive the redesign.
REQUIRED_IDS = [
    "drop-zone", "file-input", "file-info", "file-name-display", "file-size-display", "clear-file-btn",
    "from-format", "to-format", "btn-convert", "btn-reset", "result-section", "result-title",
    "result-body", "btn-copy-result", "btn-download", "file-size-badge",
]


def test_all_script_ids_are_preserved():
    for i in REQUIRED_IDS:
        assert f'id="{i}"' in HTML, i


def test_ids_are_unique():
    ids = re.findall(r'\bid="([^"]+)"', HTML)
    dupes = {i for i in ids if ids.count(i) > 1}
    assert not dupes, dupes


def test_grid_structure_and_decorative_art():
    for needle in ('class="cv-grid"', 'class="cv-drop-col"', 'class="cv-panel"', 'class="cv-formats"'):
        assert needle in HTML, needle
    arts = re.findall(r'<svg class="cv-(?:art|cat-art)" data-art="([a-z]+)"', HTML)
    assert sorted(arts) == ["convert", "doc", "image", "lint", "sheet"]
    # the old low-contrast icon is gone; the panel is a labelled group
    assert 'class="drop-icon"' not in HTML
    assert 'role="group" aria-label="Conversion"' in HTML


def test_four_category_tiles_with_modifiers():
    for cls in ("cv-data", "cv-sheet", "cv-doc", "cv-img"):
        assert re.search(rf'class="format-category {cls}"', HTML), cls


def test_server_conversions_have_a_non_colour_cue():
    assert ".format-chip.server::after" in CSS and 'content: "srv"' in CSS


def test_assets_linked_in_order_and_exist():
    assert HTML.index("/static/bento.css") < HTML.index("/static/converter.css"), "converter.css must win"
    assert HTML.index("</style>") < HTML.index("/static/converter.css"), "must load after the legacy inline <style>"
    assert "/static/bento-art.js" in HTML
    assert (STATIC / "converter.css").exists()


def test_stylesheet_is_token_only_and_responsive():
    body = re.sub(r"/\*.*?\*/", "", CSS, flags=re.S)
    assert not re.search(r"#[0-9a-fA-F]{3,8}\b", body.replace("var(--on-accent, #fff)", "")), "use theme tokens, not hex"
    assert "color-mix(" in CSS
    assert "@media (max-width: 999px)" in CSS and "@media (max-width: 599px)" in CSS


def test_js_toggled_state_classes_still_styled():
    for cls in ("drag-over", "has-file"):
        assert f".{cls}" in CSS + HTML, cls
    assert ".btn-convert.loading" in HTML  # legacy loading-spinner rules remain in place


def test_page_still_serves_after_injection(client):
    html = client.get("/file-converter").text
    assert "converter.css" in html and 'class="cv-grid"' in html
