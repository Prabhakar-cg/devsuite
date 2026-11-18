"""Regression guards for items closed from BACKLOG.md items and the 2026 engineering reviews (2026-11-17)."""
import re
from pathlib import Path

STATIC = Path(__file__).resolve().parents[2] / "static"
ROOT = STATIC.parent


def test_db_manager_cannot_rotate_the_master_challenge():
    """BUG-1: the 'Database Password' modal rewrote the master challenge with a fresh salt without
    re-encrypting the vault, orphaning encrypted data. Rotation lives only in Secret Vault."""
    js = (STATIC / "db-manager.js").read_text()
    html = (STATIC / "db-manager.html").read_text()
    assert "update-challenge" not in js
    for gone in ("pw-modal", "new-pw-input", "pw-save-btn", "savePassword"):
        assert gone not in html and gone not in js, gone
    assert 'href="/vault"' in html and "DEVDB_PASSWORD" in html  # points to the safe flow + env var


def test_only_the_vault_calls_update_challenge():
    callers = [p.name for p in STATIC.glob("*.js") if "update-challenge" in p.read_text() and not p.name.endswith(".min.js")]
    assert callers == ["vault.js"], callers


# ── ROAD-3: container packaging ──────────────────────────────────────────────

def test_dockerfile_is_multistage_nonroot_and_persists_to_a_volume():
    df = (ROOT / "Dockerfile").read_text()
    assert df.count("\nFROM ") + df.startswith("FROM ") >= 2, "multi-stage build"
    assert re.search(r"^USER devsuite$", df, re.M), "must not run as root"
    assert "HOME=/data" in df and 'VOLUME ["/data"]' in df, "DevDB lives under HOME"
    assert "HEALTHCHECK" in df and "/api/auth/status" in df
    assert 'CMD ["python", "main.py"]' in df and "HOST=0.0.0.0" in df
    for needed in ("libpango-1.0-0", "openssh-client"):  # WeasyPrint + SFTP host-key tooling
        assert needed in df
    # only runtime sources are copied (no tests/specs/secrets)
    copies = re.findall(r"^COPY .*$", df, re.M)
    assert not any(w in c for c in copies for w in ("tests", "specs", ".env"))


def test_compose_publishes_on_loopback_only_and_is_locked_down():
    dc = (ROOT / "docker-compose.yml").read_text()
    assert '"127.0.0.1:8000:8000"' in dc, "never publish on 0.0.0.0"
    assert "devsuite-data:/data" in dc
    for hardening in ("read_only: true", "cap_drop: [ALL]", "no-new-privileges:true"):
        assert hardening in dc
    assert "DEVDB_PASSWORD" in dc


def test_dockerignore_keeps_secrets_and_dev_files_out_of_the_image():
    ig = (ROOT / ".dockerignore").read_text().split()
    for p in (".git", ".venv", "tests", "specs", "node_modules", ".claude"):
        assert p in ig


# ── DX-1 / SEC-2: lint config + vendored-JS manifest ─────────────────────────

def test_ruff_config_and_precommit_exist():
    cfg = (ROOT / "ruff.toml").read_text()
    assert 'select = ["E", "F", "W"' in cfg and "static" in cfg
    assert "ruff check" in (ROOT / ".pre-commit-config.yaml").read_text()
    assert "ruff check ." in (ROOT / ".github/workflows/tests.yml").read_text()


def test_package_json_matches_vendored_versions():
    import json
    pkg = json.loads((ROOT / "package.json").read_text())
    versions = json.loads((ROOT / "scripts" / "versions.json").read_text())
    mapping = {"dompurify": "dompurify.min", "highlight.js": "highlight.min", "js-yaml": "js-yaml.min",
               "marked": "marked.min", "papaparse": "papaparse.min"}
    for name, stem in mapping.items():
        key = f"static/libs/{stem}.js"
        assert pkg["dependencies"][name] == versions[key], (name, pkg["dependencies"][name], versions[key])
    assert pkg["private"] is True
    assert "monaco-editor" not in pkg["dependencies"] and "knownUnfixableUpstream" in pkg
    assert "npm audit" in (ROOT / ".github/workflows/tests.yml").read_text()


def test_patched_vendored_libraries_are_the_fixed_versions():
    """js-yaml <4.3.2 and DOMPurify <=3.4.16 carry published advisories (npm audit, 2026-11-17)."""
    def head(name):
        return (STATIC / "libs" / name).read_bytes()[:200].decode("utf-8", "ignore")

    assert "DOMPurify 3.4.18" in head("dompurify.min.js")
    import json
    assert json.loads((ROOT / "scripts" / "versions.json").read_text())["static/libs/js-yaml.min.js"] == "4.3.2"
    assert b"maxTotalMergeKeys" in (STATIC / "libs" / "js-yaml.min.js").read_bytes(), "merge-key CPU guard present"


# ── DX-9: no pictographic emoji in UI chrome (SPEC §9.8) ─────────────────────

def test_no_pictographic_emoji_in_ui_files():
    """✓ ✗ ✕ ● ↔ are typographic status/close symbols and allowed; emoji pictographs are not."""
    import glob
    rx = re.compile("[\U0001F300-\U0001FAFF☀-➿⭐]")
    allowed = set("✓✗✕●✔✖")
    offenders = []
    for f in sorted(glob.glob(str(STATIC / "*.html")) + glob.glob(str(STATIC / "*.js")) + glob.glob(str(STATIC / "*.css"))):
        name = Path(f).name
        if "xterm" in name or name.endswith(".min.js") or name == "toon.js":
            continue
        for i, line in enumerate(Path(f).read_text(encoding="utf-8").split("\n"), 1):
            if any(m.group(0) not in allowed for m in rx.finditer(line)):
                offenders.append(f"{name}:{i}: {line.strip()[:70]}")
    assert offenders == [], offenders[:8]


def test_pages_using_shared_icons_load_icons_js_first():
    for page, script in (("vault.html", "vault.js"), ("sftp-browser.html", "sftp-browser.js")):
        html = (STATIC / page).read_text()
        assert html.index("/static/icons.js") < html.index(f"/static/{script}"), page


# ── FEAT-17: generated Python snippets must be syntactically valid Python ─────

def test_generated_python_snippets_are_valid_python():
    import ast
    import json
    import shutil
    import subprocess
    node = shutil.which("node")
    if not node:
        import pytest
        pytest.skip("node not installed")
    configs = [
        {"url": "https://x.io", "method": "GET"},
        {"url": "https://a.io/p", "method": "POST", "queryParams": {"q": "a b&c"}, "auth": {"type": "bearer", "token": "t"},
         "headers": {"X-Note": "it's \"quoted\" \\ backé", "Accept": "*/*"}, "bodyType": "json",
         "body": {"name": "Zoë", "multi": "l1\nl2\ttab", "emoji_free": True, "n": None}},
        {"url": "https://a.io", "method": "PUT", "bodyType": "raw", "body": "plain 'text' with \"quotes\"\nand lines"},
    ]
    script = ("const C=require(%s);const cfgs=JSON.parse(process.argv[1]);"
              "process.stdout.write(JSON.stringify(cfgs.map(c=>C.buildPython(c))));") % json.dumps(str(STATIC / "curl-codegen.js"))
    out = subprocess.run([node, "-e", script, json.dumps(configs)], capture_output=True, text=True, check=True).stdout
    for snippet in json.loads(out):
        ast.parse(snippet)


# ── Push protection: no complete credential-shaped literals in tracked source ─

def test_no_complete_secret_shaped_literals_are_committed():
    """GitHub push protection rejects pushes containing credential-shaped strings, even fake ones
    (it blocked a Stripe-style test fixture on 2026-11-17). Secret-scanner fixtures are therefore
    assembled from fragments at runtime. AWS's documented EXAMPLE key is allowlisted by GitHub."""
    import subprocess
    shapes = {
        "stripe": r"\b[sr]k_live_[A-Za-z0-9]{16,}",
        "slack": r"\bxox[baprs]-[0-9]{6,}-[A-Za-z0-9-]{6,}",
        "aws": r"\bAKIA(?!IOSFODNN7EXAMPLE)[A-Z0-9]{16}\b",
        "github": r"\bgh[pousr]_[A-Za-z0-9]{36,}",
        "google": r"\bAIza[0-9A-Za-z_-]{35}\b",
        "anthropic": r"\bsk-ant-[A-Za-z0-9_-]{20,}",
        "openai": r"\bsk-(?:proj-|svcacct-)[A-Za-z0-9_-]{20,}",
        "pem-body": r"-----BEGIN [A-Z ]*PRIVATE KEY-----\s*[A-Za-z0-9+/]{40,}",
    }
    files = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split("\n")
    offenders = []
    for rel in filter(None, files):
        if rel.startswith("static/libs/") or rel.endswith(".min.js") or rel.endswith((".png", ".woff2", ".woff", ".ico", ".dsb")):
            continue
        path = ROOT / rel
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for name, rx in shapes.items():
            if re.search(rx, text):
                offenders.append(f"{rel} ({name})")
    assert offenders == [], offenders
