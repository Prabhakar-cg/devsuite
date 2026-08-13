# Phase 0 Research: YAML Linter & Validator

Retroactive research notes — decisions already made in the shipped code, documented from source.

## R1: Client-side-only parsing, no backend endpoint

**Decision**: All YAML parsing/formatting/conversion happens in the browser via `js-yaml`; the
backend route (`GET /yaml`) only serves the static HTML shell.

**Rationale**: Matches DevSuite's offline-first mission (SPEC.md §1.1) and avoids adding a
request/response round trip for what is inherently a synchronous, cheap parse operation. Also
keeps this tool consistent with its sibling linters (JSON, Regex) which follow the same pattern.

**Alternative rejected**: A `/api/yaml/validate` endpoint mirroring `/json` and `/upload`'s
server-side handling — rejected as unnecessary latency and complexity for a pure parse/format
operation with a mature, self-hostable JS library available.

## R2: `js-yaml` loaded as a plain global script, not via RequireJS

**Decision**: `js-yaml.min.js` is loaded with a direct `<script src="...">` tag before
`require.min.js`, exposing the `jsyaml` global used throughout the inline script.

**Rationale**: `js-yaml`'s UMD bundle would register as an anonymous AMD module if RequireJS's
`define.amd` were already present at load time — this is exactly the ordering hazard documented
in CLAUDE.md's "UMD bundles must load BEFORE require.min.js" gotcha (also covering
`jszip.min.js`/`crypto-js.min.js`). `yaml.html` avoids the issue entirely by loading `js-yaml`
in `<head>`, well before `require.min.js` appears near the end of `<body>`.

## R3: 600ms debounce for live validation

**Decision**: Live (as-you-type) validation waits 600ms after the last keystroke before parsing.

**Rationale**: Balances responsiveness against not re-parsing (and re-rendering the status pill)
on every keystroke for larger documents; consistent with the debounce pattern used by the Regex
Tester (180ms there, tuned for the higher-frequency regex re-match use case).

## R4: `loadAll` instead of `load`

**Decision**: Uses `jsyaml.loadAll(raw, doc => docs.push(doc))` rather than the single-document
`jsyaml.load(raw)`.

**Rationale**: Supports multi-document YAML (`---`-separated), common in Kubernetes manifests and
Helm output — one of the explicitly named target formats in SPEC.md §4.3. Single-document input
still resolves to a bare object (`docs.length === 1 ? docs[0] : docs`) so the common case is
unaffected.
