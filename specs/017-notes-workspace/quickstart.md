# Quickstart: Validating Notes Workspace

Manual end-to-end validation once implementation lands. Assumes the
DevSuite backend is running locally and a master password is already
configured (Secret Vault or DB Manager has been set up at least once — see
`CLAUDE.md`/`README.md` for first-run setup if not).

## Prerequisites

- `pytest tests/python/` and `node tests/javascript/run.js` both pass
  (baseline regression gate, per CLAUDE.md).
- Server running: `uvicorn main:app --reload` (or the project's usual dev
  command).
- A master password already configured for this DevDB (`.dsb` file).

## 1. First open / unlock

1. Navigate to `/notes`.
2. Expect the shared `AuthGuard` unlock screen (same component SSH Manager
   uses) — enter the master password.
3. Expect an empty-state prompting creation of the first notebook (spec.md
   Edge Cases: zero-notebook first-run state) — **not** a blank/broken page.

**Validates**: FR-021/FR-022 (gated, encrypted), research.md item 3.

## 2. Create the hierarchy (User Story 1 / P1)

1. Create a notebook "Project X".
2. Add two sections: "Meeting Notes", "Design Decisions".
3. Create a page "Kickoff" under "Meeting Notes"; type a few paragraphs of
   Markdown, including a heading and a code block.
4. Reload the browser tab.

**Expect**: The notebook/section/page tree and the "Kickoff" page's content
are exactly as left — no explicit save was ever clicked (FR-006).

**Validates**: FR-001–FR-006, SC-001.

## 3. Multi-tab editing

1. Open "Kickoff" and two more pages simultaneously as tabs.
2. Switch between all three tabs several times.

**Expect**: Each tab keeps its own scroll/cursor position; switching is
instant (SC-002, <150ms perceived).

**Validates**: FR-004.

## 4. Wiki-links and backlinks (User Story 2 / P2)

1. In "Kickoff", type `[[Design Doc]]` — a page with that exact title does
   not exist yet.
2. Confirm it renders as an *unresolved* link (visually distinct).
3. Click it. Expect a new empty page titled "Design Doc" is created and
   opened, and the link in "Kickoff" becomes resolved.
4. Open "Design Doc"'s backlinks panel. Expect it lists "Kickoff" with a
   snippet.
5. Rename "Design Doc" to "Design Document". Reopen "Kickoff". Expect the
   link text now reads `[[Design Document]]` and is still resolved
   (FR-011).
6. Delete "Design Document". Reopen "Kickoff". Expect the link is now shown
   unresolved again, and "Kickoff"'s own content is untouched (FR-012).
7. Type `[[` in any page and a few characters of an existing title. Expect
   an autocomplete dropdown of matching titles within ~200ms (SC-003).

**Validates**: FR-007–FR-013, SC-003, SC-004.

## 5. Tags and search (User Story 3 / P3)

1. Add `#todo` inline in two different pages.
2. Open the tag browser, select `#todo`. Expect exactly those two pages
   listed.
3. Run a full-text search for a word known to exist in only one page's
   body. Expect only that page returned, with a context snippet.
4. Open a page, invoke find & replace, search for a term appearing 3+
   times, replace all. Expect all occurrences updated.

**Validates**: FR-014–FR-017, SC-005.

## 6. Cross-cutting checks

- Toggle through DevSuite's themes (`theme.js`) while on `/notes` — every
  surface (tree, tabs, editor chrome, backlinks panel, tag browser) must
  remain legible in each theme (FR-020).
- Inspect the page visually for any emoji in icons/buttons — there should
  be none (FR-019); all icons are inline stroke SVG.
- Open DevDB Manager (`/db-manager`) and confirm a `notes` store is listed
  alongside `vault`/`collections`/`ssh_profiles` (contracts/notes-api.md,
  "Cross-cutting: `_ALLOWED_STORES`").
- Confirm `/tools` shows a Notes Workspace card and the tool count reads 12
  consistently across `tools.html`, `home.html`, README, and `SPEC.md §4`.
- Type `<img src=x onerror=alert(1)>` into a page's Markdown body and
  switch to preview mode. Expect the rendered element carries no `onerror`
  attribute (inspect it in DevTools) and **no script executes**
  (research.md item 5, the DOMPurify requirement).
