# Phase 0 Research: File Format Converter

## R1 — Why split client-side vs. server-side by format, rather than doing everything server-side

**Decision**: Structured text formats (JSON/CSV/TSV/YAML/XML) and images convert client-side;
binary office/PDF formats convert server-side.

**Rationale** (inferred from the `server: bool` flag threaded through `CONV_MAP` and the actual
library choices): pure-JS libraries exist and are already vendored for the text formats
(`js-yaml`, `papaparse`) and the browser has native `DOMParser`/`Canvas` for XML and images — so
those conversions cost nothing extra to keep local and fast, and reinforce the "stays on your
machine" mission (SPEC §1.1) for the tool's most common use cases. XLSX (a zipped XML-based
binary format), PDF rendering, and DOCX parsing have no comparably mature, dependency-free
browser-native path — `openpyxl`/`pypdf`/`python-docx`/`weasyprint` are mature, well-maintained
Python libraries already a reasonable dependency for a Python backend, whereas the JS
equivalents (e.g. driving a full PDF renderer in-browser) would mean vendoring a much heavier
WASM bundle for one tool.

**Alternatives considered** (not documented in code, inferred from the shape of the decision):
- *WASM-based XLSX/PDF libraries in-browser*: would preserve the zero-network property for these
  formats too, at the cost of significant bundle size and self-hosting complexity for a
  single-tool benefit; rejected implicitly by not being pursued.
- *Server-side for everything, including JSON/YAML/CSV*: would simplify the client (`CONV_MAP`
  wouldn't need a `server` flag) but would make the fastest, most common conversions dependent on
  a round-trip and Python startup/import cost for no benefit — rejected implicitly.

## R2 — Why `_safe_url_fetcher` restricts weasyprint to `''`/`data:` schemes

**Decision**: `_conv_any_to_pdf()` passes a custom `url_fetcher` to `weasyprint.HTML(...)` that
raises `ValueError` for any URL scheme other than empty or `data:`.

**Rationale** (from the inline comment/structure): converting user-supplied HTML/Markdown/DOCX to
PDF means weasyprint will, by default, follow any `<img src>`/`<link href>` it finds in that
content — including `http://`, `https://`, and `file://` URLs. Without a restriction, this is a
straightforward SSRF (server-side fetches an attacker-chosen URL) and local-file-disclosure
(`file://` reads arbitrary server-local files into the rendered PDF) vector triggered by
uploading a crafted document. Restricting to `data:`/empty schemes preserves the ability to embed
inline images (`data:image/png;base64,...`) — the common case for exported/rendered content —
while closing both attack classes. This mirrors the reasoning behind the CORS proxy's SSRF
protections (SPEC §5.9), applied to a different subsystem.

## R3 — Why format detection is extension-only, not content-sniffed

**Decision**: `extFromName()` / `normalizeExt()` derive the source format purely from the
filename's extension (with `jpeg→jpg` and `markdown→md` aliasing).

**Rationale**: Content-sniffing (magic-byte detection) would add real complexity — JSON/YAML/CSV
in particular are not reliably distinguishable from their first bytes alone (a CSV with one
column and JSON-looking values, a YAML document that happens to start with `{`) — for a tool
whose primary users are developers who already know what file they're uploading and will
correct a wrong auto-detected `from` dropdown in one click. The trade-off favors simplicity.

## R4 — Why HTTP 503 (not 500) for missing optional libraries

**Decision**: Every server-side conversion helper wraps its `import` in a `try/except
ImportError`, raising `HTTPException(503, "... is not installed. Run: pip install ...")`.

**Rationale**: 500 signals "the server is broken"; 503 ("Service Unavailable") more accurately
communicates "this specific capability isn't available right now" while the rest of the app
functions normally — and the actionable `pip install` message turns a confusing failure into a
one-line fix, appropriate for a self-hosted tool where the user IS the operator who can run that
command.
