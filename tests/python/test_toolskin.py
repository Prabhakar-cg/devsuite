"""Tool-page bento skin guards (feature 028, SPEC §9.15)."""
import re
from pathlib import Path

import pytest

STATIC = Path(__file__).resolve().parents[2] / "static"
PAGES = {
    "index.html": "diff", "data-linter.html": "data-linter", "regex.html": "regex", "base64.html": "base64",
    "crypto.html": "crypto", "api-tester.html": "api-tester", "ssh-manager.html": "ssh",
    "sftp-browser.html": "sftp", "cron.html": "cron", "vault.html": "vault", "notes.html": "notes",
    "roadmap.html": "roadmap", "id-generator.html": "id-generator", "ws-tester.html": "ws-tester",
    "file-converter.html": "file-converter", "db-manager.html": "db-manager",
}
CSS = (STATIC / "toolskin.css").read_text()
ART_NAMES = set(re.findall(r"^    function ([a-z0-9]+)\(\)", (STATIC / "bento-art.js").read_text(), re.M))


@pytest.mark.parametrize("page,tool", PAGES.items())
def test_each_tool_page_declares_its_tool(page, tool):
    html = (STATIC / page).read_text()
    assert len(re.findall(r"<body[^>]*\bdata-tool=\"" + re.escape(tool) + r"\"", html)) == 1
    assert f'[data-tool="{tool}"]' in CSS, f"no hue defined for {tool}"


def test_skin_and_art_are_injected_on_every_page():
    from deps import _serve_html
    for page in sorted(p.name for p in STATIC.glob("*.html")):
        html = _serve_html(page)
        assert html.count("/static/toolskin.css") == 1, page
        assert html.count("/static/bento.css") == 1, page
        assert html.count("/static/bento-art.js") == 1, page


def test_stylesheet_is_scoped_token_only_and_layout_safe():
    body = re.sub(r"/\*.*?\*/", "", CSS, flags=re.S)
    assert not re.search(r"#[0-9a-fA-F]{3,8}\b", body), "use theme tokens, not hex"
    assert "color-mix(" in CSS
    # every rule (outside :root and the shared .tk-art helper) is scoped under [data-tool]
    for sel in re.findall(r"(?m)^([^\s{}/@][^{}]*)\{", body):
        sel = re.sub(r":where\([^)]*\)", ":where()", sel)  # commas inside :where() are not selector separators
        for part in (p.strip() for p in sel.split(",")):
            assert (part.startswith(":root") or "[data-tool" in part or part.startswith("#ag-overlay")
                    or part.startswith("html[data-theme")), f"unscoped selector: {part}"
    # layout engines must be left alone: no display/position/flex/width/height changes on containers
    for prop in ("display:", "position:", "flex:", "flex-direction:", "grid-template", "height:"):
        for decl in re.findall(r"[^;{}]+;", body):
            if decl.strip().startswith(prop):
                assert ".tk-art" in body[:body.index(decl)][-160:] or "svg[data-art]" in body[:body.index(decl)][-160:] or prop == "display:" and "block" in decl, f"layout property in skin: {decl.strip()}"


def test_data_art_names_used_in_pages_exist():
    used = set()
    for page in list(PAGES) + ["file-converter.html", "home.html", "tools.html"]:
        used |= set(re.findall(r'data-art="([a-z0-9]+)"', (STATIC / page).read_text()))
    for js in ("vault.js", "regex.html"):
        for stmt in re.findall(r"dataset\.art = ([^;]+);", (STATIC / js).read_text()):
            used |= set(re.findall(r"'([a-z0-9]+)'", stmt))
    assert used and used <= ART_NAMES, used - ART_NAMES


def test_empty_state_emoji_replaced_by_art():
    for page, needle in (("data-linter.html", "{ }</span>"), ("base64.html", "🔀"), ("regex.html", "🔎"),
                         ("vault.html", "🔐"), ("vault.html", "🏛")):
        assert needle not in (STATIC / page).read_text(), (page, needle)
    assert "🔐" not in (STATIC / "vault.js").read_text().split("empty.replaceChildren")[1][:900]


def test_art_in_pages_is_decorative_svg_without_text_alternatives():
    for page in PAGES:
        for m in re.finditer(r'<svg class="tk-art" data-art="[a-z0-9]+"([^>]*)>', (STATIC / page).read_text()):
            assert "aria-label" not in m.group(1) and "<title" not in m.group(0)


def test_devdb_fill_accents_keep_contrast_with_white_text():
    """A global colour swap once lightened --accent, dropping the white Unlock label to 2.5:1."""
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    import a11y_tokens as tok
    css = (STATIC / "db-manager.css").read_text()
    solid = re.search(r"--accent-solid:\s*(#[0-9a-fA-F]{6})", css).group(1)
    assert tok.contrast(tok.parse_color("#ffffff"), tok.parse_color(solid)) >= 4.5
    btn = css[css.index(".db-lock-btn {"):]
    assert "var(--accent-solid)" in btn[:260]


def test_lock_screen_error_and_button_colours_are_accessible():
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    import a11y_tokens as tok
    js = (STATIC / "auth-guard.js").read_text()
    err = re.search(r"\.ag-error \{[^}]*color: (#[0-9a-fA-F]{6})", js, re.S).group(1)
    btn = re.search(r"\.ag-btn \{[^}]*background: (#[0-9a-fA-F]{6})", js, re.S).group(1)
    assert tok.contrast(tok.parse_color(err), tok.parse_color("#2c1b2a")) >= 4.5
    assert tok.contrast(tok.parse_color("#ffffff"), tok.parse_color(btn)) >= 4.5


def test_every_sr_only_class_in_pages_is_actually_defined():
    """regex.html used class="sr-only" (undefined anywhere), so its fieldset legend rendered visibly."""
    import glob
    defined = (STATIC / "a11y.css").read_text() + "".join(Path(p).read_text() for p in glob.glob(str(STATIC / "*.css")))
    for page in STATIC.glob("*.html"):
        src = page.read_text()
        if re.search(r'class="[^"]*\bsr-only\b', src):
            assert re.search(r"\.sr-only\b", defined + src), f"{page.name} uses sr-only but it is undefined"


def test_tiles_use_the_bento_corner_radius_and_controls_are_pills():
    """Tiles share the Home/Tools bento radius (one token); buttons/badges are pills; no blanket override."""
    assert re.search(r"\[data-tool\]\s*\{[^}]*--tk-radius:\s*var\(--radius-xl", CSS)
    assert "border-radius: var(--tk-radius) !important" in CSS
    assert not re.search(r"\[data-tool\] \*:not\(", CSS), "no blanket radius override"
    assert re.search(r"\[data-tool\] \.btn[^{]*\{\s*border-radius: var\(--radius-pill", CSS)


def test_websocket_tester_connection_bar_has_room_for_its_labels():
    assert re.search(r'\[data-tool="ws-tester"\] \.wst-connbar,[^{]*\{\s*padding:\s*0\.75rem 1rem', CSS)


