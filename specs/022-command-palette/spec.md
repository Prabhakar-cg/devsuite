# Feature Specification: Command Palette

**Feature Branch**: `022-command-palette`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "A global Cmd/Ctrl+K command palette available on every DevSuite page (home, tools hub, and all 15 tools, including a tool's lock screen before it's unlocked) that lets a developer jump straight to any tool by typing part of its name, category, or a keyword, without clicking back to the Tools Hub first. Also reachable via a small visible trigger in the header, for discoverability. Navigation-only in v1 — no per-tool quick actions, no content search."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Jump to any tool from anywhere via keyboard (Priority: P1)

A developer is deep inside one tool (say, Regex Tester) and wants to switch to another (say, Secret Vault) without clicking back to the Tools Hub and scanning for the right card. They press Cmd+K (or Ctrl+K), the palette opens instantly over whatever page they're on, and pressing Enter on the highlighted entry takes them straight there.

**Why this priority**: This is the entire reason the feature exists — the "click back to hub, scan 15 cards, click the right one" flow is exactly what a keyboard-first developer wants to skip. Without instant, from-anywhere invocation there is no product.

**Independent Test**: From any tool page, press Cmd/Ctrl+K, confirm the palette opens with the full list of destinations visible and the first entry highlighted, press Enter, and confirm the browser navigates to that entry's page.

**Acceptance Scenarios**:

1. **Given** any DevSuite page is loaded (home, tools hub, or any of the 15 tools), **When** the user presses Cmd+K (macOS) or Ctrl+K (other platforms), **Then** the command palette opens as a centered overlay with a text input focused and ready for typing.
2. **Given** the palette is open, **When** the user presses the Down/Up arrow keys, **Then** the highlighted entry moves accordingly, wrapping at the top/bottom of the list.
3. **Given** an entry is highlighted, **When** the user presses Enter, **Then** the browser navigates to that entry's page and the palette closes.
4. **Given** the palette is open, **When** the user presses Escape, **Then** the palette closes and the page underneath is unchanged (no navigation).
5. **Given** the user is on a tool's lock screen (master password not yet entered), **When** they press Cmd/Ctrl+K, **Then** the palette still opens and can navigate away — the palette never requires the suite's master password.
6. **Given** the palette is already open, **When** the user presses Cmd/Ctrl+K again, **Then** the palette does not open a second time or break (either it stays open as-is or toggles closed — behavior must be consistent, not glitchy).

---

### User Story 2 - Narrow the list by typing (Priority: P1)

While the palette is open, the developer types part of what they're looking for — a tool's name, its category, or a related keyword like "uuid" or "jwt" — and the list narrows live to just the matching entries, with the first match highlighted.

**Why this priority**: With 17 destinations (15 tools + Home + Tools Hub), arrow-keying through the full unfiltered list defeats the speed advantage over just clicking the hub. Filtering is inseparable from User Story 1 for a usable MVP — both ship together.

**Independent Test**: Open the palette, type "uuid", and confirm only ID Generator remains in the list (matched via keyword, not its literal name), with it highlighted and ready for Enter.

**Acceptance Scenarios**:

1. **Given** the palette is open with the input empty, **When** the user types characters, **Then** the list updates after every keystroke to show only entries whose name, category, or keywords contain the typed text (case-insensitive).
2. **Given** typed text matches no entry, **When** the list would be empty, **Then** the palette shows a clear "no matches" state instead of a blank list.
3. **Given** a filtered list with matches, **When** the user clears the input (e.g., selects all and deletes), **Then** the full 17-entry list reappears.
4. **Given** the user types a keyword that isn't part of a tool's display name (e.g., "jwt" for Crypto Suite, "ulid" for ID Generator), **When** the list filters, **Then** the relevant tool still appears, because matching also checks each entry's keyword list, not just its displayed name.
5. **Given** a filtered list, **When** the user presses arrow keys, **Then** highlighting moves within the *filtered* results only, never landing on a hidden entry.

---

### User Story 3 - Discover and open the palette without knowing the shortcut (Priority: P2)

A developer who doesn't yet know the keyboard shortcut notices a small, consistently-placed control in the page header, clicks it, and the palette opens exactly as it would from the keyboard shortcut.

**Why this priority**: Keyboard shortcuts are invisible until learned. A purely keyboard-only feature would be undiscoverable to new users of the suite, undermining the "reachable from anywhere" goal — but the palette is still fully functional via keyboard alone without this, so it's P2, not part of the P1 MVP.

**Independent Test**: On a page the user has never used the shortcut on, locate the visible trigger control in the header, click it, and confirm the palette opens identically to the keyboard shortcut path.

**Acceptance Scenarios**:

1. **Given** any DevSuite page, **When** the user looks at the page header, **Then** a small control indicating "search/jump to a tool" is visible, including a hint of the keyboard shortcut.
2. **Given** the user clicks that control, **When** the click registers, **Then** the palette opens identically to pressing Cmd/Ctrl+K.
3. **Given** the control is present on a page with an unrelated header layout (e.g., the homepage's marketing nav vs. a tool page's compact toolbar), **When** the page renders, **Then** the control does not visually collide with or crowd out existing header controls (theme picker, back link, status pill).

---

### Edge Cases

- The palette must not fight with a focused Monaco Editor instance (used in Diff, Data Linter, Notes, Roadmap): pressing Cmd/Ctrl+K while typing inside a Monaco editor must still open the palette, not get silently swallowed by the editor's own keybindings.
- Pressing Cmd/Ctrl+K while a *different* modal or dialog is already open on the page (e.g., Secret Vault's "New Secret" modal) should not open a second, overlapping overlay — the palette either ignores the shortcut in that state or the existing modal closes first; behavior must be consistent and non-broken, not undefined.
- Opening the palette must not alter or clear any unsaved state already on the page underneath it (e.g., partially-typed text in a tool's input) — it's a transient overlay, not a page navigation, until the user actually chooses an entry.
- Clicking the backdrop (outside the palette panel) closes the palette without navigating, same as Escape.
- The palette must render legibly in all 6 runtime themes (Noir, Midnight, Ocean, Solarized, Light, Hi-Contrast) and on the one page that doesn't load the runtime theme system (DevDB Manager) — it must not appear unstyled or illegible there.
- Very rapid open → type → Escape → reopen cycles must not leave the list in a stale filtered state from the previous session; each open starts from an empty, unfiltered input.
- The palette must be usable via keyboard alone with no pointer: Tab order, arrow-key navigation, and Enter/Escape must be sufficient to operate it end-to-end.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let the user open the command palette from any DevSuite page via a Cmd+K (macOS) / Ctrl+K (other platforms) keyboard shortcut.
- **FR-002**: System MUST also let the user open the command palette by clicking a visible trigger control present in the header of every page.
- **FR-003**: The command palette MUST be reachable and fully functional on a tool's pre-authentication lock screen — it MUST NOT require the suite's master password or any unlocked session to open or to navigate away.
- **FR-004**: When opened, the palette MUST show all 17 destinations (the 15 tools, Home, and the Tools Hub) with one destination highlighted by default, and MUST focus a text input ready for typing.
- **FR-005**: System MUST filter the visible list on every keystroke, matching the typed text case-insensitively against each destination's display name, category, and an associated list of extra search keywords.
- **FR-006**: When no destination matches the typed text, the system MUST show an explicit "no matches" state rather than an empty or ambiguous list.
- **FR-007**: Users MUST be able to move the highlighted selection up and down within the currently-visible (filtered) list using the arrow keys, wrapping from the last entry back to the first and vice versa.
- **FR-008**: Users MUST be able to navigate to the highlighted destination by pressing Enter, and to any visible destination by clicking it.
- **FR-009**: Users MUST be able to close the palette without navigating by pressing Escape or by clicking outside the palette panel (the backdrop).
- **FR-010**: Every time the palette is opened, it MUST start with an empty search input and the full, unfiltered destination list — no state carries over from a previous time it was opened.
- **FR-011**: The destination list MUST be sourced from a single definition consistent with the suite's actual routes (`routes/pages.py`) and the Tools Hub's own card list (`static/tools.html`) — it must not list a destination that doesn't exist or omit one of the 15 tools.
- **FR-012**: The system MUST render all destination names and the user's typed query using safe DOM text APIs (never `innerHTML` with the typed query), consistent with the suite's DOM-hardening rule.
- **FR-013**: The palette MUST render legibly on every page regardless of which of the suite's 6 runtime themes is active, and MUST remain legible on the one page that does not load the runtime theme system.
- **FR-014**: The command palette MUST be available on every current DevSuite page without requiring a per-page code change when a future tool is added — it is injected centrally, not hand-wired into each page.
- **FR-015**: System MUST NOT open a second, overlapping palette instance if the shortcut is pressed while the palette is already open.
- **FR-016**: The palette overlay, once open, MUST trap keyboard focus within it until closed (Tab cannot escape to the page behind it), and MUST restore focus sensibly to the page when closed without navigating.

### Key Entities

- **Destination**: One entry in the palette's list. Has a display name, a target route/URL, a category (matching the Tools Hub's existing categories: dev, data, security, network, time), and a small list of extra search keywords. Static, suite-defined data — not user-created, not persisted per-user, not fetched over the network.
- **Palette Session**: The transient open/closed state of the palette on the current page — the current search text and highlighted index. Exists only in memory while the palette is open; discarded (not remembered) when it closes, per FR-010.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From any DevSuite page, a developer can reach any of the other 16 destinations in 3 keystrokes or fewer beyond the shortcut itself (enough characters to uniquely match, plus Enter) — verified across a representative sample of destinations including ones with short and long names.
- **SC-002**: The palette opens in response to the keyboard shortcut on 100% of the suite's pages, including every tool's lock screen, in manual verification.
- **SC-003**: 100% of the 15 tools plus Home and Tools Hub are reachable from the palette — none missing, none pointing at a dead route.
- **SC-004**: A user who has never seen the feature before can discover and successfully use it via the visible header trigger alone, without being told the keyboard shortcut.
- **SC-005**: The palette is visually legible (readable text, distinguishable highlighted state) in all 6 runtime themes and on the one theme-system-free page, verified by manual check in each.
- **SC-006**: Typing a keyword that is not part of a tool's display name (e.g., "jwt") still surfaces the correct tool in the filtered results, in 100% of the keyword-to-tool mappings the feature ships with.

## Assumptions

- The palette is suite-wide chrome, not a 16th "tool" — it does not get a Tools Hub card, a tool-count increment, or its own auth gate. It is documented in `specs/SPEC.md` §9 (design system) as cross-cutting UI, the same tier as the theme picker or the toast system.
- `/base64` is intentionally excluded from the destination list: it is a legacy standalone route no longer surfaced as its own card on the Tools Hub (its functionality was folded into Crypto Suite's UI), so including it in the palette would let users navigate to a page the suite itself no longer treats as a first-class tool.
- "Text Diff" and "Folder Diff" are listed as two separate destinations (matching the Tools Hub's own two cards, both pointing at `/diff` with different query parameters), not merged into one — consistent with how the Hub already presents them.
- No backend API call is introduced for this feature: the destination list is static data shipped in the client-side module, not fetched from the server, keeping the feature fully consistent with the suite's local-only/offline-first principle and avoiding a new attack surface.
- The visible header trigger's exact placement/styling is an implementation decision for the plan phase; this spec only requires that it exists, is consistent across pages, and doesn't crowd existing header controls (Edge Cases, US3).
- Whether pressing the shortcut inside a focused Monaco Editor instance works reliably is flagged as an edge case to verify during implementation, not a scope decision — Monaco's own keybindings are a third-party behavior this spec doesn't control, but the requirement (FR-001 applying everywhere) still stands and must be validated against it.
- Mobile/touch layout is not a primary target (consistent with the rest of the suite, which is not spec'd for mobile use); the palette must simply not crash or become unusable on a narrow viewport, not be optimized for it.
