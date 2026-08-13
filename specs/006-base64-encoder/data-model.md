# Phase 1 Data Model: Base64 Encoder / Decoder

**No persistence.** This tool has no DevDB store (SPEC §6.4 lists no store for it) and no
server-side state at all. All state lives in page-scoped JS variables and is discarded on
navigation or reload.

## In-memory state (`static/base64.html`, IIFE at line 196)

| Variable | Type | Notes |
|---|---|---|
| `lastOutput` | `string` | Most recent encode/decode/JWT result; feeds Copy and Swap actions |
| `urlSafe` | `boolean` | Current mode; toggled by `#mode-std`/`#mode-url` buttons |

## Transient JWT breakdown (rendered directly to DOM, not held as a JS object)

| Field | Source | Rendered to |
|---|---|---|
| `header` | Base64URL-decoded + `JSON.parse`d part 1 | `#jwt-header` (`textContent`) |
| `payload` | Base64URL-decoded + `JSON.parse`d part 2 | `#jwt-payload` (`textContent`) |
| `signature` | raw part 3 (not decoded/verified) | `#jwt-sig` (`textContent`, with the "verify server-side" caption — see spec.md FR-003 discrepancy note) |

No hashing, encryption, or signature verification occurs anywhere in this tool — it is pure
encoding/decoding, distinct from the Crypto Suite (`specs/007-crypto-suite/`) which does perform
cryptographic operations including its own JWT signature verification.
