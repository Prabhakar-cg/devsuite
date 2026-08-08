# Feature Specification: Crypto Suite

**Feature Branch**: `007-crypto-suite`

**Created**: 2026-07-28

**Status**: Implemented (retroactive spec)

**Input**: Retroactive documentation of the already-shipped Crypto Suite (`GET /crypto`,
`routes/pages.py:61-64` → `static/crypto.html`), per SPEC.md §4.6 and the DevSuite spec-kit
migration (each of the 12 tools gets its own `specs/NNN-name/`, CLAUDE.md).

**Discrepancy vs. SPEC.md §4.6**: SPEC.md describes this tool as four tabs — Hash Generator ·
AES · RSA · HMAC. The shipped page (`static/crypto.html:326-345`) actually has **six** tabs: the
same four, plus a **Base64** tab and a **JWT Inspector** tab. The JWT tab here is materially more
capable than the standalone Base64 tool's JWT panel (`specs/006-base64-encoder/`) — it performs
real HS256/HS384/HS512/RS256 **signature verification** via `crypto.subtle.verify`, plus an
expiry claims bar, none of which SPEC.md documents anywhere. This spec documents all six tabs as
built and flags the gap per CLAUDE.md rule 2 rather than silently limiting scope to four.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate hashes of text (Priority: P1)

A developer pastes text and gets MD5, SHA-1, SHA-256, and SHA-512 digests simultaneously, each
individually copyable.

**Why this priority**: Hashing is the single most common "quick crypto tool" use case and is the
default/first tab.

**Independent Test**: Enter known text with a well-known hash (e.g. empty string, or "abc") and
confirm each algorithm's output matches its published test vector.

**Acceptance Scenarios**:

1. **Given** text in the hash input, **When** the user clicks Generate Hashes, **Then** MD5
   (via CryptoJS), SHA-1/256/512 (via native `crypto.subtle.digest`) are computed in parallel and
   each rendered with a label, a copy button, and a strength note (`static/crypto.html:671-700`)
   — e.g. MD5 is flagged "Broken — use for checksums only", SHA-1 "Deprecated for security use".
2. **Given** no input text, **When** the user clicks Generate, **Then** a warning toast appears
   and no computation runs.
3. **Given** results are shown, **When** the user clicks Clear, **Then** the results panel resets
   to its empty-state prompt.

---

### User Story 2 - AES encrypt / decrypt (Priority: P1)

A developer encrypts or decrypts text with a passphrase using AES.

**Why this priority**: The second most common ad-hoc crypto need after hashing; pairs naturally
with the Vault tool's own use of AES (though this tab is a general-purpose sandbox, not connected
to the Vault).

**Independent Test**: Encrypt text with a key under CBC mode, decrypt the ciphertext with the
same key, and confirm the recovered text matches the original; attempt decrypt with the wrong key
and confirm a clear error rather than garbage output being treated as success.

**Acceptance Scenarios**:

1. **Given** a key and plaintext, **When** the user selects AES-256-CBC and clicks Encrypt,
   **Then** `CryptoJS.AES.encrypt` with `Pkcs7` padding produces ciphertext shown in the output
   panel (`static/crypto.html:786-798`).
2. **Given** the same key and ciphertext, **When** the user clicks Decrypt, **Then** the original
   plaintext is recovered; if the result is empty (wrong key/corrupted input), an explicit error
   is raised rather than showing a blank success (`static/crypto.html:822`).
3. **Given** AES-256-CTR mode is selected instead, **When** encrypt/decrypt runs, **Then**
   `NoPadding` is used (`static/crypto.html:796,820`) and round-trips correctly.
   - **Note**: only **CBC** and **CTR** modes exist in the shipped `<select id="aes-mode">`
     (`static/crypto.html:392-395`). SPEC.md §4.6 additionally lists **ECB**, which does not
     exist anywhere in the code — a second SPEC/code discrepancy, flagged rather than
     silently added or removed here.

---

### User Story 3 - Generate an RSA keypair and encrypt / decrypt (Priority: P2)

A developer generates an RSA keypair entirely in-browser and uses it to encrypt/decrypt a short
message.

**Why this priority**: Less frequent than hashing/AES but valuable for testing asymmetric flows
without shipping key material anywhere.

**Independent Test**: Generate a 2048-bit keypair, encrypt a short message with the public key,
decrypt it with the private key, and confirm the round-trip succeeds.

**Acceptance Scenarios**:

1. **Given** a key size of 2048 or 4096 bits is selected, **When** the user clicks Generate,
   **Then** `crypto.subtle.generateKey({name:'RSA-OAEP', modulusLength: bits, ..., hash:'SHA-256'})`
   produces a keypair, exported to PEM (SPKI public / PKCS8 private) and shown in two textareas
   (`static/crypto.html:867-893`).
2. **Given** a generated keypair, **When** the user encrypts a message with the public key,
   **Then** RSA-OAEP ciphertext is produced (`static/crypto.html:922`); decrypting with the
   private key recovers the original message (`static/crypto.html:937`).
3. **Given** no keypair has been generated yet, **When** the user tries to encrypt/decrypt,
   **Then** the action is disabled/blocked until Generate has run
   (`static/crypto.html:886-887` enables the buttons only after successful keygen).

---

### User Story 4 - HMAC sign and verify (Priority: P2)

A developer signs a message with a shared secret and verifies a signature against a message,
with a clear visual pass/fail banner.

**Why this priority**: Common for verifying webhook payloads and API request signing schemes —
SPEC explicitly calls out the OK/INVALID banner as a distinguishing UX detail.

**Independent Test**: Sign a message under SHA-256, then verify the same message+signature+key
and confirm a "VALID" banner; alter one character of the message and confirm "INVALID".

**Acceptance Scenarios**:

1. **Given** a secret key, algorithm (SHA-256 or SHA-512), and message, **When** the user clicks
   Sign, **Then** `crypto.subtle.sign('HMAC', ...)` produces a hex signature
   (`static/crypto.html:963-976`).
2. **Given** a key, message, and signature, **When** the user clicks Verify, **Then**
   `crypto.subtle.verify` renders a green "VALID" or red "INVALID" banner with an explanatory
   sentence, never a silent boolean (`static/crypto.html:989-999`).

---

### User Story 5 - Base64 encode/decode inside the Crypto Suite (Priority: P3)

*(Undocumented in SPEC.md — added to this spec per source inspection.)* A user already on the
Crypto Suite page can Base64 encode/decode without switching tools.

**Why this priority**: Convenience duplication of `specs/006-base64-encoder/` for users who are
already in the Crypto Suite context (e.g. encoding a key or IV before an AES operation on another
tab); not the primary reason anyone opens this page.

**Independent Test**: Encode text on the Base64 tab, toggle URL-safe mode, decode back — same
behavior as the standalone Base64 tool.

**Acceptance Scenarios**:

1. **Given** text on the Base64 tab, **When** the user encodes/decodes, **Then** behavior matches
   `specs/006-base64-encoder/spec.md` US1/US2 (same `TextEncoder`-based implementation pattern,
   independently implemented at `static/crypto.html:1046-1086`, not shared code with
   `base64.html`).
2. **Given** file bytes are loaded (not just text), **When** the user encodes, **Then** binary
   file content can be Base64-encoded (`encodeBuffer`, `static/crypto.html:1057`) — a capability
   the standalone Base64 tool does not have (it only reads files as text).

---

### User Story 6 - JWT Inspector with real signature verification (Priority: P2)

*(Undocumented in SPEC.md — added to this spec per source inspection.)* A developer pastes a JWT,
sees its decoded claims plus an expiry badge, and — unlike the standalone Base64 tool's JWT panel
— can actually verify the signature against a supplied secret or public key.

**Why this priority**: This is a materially different and more valuable capability than the
Base64 tool's decode-only JWT panel; it directly serves a common debugging need (confirm a token
was really issued by the expected party) that nothing else in DevSuite covers.

**Independent Test**: Paste a JWT signed with a known HS256 secret, enter that secret, click
Verify, and confirm a "VALID" result; enter a wrong secret and confirm "INVALID".

**Acceptance Scenarios**:

1. **Given** a 3-part JWT pasted into the input, **When** the page processes it, **Then** header
   and payload are decoded and pretty-printed live (on every keystroke,
   `static/crypto.html:1288-1290`), and a claims bar shows algorithm, expiry countdown/status
   (e.g. `EXPIRED` badge when `exp` has passed), and other standard claims
   (`static/crypto.html:1237-1267`).
2. **Given** the token's header names a supported algorithm (`HS256`/`HS384`/`HS512`/`RS256`),
   **When** decoded, **Then** the verify algorithm selector auto-populates to match
   (`static/crypto.html:1265-1267`).
3. **Given** a secret (for HS*) or a PEM public key (for RS256) is entered, **When** the user
   clicks Verify, **Then** `crypto.subtle.verify` runs with the matching algorithm/hash and
   renders a VALID/INVALID banner with an explanatory sentence
   (`static/crypto.html:1310-1349`).
4. **Given** an unsupported `alg` value (e.g. `none`, `ES256`), **When** the token is decoded,
   **Then** the claims bar flags the `alg` chip with an "UNSUPPORTED" badge, the Verify key input
   and button are disabled, and the verify-result banner proactively explains that the algorithm
   isn't supported for client-side verification — rather than letting the user click Verify and
   receive a misleading generic "INVALID" (`static/crypto.html:1237-1288`, fixed post-launch; see
   Edge Cases). The verify-button click handler also has a defensive `else` branch reporting the
   same explicit message if reached directly.

### Edge Cases

- Empty inputs on any tab's primary action: rejected with a warning toast, no computation
  attempted, no crash.
- AES decrypt with wrong key or corrupted ciphertext: `CryptoJS` decrypt can return an empty
  string rather than throwing; the code explicitly checks for this and raises its own error
  (`static/crypto.html:822`) rather than reporting false success.
- RSA encrypt/decrypt is disabled until a keypair exists in this session — no persisted/imported
  key support (generate-only).
- JWT `alg: none` or an algorithm outside `{HS256,HS384,HS512,RS256}`: verify fails closed and is
  now reported explicitly as "not supported for client-side verification" (an "UNSUPPORTED" chip
  badge plus a disabled Verify control), not a generic INVALID — never a false positive either way.
- All six tabs share one page and one inline `<script>`; switching tabs does not clear other
  tabs' state (e.g. an RSA keypair generated on the RSA tab remains available if the user
  switches away and back).

## Requirements *(mandatory)*

### Functional Requirements

**Hash Generator**

- **FR-001**: The system MUST compute MD5, SHA-1, SHA-256, and SHA-512 digests of user-supplied
  text simultaneously and display each with a copy action and a security-strength annotation.

**AES**

- **FR-002**: The system MUST support AES encryption and decryption of text under a
  user-supplied passphrase, in CBC (PKCS7 padding) and CTR (no padding) modes. (SPEC.md's
  reference to an ECB mode does not match the shipped `<select>`, which offers only CBC/CTR —
  see the discrepancy note above.)
- **FR-003**: Decrypt MUST fail loudly (explicit error) rather than silently returning empty/
  garbage output when the key is wrong or the ciphertext is corrupted.

**RSA**

- **FR-004**: The system MUST generate RSA-OAEP keypairs (2048 or 4096 bit, SHA-256 hash)
  entirely client-side via WebCrypto, export them as PEM, and use the generated keypair to
  encrypt/decrypt short messages — with no key ever leaving the browser.

**HMAC**

- **FR-005**: The system MUST sign a message with a shared secret (SHA-256 or SHA-512) and MUST
  verify a message+signature+secret combination, rendering an unambiguous VALID/INVALID banner.

**Base64 (undocumented in SPEC.md prior to this spec)**

- **FR-006**: The system MUST provide Base64 encode/decode with URL-safe mode, independently
  implemented from the standalone Base64 tool, additionally supporting binary file input (not
  just text).

**JWT Inspector (undocumented in SPEC.md prior to this spec)**

- **FR-007**: The system MUST decode and live-render JWT header/payload/claims (including an
  expiry badge) as the user types, and MUST verify the signature against a user-supplied secret
  (HS256/384/512) or PEM public key (RS256), rendering a clear VALID/INVALID result.
- **FR-008**: JWT verification MUST fail closed for any algorithm outside the supported set
  rather than falsely reporting success, and MUST surface this explicitly (a distinct
  "unsupported algorithm" state, not a generic INVALID) so the user isn't misled into thinking a
  verification attempt actually ran.

**Cross-cutting**

- **FR-009**: No tab's operation MUST transmit any key, plaintext, ciphertext, or token to a
  server — every operation in this tool is client-side only (`crypto.subtle` and CryptoJS in the
  browser), consistent with SPEC §1.1/§2.

### Key Entities

- **Hash result set**: `{algo, hash, note}[]` — transient, rendered per Generate click, not
  persisted.
- **AES session**: current key/mode/text held in form fields only — no persistence.
- **RSA keypair**: `rsaKeyPair` (WebCrypto `CryptoKeyPair`, non-extractable-safe but exported to
  PEM for display) — held in a page-scoped JS variable, lost on reload; never sent to the server.
- **HMAC session**: key/algo/message/signature held in form fields only.
- **JWT verification state**: decoded `{header, payload}` plus a `verifyResult` DOM state
  (unset / ok / err) — transient, recomputed on every input change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Hashing "abc" (ASCII) reproduces the well-known published MD5/SHA-1/SHA-256/SHA-512
  test vectors for all four algorithms.
- **SC-002**: An AES encrypt→decrypt round-trip with the same key and mode reproduces the
  original plaintext exactly, for both CBC and CTR.
- **SC-003**: An RSA-OAEP encrypt→decrypt round-trip with a freshly generated keypair reproduces
  the original message, for both 2048- and 4096-bit keys.
- **SC-004**: An HMAC sign→verify round-trip with the same key/message reports VALID; altering
  either the key or the message reports INVALID.
- **SC-005**: A JWT signed with a known HS256 secret verifies as VALID when that secret is
  supplied, and INVALID when any other secret is supplied.
- **SC-006**: No network request fires during any tab's operation (browser devtools Network tab
  shows only the initial page/asset load).

## Assumptions

- RSA keys are generate-only in this tool — there is no "import an existing PEM keypair" flow;
  users who need to test against a pre-existing key must use another tool.
- The Base64 and JWT Inspector tabs are treated here as first-class, spec-worthy capabilities of
  this tool (not folded into `specs/006-base64-encoder/`) because they are separately implemented
  in `crypto.html` and, for JWT, materially more capable (real verification) than the standalone
  tool. SPEC.md §4 is index-only (points here for tool behavior) so no six-tab enumeration is
  needed there; this spec.md is the source of truth for tab-level detail. Previously, the tools
  grid card for Crypto Suite (`static/tools.html`) also didn't mention JWT or Base64 at all — it
  was fixed alongside the closure of `BACKLOG.md` FEAT-4 and the removal of the stale "Coming
  Soon → JWT Inspector" roadmap card that duplicated this already-shipped capability.
- "100% In-Browser" badge in the header (`static/crypto.html` header-right) is accurate for every
  tab verified in this spec — confirmed no tab makes a network call.
