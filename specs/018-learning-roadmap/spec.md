# Feature Specification: Learning Roadmap

**Feature Branch**: `018-learning-roadmap`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Learning Roadmap — a generic, reusable tool (DevSuite's 13th tool) for tracking multi-step learning plans with notes, checklists, course/document links, and computed completion percentage. Must support multiple independent roadmaps from a single schema, no roadmap-specific code paths. No Master Password gate. Multi-roadmap from day one via a single DevDB store. Reuse the Notes Workspace Monaco markdown editor pattern for step notes. Completion is always computed, never stored. Seed one roadmap, 'AI/MLOps & Agentic AI Infrastructure', with six steps."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse roadmaps and track overall progress (Priority: P1)

A user visiting the Learning Roadmap tool sees a list of their roadmaps, each showing its title, description, and an overall completion percentage. Selecting one opens a detail view listing its steps in order, each with its own progress indicator.

**Why this priority**: This is the minimum viable slice — without a way to see roadmaps and their steps, nothing else in the tool has a surface to attach to. It is also the most frequent use case: checking in on progress.

**Independent Test**: Seed one roadmap with several steps and varying checklist completion; load the tool and confirm the list view shows the correct overall percentage and the detail view shows correct per-step percentages, without touching any editing feature.

**Acceptance Scenarios**:

1. **Given** a roadmap with steps that have no checklist items, **When** the user views the roadmap list, **Then** the roadmap's completion shows 0%, not an error or "NaN".
2. **Given** a roadmap with three steps at 0%, 50%, and 100% checklist completion, **When** the user opens the roadmap detail view, **Then** the overall completion displayed is the unweighted average of the three (50%).
3. **Given** multiple roadmaps exist, **When** the user opens the tool, **Then** each roadmap appears as its own card with its own independently computed percentage, and no roadmap's data affects another's.

---

### User Story 2 - Check off checklist items as learning progresses (Priority: P2)

Within a step, a user marks checklist items done or not-done as they complete parts of that step, and sees the step's and roadmap's completion percentages update immediately.

**Why this priority**: Checklist completion is the primary signal driving the percentages shown in User Story 1 — without a way to change it, the tool is a read-only status page rather than something the user actively uses over time.

**Independent Test**: With a roadmap already loaded (per User Story 1), toggle a checklist item and confirm the step and roadmap percentages recompute correctly and the new state persists across a page reload.

**Acceptance Scenarios**:

1. **Given** a step with 2 of 4 checklist items done, **When** the user checks a third item, **Then** the step's displayed completion updates to 75% without a page reload.
2. **Given** a checklist item is toggled, **When** the underlying save fails (e.g. network/server error), **Then** the checklist item visibly reverts to its prior state and the user is notified, rather than silently showing an incorrect done state.
3. **Given** a checklist item was just toggled, **When** the user reloads the page, **Then** the toggled state is still reflected (change was persisted, not just shown optimistically).

---

### User Story 3 - Capture notes and reference links per step (Priority: P3)

While working through a step, a user writes free-form markdown notes about what they've learned, and attaches links to courses they're taking and reference documents they've found — all scoped to that specific step.

**Why this priority**: Notes and links are the richest content in the tool but are not required to get value from tracking progress (Stories 1–2); they round out the tool from a progress tracker into a genuine study companion.

**Independent Test**: Open a step, add/edit markdown notes and add a course link and a document link, reload the page, and confirm all three are present and unchanged.

**Acceptance Scenarios**:

1. **Given** a step with empty notes, **When** the user writes markdown notes and navigates away, **Then** the notes are saved and reappear on return.
2. **Given** a step, **When** the user adds a course link with a title and URL, **Then** the link appears in that step's course links list and not in any other step's.
3. **Given** a step has an existing document link, **When** the user removes it, **Then** it no longer appears for that step after reload.

---

### User Story 4 - Create and manage roadmaps and their steps (Priority: P4)

A user creates a brand-new roadmap from scratch (or edits an existing one's title/description), so the tool is usable for topics beyond the seeded AI/MLOps content — e.g. a future DevOps roadmap — without any code changes.

**Why this priority**: The schema is explicitly designed to be roadmap-agnostic, but proving that genericity requires the ability to add a second roadmap through the UI/API alone. Lower priority than the seeded roadmap's own read/track/annotate flows because the first roadmap ships pre-seeded and is immediately useful without this capability.

**Independent Test**: Through the API/UI, create a new roadmap with a title and description, confirm it appears in the roadmap list alongside the seeded one with independent (initially 0%, since it has no steps yet) progress, then delete it and confirm it disappears without affecting the seeded roadmap.

**Acceptance Scenarios**:

1. **Given** the roadmap list, **When** the user creates a new roadmap, **Then** it appears in the list with its own id, title, and description.
2. **Given** an existing roadmap, **When** the user edits its title or description, **Then** the change is reflected in both the list and detail views.
3. **Given** an existing roadmap, **When** the user deletes it, **Then** it is removed from the list and its detail view is no longer reachable, and no other roadmap is affected.

---

### Edge Cases

- A roadmap with zero steps shows 0% overall completion (average of an empty set treated as 0%, not NaN or an error).
- A step with zero checklist items shows 0% for that step (0/0 treated as 0%, not NaN), and still contributes to the roadmap average as a 0%-complete step.
- Toggling a checklist item on a step/roadmap that has since been deleted (e.g. two browser tabs) is rejected with a clear error, not a silent no-op or a crash.
- Creating a roadmap with an id that already exists is rejected with a clear error rather than silently overwriting the existing roadmap.
- Course link / document entries with an empty URL are allowed (per the seed data, which ships steps with a document placeholder that has a title but no URL yet) and rendered as non-clickable text rather than a broken link.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow multiple independent roadmaps to exist simultaneously, each with its own id, title, description, and ordered list of steps.
- **FR-002**: System MUST allow a user to list all roadmaps, each shown with its computed overall completion percentage.
- **FR-003**: System MUST allow a user to view a single roadmap's full detail, including all of its steps in their defined order.
- **FR-004**: System MUST allow a user to create a new roadmap with a title and description.
- **FR-005**: System MUST reject creation of a roadmap whose id collides with an existing roadmap's id.
- **FR-006**: System MUST allow a user to update an existing roadmap's title and/or description.
- **FR-007**: System MUST allow a user to delete a roadmap, after which it no longer appears in listings or detail views.
- **FR-008**: Each step MUST carry a title, a free-text description, markdown notes, a checklist (list of text items each with a done/not-done state), a list of course links (title + URL), and a list of documents (title + URL).
- **FR-009**: System MUST allow a user to update a step's notes, course links, and documents.
- **FR-010**: System MUST allow a user to toggle an individual checklist item's done/not-done state independently of any other item.
- **FR-011**: System MUST compute a step's completion percentage as (checklist items done ÷ total checklist items), treating a step with zero checklist items as 0% rather than an undefined value.
- **FR-012**: System MUST compute a roadmap's overall completion percentage as the unweighted average of its steps' completion percentages, treating a roadmap with zero steps as 0%.
- **FR-013**: System MUST NOT persist computed completion percentages; they are derived fresh whenever a roadmap or step is read, so checklist state and displayed percentage can never drift apart.
- **FR-014**: System MUST preserve each step's explicit ordering (independent of storage order) so steps can be reordered in the future without changing their identity or any content that references them.
- **FR-015**: System MUST keep each roadmap's data (steps, notes, checklists, links) fully independent of every other roadmap — no shared state or cross-roadmap code paths.
- **FR-016**: System MUST make the Learning Roadmap tool reachable without requiring the user to unlock the suite's master password, consistent with other non-sensitive tools.
- **FR-017**: System MUST persist all roadmap changes (checklist toggles, notes, links, roadmap/step edits) so they survive a page reload / application restart.
- **FR-018**: System MUST ship with one pre-populated roadmap, "AI/MLOps & Agentic AI Infrastructure," containing six steps in a fixed order, each with a title and description as its starting content (checklist, notes, and links begin empty for the user to fill in).
- **FR-019**: System MUST reject a checklist toggle or step edit targeting a step or roadmap id that does not exist, returning a clear error rather than silently doing nothing or creating new state.
- **FR-020**: System MUST make the Learning Roadmap tool discoverable from the suite's tool listing, alongside its other tools.

### Key Entities

- **Roadmap**: A named, independently-tracked learning plan. Has an id (stable identifier, set at creation and not changed thereafter), title, description, creation/update timestamps, and an ordered collection of Steps. Its completion percentage is always derived from its Steps, never stored directly.
- **Step**: One stage within a single Roadmap. Has an id (unique within its parent Roadmap, not globally), an explicit order position, a title, a description, freeform markdown notes, a Checklist, a collection of Course Links, and a collection of Documents. Belongs to exactly one Roadmap.
- **Checklist Item**: One trackable sub-task within a Step. Has an id (unique within its parent Step), display text, and a done/not-done state. Its state is the sole input to its Step's completion percentage.
- **Course Link**: A reference to an external course or learning resource attached to a Step. Has a title and a URL (URL may be left empty as a placeholder).
- **Document**: A reference to a supporting document attached to a Step (e.g. a cheat sheet, an article). Has a title and a URL (URL may be left empty as a placeholder).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can determine their overall progress on any roadmap within 2 seconds of opening the tool, with no manual calculation required.
- **SC-002**: Checking or unchecking a checklist item updates the visible step and roadmap completion percentages in under 500ms.
- **SC-003**: 100% of roadmaps with zero steps, and 100% of steps with zero checklist items, display a 0% completion value rather than an error, blank, or "NaN" in manual testing.
- **SC-004**: A second, entirely different roadmap (e.g. a future DevOps-focused plan) can be added and fully used (progress tracking, notes, links) without any code change to the tool — schema and UI are fully data-driven.
- **SC-005**: A user's notes, checklist state, and links for a step are still present and correct after closing and reopening the application, in 100% of manual verification passes.
- **SC-006**: A new user can find the Learning Roadmap tool from the suite's main tool listing without being told where to look.

## Assumptions

- Single-user, local-first usage matches the rest of the suite — no multi-user concurrent-editing conflict resolution is required beyond basic existence checks (FR-019).
- Roadmap and step content is not considered sensitive (unlike vault/notes content), so it is intentionally placed outside the master-password-gated tier, per the locked design decision in the input.
- Steps within a roadmap are a fixed, user-managed list for v1; the ability to add/remove/reorder steps through the UI beyond the seeded set is implicitly covered by the same generic step-update capability used for editing, since the schema treats steps as an ordinary ordered collection — no separate "step-reordering" user story was called out as a distinct priority in the source input, so it is treated as part of the general editing capability rather than a headline feature.
- Course links and documents are simple title+URL pairs with no additional metadata (e.g. no tags, no favicon fetching, no link-health checking) for v1.
- Cross-roadmap analytics/dashboards, reminders/scheduling, and dedicated export/import are explicitly out of scope for v1 (export/import needs are already met by the existing database-management export/import capability, applied to this tool's data like any other stored data).
- "Reuse the Notes Workspace markdown editor pattern" is a UI/implementation consideration rather than a user-facing requirement in its own right, so it does not appear as a standalone functional requirement — the requirement that matters at the spec level is FR-009 (notes must be editable and persisted), independent of which editor component satisfies it.
