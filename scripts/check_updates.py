#!/usr/bin/env python3
"""Check and interactively update DevSuite's Python packages and vendored JS libraries.

Usage:
  python scripts/check_updates.py             # check + prompt to update
  python scripts/check_updates.py --check-only  # report only, no changes
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
REQUIREMENTS = ROOT / "requirements.txt"
VERSIONS_FILE = Path(__file__).parent / "versions.json"
MONACO_DIR = ROOT / "static/libs/vs"

# (relative path, npm package name, path inside npm tarball, cdn_url_override or None)
# cdn_url_override: use {version} as placeholder; used when jsDelivr npm path doesn't work.
# Only libraries actually referenced in DevSuite HTML/JS files.
VENDORED_JS = [
    ("static/xterm.js",              "xterm",          "lib/xterm.js",           None),
    ("static/xterm-addon-fit.js",    "xterm-addon-fit","lib/xterm-addon-fit.js", None),
    ("static/crypto-js.min.js",      "crypto-js",      "crypto-js.min.js",       None),
    ("static/bwip-js-min.js",        "bwip-js",        "bwip-js-min.js",         None),
    # highlight.js npm package no longer ships the minified build — use cdnjs
    ("static/libs/highlight.min.js", "highlight.js",   None,
     "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/{version}/highlight.min.js"),
    # marked v5+ ships lib/marked.umd.js instead of marked.min.js
    ("static/libs/marked.min.js",    "marked",         "lib/marked.umd.js",      None),
    ("static/libs/papaparse.min.js", "papaparse",      "papaparse.min.js",       None),
    ("static/libs/js-yaml.min.js",   "js-yaml",        "dist/js-yaml.min.js",    None),
    ("static/libs/require.min.js",   "requirejs",      "require.js",             None),
]

# Library-specific regex patterns for sniffing the version from file content.
# Checked in order; first match wins.
_SNIFF_PATTERNS: dict[str, list[str]] = {
    "highlight.min.js": [r"highlight\.js v?([0-9]+\.[0-9]+\.[0-9]+)"],
    "marked.min.js":    [r"marked v?([0-9]+\.[0-9]+\.[0-9]+)"],
    "papaparse.min.js": [r"v([0-9]+\.[0-9]+\.[0-9]+)"],
    "js-yaml.min.js":   [r"js-yaml ([0-9]+\.[0-9]+\.[0-9]+)", r"\b([0-9]+\.[0-9]+\.[0-9]+)\b"],
    "require.min.js":   [r'version="([0-9]+\.[0-9]+\.[0-9]+)"', r"\b([0-9]+\.[0-9]+\.[0-9]+)\b"],
}

# ── Python environment detection ──────────────────────────────────────────────

def _find_python() -> tuple[str, str]:
    """Return (python_executable, label) — prefers project venv over system."""
    for candidate in [ROOT / ".venv", ROOT / "venv", ROOT / "env"]:
        py = candidate / "bin" / "python"
        if py.exists():
            return str(py), f"venv ({candidate.name})"
    return sys.executable, "system Python"


PYTHON_EXE, PYTHON_LABEL = _find_python()


# ── helpers ───────────────────────────────────────────────────────────────────

def _npm_latest(package: str) -> str:
    url = f"https://registry.npmjs.org/{package}/latest"
    try:
        with urllib.request.urlopen(url, timeout=8) as r:
            return json.loads(r.read()).get("version", "unavailable")
    except Exception:
        return "unavailable"


def _tarball_url(package: str, version: str) -> str:
    safe = package.lstrip("@").replace("/", "-")
    return f"https://registry.npmjs.org/{package}/-/{safe}-{version}.tgz"


def _sniff_version(filepath: Path) -> str | None:
    """Return version string from file content, or None if not detectable."""
    try:
        content = filepath.read_text(encoding="utf-8", errors="ignore")[:16384]
    except Exception:
        return None
    patterns = _SNIFF_PATTERNS.get(filepath.name, [r"\b([0-9]+\.[0-9]+\.[0-9]+)\b"])
    for pat in patterns:
        m = re.search(pat, content, re.IGNORECASE)
        if m:
            return m.group(1)
    return None


def _load_manifest() -> dict[str, str | None]:
    if VERSIONS_FILE.exists():
        return json.loads(VERSIONS_FILE.read_text())
    return {}


def _save_manifest(data: dict) -> None:
    VERSIONS_FILE.write_text(json.dumps(data, indent=2) + "\n")


def _confirm(prompt: str) -> bool:
    try:
        return input(f"  {prompt} [y/N] ").strip().lower() in ("y", "yes")
    except (EOFError, KeyboardInterrupt):
        print()
        return False


def _download(url: str, dest: Path) -> bool:
    try:
        print(f"    Downloading {url} ...", end=" ", flush=True)
        with urllib.request.urlopen(url, timeout=30) as r:
            dest.write_bytes(r.read())
        print("done")
        return True
    except Exception as e:
        print(f"FAILED ({e})")
        return False


def _backup(filepath: Path) -> Path:
    bak = filepath.with_suffix(filepath.suffix + ".bak")
    shutil.copy2(filepath, bak)
    return bak


# ── Python packages ───────────────────────────────────────────────────────────

def _declared_packages() -> dict[str, str]:
    """Parse requirements.txt → {normalised_name: raw_constraint_line}."""
    result = {}
    for line in REQUIREMENTS.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        name = re.split(r"[><=!~\[]", line)[0].strip()
        result[name.lower()] = line
    return result


def _outdated_in_env(declared: dict[str, str]) -> list[dict]:
    """Run pip list --outdated scoped to declared packages only."""
    r = subprocess.run(
        [PYTHON_EXE, "-m", "pip", "list", "--outdated", "--format=json"],
        capture_output=True, text=True,
    )
    all_outdated = {p["name"].lower(): p for p in json.loads(r.stdout or "[]")}
    return [all_outdated[n] for n in declared if n in all_outdated]


def check_python(update: bool = False) -> list[dict]:
    print(f"\n=== Python packages  [{PYTHON_LABEL}] ===\n")
    if not REQUIREMENTS.exists():
        print("  requirements.txt not found")
        return []

    declared = _declared_packages()
    outdated = _outdated_in_env(declared)
    outdated_map = {p["name"].lower(): p for p in outdated}

    for name, constraint in sorted(declared.items()):
        info = outdated_map.get(name)
        if info:
            print(f"  [OUTDATED]   {info['name']:<25} {info['version']:<12} →  {info['latest_version']}")
        else:
            print(f"  [ok]         {name:<25} {constraint}")

    if not outdated:
        print("  All packages are current.")
        return []

    print()
    print("  Tip: pip install pip-audit && pip-audit  (CVE scanning)")

    if update:
        _update_python(outdated)

    return outdated


def _update_python(outdated: list[dict]) -> None:
    print()
    names = [p["name"] for p in outdated]
    print(f"  Outdated: {', '.join(names)}\n")

    if _confirm("Update ALL outdated Python packages?"):
        for pkg in outdated:
            _pip_install_one(pkg["name"], pkg["latest_version"])
    else:
        for pkg in outdated:
            if _confirm(f"Update {pkg['name']}  {pkg['version']} → {pkg['latest_version']}?"):
                _pip_install_one(pkg["name"], pkg["latest_version"])


def _pip_install_one(name: str, version: str) -> None:
    print(f"    pip install {name}=={version} ...", end=" ", flush=True)
    r = subprocess.run(
        [PYTHON_EXE, "-m", "pip", "install", f"{name}=={version}", "-q"],
        capture_output=True, text=True,
    )
    if r.returncode == 0:
        print("done")
        _bump_requirements(name, version)
    else:
        print(f"FAILED\n    {r.stderr.strip()}")


def _bump_requirements(name: str, new_version: str) -> None:
    """Update the version floor in requirements.txt for the given package."""
    text = REQUIREMENTS.read_text()
    pattern = re.compile(
        rf"^({re.escape(name)}(?:\[.*?\])?)([><=!~].+)$",
        re.IGNORECASE | re.MULTILINE,
    )

    def _replace(m: re.Match) -> str:
        pkg, constraint = m.group(1), m.group(2)
        if constraint.startswith(">="):
            return f"{pkg}>={new_version}"
        if constraint.startswith("~="):
            prefix = new_version.rsplit(".", 1)[0]
            return f"{pkg}~={prefix}.0"
        if constraint.startswith("=="):
            return f"{pkg}=={new_version}"
        return m.group(0)

    new_text = pattern.sub(_replace, text)
    if new_text != text:
        REQUIREMENTS.write_text(new_text)
        print(f"    requirements.txt updated  ({name} → {new_version})")


# ── Vendored JavaScript ───────────────────────────────────────────────────────

def check_vendored_js(update: bool = False) -> list[tuple]:
    print("\n=== Vendored JavaScript ===\n")

    manifest = _load_manifest()
    outdated_libs: list[tuple] = []
    rows = []

    for rel_path, npm_name, tarball_path, cdn_override in VENDORED_JS:
        filepath = ROOT / rel_path

        # Source of truth: manifest → sniff → None (untracked)
        current = manifest.get(rel_path)
        if current is None:
            current = _sniff_version(filepath) if filepath.exists() else None
            if current:
                manifest[rel_path] = current  # promote sniffed version into manifest

        latest = _npm_latest(npm_name)

        if current is None:
            status = "[untracked]"
        elif latest == "unavailable":
            status = "[unavailable]"
        elif current == latest:
            status = "[ok]        "
        else:
            status = "[OUTDATED]  "
            outdated_libs.append((rel_path, npm_name, tarball_path, cdn_override, current, latest))

        rows.append((status, rel_path, npm_name, current or "—", latest))

    # Monaco Editor
    monaco_current = manifest.get("static/libs/vs")
    if monaco_current is None:
        pkg_json = MONACO_DIR / "package.json"
        if pkg_json.exists():
            monaco_current = json.loads(pkg_json.read_text()).get("version")
        if monaco_current:
            manifest["static/libs/vs"] = monaco_current

    monaco_latest = _npm_latest("monaco-editor")
    if monaco_current is None:
        monaco_status = "[untracked]"
    elif monaco_latest == "unavailable":
        monaco_status = "[unavailable]"
    elif monaco_current == monaco_latest:
        monaco_status = "[ok]        "
    else:
        monaco_status = "[OUTDATED]  "
        outdated_libs.append(("static/libs/vs", "monaco-editor", "__monaco__", None, monaco_current, monaco_latest))

    _save_manifest(manifest)

    for status, path, pkg, current, latest in rows:
        print(f"  {status} {Path(path).name:<32} {current:<12} →  {latest}  ({pkg})")
    print(f"  {monaco_status} {'Monaco Editor (vs/)':<32} {monaco_current or '—':<12} →  {monaco_latest}  (monaco-editor)")

    untracked = [r for r in rows if r[0] == "[untracked]"]
    if untracked:
        print()
        print("  [untracked] libs have no recorded version — edit scripts/versions.json")
        print("  to add their current version before this script can update them.")

    if update and outdated_libs:
        _update_vendored_js(outdated_libs, manifest)

    return outdated_libs


def _update_vendored_js(outdated_libs: list[tuple], manifest: dict) -> None:
    print()
    for rel_path, npm_name, tarball_path, cdn_override, current, latest in outdated_libs:
        label = Path(rel_path).name
        if not _confirm(f"Update {label} ({npm_name})  {current} → {latest}?"):
            continue

        if tarball_path == "__monaco__":
            ok = _update_monaco(latest)
        else:
            ok = _update_js_file(rel_path, npm_name, tarball_path, cdn_override, latest)

        if ok:
            manifest[rel_path] = latest
            _save_manifest(manifest)
            print(f"    versions.json updated  ({rel_path} → {latest})")


def _update_js_file(
    rel_path: str, npm_name: str, tarball_path: str | None,
    cdn_override: str | None, version: str,
) -> bool:
    dest = ROOT / rel_path
    bak = _backup(dest) if dest.exists() else None

    # 1. CDN override (e.g. cdnjs for highlight.js)
    if cdn_override:
        url = cdn_override.replace("{version}", version)
        if _download(url, dest):
            if bak:
                bak.unlink()
            return True

    # 2. jsDelivr npm CDN (only when a tarball path is known)
    elif tarball_path:
        cdn_url = f"https://cdn.jsdelivr.net/npm/{npm_name}@{version}/{tarball_path}"
        if _download(cdn_url, dest):
            if bak:
                bak.unlink()
            return True

    # 3. Extract from npm tarball
    if tarball_path:
        print("    Falling back to npm tarball ...")
        tgz_url = _tarball_url(npm_name, version)
        with tempfile.TemporaryDirectory() as tmpdir:
            tgz_path = Path(tmpdir) / "pkg.tgz"
            if not _download(tgz_url, tgz_path):
                print(f"    Cannot download {npm_name}@{version} — update manually:")
                print(f"      https://www.npmjs.com/package/{npm_name}")
                if bak:
                    shutil.copy2(bak, dest)
                    bak.unlink()
                return False

            target_name = Path(tarball_path).name
            with tarfile.open(tgz_path) as tf:
                candidates = [m for m in tf.getmembers() if m.name.endswith(target_name)]
                if not candidates:
                    print(f"    {target_name} not found in tarball — update manually.")
                    if bak:
                        shutil.copy2(bak, dest)
                        bak.unlink()
                    return False
                best = min(candidates, key=lambda m: len(m.name))
                extracted = tf.extractfile(best)
                if extracted:
                    dest.write_bytes(extracted.read())
                    print(f"    Extracted {best.name} → {dest.relative_to(ROOT)}")
                    if bak:
                        bak.unlink()
                    return True

    # Nothing worked
    print(f"    No download source available for {npm_name}@{version} — update manually.")
    if bak:
        shutil.copy2(bak, dest)
        bak.unlink()
    return False


def _update_monaco(version: str) -> bool:
    tgz_url = _tarball_url("monaco-editor", version)
    print(f"    Downloading Monaco Editor {version} (large — please wait) ...")

    with tempfile.TemporaryDirectory() as tmpdir:
        tgz_path = Path(tmpdir) / "monaco.tgz"
        if not _download(tgz_url, tgz_path):
            print("    Cannot download Monaco Editor — update manually:")
            print("      https://www.npmjs.com/package/monaco-editor")
            return False

        print("    Extracting min/vs/ ...", end=" ", flush=True)
        extract_dir = Path(tmpdir) / "out"
        extract_dir.mkdir()

        with tarfile.open(tgz_path) as tf:
            members = [m for m in tf.getmembers() if "package/min/vs/" in m.name]
            if not members:
                print("FAILED — min/vs/ not found in tarball")
                return False
            tf.extractall(extract_dir, members=members)
        print("done")

        src_vs = extract_dir / "package" / "min" / "vs"
        if not src_vs.exists():
            print("    Extraction path not found, aborting.")
            return False

        bak_dir = MONACO_DIR.with_name("vs.bak")
        if MONACO_DIR.exists():
            if bak_dir.exists():
                shutil.rmtree(bak_dir)
            shutil.copytree(MONACO_DIR, bak_dir)
            shutil.rmtree(MONACO_DIR)

        shutil.copytree(src_vs, MONACO_DIR)
        (MONACO_DIR / "package.json").write_text(
            json.dumps({"name": "monaco-editor", "version": version}, indent=2)
        )
        if bak_dir.exists():
            shutil.rmtree(bak_dir)

        print(f"    Monaco Editor updated to {version}")
        return True


# ── entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="DevSuite dependency updater")
    parser.add_argument("--check-only", action="store_true",
                        help="Report outdated packages without prompting to update")
    args = parser.parse_args()

    update = not args.check_only

    print("DevSuite — Dependency Check & Update")
    print("=" * 50)

    py_outdated = check_python(update=update)
    js_outdated = check_vendored_js(update=update)

    print()
    total = len(py_outdated) + len(js_outdated)
    if total == 0:
        print("All tracked dependencies are current.")
    elif args.check_only:
        print(f"Found {total} outdated package(s). Run without --check-only to update.")
    else:
        print("Done.")


if __name__ == "__main__":
    main()
