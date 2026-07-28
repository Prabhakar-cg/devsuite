# Feature Specification: Cron Visualizer

**Feature Branch**: `010-cron-visualizer`

**Created**: 2026-07-28

**Status**: Implemented (retroactive spec)

**Input**: Retroactive spec-kit conversion of the already-shipped Cron Visualizer tool (`/cron`)
documented at `specs/SPEC.md` §4.9. Authored from source inspection of `routes/pages.py` and
`static/cron.{html,js,css}` — not a forward-looking plan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Validate and understand a cron expression (Priority: P1)

A developer pastes a cron expression and immediately sees whether it's valid, a human-readable
description of when it runs, and a color-coded breakdown of each field — without leaving the
browser or running the expression against a real scheduler.

**Why this priority**: This is the tool's entire reason to exist — instant feedback on a cron
expression that's otherwise opaque to read.

**Independent Test**: Type a valid Unix 5-field expression and confirm a green valid pill, a
plain-English description, and per-field chips; type an invalid one and confirm a red invalid
pill with a specific field-level error instead of a generic failure.

**Acceptance Scenarios**:

1. **Given** the default Unix/Linux dialect, **When** the user types `*/15 9-17 * * 1-5`,
   **Then** the status pill shows valid, the description reads something like "Every 15 minutes,
   between 9:00 AM and 5:00 PM, Monday–Friday," and each field renders as its own tokenized chip.
2. **Given** an expression with the wrong number of fields for the selected dialect, **When**
   parsed, **Then** the status pill shows invalid and the error names the expected field count
   for that dialect.
3. **Given** a field value or token unsupported by the current dialect (e.g. `?` in Unix mode),
   **When** parsed, **Then** the error names the specific token and dialect rather than a
   generic parse failure.
4. **Given** any keystroke in the expression field, **When** the input changes, **Then**
   re-validation happens live (debounced), not only on an explicit submit action.

---

### User Story 2 - Work across multiple cron dialects (Priority: P1)

A developer switches between Unix/Linux (5-field), Quartz/Spring (6–7-field, with `?`/`L`/`W`/`#`
support), AWS EventBridge (6-field + year), and GitHub Actions dialects, since the syntax and
supported tokens differ meaningfully between them.

**Why this priority**: A single dialect would make the tool useless for a large share of
real-world cron usage (Kubernetes CronJob vs. Quartz job scheduler vs. EventBridge rule vs.
GitHub Actions workflow).

**Independent Test**: Switch dialects and confirm the field count/labels, supported special
tokens, and preset library all change to match; confirm an expression valid in one dialect can
be correctly rejected in another with a dialect-specific reason.

**Acceptance Scenarios**:

1. **Given** the dialect selector, **When** the user picks Quartz, **Then** the field builder
   shows Second/Minute/Hour/Day-of-Month/Month/Day-of-Week/Year(optional) and `?`, `L`, `W`, `#`
   become accepted tokens.
2. **Given** the AWS EventBridge dialect, **When** an expression is entered, **Then** a 6-field
   (+ optional year) layout is used, matching EventBridge's rule syntax.
3. **Given** a dialect switch, **When** it happens, **Then** the active dialect button's
   `aria-pressed` state updates and the preset library refreshes to that dialect's presets.

---

### User Story 3 - Build an expression visually instead of writing raw syntax (Priority: P2)

A developer who doesn't want to hand-write cron syntax clicks minute/hour/day/month/weekday
values in a grid to construct an expression, which stays bidirectionally in sync with the raw
text field.

**Why this priority**: Lowers the barrier for less cron-fluent users and reduces syntax errors,
but the tool is still usable via raw text entry alone, so this is P2 not P1.

**Independent Test**: Click several cells in the Minute and Hour grids and confirm the text
field updates to the matching expression; conversely, type an expression directly and confirm
the grids re-render with the matching cells toggled.

**Acceptance Scenarios**:

1. **Given** the Visual Field Builder, **When** the user toggles specific Minute cells (0–59),
   **Then** the raw expression's minute field updates to reflect exactly those minutes.
2. **Given** a raw expression typed directly, **When** it parses successfully, **Then** the
   Field Builder grids re-render with the cells matching that expression's values toggled on.
3. **Given** Day-of-Month (1–31) and Day-of-Week grids, **When** either is toggled, **Then** the
   corresponding field updates independently of the other.

---

### User Story 4 - See upcoming run times and recent activity (Priority: P2)

A developer wants to sanity-check a schedule by seeing exactly when it will next fire and get a
feel for its frequency via a calendar-style heatmap.

**Why this priority**: Turns an abstract expression into concrete, checkable dates — the natural
follow-up question after "is this valid."

**Independent Test**: Enter a valid expression and confirm exactly 10 upcoming run times are
listed in order with locale date/time and a relative countdown; confirm the 28-day heatmap
renders with shading proportional to how often the expression fires each day.

**Acceptance Scenarios**:

1. **Given** a valid expression, **When** it parses, **Then** the Next 10 Run Times panel lists
   10 future timestamps in ascending order, each with locale date, time, and a relative
   countdown (e.g. "in 42 minutes").
2. **Given** the same expression, **When** the 28-Day Activity Heatmap renders, **Then** each of
   the 28 days is shaded by relative run frequency and shows a tooltip with that day's detail on
   hover.
3. **Given** an expression that never matches (e.g. Feb 30), **When** run-time computation is
   attempted, **Then** the panel communicates no upcoming runs rather than hanging or crashing
   the brute-force minute-iteration search.

---

### User Story 5 - Reuse presets and export to other formats (Priority: P3)

A developer picks a common schedule from a curated preset list instead of writing one from
scratch, and exports the finished expression as GitHub Actions/Kubernetes CronJob YAML or AWS
EventBridge JSON for direct use in a config file.

**Why this priority**: Convenience layer on top of the core validate/describe value — useful,
but not required for the tool's primary purpose.

**Independent Test**: Click a preset and confirm it loads into the expression field and
re-validates; export in each supported format and confirm the output is syntactically the
expected YAML/JSON shape for that target.

**Acceptance Scenarios**:

1. **Given** the Preset Library for the active dialect, **When** the user clicks a preset item,
   **Then** its expression loads into the input and the description/fields/next-runs update
   immediately.
2. **Given** a valid expression, **When** the user chooses "Export as GitHub Actions/Kubernetes
   CronJob YAML," **Then** a YAML snippet embedding the expression is produced.
3. **Given** a valid AWS EventBridge-dialect expression, **When** exported as EventBridge JSON,
   **Then** a JSON snippet matching EventBridge's rule schedule shape is produced.
4. **Given** any valid expression, **When** the user copies the raw expression, **Then** it is
   placed on the clipboard unchanged.

---

### Edge Cases

- **Wrong field count for the selected dialect**: reported with the expected count, not a
  generic "invalid expression."
- **Dialect-specific tokens used in the wrong dialect** (e.g. `L`/`W`/`#`/`?` in Unix mode):
  rejected with a message naming the unsupported token and the active dialect.
- **Out-of-range field values** (e.g. minute `61`): rejected per-field, referencing that field's
  valid range.
- **Quartz day-of-week numbering** (`1=Sunday`) differs from Unix (`0=Sunday`) — handled per
  dialect definition, not a shared numbering assumption.
- **Optional year field (Quartz/AWS)**: omission is valid; presence is parsed as an additional
  trailing field only when the dialect declares `supportsYear`.
- **Expressions with no matching future time** (e.g. Feb 30, or Day-of-Month with `L` outside
  the tool's brute-force horizon): degrade gracefully rather than looping indefinitely.
- **Rapid typing**: live validation is debounced so every keystroke doesn't trigger a full
  parse+describe+heatmap+next-runs recomputation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST parse and validate cron expressions for four dialects: Unix/Linux
  (5-field), Quartz/Spring (6–7-field, `?`/`L`/`W`/`#` support), AWS EventBridge (6-field +
  year), and GitHub Actions.
- **FR-002**: The system MUST show live validity status (valid/invalid) and re-validate on every
  input change, debounced.
- **FR-003**: The system MUST render a per-field, color-coded token breakdown of a valid
  expression.
- **FR-004**: The system MUST produce a human-readable natural-language description of a valid
  expression's schedule.
- **FR-005**: The system MUST provide a bidirectional Visual Field Builder (click-to-toggle
  grids for Minute 0–59, Hour 0–23, Day-of-Month 1–31, Month, Day-of-Week) kept in sync with the
  raw text expression in both directions.
- **FR-006**: The system MUST compute and display the next 10 upcoming run times for a valid
  expression via brute-force minute iteration, each with locale date/time and a relative
  countdown.
- **FR-007**: The system MUST render a 28-day activity heatmap showing relative run frequency
  per day with a hover tooltip.
- **FR-008**: The system MUST provide a curated, dialect-specific preset library, click-to-load.
- **FR-009**: The system MUST support exporting a valid expression as: the raw expression
  (clipboard copy), GitHub Actions/Kubernetes CronJob YAML, and AWS EventBridge JSON.
- **FR-010**: All computation (parsing, description, field builder, next-run search, heatmap,
  export) MUST run entirely client-side with no backend request beyond the initial page load.
- **FR-011**: Invalid input MUST produce a field-specific, actionable error message (which
  field, why, and — where applicable — the valid range/tokens) rather than a generic failure.

### Key Entities

- **Dialect Definition**: id, label, field list + labels, per-field ranges, supported special
  tokens (`?`/`L`/`W`/`#`/year), example expression, input placeholder — one per supported
  dialect (`unix`, `quartz`, `aws`, `github`).
- **Parsed Expression**: per-field parsed token set (values/ranges/steps/special tokens) plus
  overall validity and, on failure, a field-attributed error.
- **Preset**: a `{label, expr}` pair, grouped by dialect.
- **Next Run Time**: one computed future timestamp matching the expression, plus its relative
  countdown.
- **Heatmap Day**: one of 28 calendar days with a computed relative run-frequency intensity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user gets validity + human-readable description feedback within the same
  interaction (debounced keystroke), with no page reload or server round-trip.
- **SC-002**: All four dialects correctly validate their own documented example expression and
  correctly reject expressions using another dialect's exclusive tokens.
- **SC-003**: For any valid expression, exactly 10 correctly-ordered future run times are shown.
- **SC-004**: Every preset in the library, when loaded, parses as valid in its own dialect.
- **SC-005**: Exported YAML/JSON snippets are well-formed for their target format.

## Assumptions

- **Fully offline / client-side-only** (SPEC.md §4.9: "All computation is client-side — no
  backend required") — the only backend involvement is serving the static page.
- **Next-run computation uses brute-force minute iteration**, not a closed-form schedule solver
  — adequate for the "next 10" horizon this tool targets, not necessarily efficient for
  far-future or pathological expressions (documented as an implementation characteristic, not a
  correctness issue, in research.md).
- **No persistence**: expressions, dialect choice, and preset selections are not saved across
  page reloads (no DevDB store, no `localStorage` usage observed).
- **Quartz day-of-week uses 1=Sunday** per the Quartz specification, distinct from Unix's
  0=Sunday — this is a deliberate per-dialect definition, not a bug.
