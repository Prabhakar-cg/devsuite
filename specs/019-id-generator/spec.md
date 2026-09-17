# Feature Specification: ID Generator

**Feature Branch**: `019-id-generator`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "ID Generator (BACKLOG FEAT-2): Bulk generate UUIDs, ULIDs, and CUIDs with entropy inspection. DevSuite's 14th tool. Pure client-side, no backend, no master-password gate — same unauthenticated tier as Diff/Data Format Linter/Regex/Cron. Vanilla HTML/CSS/JS, no new third-party libs; use the browser's Web Crypto `crypto.getRandomValues` for all randomness."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a batch of identifiers of a chosen type (Priority: P1)

A developer opens the ID Generator, picks an identifier type (e.g. UUID v4), sets how many to generate, clicks Generate, and gets that many freshly-generated identifiers listed on screen, ready to copy.

**Why this priority**: This is the minimum viable slice — the entire point of the tool is producing valid identifiers on demand. Without it there is no tool. It is also the most frequent use: "give me an ID (or a handful) I can paste somewhere."

**Independent Test**: Load the tool, select UUID v4, set count to 10, click Generate, and confirm exactly 10 syntactically valid, distinct UUID v4 strings appear — without using copy, entropy, or any other feature.

**Acceptance Scenarios**:

1. **Given** the tool is open with UUID v4 selected and a count of 1, **When** the user clicks Generate, **Then** exactly one string matching the UUID v4 format (`xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx`, hex) is shown.
2. **Given** a count of 50 and any supported type, **When** the user clicks Generate, **Then** exactly 50 identifiers are listed and, for random types, all 50 are distinct.
3. **Given** a previous batch is on screen, **When** the user generates again, **Then** the new batch replaces the old one rather than appending indefinitely (no unbounded growth).
4. **Given** the user switches the selected type (e.g. UUID v4 → ULID), **When** they click Generate, **Then** the output matches the newly-selected type's format.

---

### User Story 2 - Copy generated identifiers for use elsewhere (Priority: P2)

Having generated a batch, the user copies a single identifier, or the whole batch, to the clipboard so they can paste it into code, a database, or a config file.

**Why this priority**: Generation is only useful if the result can leave the tool. Copy is the bridge from "generated" to "used." Slightly lower than P1 because a user could still select text manually, but one-click copy is the expected ergonomic.

**Independent Test**: With a batch already generated (per User Story 1), click the per-row copy control on one identifier and confirm the clipboard holds exactly that identifier; click "Copy all" and confirm the clipboard holds all identifiers, one per line.

**Acceptance Scenarios**:

1. **Given** a generated batch, **When** the user clicks the copy control on a single row, **Then** that exact identifier (and nothing else) is placed on the clipboard and the user gets visible confirmation.
2. **Given** a generated batch of N identifiers, **When** the user clicks "Copy all", **Then** all N identifiers are placed on the clipboard separated by newlines, in the displayed order.
3. **Given** the clipboard API is unavailable or denied by the browser, **When** the user attempts a copy, **Then** they are told the copy did not succeed rather than being led to believe it did.

---

### User Story 3 - Inspect the entropy and structure of a generated identifier (Priority: P3)

For a selected identifier type, the user sees how many bits of randomness it carries and — for time-based types — which portion is a timestamp versus random, so they can judge collision resistance and sortability before adopting it.

**Why this priority**: Entropy inspection is the differentiator called out in the backlog ("with entropy inspection") and turns a plain generator into a decision aid. It is P3 because the core generate/copy loop already delivers value without it.

**Independent Test**: Select each supported type in turn and confirm the tool reports that type's random-bit count (e.g. 122 bits for UUID v4) and, for ULID/UUID v7, identifies the timestamp component — with no generation required to see the per-type facts.

**Acceptance Scenarios**:

1. **Given** UUID v4 is selected, **When** the user views the entropy panel, **Then** it reports 122 bits of randomness (128 total minus 6 fixed version/variant bits).
2. **Given** ULID is selected, **When** the user views the entropy panel, **Then** it reports 80 bits of randomness plus a 48-bit millisecond timestamp, and notes that ULIDs are lexicographically sortable by creation time.
3. **Given** a time-based identifier (ULID or UUID v7) has been generated, **When** the user inspects a specific generated value, **Then** the tool decodes and shows the embedded creation timestamp as a human-readable date/time.

---

### Edge Cases

- A count of 0, an empty count, a negative number, or a non-numeric count is rejected with a clear inline message; nothing is generated and the previous batch (if any) is left intact.
- A count above the enforced maximum (see FR-011) is rejected with a clear message stating the cap, rather than freezing the tab attempting to render an unbounded list.
- Generating in a browser without `crypto.getRandomValues` (Web Crypto) available shows a clear "secure randomness unavailable" message and refuses to generate rather than silently falling back to `Math.random()`.
- Copy is attempted in a context where the clipboard is blocked (e.g. insecure context / permission denied): the user is notified of failure (per US2), not shown a false success.
- Switching identifier type while a batch is on screen updates the entropy panel to the new type immediately, even before the next Generate.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let the user choose an identifier type from a fixed set: UUID v4 (random), UUID v7 (time-ordered), ULID, CUID2, and NanoID.
- **FR-002**: System MUST let the user specify how many identifiers to generate in a single batch, defaulting to a sensible small value (e.g. 10).
- **FR-003**: System MUST generate exactly the requested count of identifiers of the selected type when the user requests generation.
- **FR-004**: System MUST produce identifiers that conform to the selected type's published format (UUID v4/v7 per RFC 9562, ULID per the ULID spec, CUID2 and NanoID per their reference definitions).
- **FR-005**: System MUST derive all randomness from a cryptographically secure source (`crypto.getRandomValues`), and MUST NOT fall back to a non-cryptographic PRNG such as `Math.random()`.
- **FR-006**: For random identifier types, all identifiers within a single generated batch MUST be distinct.
- **FR-007**: Users MUST be able to copy any single generated identifier to the clipboard with one action.
- **FR-008**: Users MUST be able to copy the entire generated batch to the clipboard at once, one identifier per line, in displayed order.
- **FR-009**: System MUST give visible confirmation on a successful copy and a distinct, visible failure message when a copy does not succeed.
- **FR-010**: System MUST display, per selected type, its total bit length, its bits of randomness, and (for time-based types) the size and meaning of its timestamp component and whether it is time-sortable.
- **FR-011**: System MUST enforce an upper bound on batch count (to protect the browser tab) and reject requests above it with a message naming the cap; the default cap is 1000.
- **FR-012**: System MUST reject invalid counts (zero, negative, non-numeric, blank) with a clear inline message and MUST leave any previously-generated batch unchanged when it does so.
- **FR-013**: For time-based identifiers (ULID and UUID v7), system MUST be able to decode a generated value and present its embedded creation timestamp in a human-readable form.
- **FR-014**: System MUST operate entirely client-side with no network requests and no persistence of generated identifiers to any store (DevDB, localStorage, sessionStorage, or disk).
- **FR-015**: System MUST be reachable without unlocking the suite's master password, consistent with the other non-sensitive tools.
- **FR-016**: System MUST be discoverable from the suite's tool listing (tools grid) and homepage, alongside the other tools.
- **FR-017**: System MUST render all generated identifiers and messages as text (never via `innerHTML` with generated content), consistent with the suite's DOM-hardening rule.

### Key Entities *(include if feature involves data)*

- **Identifier Type**: A named format the tool can produce (UUID v4, UUID v7, ULID, CUID2, NanoID). Carries static, type-level facts: total bit length, random-bit count, whether it embeds a timestamp, and whether it is lexicographically time-sortable. Purely descriptive — not persisted.
- **Generated Batch**: The transient, in-memory list of identifiers produced by one Generate action. Has an ordered list of identifier strings and the type they were generated as. Replaced wholesale on the next Generate; never stored.
- **Entropy Report**: A derived, display-only summary for the currently selected Identifier Type — total bits, random bits, timestamp component (if any), and sortability note. Computed from the type, not stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can produce a batch of valid identifiers of any supported type in under 5 seconds from opening the tool, with no configuration beyond count and type.
- **SC-002**: 100% of generated identifiers pass format validation for their declared type (verified by regex/structural checks in the JS unit suite across all five types).
- **SC-003**: Across a generated batch of 1000 random-type identifiers, 0 duplicates occur in repeated manual and automated runs.
- **SC-004**: 100% of invalid count inputs (0, negative, blank, non-numeric, over-cap) produce a clear message and leave any prior batch unchanged, with nothing generated.
- **SC-005**: For every supported type, the entropy panel shows a random-bit count that matches the type's specification (e.g. UUID v4 → 122 bits, ULID → 80 random + 48 timestamp).
- **SC-006**: A time-based identifier's decoded timestamp is within acceptable rounding of the actual generation time (same millisecond for the encoded value) in 100% of manual verification passes.
- **SC-007**: A new user can find the ID Generator from the suite's main tool listing without being told where to look.

## Assumptions

- Single-user, local-first usage matches the rest of the suite; generated identifiers are ephemeral working data, not sensitive content, so the tool sits outside the master-password-gated tier (like Diff Checker / Data Format Linter / Regex Tester / Cron Visualizer).
- The target environment is a modern browser served over the loopback (`localhost`/`127.0.0.1`), which the suite already treats as a secure context — so `crypto.getRandomValues` and the async Clipboard API are available; the spec still defines graceful failure if either is absent (FR-005 edge case, FR-009).
- No new third-party JavaScript libraries are introduced. UUID/ULID/CUID2/NanoID generation is small, well-specified, and implemented in a vanilla pure-JS module, consistent with the constitution's "vanilla stack, no runtime CDN, self-host all JS" principle and avoiding a new `UPGRADE_PLAN.md`/SPEC §11 dependency entry.
- CUID2 and NanoID use their reference default alphabets and lengths (CUID2 default length 24; NanoID default length 21 over the URL-safe alphabet). Custom alphabets/lengths are out of scope for v1.
- Bulk export to a file, history of past batches, and QR-code rendering are out of scope for v1; the copy-to-clipboard flow (US2) is the sole extraction path. Export is already served by the user's own paste target.
- "Bulk generate ... CUIDs" in the backlog is satisfied by CUID2, the current, actively-maintained successor to the deprecated original CUID; the original CUID v1 is intentionally not implemented.
