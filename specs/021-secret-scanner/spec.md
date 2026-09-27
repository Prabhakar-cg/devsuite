# Feature Specification: Secret Scanner

**Feature Branch**: `021-secret-scanner`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "Secret Scanner (BACKLOG AI-1 + AI-2): a client-side tool with two modes sharing one detection engine. Paste-box mode: a developer pastes arbitrary text (agent session logs, `.env` contents, shell history, git diffs, MCP config JSON) and the tool runs local regex + Shannon-entropy detection for common secret shapes (AWS keys, GitHub tokens, OpenAI/Anthropic API keys, JWTs, PEM private-key headers, generic high-entropy key-like assignments), highlighting each match with type, confidence, and location. MCP-config-aware mode: when the input parses as an MCP server manifest (`mcpServers` → `command`/`args`/`env`), flags any `env` value that looks like a literal secret rather than a `${VAR}`/`$VAR` reference, and offers a one-click 'move to Secret Vault, replace with a reference' fix — the exact pattern behind GitGuardian's 2026 finding of 24,008 secrets in public MCP config files. Local-only: nothing pasted is ever transmitted off the machine. DevSuite's 16th tool."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Paste text and see flagged secrets (Priority: P1)

A developer pastes arbitrary text — an agent session log, a `.env` file, a shell history excerpt, a git diff — into the tool and immediately sees which lines contain something that looks like a live credential, with the type of secret, a redacted preview, and its line/column location.

**Why this priority**: This is the tool's entire reason to exist. Without it there is no MVP — a developer with a suspicious block of text and nowhere to safely check it before pasting it into a PR, a support ticket, or a shared log.

**Independent Test**: Paste a block of text containing one embedded AWS-style access key and unrelated surrounding prose, and confirm the key is flagged with its type, a redacted preview, and correct line number, while the surrounding prose produces no matches.

**Acceptance Scenarios**:

1. **Given** pasted text containing a recognizable secret shape (AWS access key, GitHub token, OpenAI/Anthropic API key, JWT, or PEM private-key header), **When** the scan runs, **Then** each instance appears in a results list with its detected type, a redacted preview (not the full raw value), a confidence level, and its line/column location.
2. **Given** pasted text containing no recognizable secret shapes, **When** the scan runs, **Then** the tool clearly reports zero findings rather than showing an empty, ambiguous results area.
3. **Given** pasted text containing a long non-secret high-entropy string (e.g. a base64-encoded image fragment, a UUID), **When** the scan runs, **Then** it is either not flagged or flagged only at low confidence, distinguishable from a high-confidence pattern match.
4. **Given** the user edits the pasted text after an initial scan, **When** they re-run the scan (or it re-runs live), **Then** the results list updates to reflect only what is currently in the text box — no stale findings from the previous paste linger.
5. **Given** a found secret's redacted preview, **When** the user chooses to reveal it, **Then** the full value is shown only after that explicit action, never by default.

---

### User Story 2 - Detect leaked secrets in an MCP server manifest (Priority: P1)

A developer pastes (or uploads) the contents of an `.mcp.json` / `claude_desktop_config.json`-shaped file. The tool recognizes the `mcpServers` structure and, for every server entry's `env` block, flags any value that is a literal secret rather than a reference to a real environment variable (`${VAR}`, `$VAR`, or an empty/placeholder value) — surfacing exactly the failure pattern that put 24,008 secrets into public MCP config files in 2026.

**Why this priority**: MCP config files are the specific, current, high-volume leak vector this tool is built to address; without manifest-aware detection this is just a generic secret grep, not a response to the actual documented problem. Ships alongside US1 as part of the same MVP.

**Independent Test**: Paste an `.mcp.json`-shaped document with one server whose `env` block has a literal API key and another whose `env` block references `${OPENAI_API_KEY}`, and confirm only the literal value is flagged, tagged with the server name and env variable name it belongs to.

**Acceptance Scenarios**:

1. **Given** pasted text that parses as a valid `mcpServers` manifest, **When** the scan runs, **Then** the tool switches into manifest-aware mode and reports findings per server name and env variable name, in addition to (not instead of) the generic paste-box scan.
2. **Given** an `env` entry whose value is a variable reference (`${FOO}`, `$FOO`) or empty, **When** the scan runs, **Then** it is not flagged as a literal secret.
3. **Given** an `env` entry whose value is a literal string matching a known secret shape or high entropy, **When** the scan runs, **Then** it is flagged with the owning server name and variable name shown alongside the finding.
4. **Given** pasted text that is syntactically invalid JSON or does not match the `mcpServers` shape, **When** the scan runs, **Then** the tool falls back to generic paste-box scanning (US1) without an error that blocks the user.
5. **Given** a manifest with multiple servers each defining the same variable name (e.g. two servers both using `API_KEY`), **When** findings are shown, **Then** each finding is attributable to its own server, not merged or ambiguous.

---

### User Story 3 - Move a flagged manifest secret into the Secret Vault (Priority: P2)

For a finding surfaced in manifest-aware mode (US2), the developer clicks a "Move to Vault" action on that finding. The literal value is stored as a new Secret Vault entry and the finding's suggested replacement text uses a vault reference instead of the literal value, so the developer can copy the corrected manifest back out.

**Why this priority**: This turns detection into remediation, which is the highest-value follow-through — but it depends on US2 already existing and on the separate Secret Vault feature's unlock state, so it is P2 rather than part of the MVP.

**Independent Test**: With the Secret Vault already unlocked in the same browser session, trigger "Move to Vault" on one flagged manifest finding, then confirm a new Vault entry now holds that exact value and the on-screen corrected manifest text no longer contains the literal secret.

**Acceptance Scenarios**:

1. **Given** the Secret Vault is unlocked in the current session, **When** the user clicks "Move to Vault" on a manifest finding, **Then** a new Vault entry is created holding that literal value, and the tool shows the manifest with that value replaced by a placeholder reference.
2. **Given** the Secret Vault is locked or no master password has been set up yet, **When** the user clicks "Move to Vault", **Then** the tool clearly explains that the Vault must be unlocked first and offers a path to do so, without silently failing or losing the finding.
3. **Given** a "Move to Vault" action has just completed, **When** the user looks at the finding, **Then** it is visibly marked as remediated so it is not mistaken for a still-open finding.
4. **Given** the user has not clicked "Move to Vault", **When** they copy the manifest text shown on screen, **Then** it is byte-for-byte the original pasted text — the tool never silently rewrites input the user did not ask it to change.

---

### Edge Cases

- Empty input: the tool shows a neutral "nothing to scan yet" state, not zero-findings-as-if-scanned.
- Extremely large paste (multiple megabytes, e.g. a full agent session transcript): scanning stays responsive rather than freezing the tab; a large-input warning or size cap is acceptable.
- A secret-shaped string that is an obvious placeholder/example (e.g. `sk-xxxxxxxxxxxxxxxxxxxxxxxx`, `AKIAIOSFODNN7EXAMPLE`) may still be flagged — the tool does not need to be perfect at excluding documentation examples, but a redacted-preview + confidence level lets the user quickly dismiss them.
- A value that is a shell/path expansion unrelated to secrets (e.g. `$HOME/.config`) in an `env` block is not flagged as a literal secret merely for containing `$`.
- A manifest with a deeply nested or malformed `mcpServers` structure (e.g. `env` is not an object) degrades to generic scanning rather than crashing.
- Pasting content that itself contains HTML/script-like text: rendered as inert text in the results view, never interpreted as markup.
- Re-scanning after clearing the text box: results list clears too, with no leftover findings.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let the user paste or type arbitrary text into an input area and trigger a scan of that text.
- **FR-002**: System MUST detect, at minimum, the following secret shapes in scanned text: AWS access keys, GitHub tokens, OpenAI API keys, Anthropic API keys, JWTs, PEM private-key headers, and generic high-entropy strings assigned to key-like variable names.
- **FR-003**: For each finding, the system MUST report the detected type, a redacted preview of the value, a confidence level, and the line/column location within the scanned text.
- **FR-004**: System MUST NOT display a finding's full unredacted value unless the user takes an explicit reveal action for that specific finding.
- **FR-005**: System MUST report a clear "no findings" state when a scan produces no matches, distinct from an empty/unscanned state.
- **FR-006**: System MUST re-run (or clearly prompt the user to re-run) the scan whenever the input text changes, and MUST NOT show findings that no longer correspond to the current input text.
- **FR-007**: System MUST detect when scanned text parses as an MCP server manifest (a `mcpServers` object whose entries carry `command`/`args`/`env`) and, when it does, additionally evaluate each `env` entry.
- **FR-008**: For manifest-aware evaluation, the system MUST NOT flag an `env` value that is a variable reference (`${VAR}` or `$VAR` form) or empty as a literal secret.
- **FR-009**: For manifest-aware evaluation, the system MUST flag an `env` value matching a known secret shape or high entropy as a literal secret, tagged with the owning server name and variable name.
- **FR-010**: When scanned text does not parse as a valid MCP manifest, the system MUST fall back to generic scanning (FR-001–FR-006) without blocking the user with an error.
- **FR-011**: Users MUST be able to trigger a "Move to Vault" action on a manifest-aware finding, which creates a new Secret Vault entry holding the literal value and marks the finding as remediated.
- **FR-012**: The system MUST require the Secret Vault to be unlocked for the current session before "Move to Vault" can complete, and MUST give the user a clear path to unlock it if it is not, consistent with how the Vault gates its own write operations elsewhere in the suite.
- **FR-013**: The system MUST NOT modify the user's original pasted text as a side effect of scanning or of a "Move to Vault" action; any corrected manifest text is shown as a separate, explicitly-requested output.
- **FR-014**: System MUST perform all scanning and detection entirely client-side; the scanned text MUST NOT be transmitted to the DevSuite backend or to any network endpoint at any point.
- **FR-015**: System MUST render all scanned text and finding previews as text (via DOM text APIs), never via `innerHTML` with content derived from the scanned input.
- **FR-016**: System MUST be reachable without unlocking the suite's master password for scanning itself (only the "Move to Vault" action in FR-011/FR-012 requires an unlocked Vault session).
- **FR-017**: System MUST be discoverable from the suite's tool listing and homepage, alongside the other tools.
- **FR-018**: System MUST remain usable (scan completes and results render) for pasted input up to at least 1 MB without the tab becoming unresponsive.
- **FR-019**: System MUST use only stroke-based inline SVG for any status/finding-type icons, consistent with the suite's no-emoji UI rule.

### Key Entities *(include if feature involves data)*

- **Scan Input**: The raw text currently in the paste box. Held only in page memory for the duration of the session; never persisted to DevDB, `localStorage`, or the backend, and never transmitted over the network.
- **Finding**: One detected secret from a scan. Has a type (one of the supported shapes or "generic high-entropy"), a confidence level, a redacted preview, a line/column location, and — in manifest-aware mode — the owning server name and env variable name. Exists only in memory; recomputed on every scan.
- **MCP Manifest (parsed)**: The structured interpretation of Scan Input when it matches the `mcpServers` shape — a map of server name to its `command`/`args`/`env`. Derived transiently from Scan Input; not persisted separately.
- **Vault Reference** *(existing entity, not redefined here)*: The Secret Vault entry created by "Move to Vault" (FR-011). This feature only writes to that existing store through its existing client-side encryption boundary; it introduces no new persisted entity of its own.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer pasting a block of text containing one embedded known-shape secret sees it flagged, with type and location, within 1 second of the scan running, on a typical (< 100 KB) paste.
- **SC-002**: Across a representative test corpus covering all seven supported secret shapes (FR-002), 100% produce at least one finding.
- **SC-003**: Across a representative test corpus of non-secret high-entropy strings (UUIDs, base64 image fragments, hashes), none are reported at the tool's highest confidence level.
- **SC-004**: Given a test MCP manifest with a mix of literal-secret and variable-reference `env` entries, 100% of literal-secret entries are flagged and 0% of variable-reference or empty entries are flagged.
- **SC-005**: Completing "Move to Vault" on a finding results in the exact original value being retrievable from the Secret Vault afterward, verified end-to-end.
- **SC-006**: No network request of any kind is issued as a result of scanning, for any input, verified by an automated check that the detection module makes no network calls.
- **SC-007**: A new user can find the Secret Scanner from the suite's main tool listing without being told where to look.
- **SC-008**: Pasting a 1 MB block of text and scanning it keeps the tab responsive (no dropped frames beyond a brief, bounded scan pause) in manual testing.

## Assumptions

- Detection is pattern/entropy-based (regex plus a Shannon-entropy heuristic on candidate strings), not a lookup against any live provider — this is the same class of technique used by established offline scanners (gitleaks, detect-secrets) and requires no network access, keeping the feature inside the local-only, offline-first constitution (Principle II).
- The tool is reachable without unlocking the suite's master password (an "ungated" tier like Cron Visualizer/Regex Tester/WebSocket Tester), because the scan input is transient, in-memory-only, and never persisted; only the optional "Move to Vault" action touches the gated Secret Vault.
- No new third-party JavaScript dependency is introduced; regex and entropy calculation are implemented directly, consistent with the suite's vanilla-stack principle (Principle III) and its pattern of pure, node-testable modules (`curl-codegen.js`, `cookie-jar.js`, `collection-utils.js`).
- File upload as an alternative to pasting is a reasonable future extension but out of scope for v1 — v1 accepts pasted/typed text only.
- Reducing false positives on obvious documentation placeholders (e.g. AWS's own `EXAMPLE` key suffix convention) is a nice-to-have refinement, not a hard requirement; the redacted-preview-plus-confidence-level design (FR-003/FR-004) gives users a fast way to dismiss such cases manually.
- This spec covers detection and manifest-aware remediation only (BACKLOG AI-1 + AI-2). The token/cost estimator (AI-3), a general JSON Schema validator (AI-4), and a broader agent-config linter (AI-5) are explicitly out of scope here, though AI-4/AI-5 may later reuse this feature's detection engine as a shared module.
- Shipping this tool brings the suite to 16 tools; updating the tool-count references (`constitution.md`, `specs/SPEC.md`, `static/tools.html`, `static/home.html`) from 15 to 16 is deferred to the implementation/ship step, not done as part of this spec.
