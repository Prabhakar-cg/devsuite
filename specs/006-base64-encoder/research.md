# Phase 0 Research: Base64 Encoder / Decoder

Retroactive research notes — decisions already made in the shipped code, documented here for
future maintainers per the DevSuite spec-kit migration.

## R1 — UTF-8 safety via TextEncoder/TextDecoder, not raw `btoa`/`atob`

**Decision**: Bridge through `TextEncoder().encode(str)` → byte string → `btoa`, and the reverse
for decode (`static/base64.html:281-299`), rather than calling `btoa`/`atob` directly on strings.

**Why**: `btoa`/`atob` operate on Latin1 code units; calling `btoa` directly on a UTF-8 string
with multi-byte characters (emoji, accented characters) throws `InvalidCharacterError` or
silently mangles the output. Bridging through `TextEncoder`/`TextDecoder` is the standard
browser-native fix and requires no third-party library — consistent with the offline/no-CDN
constraint (SPEC §2).

**Alternative rejected**: A polyfill/library (e.g. `js-base64`) was unnecessary — the native
bridge is a handful of lines and avoids adding another vendored dependency for a solved problem.

## R2 — JWT inspection is decode-only, not verify

**Decision**: The JWT panel decodes and pretty-prints header/payload but never attempts signature
verification.

**Why**: Verifying an HS256 JWT requires the shared secret; verifying RS256 requires the public
key. Neither is available or solicited from the user in this tool's UI — asking the user to paste
a secret into a generic Base64 tool would be a confusing (and easy to misuse) UX. Full
verification lives instead in the Crypto Suite's dedicated JWT Inspector tab
(`specs/007-crypto-suite/`), which does collect a key and calls `crypto.subtle.verify`.

**Residual issue**: the signature panel's caption ("verify server-side") is misleading since no
such server-side verification endpoint exists anywhere in DevSuite — flagged in spec.md FR-003 as
a documentation/copy discrepancy rather than fixed here (spec-only change).

## R3 — No dedicated JS file

**Decision**: All logic lives inline in `base64.html`'s `<script>`, not in a separate `.js` file.

**Why**: Matches this tool's small surface area and the pattern already established for
JSON/YAML/Regex (`static/app.js` is shared across Diff/JSON/YAML, but Base64/Regex/Crypto each
keep their logic inline). No behavior change is implied; documented as the as-built state.
