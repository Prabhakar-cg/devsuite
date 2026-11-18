"""Token + contrast helpers for the accessibility tests (feature 023, SPEC §9.12).

Parses the real theme sources so tests check what ships:
  * static/style.css       :root           → tool-page default theme ("vs-dark" id)
  * static/theme.js        html[data-theme="vs|high-contrast|ios-glass"] blocks
  * static/home.css        :root           → home/tools default (Noir)
  * static/theme.js        HOME_THEMES map → midnight / ocean / solarized / ios-glass / hc-black
"""
from __future__ import annotations

import re
from pathlib import Path

STATIC = Path(__file__).resolve().parents[2] / "static"

_VAR_RE = re.compile(r"(--[a-z0-9-]+)\s*:\s*([^;]+);", re.I)
_HEX_RE = re.compile(r"^#([0-9a-f]{3}|[0-9a-f]{6})$", re.I)
_RGBA_RE = re.compile(r"^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$", re.I)


def parse_color(value: str):
    """Return (r, g, b, a) floats or None when the value is not a plain color."""
    value = value.strip().rstrip(";").replace("!important", "").strip()
    m = _HEX_RE.match(value)
    if m:
        h = m.group(1)
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 1.0
    m = _RGBA_RE.match(value)
    if m:
        a = float(m.group(4)) if m.group(4) is not None else 1.0
        return float(m.group(1)), float(m.group(2)), float(m.group(3)), a
    return None


def composite(fg, bg):
    """Alpha-composite fg over an opaque bg."""
    r, g, b, a = fg
    return tuple(c * a + bc * (1 - a) for c, bc in zip((r, g, b), bg[:3])) + (1.0,)


def _lin(c: float) -> float:
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(rgb) -> float:
    r, g, b = rgb[:3]
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def contrast(fg, bg) -> float:
    """WCAG contrast ratio; fg/bg may have alpha (bg composited over white)."""
    if bg[3] < 1:
        bg = composite(bg, (255, 255, 255, 1.0))
    if fg[3] < 1:
        fg = composite(fg, bg)
    l1, l2 = luminance(fg), luminance(bg)
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def parse_vars(block: str) -> dict:
    return {k: v.strip() for k, v in _VAR_RE.findall(block)}


def _block(text: str, header_re: str) -> str:
    m = re.search(header_re + r"\s*\{", text)
    if not m:
        return ""
    i, depth = m.end(), 1
    start = i
    while i < len(text) and depth:
        depth += {"{": 1, "}": -1}.get(text[i], 0)
        i += 1
    return text[start:i - 1]


def resolve(name: str, vars_: dict, depth: int = 0):
    """Resolve a var (following var(--x) aliases) to an (r,g,b,a) tuple."""
    if depth > 8 or name not in vars_:
        return None
    v = vars_[name]
    m = re.match(r"var\((--[a-z0-9-]+)\)", v)
    if m:
        return resolve(m.group(1), vars_, depth + 1)
    return parse_color(v)


def tool_themes() -> dict:
    """Tool-page themes: name → merged var dict (style.css :root + theme.js override)."""
    base = parse_vars(_block((STATIC / "style.css").read_text(), r":root"))
    js = (STATIC / "theme.js").read_text()
    themes = {"vs-dark": dict(base)}
    for name in ("vs", "high-contrast", "ios-glass"):
        over = parse_vars(_block(js, rf'html\[data-theme="{name}"\]'))
        merged = dict(base)
        merged.update(over)
        themes[name] = merged
    return themes


CANONICAL_TOKENS = [
    "--bg", "--bg-secondary", "--bg-tertiary", "--text", "--text-mid", "--text-muted",
    "--border", "--border-mid", "--blue", "--blue-hover", "--blue-subtle", "--blue-text",
    "--green", "--green-mid", "--green-text", "--green-subtle",
    "--red", "--red-mid", "--red-text", "--red-subtle",
    "--amber", "--amber-mid", "--amber-text", "--amber-subtle",
    "--on-accent", "--focus-ring", "--scrollbar-thumb", "--scrollbar-thumb-hover",
    "--shadow-xs", "--shadow-sm", "--shadow-md",
]
THEME_LAYER_SELECTORS = {"high-contrast": "high-contrast", "ios-glass": "ios-glass", "vs": "vs"}


def canonical_themes() -> dict:
    """Canonical tool tokens per themed variant: style.css :root (default) + theme-layer.css override."""
    base = parse_vars(_block((STATIC / "style.css").read_text(), r":root"))
    layer = (STATIC / "theme-layer.css").read_text()
    themes = {"default": dict(base)}
    for name in THEME_LAYER_SELECTORS:
        merged = dict(base)
        merged.update(parse_vars(_block(layer, rf'html\[data-theme="{name}"\]')))
        themes[name] = merged
    return themes


# (fg, surfaces, ratio) — Hi-Contrast uses the stricter 7:1 for body text (see test_theme_layer)
CANONICAL_MATRIX = [
    ("--text", ["--bg", "--bg-secondary", "--bg-tertiary"], 4.5),
    ("--text-mid", ["--bg", "--bg-secondary", "--bg-tertiary"], 4.5),
    ("--text-muted", ["--bg", "--bg-secondary", "--bg-tertiary"], 4.5),
    ("--blue-text", ["--bg", "--bg-secondary", "--bg-tertiary"], 4.5),
    ("--green-text", ["--bg", "--bg-secondary", "--bg-tertiary"], 4.5),
    ("--red-text", ["--bg", "--bg-secondary", "--bg-tertiary"], 4.5),
    ("--amber-text", ["--bg", "--bg-secondary", "--bg-tertiary"], 4.5),
    ("--focus-ring", ["--bg", "--bg-secondary", "--bg-tertiary"], 3.0),
    ("--blue", ["--bg", "--bg-secondary"], 3.0),
]


def home_themes() -> dict:
    """Home/Tools themes: name → var dict (home.css :root + HOME_THEMES entry)."""
    base = parse_vars(_block((STATIC / "home.css").read_text(), r":root"))
    js = (STATIC / "theme.js").read_text()
    body = _block(js, r"const HOME_THEMES = ")
    themes = {"vs-dark": dict(base)}
    for m in re.finditer(r"'([a-z-]+)':\s*\{(.*?)\n        \}", body, re.S):
        merged = dict(base)
        merged.update({k: v for k, v in re.findall(r"'(--[a-z0-9-]+)':\s*'([^']+)'", m.group(2))})
        themes[m.group(1)] = merged
    return themes


# (fg var, [surface vars], min ratio)
TOOL_MATRIX = [
    ("--text-primary", ["--bg-main", "--bg-surface", "--bg-tertiary"], 4.5),
    ("--text-secondary", ["--bg-main", "--bg-surface", "--bg-tertiary"], 4.5),
    ("--text-muted", ["--bg-main", "--bg-surface", "--bg-tertiary"], 4.5),
    ("--focus-ring", ["--bg-main", "--bg-surface"], 3.0),
]
HOME_MATRIX = [
    ("--text-primary", ["--void", "--deep", "--surface", "--surface-2", "--surface-3"], 4.5),
    ("--text-secondary", ["--void", "--deep", "--surface", "--surface-2", "--surface-3"], 4.5),
    ("--text-muted", ["--void", "--deep", "--surface", "--surface-2", "--surface-3"], 4.5),
    ("--focus-ring", ["--void", "--deep", "--surface"], 3.0),
]


def evaluate(themes: dict, matrix, base_surface: str):
    """Yield (theme, fg, surface, ratio, required) for every pairing."""
    for tname, vars_ in themes.items():
        base = resolve(base_surface, vars_) or (255, 255, 255, 1.0)
        base = composite(base, (255, 255, 255, 1.0)) if base[3] < 1 else base
        for fg_name, surfaces, need in matrix:
            fg = resolve(fg_name, vars_)
            if fg is None:
                yield tname, fg_name, "-", None, need
                continue
            for sname in surfaces:
                s = resolve(sname, vars_)
                if s is None:
                    continue
                if s[3] < 1:
                    s = composite(s, base)
                yield tname, fg_name, sname, contrast(fg, s), need


if __name__ == "__main__":
    for label, themes, matrix, base in (
        ("TOOL", tool_themes(), TOOL_MATRIX, "--bg-main"),
        ("HOME", home_themes(), HOME_MATRIX, "--void"),
    ):
        print(f"== {label} ==")
        for t, fg, s, r, need in evaluate(themes, matrix, base):
            flag = "OK " if r is not None and r >= need else "FAIL"
            print(f"{flag} {t:14s} {fg:16s} on {s:11s} {('%.2f' % r) if r else 'n/a':>6s} (need {need})")
