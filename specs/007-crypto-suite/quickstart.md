# Quickstart & Validation: Crypto Suite

How to exercise this tool manually. No automated suite covers this tool's cryptographic logic
today — validation is manual until a browser/e2e suite lands (SPEC §10.1, v1.0.0 deliverable).

## Setup

```bash
# from repo root, with the server running (not started by this doc — ask before running it)
open http://localhost:8000/crypto
```

## Functional validation (maps to spec user stories)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| US1 | known hash vectors | Hash tab: enter `abc`, Generate | MD5 `900150983cd24fb0d6963f7d28e17f72`; SHA-256 `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` (truncate-check against any published vector) |
| US2 | AES round-trip (CBC) | AES tab: key `test-key`, text `hello world`, Encrypt, then Decrypt the output with the same key | Recovers `hello world` |
| US2 | AES wrong key | Decrypt the above ciphertext with a different key | Explicit error, not blank/garbage "success" |
| US2 | AES CTR | Repeat the encrypt/decrypt round-trip with mode set to CTR | Round-trips correctly |
| US3 | RSA round-trip | RSA tab: Generate (2048-bit), encrypt a short message with the public key, decrypt with the private key | Recovers the original message |
| US4 | HMAC sign/verify | HMAC tab: key `secret`, message `hello`, algo SHA-256, Sign, then Verify with the same inputs | Green "VALID" banner |
| US4 | HMAC tamper | Verify with the message changed by one character | Red "INVALID" banner |
| US5 | in-tab Base64 | Base64 tab: encode/decode text; toggle URL-safe | Same behavior as `specs/006-base64-encoder/quickstart.md` US1/US2 |
| US6 | JWT verify (HS256) | JWT tab: paste a JWT signed with a known HS256 secret (e.g. generate one at jwt.io using a test secret — do not use a real production secret), enter that secret, algo auto-selects HS256, Verify | Green "VALID" |
| US6 | JWT verify wrong secret | Same token, wrong secret, Verify | Red "INVALID" |
| US6 | JWT expiry badge | Paste a token with an `exp` claim in the past | Claims bar shows an `EXPIRED` badge |

## Coverage note

`tests/python/test_asset_order.py` verifies only that `crypto-js.min.js` loads before
`require.min.js` (a load-order hazard, CLAUDE.md gotcha) — it does not exercise any cryptographic
correctness. No other automated test references `crypto.html`. The table above is the only
current validation.

## Acceptance gates

- Every scenario in the table above passes when exercised manually.
- No network request fires during any tab's operation (verify via browser devtools Network tab).
- RSA private key PEM and AES/HMAC keys never appear in any network request (there are none to
  check, but confirm no `fetch`/`XMLHttpRequest` call exists in the relevant code paths).
