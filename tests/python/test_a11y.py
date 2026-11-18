"""Accessibility foundation guards (feature 023, SPEC §9.12 / §10.5).

Deterministic checks only: injection, landmarks, contrast tokens, shared CSS rules.
The browser-level axe/keyboard pass is manual (specs/023-ui-accessibility-foundation/quickstart.md).
"""
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
import a11y_tokens as tok  # noqa: E402

STATIC = tok.STATIC
HTML_FILES = sorted(p.name for p in STATIC.glob("*.html"))


def _served(name: str) -> str:
    from deps import _serve_html
    return _serve_html(name)


# ── Injection ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("page", HTML_FILES)
def test_a11y_assets_and_skip_link_injected(page):
    html = _served(page)
    assert len(re.findall(r'<link rel="stylesheet" href="/static/a11y\.css\?v=[0-9a-f]{8}">', html)) == 1
    assert html.count('class="ds-skip-link"') == 1
    assert len(re.findall(r'<script src="/static/a11y\.js\?v=[0-9a-f]{8}" defer></script>', html)) == 1
    # Skip link is the first element inside <body>
    m = re.search(r"<body\b[^>]*>\s*(<[^>]+>)", html, re.I)
    assert m and 'ds-skip-link' in m.group(1), "skip link must be first in <body>"
    # a11y.js loads before the palette scripts
    assert html.index("a11y.js") < html.index("command-palette-data.js")


def test_injection_is_idempotent():
    from deps import _serve_html  # noqa: F401
    html = _served("regex.html")
    assert html.count("a11y.js") == 1 and html.count("a11y.css") == 1


@pytest.mark.parametrize("page", HTML_FILES)
def test_single_main_landmark(page):
    src = (STATIC / page).read_text()
    mains = len(re.findall(r"<main\b", src)) + len(re.findall(r'role="main"', src))
    assert mains == 1, f"{page}: expected exactly one main landmark, found {mains}"


# ── Contrast (SPEC §9.12 §3 matrix) ──────────────────────────────────────────

def _failures(themes, matrix, base):
    return [
        f"{t}: {fg} on {s} = {r if r is None else round(r, 2)} (need {need})"
        for t, fg, s, r, need in tok.evaluate(themes, matrix, base)
        if r is None or r < need
    ]


def test_tool_page_themes_meet_contrast_matrix():
    assert _failures(tok.tool_themes(), tok.TOOL_MATRIX, "--bg-main") == []


def test_home_themes_meet_contrast_matrix():
    assert _failures(tok.home_themes(), tok.HOME_MATRIX, "--void") == []


def test_all_six_themes_are_covered():
    names = set(tok.tool_themes()) | set(tok.home_themes())
    assert {"vs-dark", "midnight", "ocean", "solarized", "ios-glass", "hc-black"} <= names | {"high-contrast"}


@pytest.mark.parametrize("token", ["--blue-text", "--green-text", "--amber-text", "--red-text", "--text-muted"])
def test_text_safe_tokens_pass_on_light_surfaces(token):
    vars_ = tok.parse_vars(tok._block((STATIC / "style.css").read_text(), r":root"))
    fg = tok.parse_color(vars_[token])
    for surface in ((255, 255, 255, 1.0), (245, 245, 247, 1.0), (232, 232, 237, 1.0)):
        assert tok.contrast(fg, surface) >= 4.5, token


# ── Shared CSS rules ─────────────────────────────────────────────────────────

def test_a11y_css_has_required_rules():
    css = (STATIC / "a11y.css").read_text()
    assert re.search(r":focus-visible\s*\{[^}]*outline:[^;]*!important", css)
    assert "prefers-reduced-motion: reduce" in css
    assert "pointer: coarse" in css and "min-height: 44px" in css
    assert ".ds-skip-link" in css and ".ds-sr-only" in css


def test_radius_tokens_from_spec_are_defined():
    css = (STATIC / "style.css").read_text()
    assert re.search(r"--radius-xl:\s*16px", css)
    assert re.search(r"--radius-pill:\s*980px", css)


def test_type_and_space_scale_tokens_defined():
    css = (STATIC / "style.css").read_text()
    for t in ("--text-xs", "--text-sm", "--text-base", "--text-md", "--text-lg",
              "--space-1", "--space-4", "--focus-ring"):
        assert re.search(rf"{t}:", css), t


# ── Toasts / announcements ───────────────────────────────────────────────────

def test_toast_has_no_glyph_close_and_announces():
    js = (STATIC / "components.js").read_text()
    assert "✕" not in js
    assert "Dismiss notification" in js
    assert "a11y?.announce" in js


@pytest.mark.parametrize("page", HTML_FILES)
def test_glyph_only_buttons_have_accessible_names(page):
    src = (STATIC / page).read_text()
    for m in re.finditer(r"<button\b([^>]*)>\s*(?:<span[^>]*>)?\u2715", src):
        assert "aria-label" in m.group(1), f"{page}: glyph-only button without aria-label: {m.group(0)[:80]}"


def test_toast_implementations_use_svg_close_not_glyph():
    for f in ("components.js", "app.js"):
        js = (STATIC / f).read_text()
        assert "closeBtn.textContent = '\u2715'" not in js and "btn.textContent = '\u2715'" not in js, f


def test_a11y_js_uses_no_unsafe_dom_sinks():
    js = (STATIC / "a11y.js").read_text()
    for sink in ("innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval(", "new Function"):
        assert sink not in js, sink
    # never touches input values or storage
    assert ".value" not in js
    assert "localStorage" not in js and "sessionStorage" not in js


def test_a11y_assets_served(client):
    for p in ("/static/a11y.css", "/static/a11y.js"):
        assert client.get(p).status_code == 200


def test_lock_screens_get_skip_link_without_auth(client):
    for route in ("/vault", "/ssh", "/db-manager"):
        r = client.get(route)
        assert r.status_code == 200
        assert 'class="ds-skip-link"' in r.text, route


# ── Responsive / zoom (FR-011/FR-012) ────────────────────────────────────────

_NEEDS_BREAKPOINT = [
    "style.css", "api-tester.css", "linter.css", "notes.css", "roadmap.css",
    "sftp-browser.css", "ssh-manager.css", "vault.css", "home.css", "cron.css",
    "db-manager.css", "id-generator.css", "ws-tester.css", "roadmap-doc-viewer.css",
]


@pytest.mark.parametrize("sheet", _NEEDS_BREAKPOINT)
def test_stylesheet_defines_narrow_viewport_behavior(sheet):
    assert "@media" in (STATIC / sheet).read_text(), f"{sheet}: no @media rule"


def test_global_shell_stops_clipping_at_narrow_widths():
    css = (STATIC / "style.css").read_text()
    m = re.search(r"@media \(max-width: 900px\)\s*\{(.*?)\n\}", css[css.index("RESPONSIVE / 200% ZOOM"):], re.S)
    assert m, "style.css lacks the <=900px responsive block"
    assert "overflow: visible" in m.group(1) and "min-height: 100dvh" in m.group(1)


# ── Type floor (FR-015) ──────────────────────────────────────────────────────

_VENDOR_CSS = {"xterm.css"}


def _sheets():
    return [p for p in STATIC.glob("*.css") if p.name not in _VENDOR_CSS]


def test_no_ui_font_size_below_12px():
    offenders = []
    for p in _sheets():
        for ln, line in enumerate(p.read_text().splitlines(), 1):
            for m in re.finditer(r"font-size:\s*(\d*\.?\d+)(rem|px)\b", line):
                v = float(m.group(1)) * (16 if m.group(2) == "rem" else 1)
                if v < 12:
                    offenders.append(f"{p.name}:{ln}: {m.group(0)}")
    assert offenders == [], offenders[:10]


# ── Hex colors in migrated sheets (FR-017) ───────────────────────────────────

_HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
_MIGRATED = ["style.css", "vault.css", "home.css", "linter.css", "api-tester.css"]
# Remaining hex literals are deliberately decorative: brand gradients (SPEC §9.7),
# category/badge hues, terminal-window chrome dots. Everything else must be a token
# (or sit in a var(--x, #hex) fallback).


def _stray_hex(line: str):
    s = line.strip()
    if s.startswith(("--", "/*", "*", "//")) or "gradient(" in s:
        return []
    # drop var(--token, #fallback) fallbacks
    s = re.sub(r"var\(--[a-z0-9-]+,\s*[^)]*\)", "", s)
    return _HEX.findall(s)


@pytest.mark.parametrize("sheet", _MIGRATED)
def test_semantic_hex_colors_are_tokenized(sheet):
    """white-on-accent and status text colors must use tokens, not literals."""
    bad = []
    for ln, line in enumerate((STATIC / sheet).read_text().splitlines(), 1):
        for h in _stray_hex(line):
            if h.lower() in ("#fff", "#ffffff") or re.search(r"(?<![\w-])color:\s*" + re.escape(h), line):
                bad.append(f"{sheet}:{ln}: {line.strip()[:90]}")
    # `color:` literals for non-status decorative hues are tolerated only inside badge rules;
    # keep the budget tight so new strays are noticed.
    assert len(bad) <= 40, bad[:10]


@pytest.mark.parametrize("sheet", _MIGRATED)
def test_no_white_literals_outside_tokens(sheet):
    bad = [
        f"{sheet}:{ln}: {line.strip()[:90]}"
        for ln, line in enumerate((STATIC / sheet).read_text().splitlines(), 1)
        for h in _stray_hex(line) if h.lower() in ("#fff", "#ffffff")
    ]
    assert bad == [], bad[:10]


# ── Alias layer (FR-016, amended — see research R-06) ────────────────────────

_REMOVED_UNUSED_ALIASES = ["--bg-void", "--accent-dark", "--neu-raise", "--neu-flat", "--shadow-glow"]


@pytest.mark.parametrize("alias", _REMOVED_UNUSED_ALIASES)
def test_unused_aliases_stay_removed(alias):
    for p in list(STATIC.glob("*.css")) + list(STATIC.glob("*.js")) + list(STATIC.glob("*.html")):
        if p.parent.name == "libs" or p.name.endswith(".min.js"):
            continue
        assert alias not in p.read_text(), f"{p.name} still references {alias}"


# ── Radius tokens in use (FR-014) ────────────────────────────────────────────

def test_ad_hoc_pill_and_xl_radii_use_tokens():
    bad = []
    for p in _sheets():
        for ln, line in enumerate(p.read_text().splitlines(), 1):
            if re.search(r"border-radius:\s*(16px|980px|999px|9999px)\s*[;}]", line):
                bad.append(f"{p.name}:{ln}")
    assert bad == [], bad[:10]


# ── Reduced motion (FR-019) ──────────────────────────────────────────────────

def test_reduced_motion_covers_animation_transition_and_transform():
    css = (STATIC / "a11y.css").read_text()
    block = css[css.index("prefers-reduced-motion: reduce"):]
    for needle in ("animation-duration", "transition-duration", "transform: none", "scroll-behavior"):
        assert needle in block, needle


# ── Regressions found in review (DevDB lock card) ────────────────────────────

def test_text_field_focus_ring_is_inset():
    css = (STATIC / "a11y.css").read_text()
    assert re.search(r"textarea:focus-visible[^{]*\{[^}]*outline-offset:\s*-2px\s*!important", css, re.S)


def test_devdb_lock_form_keeps_flex_gap():
    js = (STATIC / "db-manager.js").read_text()
    assert "getElementById('lock-form').style.display = 'flex'" in js
    assert "getElementById('lock-form').style.display = 'block'" not in js


def test_lock_screens_stay_inside_narrow_viewports():
    ssh = (STATIC / "ssh-manager.css").read_text()
    overlay = ssh[ssh.index(".modal-overlay {"):ssh.index("}", ssh.index(".modal-overlay {"))]
    assert "padding: 16px" in overlay and "box-sizing: border-box" in overlay
    vault = (STATIC / "vault.css").read_text()
    assert ".lock-input::placeholder" in vault and "text-overflow: ellipsis" in vault


# ── Injection must not land inside page scripts (found by the 2026-11-17 smoke test) ──

def test_injected_scripts_go_before_the_final_body_close():
    """file-converter.html builds an HTML string containing '</body>' inside a JS template literal."""
    from deps import _serve_html
    src = (STATIC / "file-converter.html").read_text()
    assert src.count("</body>") >= 2, "fixture assumption: a literal </body> exists inside a script"
    html = _serve_html("file-converter.html")
    literal_at = html.index("</body>")  # the one inside the JS string
    for needle in ("a11y.js", "command-palette.js"):
        assert html.index(needle, html.index("</script>", html.index("marked.parse"))) > literal_at
        # injected after the page's last inline script, i.e. not inside the template literal
        assert html.rindex(needle) > html.rindex("marked.parse")
    assert html.rstrip().endswith("</html>")


@pytest.mark.parametrize("page", HTML_FILES)
def test_inline_scripts_still_parse_after_injection(page):
    import shutil
    import subprocess
    import tempfile
    from deps import _serve_html
    node = shutil.which("node")
    if not node:
        pytest.skip("node not installed")
    for i, m in enumerate(re.finditer(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script(?:\s+[^>]*)?>", _serve_html(page), re.S | re.I)):
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
            f.write(m.group(1))
        r = subprocess.run([node, "--check", f.name], capture_output=True, text=True)
        assert r.returncode == 0, f"{page} inline script #{i}: {r.stderr.strip().splitlines()[:2]}"


# ── Runtime-integrity regressions found by the 2026-11-17 smoke test ──────────

def _local_script_srcs(page: str) -> list[str]:
    return re.findall(r'<script[^>]*\bsrc="(/static/[^"?]+)', (STATIC / page).read_text())


@pytest.mark.parametrize("page", HTML_FILES)
def test_every_referenced_local_script_exists(page):
    """ssh-manager.html referenced /static/libs/chart.js, which was never vendored (404)."""
    missing = [s for s in _local_script_srcs(page) if not (STATIC / s.removeprefix("/static/")).exists()]
    assert missing == [], f"{page}: missing {missing}"


def test_db_manager_loads_components_before_its_script():
    """db-manager.js calls DevSuite.csrfToken(), defined in components.js."""
    srcs = _local_script_srcs("db-manager.html")
    assert "/static/components.js" in srcs
    assert srcs.index("/static/components.js") < srcs.index("/static/db-manager.js")


def test_db_manager_loads_master_verify_before_its_script():
    """db-manager.js unlocks via MasterVerify (v1+v2 challenge); it must load first."""
    srcs = _local_script_srcs("db-manager.html")
    assert srcs.index("/static/master-verify.js") < srcs.index("/static/db-manager.js")
    js = (STATIC / "db-manager.js").read_text()
    assert "MasterVerify.verifyMasterPassword" in js
    assert "CryptoJS.AES.decrypt(challenge.verify_blob" not in js, "v1-only unlock path must not return"


def test_css_imports_precede_all_rules():
    """A mid-file @import is ignored by browsers — toast.css never loaded on linter/style pages."""
    for sheet in ("linter.css", "style.css"):
        css = re.sub(r"/\*.*?\*/", "", (STATIC / sheet).read_text(), flags=re.S)
        first_rule = css.index("{")
        for m in re.finditer(r"@import\b", css):
            assert m.start() < first_rule, f"{sheet}: @import after the first rule is ignored by browsers"
        assert "@import 'toast.css'" in css, sheet


def test_sftp_browser_verifies_challenge_and_opens_a_session():
    """The standalone SFTP page never exchanged the master key for a session, so every
    vault created by a current version failed with 401 on /api/ssh/profiles."""
    js = (STATIC / "sftp-browser.js").read_text()
    assert "MasterVerify.verifyMasterPassword" in js and "/api/auth/session" in js
    srcs = _local_script_srcs("sftp-browser.html")
    assert srcs.index("/static/master-verify.js") < srcs.index("/static/sftp-browser.js")
