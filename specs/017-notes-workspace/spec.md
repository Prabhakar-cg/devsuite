# Feature Specification: Notes Workspace

**Feature Branch**: `017-notes-workspace`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "A unified Notes workspace tool for DevSuite that blends the core strengths of Notepad++ (fast multi-tab plain-text/code editor, find & replace), OneNote (hierarchical Notebook → Section → Page organization, freeform note-taking), and Obsidian (Markdown-first notes, [[wiki-link]] cross-references, backlinks panel, tags, local-first). Core flows: create notebooks/sections/pages; open multiple pages as tabs; type [[Page Name]] to link pages with autocomplete and create-on-link; view backlinks for the open page; tag and filter pages; full-text search across the workspace; find & replace within a page."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture and organize notes (Priority: P1)

A developer wants a fast place to jot notes while working and keep them organized by project. They create a notebook for a project, add sections to group related notes (e.g. "Meeting Notes", "Design Decisions"), and create pages inside those sections. Each page is a Markdown document they can edit directly, with syntax-aware editing (headings, lists, code blocks) and instant autosave — no explicit save step to remember.

**Why this priority**: This is the baseline "notes app" — without notebook/section/page organization and a working editor, nothing else in the feature has anywhere to live. It is a complete, shippable, useful tool on its own (a OneNote-style organizer plus a Notepad++-style editor), even before any cross-linking exists.

**Independent Test**: Can be fully tested by creating a notebook, adding two sections, creating three pages across them, editing page content, reloading the tool, and confirming the hierarchy and content persisted exactly as left.

**Acceptance Scenarios**:

1. **Given** an empty workspace, **When** the user creates a notebook named "Project X" and a section "Meeting Notes" inside it, **Then** the notebook and section appear in the navigation tree immediately.
2. **Given** a section with no pages, **When** the user creates a new page and types content into it, **Then** the content is saved automatically without any explicit save action, and reappears after a page reload.
3. **Given** three pages open at once, **When** the user switches between their tabs, **Then** each tab preserves its own scroll position and unsaved cursor location.
4. **Given** a page with a long title, **When** it is shown in a tab, **Then** the tab truncates the title with an ellipsis rather than resizing the tab strip unpredictably.
5. **Given** a notebook with multiple sections, **When** the user drags a section to reorder it, **Then** the new order persists after reload.

---

### User Story 2 - Cross-reference notes with wiki-links and backlinks (Priority: P2)

While writing a page, the user references another page by typing `[[` followed by the page title, gets autocomplete suggestions drawn from existing page titles across the whole workspace, and inserts the link. If they type a title that doesn't exist yet, the link is created as "unresolved" until a page with that exact title is created (at which point it automatically resolves). Opening any page shows a backlinks panel listing every other page that links to it, so the user can navigate the web of notes in either direction.

**Why this priority**: This is the Obsidian-style differentiator that turns a folder of notes into a connected knowledge base. It depends on User Story 1 (pages must exist to link between) but is independently testable and delivers value on its own once P1 exists.

**Independent Test**: Can be fully tested by creating two pages, linking page A to page B via `[[Page B]]`, confirming the link is clickable and navigates to page B, and confirming page B's backlinks panel lists page A.

**Acceptance Scenarios**:

1. **Given** an open page, **When** the user types `[[` followed by a few characters, **Then** a dropdown lists matching existing page titles from anywhere in the workspace, ranked by match quality.
2. **Given** a completed `[[Page Name]]` link where "Page Name" exists, **When** the user clicks it, **Then** the target page opens in a new or existing tab.
3. **Given** a completed `[[Page Name]]` link where "Page Name" does not yet exist, **When** the user clicks it, **Then** a new empty page titled "Page Name" is created and opened, and the link becomes resolved.
4. **Given** page B is linked from page A, **When** the user opens page B, **Then** the backlinks panel shows page A with a short surrounding-text preview of the link.
5. **Given** a page is renamed, **When** other pages link to its old title, **Then** those links automatically update to the new title rather than becoming broken.
6. **Given** a page is deleted, **When** other pages still contain links to it, **Then** those links are shown as unresolved (visually distinct) rather than silently disappearing or erroring.

---

### User Story 3 - Tag and search across the workspace (Priority: P3)

The user tags pages with short labels (e.g. `#todo`, `#idea`) to cut across the notebook/section hierarchy, browses all pages carrying a given tag, and runs a full-text search across every notebook, section, and page in the workspace to relocate something they know they wrote but can't remember where. Within a single open page, they can also find & replace text directly, the way they would in a code editor.

**Why this priority**: Valuable at any workspace size but becomes essential only once there's enough content that browsing the tree stops being the fastest way to find something — a natural third layer on top of P1 (content to search) and P2 (links to also surface as search results).

**Independent Test**: Can be fully tested by tagging two pages with the same tag, opening the tag browser and confirming both appear, then searching for a unique word known to exist in only one page's body and confirming only that page is returned.

**Acceptance Scenarios**:

1. **Given** a page being edited, **When** the user adds `#follow-up` inline in the text, **Then** it is recognized as a tag and appears in the workspace's tag list.
2. **Given** several pages tagged `#follow-up`, **When** the user opens the tag browser and selects `#follow-up`, **Then** exactly those pages are listed, grouped or sorted for quick scanning.
3. **Given** a workspace with many pages, **When** the user runs a full-text search for a phrase, **Then** matching pages are listed with a snippet showing the match in context, and selecting a result opens that page.
4. **Given** an open page, **When** the user invokes find & replace and searches for a term present multiple times, **Then** all occurrences are highlighted and the user can step through or replace all at once.

---

### User Story 4 - Format content and attach images quickly (Priority: P2)

While writing, the user wants common Markdown formatting (bold, italic, inline code, fenced code blocks, links) without memorizing syntax, an easy way to copy a code block's contents back out for pasting elsewhere, and the ability to drop in a screenshot or image without leaving the editor.

**Why this priority**: Once P1's editor exists, raw Markdown syntax is a real friction point for anything beyond plain paragraphs — especially code blocks, which are central to a developer's notes and only useful if their contents can be copied back out cleanly. Independent of wiki-links/tags (P2/P3), so it can ship on its own.

**Independent Test**: Can be fully tested by selecting text and clicking each formatting button to confirm the correct Markdown syntax is applied, switching to Preview to confirm a fenced code block's Copy control copies its exact contents, and attaching an image file to confirm it renders inline in Preview.

**Acceptance Scenarios**:

1. **Given** the editor with no text selected, **When** the user clicks the Bold, Italic, or Inline Code toolbar button, **Then** the corresponding Markdown syntax is inserted with the cursor positioned to type the emphasized text immediately.
2. **Given** selected text in the editor, **When** the user clicks Bold, Italic, or Inline Code, **Then** the selection is wrapped in the corresponding Markdown syntax.
3. **Given** the editor, **When** the user clicks the Code Block button, **Then** a fenced code block is inserted (wrapping the current selection if any) with the cursor left inside it.
4. **Given** a page in Preview mode containing a fenced code block, **When** the user clicks its Copy control, **Then** the code block's exact text content (not the surrounding Markdown fence) is copied to the clipboard and a confirmation toast appears.
5. **Given** the editor, **When** the user clicks the Link button, **Then** any current selection becomes the link's visible text and the cursor is positioned inside the `()` to type the URL; with no selection, placeholder link text is inserted pre-selected for immediate typing.
6. **Given** the editor, **When** the user clicks Attach Image and selects a supported image file under the size limit, **Then** the image is embedded inline in the page content as a `data:` URI and renders in Preview with no network request and no separate file store.
7. **Given** the user selects a non-image file, or an image file over the size limit, via Attach Image, **Then** the system rejects it with a clear error and inserts nothing.

---

### Edge Cases

- What happens when the user tries to create a page whose title exactly matches an existing page's title elsewhere in the workspace? Titles must be unique workspace-wide (wiki-links resolve by title alone); the system must reject the duplicate and prompt for a different title rather than silently creating an ambiguous link target.
- What happens when a wiki-link's target page title differs only by case or whitespace? Matching is case-insensitive and whitespace-trimmed for both autocomplete and resolution.
- How does the system handle a workspace with zero notebooks (first-run state)? Shows an empty-state prompting creation of the first notebook, not a blank/broken tree.
- What happens when the user closes the last open tab? The editor area shows an empty-state (consistent with other DevSuite tools' empty states) rather than an error.
- What happens when two different pages both link to a not-yet-created title? Both links point at the same unresolved target; creating that page resolves both simultaneously.
- What happens when a search or tag filter matches zero pages? Shows a clear "no results" state, not an empty list indistinguishable from "still loading."
- What happens when the user deletes a section or notebook that still contains pages? The system requires explicit confirmation and communicates how many pages will be removed with it, since deletion also removes those pages' link targets workspace-wide.
- What happens when the user attaches an image over the size limit, or a non-image file, via Attach Image? Rejected with a clear error toast; nothing is inserted into the page.
- What happens when a page contains many/large embedded images? Each is inline base64 text within that page's Markdown body, inflating the encrypted tree blob's size — there is no lazy-loading or external storage, so very large or numerous embeds slow the whole-tree encrypt/decrypt on every save/unlock, not just that page.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create, rename, and delete notebooks.
- **FR-002**: System MUST allow users to create, rename, delete, and reorder (drag-to-reorder) sections within a notebook.
- **FR-003**: System MUST allow users to create, rename, delete, and reorder pages within a section.
- **FR-004**: System MUST allow multiple pages to be open simultaneously as tabs, with the ability to switch between, and close, individual tabs independently.
- **FR-005**: System MUST edit page content as Markdown with syntax-aware highlighting (headings, lists, code blocks, emphasis, links) in the editor.
- **FR-006**: System MUST autosave page content as the user types, without requiring an explicit save action.
- **FR-007**: System MUST support a `[[Page Name]]` wiki-link syntax that, while typing, offers autocomplete suggestions drawn from all existing page titles in the workspace.
- **FR-008**: System MUST resolve `[[Page Name]]` links to their target page when a page with that exact (case-insensitive, trimmed) title exists, and render unresolved links (target title does not yet exist) in a visually distinct style.
- **FR-009**: System MUST create a new empty page with the linked title when the user activates an unresolved wiki-link, and resolve all links pointing at that title immediately afterward.
- **FR-010**: System MUST display a backlinks panel for the currently open page, listing every other page containing a link that resolves to it, each with a short context snippet.
- **FR-011**: System MUST update all wiki-links referencing a page's old title to its new title when that page is renamed.
- **FR-012**: System MUST leave existing wiki-links pointing at a deleted page's title as unresolved rather than removing or erroring on the referencing text.
- **FR-013**: System MUST enforce that page titles are unique across the entire workspace (not just within a section), and reject creation/rename operations that would produce a duplicate.
- **FR-014**: System MUST allow users to tag pages using an inline `#tag` syntax within page content.
- **FR-015**: System MUST provide a tag browser listing all tags in use and, per tag, every page carrying it.
- **FR-016**: System MUST provide full-text search across all notebooks, sections, and pages, returning matching pages with a context snippet per match.
- **FR-017**: System MUST provide find & replace within the currently open page, supporting step-through and replace-all.
- **FR-018**: System MUST persist all notebook/section/page/tag/link data through the existing DevDB store (`devdb.py`) — no separate database or file-based store.
- **FR-019**: System MUST render all icons as inline stroke-based SVG; no emoji in UI chrome.
- **FR-020**: System MUST be fully usable under every existing DevSuite theme via the shared design tokens in `static/style.css`.
- **FR-021**: System MUST gate all Notes content behind the DevSuite master password, matching Secret Vault's model: notebook/section/page content is encrypted client-side before it reaches DevDB, the backend stores only opaque encrypted blobs and never decrypts them, and an unlock screen (entering the master password) is required before any note becomes readable in a session.
- **FR-022**: System MUST NOT transmit, store, or write the master password to `sessionStorage`/`localStorage`; it is held only in memory for the duration of the unlocked session, consistent with Constitution Principle IV.
- **FR-023**: System MUST provide toolbar controls to insert or wrap the current selection in Bold, Italic, and Inline Code Markdown syntax, and a Code Block control that inserts a fenced code block (wrapping the selection if any).
- **FR-024**: System MUST provide a toolbar control to insert a Markdown link (`[text](url)`), using the current selection as the link text when one exists.
- **FR-025**: System MUST render a copy-to-clipboard control on every fenced code block shown in Preview mode that copies the block's exact text content.
- **FR-026**: System MUST provide a toolbar control to attach an image file (PNG/JPEG/GIF/WebP/BMP, 5 MB max), embedding it inline as a base64 `data:` URI within the page's Markdown content — no separate file store, no network request — and reject non-image files or oversized files with a clear error.
- **FR-027**: System MUST sanitize rendered Markdown such that only image `data:` URIs matching the FR-026 format allowlist (not arbitrary `data:` schemes, which remain blocked) are permitted through, preserving the existing XSS-sanitization guarantee (Constitution Art. V) for everything else.

### Key Entities *(include if feature involves data)*

- **Notebook**: A top-level container for a related set of notes (e.g. one per project). Has a name and an ordered list of sections.
- **Section**: A named grouping of pages within a notebook. Has a name, a parent notebook, and an ordered list of pages.
- **Page**: A single Markdown note. Has a title (unique workspace-wide), Markdown body content, a parent section, a set of tags extracted from its content, and outgoing wiki-links extracted from its content.
- **Tag**: A short label (`#name`) applied inline within page content; not a separately managed object beyond the pages that reference it.
- **Wiki-Link**: A directed reference from one page's content to another page by title; may be resolved (target page exists) or unresolved (target page does not yet exist). Backlinks are the inverse view of this relationship.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a notebook, a section, and a first page, and start typing content, in under 30 seconds from opening the tool for the first time.
- **SC-002**: Switching between 10 simultaneously open page tabs shows no perceptible lag (each switch renders in under 150ms).
- **SC-003**: Wiki-link autocomplete suggestions appear within 200ms of typing `[[` in a workspace containing up to 500 pages.
- **SC-004**: The backlinks panel lists 100% of pages that currently contain a resolved link to the open page — no missed or stale entries.
- **SC-005**: A full-text search across a workspace containing up to 500 pages returns results in under 1 second.
- **SC-006**: In a moderated usability check, at least 90% of users can relocate a specific previously created page (via search, tags, or navigation) within 15 seconds without being taught the tool beforehand.

## Assumptions

- Page content is Markdown text for v1 — free-position canvas notes and ink/drawing (OneNote's non-text capabilities) remain out of scope. Images may be embedded inline as base64 `data:` URIs within that Markdown text (FR-026, no separate file store, no network); other binary file attachments (PDFs, archives, etc.) are out of scope for v1, deferred pending a scoped MIME-allowlist + forced-download design given the larger XSS surface arbitrary `data:` links carry.
- Wiki-links resolve by page title across the entire workspace, not scoped to the current notebook or section — matching Obsidian's vault-wide linking model, which the feature description explicitly cites as inspiration.
- There is a single Notes workspace per DevSuite installation (one collection of notebooks), consistent with DevSuite being a single-user local tool — not multiple independently switchable workspaces/vaults.
- No explicit "Save" action or unsaved-changes prompt exists anywhere in the feature; all edits autosave, consistent with both OneNote's and Obsidian's editing models.
- Full-text search and wiki-link autocomplete operate over content already loaded from DevDB; no external search index/service is introduced (Constitution Principle III: single store, no external database).
- Tag names follow simple `#word` syntax (letters, numbers, hyphens, underscores); nested or hierarchical tags (`#parent/child`) are out of scope for v1.
- Drag-to-reorder applies to sections within a notebook and pages within a section; reordering notebooks themselves (top-level order) is out of scope for v1.
- Because content is encrypted client-side (FR-021), full-text search, wiki-link autocomplete, and backlinks resolution all operate on data already decrypted in-browser after unlock — the backend never performs search or link resolution over plaintext, consistent with it only ever seeing opaque encrypted blobs.
