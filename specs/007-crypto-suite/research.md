# Phase 0 Research: Crypto Suite

Retroactive research notes — decisions already embedded in the shipped code.

## R1 — WebCrypto first, CryptoJS only where WebCrypto can't help

**Decision**: Use native `crypto.subtle` for SHA-1/256/512, RSA-OAEP keygen/encrypt/decrypt, and
all HMAC/JWT-verify operations; fall back to the vendored CryptoJS only for **MD5** (not exposed
by WebCrypto at all) and **AES** (WebCrypto's AES-GCM/CBC API doesn't offer the exact
"passphrase-as-string, CryptoJS-compatible ciphertext format" UX this tool ships — CryptoJS's
`AES.encrypt(text, passphraseString, {mode, padding})` one-liner is what the AES tab is built
around).

**Why**: Minimizes dependency surface (WebCrypto ships in every browser, zero bytes to vendor)
while still covering the one legacy algorithm (MD5) and one ergonomic API (CryptoJS AES) that
WebCrypto doesn't provide directly. Consistent with SPEC §2's "self-hosted JS libs, no runtime
CDN dependencies" — CryptoJS is already vendored for the Vault and SSH Manager, so reusing it here
adds no new dependency.

## R2 — RSA keys are generate-only, extractable, PEM-exported

**Decision**: `crypto.subtle.generateKey(..., extractable: true, ...)` then export to PEM for
on-screen display and copy — no "import your own key" path.

**Why**: This tab's purpose is a quick in-browser RSA sandbox for testing, not a key-management
tool (that's the Secret Vault's job, and Vault keys are a completely separate system). Making keys
extractable/exportable is the whole point — a non-extractable key would be unusable for the
"copy this PEM out" workflow the UI offers.

**Alternative rejected**: Importing arbitrary PEM keys was not built — out of scope for a
generate-and-play sandbox; users needing to test against a specific existing key would reach for
`openssl` or a different tool.

## R3 — JWT verification lives here, not in the Base64 tool

**Decision**: Full HS256/384/512 + RS256 signature verification is implemented in the Crypto
Suite's JWT tab (`static/crypto.html:1310-1349`), while the standalone Base64 tool's JWT panel
(`static/base64.html:330-351`) remains decode-only.

**Why** (inferred from the resulting UX, not from a comment in code — flagged as inference):
Base64 is framed as a fast, no-input-required inspection utility; asking for a secret/public key
there would break that fast-glance flow. The Crypto Suite is already the page where users expect
to hand over key material (AES passphrases, HMAC secrets, RSA keys), so adding a
"paste key, verify" step fits its established interaction pattern. This split was not called out
anywhere in SPEC.md prior to this retroactive spec — see the discrepancy note in spec.md.

## R4 — Fail-closed JWT algorithm handling

**Decision**: The verify handler's `if (algo.startsWith('HS')) {...} else if (algo === 'RS256')
{...}` leaves `ok = false` for any other algorithm (`static/crypto.html:1322-1341`), rather than
throwing or defaulting to a pass.

**Why**: Correct security default — an unsupported/unexpected algorithm (including the notorious
`alg: none` JWT confusion vector) must never be reported as a valid signature. Noted in spec.md
as a minor UX rough edge (says "INVALID" rather than "unsupported algorithm") but explicitly
**not** a security issue, since it never produces a false positive.

## R5 — No dedicated JS file, six tabs in one script

**Decision**: All six tabs' logic lives in one inline `<script>` in `crypto.html` rather than
split into per-tab files or a shared module.

**Why**: Matches the pattern of the other small standalone tools (Base64, Regex); the six tabs
share almost no state or logic (only the tab-switch shell and `toast()` helper are shared), so a
single file with clearly separated sections was preferred over introducing a build step or
manual `<script>` file sprawl — consistent with SPEC §2's "no build tools" constraint.
