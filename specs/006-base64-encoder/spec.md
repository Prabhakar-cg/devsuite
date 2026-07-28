# Feature Specification: Base64 Encoder / Decoder

**Feature Branch**: `006-base64-encoder`

**Created**: 2026-07-28

**Status**: Implemented (retroactive spec)

**Input**: Retroactive documentation of the already-shipped Base64 / JWT tool (`GET /base64`,
`routes/pages.py:55-58` → `static/base64.html`), per SPEC.md §4.5 and the DevSuite spec-kit
migration (each of the 12 tools gets its own `specs/NNN-name/`, CLAUDE.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Encode / decode text as Base64 (Priority: P1)

A developer pastes arbitrary text (including non-ASCII/UTF-8 content) and gets its Base64
encoding, or pastes a Base64 string and gets the decoded plaintext back, entirely in the browser.

**Why this priority**: This is the tool's whole reason to exist — everything else (URL-safe mode,
JWT inspection, file mode) is a variant of this core encode/decode loop.

**Independent Test**: Type text containing multi-byte UTF-8 characters (e.g. emoji, accented
Latin), click Encode, then click Decode on the result, and confirm the round-tripped text is
byte-identical to the original.

**Acceptance Scenarios**:

1. **Given** UTF-8 text in the input panel, **When** the user clicks Encode, **Then** the output
   panel shows the correct Base64 string and the status pill reads "Encoded (Standard)".
2. **Given** a valid Base64 string in the input panel, **When** the user clicks Decode, **Then**
   the output panel shows the original text and the status pill updates accordingly.
3. **Given** invalid Base64 input, **When** the user clicks Decode, **Then** an inline error panel
   explains the failure instead of throwing an unhandled exception.

---

### User Story 2 - URL-safe Base64 mode (Priority: P2)

A developer needs a Base64 string safe to embed in a URL path/query segment (no `+`, `/`, or
padding `=`).

**Why this priority**: URL-safe Base64 (RFC 4648 §5) is a very common downstream need (JWTs,
query params, filenames) — without it users would hand-edit the standard output.

**Independent Test**: Toggle "URL-safe" mode, encode text containing bytes that produce `+`/`/`
in standard Base64, and confirm the output uses `-`/`_` with no trailing `=` padding; decode the
same string back successfully with the mode still active.

**Acceptance Scenarios**:

1. **Given** URL-safe mode is active, **When** the user encodes text, **Then** the output
   replaces `+`→`-`, `/`→`_`, and strips `=` padding (`static/base64.html:282-289`).
2. **Given** URL-safe mode is active, **When** the user decodes a string containing `-`/`_`,
   **Then** the decoder reverses the substitution before calling `atob` (`static/base64.html:291-299`).
3. **Given** the input already looks URL-safe (contains `-`/`_`) even with standard mode selected,
   **When** the user decodes, **Then** the decoder still reverses the substitution defensively
   (`/[-_]/.test(s)` check, `static/base64.html:293`).

---

### User Story 3 - Inspect a JWT (Priority: P2)

A developer pastes a JSON Web Token and wants to see its header, payload, and signature broken
out and pretty-printed, without shipping the token to any server.

**Why this priority**: JWT debugging is one of the most common reasons developers reach for a
Base64 tool at all; the SPEC explicitly calls this out as a first-class capability (§4.5).

**Independent Test**: Paste a three-part JWT, click "JWT", and confirm the header/payload panels
show pretty-printed JSON and the signature panel shows the raw signature segment.

**Acceptance Scenarios**:

1. **Given** a string with three dot-separated parts, **When** the user clicks the JWT button,
   **Then** the header and payload segments are Base64URL-decoded and rendered as pretty-printed
   JSON, and the signature segment is shown as-is with a note that it is not verified client-side
   (`static/base64.html:330-351`).
2. **Given** a string that is not a valid 3-part JWT, **When** the user clicks JWT, **Then** a
   toast explains the token is not valid rather than crashing the page.
3. **Given** the JWT panel is open, **When** the user closes it, **Then** it collapses without
   losing the main input/output panels.

---

### User Story 4 - File and clipboard input (Priority: P3)

A developer wants to encode/decode the contents of a small file, or quickly paste/copy/swap
without retyping.

**Why this priority**: Convenience layer on top of the P1 flow; not load-bearing for the tool's
core value but removes friction for common workflows.

**Independent Test**: Upload a small text file via the file picker, confirm its contents populate
the input panel; use Swap to exchange input/output; use Paste to read the clipboard directly.

**Acceptance Scenarios**:

1. **Given** a file is selected via the hidden `#file-input`, **When** the file loads, **Then**
   its text content populates the input panel (`static/base64.html:395-411`).
2. **Given** output has been produced, **When** the user clicks Swap, **Then** input and output
   panels exchange contents so the result can be immediately round-tripped.
3. **Given** the browser grants clipboard permission, **When** the user clicks Paste, **Then** the
   input panel is populated from `navigator.clipboard`.

### Edge Cases

- Empty input on Encode/Decode/JWT: rejected with a toast, no crash.
- Non-UTF-8-safe raw bytes are not a concern — `TextEncoder`/`TextDecoder` handle the UTF-8
  boundary explicitly rather than relying on `btoa`/`atob`'s native Latin1-only behavior
  (`static/base64.html:282-299`).
- JWT with a header/payload segment that isn't valid JSON after decoding: caught and reported via
  toast, not an unhandled exception (`static/base64.html:351`).
- Clearing the tool also hides the JWT panel if it was open (`static/base64.html:380-384`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST encode arbitrary UTF-8 text to Base64 and decode Base64 back to
  UTF-8 text, entirely client-side, with no network request.
- **FR-002**: The system MUST support a URL-safe mode toggle that substitutes `+`/`/` with
  `-`/`_` and strips `=` padding on encode, and reverses the substitution on decode.
- **FR-003**: The system MUST detect and decode a three-part `header.payload.signature` JWT into
  separately rendered, pretty-printed header/payload JSON panels plus a raw signature segment,
  and MUST NOT attempt signature verification (no key material is available client-side; SPEC
  §4.5 scopes this as inspection only).
  - **Discrepancy**: SPEC.md §4.5 does not mention it, but `static/base64.html:347` explicitly
    labels the signature "(signature — verify server-side)" — the UI hints at a verification
    capability that does not exist anywhere in DevSuite (no server-side JWT verify endpoint).
    This spec treats JWT inspection as decode-only and flags the misleading copy as a documentation
    debt item rather than removing it, since fixing UI copy is outside a spec-only change.
- **FR-004**: The system MUST support loading input from a local file (text content only) and
  from the clipboard, and MUST support swapping input/output content and clearing all state.
- **FR-005**: Decode failures (malformed Base64, malformed JWT parts) MUST surface as inline
  error/toast messages, never as an unhandled JS exception that breaks the page.
- **FR-006**: No Base64/JWT content is ever transmitted off-machine; the page has no backend
  endpoint beyond serving the static HTML (`GET /base64`, SPEC §5.1).

### Key Entities

- **Codec state**: `lastOutput` (string) and `urlSafe` (boolean) — in-memory only, reset on page
  reload (`static/base64.html:229`).
- **JWT breakdown**: transient `{header, payload, signature}` object rendered into three DOM
  panels; discarded when the panel is closed or the tool is cleared.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A round-trip of UTF-8 text (encode then decode) reproduces the original string
  exactly, including multi-byte characters, on every supported browser.
- **SC-002**: URL-safe encoded output never contains `+`, `/`, or `=`.
- **SC-003**: Pasting any syntactically valid JWT (three dot-separated Base64URL segments) renders
  its header and payload as valid, pretty-printed JSON within one click.
- **SC-004**: No network request is made during encode/decode/JWT-inspect (verifiable via browser
  devtools Network tab — the page has zero backend endpoints besides the initial page load).

## Assumptions

- JWT signature verification is explicitly out of scope client-side (no trusted key material is
  available in the browser); the misleading "verify server-side" hint in the UI is a pre-existing
  copy issue, not a missing feature to build against.
- "File upload" here means reading a file's text content into the input panel — there is no
  binary Base64 file-encoding mode (e.g. encoding an image to a data URI) in the current build.
- Standard `atob`/`btoa` are Latin1-only; the tool works around this by using
  `TextEncoder`/`TextDecoder` plus a byte-string bridge, which is why arbitrary UTF-8 round-trips
  correctly (verified in source, not just SPEC prose).
