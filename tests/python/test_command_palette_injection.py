"""Injection regression guard for the Command Palette (feature 022).

deps.py::_serve_html() injects the palette's CSS link and two deferred scripts
into every page response — see specs/022-command-palette/contracts/injected-markup.md
for the exact contract this file asserts against. No static/*.html file references
these assets directly, so this is the only place their presence is verified.
"""
import re

_FINGERPRINT_RE = re.compile(r"\?v=[0-9a-f]{8}$")


def _script_srcs(html: str) -> list[str]:
    return re.findall(r'<script src="([^"]+)"', html)


def _script_srcs_no_query(html: str) -> list[str]:
    """Matches tests/python/test_asset_order.py's own extraction (query-string-free)."""
    return re.findall(r'<script src="([^"?]+)', html)


def _link_hrefs(html: str) -> list[str]:
    return re.findall(r'<link rel="stylesheet" href="([^"]+)"', html)


def test_command_palette_assets_injected_on_a_representative_page(client):
    r = client.get("/regex")
    assert r.status_code == 200
    html = r.text

    css_hrefs = [h for h in _link_hrefs(html) if "command-palette.css" in h]
    assert len(css_hrefs) == 1, "expected exactly one command-palette.css <link>"
    assert _FINGERPRINT_RE.search(css_hrefs[0]), (
        f"command-palette.css not cache-busted: {css_hrefs[0]}"
    )

    scripts = _script_srcs(html)
    data_matches = [s for s in scripts if "command-palette-data.js" in s]
    ctrl_matches = [s for s in scripts if "command-palette.js" in s]
    assert len(data_matches) == 1, "expected exactly one command-palette-data.js <script>"
    assert len(ctrl_matches) == 1, "expected exactly one command-palette.js <script>"
    assert _FINGERPRINT_RE.search(data_matches[0])
    assert _FINGERPRINT_RE.search(ctrl_matches[0])

    # Data module must load before the controller (controller reads its globals).
    assert scripts.index(data_matches[0]) < scripts.index(ctrl_matches[0])


def test_command_palette_scripts_use_defer_and_appear_before_close_body(client):
    r = client.get("/regex")
    html = r.text
    body_close_idx = html.rindex("</body>")
    ctrl_idx = html.index("command-palette.js")
    assert ctrl_idx < body_close_idx, "command-palette.js must load before </body>"

    # Both new <script> tags carry defer (external, per Constitution Art. V —
    # no inline <script> was added for this feature).
    tag_start = html.rindex("<script", 0, html.index("command-palette-data.js"))
    tag_end = html.index(">", tag_start)
    assert "defer" in html[tag_start:tag_end]


def test_command_palette_injected_on_every_page_route(client):
    for path in ("/", "/tools", "/diff", "/vault", "/db-manager", "/ws-tester"):
        r = client.get(path)
        assert r.status_code == 200, path
        assert "command-palette.css" in r.text, f"{path}: missing palette CSS"
        assert "command-palette-data.js" in r.text, f"{path}: missing palette data script"
        assert "command-palette.js" in r.text, f"{path}: missing palette controller script"


def test_command_palette_injection_does_not_disturb_existing_script_order(client):
    """Regression guard for tests/python/test_asset_order.py's assumptions:
    appending the two new scripts immediately before </body> must not change
    the relative order of any pair of pre-existing <script src> tags."""
    r = client.get("/api-tester")
    scripts = _script_srcs_no_query(r.text)
    pre_existing = [s for s in scripts if "command-palette" not in s]
    assert pre_existing == sorted(pre_existing, key=scripts.index), (
        "sanity check: pre_existing must preserve original relative order by construction"
    )
    require_idx = pre_existing.index("/static/libs/require.min.js")
    jszip_idx = pre_existing.index("/static/libs/jszip.min.js")
    assert jszip_idx < require_idx
