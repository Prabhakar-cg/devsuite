# Phase 1 Data Model: Crypto Suite

**No persistence.** No DevDB store (SPEC §6.4 lists none for this tool), no server-side state.
Everything below is page-scoped JS state, lost on navigation/reload.

## Per-tab in-memory state (`static/crypto.html`)

| Tab | Variable / DOM state | Notes |
|---|---|---|
| Hash | (none held) | Results computed and rendered per click; no retained model |
| AES | form fields (`#aes-key`, `#aes-mode`, textareas) | No JS variable beyond the DOM; key never stored beyond the input field |
| RSA | `rsaKeyPair` | WebCrypto `CryptoKeyPair` (public + private `CryptoKey`), held for the page's lifetime; PEM export shown in `#rsa-public-key`/`#rsa-private-key` textareas for copy; **never sent to the server** |
| HMAC | form fields (`#hmac-key`, `#hmac-algo`, `#hmac-message`, `#hmac-signature`) | No JS variable beyond the DOM |
| Base64 | `lastOutput`-equivalent local state inside this tab's IIFE (independent from the standalone Base64 tool's own state) | Separate implementation, `static/crypto.html:1029+` |
| JWT | `verifyResult` DOM class state; decoded `{header, payload}` recomputed live from `rawInput.value` on every keystroke — never cached | No structured JS model object; everything is derived on demand from the raw token string |

## RSA key material specifics

| Field | Value |
|---|---|
| Algorithm | `RSA-OAEP` |
| Key sizes | 2048-bit or 4096-bit (`modulusLength`) |
| Public exponent | `65537` (`Uint8Array([1,0,1])`) |
| Hash | `SHA-256` |
| Export format | Public: SPKI DER → PEM `-----BEGIN PUBLIC KEY-----`; Private: PKCS8 DER → PEM `-----BEGIN PRIVATE KEY-----` |
| Extractability | Generated with `extractable: true` so PEM export is possible — this is a deliberate trade-off for a "show me the key" educational/testing tool, not a key-custody feature; there is no expectation of long-term secrecy for keys generated here (SPEC §1.1 "toolkit that stays on your machine" mission still holds — the key never leaves the browser). |

## JWT verification inputs (not persisted)

| Field | Source |
|---|---|
| `raw` | Pasted/typed token, split on `.` into header/payload/signature |
| `key` | User-entered secret (HS*) or PEM public key (RS256) — form field only |
| `algo` | Auto-populated from the token's own `header.alg` when it matches a supported value, else user-selected |

No relationship exists between this tool's JWT verification and the standalone Base64 tool's
JWT panel (`specs/006-base64-encoder/`) or the Secret Vault — they are independent
implementations with no shared code or data.
