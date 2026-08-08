# Feature Specification: ID Generator

**Feature Branch**: `014-id-generator`

**Created**: 2026-08-08

**Status**: Draft

**Input**: BACKLOG.md FEAT-2 — "Bulk generate UUIDs, ULIDs, and CUIDs with entropy inspection."
Scoped and elaborated per this project's established client-side-tool conventions (see
`specs/006-base64-encoder`, `specs/005-regex-tester`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a single ID instantly (Priority: P1)

A developer opens the ID Generator needing one unique identifier — e.g. a UUID for a test
fixture or a primary key — and gets a valid one immediately, with a one-click copy.

**Why this priority**: This is the tool's entire reason to exist — the fastest path from "I need
an ID" to "it's on my clipboard." Everything else is a multiplier on this core loop.

**Independent Test**: Load `/id-generator` — a UUID v4 is already generated and displayed.
Click "Copy" — the exact displayed value is on the clipboard, confirmed by a toast.

**Acceptance Scenarios**:

1. **Given** the page has just loaded, **When** the user looks at the main panel, **Then** a
   freshly generated UUID v4 is already displayed (no click required to see a first result).
2. **Given** a displayed ID, **When** the user clicks "Generate" (or presses the keyboard
   shortcut), **Then** a new ID of the currently selected type replaces it.
3. **Given** a displayed ID, **When** the user clicks "Copy", **Then** the exact string is
   written to the clipboard and a confirmation toast appears.

---

### User Story 2 - Switch ID type and format options (Priority: P1)

A developer needs a specific kind of identifier — a time-ordered UUID v7 for a database primary
key, a ULID for a sortable event log, or a short NanoID for a URL slug — and configures the
generator accordingly.

**Why this priority**: Different ID types solve different real problems; without type selection
the tool only covers one of several common cases developers actually hit.

**Independent Test**: Switch the type selector from UUID v4 to ULID — the displayed ID
immediately regenerates as a valid 26-character Crockford-base32 ULID. Switch to NanoID and
change its length from 21 to 10 — the ID regenerates at the new length.

**Acceptance Scenarios**:

1. **Given** the type selector, **When** the user picks UUID v4, UUID v7, ULID, or NanoID,
   **Then** a new ID of that type is generated and the format-options panel updates to show only
   the options relevant to that type.
2. **Given** UUID is selected, **When** the user toggles "Uppercase" or "Hyphens", **Then** the
   displayed ID re-renders in that casing/format without generating a new value (a pure format
   change on the existing ID).
3. **Given** NanoID is selected, **When** the user changes the length (1–36) or picks an alphabet
   preset (URL-safe default, or alphanumeric-only), **Then** the next generated ID reflects the
   new length/alphabet.

---

### User Story 3 - Bulk-generate a list of IDs (Priority: P1)

A developer needs 500 unique IDs to seed a test database and wants them all at once, ready to
copy or save as a file.

**Why this priority**: Bulk generation is the specific capability named in the backlog item and
the main differentiator from typing `uuidgen` one line at a time — it's the tool's headline
feature beyond the single-ID case.

**Independent Test**: Set count to 500, click "Generate Bulk" — a scrollable list of 500 IDs of
the selected type appears, each individually copyable; "Copy All" places all 500 (newline-
separated) on the clipboard; "Export" downloads them as a `.txt` file.

**Acceptance Scenarios**:

1. **Given** a count field (default 10), **When** the user enters a value between 1 and 10,000
   and clicks "Generate Bulk", **Then** that many unique IDs of the selected type render as a
   list, each with its own copy button.
2. **Given** a populated bulk list, **When** the user clicks "Copy All", **Then** every ID
   (newline-separated) is written to the clipboard and a toast confirms the count copied.
3. **Given** a populated bulk list, **When** the user clicks "Export", **Then** a `.txt` file
   downloads containing one ID per line, no browser network request involved.
4. **Given** the count field, **When** the user enters `0`, a negative number, non-numeric text,
   or a value over 10,000, **Then** an inline error explains the valid range and "Generate Bulk"
   is disabled until corrected.

---

### User Story 4 - Inspect an ID's entropy and embedded timestamp (Priority: P2)

A developer evaluating which ID scheme to use (or debugging a sorting/collision question) wants
to see how much true randomness a given type provides, and — for time-ordered types — what
timestamp is actually encoded inside a specific ID.

**Why this priority**: This is the "entropy inspection" capability named in the backlog item. It
is a secondary, evaluative feature layered on top of the P1 generation flows, not required for
the tool to be useful day-to-day.

**Independent Test**: With UUID v7 selected, the entropy panel shows "74 bits of randomness
(128-bit total, 48-bit timestamp)" and decodes the currently displayed ID's timestamp to a
human-readable date-time matching when it was generated (within the same second).

**Acceptance Scenarios**:

1. **Given** any selected ID type and its current format options, **When** the entropy panel
   renders, **Then** it shows the true random bit-count for that exact configuration (varies for
   NanoID by length/alphabet; fixed for UUID v4/v7/ULID).
2. **Given** UUID v7 or ULID is selected, **When** an ID is displayed, **Then** the panel decodes
   and shows that ID's embedded creation timestamp in both ISO 8601 and relative ("just now")
   form.
3. **Given** UUID v4 or NanoID is selected (no embedded timestamp), **When** the panel renders,
   **Then** it states plainly that this type carries no timestamp, rather than showing a
   misleading blank or zero value.

---

### Edge Cases

- **Bulk count out of range or non-numeric**: rejected inline (US3 scenario 4) — no partial
  generation, no request sent, no frozen tab from an accidental huge number.
- **`crypto.getRandomValues` unavailable** (very old/non-standard browser): the tool detects this
  on load and shows a clear "This browser doesn't support secure random generation" message
  instead of silently falling back to `Math.random()`, which would produce IDs with no real
  security guarantee.
- **Clipboard write denied** (browser permission or non-secure context): a toast reports the
  copy failed rather than silently doing nothing; the ID remains selectable/visible so the user
  can copy it manually.
- **NanoID length at the extremes** (1 or 36): still generates; the entropy panel reflects the
  resulting (very low or very high) bit count rather than enforcing an arbitrary minimum.
- **Re-selecting the same ID type**: still generates a fresh value (idempotent action, not a
  no-op), since a developer clicking "Generate" always expects a new ID.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST generate a valid ID of the selected type immediately on page load,
  with no user action required to see a first result.
- **FR-002**: The system MUST support four ID types: UUID v4 (random), UUID v7 (Unix-timestamp-
  ordered), ULID (Crockford base32, timestamp-ordered), and NanoID (URL-safe random).
- **FR-003**: The system MUST let the user generate a new single ID of the current type on
  demand.
- **FR-004**: The system MUST let the user bulk-generate between 1 and 10,000 IDs of the current
  type in one action, rendered as an individually-copyable list.
- **FR-005**: The system MUST provide a "Copy All" action that places every ID in the current
  bulk list on the clipboard, newline-separated.
- **FR-006**: The system MUST provide an "Export" action that downloads the current bulk list as
  a plain-text file, one ID per line.
- **FR-007**: For UUID, the system MUST support uppercase/lowercase casing and with/without
  hyphens, applied to the currently displayed value without requiring regeneration.
- **FR-008**: For NanoID, the system MUST support a configurable length (1–36, default 21) and a
  choice of alphabet preset (URL-safe default `A-Za-z0-9_-`, or alphanumeric-only), applied on
  the next generation.
- **FR-009**: The system MUST display an entropy panel reporting the true random bit-count for
  the current type/options combination.
- **FR-010**: For UUID v7 and ULID, the system MUST decode and display the embedded creation
  timestamp of the currently displayed ID.
- **FR-011**: All ID generation MUST run entirely client-side via `crypto.getRandomValues` (or
  equivalent CSPRNG); the tool MUST make zero network requests to generate, inspect, or export
  IDs.
- **FR-012**: The system MUST NOT persist generated IDs to DevDB, `localStorage`, or any other
  storage — the tool is stateless, matching the Base64/Regex/JSON/YAML/Diff-Checker precedent
  (SPEC §8's session-gating applies only to DevDB-backed tools, which this is not).
- **FR-013**: The system MUST detect the absence of a secure random source at load time and
  disable generation with an explicit message, rather than silently degrading to a non-
  cryptographic fallback.

### Key Entities

- **Generated ID**: `{value, type, generatedAt}` — a single ID string plus which type produced
  it and a client-side timestamp of generation (for the "just now" relative display); exists
  only in page memory.
- **ID Type Config**: `{type, label, entropyBits, hasEmbeddedTimestamp, formatOptions}` — static
  per-type metadata driving the format-options panel and the entropy/timestamp displays (e.g.
  UUID v4: 122 bits, no timestamp; UUID v7: 74 random bits of 128 total, 48-bit timestamp; ULID:
  80 random bits of 128 total, 48-bit timestamp; NanoID: `length × log2(alphabet size)`, no
  timestamp).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user sees a valid, ready-to-copy ID within 1 second of the page finishing load,
  with zero clicks.
- **SC-002**: A user can generate 1,000 IDs and copy all of them to the clipboard in under 10
  seconds of total interaction (enter count, click Generate Bulk, click Copy All).
- **SC-003**: 100% of generated IDs pass format validation for their declared type (UUID v4/v7
  per RFC 9562, ULID per the Crockford base32 spec, NanoID per its published alphabet/length
  rules) — verified by an automated test suite.
- **SC-004**: Zero network requests occur during any generate, inspect, copy, or export action —
  verified via browser devtools / network-request assertions in tests.
- **SC-005**: The entropy panel's reported bit-count for every type/option combination matches
  the mathematically correct value for that configuration, verified by an automated test suite
  covering each type and NanoID's length/alphabet variants.

## Assumptions

- **NanoID replaces CUID (deviation from BACKLOG.md FEAT-2 wording)**: CUID's collision
  resistance relies on a per-process counter and/or host fingerprint intended for coordinated,
  server-side generation across a fleet — DevSuite has no shared server-side state across
  sessions (SPEC's "opaque, client-encrypted, single local install" model) and generating CUIDs
  without that coordination would misrepresent their actual guarantees. NanoID is a well-known,
  purely-random, client-side-safe short-ID scheme that serves the same "compact unique ID" need
  the backlog item was reaching for. Flagged explicitly per this project's "verify against
  source, flag discrepancies" rule (CLAUDE.md rule 2) — `BACKLOG.md` FEAT-2's wording should be
  read as superseded by this spec once implemented.
- **Stateless, no auth-guard**: this tool holds no secrets and needs no persistence, so — like
  Base64 Encoder, Regex Tester, JSON/YAML Linter, and Diff Checker — it does NOT sit behind
  `auth-guard.js`'s DevDB session gate, unlike Vault/API Tester/DB Manager/SSH Terminal.
- **10,000 bulk-count upper bound**: a reasonable default balancing real seeding/testing needs
  against the risk of an accidental huge input freezing the tab; not specified numerically in
  the backlog item.
- **Namespace-based UUIDs (v1/v3/v5) are out of scope for v1**: they require additional inputs
  (a namespace UUID and a name string) that don't fit the "instant random ID" flow this tool is
  built around; v4/v7 cover the overwhelming majority of "give me a unique ID" use cases. May be
  revisited as a future extension to this same spec folder if requested.
- **No import/validate-existing-ID flow in v1**: the tool generates IDs; parsing/validating an
  arbitrary pasted ID against a type's format is a plausible future extension but not required
  to satisfy the backlog item's "bulk generate... with entropy inspection" scope.
