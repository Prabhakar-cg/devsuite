# Research — ID Generator (019)

Phase 0 decisions. Each resolves a format/algorithm/dependency question raised by the spec so the
implementation is grounded in the published definitions rather than guesswork.

## R1 — Randomness source

**Decision**: All randomness comes from `crypto.getRandomValues(new Uint8Array(n))`. No
`Math.random()` fallback anywhere (FR-005). If `globalThis.crypto?.getRandomValues` is absent, the
tool refuses to generate and shows a "secure randomness unavailable" message.

**Rationale**: Constitution Art. II (local, offline) and the security posture of the suite. Web
Crypto is available in every secure context, which the loopback origin is. UUID v4/v7, ULID, and
NanoID all mandate a CSPRNG; CUID2's own reference stresses cryptographic entropy sources.

## R2 — UUID v4 (RFC 9562 §5.4)

- 128 bits total. Set the 4 version bits to `0100` (nibble `4` at position 13) and the 2 variant
  bits to `10` (top bits of the byte at position 8 → nibble in `[89ab]`).
- **122 bits of randomness** (128 − 4 version − 2 variant).
- Format: `xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx`, lowercase hex.
- Not time-sortable; carries no timestamp.

## R3 — UUID v7 (RFC 9562 §5.7)

- 128 bits: first **48 bits** = big-endian Unix timestamp in **milliseconds**; then version nibble
  `7`; `rand_a` (12 bits); variant `10`; `rand_b` (62 bits).
- **74 bits of randomness** + 48-bit ms timestamp; version/variant consume the remaining 6 bits.
- Time-sortable: lexicographic order approximates creation order. ([RFC 9562](https://www.ietf.org/rfc/rfc9562.txt))
- **Decode**: read the first 6 bytes (12 hex chars, minus the dashes) as a big-endian integer →
  `new Date(ms)` (FR-013). Content rephrased for compliance with licensing restrictions.

## R4 — ULID (ULID spec)

- 128 bits rendered as **26 Crockford base32** chars. First 10 chars = **48-bit** ms timestamp;
  last 16 chars = **80 bits** of randomness.
- **80 bits of randomness** + 48-bit ms timestamp. Lexicographically sortable by time.
- Alphabet: Crockford base32 `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (no I, L, O, U).
- **Decode**: base32-decode the first 10 chars back to the ms integer → `new Date(ms)`.

## R5 — CUID2 (paralleldrive/cuid2 reference)

- Reference algorithm: a leading random **letter**, followed by a hash (SHA3) of
  `time + salt + counter + fingerprint + entropy`, sliced to the configured length. Default
  **length 24**; each id starts with a letter; base36 alphabet. ([cuid2 README](https://github.com/paralleldrive/cuid2/blob/main/README.md) — content rephrased for compliance.)
- **Decision**: implement faithfully using **`CryptoJS.SHA3`** with `{ outputLength: 512 }`, which
  is already present in the vendored `static/crypto-js.min.js` — **no new dependency**. The page
  loads `crypto-js.min.js` (same as Crypto Suite / Vault do). Entropy sources: `Date.now()`, a
  per-session random fingerprint, a monotonic counter, and fresh `crypto.getRandomValues` bytes per
  id, matching the reference's "multiple independent entropy sources" design.
- Entropy note shown: default length 24 over base36 ≈ ~120 bits of usable entropy (collision-
  resistant at horizontal-scale volumes). Not time-sortable; no decodable timestamp.

## R6 — NanoID (ai/nanoid reference)

- Default **21 chars** over the URL-safe alphabet `A-Za-z0-9_-` (64 symbols). Each char = 6 bits →
  **~126 bits** of randomness. Uniform selection via `crypto.getRandomValues` + rejection/masking
  to avoid modulo bias (the reference uses a bitmask over the alphabet size).
- Not time-sortable; no timestamp.

## R7 — Module shape & testability (extends DX-10)

**Decision**: A pure `static/id-gen.js` exports the generators, the per-type entropy facts table,
and the timestamp decoders, with the dual-export footer used by `curl-codegen.js`/`cookie-jar.js`
(`if (typeof module !== 'undefined' && module.exports) { module.exports = ... }` plus a global
assignment). `crypto.getRandomValues` and `CryptoJS.SHA3` are injected/looked-up so the Node test
can supply Node's `webcrypto` and `crypto-js`, keeping the module DOM-free and Node-testable.

**Rationale**: Lets `tests/javascript/test-id-gen.js` assert format conformance, batch distinctness,
entropy facts, and timestamp-decode round-trips under the zero-dependency Node runner, without a
browser. The DOM controller `static/id-generator.js` stays a thin, untested-by-unit glue layer.

## R8 — DOM & clipboard

- Render every id via `createElement` + `textContent` — never `innerHTML` with a generated value
  (Art. V, FR-017).
- Copy uses `navigator.clipboard.writeText`; on rejection/absence, surface a failure toast (FR-009)
  rather than a false success. Reuse the suite's existing toast component if present on the page.

## R9 — No backend

No route beyond `GET /id-generator` serving the static page. No `/api/*` endpoint, no DevDB store,
no CSRF-guarded mutation — so `contracts/` is intentionally empty (nothing to contract).
